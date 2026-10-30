import { formatVec } from '../model/vector';
import { useAppState } from '../state/store';

/** 指示・フィードバック欄（仕様 02 §1）。探究モードでは状態の説明だけを出す。 */
export function StatusBar() {
  const s = useAppState();
  const f = s.sim.finished;
  let msg: string;

  if (s.status === 'idle' && !s.vShown) {
    msg = 'どこに着くか予想してから ▶ で再生。合成速度 v は再生のあとに出ます。';
  } else if (s.status === 'idle') {
    msg = '矢印の先の丸をドラッグするか、③に数を入れると、v₁（物体の速度）と v₂（流れの速度）が変わります。▶ で再生。';
  } else if (s.status === 'playing') {
    msg = '再生中… 青い点線は水に対して通った跡、赤い線は地面に対して通った跡です。';
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
      case 'edge':
        msg =
          s.goal.kind === 'time'
            ? `${s.goal.t}秒たつ前に画面の端まで来たので止めました（${at}）。`
            : `向こう岸に着く前に画面の端まで来たので止めました（${at}）。`;
        break;
      case 'returned':
        msg = `向こう岸に着く前に、元の岸に戻ってきたので止めました（${at}）。`;
        break;
      case 'noCross':
        msg = '合成速度 v に向こう岸へ向かう成分がないため、出発できません。v₁ の向きを変えてみよう。';
        break;
      case 'limit':
        msg = `合成速度 v が 0 なので、地面に対しては動きません（${f.t.toFixed(0)} 秒で打ち切り）。`;
        break;
    }
  } else {
    msg = '';
  }

  // v を出した直後は、赤い跡と v の向きを見比べるよう促す
  if (f && f.reason !== 'noCross' && f.reason !== 'limit' && f.reason !== 'returned') msg += ' 赤い矢印 v（合成速度）と赤い跡の向きを見比べよう。';

  return (
    <p className="statusbar" role="status" aria-live="polite">
      {msg}
    </p>
  );
}
