import type { FlowDir, Goal } from '../model/kinematics';
import type { Vec } from '../model/vector';

export type PlayStatus = 'idle' | 'playing' | 'paused' | 'finished';

export interface DisplayOptions {
  /** ① 物体上の v₁・v₂・v の矢印 */
  sceneArrows: boolean;
  /** ① 媒質に対する軌跡 */
  mediumTrail: boolean;
  /** ① 地面に対する軌跡 */
  groundTrail: boolean;
  /** ① 1秒ごとの点 */
  strobes: boolean;
  /** ② 大きさの表示 */
  magnitudes: boolean;
  /** ② 成分の破線 */
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
  | { type: 'loadPreset'; v1: Vec; v2: Vec; goal: Goal };
