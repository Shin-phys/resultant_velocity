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
  it('流れと平行に進むと、流れに沿う範囲の端で止まる', () => {
    const e = computeEnd([0, 6], C12, 'down');
    expect(e.reason).toBe('edge');
    expect(e.t).toBeCloseTo(5, 9);
    expect(e.pos).toEqual([0, 30]);
  });
  it('止まったままなら打ち切り', () => {
    expect(computeEnd([0, 0], C12, 'right').reason).toBe('limit');
  });
  it('逐次計算でも端で止まり、表示範囲は広がりすぎない', () => {
    const s = run([0, 6], [0, 0], C12, 'down');
    expect(s.finished?.reason).toBe('edge');
    expect(s.pos[1]).toBe(30);
    const b = viewportFor(C12, 'down', [0, 6], [0, 0], s.groundTrail);
    // 端（30 m）＋終了時の矢印（6 m）＋余白 → 40 m で頭打ち
    expect(b.yMax).toBe(40);
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
    // 向こう岸（12 m）で終わったときの v₁ の矢印の先（15 m）＋余白
    expect(b.yMax).toBe(18);
  });
  it('流れが上下なら川は縦向き', () => {
    const b = viewportFor({ kind: 'crossBank', width: 12 }, 'down', [4, 0], [0, -2]);
    expect(b.yMin).toBe(-b.yMax);
    expect(b.xMin).toBe(-3);
    expect(b.xMax).toBe(19);
  });
  it('縦横比に合わせても中心は動かない', () => {
    const b = fitAspect({ xMin: -10, xMax: 10, yMin: -3, yMax: 15 }, 2);
    expect(b.xMax - b.xMin).toBeCloseTo(36, 9);
    expect(b.xMin).toBeCloseTo(-18, 9);
  });
});

/** 加速度のある合成（仕様 12）。例の値で確かめる */
describe('加速度のある合成', () => {
  const C12: Goal = { kind: 'crossBank', width: 12 };
  const runA = (v1: Vec, v2: Vec, a1: Vec, a2: Vec, dt = 1 / 60) => {
    let s = initialSim();
    for (let i = 0; i < 100000 && !s.finished; i++) s = stepSim(s, v1, v2, dt, C12, 'right', a1, a2);
    return s;
  };

  it('船だけ加速：y = t² で 12 m、x = 3t → 放物線。水に対してはまっすぐ', () => {
    const T = Math.sqrt(12);
    const e = computeEnd([3, 0], C12, 'right', [0, 2]);
    expect(e.reason).toBe('bank');
    expect(e.t).toBeCloseTo(T, 9);
    expect(e.pos[0]).toBeCloseTo(3 * T, 9);
    const s = runA([0, 0], [3, 0], [0, 2], [0, 0]);
    expect(s.t).toBeCloseTo(T, 9);
    expect(s.pos[0]).toBeCloseTo(3 * T, 9);
    // 地面に対する跡は x² ∝ y（放物線）、水に対する跡は x = 0（まっすぐ）
    for (const p of s.groundTrail) expect(p[1]).toBeCloseTo((p[0] / 3) ** 2, 6);
    for (const p of s.mediumTrail) expect(p[0]).toBeCloseTo(0, 9);
  });

  it('流れだけ加速：渡る時間は 3 s のまま、x = ½·1·t²', () => {
    const s = runA([0, 4], [0, 0], [0, 0], [1, 0]);
    expect(s.t).toBeCloseTo(3, 9);
    expect(s.pos[0]).toBeCloseTo(4.5, 9);
  });

  it('両方とも止まった状態から加速：直線（y = 2x）', () => {
    const s = runA([0, 0], [0, 0], [0, 2], [1, 0]);
    expect(s.t).toBeCloseTo(Math.sqrt(12), 9);
    for (const p of s.groundTrail) expect(p[1]).toBeCloseTo(2 * p[0], 6);
  });

  it('1秒ごとの点の間隔が広がる', () => {
    const s = runA([0, 0], [3, 0], [0, 2], [0, 0]);
    const ys = s.strobes.map((p) => p[1]);
    expect(ys.slice(0, 4).map((y) => Number(y.toFixed(9)))).toEqual([0, 1, 4, 9]);
  });

  it('流れが加速しても渡る時間は変わらない', () => {
    const t0 = runA([0, 4], [3, 0], [0, 0], [0, 0]).t;
    const t1 = runA([0, 4], [3, 0], [0, 0], [2, 0]).t;
    const t2 = runA([0, 4], [3, 0], [0, 0], [-1, 0]).t;
    expect(t1).toBeCloseTo(t0, 9);
    expect(t2).toBeCloseTo(t0, 9);
  });

  it('減速して元の岸に戻ってきたら止める', () => {
    const e = computeEnd([0, 4], C12, 'right', [0, -2]); // 最高 4 m で折り返す
    expect(e.reason).toBe('returned');
    expect(e.t).toBeCloseTo(4, 9);
    const s = runA([0, 4], [0, 0], [0, -2], [0, 0]);
    expect(s.finished?.reason).toBe('returned');
    expect(s.pos[1]).toBe(0);
  });

  it('速度 0 で向こう岸と逆向きに加速するなら出発しない', () => {
    expect(computeEnd([0, 0], C12, 'right', [0, -1]).reason).toBe('noCross');
  });

  it('表示範囲は終わりの速度の矢印まで含む', () => {
    const b = viewportFor(C12, 'right', [0, 0], [3, 0], [], [0, 2], [0, 0]);
    // 終わりの速度 v = (3, 2√12 ≈ 6.93)、位置 (10.4, 12) → 矢印の先 y ≈ 18.9
    expect(b.yMax).toBeGreaterThanOrEqual(12 + 2 * Math.sqrt(12));
  });
});
