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
 * 矢印が重なる配置かどうかを調べ、重なるならずらす向き（単位ベクトル）を返す。
 * v₁ と v₂ が同一直線上のとき（どちらかが 0 のときも含む）は、v が v₁ や v₂ と重なって見えなくなる。
 * ずらす向きは、0 でない方（v₁ を優先）に垂直な向き。両方 0 なら null。
 */
export function overlapNormal(v1: Vec, v2: Vec): Vec | null {
  if (v1[0] * v2[1] - v1[1] * v2[0] !== 0) return null;
  const base = !isZero(v1) ? v1 : !isZero(v2) ? v2 : null;
  if (!base) return null;
  const L = length(base);
  return [-base[1] / L, base[0] / L];
}

/** 2つのベクトルが平行（同じ向き・逆向きを含む）か。0 ベクトルは平行とみなさない。 */
export const isParallel = (a: Vec, b: Vec): boolean =>
  !isZero(a) && !isZero(b) && a[0] * b[1] - a[1] * b[0] === 0;
