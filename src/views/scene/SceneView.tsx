import { useMemo, useRef, useState, type CSSProperties } from 'react';
import { acrossAxis, banks, computeEnd, FLOW_UNIT, velocityAt } from '../../model/kinematics';
import { fitAspect, viewportFor } from '../../model/viewport';
import { add, isParallel, isZero, overlapNormal, scale, snap, sub, type Vec } from '../../model/vector';
import { riverSkin } from '../../skins/river';
import { useRevealPhase } from '../../playback/reveal';
import { useAppState, useDispatch, v2Of } from '../../state/store';
import { Handle } from '../common/Handle';
import { circleRect, placeLabels, rectAt, textEm, type LabelRequest, type Obstacle } from '../common/labelLayout';
import { Arrow, fy, useElementSize } from '../common/svg';
import { VecLabel, vecLabelRequest, vecLabelText, type VecLabelText } from '../common/VecLabel';
import { useTipDrag } from '../common/useDrag';
import { CrossingLog } from './CrossingLog';
import { FlowControls } from './FlowControls';

/** 目盛りの数字の間隔の候補 [m] */
const LABEL_STEPS = [5, 10, 20, 25, 50];

/** ① イメージ図（仕様 03）。上から見た平面図。v₁ と v₂ の矢印の先端をドラッグして変えられる。 */
export function SceneView() {
  const s = useAppState();
  const dispatch = useDispatch();
  const [boxRef, size] = useElementSize<HTMLDivElement>();
  const svgRef = useRef<SVGSVGElement>(null);

  const v1i = s.v1;
  const v2i = v2Of(s);
  // ① に描くのはその時刻の速度（加速度があると変わる。仕様 12 §4）
  const v1 = velocityAt(v1i, s.a1, s.sim.t);
  const v2 = velocityAt(v2i, s.a2, s.sim.t);
  const v = add(v1, v2);
  const hasAccel = !isZero(s.a1) || !isZero(s.a2);
  // 加速度があるとき、t > 0 の矢印はその時刻の速度なので、つかんでも初速度は変えられない
  const canDrag = !(hasAccel && s.sim.t > 0);
  const { sim, goal, flowDir, display } = s;
  // 合成速度 v は再生が終わるまで出さない（仕様 06「合成速度 v を出すタイミング」）
  const phase = useRevealPhase(s.vShown, s.revealAt);
  const a = acrossAxis(flowDir);
  const b = (1 - a) as 0 | 1;
  const [lo, hi] = banks(goal);
  const k = s.presentation ? 1.5 : 1;

  // 表示範囲：軌跡の端も含める
  const extra = useMemo(() => [sim.pos, ...sim.groundTrail], [sim.pos, sim.groundTrail]);
  const computed = viewportFor(goal, flowDir, v1i, v2i, extra, s.a1, s.a2);
  // ドラッグ中は表示範囲を固定する（範囲が変わるとハンドルが指から逃げるため）
  const [frozen, setFrozen] = useState<typeof computed | null>(null);
  const base = frozen ?? computed;
  const box = size.w > 0 && size.h > 0 ? fitAspect(base, size.w / size.h) : base;
  const W = box.xMax - box.xMin;
  const H = box.yMax - box.yMin;
  /** 1 px あたりの長さ [m] */
  const U = size.w > 0 ? W / size.w : W / 600;
  const px = (n: number) => n * k * U;

  const head = px(12);
  const font = px(14);
  const boatLen = Math.max(1.4, px(30));

  // 川の帯（横断方向は岸の間、流れの方向は画面いっぱい）
  const riverRect =
    a === 1
      ? { x: box.xMin, y: -hi, width: W, height: hi - lo }
      : { x: lo, y: -box.yMax, width: hi - lo, height: H };

  // 地面の目盛り：画面が細かくなりすぎたら間引く
  const pxPerM = 1 / U;
  const labelStep = LABEL_STEPS.find((st) => st * pxPerM >= (b === 0 ? 36 : 24)) ?? 100;
  const minorOn = pxPerM >= 7;
  const strongStep = 5 * pxPerM >= 12 ? 5 : labelStep;
  const gridLines = useMemo(() => {
    const lines: { x1: number; y1: number; x2: number; y2: number; strong: boolean }[] = [];
    const step = minorOn ? 1 : strongStep;
    for (let x = Math.ceil(box.xMin / step) * step; x <= box.xMax; x += step)
      lines.push({ x1: x, y1: -box.yMax, x2: x, y2: -box.yMin, strong: x % strongStep === 0 });
    for (let y = Math.ceil(box.yMin / step) * step; y <= box.yMax; y += step)
      lines.push({ x1: box.xMin, y1: -y, x2: box.xMax, y2: -y, strong: y % strongStep === 0 });
    return lines;
  }, [box.xMin, box.xMax, box.yMin, box.yMax, minorOn, strongStep]);

  // 岸に沿った目盛りの数字（画面の端で切れるものは出さない）
  const bankLabels = useMemo(() => {
    const out: { x: number; y: number; text: string; anchor: 'start' | 'middle' | 'end' }[] = [];
    const min = b === 0 ? box.xMin : box.yMin;
    const max = b === 0 ? box.xMax : box.yMax;
    const margin = font * (b === 0 ? 1.2 : 0.7);
    for (let t = Math.ceil(min / labelStep) * labelStep; t <= max; t += labelStep) {
      if (t - min < margin || max - t < margin) continue;
      for (const side of [-1, 1] as const) {
        const edge = side < 0 ? lo : hi;
        const p: [number, number] = [0, 0];
        p[b] = t;
        if (a === 1) {
          // 横向きの川：岸の外側（上下）に中央ぞろえ
          p[a] = edge + side * font * 0.9;
          const [x, y] = fy(p);
          out.push({ x, y, text: `${t}`, anchor: 'middle' });
        } else {
          // 縦向きの川：岸の外側（左右）に寄せる
          p[a] = edge + side * font * 0.4;
          const [x, y] = fy(p);
          out.push({ x, y, text: `${t}`, anchor: side < 0 ? 'end' : 'start' });
        }
      }
    }
    return out;
  }, [a, b, box.xMin, box.xMax, box.yMin, box.yMax, lo, hi, font, labelStep]);

  // 媒質シートのずれ（タイルの大きさで割った余り）
  const T = riverSkin.tile;
  const sx = ((sim.sheet[0] % T) + T) % T;
  const sy = ((-sim.sheet[1] % T) + T) % T;

  // 船首の向き（v₁ が 0 のときは横断方向）
  const headingVec: Vec = !isZero(v1) ? v1 : !isZero(s.a1) ? s.a1 : a === 1 ? [0, 1] : [1, 0];
  const angle = (-Math.atan2(headingVec[1], headingVec[0]) * 180) / Math.PI;
  const [bx, by] = fy(sim.pos);

  // 矢印が重なる配置（同一直線上、または v₂ = 0）のときは、v₂ と v を両側へずらす
  const nrm = overlapNormal(v1, v2);
  const offV2: Vec = nrm ? scale(nrm, px(13)) : [0, 0];
  const offV: Vec = nrm ? scale(nrm, -px(13)) : [0, 0];

  const v1Tip = add(sim.pos, v1);
  const v2Tip = add(add(sim.pos, v2), offV2);
  // v₂ = 0 のときのハンドル：流れの向き（v₁ と平行ならその横）に少し離して置く
  const flowU = FLOW_UNIT[flowDir];
  const zeroDir: Vec = isParallel(flowU, v1) && nrm ? nrm : flowU;
  const v2Handle: Vec = isZero(v2) ? add(sim.pos, scale(zeroDir, px(26))) : v2Tip;

  // ---- 矢印のラベル（記号と大きさ）。矢印・つまみ・船・ほかのラベルと重ならない所に置く ----
  const segV1: [Vec, Vec] = [sim.pos, v1Tip];
  const segV2: [Vec, Vec] = [add(sim.pos, offV2), v2Tip];
  const segV: [Vec, Vec] = [add(sim.pos, offV), add(add(sim.pos, scale(v, phase.draw)), offV)];
  const vDone = s.vShown && phase.draw >= 1;
  const drawnSegs: [Vec, Vec][] = [segV1, ...(isZero(v2) ? [] : [segV2]), ...(phase.draw > 0 ? [segV] : [])];
  const tipsCenter: Vec = drawnSegs.reduce<Vec>((c, sg) => add(c, scale(sg[1], 1 / drawnSegs.length)), [0, 0]);
  const sideOf = (sg: [Vec, Vec], shift: Vec | null): Vec =>
    shift ?? sub([(sg[0][0] + sg[1][0]) / 2, (sg[0][1] + sg[1][1]) / 2], tipsCenter);
  const labelReqs: LabelRequest[] = [];
  const labelTexts: Record<string, { t: VecLabelText; color: string }> = {};
  const addLabel = (key: string, t: VecLabelText, color: string, sg: [Vec, Vec], shift: Vec | null) => {
    labelReqs.push(vecLabelRequest(key, t, font, sg[0], sg[1], sideOf(sg, shift), true, px(11)));
    labelTexts[key] = { t, color };
  };
  if (vDone) addLabel('v', vecLabelText('v', v, display.magnitudes), 'var(--c-v)', segV, nrm && scale(nrm, -1));
  addLabel('v1', vecLabelText('v₁', v1, display.magnitudes), 'var(--c-v1)', segV1, nrm);
  if (!isZero(v2)) addLabel('v2', vecLabelText('v₂', v2, display.magnitudes), 'var(--c-v2)', segV2, nrm);
  // ---- 川幅の寸法線（仕様 03 §1）。船が流される側とは反対の端に置く ----
  const dimFont = font * 0.85;
  const dimText = `川幅 ${goal.width} m`;
  const dimW = textEm(dimText) * dimFont + dimFont * 0.4;
  const dimH = dimFont * 1.2;
  const endAlong = computeEnd(add(v1i, v2i), goal, flowDir, add(s.a1, s.a2)).pos[b];
  const atMin = endAlong >= 0; // 流されるのが + 側なら − 側の端に置く
  const edgeIn = font * 1.4; // 画面の端から寸法線までの距離
  const dim = (() => {
    const p1: [number, number] = [0, 0];
    const p2: [number, number] = [0, 0];
    const along = b === 0 ? (atMin ? box.xMin + edgeIn : box.xMax - edgeIn) : atMin ? box.yMin + edgeIn : box.yMax - edgeIn;
    p1[b] = along;
    p2[b] = along;
    p1[a] = lo;
    p2[a] = hi;
    const mid: [number, number] = [0, 0];
    mid[b] = along;
    mid[a] = (lo + hi) / 2;
    // ラベル：横向きの川なら線の右（左）、縦向きの川なら線の上（下）
    const c: Vec =
      b === 0
        ? [along + (atMin ? 1 : -1) * (dimW / 2 + font * 0.35), mid[1]]
        : [mid[0], along + (atMin ? 1 : -1) * (dimH / 2 + font * 0.3)];
    return { p1: p1 as Vec, p2: p2 as Vec, mid: mid as Vec, label: c };
  })();

  const labelObstacles: Obstacle[] = [
    { kind: 'seg', a: dim.p1, b: dim.p2 },
    { kind: 'rect', r: rectAt(dim.label, dimW, dimH) },
    ...drawnSegs.map(([a, b]): Obstacle => ({ kind: 'seg', a, b })),
    { kind: 'rect', r: circleRect(sim.pos, boatLen * 0.5) },
    { kind: 'rect', r: circleRect(v1Tip, px(11)) },
    { kind: 'rect', r: circleRect(v2Handle, px(11)) },
  ];
  const placedLabels = display.sceneArrows
    ? placeLabels(labelReqs, labelObstacles, { x0: box.xMin, y0: box.yMin, x1: box.xMax, y1: box.yMax }, px(2))
    : [];

  const freeze = { onStart: () => setFrozen(computed), onEnd: () => setFrozen(null) };
  const dragV1 = useTipDrag(
    svgRef,
    () => v1Tip,
    (p) => dispatch({ type: 'setV1', v: snap(sub(p, sim.pos)) }),
    freeze,
  );
  const dragV2 = useTipDrag(
    svgRef,
    // 実際の先端（ずらす前）を基準にするので、押しただけでは値が変わらない
    () => add(sim.pos, v2),
    (p) => dispatch({ type: 'setV2', v: snap(sub(p, sim.pos)) }),
    freeze,
  );

  const mediumPts = sim.mediumTrail.map((p) => fy(add(p, sim.sheet)).join(',')).join(' ');
  const groundPts = sim.groundTrail.map((p) => fy(p).join(',')).join(' ');
  const waterStart = fy(sim.sheet);
  const sceneH = Math.round(Math.max(220, Math.min(440, size.w * ((base.yMax - base.yMin) / (base.xMax - base.xMin)))));

  return (
    <section className="pane scene-pane" aria-label="① イメージ図">
      <header className="pane-head">
        <h2>① イメージ図</h2>
        <FlowControls />
        <Timer />
      </header>
      <div
        className="scene-box"
        ref={boxRef}
        // 狭い画面では、川の縦横比に合わせて高さを決める（CSS 側で使う）
        style={{ '--scene-h': `${sceneH}px` } as CSSProperties}
      >
        <svg
          ref={svgRef}
          className="scene-svg"
          viewBox={`${box.xMin} ${-box.yMax} ${W} ${H}`}
          preserveAspectRatio="xMidYMid meet"
          role="img"
          aria-label="川を渡る船の運動"
        >
          <defs>
            <pattern
              id="sheet"
              patternUnits="userSpaceOnUse"
              width={T}
              height={T}
              patternTransform={`translate(${sx} ${sy})`}
            >
              <rect width={T} height={T} fill="var(--water)" />
              <path d={`M 0 0 H ${T} M 0 0 V ${T}`} stroke="var(--sheet-line)" strokeWidth={1} vectorEffect="non-scaling-stroke" fill="none" />
              {riverSkin.leaves.map(([lx, ly, rot], i) => (
                <ellipse key={i} cx={lx} cy={ly} rx={0.28} ry={0.13} transform={`rotate(${rot} ${lx} ${ly})`} fill="var(--leaf)" />
              ))}
            </pattern>
            <clipPath id="river-clip">
              <rect {...riverRect} />
            </clipPath>
          </defs>

          <rect x={box.xMin} y={-box.yMax} width={W} height={H} fill="var(--land)" />
          <rect {...riverRect} fill="url(#sheet)" />

          <g className="ground-grid">
            {gridLines.map((l, i) => (
              <line key={i} {...l} stroke={l.strong ? 'var(--grid-strong)' : 'var(--grid)'} strokeWidth={1} vectorEffect="non-scaling-stroke" />
            ))}
          </g>

          {/* 岸 */}
          {[lo, hi].map((edge) => {
            const p1: [number, number] = [0, 0];
            const p2: [number, number] = [0, 0];
            p1[a] = edge;
            p2[a] = edge;
            p1[b] = b === 0 ? box.xMin : box.yMin;
            p2[b] = b === 0 ? box.xMax : box.yMax;
            const [x1, y1] = fy(p1);
            const [x2, y2] = fy(p2);
            return <line key={edge} x1={x1} y1={y1} x2={x2} y2={y2} stroke="var(--bank)" strokeWidth={3 * k} vectorEffect="non-scaling-stroke" />;
          })}
          {bankLabels.map((l, i) => (
            <text key={i} x={l.x} y={l.y} fontSize={font * 0.8} fill="var(--muted)" textAnchor={l.anchor} dominantBaseline="middle">
              {l.text}
            </text>
          ))}

          {/* 川幅の寸法線 */}
          <g className="dimension" aria-label={dimText}>
            <Arrow from={dim.mid} to={dim.p1} color="var(--muted)" width={1.5 * k} head={px(9)} />
            <Arrow from={dim.mid} to={dim.p2} color="var(--muted)" width={1.5 * k} head={px(9)} />
            <text
              x={fy(dim.label)[0]}
              y={fy(dim.label)[1]}
              fontSize={dimFont}
              fill="var(--text)"
              fontWeight={700}
              textAnchor="middle"
              dominantBaseline="central"
              className="svg-label"
              style={{ strokeWidth: dimFont * 0.25, vectorEffect: 'none' }}
            >
              {dimText}
            </text>
          </g>

          {/* 出発点 */}
          <circle cx={0} cy={0} r={px(5)} fill="none" stroke="var(--text)" strokeWidth={1.5} vectorEffect="non-scaling-stroke" />

          {/* 水に対する軌跡（シートと一緒に流れる） */}
          {display.trails && sim.t > 0 && (
            <g>
              <polyline
                clipPath="url(#river-clip)"
                points={mediumPts}
                fill="none"
                stroke="var(--c-v1)"
                strokeWidth={2 * k}
                strokeDasharray={`${3 * k} ${4 * k}`}
                vectorEffect="non-scaling-stroke"
              />
              <circle cx={waterStart[0]} cy={waterStart[1]} r={px(5)} fill="none" stroke="var(--c-v1)" strokeWidth={2} vectorEffect="non-scaling-stroke" />
              <text
                x={waterStart[0] + (a === 0 ? font * 0.6 : 0)}
                y={waterStart[1] + (a === 1 ? -font * 1.1 : font * 1.3)}
                fontSize={font * 0.75}
                fill="var(--c-v1)"
                textAnchor={a === 0 ? 'start' : 'middle'}
                className="svg-label"
              >
                出発した水
              </text>
            </g>
          )}

          {/* 地面に対する軌跡と1秒ごとの点 */}
          {display.trails && sim.t > 0 && (
            <polyline points={groundPts} fill="none" stroke="var(--c-v)" strokeWidth={2.5 * k} vectorEffect="non-scaling-stroke" />
          )}
          {display.trails &&
            sim.strobes.map((p, i) => {
              const [x, y] = fy(p);
              return <circle key={i} cx={x} cy={y} r={px(3.5)} fill="var(--c-v)" />;
            })}

          {/* 物体 */}
          <g transform={`translate(${bx} ${by}) rotate(${angle}) scale(${boatLen})`}>
            <polygon
              points={riverSkin.outline.map(([x, y]) => `${x},${y}`).join(' ')}
              fill="var(--boat)"
              stroke="var(--boat-edge)"
              strokeWidth={1.5}
              vectorEffect="non-scaling-stroke"
            />
          </g>

          {/* 速度の矢印（1 m/s を 1 m の長さで描く） */}
          {display.sceneArrows && (
            <g>
              <Arrow from={segV2[0]} to={segV2[1]} color="var(--c-v2)" width={3 * k} head={head} />
              <Arrow from={segV1[0]} to={segV1[1]} color="var(--c-v1)" width={3 * k} head={head} />
              {phase.draw > 0 && <Arrow from={segV[0]} to={segV[1]} color="var(--c-v)" width={4 * k} head={head * 1.1} />}
              {canDrag && (
                <>
                  <Handle at={v2Handle} r={px(11)} color="var(--c-v2)" zero={isZero(v2)} drag={dragV2} title="ドラッグで v₂（流れの速度）を変える。上下左右にだけ動く" />
                  <Handle at={v1Tip} r={px(11)} color="var(--c-v1)" drag={dragV1} title="ドラッグで v₁（物体の速度）を変える" />
                </>
              )}
              {placedLabels.map((pl) => (
                <VecLabel key={pl.key} at={pl.center} font={font} {...labelTexts[pl.key]} />
              ))}
            </g>
          )}
        </svg>
      </div>
      <CrossingLog />
    </section>
  );
}

/**
 * 経過時間の表示（仕様 07 §5）。向こう岸に着いたら、渡るのにかかった時間として止める。
 */
function Timer() {
  const s = useAppState();
  const f = s.sim.finished;
  const crossed = f?.reason === 'bank' && s.goal.kind === 'crossBank';
  return (
    <div className={`timer${crossed ? ' done' : ''}`} aria-live="off" role="timer">
      {crossed ? (
        <>
          <span className="timer-label">向こう岸まで</span>
          <span className="timer-value">{f.t.toFixed(1)} s</span>
        </>
      ) : (
        <>
          <span className="timer-label">経過時間</span>
          <span className="timer-value">{s.sim.t.toFixed(1)} s</span>
        </>
      )}
    </div>
  );
}
