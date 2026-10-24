import { acrossAxis, banks, computeEnd, type FlowDir, type Goal } from './kinematics';
import { add, type Vec } from './vector';

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
 * ① 場面の表示範囲（仕様 03 §2）。
 * - 流れに沿う方向は出発点を中心に対称に広げ、範囲から到達点が推測できないようにする。
 * - 横断方向は岸の間＋余白。
 * extra には軌跡の端点など、必ず画面に入れたい点を渡す。
 */
export function viewportFor(goal: Goal, dir: FlowDir, v1: Vec, v2: Vec, extra: readonly Vec[] = []): Box {
  const a = acrossAxis(dir);
  const b = (1 - a) as 0 | 1;
  const end = computeEnd(add(v1, v2), goal, dir);
  const pts: Vec[] = [[0, 0], end.pos, ...extra];

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
