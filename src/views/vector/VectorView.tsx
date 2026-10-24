import { useMemo, useRef, useState } from 'react';
import { axisAlign, FLOW_UNIT } from '../../model/kinematics';
import { add, clampBox, formatLength, isParallel, isZero, overlapNormal, scale, snap, sub, type Vec } from '../../model/vector';
import { useRevealPhase } from '../../playback/reveal';
import { useAppState, useDispatch, v2Of } from '../../state/store';
import { Handle } from '../common/Handle';
import { Arrow, outsideMidpoint, useElementSize } from '../common/svg';
import { useTipDrag } from '../common/useDrag';

/** 方眼の最小の範囲 [m/s]（仕様 04 §1） */
const GRID_MIN = 8;
const PAD = 1.2;
/** 矢印が重なるときにずらす量 [マス] */
const OFFSET = 0.35;

/**
 * ② ベクトル図ビュー（仕様 04）。探究モードでは「つなぐ方式」で表示する。
 * 合成速度 v を隠している間は v₁ と v₂ をどちらも原点から描き、v を出すときに
 * v₂ が v₁ の先端まで滑ってから v が伸びる（仕様 06「合成速度 v を出すタイミング」）。
 */
export function VectorView() {
  const s = useAppState();
  const dispatch = useDispatch();
  const svgRef = useRef<SVGSVGElement>(null);
  const [boxRef, size] = useElementSize<HTMLDivElement>();
  const k = s.presentation ? 1.5 : 1;

  const v1 = s.v1;
  const v2 = v2Of(s);
  const v = add(v1, v2);
  const phase = useRevealPhase(s.vShown, s.revealAt);
  const done = s.vShown && phase.draw >= 1;
  /** v₂ の始点：隠している間は原点、出すときに v₁ の先端へ滑る */
  const v2Base: Vec = scale(v1, phase.slide);
  const v2End = add(v2Base, v2);

  // 方眼の範囲：矢印が収まる大きさ。ドラッグ中は固定する
  const needed = Math.max(GRID_MIN, ...[...v1, ...v2, ...v].map((c) => Math.abs(c) + 1));
  const [frozenR, setFrozenR] = useState<number | null>(null);
  const R = frozenR ?? needed;
  const span = 2 * (R + PAD);
  const U = size.w > 0 && size.h > 0 ? span / Math.min(size.w, size.h) : span / 360;
  const px = (n: number) => n * k * U;
  const head = px(12);
  const font = px(14);

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

  // 矢印が重なる配置（同一直線上、または v₂ = 0）のときは、v₂ と v を両側へずらす
  const nrm = overlapNormal(v1, v2);
  const offV2: Vec = nrm ? scale(nrm, OFFSET) : [0, 0];
  const offV: Vec = nrm ? scale(nrm, -OFFSET) : [0, 0];
  const shiftV1: Vec | undefined = nrm ? [0, 0] : undefined;
  const shiftV2: Vec | undefined = nrm ? scale(nrm, font * 1.3) : undefined;
  const shiftV: Vec | undefined = nrm ? scale(nrm, -font * 1.3) : undefined;
  // 三角形になるときは、各辺の中点の外側にラベルを置く（先端どうしが重なってもラベルは重ならない）
  const centroid: Vec = [(v1[0] + v[0]) / 3, (v1[1] + v[1]) / 3];
  const lab = (from: Vec, to: Vec): Vec | undefined =>
    nrm || !done ? undefined : outsideMidpoint(from, to, centroid, font * 0.9);

  // v₂ = 0 のときのつまみ：v₁ の先から流れの向き（v₁ と平行ならその横）に少し離して置く
  const flowU = FLOW_UNIT[s.flowDir];
  const zeroDir: Vec = isParallel(flowU, v1) && nrm ? nrm : flowU;
  const v2Handle: Vec = isZero(v2) ? add(v2Base, scale(zeroDir, 0.9)) : add(v2End, offV2);

  const freeze = { onStart: () => setFrozenR(needed), onEnd: () => setFrozenR(null) };
  const dragV1 = useTipDrag(svgRef, () => v1, (p) => dispatch({ type: 'setV1', v: clampBox(snap(p), R) }), freeze);
  const dragV2 = useTipDrag(
    svgRef,
    () => v2End,
    (p) => {
      const d = axisAlign(snap(sub(p, v2Base)));
      // 先端が方眼からはみ出さないようにする
      const tip = clampBox(add(v2Base, d), R);
      dispatch({ type: 'setV2', v: axisAlign(sub(tip, v2Base)) });
    },
    freeze,
  );

  const { magnitudes, components, parallelogram } = s.display;

  return (
    <section className="pane vector-pane" aria-label="② ベクトル図">
      <header className="pane-head">
        <h2>② ベクトル図</h2>
        <span className="hint">1マス＝1 m/s</span>
        {!s.vShown && (
          <button className="btn small" onClick={() => dispatch({ type: 'revealV', at: performance.now() })}>
            v を表示
          </button>
        )}
        {magnitudes && (
          <span className="mags" aria-label="大きさ">
            <span className="c-v1">|v₁| = {formatLength(v1)}</span>
            <span className="c-v2">|v₂| = {formatLength(v2)}</span>
            <span className="c-v">|v| = {s.vShown ? formatLength(v) : '？'}</span>
          </span>
        )}
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

          {/* 成分の点線 */}
          {components && (
            <g>
              <ComponentLines vec={v1} color="var(--c-v1)" />
              {s.vShown && <ComponentLines vec={v} color="var(--c-v)" />}
            </g>
          )}

          {/* 平行四辺形の並べ方（v₂ を原点から、v₁ を v₂ の先から） */}
          {parallelogram && done && !isZero(v2) && !nrm && (
            <g>
              <Arrow from={[0, 0]} to={v2} color="var(--c-v2)" width={2 * k} head={head} dashed opacity={0.6} />
              <Arrow from={v2} to={v} color="var(--c-v1)" width={2 * k} head={head} dashed opacity={0.6} />
            </g>
          )}

          <Arrow from={[0, 0]} to={v1} color="var(--c-v1)" width={3.5 * k} head={head} label="v₁" fontSize={font} labelShift={shiftV1} labelAt={nrm ? add(scale(v1, 0.5), scale(nrm, font)) : lab([0, 0], v1)} />
          <Arrow
            from={add(v2Base, offV2)}
            to={add(v2End, offV2)}
            color="var(--c-v2)"
            width={3.5 * k}
            head={head}
            label="v₂"
            fontSize={font}
            labelShift={shiftV2}
            labelAt={lab(v1, v)}
          />
          {/* 再生中は v を明滅させ、① の地面に対する軌跡と同じ向きだと気づかせる（仕様 04 §6） */}
          {phase.draw > 0 && (
            <g className={s.status === 'playing' ? 'pulse' : undefined}>
              <Arrow
                from={offV}
                to={add(scale(v, phase.draw), offV)}
                color="var(--c-v)"
                width={5 * k}
                head={head * 1.15}
                label={done ? 'v' : undefined}
                fontSize={font}
                labelShift={shiftV}
                labelAt={lab([0, 0], v)}
              />
            </g>
          )}

          <circle className="origin" cx={0} cy={0} r={px(4)} />

          <Handle at={v2Handle} r={px(12)} color="var(--c-v2)" zero={isZero(v2)} drag={dragV2} title="ドラッグで v₂（流れ）を変える。上下左右にだけ動く" />
          <Handle at={v1} r={px(12)} color="var(--c-v1)" drag={dragV1} title="ドラッグで v₁ を変える" />
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
