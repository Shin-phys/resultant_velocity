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
