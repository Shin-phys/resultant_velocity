import { useEffect, useRef, useState } from 'react';
import { useContinuousPlayback } from './playback/continuous';
import { AppProvider, useAppState, useDispatch, v2Of } from './state/store';
import { Header } from './ui/Header';
import { PlaybackBar } from './ui/PlaybackBar';
import { StatusBar } from './ui/StatusBar';
import { SceneView } from './views/scene/SceneView';
import { TableView } from './views/table/TableView';
import { VectorView } from './views/vector/VectorView';

/** 横幅がこれ未満で縦長なら、②③ をタブ切替にする（仕様 02 §2） */
const NARROW_QUERY = '(max-width: 899px) and (orientation: portrait)';

function useMediaQuery(q: string): boolean {
  const [m, setM] = useState(() => typeof window !== 'undefined' && window.matchMedia(q).matches);
  useEffect(() => {
    const mq = window.matchMedia(q);
    const on = () => setM(mq.matches);
    on();
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, [q]);
  return m;
}

type Tab = 'vector' | 'table';

function Layout() {
  const s = useAppState();
  const dispatch = useDispatch();
  useContinuousPlayback(s.status, dispatch);
  const narrow = useMediaQuery(NARROW_QUERY);
  const [tab, setTab] = useState<Tab>('vector');
  const [dirty, setDirty] = useState<Record<Tab, boolean>>({ vector: false, table: false });

  // 隠れているタブで内容が変わったら、見出しに印を付ける
  const v2 = v2Of(s);
  const key = `${s.v1[0]},${s.v1[1]},${v2[0]},${v2[1]}`;
  const prevKey = useRef(key);
  useEffect(() => {
    if (prevKey.current !== key && narrow) {
      const hidden: Tab = tab === 'vector' ? 'table' : 'vector';
      setDirty((d) => ({ ...d, [hidden]: true }));
    }
    prevKey.current = key;
  }, [key, narrow, tab]);

  const select = (t: Tab) => {
    setTab(t);
    setDirty((d) => ({ ...d, [t]: false }));
  };

  useEffect(() => {
    document.documentElement.classList.toggle('presentation', s.presentation);
  }, [s.presentation]);

  return (
    <div className={`app ${narrow ? 'narrow' : 'wide'}`}>
      <Header />
      <main className="panes">
        <SceneView />
        {narrow ? (
          <div className="tabbed">
            <div className="tabs" role="tablist">
              {(
                [
                  ['vector', '② ベクトル図'],
                  ['table', '③ 成分表'],
                ] as const
              ).map(([t, label]) => (
                <button key={t} role="tab" aria-selected={tab === t} className="tab" onClick={() => select(t)}>
                  {label}
                  {dirty[t] && <span className="dot" aria-label="変更あり" />}
                </button>
              ))}
            </div>
            {tab === 'vector' ? <VectorView /> : <TableView />}
          </div>
        ) : (
          <div className="side">
            <VectorView />
            <TableView />
          </div>
        )}
      </main>
      <PlaybackBar />
      <StatusBar />
    </div>
  );
}

export default function App() {
  return (
    <AppProvider>
      <Layout />
    </AppProvider>
  );
}
