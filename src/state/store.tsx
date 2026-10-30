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
import { add, equals, isZero, snap, type Vec, ZERO } from '../model/vector';
import type { Action, DisplayOptions, PlayStatus } from './actions';

/** 成分の上限 [m/s]（仕様 05 §2） */
export const V_MAX = 20;

export interface AppState {
  /** 物体の、媒質に対する速度（t = 0 の値） */
  v1: Vec;
  /** 物体の、媒質に対する加速度（仕様 12） */
  a1: Vec;
  /** 媒質の加速度。流れの軸の成分だけ（仕様 12） */
  a2: Vec;
  /** 加速度を使う状態か（③に加速度の行を出す） */
  accelOn: boolean;
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
  /** 合成速度 v を出しているか（仕様 06「合成速度 v を出すタイミング」） */
  vShown: boolean;
  /** v を出し始めた時刻（アニメーション用）。null ならアニメーションなしで出す */
  revealAt: number | null;
  /** 再生の途中で速度を変えたか（変えた回は渡った記録に残さない） */
  runChanged: boolean;
  /** 向こう岸まで渡った記録（新しい順、最大 CROSSING_MAX 件。仕様 07 §5） */
  crossings: Crossing[];
}

/** 渡った記録1件 */
export interface Crossing {
  v1: Vec;
  v2: Vec;
  a1: Vec;
  a2: Vec;
  /** 渡るのにかかった時間 [s] */
  t: number;
  /** 流れの方向に流された距離 [m]（流れの向きを正とする） */
  drift: number;
}

export const CROSSING_MAX = 5;

export const initialState: AppState = {
  v1: [0, 4],
  a1: ZERO,
  a2: ZERO,
  accelOn: false,
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
  vShown: false,
  revealAt: null,
  runChanged: false,
  crossings: [],
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
  if (s.status === 'finished') return { ...s, status: 'idle', sim: initialSim(), runChanged: false };
  // 再生の途中で変えた回は、渡った時間が速度の組み合わせと対応しないので記録しない
  return s.sim.t > 0 ? { ...s, runChanged: true } : s;
}

const resetSim = (s: AppState): AppState => ({ ...s, status: 'idle', sim: initialSim(), runChanged: false });

/** 向こう岸まで渡り終えた回を記録に足す */
function recordCrossing(s: AppState): AppState {
  const f = s.sim.finished;
  if (!f || f.reason !== 'bank' || s.goal.kind !== 'crossBank' || s.runChanged) return s;
  const v2 = v2Of(s);
  const along = acrossAxis(s.flowDir) === 1 ? 0 : 1;
  const sign = s.flowDir === 'left' || s.flowDir === 'down' ? -1 : 1;
  const rec: Crossing = { v1: s.v1, v2, a1: s.a1, a2: s.a2, t: f.t, drift: f.pos[along] * sign };
  return { ...s, crossings: [rec, ...s.crossings].slice(0, CROSSING_MAX) };
}

/** a₂ を流れの軸にそろえる（もう一方の成分は 0） */
const alongFlow = (v: Vec, dir: FlowDir): Vec => (acrossAxis(dir) === 1 ? [v[0], 0] : [0, v[1]]);

/** 流れを変える。川の向き（横・縦）が変わるときは最初からやり直し、a₂ は 0 に戻す。 */
function changeFlow(s: AppState, dir: FlowDir, speed: number): AppState {
  if (dir === s.flowDir && speed === s.flowSpeed) return s;
  const next = { ...s, flowDir: dir, flowSpeed: speed, presetId: null };
  return acrossAxis(dir) !== acrossAxis(s.flowDir) ? resetSim({ ...next, a2: ZERO }) : afterVelocityChange(next);
}

export function reducer(s: AppState, a: Action): AppState {
  switch (a.type) {
    case 'setV1': {
      const v1 = clampVec(a.v);
      // ドラッグ中は同じ値が何度も届くので、変わらないときは何もしない
      if (equals(v1, s.v1)) return s;
      return afterVelocityChange({ ...s, v1, presetId: null });
    }
    case 'setA1': {
      const a1 = clampVec(a.v);
      if (equals(a1, s.a1)) return s;
      return afterVelocityChange({ ...s, a1, presetId: null });
    }
    case 'setA2': {
      const a2 = alongFlow(clampVec(a.v), s.flowDir);
      if (equals(a2, s.a2)) return s;
      return afterVelocityChange({ ...s, a2, presetId: null });
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
      if (s.status === 'finished') return { ...s, status: 'playing', sim: initialSim(), runChanged: false };
      return { ...s, status: 'playing' };
    case 'pause':
      return s.status === 'playing' ? { ...s, status: 'paused' } : s;
    case 'reset':
      return resetSim(s);
    case 'setSpeed':
      return { ...s, speed: a.speed };
    case 'tick': {
      if (s.status !== 'playing') return s;
      const sim = stepSim(s.sim, s.v1, v2Of(s), a.dt * s.speed, s.goal, s.flowDir, s.a1, s.a2);
      const next: AppState = { ...s, sim, status: sim.finished ? 'finished' : 'playing' };
      return sim.finished ? recordCrossing(next) : next;
    }
    case 'loadPreset': {
      const v2 = axisAlign(clampVec(a.v2));
      const a2in = axisAlign(clampVec(a.a2 ?? ZERO));
      // 流れが止まっている例（v₂ = 0）では、流れの向きを a₂ の向きから決める
      const { dir } = flowFromVector(isZero(v2) && !isZero(a2in) ? a2in : v2, s.flowDir);
      const speed = Math.abs(v2[0]) + Math.abs(v2[1]);
      // 別の例を選んだら、v はまた隠す
      return resetSim({
        ...s,
        v1: clampVec(a.v1),
        a1: clampVec(a.a1 ?? ZERO),
        a2: alongFlow(a2in, dir),
        accelOn: a.accel ?? false,
        flowDir: dir,
        flowSpeed: speed,
        goal: a.goal,
        presetId: a.id,
        vShown: false,
        revealAt: null,
      });
    }
    case 'hideV':
      return s.vShown ? { ...s, vShown: false, revealAt: null } : s;
    case 'clearCrossings':
      return { ...s, crossings: [] };
    case 'revealV':
      return s.vShown ? s : { ...s, vShown: true, revealAt: a.at };
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
