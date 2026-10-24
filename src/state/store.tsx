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
import { add, snap, type Vec } from '../model/vector';
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
}

export const initialState: AppState = {
  v1: [0, 4],
  flowDir: 'right',
  flowSpeed: 3,
  goal: { kind: 'crossBank', width: 12 },
  display: {
    sceneArrows: true,
    mediumTrail: true,
    groundTrail: true,
    strobes: true,
    magnitudes: true,
    components: false,
    parallelogram: false,
  },
  presentation: false,
  status: 'idle',
  speed: 1,
  sim: initialSim(),
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

export function reducer(s: AppState, a: Action): AppState {
  switch (a.type) {
    case 'setV1':
      return afterVelocityChange({ ...s, v1: clampVec(a.v) });
    case 'setV2': {
      const v = axisAlign(clampVec(a.v));
      const { dir, speed } = flowFromVector(v, s.flowDir);
      const next = { ...s, flowDir: dir, flowSpeed: speed };
      return acrossAxis(dir) !== acrossAxis(s.flowDir) ? resetSim(next) : afterVelocityChange(next);
    }
    case 'setFlowDir': {
      const next = { ...s, flowDir: a.dir };
      return acrossAxis(a.dir) !== acrossAxis(s.flowDir) ? resetSim(next) : afterVelocityChange(next);
    }
    case 'setFlowSpeed':
      return afterVelocityChange({ ...s, flowSpeed: clampInt(a.speed, 0, V_MAX) });
    case 'setGoal':
      return resetSim({ ...s, goal: a.goal });
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
      return resetSim({ ...s, v1: clampVec(a.v1), flowDir: dir, flowSpeed: speed, goal: a.goal });
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
