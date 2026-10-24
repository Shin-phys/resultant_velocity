import { useEffect, useRef } from 'react';
import { PRESET_GROUPS, PRESETS } from '../data/presets';
import type { DisplayOptions } from '../state/actions';
import { useAppState, useDispatch } from '../state/store';

const DISPLAY_ITEMS: { key: keyof DisplayOptions; label: string }[] = [
  { key: 'sceneArrows', label: '① 速度の矢印' },
  { key: 'trails', label: '① 通った跡' },
  { key: 'magnitudes', label: '② 大きさの数値' },
  { key: 'components', label: '② 成分の点線' },
  { key: 'parallelogram', label: '② 平行四辺形' },
];

export function Header() {
  const s = useAppState();
  const dispatch = useDispatch();
  const menuRef = useRef<HTMLDetailsElement>(null);

  // メニューの外をタップしたら閉じる
  useEffect(() => {
    const close = (e: PointerEvent) => {
      const el = menuRef.current;
      if (el?.open && !el.contains(e.target as Node)) el.open = false;
    };
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, []);

  return (
    <header className="app-header">
      <div className="header-row">
        <h1 className="app-title">合成速度ラボ</h1>
        <div className="seg" role="group" aria-label="モード">
          <button className="seg-btn" aria-pressed="true">
            探究
          </button>
          <button className="seg-btn" disabled title="準備中">
            練習（準備中）
          </button>
        </div>
      </div>

      <div className="header-row">
        <label className="preset">
          <span className="ctl-label">例</span>
          <select
            value={s.presetId ?? ''}
            aria-label="例を選ぶ"
            onChange={(e) => {
              const p = PRESETS.find((q) => q.id === e.target.value);
              if (p) dispatch({ type: 'loadPreset', id: p.id, v1: p.v1, v2: p.v2, goal: p.goal });
            }}
          >
            {s.presetId === null && <option value="">自由に設定中</option>}
            {PRESET_GROUPS.map((g) => (
              <optgroup key={g} label={g}>
                {PRESETS.filter((p) => p.group === g).map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </label>

        <details className="menu" ref={menuRef}>
          <summary className="btn">表示</summary>
          <div className="menu-body">
            {DISPLAY_ITEMS.map((it) => (
              <label key={it.key} className="check">
                <input type="checkbox" checked={s.display[it.key]} onChange={() => dispatch({ type: 'toggleDisplay', key: it.key })} />
                {it.label}
              </label>
            ))}
            <hr />
            <label className="check">
              <input type="checkbox" checked={s.presentation} onChange={() => dispatch({ type: 'setPresentation', on: !s.presentation })} />
              文字と線を大きく（投影用）
            </label>
          </div>
        </details>
      </div>
    </header>
  );
}
