import { useEffect, useRef, useState, type RefObject } from 'react';
import type { Vec } from '../../model/vector';

/**
 * SVG は y 軸が下向きなので、物理の座標（y 上向き）を描くときは y を反転する。
 * viewBox も y を反転した値で与える。
 */
export const fy = (p: Vec): [number, number] => [p[0], -p[1]];

/** 画面上のポインタ位置を、物理の座標（y 上向き）に変換する。 */
export function clientToWorld(svg: SVGSVGElement, clientX: number, clientY: number): Vec {
  const ctm = svg.getScreenCTM();
  if (!ctm) return [0, 0];
  const pt = new DOMPoint(clientX, clientY).matrixTransform(ctm.inverse());
  return [pt.x, -pt.y];
}

/** 要素の大きさ（px）を監視する。 */
export function useElementSize<T extends HTMLElement>(): [RefObject<T | null>, { w: number; h: number }] {
  const ref = useRef<T>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const r = entries[0].contentRect;
      setSize({ w: r.width, h: r.height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, size];
}

interface ArrowProps {
  from: Vec;
  to: Vec;
  /** CSS の色（var(--c-v1) など） */
  color: string;
  /** 線の太さ [px] */
  width: number;
  /** 矢じりの長さ（世界座標の単位） */
  head: number;
  dashed?: boolean;
  opacity?: number;
  label?: string;
  /** ラベルの文字の大きさ（世界座標の単位） */
  fontSize?: number;
  /**
   * ラベルを横へずらす量（世界座標）。省略時は矢印の左側へ少しずらす。
   * 矢印が重なる配置のとき、ラベルどうしが重ならないように呼び出し側で指定する。
   */
  labelShift?: Vec;
  /** ラベルの位置（世界座標）を直接決める。指定すると labelShift より優先する */
  labelAt?: Vec;
}

/** 矢印。矢じりは世界座標で描き、線の太さは画面上の px で一定にする。 */
export function Arrow({ from, to, color, width, head, dashed, opacity = 1, label, fontSize = 1, labelShift, labelAt }: ArrowProps) {
  const dx = to[0] - from[0];
  const dy = to[1] - from[1];
  const len = Math.hypot(dx, dy);
  if (len < 1e-9) return null;
  const ux = dx / len;
  const uy = dy / len;
  const h = Math.min(head, len * 0.6);
  const hw = h * 0.45;
  const base: Vec = [to[0] - ux * h, to[1] - uy * h];
  const left: Vec = [base[0] - uy * hw, base[1] + ux * hw];
  const right: Vec = [base[0] + uy * hw, base[1] - ux * hw];
  const [x1, y1] = fy(from);
  const [x2, y2] = fy(base);
  const pts = [to, left, right].map((p) => fy(p).join(',')).join(' ');
  // ラベルは先端の少し先、左側にずらして置く
  // （先端にはドラッグ用のハンドルが重なることがあるので、それより外に出す）
  const shift: Vec = labelShift ?? [-uy * fontSize * 0.4, ux * fontSize * 0.4];
  const lp: Vec = labelAt ?? [to[0] + ux * fontSize * 1.4 + shift[0], to[1] + uy * fontSize * 1.4 + shift[1]];
  const [lx, ly] = fy(lp);
  return (
    <g opacity={opacity}>
      <line
        x1={x1}
        y1={y1}
        x2={x2}
        y2={y2}
        stroke={color}
        strokeWidth={width}
        strokeDasharray={dashed ? `${width * 3} ${width * 2}` : undefined}
        vectorEffect="non-scaling-stroke"
        strokeLinecap="round"
      />
      <polygon points={pts} fill={color} />
      {label && (
        <text
          x={lx}
          y={ly}
          fill={color}
          fontSize={fontSize}
          fontWeight={700}
          textAnchor="middle"
          dominantBaseline="middle"
          className="svg-label"
        >
          {label}
        </text>
      )}
    </g>
  );
}

/**
 * 三角形の辺 from→to のラベル位置：辺の中点から、三角形の外側へ dist だけ離した点。
 * center は三角形の重心。
 */
export function outsideMidpoint(from: Vec, to: Vec, center: Vec, dist: number): Vec {
  const dx = to[0] - from[0];
  const dy = to[1] - from[1];
  const len = Math.hypot(dx, dy) || 1;
  const n: Vec = [-dy / len, dx / len];
  const m: Vec = [(from[0] + to[0]) / 2, (from[1] + to[1]) / 2];
  const side = (m[0] - center[0]) * n[0] + (m[1] - center[1]) * n[1] >= 0 ? 1 : -1;
  return [m[0] + n[0] * side * dist, m[1] + n[1] * side * dist];
}
