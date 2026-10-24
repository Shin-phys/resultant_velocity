import { add, scale, type Vec, ZERO } from './vector';

/** 媒質（流れ）の向き。仕様により ±x, ±y の4方向に限る。 */
export type FlowDir = 'right' | 'left' | 'up' | 'down';

export const FLOW_UNIT: Record<FlowDir, Vec> = {
  right: [1, 0],
  left: [-1, 0],
  up: [0, 1],
  down: [0, -1],
};

export const flowVector = (dir: FlowDir, speed: number): Vec => scale(FLOW_UNIT[dir], speed);

/**
 * 軸方向のベクトルを向きと速さに分ける。0 ベクトルのときは fallback の向きを保つ。
 * 軸方向でないベクトルは先に axisAlign() でそろえておくこと。
 */
export function flowFromVector(v2: Vec, fallback: FlowDir): { dir: FlowDir; speed: number } {
  const [x, y] = v2;
  if (x === 0 && y === 0) return { dir: fallback, speed: 0 };
  if (y === 0) return { dir: x > 0 ? 'right' : 'left', speed: Math.abs(x) };
  if (x === 0) return { dir: y > 0 ? 'up' : 'down', speed: Math.abs(y) };
  throw new Error('流れのベクトルは軸方向でなければならない');
}

/** 大きい方の成分だけを残して軸方向にそろえる（同じ大きさなら x を残す）。 */
export const axisAlign = (v: Vec): Vec =>
  Math.abs(v[0]) >= Math.abs(v[1]) ? [v[0], 0] : [0, v[1]];

export const isAxisAligned = (v: Vec): boolean => v[0] === 0 || v[1] === 0;

/**
 * 終了条件。width は川幅 [m]。
 * - crossBank：出発した岸（横断方向の座標 0）から向こう岸（座標 width）へ
 * - time：指定時間で停止。出発点は川の中央（岸は ±width/2）
 * - point：目標地点（段階4）。フェーズ1では crossBank と同じく向こう岸で停止する
 */
export type Goal =
  | { kind: 'crossBank'; width: number }
  | { kind: 'time'; t: number; width: number }
  | { kind: 'point'; target: Vec; width: number };

/** 横断方向の成分の添字。流れが左右なら y（=1）、上下なら x（=0）。 */
export const acrossAxis = (dir: FlowDir): 0 | 1 => (dir === 'left' || dir === 'right' ? 1 : 0);

/** 岸の位置（横断方向の座標）[手前, 向こう]。 */
export function banks(goal: Goal): [number, number] {
  return goal.kind === 'time' ? [-goal.width / 2, goal.width / 2] : [0, goal.width];
}

/** 向こう岸に向かう成分がないときなどの打ち切り時間 [s]。 */
export const T_LIMIT = 20;

/**
 * 流れに沿う方向に進める範囲（出発点から ±ALONG_LIMIT [m]）。
 * 流れと平行に進むと岸に着かないので、ここで止めて画面が際限なく広がらないようにする。
 */
export const ALONG_LIMIT = 30;

export type EndReason = 'bank' | 'time' | 'edge' | 'limit' | 'noCross';

export interface EndInfo {
  reason: EndReason;
  t: number;
  pos: Vec;
}

/** 一定の合成速度 v で原点から出発したときの終了時刻と位置（解析解）。 */
export function computeEnd(v: Vec, goal: Goal, dir: FlowDir): EndInfo {
  const a = acrossAxis(dir);
  const b = (1 - a) as 0 | 1;
  const va = v[a];
  const vb = v[b];
  const [lo, hi] = banks(goal);
  if (goal.kind !== 'time' && va < 0) return { reason: 'noCross', t: 0, pos: [0, 0] };

  // 早く来た終了条件で止まる（同時なら先に書いたものを優先）
  const cands: { t: number; reason: EndReason }[] = [];
  if (va > 0) cands.push({ t: hi / va, reason: 'bank' });
  if (va < 0) cands.push({ t: lo / va, reason: 'bank' });
  if (goal.kind === 'time') cands.push({ t: goal.t, reason: 'time' });
  if (vb !== 0) cands.push({ t: ALONG_LIMIT / Math.abs(vb), reason: 'edge' });
  cands.push({ t: T_LIMIT, reason: 'limit' });
  let best = cands[0];
  for (const c of cands) if (c.t < best.t - 1e-12) best = c;
  return { reason: best.reason, t: best.t, pos: endPos(v, best.t, a, best.reason, goal) };
}

function endPos(v: Vec, t: number, a: 0 | 1, reason: EndReason, goal: Goal): Vec {
  const p: [number, number] = [v[0] * t, v[1] * t];
  // 浮動小数の誤差を消して、岸や端の上にそろえる
  if (reason === 'bank') {
    const [lo, hi] = banks(goal);
    p[a] = v[a] > 0 ? hi : lo;
  }
  if (reason === 'edge') {
    const b = 1 - a;
    p[b] = Math.sign(v[b]) * ALONG_LIMIT;
  }
  return p;
}

// ---------------------------------------------------------------------------
// 逐次シミュレーション（再生中に v₁・v₂ を変えても動くように、毎フレーム積分する）

export interface SimState {
  t: number;
  /** 物体の地面に対する位置 */
  pos: Vec;
  /** 物体の媒質に対する位置（媒質シートの座標系、出発時の水の位置が原点） */
  r1: Vec;
  /** 媒質シートの移動量（地面に対する） */
  sheet: Vec;
  /** 地面に対する軌跡（地面座標） */
  groundTrail: Vec[];
  /** 媒質に対する軌跡（シート座標。描画時に sheet だけずらす） */
  mediumTrail: Vec[];
  /** 1秒ごとの位置（地面座標）。t = 0 を含む */
  strobes: Vec[];
  finished: EndInfo | null;
}

export const initialSim = (): SimState => ({
  t: 0,
  pos: ZERO,
  r1: ZERO,
  sheet: ZERO,
  groundTrail: [ZERO],
  mediumTrail: [ZERO],
  strobes: [ZERO],
  finished: null,
});

const EPS = 1e-9;
/** 軌跡に点を足す最小間隔 [m]（点が増えすぎないように） */
const TRAIL_MIN_STEP = 0.05;

/**
 * dt 秒進める。終了条件に達するときは、その瞬間でぴったり止める。
 * 状態は書き換えず、新しい状態を返す。
 */
export function stepSim(s: SimState, v1: Vec, v2: Vec, dt: number, goal: Goal, dir: FlowDir): SimState {
  if (s.finished) return s;
  const v = add(v1, v2);
  const a = acrossAxis(dir);
  const b = (1 - a) as 0 | 1;
  const [lo, hi] = banks(goal);
  const p = s.pos[a];
  const va = v[a];
  const vb = v[b];

  if (goal.kind !== 'time' && s.t === 0 && va < 0 && p <= lo + EPS) {
    return { ...s, finished: { reason: 'noCross', t: 0, pos: s.pos } };
  }

  // それぞれの終了条件までの残り時間
  const candidates: { h: number; reason: EndReason }[] = [{ h: T_LIMIT - s.t, reason: 'limit' }];
  if (goal.kind === 'time') candidates.push({ h: goal.t - s.t, reason: 'time' });
  if (va > 0) candidates.push({ h: (hi - p) / va, reason: 'bank' });
  if (va < 0) candidates.push({ h: (p - lo) / -va, reason: 'bank' });
  if (vb > 0) candidates.push({ h: (ALONG_LIMIT - s.pos[b]) / vb, reason: 'edge' });
  if (vb < 0) candidates.push({ h: (s.pos[b] + ALONG_LIMIT) / -vb, reason: 'edge' });

  let h = dt;
  let reason: EndReason | null = null;
  for (const c of candidates) {
    const hc = Math.max(0, c.h);
    if (hc <= h + EPS) {
      if (reason === null || hc < h) {
        h = hc;
        reason = c.reason;
      }
    }
  }

  const t = s.t + h;
  const pos: [number, number] = [s.pos[0] + v[0] * h, s.pos[1] + v[1] * h];
  if (reason === 'bank') pos[a] = va > 0 ? hi : lo; // 浮動小数の誤差を消して岸の上にそろえる
  if (reason === 'edge') pos[b] = vb > 0 ? ALONG_LIMIT : -ALONG_LIMIT;
  const r1 = add(s.r1, scale(v1, h));
  const sheet = add(s.sheet, scale(v2, h));

  // 1秒ごとの点
  let strobes = s.strobes;
  const kFrom = Math.floor(s.t + EPS) + 1;
  const kTo = Math.floor(t + EPS);
  if (kTo >= kFrom) {
    strobes = s.strobes.slice();
    for (let k = kFrom; k <= kTo; k++) strobes.push(add(s.pos, scale(v, k - s.t)));
  }

  const finishing = reason !== null;
  const lastG = s.groundTrail[s.groundTrail.length - 1];
  const moved = Math.hypot(pos[0] - lastG[0], pos[1] - lastG[1]);
  const groundTrail = moved >= TRAIL_MIN_STEP || finishing ? [...s.groundTrail, pos as Vec] : s.groundTrail;
  const lastM = s.mediumTrail[s.mediumTrail.length - 1];
  const movedM = Math.hypot(r1[0] - lastM[0], r1[1] - lastM[1]);
  const mediumTrail = movedM >= TRAIL_MIN_STEP || finishing ? [...s.mediumTrail, r1] : s.mediumTrail;

  return {
    t,
    pos,
    r1,
    sheet,
    groundTrail,
    mediumTrail,
    strobes,
    finished: reason ? { reason, t, pos } : null,
  };
}
