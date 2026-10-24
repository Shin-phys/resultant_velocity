import { useRef, type PointerEvent as ReactPointerEvent, type RefObject } from 'react';
import type { Vec } from '../../model/vector';
import { clientToWorld } from './svg';

interface DragCallbacks {
  /** p：押した位置（物理の座標） */
  onStart?: (p: Vec) => void;
  onMove: (p: Vec) => void;
  onEnd?: () => void;
}

/**
 * ベクトルの先端をつかんで動かすドラッグ。押した位置と先端のずれを保つので、
 * ハンドルの端をつかんでも先端が指の位置に飛ばない。
 * tip()：今の先端の位置、onTip(p)：新しい先端の位置（スナップ前）
 */
export function useTipDrag(
  svgRef: RefObject<SVGSVGElement | null>,
  tip: () => Vec,
  onTip: (p: Vec) => void,
  extra: { onStart?: () => void; onEnd?: () => void } = {},
) {
  const grab = useRef<Vec>([0, 0]);
  return useDrag(svgRef, {
    onStart: (p) => {
      const t = tip();
      grab.current = [p[0] - t[0], p[1] - t[1]];
      extra.onStart?.();
    },
    onMove: (p) => onTip([p[0] - grab.current[0], p[1] - grab.current[1]]),
    onEnd: extra.onEnd,
  });
}

/**
 * SVG 上のハンドルをドラッグするためのポインタ処理。タッチ・マウス共通。
 * 返り値をハンドル要素に展開して使う。
 */
export function useDrag(svgRef: RefObject<SVGSVGElement | null>, cb: DragCallbacks) {
  const active = useRef(false);
  const cbRef = useRef(cb);
  cbRef.current = cb;

  const move = (e: ReactPointerEvent) => {
    if (!active.current || !svgRef.current) return;
    cbRef.current.onMove(clientToWorld(svgRef.current, e.clientX, e.clientY));
  };
  const end = (e: ReactPointerEvent) => {
    if (!active.current) return;
    active.current = false;
    (e.currentTarget as Element).releasePointerCapture?.(e.pointerId);
    cbRef.current.onEnd?.();
  };
  return {
    onPointerDown: (e: ReactPointerEvent) => {
      e.preventDefault();
      e.stopPropagation();
      active.current = true;
      (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
      if (svgRef.current) cbRef.current.onStart?.(clientToWorld(svgRef.current, e.clientX, e.clientY));
    },
    onPointerMove: move,
    onPointerUp: end,
    onPointerCancel: end,
  };
}
