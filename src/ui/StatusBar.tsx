import { formatVec } from '../model/vector';
import { useAppState } from '../state/store';

/** 指示・フィードバック欄（仕様 02 §1）。探究モードでは状態の説明だけを出す。 */
export function StatusBar() {
  const s = useAppState();
  const f = s.sim.finished;
  let msg: string;

  if (s.status === 'idle') {
    msg = 'v₁（物体の速度）と v₂（流れの速度）は、①②③のどこからでも変えられます。▶ で再生。';
  } else if (s.status === 'playing') {
    msg = '再生中… 青い点線は水に対する軌跡、赤い線は地面に対する軌跡です。';
  } else if (s.status === 'paused') {
    msg = '一時停止中。このまま速度を変えて再生すると、そこから新しい速度で進みます。';
  } else if (f) {
    const at = `t = ${f.t.toFixed(1)} s、位置 ${formatVec(f.pos)} m`;
    switch (f.reason) {
      case 'bank':
        msg = s.goal.kind === 'time' ? `岸に着いたので止まりました（${at}）。` : `向こう岸に着きました（${at}）。`;
        break;
      case 'time':
        msg = `${s.goal.kind === 'time' ? s.goal.t : f.t.toFixed(1)} 秒後の位置は ${formatVec(f.pos)} m です。`;
        break;
      case 'noCross':
        msg = '合成速度 v に向こう岸へ向かう成分がないため、出発できません。v₁ の向きを変えてみよう。';
        break;
      case 'limit':
        msg = `向こう岸へ向かう成分が 0 なので、${f.t.toFixed(0)} 秒で打ち切りました（${at}）。`;
        break;
    }
  } else {
    msg = '';
  }

  return (
    <p className="statusbar" role="status" aria-live="polite">
      {msg}
    </p>
  );
}
