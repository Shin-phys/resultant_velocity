import { describe, expect, it } from 'vitest';
import { initialState, reducer } from '../src/state/store';
import { PRESETS } from '../src/data/presets';

/** 合成速度 v を出すタイミング（仕様 06）。 */
describe('合成速度 v の表示', () => {
  it('起動時は隠している', () => {
    expect(initialState.vShown).toBe(false);
  });

  it('再生が終わる前は隠したまま、出したあとは手で変えても隠さない', () => {
    let s = reducer(initialState, { type: 'play' });
    s = reducer(s, { type: 'tick', dt: 1 });
    expect(s.vShown).toBe(false);
    s = reducer(s, { type: 'revealV', at: 0 });
    expect(s.vShown).toBe(true);
    s = reducer(s, { type: 'setV1', v: [1, 4] });
    s = reducer(s, { type: 'setFlowSpeed', speed: 5 });
    expect(s.vShown).toBe(true);
  });

  it('別の例を選ぶと、また隠す', () => {
    let s = reducer(initialState, { type: 'revealV', at: 0 });
    const p = PRESETS[0];
    s = reducer(s, { type: 'loadPreset', id: p.id, v1: p.v1, v2: p.v2, goal: p.goal });
    expect(s.vShown).toBe(false);
    expect(s.revealAt).toBeNull();
  });
});
