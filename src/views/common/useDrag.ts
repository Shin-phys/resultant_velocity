import { useRef, type PointerEvent as ReactPointerEvent, type RefObject } from 'react';
import type { Vec } from '../../model/vector';
import { clientToWorld } from './svg';

interface DragCallbacks {
  onStart?: () => void;
  onMove: (p: Vec) => void;
  onEnd?: () => void;
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
      cbRef.current.onStart?.();
    },
    onPointerMove: move,
    onPointerUp: end,
    onPointerCancel: end,
  };
}
