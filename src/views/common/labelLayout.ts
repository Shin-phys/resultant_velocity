import type { Vec } from '../../model/vector';

/**
 * 図の中のラベル（「v₁ = 4.0 m/s」など）を、矢印・つまみ・ほかのラベルと重ならない位置に置く。
 * 座標はすべて世界座標（y 上向き）。React に依存しない純粋な関数だけを置く。
 */

/** 軸にそろった箱 */
export interface Rect {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

/** よけるもの：線分（矢印）または箱（つまみ・原点・船など） */
export type Obstacle = { kind: 'seg'; a: Vec; b: Vec } | { kind: 'rect'; r: Rect };

export interface LabelRequest {
  key: string;
  /** ラベルの幅と高さ（世界座標） */
  w: number;
  h: number;
  /** 置き場所の候補（ラベルの中心）。先にあるものほど望ましい */
  candidates: Vec[];
}

export interface PlacedLabel {
  key: string;
  center: Vec;
  rect: Rect;
}

export const rectAt = (c: Vec, w: number, h: number): Rect => ({
  x0: c[0] - w / 2,
  y0: c[1] - h / 2,
  x1: c[0] + w / 2,
  y1: c[1] + h / 2,
});

export const rectsOverlap = (p: Rect, q: Rect): boolean => p.x0 < q.x1 && q.x0 < p.x1 && p.y0 < q.y1 && q.y0 < p.y1;

export const circleRect = (c: Vec, r: number): Rect => ({ x0: c[0] - r, y0: c[1] - r, x1: c[0] + r, y1: c[1] + r });

/** 線分が箱と交わるか（Liang–Barsky のクリッピング） */
export function segHitsRect(a: Vec, b: Vec, r: Rect): boolean {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  let t0 = 0;
  let t1 = 1;
  const clip = (p: number, q: number): boolean => {
    if (p === 0) return q >= 0;
    const t = q / p;
    if (p < 0) {
      if (t > t1) return false;
      if (t > t0) t0 = t;
    } else {
      if (t < t0) return false;
      if (t < t1) t1 = t;
    }
    return true;
  };
  return (
    clip(-dx, a[0] - r.x0) && clip(dx, r.x1 - a[0]) && clip(-dy, a[1] - r.y0) && clip(dy, r.y1 - a[1]) && t0 <= t1
  );
}

const inflate = (r: Rect, m: number): Rect => ({ x0: r.x0 - m, y0: r.y0 - m, x1: r.x1 + m, y1: r.y1 + m });

function blocked(r: Rect, obstacles: readonly Obstacle[], placed: readonly PlacedLabel[], bounds: Rect, pad: number): boolean {
  if (r.x0 < bounds.x0 || r.x1 > bounds.x1 || r.y0 < bounds.y0 || r.y1 > bounds.y1) return true;
  const rp = inflate(r, pad);
  for (const o of obstacles) {
    if (o.kind === 'seg' ? segHitsRect(o.a, o.b, rp) : rectsOverlap(o.r, rp)) return true;
  }
  return placed.some((p) => rectsOverlap(p.rect, rp));
}

/**
 * 先に並べたラベルから順に、空いている候補に置く。pad はまわりに空けるすき間。
 * どの候補も空いていなければ、画面に収まる最初の候補に置く（重なっても消すよりはよい）。
 */
export function placeLabels(
  reqs: readonly LabelRequest[],
  obstacles: readonly Obstacle[],
  bounds: Rect,
  pad = 0,
): PlacedLabel[] {
  const placed: PlacedLabel[] = [];
  for (const q of reqs) {
    if (q.candidates.length === 0) continue;
    // 空きがないときは、画面からはみ出さない最初の候補にする
    const inside = (c: Vec) => {
      const r = rectAt(c, q.w, q.h);
      return r.x0 >= bounds.x0 && r.x1 <= bounds.x1 && r.y0 >= bounds.y0 && r.y1 <= bounds.y1;
    };
    let center = q.candidates.find(inside) ?? q.candidates[0];
    for (const c of q.candidates) {
      if (!blocked(rectAt(c, q.w, q.h), obstacles, placed, bounds, pad)) {
        center = c;
        break;
      }
    }
    placed.push({ key: q.key, center, rect: rectAt(center, q.w, q.h) });
  }
  return placed;
}

/**
 * 線分 from→to の横に置く候補。中点を先に、少しずつ端へずらし、
 * 望ましい側（side）→ 反対側 → 1段外側の順に並べる。
 * 箱の大きさを考えて、どの向きの線でも線に重ならない距離をとる。
 */
export function besideSegment(from: Vec, to: Vec, w: number, h: number, gap: number, side: Vec | null): Vec[] {
  const dx = to[0] - from[0];
  const dy = to[1] - from[1];
  const len = Math.hypot(dx, dy);
  if (len < 1e-9) return [];
  const n: Vec = [-dy / len, dx / len];
  const first = side && n[0] * side[0] + n[1] * side[1] < 0 ? -1 : 1;
  const ext = (Math.abs(n[0]) * w) / 2 + (Math.abs(n[1]) * h) / 2;
  const out: Vec[] = [];
  for (const row of [0, 1, 2]) {
    for (const s of [first, -first]) {
      for (const t of [0.5, 0.35, 0.65, 0.2, 0.8]) {
        const d = s * (ext + gap + row * (Math.min(w, h) + gap));
        out.push([from[0] + dx * t + n[0] * d, from[1] + dy * t + n[1] * d]);
      }
    }
  }
  return out;
}

/** 先端の先に置く候補（矢印の延長上、少し左右にずらしたものも）。clear は先端のつまみをよける距離 */
export function beyondTip(from: Vec, to: Vec, w: number, h: number, gap: number, clear = 0): Vec[] {
  const dx = to[0] - from[0];
  const dy = to[1] - from[1];
  const len = Math.hypot(dx, dy);
  if (len < 1e-9) return [];
  const u: Vec = [dx / len, dy / len];
  const n: Vec = [-u[1], u[0]];
  const ext = (Math.abs(u[0]) * w) / 2 + (Math.abs(u[1]) * h) / 2;
  const out: Vec[] = [];
  for (const k of [0, 1, -1]) {
    const d = ext + gap + clear;
    out.push([to[0] + u[0] * d + n[0] * k * h, to[1] + u[1] * d + n[1] * k * h]);
  }
  return out;
}

/** 文字列の幅のおおよその見積もり（em 単位）。和文は 1em、英数字は約 0.56em */
export function textEm(text: string): number {
  let w = 0;
  for (const ch of text) {
    const c = ch.codePointAt(0) ?? 0;
    if (ch === ' ') w += 0.3;
    else if (c >= 0x2080 && c <= 0x209f) w += 0.5; // 下付き数字
    else if (c < 0x2000) w += 0.56;
    else w += 1;
  }
  return w;
}
