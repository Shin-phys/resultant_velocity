import { describe, expect, it } from 'vitest';
import {
  axisAlign,
  computeEnd,
  flowFromVector,
  initialSim,
  stepSim,
  type FlowDir,
  type Goal,
  type SimState,
} from '../src/model/kinematics';
import { fitAspect, viewportFor } from '../src/model/viewport';
import { add, snap, type Vec } from '../src/model/vector';
import { ALL_PROBLEMS, answerOf, flowDirOf, toGoal } from '../src/model/problems';

function run(v1: Vec, v2: Vec, goal: Goal, dir: FlowDir, dt = 1 / 60): SimState {
  let s = initialSim();
  for (let i = 0; i < 100000 && !s.finished; i++) s = stepSim(s, v1, v2, dt, goal, dir);
  return s;
}

describe('流れの向き', () => {
  it('軸方向にそろえる', () => {
    expect(axisAlign([3, 1])).toEqual([3, 0]);
    expect(axisAlign([1, -4])).toEqual([0, -4]);
    expect(axisAlign([2, 2])).toEqual([2, 0]);
  });
  it('ベクトルから向きと速さ', () => {
    expect(flowFromVector([0, -2], 'right')).toEqual({ dir: 'down', speed: 2 });
    expect(flowFromVector([0, 0], 'up')).toEqual({ dir: 'up', speed: 0 });
  });
  it('スナップで -0 が残らない', () => {
    expect(Object.is(snap([-0.2, 0.4])[0], 0)).toBe(true);
  });
});

describe('終了条件（解析解）', () => {
  const C12: Goal = { kind: 'crossBank', width: 12 };
  it('向こう岸に向かわないときは出発しない', () => {
    expect(computeEnd([3, -1], C12, 'right').reason).toBe('noCross');
  });
  it('横断成分が 0 なら打ち切り', () => {
    expect(computeEnd([3, 0], C12, 'right').reason).toBe('limit');
  });
  it('時間指定でも先に岸に着けば止まる', () => {
    const e = computeEnd([0, 3], { kind: 'time', t: 5, width: 12 }, 'right');
    expect(e.reason).toBe('bank');
    expect(e.t).toBeCloseTo(2, 9);
    expect(e.pos).toEqual([0, 6]);
  });
});

describe('逐次シミュレーション', () => {
  for (const p of ALL_PROBLEMS) {
    it(`${p.id}：積分しても解析解と同じ所で止まる`, () => {
      const s = run(p.v1, p.v2, toGoal(p), flowDirOf(p));
      const a = answerOf(p);
      expect(s.finished?.reason).toBe(a.end.reason);
      expect(s.t).toBeCloseTo(a.end.t, 9);
      expect(s.pos[0]).toBeCloseTo(a.end.pos[0], 9);
      expect(s.pos[1]).toBeCloseTo(a.end.pos[1], 9);
    });
  }

  it('1秒ごとの点の間隔は |v|×1 s', () => {
    const s = run([0, 4], [3, 0], { kind: 'crossBank', width: 12 }, 'right');
    expect(s.strobes.length).toBe(4); // t = 0, 1, 2, 3
    expect(s.strobes[2][0]).toBeCloseTo(6, 9);
    expect(s.strobes[2][1]).toBeCloseTo(8, 9);
  });

  it('媒質に対する位置は v₁t、シートの移動は v₂t', () => {
    const s = run([0, 4], [3, 0], { kind: 'crossBank', width: 12 }, 'right');
    expect(s.r1[1]).toBeCloseTo(12, 9);
    expect(s.sheet[0]).toBeCloseTo(9, 9);
    // 地面に対する位置 = 媒質に対する位置 + シートの移動
    const sum = add(s.r1, s.sheet);
    expect(sum[0]).toBeCloseTo(s.pos[0], 9);
    expect(sum[1]).toBeCloseTo(s.pos[1], 9);
  });

  it('大きな dt でも行き過ぎない', () => {
    const s = run([0, 4], [3, 0], { kind: 'crossBank', width: 12 }, 'right', 10);
    expect(s.pos).toEqual([9, 12]);
  });
});

describe('表示範囲', () => {
  it('流れに沿う方向は出発点に対して対称で、到達点を含む', () => {
    const b = viewportFor({ kind: 'crossBank', width: 12 }, 'right', [0, 3], [-4, 0]);
    expect(b.xMin).toBe(-b.xMax);
    expect(b.xMin).toBeLessThanOrEqual(-16);
    expect(b.yMin).toBe(-3);
    expect(b.yMax).toBe(15);
  });
  it('流れが上下なら川は縦向き', () => {
    const b = viewportFor({ kind: 'crossBank', width: 12 }, 'down', [4, 0], [0, -2]);
    expect(b.yMin).toBe(-b.yMax);
    expect(b.xMin).toBe(-3);
    expect(b.xMax).toBe(15);
  });
  it('縦横比に合わせても中心は動かない', () => {
    const b = fitAspect({ xMin: -10, xMax: 10, yMin: -3, yMax: 15 }, 2);
    expect(b.xMax - b.xMin).toBeCloseTo(36, 9);
    expect(b.xMin).toBeCloseTo(-18, 9);
  });
});
