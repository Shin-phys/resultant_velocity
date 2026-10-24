import type { Vec } from '../../model/vector';
import { fy } from './svg';

/** ドラッグ用のハンドル。0 ベクトルのつまみはひし形で示す。 */
export function Handle(props: { at: Vec; r: number; color: string; zero?: boolean; drag: object; title: string }) {
  const { at, r, color, zero, drag, title } = props;
  const [x, y] = fy(at);
  const common = {
    className: 'handle',
    fill: color,
    fillOpacity: zero ? 0.3 : 0.18,
    stroke: color,
    strokeWidth: 2,
    vectorEffect: 'non-scaling-stroke' as const,
    ...drag,
  };
  return zero ? (
    <rect {...common} x={x - r * 0.75} y={y - r * 0.75} width={r * 1.5} height={r * 1.5} transform={`rotate(45 ${x} ${y})`}>
      <title>{title}</title>
    </rect>
  ) : (
    <circle {...common} cx={x} cy={y} r={r}>
      <title>{title}</title>
    </circle>
  );
}
