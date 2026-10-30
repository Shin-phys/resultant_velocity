import { formatLength, type Vec } from '../../model/vector';
import { besideSegment, beyondTip, textEm, type LabelRequest } from './labelLayout';
import { fy } from './svg';

/** 数値部分の文字の大きさ（記号に対する比） */
const VALUE_SCALE = 0.82;

/** 「v₁ = 4.0 m/s」のラベルの中身 */
export interface VecLabelText {
  sym: string;
  /** 数値（「= 4.0 m/s」）。出さないときは null */
  value: string | null;
}

export const vecLabelText = (sym: string, vec: Vec, showValue: boolean): VecLabelText => ({
  sym,
  value: showValue ? `= ${formatLength(vec)} m/s` : null,
});

/** ラベルの幅と高さ（世界座標） */
export function vecLabelSize(t: VecLabelText, font: number): { w: number; h: number } {
  const em = textEm(t.sym) + (t.value ? 0.25 + textEm(t.value) * VALUE_SCALE : 0);
  return { w: em * font + font * 0.3, h: font * 1.15 };
}

/**
 * 矢印のラベルの置き場所の候補を作る。
 * 線の横（中点から端へ）→ 先端の先 の順。side は先に試す側。
 */
export function vecLabelRequest(
  key: string,
  t: VecLabelText,
  font: number,
  from: Vec,
  to: Vec,
  side: Vec | null,
  preferTip = false,
  tipClear = 0,
): LabelRequest {
  const { w, h } = vecLabelSize(t, font);
  const gap = font * 0.3;
  const beside = besideSegment(from, to, w, h, gap, side);
  const tip = beyondTip(from, to, w, h, gap, tipClear);
  return { key, w, h, candidates: preferTip ? [...tip, ...beside] : [...beside, ...tip] };
}

/** ラベルを描く。記号は太字、数値は少し小さく */
export function VecLabel({ at, t, color, font }: { at: Vec; t: VecLabelText; color: string; font: number }) {
  const [x, y] = fy(at);
  return (
    <text
      x={x}
      y={y}
      fill={color}
      fontSize={font}
      textAnchor="middle"
      dominantBaseline="central"
      className="svg-label"
      // 文字の縁取りは世界座標で指定する（tspan には non-scaling-stroke が効かないため）
      style={{ strokeWidth: font * 0.22, vectorEffect: 'none' }}
    >
      <tspan fontWeight={700}>{t.sym}</tspan>
      {t.value && (
        <tspan fontSize={font * VALUE_SCALE} fontWeight={600} dx={font * 0.25}>
          {t.value}
        </tspan>
      )}
    </text>
  );
}
