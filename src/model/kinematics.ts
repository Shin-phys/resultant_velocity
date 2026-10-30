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

/**
 * 止まった理由。
 * - bank：岸に着いた（向こう岸。時間指定ではどちらかの岸）
 * - returned：加速度のために元の岸に戻ってきた（仕様 12 §5）
 * - time：指定時間になった
 * - edge：流れに沿って画面の端（±ALONG_LIMIT）まで来た
 * - limit：T_LIMIT で打ち切った
 * - noCross：向こう岸へ向かわないので出発しなかった
 */
export type EndReason = 'bank' | 'returned' | 'time' | 'edge' | 'limit' | 'noCross';

export interface EndInfo {
  reason: EndReason;
  t: number;
  pos: Vec;
}

/** これより短い時間の解は「いまその場所にいる」とみなして数えない [s] */
const HIT_EPS = 1e-9;

/**
 * p(h) = p0 + u·h + ½·c·h² が target に達する最小の正の h。達しなければ Infinity。
 * 等速（c = 0）なら1次方程式、等加速度なら2次方程式を解く。
 */
export function firstHit(p0: number, u: number, c: number, target: number): number {
  const d = p0 - target;
  if (c === 0) {
    if (u === 0) return Infinity;
    const h = -d / u;
    return h > HIT_EPS ? h : Infinity;
  }
  const disc = u * u - 2 * c * d;
  if (disc < 0) return Infinity;
  const sq = Math.sqrt(disc);
  const roots = [(-u - sq) / c, (-u + sq) / c].filter((h) => h > HIT_EPS).sort((x, y) => x - y);
  return roots.length ? roots[0] : Infinity;
}

/** 位置 p、速度 u、加速度 c の物体が h 秒後にいる位置 */
const advance = (p: Vec, u: Vec, c: Vec, h: number): Vec => [
  p[0] + u[0] * h + 0.5 * c[0] * h * h,
  p[1] + u[1] * h + 0.5 * c[1] * h * h,
];

interface Candidate {
  h: number;
  reason: EndReason;
  /** 止まる位置をそろえる成分と値（浮動小数の誤差を消すため） */
  snap?: { axis: 0 | 1; value: number };
}

/** 時刻 t、位置 p、速度 u、加速度 c のときの、それぞれの終了条件までの残り時間 */
function candidates(t: number, p: Vec, u: Vec, c: Vec, goal: Goal, dir: FlowDir): Candidate[] {
  const a = acrossAxis(dir);
  const b = (1 - a) as 0 | 1;
  const [lo, hi] = banks(goal);
  const out: Candidate[] = [];
  out.push({ h: firstHit(p[a], u[a], c[a], hi), reason: 'bank', snap: { axis: a, value: hi } });
  out.push({
    h: firstHit(p[a], u[a], c[a], lo),
    reason: goal.kind === 'time' ? 'bank' : 'returned',
    snap: { axis: a, value: lo },
  });
  if (goal.kind === 'time') out.push({ h: goal.t - t, reason: 'time' });
  out.push({ h: firstHit(p[b], u[b], c[b], ALONG_LIMIT), reason: 'edge', snap: { axis: b, value: ALONG_LIMIT } });
  out.push({ h: firstHit(p[b], u[b], c[b], -ALONG_LIMIT), reason: 'edge', snap: { axis: b, value: -ALONG_LIMIT } });
  out.push({ h: T_LIMIT - t, reason: 'limit' });
  return out;
}

/** 出発の時点で向こう岸へ向かわないか（速度が負、または速度 0 で加速度が負） */
function cannotStart(p: Vec, u: Vec, c: Vec, goal: Goal, dir: FlowDir): boolean {
  if (goal.kind === 'time') return false;
  const a = acrossAxis(dir);
  const [lo] = banks(goal);
  return p[a] <= lo + HIT_EPS && (u[a] < 0 || (u[a] === 0 && c[a] < 0));
}

/** 一番早い終了条件（hMax より後なら null） */
function earliest(cands: Candidate[], hMax: number): Candidate | null {
  let best: Candidate | null = null;
  for (const cd of cands) {
    const h = Math.max(0, cd.h);
    if (h <= hMax + HIT_EPS && (best === null || h < best.h - 1e-12)) best = { ...cd, h };
  }
  return best;
}

function snapped(p: Vec, cd: Candidate | null): Vec {
  if (!cd?.snap) return p;
  const q: [number, number] = [p[0], p[1]];
  q[cd.snap.axis] = cd.snap.value;
  return q;
}

/**
 * 原点から速度 v・加速度 acc（どちらも地面に対する合成）で出発したときの終了時刻と位置（解析解）。
 * acc を省略すると等速。
 */
export function computeEnd(v: Vec, goal: Goal, dir: FlowDir, acc: Vec = ZERO): EndInfo {
  const p0: Vec = [0, 0];
  if (cannotStart(p0, v, acc, goal, dir)) return { reason: 'noCross', t: 0, pos: p0 };
  const cd = earliest(candidates(0, p0, v, acc, goal, dir), Infinity)!;
  return { reason: cd.reason, t: cd.h, pos: snapped(advance(p0, v, acc, cd.h), cd) };
}

// ---------------------------------------------------------------------------
// 逐次シミュレーション（再生中に v₁・v₂ を変えても動くように、毎フレーム積分する）
// v₁・v₂ は t = 0 での速度。時刻 t の速度は v₁ + a₁t、v₂ + a₂t（仕様 12 §2）。
// 1フレームの中では加速度が一定なので、等加速度の式で厳密に進める。

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

/** 時刻 t での速度 */
export const velocityAt = (v0: Vec, acc: Vec, t: number): Vec => [v0[0] + acc[0] * t, v0[1] + acc[1] * t];

/**
 * dt 秒進める。終了条件に達するときは、その瞬間でぴったり止める。
 * 状態は書き換えず、新しい状態を返す。a1・a2 を省略すると等速。
 */
export function stepSim(
  s: SimState,
  v1: Vec,
  v2: Vec,
  dt: number,
  goal: Goal,
  dir: FlowDir,
  a1: Vec = ZERO,
  a2: Vec = ZERO,
): SimState {
  if (s.finished) return s;
  const u1 = velocityAt(v1, a1, s.t);
  const u2 = velocityAt(v2, a2, s.t);
  const u = add(u1, u2);
  const c = add(a1, a2);

  if (s.t === 0 && cannotStart(s.pos, u, c, goal, dir)) {
    return { ...s, finished: { reason: 'noCross', t: 0, pos: s.pos } };
  }

  const cd = earliest(candidates(s.t, s.pos, u, c, goal, dir), dt);
  const h = cd ? cd.h : dt;
  const t = s.t + h;
  const pos = snapped(advance(s.pos, u, c, h), cd);
  const r1 = advance(s.r1, u1, a1, h);
  const sheet = advance(s.sheet, u2, a2, h);

  // 1秒ごとの点
  let strobes = s.strobes;
  const kFrom = Math.floor(s.t + EPS) + 1;
  const kTo = Math.floor(t + EPS);
  if (kTo >= kFrom) {
    strobes = s.strobes.slice();
    for (let k = kFrom; k <= kTo; k++) strobes.push(advance(s.pos, u, c, k - s.t));
  }

  const finishing = cd !== null;
  const lastG = s.groundTrail[s.groundTrail.length - 1];
  const moved = Math.hypot(pos[0] - lastG[0], pos[1] - lastG[1]);
  const groundTrail = moved >= TRAIL_MIN_STEP || finishing ? [...s.groundTrail, pos] : s.groundTrail;
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
    finished: cd ? { reason: cd.reason, t, pos } : null,
  };
}
