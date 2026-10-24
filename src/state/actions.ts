import type { FlowDir, Goal } from '../model/kinematics';
import type { Vec } from '../model/vector';

export type PlayStatus = 'idle' | 'playing' | 'paused' | 'finished';

/** 表示の切り替え（「表示」メニュー）。項目は少なく保つ。 */
export interface DisplayOptions {
  /** ① 物体から出る v₁・v₂・v の矢印 */
  sceneArrows: boolean;
  /** ① 通った跡（水に対する軌跡・地面に対する軌跡・1秒ごとの点） */
  trails: boolean;
  /** ② 大きさの数値 */
  magnitudes: boolean;
  /** ② 成分の点線 */
  components: boolean;
  /** ② 平行四辺形 */
  parallelogram: boolean;
}

export type Action =
  | { type: 'setV1'; v: Vec }
  | { type: 'setV2'; v: Vec }
  | { type: 'setFlowDir'; dir: FlowDir }
  | { type: 'setFlowSpeed'; speed: number }
  | { type: 'setGoal'; goal: Goal }
  | { type: 'toggleDisplay'; key: keyof DisplayOptions }
  | { type: 'setPresentation'; on: boolean }
  | { type: 'play' }
  | { type: 'pause' }
  | { type: 'reset' }
  | { type: 'setSpeed'; speed: 1 | 2 }
  | { type: 'tick'; dt: number }
  | { type: 'loadPreset'; id: string; v1: Vec; v2: Vec; goal: Goal }
  /** 合成速度 v を出す。at は出し始めた時刻（performance.now() の値） */
  | { type: 'revealV'; at: number };
