import { acrossAxis, banks, computeEnd, type FlowDir, type Goal, velocityAt } from './kinematics';
import { add, type Vec, ZERO } from './vector';

export interface Box {
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
}

/** 流れに沿う方向の片側の最小幅 [m] */
export const MIN_HALF_ALONG = 10;
/** 余白 [m] */
export const MARGIN = 3;

const roundUp5 = (x: number) => Math.ceil(x / 5) * 5;

/**
 * ① イメージ図の表示範囲（仕様 03 §2）。
 * - 流れに沿う方向は出発点を中心に対称に広げ、範囲から到達点が推測できないようにする。
 * - 横断方向は岸の間＋余白。
 * extra には軌跡の端点など、必ず画面に入れたい点を渡す。
 */
export function viewportFor(
  goal: Goal,
  dir: FlowDir,
  v1: Vec,
  v2: Vec,
  extra: readonly Vec[] = [],
  a1: Vec = ZERO,
  a2: Vec = ZERO,
): Box {
  const a = acrossAxis(dir);
  const b = (1 - a) as 0 | 1;
  const end = computeEnd(add(v1, v2), goal, dir, add(a1, a2));
  // 物体から出る速度の矢印（1 m/s を 1 m で描く）も、出発時と終了時に画面に収まるようにする。
  // 加速度があると終了時の速度は初めと違う（仕様 12）
  const tips = (p: Vec, t: number): Vec[] => {
    const u1 = velocityAt(v1, a1, t);
    const u2 = velocityAt(v2, a2, t);
    return [p, add(p, u1), add(p, u2), add(p, add(u1, u2))];
  };
  const pts: Vec[] = [...tips([0, 0], 0), ...tips(end.pos, end.t), ...extra];

  const maxAlong = Math.max(...pts.map((p) => Math.abs(p[b])));
  const half = Math.max(MIN_HALF_ALONG, roundUp5(maxAlong + MARGIN));

  const [lo, hi] = banks(goal);
  const acrossMin = Math.min(lo, ...pts.map((p) => p[a])) - MARGIN;
  const acrossMax = Math.max(hi, ...pts.map((p) => p[a])) + MARGIN;

  return a === 1
    ? { xMin: -half, xMax: half, yMin: acrossMin, yMax: acrossMax }
    : { xMin: acrossMin, xMax: acrossMax, yMin: -half, yMax: half };
}

/** 表示枠の縦横比（幅/高さ）に合わせ、中心を保ったまま短い方を広げる。 */
export function fitAspect(box: Box, aspect: number): Box {
  const w = box.xMax - box.xMin;
  const h = box.yMax - box.yMin;
  if (!(aspect > 0) || !Number.isFinite(aspect)) return box;
  if (w / h < aspect) {
    const nw = h * aspect;
    const cx = (box.xMin + box.xMax) / 2;
    return { ...box, xMin: cx - nw / 2, xMax: cx + nw / 2 };
  }
  const nh = w / aspect;
  const cy = (box.yMin + box.yMax) / 2;
  return { ...box, yMin: cy - nh / 2, yMax: cy + nh / 2 };
}
