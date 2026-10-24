import { describe, expect, it } from 'vitest';
import { ALL_PROBLEMS, answerOf, validateProblem } from '../src/model/problems';

/** 仕様 08 §4 の表の値。データを変えたらここと仕様書の両方を直すこと。 */
const EXPECTED: Record<string, { v: [number, number]; speed: number; t: number; pos: [number, number] }> = {
  's1-01': { v: [5, 0], speed: 5.0, t: 5, pos: [25, 0] },
  's1-02': { v: [1, 0], speed: 1.0, t: 5, pos: [5, 0] },
  's1-03': { v: [-1, 0], speed: 1.0, t: 5, pos: [-5, 0] },
  's1-04': { v: [-3, 0], speed: 3.0, t: 5, pos: [-15, 0] },
  's2-01': { v: [3, 4], speed: 5.0, t: 3, pos: [9, 12] },
  's2-02': { v: [-4, 3], speed: 5.0, t: 4, pos: [-16, 12] },
  's2-03': { v: [2, 6], speed: 6.3, t: 2, pos: [4, 12] },
  's2-04': { v: [4, -2], speed: 4.5, t: 3, pos: [12, -6] },
  's3-01': { v: [-1, 4], speed: 4.1, t: 3, pos: [-3, 12] },
  's3-02': { v: [3, 3], speed: 4.2, t: 4, pos: [12, 12] },
  's3-03': { v: [0, 3], speed: 3.0, t: 4, pos: [0, 12] },
  's4-01': { v: [0, 4], speed: 4.0, t: 3, pos: [0, 12] },
  's4-02': { v: [0, 8], speed: 8.0, t: 2, pos: [0, 16] },
  's4-03': { v: [0, 12], speed: 12.0, t: 2, pos: [0, 24] },
  's4-04': { v: [5, 4], speed: 6.4, t: 3, pos: [15, 12] },
};

describe('収録問題', () => {
  it('仕様書の表にある問題がすべて収録されている', () => {
    expect(ALL_PROBLEMS.map((p) => p.id).sort()).toEqual(Object.keys(EXPECTED).sort());
  });

  for (const p of ALL_PROBLEMS) {
    describe(p.id, () => {
      it('検証を通る', () => {
        expect(validateProblem(p)).toEqual([]);
      });
      it('正答が仕様書の表と一致する', () => {
        const e = EXPECTED[p.id];
        const a = answerOf(p);
        expect(a.v).toEqual(e.v);
        expect(Number(a.speed.toFixed(1))).toBe(e.speed);
        expect(a.end.t).toBeCloseTo(e.t, 9);
        expect(a.end.pos[0]).toBeCloseTo(e.pos[0], 9);
        expect(a.end.pos[1]).toBeCloseTo(e.pos[1], 9);
      });
    });
  }
});
