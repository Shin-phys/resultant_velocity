import type { FlowDir, Goal } from '../../model/kinematics';
import { useAppState, useDispatch, V_MAX } from '../../state/store';

const DIRS: { dir: FlowDir; label: string; name: string }[] = [
  { dir: 'left', label: '←', name: '左向き' },
  { dir: 'up', label: '↑', name: '上向き' },
  { dir: 'down', label: '↓', name: '下向き' },
  { dir: 'right', label: '→', name: '右向き' },
];

const WIDTHS = [8, 12, 16, 20, 24];

/** ① の上部：流れ（v₂）と終了条件の操作（仕様 06 §1）。 */
export function FlowControls() {
  const s = useAppState();
  const dispatch = useDispatch();
  const g = s.goal;

  const setGoal = (goal: Goal) => dispatch({ type: 'setGoal', goal });

  return (
    <div className="controls">
      <div className="ctl-group" role="group" aria-label="流れ v₂">
        <span className="ctl-label c-v2">流れ v₂</span>
        {DIRS.map((d) => (
          <button
            key={d.dir}
            className="btn icon"
            aria-pressed={s.flowDir === d.dir}
            aria-label={`流れを${d.name}にする`}
            onClick={() => dispatch({ type: 'setFlowDir', dir: d.dir })}
          >
            {d.label}
          </button>
        ))}
        <Stepper
          value={s.flowSpeed}
          unit="m/s"
          min={0}
          max={V_MAX}
          label="流れの速さ"
          onChange={(n) => dispatch({ type: 'setFlowSpeed', speed: n })}
        />
      </div>

      <div className="ctl-group" role="group" aria-label="終了条件">
        <span className="ctl-label">終了</span>
        <select
          value={g.kind === 'time' ? 'time' : 'crossBank'}
          aria-label="終了条件"
          onChange={(e) =>
            setGoal(
              e.target.value === 'time'
                ? { kind: 'time', t: 5, width: g.width }
                : { kind: 'crossBank', width: g.width },
            )
          }
        >
          <option value="crossBank">向こう岸に着くまで</option>
          <option value="time">時間で止める</option>
        </select>
        {g.kind === 'time' && (
          <Stepper value={g.t} unit="s" min={1} max={20} label="止める時刻" onChange={(t) => setGoal({ ...g, t })} />
        )}
        <span className="ctl-label">川幅</span>
        <select
          value={g.width}
          aria-label="川幅"
          onChange={(e) => setGoal({ ...g, width: Number(e.target.value) } as Goal)}
        >
          {WIDTHS.map((w) => (
            <option key={w} value={w}>
              {w} m
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

export function Stepper(props: {
  value: number;
  unit: string;
  min: number;
  max: number;
  label: string;
  onChange: (n: number) => void;
}) {
  const { value, unit, min, max, label, onChange } = props;
  return (
    <span className="stepper" role="group" aria-label={label}>
      <button className="btn icon" aria-label={`${label}を減らす`} disabled={value <= min} onClick={() => onChange(value - 1)}>
        −
      </button>
      <span className="stepper-value" aria-live="polite">
        {value} {unit}
      </span>
      <button className="btn icon" aria-label={`${label}を増やす`} disabled={value >= max} onClick={() => onChange(value + 1)}>
        +
      </button>
    </span>
  );
}
