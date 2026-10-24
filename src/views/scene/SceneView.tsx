import { useMemo, useRef, useState, type CSSProperties } from 'react';
import { acrossAxis, banks, FLOW_UNIT } from '../../model/kinematics';
import { fitAspect, viewportFor } from '../../model/viewport';
import { add, collinearNormal, isZero, scale, snap, sub, type Vec } from '../../model/vector';
import { riverSkin } from '../../skins/river';
import { useAppState, useDispatch, v2Of } from '../../state/store';
import { Arrow, fy, useElementSize } from '../common/svg';
import { useDrag } from '../common/useDrag';
import { FlowControls } from './FlowControls';

/** ① 場面ビュー（仕様 03）。上から見た平面図。 */
export function SceneView() {
  const s = useAppState();
  const dispatch = useDispatch();
  const [boxRef, size] = useElementSize<HTMLDivElement>();
  const svgRef = useRef<SVGSVGElement>(null);

  const v1 = s.v1;
  const v2 = v2Of(s);
  const v = add(v1, v2);
  const { sim, goal, flowDir, display } = s;
  const a = acrossAxis(flowDir);
  const [lo, hi] = banks(goal);
  const k = s.presentation ? 1.5 : 1;

  // 表示範囲：軌跡が範囲外に出たときも収まるように、軌跡の端も含める
  const extra = useMemo(() => {
    const pts: Vec[] = [sim.pos];
    for (const p of sim.groundTrail) pts.push(p);
    return pts;
  }, [sim.pos, sim.groundTrail]);
  const computed = viewportFor(goal, flowDir, v1, v2, extra);
  // ドラッグ中は表示範囲を固定する（範囲が変わるとハンドルが指から逃げるため）
  const [frozen, setFrozen] = useState<typeof computed | null>(null);
  const base = frozen ?? computed;
  const box = size.w > 0 && size.h > 0 ? fitAspect(base, size.w / size.h) : base;
  const W = box.xMax - box.xMin;
  const H = box.yMax - box.yMin;
  /** 1 px あたりの長さ [m] */
  const U = size.w > 0 ? W / size.w : W / 600;

  const head = 12 * k * U;
  const font = 14 * k * U;
  const boatLen = Math.max(1.4, 30 * k * U);

  // 川の帯（横断方向は岸の間、流れの方向は画面いっぱい）
  const riverRect =
    a === 1
      ? { x: box.xMin, y: -hi, width: W, height: hi - lo }
      : { x: lo, y: -box.yMax, width: hi - lo, height: H };

  // 地面の目盛り線
  const gridLines = useMemo(() => {
    const lines: { x1: number; y1: number; x2: number; y2: number; strong: boolean }[] = [];
    for (let x = Math.ceil(box.xMin); x <= box.xMax; x++)
      lines.push({ x1: x, y1: -box.yMax, x2: x, y2: -box.yMin, strong: x % 5 === 0 });
    for (let y = Math.ceil(box.yMin); y <= box.yMax; y++)
      lines.push({ x1: box.xMin, y1: -y, x2: box.xMax, y2: -y, strong: y % 5 === 0 });
    return lines;
  }, [box.xMin, box.xMax, box.yMin, box.yMax]);

  // 岸に沿った目盛りの数字（5 m ごと）
  const bankLabels = useMemo(() => {
    const out: { p: Vec; text: string }[] = [];
    const b = 1 - a;
    const min = b === 0 ? box.xMin : box.yMin;
    const max = b === 0 ? box.xMax : box.yMax;
    for (let t = Math.ceil(min / 5) * 5; t <= max; t += 5) {
      for (const [edge, side] of [
        [lo, -1],
        [hi, 1],
      ] as const) {
        const off = side * font * 0.9;
        const p: [number, number] = [0, 0];
        p[b] = t;
        p[a] = edge + off;
        out.push({ p, text: `${t}` });
      }
    }
    return out;
  }, [a, box.xMin, box.xMax, box.yMin, box.yMax, lo, hi, font]);

  // 媒質シートのずれ（タイルの大きさで割った余り）
  const T = riverSkin.tile;
  const sx = ((sim.sheet[0] % T) + T) % T;
  const sy = ((-sim.sheet[1] % T) + T) % T;

  // 船首の向き（v₁ が 0 のときは横断方向）
  const headingVec: Vec = isZero(v1) ? (a === 1 ? [0, 1] : [1, 0]) : v1;
  const angle = (-Math.atan2(headingVec[1], headingVec[0]) * 180) / Math.PI;
  const [bx, by] = fy(sim.pos);

  const v1Tip = add(sim.pos, v1);
  // 同一直線上（段階1）のときは矢印を少しずらして重ならないようにする
  const nrm = collinearNormal(v1, v2);
  const offV2: Vec = nrm ? scale(nrm, font * 0.8) : [0, 0];
  const offV: Vec = nrm ? scale(nrm, -font * 0.8) : [0, 0];
  const drag = useDrag(svgRef, {
    onStart: () => setFrozen(computed),
    onEnd: () => setFrozen(null),
    onMove: (p) => dispatch({ type: 'setV1', v: snap(sub(p, sim.pos)) }),
  });

  const mediumPts = sim.mediumTrail.map((p) => fy(add(p, sim.sheet)).join(',')).join(' ');
  const groundPts = sim.groundTrail.map((p) => fy(p).join(',')).join(' ');
  const waterStart = fy(sim.sheet);

  return (
    <section className="pane scene-pane" aria-label="① 場面">
      <header className="pane-head">
        <h2>① 場面</h2>
        <FlowControls />
      </header>
      <div
        className="scene-box"
        ref={boxRef}
        style={
          {
            // 狭い画面では、川の縦横比に合わせて高さを決める（CSS 側で使う）
            '--scene-h': `${Math.round(Math.max(220, Math.min(440, size.w * ((base.yMax - base.yMin) / (base.xMax - base.xMin)))))}px`,
          } as CSSProperties
        }
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
            p1[1 - a] = a === 1 ? box.xMin : box.yMin;
            p2[1 - a] = a === 1 ? box.xMax : box.yMax;
            const [x1, y1] = fy(p1);
            const [x2, y2] = fy(p2);
            return <line key={edge} x1={x1} y1={y1} x2={x2} y2={y2} stroke="var(--bank)" strokeWidth={3 * k} vectorEffect="non-scaling-stroke" />;
          })}
          {bankLabels.map(({ p, text }, i) => {
            const [x, y] = fy(p);
            return (
              <text key={i} x={x} y={y} fontSize={font * 0.8} fill="var(--muted)" textAnchor="middle" dominantBaseline="middle">
                {text}
              </text>
            );
          })}

          {/* 出発点 */}
          <circle cx={0} cy={0} r={5 * k * U} fill="none" stroke="var(--text)" strokeWidth={1.5} vectorEffect="non-scaling-stroke" />

          {/* 媒質に対する軌跡（シートと一緒に流れる） */}
          {display.mediumTrail && sim.t > 0 && (
            <g clipPath="url(#river-clip)">
              <polyline points={mediumPts} fill="none" stroke="var(--c-v1)" strokeWidth={2 * k} strokeDasharray={`${3 * k} ${4 * k}`} vectorEffect="non-scaling-stroke" />
              <circle cx={waterStart[0]} cy={waterStart[1]} r={5 * k * U} fill="none" stroke="var(--c-v1)" strokeWidth={2} vectorEffect="non-scaling-stroke" />
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

          {/* 地面に対する軌跡 */}
          {display.groundTrail && sim.t > 0 && (
            <polyline points={groundPts} fill="none" stroke="var(--c-v)" strokeWidth={2.5 * k} vectorEffect="non-scaling-stroke" />
          )}
          {display.strobes &&
            sim.strobes.map((p, i) => {
              const [x, y] = fy(p);
              return <circle key={i} cx={x} cy={y} r={3.5 * k * U} fill="var(--c-v)" />;
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
              <Arrow from={add(sim.pos, offV2)} to={add(add(sim.pos, v2), offV2)} color="var(--c-v2)" width={3 * k} head={head} label="v₂" fontSize={font} />
              <Arrow from={sim.pos} to={v1Tip} color="var(--c-v1)" width={3 * k} head={head} label="v₁" fontSize={font} />
              <Arrow from={add(sim.pos, offV)} to={add(add(sim.pos, v), offV)} color="var(--c-v)" width={4 * k} head={head * 1.1} label="v" fontSize={font} />
              <circle
                className="handle"
                cx={fy(v1Tip)[0]}
                cy={fy(v1Tip)[1]}
                r={11 * k * U}
                fill="var(--c-v1)"
                fillOpacity={0.18}
                stroke="var(--c-v1)"
                strokeWidth={2}
                vectorEffect="non-scaling-stroke"
                {...drag}
              >
                <title>ドラッグで v₁（物体の速度）を変える</title>
              </circle>
            </g>
          )}

          {/* 流れの向きの表示（左上） */}
          <FlowBadge
            at={[box.xMin + font * 0.8, box.yMax - font * 1.2]}
            dir={FLOW_UNIT[flowDir]}
            speed={s.flowSpeed}
            font={font}
            head={head}
            k={k}
          />
        </svg>
      </div>
    </section>
  );
}

function FlowBadge({ at, dir, speed, font, head, k }: { at: Vec; dir: Vec; speed: number; font: number; head: number; k: number }) {
  const [x, y] = fy(at);
  const len = font * 2.4;
  const c: Vec = [at[0] + font * 6.6, at[1]];
  return (
    <g>
      <text x={x} y={y} fontSize={font} fill="var(--c-v2)" dominantBaseline="middle" fontWeight={700} className="svg-label">
        流れ {speed} m/s
      </text>
      {speed > 0 && (
        <Arrow
          from={[c[0] - (dir[0] * len) / 2, c[1] - (dir[1] * len) / 2]}
          to={[c[0] + (dir[0] * len) / 2, c[1] + (dir[1] * len) / 2]}
          color="var(--c-v2)"
          width={3 * k}
          head={head}
        />
      )}
    </g>
  );
}
