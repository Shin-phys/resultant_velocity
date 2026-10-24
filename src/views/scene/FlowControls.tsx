import type { FlowDir, Goal } from '../../model/kinematics';
import { useAppState, useDispatch, V_MAX } from '../../state/store';

const DIRS: { dir: FlowDir; label: string; name: string }[] = [
  { dir: 'left', label: '←', name: '左向き' },
  { dir: 'up', label: '↑', name: '上向き' },
  { dir: 'down', label: '↓', name: '下向き' },
  { dir: 'right', label: '→', name: '右向き' },
];

/** 川幅 [m]。選択肢を減らすため固定にする */
const WIDTH = 12;
/** 時間で止めるときの時刻 [s] */
const STOP_T = 5;

const STOPS: { key: Goal['kind']; label: string; goal: Goal }[] = [
  { key: 'crossBank', label: '向こう岸で', goal: { kind: 'crossBank', width: WIDTH } },
  { key: 'time', label: `${STOP_T}秒で`, goal: { kind: 'time', t: STOP_T, width: WIDTH } },
];

/** ① の上部：流れ（v₂）と止めるタイミングの操作（仕様 06 §1）。 */
export function FlowControls() {
  const s = useAppState();
  const dispatch = useDispatch();

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

      <div className="ctl-group" role="group" aria-label="止めるタイミング">
        <span className="ctl-label">止める</span>
        <div className="seg">
          {STOPS.map((st) => (
            <button
              key={st.key}
              className="seg-btn"
              aria-pressed={s.goal.kind === st.key || (st.key === 'crossBank' && s.goal.kind === 'point')}
              onClick={() => dispatch({ type: 'setGoal', goal: st.goal })}
            >
              {st.label}
            </button>
          ))}
        </div>
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
