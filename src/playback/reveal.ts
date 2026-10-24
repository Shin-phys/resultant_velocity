import { useEffect, useState } from 'react';

/** v₂ が v₁ の先端まで滑る時間 [s] */
export const SLIDE_S = 0.8;
/** v が原点から伸びる時間 [s] */
export const DRAW_S = 0.6;

export interface RevealPhase {
  /** v₂ の滑り（0 → 1）。v を隠している間は 0 */
  slide: number;
  /** v の伸び（0 → 1）。v を隠している間は 0 */
  draw: number;
}

const DONE: RevealPhase = { slide: 1, draw: 1 };
const HIDDEN: RevealPhase = { slide: 0, draw: 0 };
const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
const ease = (x: number) => 1 - (1 - x) * (1 - x) * (1 - x);

function phaseAt(elapsed: number): RevealPhase {
  return { slide: ease(clamp01(elapsed / SLIDE_S)), draw: ease(clamp01((elapsed - SLIDE_S) / DRAW_S)) };
}

const reducedMotion = () => {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
};

/**
 * 合成速度 v を出すときの動きの進み具合（仕様 06「合成速度 v を出すタイミング」）。
 * ① と ② が同じ時刻 revealAt を基準にするので、2つの窓の動きはそろう。
 */
export function useRevealPhase(vShown: boolean, revealAt: number | null): RevealPhase {
  const [phase, setPhase] = useState<RevealPhase>(() =>
    !vShown ? HIDDEN : revealAt === null || reducedMotion() ? DONE : phaseAt((performance.now() - revealAt) / 1000),
  );
  useEffect(() => {
    if (!vShown) {
      setPhase(HIDDEN);
      return;
    }
    if (revealAt === null || reducedMotion()) {
      setPhase(DONE);
      return;
    }
    let raf = 0;
    const loop = () => {
      const p = phaseAt((performance.now() - revealAt) / 1000);
      setPhase(p);
      if (p.draw < 1) raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [vShown, revealAt]);
  return phase;
}
