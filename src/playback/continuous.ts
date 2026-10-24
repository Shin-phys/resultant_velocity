import { useEffect, type Dispatch } from 'react';
import type { Action, PlayStatus } from '../state/actions';

/** 1フレームで進める時間の上限 [s]（タブ復帰時などに一気に飛ばないように） */
const MAX_DT = 0.05;

/**
 * 連続再生のループ。経過時間は requestAnimationFrame のタイムスタンプ差から計算し、
 * 端末の性能で速さが変わらないようにする（仕様 10 §3）。
 */
export function useContinuousPlayback(status: PlayStatus, dispatch: Dispatch<Action>) {
  useEffect(() => {
    if (status !== 'playing') return;
    let raf = 0;
    let last: number | null = null;
    const loop = (now: number) => {
      if (last !== null) {
        const dt = Math.min(MAX_DT, (now - last) / 1000);
        if (dt > 0) dispatch({ type: 'tick', dt });
      }
      last = now;
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [status, dispatch]);
}
