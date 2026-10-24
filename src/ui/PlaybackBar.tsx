import { useAppState, useDispatch } from '../state/store';

/** 操作バー（仕様 02 §1、07 §1）。コマ送り・比較表示はフェーズ2で追加する。 */
export function PlaybackBar() {
  const s = useAppState();
  const dispatch = useDispatch();
  const playing = s.status === 'playing';

  return (
    <div className="playbar" role="toolbar" aria-label="再生の操作">
      <button
        className="btn primary play"
        onClick={() => dispatch({ type: playing ? 'pause' : 'play' })}
        aria-label={playing ? '一時停止' : '再生'}
      >
        {playing ? '⏸ 一時停止' : s.status === 'finished' ? '▶ もう一度' : '▶ 再生'}
      </button>
      <button className="btn" onClick={() => dispatch({ type: 'reset' })} disabled={s.sim.t === 0} aria-label="最初に戻す">
        ⏮ 最初へ
      </button>
      <div className="seg" role="group" aria-label="再生の速さ">
        {([1, 2] as const).map((n) => (
          <button key={n} className="seg-btn" aria-pressed={s.speed === n} onClick={() => dispatch({ type: 'setSpeed', speed: n })}>
            ×{n}
          </button>
        ))}
      </div>
      <span className="time" aria-live="off">
        t = {s.sim.t.toFixed(1)} s
      </span>
    </div>
  );
}
