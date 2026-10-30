import { describe, expect, it } from 'vitest';
import { besideSegment, placeLabels, rectAt, rectsOverlap, segHitsRect } from '../src/views/common/labelLayout';

describe('図のラベルの置き場所', () => {
  it('線分と箱の交わり', () => {
    const r = { x0: 0, y0: 0, x1: 1, y1: 1 };
    expect(segHitsRect([-1, 0.5], [2, 0.5], r)).toBe(true);
    expect(segHitsRect([-1, 2], [2, 2], r)).toBe(false);
    expect(segHitsRect([0.2, 0.2], [0.4, 0.4], r)).toBe(true);
  });

  it('線の横の候補は、どの向きの線にも重ならない', () => {
    for (const to of [[4, 0], [0, 4], [3, 4], [-3, -4]] as [number, number][]) {
      const c = besideSegment([0, 0], to, 3, 1, 0.1, null)[0];
      expect(segHitsRect([0, 0], to, rectAt(c, 3, 1))).toBe(false);
    }
  });

  it('同じ所を望むラベルどうしは重ならないように置く', () => {
    const cands: [number, number][] = [
      [0, 1],
      [0, 2.5],
      [0, 4],
    ];
    const placed = placeLabels(
      [
        { key: 'a', w: 2, h: 1, candidates: cands },
        { key: 'b', w: 2, h: 1, candidates: cands },
      ],
      [{ kind: 'seg', a: [-5, 0], b: [5, 0] }],
      { x0: -10, y0: -10, x1: 10, y1: 10 },
    );
    expect(rectsOverlap(placed[0].rect, placed[1].rect)).toBe(false);
  });
});
