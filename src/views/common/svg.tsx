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
}

/** 矢印。矢じりは世界座標で描き、線の太さは画面上の px で一定にする。 */
export function Arrow({ from, to, color, width, head, dashed, opacity = 1, label, fontSize = 1 }: ArrowProps) {
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
  const lp: Vec = [to[0] + ux * fontSize * 1.5 - uy * fontSize * 0.4, to[1] + uy * fontSize * 1.5 + ux * fontSize * 0.4];
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
