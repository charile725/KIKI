import { test } from "node:test";
import assert from "node:assert/strict";
import { analyzeFit } from "../shared/fit-analysis";
import { catalog } from "../shared/catalog";

const blazer = catalog[0];
const body = { height: 168, weight: 60, chest: 92 };
const chestScore = (size: string) => analyzeFit(blazer, size, "微寬鬆", body).metrics[2].score;

test("胸圍分析隨尺寸變更，正負方向符合鬆緊且限制在五個刻度", () => {
  assert.equal(chestScore("S"), -1);
  assert.equal(chestScore("M"), 0);
  assert.equal(chestScore("L"), 1);
  assert.equal(analyzeFit(blazer, "S", "Oversized", { ...body, chest: 150 }).metrics[2].score, -2);
  assert.equal(analyzeFit(blazer, "L", "貼身", { ...body, chest: 60 }).metrics[2].score, 2);
});

test("未知與不足的資料不評分，不能把未提供的數據顯示成完全匹配", () => {
  const result = analyzeFit(blazer, "S");
  assert.equal(result.metrics[0].score, 1);
  assert.ok(result.metrics.slice(1).every((metric) => metric.score === null));
  assert.equal(analyzeFit(blazer, "unknown", "合身", body).metrics[2].score, null);
  assert.equal(analyzeFit(blazer, "S", "合身", { ...body, chest: NaN }).metrics[2].score, null);
  assert.equal(analyzeFit({ ...blazer, category: "褲裝" }, "S", "合身", body).metrics[2].score, null);
});

test("提醒僅推薦有庫存且胸圍方向合適的尺寸，無選項時不建議不存在的尺寸", () => {
  assert.match(analyzeFit(blazer, "S", "微寬鬆", body).notice, /可比較 M 號/);
  assert.match(analyzeFit(blazer, "L", "微寬鬆", body).notice, /可比較 M 號/);
  const noLarger = { ...blazer, sizes: blazer.sizes.map((size) => ({ ...size, stock: size.label === "S" ? 1 : 0 })) };
  assert.match(analyzeFit(noLarger, "S", "微寬鬆", body).notice, /沒有更大且有庫存/);
});
