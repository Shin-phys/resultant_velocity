import { useMemo, useRef, useState } from 'react';
import { axisAlign, FLOW_UNIT } from '../../model/kinematics';
import { add, clampBox, collinearNormal, formatLength, isZero, scale, snap, sub, type Vec } from '../../model/vector';
import { useAppState, useDispatch, v2Of } from '../../state/store';
import { Arrow, fy, useElementSize } from '../common/svg';
import { useDrag } from '../common/useDrag';

/** 方眼の最小の範囲 [m/s]（仕様 04 §1） */
const GRID_MIN = 8;
const PAD = 1.2;

/** ② ベクトル図ビュー（仕様 04）。探究モードでは「つなぐ方式」で固定表示する。 */
export function VectorView() {
  const s = useAppState();
  const dispatch = useDispatch();
  const svgRef = useRef<SVGSVGElement>(null);
  const [boxRef, size] = useElementSize<HTMLDivElement>();
  const k = s.presentation ? 1.5 : 1;

  const v1 = s.v1;
  const v2 = v2Of(s);
  const v = add(v1, v2);

  // 方眼の範囲：矢印が収まる大きさ。ドラッグ中は固定する
  const needed = Math.max(GRID_MIN, ...[...v1, ...v2, ...v].map((c) => Math.abs(c) + 1));
  const [frozenR, setFrozenR] = useState<number | null>(null);
  const R = frozenR ?? needed;
  const span = 2 * (R + PAD);
  const U = size.w > 0 && size.h > 0 ? span / Math.min(size.w, size.h) : span / 360;
  const head = 12 * k * U;
  const font = 14 * k * U;

  const grid = useMemo(() => {
    const ls: { x1: number; y1: number; x2: number; y2: number; cls: string }[] = [];
    for (let i = -R; i <= R; i++) {
      const cls = i === 0 ? 'axis' : i % 5 === 0 ? 'strong' : 'thin';
      ls.push({ x1: i, y1: -R, x2: i, y2: R, cls });
      ls.push({ x1: -R, y1: -i, x2: R, y2: -i, cls });
    }
    return ls;
  }, [R]);
  const ticks: number[] = [];
  for (let n = -Math.floor(R / 5) * 5; n <= R; n += 5) if (n !== 0) ticks.push(n);

  const freeze = { onStart: () => setFrozenR(needed), onEnd: () => setFrozenR(null) };
  const dragV1 = useDrag(svgRef, {
    ...freeze,
    onMove: (p) => dispatch({ type: 'setV1', v: clampBox(snap(p), R) }),
  });
  const dragV2 = useDrag(svgRef, {
    ...freeze,
    onMove: (p) => {
      const d = axisAlign(snap(sub(p, v1)));
      // 先端（v₁ + v₂）が方眼からはみ出さないようにする
      const tip = clampBox(add(v1, d), R);
      dispatch({ type: 'setV2', v: axisAlign(sub(tip, v1)) });
    },
  });

  // v₂ が 0 のとき、ハンドルが v₁ の先端と重ならないよう流れの向きに少しずらして置く
  // 同一直線上（段階1）のときは v₂ と v を直線の両側へ少しずらして、重ならないようにする
  const nrm = collinearNormal(v1, v2);
  const offV2: Vec = nrm ? scale(nrm, 0.35) : [0, 0];
  const offV: Vec = nrm ? scale(nrm, -0.35) : [0, 0];
  const v2Handle: Vec = isZero(v2) ? add(v1, scale(FLOW_UNIT[s.flowDir], 0.8)) : add(v, offV2);

  const { magnitudes, components, parallelogram } = s.display;

  return (
    <section className="pane vector-pane" aria-label="② ベクトル図">
      <header className="pane-head">
        <h2>② ベクトル図</h2>
        <span className="hint">1マス＝1 m/s</span>
      </header>
      <div className="vector-box" ref={boxRef}>
        <svg
          ref={svgRef}
          className="vector-svg"
          viewBox={`${-R - PAD} ${-R - PAD} ${span} ${span}`}
          preserveAspectRatio="xMidYMid meet"
          role="img"
          aria-label="速度ベクトルの作図"
        >
          {grid.map((l, i) => (
            <line key={i} {...l} className={`grid-${l.cls}`} vectorEffect="non-scaling-stroke" />
          ))}
          {ticks.map((n) => (
              <g key={n} className="tick">
                <text x={n} y={font * 1.1} fontSize={font * 0.8} textAnchor="middle">
                  {n}
                </text>
                <text x={-font * 0.6} y={-n} fontSize={font * 0.8} textAnchor="end" dominantBaseline="middle">
                  {n}
                </text>
              </g>
            ))}
          <text x={R + PAD * 0.4} y={-font * 0.6} fontSize={font * 0.8} textAnchor="end" className="tick">
            vx
          </text>
          <text x={font * 0.5} y={-R - PAD * 0.4} fontSize={font * 0.8} dominantBaseline="hanging" className="tick">
            vy
          </text>

          {/* 成分の破線 */}
          {components && (
            <g>
              <ComponentLines vec={v1} color="var(--c-v1)" />
              <ComponentLines vec={v} color="var(--c-v)" />
            </g>
          )}

          {/* 平行四辺形の並べ方（v₂ を原点から、v₁ を v₂ の先から） */}
          {parallelogram && !isZero(v2) && (
            <g>
              <Arrow from={[0, 0]} to={v2} color="var(--c-v2)" width={2 * k} head={head} dashed opacity={0.6} />
              <Arrow from={v2} to={v} color="var(--c-v1)" width={2 * k} head={head} dashed opacity={0.6} />
            </g>
          )}

          <Arrow from={[0, 0]} to={v1} color="var(--c-v1)" width={3.5 * k} head={head} label="v₁" fontSize={font} />
          <Arrow from={add(v1, offV2)} to={add(v, offV2)} color="var(--c-v2)" width={3.5 * k} head={head} label="v₂" fontSize={font} />
          {/* 再生中は v を明滅させ、① の地面に対する軌跡と同じ向きだと気づかせる（仕様 04 §6） */}
          <g className={s.status === 'playing' ? 'pulse' : undefined}>
            <Arrow from={offV} to={add(v, offV)} color="var(--c-v)" width={5 * k} head={head * 1.15} label="v" fontSize={font} />
          </g>

          {magnitudes && (
            <g>
              <MagLabel from={[0, 0]} to={v1} text={`|v₁| = ${formatLength(v1)}`} color="var(--c-v1)" font={font} side={1} />
              <MagLabel from={add(v1, offV2)} to={add(v, offV2)} text={`|v₂| = ${formatLength(v2)}`} color="var(--c-v2)" font={font} side={1} />
              <MagLabel from={offV} to={add(v, offV)} text={`|v| = ${formatLength(v)}`} color="var(--c-v)" font={font} side={-1} />
            </g>
          )}

          <circle className="origin" cx={0} cy={0} r={4 * k * U} />

          <circle
            className="handle"
            cx={fy(v1)[0]}
            cy={fy(v1)[1]}
            r={12 * k * U}
            fill="var(--c-v1)"
            fillOpacity={0.18}
            stroke="var(--c-v1)"
            strokeWidth={2}
            vectorEffect="non-scaling-stroke"
            {...dragV1}
          >
            <title>ドラッグで v₁ を変える</title>
          </circle>
          {isZero(v2) ? (
            <rect
              className="handle"
              x={fy(v2Handle)[0] - 8 * k * U}
              y={fy(v2Handle)[1] - 8 * k * U}
              width={16 * k * U}
              height={16 * k * U}
              transform={`rotate(45 ${fy(v2Handle)[0]} ${fy(v2Handle)[1]})`}
              fill="var(--c-v2)"
              fillOpacity={0.3}
              stroke="var(--c-v2)"
              strokeWidth={2}
              vectorEffect="non-scaling-stroke"
              {...dragV2}
            >
              <title>ドラッグで v₂（流れ）を伸ばす</title>
            </rect>
          ) : (
            <circle
              className="handle"
              cx={fy(v2Handle)[0]}
              cy={fy(v2Handle)[1]}
              r={12 * k * U}
              fill="var(--c-v2)"
              fillOpacity={0.18}
              stroke="var(--c-v2)"
              strokeWidth={2}
              vectorEffect="non-scaling-stroke"
              {...dragV2}
            >
              <title>ドラッグで v₂（流れ）を変える。上下左右にだけ動く</title>
            </circle>
          )}
        </svg>
      </div>
    </section>
  );
}

function ComponentLines({ vec, color }: { vec: Vec; color: string }) {
  if (isZero(vec)) return null;
  const [x, y] = vec;
  return (
    <path
      d={`M 0 0 H ${x} V ${-y}`}
      fill="none"
      stroke={color}
      strokeWidth={1.5}
      strokeDasharray="5 4"
      vectorEffect="non-scaling-stroke"
      opacity={0.8}
    />
  );
}

function MagLabel(props: { from: Vec; to: Vec; text: string; color: string; font: number; side: 1 | -1 }) {
  const { from, to, text, color, font, side } = props;
  const d = sub(to, from);
  const len = Math.hypot(d[0], d[1]);
  if (len < 1e-9) return null;
  const n: Vec = [(-d[1] / len) * side, (d[0] / len) * side];
  const mid: Vec = [(from[0] + to[0]) / 2 + n[0] * font * 1.1, (from[1] + to[1]) / 2 + n[1] * font * 1.1];
  const [x, y] = fy(mid);
  return (
    <text x={x} y={y} fill={color} fontSize={font * 0.85} textAnchor="middle" dominantBaseline="middle" className="svg-label">
      {text}
    </text>
  );
}
