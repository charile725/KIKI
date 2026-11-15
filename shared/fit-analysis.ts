import { fits, type Body, type Fit, type Product } from "./types";

export type FitScore = -2 | -1 | 0 | 1 | 2;
export interface FitMetric {
  key: string;
  label: string;
  score: FitScore | null;
  reason: string;
}

function clampScore(value: number): FitScore {
  return Math.max(-2, Math.min(2, value)) as FitScore;
}

export function analyzeFit(
  product: Product,
  sizeLabel: string,
  preference: Fit = "合身",
  body: Body | null = null,
) {
  const size = product.sizes.find((item) => item.label === sizeLabel);
  const fitScore = clampScore(fits.indexOf(product.fit) - fits.indexOf(preference));
  // Demo rule: compare garment circumference with body circumference plus preferred ease.
  // Each 6 cm difference is one step; this is not a calibrated sizing model.
  const ease: Record<Fit, number> = { 貼身: 4, 合身: 10, 微寬鬆: 16, Oversized: 24 };
  const chest = body?.chest;
  const canCompareChest = size && chest && Number.isFinite(chest) && chest > 0 &&
    Number.isFinite(size.chest) && size.chest > 0 &&
    ["上衣", "外套", "針織"].includes(product.category);
  const chestScore = canCompareChest
    ? clampScore(Math.round((size.chest - chest - ease[preference]) / 6))
    : null;
  const metrics: FitMetric[] = [
    { key: "silhouette", label: "版型", score: fitScore,
      reason: `商品為${product.fit}，以${preference}偏好為基準比較。` },
    { key: "shoulder", label: "肩寬", score: null, reason: "商品尚未提供肩寬尺寸。" },
    { key: "chest", label: "合身度", score: chestScore,
      reason: chestScore === null
        ? "需提供個人胸圍與適用的上身商品尺寸，才能比較合身度。"
        : `商品胸圍 ${size!.chest} cm、你的胸圍 ${chest} cm；${preference}的示範預留量為 ${ease[preference]} cm。` },
    { key: "sleeve", label: "袖長", score: null, reason: "商品尚未提供袖長尺寸。" },
    { key: "length", label: "衣長", score: null,
      reason: size ? `商品衣長 ${size.length} cm；尚無個人理想衣長可供比較。` : "尚未選擇商品尺寸。" },
  ];
  const larger = size && chestScore !== null && chestScore < 0
    ? product.sizes.filter((item) => item.stock > 0 && item.chest > size.chest)
      .sort((a, b) => a.chest - b.chest)[0]
    : undefined;
  const smaller = size && chestScore !== null && chestScore > 0
    ? product.sizes.filter((item) => item.stock > 0 && item.chest < size.chest)
      .sort((a, b) => b.chest - a.chest)[0]
    : undefined;
  const notice = chestScore !== null && chestScore < 0
    ? `目前 ${sizeLabel} 號的胸圍空間較你的偏好小，${larger ? `可比較 ${larger.label} 號的尺寸。` : "目前沒有更大且有庫存的尺寸可供比較。"}`
    : chestScore !== null && chestScore > 0
      ? `目前 ${sizeLabel} 號的胸圍空間較你的偏好大，${smaller ? `可比較 ${smaller.label} 號的尺寸。` : "目前沒有更小且有庫存的尺寸可供比較。"}`
      : fitScore < 0
        ? "此款版型較你的偏好合身，選碼時可留意胸圍與內搭空間。"
        : fitScore > 0
          ? "此款版型較你的偏好寬鬆，搭配時可保留自然的鬆份與層次。"
          : "此款版型符合比較基準；挑選尺寸時，也別忘了預留活動與內搭空間。";
  return { metrics, notice };
}
