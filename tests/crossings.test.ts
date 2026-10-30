import { describe, expect, it } from 'vitest';
import { initialState, reducer, type AppState } from '../src/state/store';
import type { Action } from '../src/state/actions';

const run = (s: AppState, ...acts: Action[]) => acts.reduce(reducer, s);
const playToEnd = (s: AppState) => {
  s = reducer(s, { type: 'play' });
  for (let i = 0; i < 2000 && s.status === 'playing'; i++) s = reducer(s, { type: 'tick', dt: 0.05 });
  return s;
};

/** 渡った記録と v を隠すボタン（仕様 07 §5、06） */
describe('渡った記録', () => {
  it('流れだけ変えると、渡る時間は同じで流される距離が変わる', () => {
    let s = playToEnd(initialState); // v₁ (0, 4)、流れ 3 m/s →
    s = playToEnd(reducer(s, { type: 'setFlowSpeed', speed: 6 }));
    s = playToEnd(reducer(s, { type: 'setFlowDir', dir: 'left' }));
    const close = (xs: number[], ys: number[]) => xs.forEach((x, i) => expect(x).toBeCloseTo(ys[i], 9));
    close(s.crossings.map((c) => c.t), [3, 3, 3]);
    close(s.crossings.map((c) => c.drift), [18, 18, 9]);
  });

  it('再生の途中で速度を変えた回は記録しない', () => {
    let s = run(initialState, { type: 'play' }, { type: 'tick', dt: 1 }, { type: 'setFlowSpeed', speed: 5 });
    for (let i = 0; i < 200 && s.status === 'playing'; i++) s = reducer(s, { type: 'tick', dt: 0.05 });
    expect(s.status).toBe('finished');
    expect(s.crossings).toEqual([]);
  });

  it('時間で止める回は記録しない', () => {
    const s = playToEnd(reducer(initialState, { type: 'setGoal', goal: { kind: 'time', t: 5, width: 12 } }));
    expect(s.crossings).toEqual([]);
  });

  it('記録は新しい順に5件まで', () => {
    let s = initialState;
    for (let k = 1; k <= 7; k++) s = playToEnd(reducer(s, { type: 'setFlowSpeed', speed: k }));
    expect(s.crossings).toHaveLength(5);
    expect(s.crossings[0].drift).toBeCloseTo(21, 9);
  });

  it('v を隠すと、また隠れる', () => {
    const s = run(initialState, { type: 'revealV', at: 0 }, { type: 'hideV' });
    expect(s.vShown).toBe(false);
  });
});

describe('加速度のある例（仕様 12）', () => {
  it('流れが止まっている例でも、流れの向きは a₂ から決まる', () => {
    const s0 = reducer(initialState, { type: 'setFlowDir', dir: 'down' });
    const s = reducer(s0, {
      type: 'loadPreset',
      id: 'flowAccel',
      v1: [0, 4],
      v2: [0, 0],
      a2: [1, 0],
      goal: { kind: 'crossBank', width: 12 },
      accel: true,
    });
    expect(s.flowDir).toBe('right');
    expect(s.flowSpeed).toBe(0);
    expect(s.a2).toEqual([1, 0]);
    expect(s.accelOn).toBe(true);
  });

  it('流れが加速しても渡る時間は同じ（記録で確かめる）', () => {
    let s = reducer(initialState, { type: 'setA2', v: [2, 0] });
    s = playToEnd(s);
    s = playToEnd(reducer(s, { type: 'setA2', v: [0, 0] }));
    expect(s.crossings).toHaveLength(2);
    expect(s.crossings[0].t).toBeCloseTo(s.crossings[1].t, 9);
    expect(s.crossings[1].drift).toBeGreaterThan(s.crossings[0].drift);
  });

  it('a₂ は流れの軸の成分だけ残り、川の向きが変わると 0 に戻る', () => {
    let s = reducer(initialState, { type: 'setA2', v: [2, 3] });
    expect(s.a2).toEqual([2, 0]);
    s = reducer(s, { type: 'setFlowDir', dir: 'up' });
    expect(s.a2).toEqual([0, 0]);
  });

  it('加速度のない例を選ぶと加速度は 0 に戻る', () => {
    let s = reducer(initialState, { type: 'setA1', v: [0, 2] });
    s = reducer(s, { type: 'loadPreset', id: 'straight', v1: [0, 4], v2: [3, 0], goal: { kind: 'crossBank', width: 12 } });
    expect(s.a1).toEqual([0, 0]);
    expect(s.accelOn).toBe(false);
  });
});
