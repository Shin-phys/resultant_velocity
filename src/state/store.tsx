import { createContext, useContext, useReducer, type Dispatch, type ReactNode } from 'react';
import {
  acrossAxis,
  axisAlign,
  flowFromVector,
  flowVector,
  initialSim,
  stepSim,
  type FlowDir,
  type Goal,
  type SimState,
} from '../model/kinematics';
import { add, equals, snap, type Vec } from '../model/vector';
import type { Action, DisplayOptions, PlayStatus } from './actions';

/** 成分の上限 [m/s]（仕様 05 §2） */
export const V_MAX = 20;

export interface AppState {
  v1: Vec;
  flowDir: FlowDir;
  flowSpeed: number;
  goal: Goal;
  display: DisplayOptions;
  presentation: boolean;
  status: PlayStatus;
  speed: 1 | 2;
  sim: SimState;
  /** 選んだ例の id。速度などを手で変えたら null に戻す */
  presetId: string | null;
}

export const initialState: AppState = {
  v1: [0, 4],
  flowDir: 'right',
  flowSpeed: 3,
  goal: { kind: 'crossBank', width: 12 },
  display: {
    sceneArrows: true,
    trails: true,
    magnitudes: true,
    components: false,
    parallelogram: false,
  },
  presentation: false,
  status: 'idle',
  speed: 1,
  sim: initialSim(),
  presetId: 'straight',
};

const clampInt = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, Math.round(n) || 0));
const clampVec = (v: Vec): Vec => {
  const s = snap(v);
  return [clampInt(s[0], -V_MAX, V_MAX), clampInt(s[1], -V_MAX, V_MAX)];
};

export const v2Of = (s: Pick<AppState, 'flowDir' | 'flowSpeed'>): Vec => {
  const v = flowVector(s.flowDir, s.flowSpeed);
  return [v[0] || 0, v[1] || 0];
};
export const vOf = (s: AppState): Vec => add(s.v1, v2Of(s));

/** 速度を変えたとき：再生が終わっていたら最初に戻す（再生中・一時停止中はそのまま続ける）。 */
function afterVelocityChange(s: AppState): AppState {
  return s.status === 'finished' ? { ...s, status: 'idle', sim: initialSim() } : s;
}

const resetSim = (s: AppState): AppState => ({ ...s, status: 'idle', sim: initialSim() });

/** 流れを変える。川の向き（横・縦）が変わるときは最初からやり直す。 */
function changeFlow(s: AppState, dir: FlowDir, speed: number): AppState {
  if (dir === s.flowDir && speed === s.flowSpeed) return s;
  const next = { ...s, flowDir: dir, flowSpeed: speed, presetId: null };
  return acrossAxis(dir) !== acrossAxis(s.flowDir) ? resetSim(next) : afterVelocityChange(next);
}

export function reducer(s: AppState, a: Action): AppState {
  switch (a.type) {
    case 'setV1': {
      const v1 = clampVec(a.v);
      // ドラッグ中は同じ値が何度も届くので、変わらないときは何もしない
      if (equals(v1, s.v1)) return s;
      return afterVelocityChange({ ...s, v1, presetId: null });
    }
    case 'setV2': {
      const v = axisAlign(clampVec(a.v));
      const { dir, speed } = flowFromVector(v, s.flowDir);
      return changeFlow(s, dir, speed);
    }
    case 'setFlowDir':
      return changeFlow(s, a.dir, s.flowSpeed);
    case 'setFlowSpeed':
      return changeFlow(s, s.flowDir, clampInt(a.speed, 0, V_MAX));
    case 'setGoal':
      if (a.goal.kind === s.goal.kind && a.goal.width === s.goal.width) return s;
      return resetSim({ ...s, goal: a.goal, presetId: null });
    case 'toggleDisplay':
      return { ...s, display: { ...s.display, [a.key]: !s.display[a.key] } };
    case 'setPresentation':
      return { ...s, presentation: a.on };
    case 'play':
      if (s.status === 'finished') return { ...s, status: 'playing', sim: initialSim() };
      return { ...s, status: 'playing' };
    case 'pause':
      return s.status === 'playing' ? { ...s, status: 'paused' } : s;
    case 'reset':
      return resetSim(s);
    case 'setSpeed':
      return { ...s, speed: a.speed };
    case 'tick': {
      if (s.status !== 'playing') return s;
      const sim = stepSim(s.sim, s.v1, v2Of(s), a.dt * s.speed, s.goal, s.flowDir);
      return { ...s, sim, status: sim.finished ? 'finished' : 'playing' };
    }
    case 'loadPreset': {
      const v2 = axisAlign(clampVec(a.v2));
      const { dir, speed } = flowFromVector(v2, s.flowDir);
      return resetSim({ ...s, v1: clampVec(a.v1), flowDir: dir, flowSpeed: speed, goal: a.goal, presetId: a.id });
    }
  }
}

const StateCtx = createContext<AppState>(initialState);
const DispatchCtx = createContext<Dispatch<Action>>(() => {});

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  return (
    <DispatchCtx.Provider value={dispatch}>
      <StateCtx.Provider value={state}>{children}</StateCtx.Provider>
    </DispatchCtx.Provider>
  );
}

export const useAppState = () => useContext(StateCtx);
export const useDispatch = () => useContext(DispatchCtx);
