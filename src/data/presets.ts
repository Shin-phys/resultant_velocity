import type { Goal } from '../model/kinematics';
import type { Vec } from '../model/vector';

/**
 * 探究モードの「例」（仕様 06 §1）。教師が提示でよく使う6つだけに絞り、
 * 名前は起きることをそのまま言う。練習モードの問題（data/problems）とは別に持つ。
 */
export interface Preset {
  id: string;
  group: string;
  name: string;
  v1: Vec;
  v2: Vec;
  goal: Goal;
}

const FIVE_SEC: Goal = { kind: 'time', t: 5, width: 12 };
const ACROSS: Goal = { kind: 'crossBank', width: 12 };

export const PRESET_GROUPS = ['流れに沿って進む', '川を渡る'] as const;

export const PRESETS: Preset[] = [
  { id: 'with', group: '流れに沿って進む', name: '流れと同じ向きに進む', v1: [3, 0], v2: [2, 0], goal: FIVE_SEC },
  { id: 'against', group: '流れに沿って進む', name: '流れに逆らって進む', v1: [3, 0], v2: [-2, 0], goal: FIVE_SEC },
  { id: 'pushed', group: '流れに沿って進む', name: '流れに負けて押し戻される', v1: [2, 0], v2: [-3, 0], goal: FIVE_SEC },
  { id: 'straight', group: '川を渡る', name: '船首を対岸に向けて渡る', v1: [0, 4], v2: [3, 0], goal: ACROSS },
  { id: 'tilt', group: '川を渡る', name: '船首を上流側に傾けて渡る', v1: [-1, 3], v2: [4, 0], goal: ACROSS },
  { id: 'opposite', group: '川を渡る', name: '真向かいに着くように渡る', v1: [-3, 4], v2: [3, 0], goal: ACROSS },
];
