import { useEffect, useRef, useState } from 'react';
import { add, formatComponent, formatLength, type Vec } from '../../model/vector';
import { acrossAxis } from '../../model/kinematics';
import { useAppState, useDispatch, v2Of, V_MAX } from '../../state/store';

/** 全角数字・各種マイナス記号を受け付けて整数にする。整数でなければ null。 */
export function parseIntInput(text: string): number | null {
  const t = text
    .trim()
    .replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .replace(/[−ー－‐]/g, '-')
    .replace(/^＋|^\+/, '');
  if (!/^-?\d+$/.test(t)) return null;
  const n = Number(t);
  return Math.abs(n) <= V_MAX ? n || 0 : null;
}

/** ③ 成分表ビュー（仕様 05）。探究モードでは v の行は自動計算。 */
export function TableView() {
  const s = useAppState();
  const dispatch = useDispatch();
  const v1 = s.v1;
  const v2 = v2Of(s);
  const v = add(v1, v2);
  const [notice, setNotice] = useState<string | null>(null);
  const timer = useRef<number | undefined>(undefined);

  const flash = (msg: string) => {
    setNotice(msg);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setNotice(null), 3500);
  };
  useEffect(() => () => window.clearTimeout(timer.current), []);

  const setV1 = (i: 0 | 1, n: number) => {
    const next: [number, number] = [v1[0], v1[1]];
    next[i] = n;
    dispatch({ type: 'setV1', v: next });
  };
  const setV2 = (i: 0 | 1, n: number) => {
    const next: [number, number] = [0, 0];
    next[i] = n;
    const other = 1 - i;
    if (n !== 0 && v2[other] !== 0) {
      flash(`流れは上下左右のどれか一方向なので、${other === 0 ? 'vx' : 'vy'} を 0 にしました`);
    } else if (n === 0) {
      next[other] = v2[other];
    }
    dispatch({ type: 'setV2', v: next });
  };

  const setA1 = (i: 0 | 1, n: number) => {
    const next: [number, number] = [s.a1[0], s.a1[1]];
    next[i] = n;
    dispatch({ type: 'setA1', v: next });
  };
  const setA2 = (i: 0 | 1, n: number) => {
    const next: [number, number] = [0, 0];
    next[i] = n;
    dispatch({ type: 'setA2', v: next });
  };

  return (
    <section className="pane table-pane" aria-label="③ 成分表">
      <header className="pane-head">
        <h2>③ 成分表</h2>
        <span className="hint">→ と ↑ が正{s.accelOn ? '。速度は t = 0 のときの値' : ''}</span>
      </header>
      <div className="table-box">
        <table className="comp-table">
          <thead>
            <tr>
              <th scope="col" />
              <th scope="col" />
              <th scope="col">
                vx <small>[m/s]</small>
              </th>
              <th scope="col">
                vy <small>[m/s]</small>
              </th>
              <th scope="col">
                大きさ <small>[m/s]</small>
              </th>
            </tr>
          </thead>
          <tbody>
            <Row sign="" sym="v₁" name="物体（水に対して）" cls="c-v1" vec={v1} onSet={setV1} />
            <Row sign="＋" sym="v₂" name="流れ" cls="c-v2" vec={v2} onSet={setV2} />
            <tr className="sum-rule" aria-hidden="true">
              <td colSpan={5} />
            </tr>
            <Row sign="" sym="v" name="合成（地面に対して）" cls="c-v" vec={v} readOnly strong hidden={!s.vShown} />
          </tbody>
          {s.accelOn && (
            <tbody className="accel-rows">
              <tr className="sub-head">
                <th scope="col" />
                <th scope="col" />
                <th scope="col">
                  ax <small>[m/s²]</small>
                </th>
                <th scope="col">
                  ay <small>[m/s²]</small>
                </th>
                <th scope="col">
                  大きさ <small>[m/s²]</small>
                </th>
              </tr>
              <Row sign="" sym="a₁" name="物体（水に対して）" cls="c-v1" vec={s.a1} onSet={setA1} />
              <Row sign="＋" sym="a₂" name="流れ" cls="c-v2" vec={s.a2} onSet={setA2} lock={acrossAxis(s.flowDir)} />
              <tr className="sum-rule" aria-hidden="true">
                <td colSpan={5} />
              </tr>
              <Row sign="" sym="a" name="合成（地面に対して）" cls="c-v" vec={add(s.a1, s.a2)} readOnly strong hidden={!s.vShown} />
            </tbody>
          )}
        </table>
        <p className="table-notice" role="status" aria-live="polite">
          {notice ?? ' '}
        </p>
      </div>
    </section>
  );
}

function Row(props: {
  sign: string;
  sym: string;
  name: string;
  cls: string;
  vec: Vec;
  readOnly?: boolean;
  strong?: boolean;
  /** 値を伏せて「？」を出す（合成速度 v を出す前） */
  hidden?: boolean;
  /** この成分だけ入力できないようにする（a₂ の、流れと垂直な成分） */
  lock?: 0 | 1;
  onSet?: (i: 0 | 1, n: number) => void;
}) {
  const { sign, sym, name, cls, vec, readOnly, strong, hidden, lock, onSet } = props;
  return (
    <tr className={strong ? 'row-sum' : undefined}>
      <td className="sign">{sign}</td>
      <th scope="row" className={cls}>
        <span className="sym">{sym}</span>
        <span className="row-name">{name}</span>
      </th>
      {([0, 1] as const).map((i) => (
        <td key={i}>
          {readOnly || i === lock ? (
            <span className={`cell-ro ${cls}`}>{hidden ? '？' : formatComponent(vec[i])}</span>
          ) : (
            <Cell value={vec[i]} label={`${sym} の ${i === 0 ? 'x' : 'y'} 成分`} onCommit={(n) => onSet?.(i, n)} />
          )}
        </td>
      ))}
      <td className="mag">{hidden ? '？' : formatLength(vec)}</td>
    </tr>
  );
}

function Cell({ value, label, onCommit }: { value: number; label: string; onCommit: (n: number) => void }) {
  const [text, setText] = useState(String(value));
  // 他の窓で値が変わったら表示を合わせる（入力中でも、打った数と違う値になったら上書きする）
  useEffect(() => {
    setText((t) => (parseIntInput(t) === value ? t : String(value)));
  }, [value]);
  const invalid = parseIntInput(text) === null;
  return (
    <span className="cell">
      <button
        className="btn sign-btn"
        aria-label={`${label}の符号を反転`}
        onClick={() => {
          const n = -value || 0;
          setText(String(n));
          onCommit(n);
        }}
      >
        ±
      </button>
      <input
        className={invalid ? 'invalid' : undefined}
        inputMode="numeric"
        aria-label={label}
        value={text}
        onFocus={(e) => e.currentTarget.select()}
        onBlur={() => setText(String(value))}
        onChange={(e) => {
          setText(e.target.value);
          const n = parseIntInput(e.target.value);
          if (n !== null) onCommit(n);
        }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
            e.preventDefault();
            const n = Math.max(-V_MAX, Math.min(V_MAX, value + (e.key === 'ArrowUp' ? 1 : -1)));
            setText(String(n));
            onCommit(n);
          }
          if (e.key === 'Enter') e.currentTarget.blur();
        }}
      />
    </span>
  );
}
