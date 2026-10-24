import { flowFromVector } from '../model/kinematics';
import { ALL_PROBLEMS, toGoal } from '../model/problems';
import { formatVec } from '../model/vector';
import type { DisplayOptions } from '../state/actions';
import { useAppState, useDispatch } from '../state/store';

const STAGE_NAME: Record<number, string> = {
  1: '段階1 同一直線',
  2: '段階2 直交',
  3: '段階3 斜め',
  4: '段階4 逆問題（正答の状態）',
};

const DISPLAY_ITEMS: { key: keyof DisplayOptions; label: string; where: string }[] = [
  { key: 'sceneArrows', label: '物体の速度の矢印', where: '①' },
  { key: 'mediumTrail', label: '水に対する軌跡', where: '①' },
  { key: 'groundTrail', label: '地面に対する軌跡', where: '①' },
  { key: 'strobes', label: '1秒ごとの点', where: '①' },
  { key: 'magnitudes', label: '大きさ', where: '②' },
  { key: 'components', label: '成分の破線', where: '②' },
  { key: 'parallelogram', label: '平行四辺形', where: '②' },
];

export function Header() {
  const s = useAppState();
  const dispatch = useDispatch();

  return (
    <header className="app-header">
      <h1 className="app-title">合成速度ラボ</h1>

      <div className="seg" role="group" aria-label="モード">
        <button className="seg-btn" aria-pressed="true">
          探究
        </button>
        <button className="seg-btn" disabled title="フェーズ2で追加予定">
          練習（準備中）
        </button>
      </div>

      <label className="preset">
        <span className="sr-only">場面を呼び出す</span>
        <select
          value=""
          onChange={(e) => {
            const p = ALL_PROBLEMS.find((q) => q.id === e.target.value);
            if (p) dispatch({ type: 'loadPreset', v1: p.v1, v2: p.v2, goal: toGoal(p) });
          }}
        >
          <option value="">場面を呼び出す…</option>
          {[1, 2, 3, 4].map((st) => (
            <optgroup key={st} label={STAGE_NAME[st]}>
              {ALL_PROBLEMS.filter((p) => p.stage === st).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.id}：v₁ = {formatVec(p.v1)}、v₂ = {flowFromVector(p.v2, 'right').speed} m/s{' '}
                  {arrowOf(p.v2)}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </label>

      <details className="menu">
        <summary className="btn">表示</summary>
        <div className="menu-body">
          {DISPLAY_ITEMS.map((it) => (
            <label key={it.key} className="check">
              <input type="checkbox" checked={s.display[it.key]} onChange={() => dispatch({ type: 'toggleDisplay', key: it.key })} />
              <span className="where">{it.where}</span> {it.label}
            </label>
          ))}
        </div>
      </details>

      <button
        className="btn"
        aria-pressed={s.presentation}
        onClick={() => dispatch({ type: 'setPresentation', on: !s.presentation })}
        title="文字と線を大きくする（プロジェクタ投影用）"
      >
        提示モード
      </button>
    </header>
  );
}

function arrowOf(v: readonly [number, number]): string {
  if (v[0] > 0) return '→';
  if (v[0] < 0) return '←';
  if (v[1] > 0) return '↑';
  if (v[1] < 0) return '↓';
  return '';
}
