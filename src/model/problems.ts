import { computeEnd, flowFromVector, isAxisAligned, type EndInfo, type FlowDir, type Goal } from './kinematics';
import { add, length, type Vec } from './vector';
import stage1 from '../data/problems/stage1.json';
import stage2 from '../data/problems/stage2.json';
import stage3 from '../data/problems/stage3.json';
import stage4 from '../data/problems/stage4.json';

export type ProblemType = 'T1' | 'T2' | 'T3' | 'T4';

/** 問題データ（仕様 08 §6）。 */
export interface Problem {
  id: string;
  stage: 1 | 2 | 3 | 4;
  type: ProblemType;
  skin: string;
  v1: Vec;
  v2: Vec;
  goal:
    | { kind: 'time'; t: number; width?: number }
    | { kind: 'crossBank'; width: number }
    | { kind: 'point'; target: Vec; width: number };
  v1Speed?: number;
  askResultantRow: boolean;
  gridRange?: number;
  text: string;
  variants?: unknown[];
}

/** 時間指定の問題で川幅が省略されたときの値 [m] */
export const DEFAULT_WIDTH = 12;

export const ALL_PROBLEMS: Problem[] = [...stage1, ...stage2, ...stage3, ...stage4] as unknown as Problem[];

export function toGoal(p: Problem): Goal {
  const g = p.goal;
  if (g.kind === 'time') return { kind: 'time', t: g.t, width: g.width ?? DEFAULT_WIDTH };
  if (g.kind === 'crossBank') return { kind: 'crossBank', width: g.width };
  return { kind: 'point', target: g.target, width: g.width };
}

/** 流れの向き（v₂ が 0 の問題はないが、念のため右向きを既定にする）。 */
export const flowDirOf = (p: Problem): FlowDir => flowFromVector(p.v2, 'right').dir;

export interface Answer {
  v: Vec;
  speed: number;
  end: EndInfo;
}

/** 問題の正答（合成速度と到達点）。 */
export function answerOf(p: Problem): Answer {
  const v = add(p.v1, p.v2);
  return { v, speed: length(v), end: computeEnd(v, toGoal(p), flowDirOf(p)) };
}

/** 読み込み時の検証（仕様 08 §6）。問題がなければ空配列。 */
export function validateProblem(p: Problem): string[] {
  const errs: string[] = [];
  const ints = [...p.v1, ...p.v2].every(Number.isInteger);
  if (!ints) errs.push('成分が整数でない');
  if (!isAxisAligned(p.v2) || (p.v2[0] === 0 && p.v2[1] === 0)) errs.push('v₂ が軸方向の 0 でないベクトルでない');
  if (p.type === 'T4') {
    if (p.v1Speed === undefined) errs.push('T4 に v1Speed がない');
    else if (Math.abs(length(p.v1) - p.v1Speed) > 1e-9) errs.push('|v1| が v1Speed と一致しない');
    if (p.goal.kind !== 'point') errs.push('T4 の目標が point でない');
  }
  if (p.stage === 1) {
    const sameLine = p.v2[1] === 0 ? p.v1[1] === 0 : p.v1[0] === 0;
    if (!sameLine) errs.push('段階1なのに v₁ と v₂ が同一直線上にない');
  }
  if (p.stage === 2 && p.v1[0] * p.v2[0] + p.v1[1] * p.v2[1] !== 0) errs.push('段階2なのに v₁ ⊥ v₂ でない');
  if (p.stage === 4 && p.type !== 'T4') errs.push('段階4は T4 のみ');
  const end = answerOf(p).end;
  if (p.goal.kind !== 'time' && end.reason !== 'bank') errs.push('向こう岸に着かない');
  if (p.goal.kind === 'point') {
    const [tx, ty] = p.goal.target;
    if (Math.abs(end.pos[0] - tx) > 1e-9 || Math.abs(end.pos[1] - ty) > 1e-9) errs.push('正答で目標地点に着かない');
  }
  const r = p.gridRange ?? 8;
  const tips = [p.v1, p.v2, add(p.v1, p.v2)];
  if (tips.some((t) => Math.abs(t[0]) > r || Math.abs(t[1]) > r)) errs.push('矢印が方眼の範囲に収まらない');
  return errs;
}
