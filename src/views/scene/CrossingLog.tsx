import { formatVec, isZero, type Vec } from '../../model/vector';
import { useAppState, useDispatch } from '../../state/store';

const arrowOf = (v: Vec): string => (v[0] > 0 ? '→' : v[0] < 0 ? '←' : v[1] > 0 ? '↑' : v[1] < 0 ? '↓' : '');
const speedOf = (v: Vec): number => Math.abs(v[0]) + Math.abs(v[1]); // 流れは軸方向なので和で足りる

/** 流された距離の言い方。流れの向きを正とする */
function driftText(d: number): string {
  const a = Math.round(Math.abs(d) * 10) / 10;
  if (a === 0) return '0 m（真向かい）';
  return `${Number.isInteger(a) ? a : a.toFixed(1)} m ${d > 0 ? '下流へ' : '上流へ'}`;
}

/**
 * 向こう岸まで渡った記録（仕様 07 §5）。
 * 船の速度を変えずに流れだけ変えると、渡る時間は同じで流される距離だけが変わることを並べて見せる。
 */
export function CrossingLog() {
  const s = useAppState();
  const dispatch = useDispatch();
  if (s.crossings.length === 0) return null;
  // 加速度を使った回が1件でもあれば、加速度の列を足す（仕様 12 §6）
  const showAcc = s.crossings.some((c) => !isZero(c.a1) || !isZero(c.a2));
  return (
    <div className="crossing-log">
      <div className="crossing-head">
        <span className="ctl-label">渡った記録</span>
        <span className="hint">渡る時間は何で決まる？</span>
        <button className="btn small quiet" onClick={() => dispatch({ type: 'clearCrossings' })}>
          記録を消す
        </button>
      </div>
      <div className="crossing-scroll">
        <table className="crossing-table">
          <thead>
            <tr>
              <th scope="col" className="c-v1">船 v₁ [m/s]</th>
              {showAcc && <th scope="col" className="c-v1">船 a₁ [m/s²]</th>}
              <th scope="col" className="c-v2">流れ v₂</th>
              {showAcc && <th scope="col" className="c-v2">流れ a₂</th>}
              <th scope="col">渡る時間</th>
              <th scope="col">流された距離</th>
            </tr>
          </thead>
          <tbody>
            {s.crossings.map((c, i) => (
              <tr key={s.crossings.length - i}>
                <td>{formatVec(c.v1)}</td>
                {showAcc && <td>{formatVec(c.a1)}</td>}
                <td>
                  {speedOf(c.v2)} m/s {arrowOf(c.v2)}
                </td>
                {showAcc && (
                  <td>
                    {speedOf(c.a2)} m/s² {arrowOf(c.a2)}
                  </td>
                )}
                <td className="crossing-t">{c.t.toFixed(1)} s</td>
                <td>{driftText(c.drift)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
