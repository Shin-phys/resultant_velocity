/** 2次元ベクトル [x, y]。速度は m/s、位置は m。 */
export type Vec = readonly [number, number];

export const ZERO: Vec = [0, 0];

export const add = (a: Vec, b: Vec): Vec => [a[0] + b[0], a[1] + b[1]];
export const sub = (a: Vec, b: Vec): Vec => [a[0] - b[0], a[1] - b[1]];
export const scale = (a: Vec, k: number): Vec => [a[0] * k, a[1] * k];
export const length = (a: Vec): number => Math.hypot(a[0], a[1]);
export const equals = (a: Vec, b: Vec): boolean => a[0] === b[0] && a[1] === b[1];
export const isZero = (a: Vec): boolean => a[0] === 0 && a[1] === 0;

/** 格子点へのスナップ（成分を整数に丸める）。-0 は 0 にそろえる。 */
export const snap = (a: Vec): Vec => [Math.round(a[0]) || 0, Math.round(a[1]) || 0];

/** 各成分を [-r, r] に収める。 */
export const clampBox = (a: Vec, r: number): Vec => [
  Math.max(-r, Math.min(r, a[0])),
  Math.max(-r, Math.min(r, a[1])),
];

/** 大きさを小数第1位で表示する文字列（例：5.0）。 */
export const formatLength = (a: Vec): string => length(a).toFixed(1);

/** 成分の表示（負号は全角マイナスではなく U+2212 を使う）。 */
export const formatComponent = (n: number): string => {
  const r = Math.round(n * 10) / 10;
  const s = Number.isInteger(r) ? String(Math.abs(r)) : Math.abs(r).toFixed(1);
  return r < 0 ? `−${s}` : s;
};

export const formatVec = (a: Vec): string => `(${formatComponent(a[0])}, ${formatComponent(a[1])})`;

/**
 * v₁ と v₂ が同一直線上（どちらも 0 でない）なら、その直線に垂直な単位ベクトルを返す。
 * 同一直線上の矢印は重なって見えなくなるので、描画時にこの向きへ少しずらす。
 */
export function collinearNormal(a: Vec, b: Vec): Vec | null {
  if (isZero(a) || isZero(b) || a[0] * b[1] - a[1] * b[0] !== 0) return null;
  const L = length(b);
  return [-b[1] / L, b[0] / L];
}
