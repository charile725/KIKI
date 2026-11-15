import sharp from "sharp";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { z } from "zod";
import type { Product, Profile } from "../shared/types.js";

export interface TryonInput {
  photo: Buffer;
  product: Product;
  size: string;
  color: string;
  profile: Profile;
}
export interface TryonAdapter {
  generate(input: TryonInput): Promise<Buffer>;
}
export class DemoTryonAdapter implements TryonAdapter {
  async generate({ photo, product }: TryonInput): Promise<Buffer> {
    // 明確為照片 + 商品示意圖疊合；沒有姿態辨識、去背或人體重建。
    const base = await sharp(photo, { limitInputPixels: 40_000_000 })
      .rotate()
      .resize(700, 900, { fit: "contain", background: "#e8e5dd" })
      .toBuffer();
    const garment = await sharp(await garmentAsset(product))
      .resize(360, 389)
      .png()
      .toBuffer();
    const label = Buffer.from(
      '<svg width="700" height="70"><rect width="700" height="70" fill="#222b24" fill-opacity=".9"/><text x="24" y="43" fill="#e0eabd" font-family="sans-serif" font-size="19">KIKI / DEMO COMPOSITE / NOT AI GENERATED</text></svg>',
    );
    return sharp(base)
      .composite([
        { input: garment, top: 265, left: 170 },
        { input: label, top: 830, left: 0 },
      ])
      .webp({ quality: 87 })
      .toBuffer();
  }
}
async function garmentAsset(product: Product) {
  // 商品圖片只讀取專案白名單內的本機素材，避免路徑穿越與 SSRF。
  if (!/^\/products\/[a-z0-9-]+\.svg$/.test(product.image))
    throw new Error("商品素材不在支援的圖片清單中。");
  return readFile(resolve("public", product.image.slice(1)));
}
export class HttpTryonAdapter implements TryonAdapter {
  async generate({
    photo,
    product,
    size,
    color,
    profile,
  }: TryonInput): Promise<Buffer> {
    if (!profile.external_ai_consent)
      throw new Error("請先在衣櫃設定授權將照片傳送至外部 AI 服務。");
    if (!process.env.AI_TRYON_URL || !process.env.AI_TRYON_KEY)
      throw new Error("尚未完成正式試穿 API 設定。");
    const response = await fetch(process.env.AI_TRYON_URL, {
      method: "POST",
      signal: AbortSignal.timeout(60000),
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.AI_TRYON_KEY}`,
      },
      body: JSON.stringify({
        person_image_base64: photo.toString("base64"),
        garment_image_base64: (await garmentAsset(product)).toString("base64"),
        garment_mime: "image/svg+xml",
        product_id: product.id,
        size,
        color,
      }),
    });
    if (!response.ok) throw new Error("AI 試穿服務目前無法回應，請重試。");
    const text = await boundedResponse(response, 20_000_000);
    const result = z
      .object({
        image_base64: z.string().max(19_000_000),
        mime_type: z.enum(["image/jpeg", "image/png", "image/webp"]),
      })
      .parse(JSON.parse(text));
    return sharp(Buffer.from(result.image_base64, "base64"), {
      limitInputPixels: 40_000_000,
    })
      .rotate()
      .resize(1400, 1800, { fit: "inside", withoutEnlargement: true })
      .webp({ quality: 88 })
      .toBuffer();
  }
}
export async function boundedResponse(
  response: Response,
  limit: number,
): Promise<string> {
  const reader = response.body?.getReader();
  if (!reader) throw new Error("AI 服務沒有回傳內容。");
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.length;
      if (length > limit) throw new Error("AI 回傳的圖片過大。");
      chunks.push(value);
    }
  } finally {
    await reader.cancel();
  }
  return Buffer.concat(chunks).toString("utf8");
}
export function getTryonAdapter(): TryonAdapter {
  return process.env.TRYON_MODE === "ai"
    ? new HttpTryonAdapter()
    : new DemoTryonAdapter();
}
