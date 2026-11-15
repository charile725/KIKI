import { test, expect } from "@playwright/test";
import sharp from "sharp";
import { mkdir } from "node:fs/promises";
test.beforeEach(async ({ request }) => {
  await request.post("http://127.0.0.1:54329/__reset");
});
test("註冊 → 分身 → 偏好 → 推薦 → 試穿 → 保存 → 重整 → 登入／資料刪除（Supabase contract mock）", async ({
  page,
}, info) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: /先試穿，\s*再心動\s*。/ }),
  ).toBeVisible();
  await mkdir("artifacts", { recursive: true });
  await page.screenshot({
    path: `artifacts/home-${info.project.name}.png`,
    fullPage: true,
  });
  await page.getByRole("link", { name: "建立我的 AI 分身" }).click();
  await page.getByLabel("你的暱稱").fill("小綺");
  await page
    .getByLabel("電子郵件")
    .fill(`kiki-${info.project.name}@example.com`);
  await page.getByLabel("密碼", { exact: true }).fill("StyleDemo2026!");
  await page.getByLabel("確認密碼").fill("StyleDemo2026!");
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "註冊並建立分身" }).click();
  await expect(page).toHaveURL(/\/avatar/);
  const photo = await sharp(
    Buffer.from(
      '<svg width="600" height="900" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="b"><stop stop-color="#9aab94"/><stop offset="1" stop-color="#e3d5c5"/></linearGradient></defs><rect width="600" height="900" fill="url(#b)"/><circle cx="300" cy="160" r="65" fill="#c79874"/><path d="M215 240H385L420 580H180Z" fill="#444c45"/><path d="M215 580H285V850H205ZM315 580H385L395 850H315Z" fill="#727e92"/></svg>',
    ),
  )
    .png()
    .toBuffer();
  await page
    .getByLabel("上傳正面照片")
    .setInputFiles({ name: "front.png", mimeType: "image/png", buffer: photo });
  await page
    .getByLabel("上傳側面照片")
    .setInputFiles({ name: "side.png", mimeType: "image/png", buffer: photo });
  await expect(page.getByAltText("正面照預覽")).toBeVisible();
  await expect(page.getByAltText("側面照預覽")).toBeVisible();
  const confirms = page.getByRole("button", { name: "確認使用這張照片" });
  await confirms.first().click();
  await confirms.first().click();
  await page.getByRole("button", { name: "下一步" }).click();
  await page.getByRole("spinbutton", { name: "身高", exact: true }).fill("168");
  await page.getByRole("spinbutton", { name: "體重", exact: true }).fill("60");
  await page.getByRole("button", { name: /進階身形數據/ }).click();
  await page.getByRole("spinbutton", { name: "胸圍", exact: true }).fill("92");
  await page.getByRole("button", { name: "下一步" }).click();
  await page.getByRole("radio", { name: /微寬鬆/ }).click();
  await page.getByRole("checkbox", { name: /讓穿搭助理/ }).check();
  await page.getByRole("button", { name: "完成，開啟風格旅程" }).click();
  await expect(
    page.getByRole("heading", { name: "認識新的你。" }),
  ).toBeVisible();
  await page.getByRole("link", { name: "開始試穿", exact: true }).click();
  await page
    .getByLabel("向穿搭助理描述需求")
    .fill("我想找一件上台報告適合穿的外套");
  await page.getByRole("button", { name: "送出穿搭需求" }).click();
  await expect(page.locator(".agent-results .product-card")).toHaveCount(3);
  await expect(page.locator(".recommend-reason").first()).toContainText(
    "92 cm",
  );
  await page
    .locator(".agent-results")
    .getByRole("link", { name: "立即試穿" })
    .first()
    .click();
  await expect(page.getByAltText(/的Demo 示意合成結果/)).toBeVisible({
    timeout: 20_000,
  });
  await expect(page.locator(".simulation-note")).toContainText("沒有 AI 生成");
  const analysis = page.getByRole("region", { name: "根據你的偏好分析" });
  await expect(analysis.getByRole("listitem")).toHaveCount(2);
  await expect(analysis.getByRole("listitem").filter({ hasText: "合身度" })).not.toHaveAttribute("aria-label", /資料不足/);
  await analysis.getByRole("button", { name: "完整分析" }).click();
  await expect(analysis.getByRole("listitem")).toHaveCount(5);
  await analysis.getByRole("button", { name: "查看說明" }).click();
  await expect(analysis.locator(".fit-analysis-help")).toContainText("每差 6 cm");
  await page.screenshot({
    path: `artifacts/fitting-${info.project.name}.png`,
    fullPage: true,
  });
  if (info.project.name === "mobile")
    await page.screenshot({ path: "artifacts/mobile-fitting-screen.png" });
  if (info.project.name === "mobile") {
    const actions = page.getByRole("region", { name: "手機試穿操作" });
    const button = actions.getByRole("button", { name: "收藏這套穿搭" });
    const rect = await button.boundingBox(),
      nav = await page.locator(".mobile-bottom-nav").boundingBox();
    expect(rect && nav && rect.y + rect.height <= nav.y).toBeTruthy();
    await button.click();
    await actions.getByRole("link", { name: "前往我的衣櫃" }).click();
  } else {
    await page.getByRole("button", { name: "保存這套穿搭" }).click();
    await expect(
      page.getByRole("button", { name: "已保存至個人衣櫃" }),
    ).toBeVisible();
    await page.getByRole("link", { name: "打開我的衣櫃" }).click();
  }
  await expect(page.locator(".look-card")).toHaveCount(1);
  await page.reload();
  await expect(page.locator(".look-card")).toHaveCount(1);
  await page.screenshot({
    path: `artifacts/wardrobe-${info.project.name}.png`,
    fullPage: true,
  });
  if (info.project.name === "mobile") {
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
    await page.screenshot({ path: "artifacts/mobile-wardrobe-screen.png" });
  }
  await page.getByRole("link", { name: "繼續探索風格" }).click();
  await page
    .getByRole("button", { name: "收藏雲感落肩西裝外套", exact: true })
    .last()
    .click();
  await page.goto("/wardrobe");
  await page.getByRole("button", { name: /喜歡的商品/ }).click();
  await expect(page.locator(".wardrobe-products .product-card")).toHaveCount(1);
  await page.getByRole("button", { name: "登出", exact: true }).click();
  await expect(page).toHaveURL(/\/auth/);
  await page.getByRole("button", { name: "會員登入" }).click();
  await page
    .getByLabel("電子郵件")
    .fill(`kiki-${info.project.name}@example.com`);
  await page.getByLabel("密碼", { exact: true }).fill("StyleDemo2026!");
  await page.getByRole("button", { name: "登入 KIKI" }).click();
  await expect(page).toHaveURL(/\/wardrobe/);
  await expect(page.getByAltText("我的分身正面照片")).toBeVisible();
  if (info.project.name === "mobile")
    await page.locator(".wardrobe-settings>summary").click();
  await page.getByRole("button", { name: "刪除照片與分身資料" }).click();
  await page.getByRole("button", { name: "確認刪除", exact: true }).click();
  await expect(
    page.getByRole("link", { name: "建立我的分身", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: /試穿紀錄/ }).click();
  await expect(page.locator(".look-card")).toHaveCount(0);
  await page.getByRole("button", { name: /喜歡的商品/ }).click();
  await expect(page.locator(".wardrobe-products .product-card")).toHaveCount(1);
  await expect(page.locator("body")).not.toHaveJSProperty("scrollWidth", 0);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  ).toBe(true);
  expect(errors).toEqual([]);
});

test("版型分析：未登入時採用公開基準、缺失數據與窄螢幕不溢出", async ({ page }, info) => {
  await page.goto("/products/cloud-blazer");
  const analysis = page.getByRole("region", { name: "商品版型分析" });
  await expect(analysis.getByRole("listitem")).toHaveCount(5);
  await expect(analysis.getByRole("listitem").first()).toHaveAttribute("aria-label", /版型：\+1/);
  await expect(analysis.getByRole("listitem").filter({ hasText: "合身度" })).toHaveAttribute("aria-label", /資料不足/);
  await expect(analysis).toContainText("以「合身」偏好為比較基準");
  await page.locator(".size-options").getByRole("button", { name: "M", exact: true }).click();
  await expect(analysis.locator(".fit-analysis-context")).toContainText("M 號");
  await expect(analysis.locator(".fit-analysis-details")).toContainText("商品衣長 73 cm");
  await analysis.getByRole("button", { name: "查看說明" }).click();
  await expect(analysis.locator(".fit-analysis-help")).toBeVisible();
  await analysis.getByRole("button", { name: "查看說明" }).click();
  await mkdir("artifacts", { recursive: true });
  await analysis.screenshot({
    path: `artifacts/fit-analysis-${info.project.name}.png`,
    style: ".header, .mobile-bottom-nav { visibility: hidden; }",
  });
  if (info.project.name === "mobile") await page.setViewportSize({ width: 320, height: 568 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  await analysis.getByRole("button", { name: "收合分析" }).click();
  await expect(analysis.getByRole("listitem")).toHaveCount(2);
  await analysis.getByRole("button", { name: "完整分析" }).click();
  await expect(analysis.getByRole("listitem")).toHaveCount(5);
});
test("商品篩選與手機選單", async ({ page }, info) => {
  await page.goto("/products");
  if (info.project.name !== "mobile")
    await page.getByRole("button", { name: "收合穿搭助理" }).click();
  await page.getByLabel("搜尋商品").fill("不存在的商品");
  await expect(
    page.getByRole("heading", { name: "還沒找到這個風格" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "清除篩選" }).click();
  await expect(page.locator(".product-grid .product-card")).toHaveCount(8);
  if (info.project.name === "mobile") {
    await page.getByRole("button", { name: "開啟選單" }).click();
    await expect(
      page.getByRole("navigation", { name: "主選單" }),
    ).toBeVisible();
  }
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  ).toBe(true);
});
test("照片缺漏、格式、解析度與相機拒絕／倒數拍攝（測試畫面串流）", async ({
  page,
}, info) => {
  await page.goto("/auth");
  await page.getByLabel("你的暱稱").fill("相機測試");
  await page
    .getByLabel("電子郵件")
    .fill(`camera-${info.project.name}@example.com`);
  await page.getByLabel("密碼", { exact: true }).fill("CameraTest2026!");
  await page.getByLabel("確認密碼").fill("CameraTest2026!");
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "註冊並建立分身" }).click();
  await expect(page).toHaveURL(/\/avatar/);
  await page.getByRole("button", { name: "下一步" }).click();
  await expect(page.getByRole("alert")).toContainText("請先提供正面與側面照片");
  await page.getByLabel("上傳正面照片").setInputFiles({
    name: "bad.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("bad"),
  });
  await expect(page.locator(".photo-error")).toContainText("請使用 JPG");
  const small = await sharp({
    create: { width: 100, height: 100, channels: 3, background: "#888" },
  })
    .png()
    .toBuffer();
  await page
    .getByLabel("上傳正面照片")
    .setInputFiles({ name: "small.png", mimeType: "image/png", buffer: small });
  await expect(page.locator(".photo-error")).toContainText("解析度太低");
  await page.evaluate(() => {
    Object.defineProperty(navigator.mediaDevices, "getUserMedia", {
      configurable: true,
      value: () =>
        Promise.reject(new DOMException("test denied", "NotAllowedError")),
    });
  });
  await page.getByRole("button", { name: "拍攝", exact: true }).first().click();
  await expect(page.getByRole("dialog")).toContainText("相機權限被拒絕");
  await page.getByRole("button", { name: "關閉視窗" }).click();
  await page.evaluate(() => {
    Object.defineProperty(navigator.mediaDevices, "getUserMedia", {
      configurable: true,
      value: () => {
        const canvas = document.createElement("canvas");
        canvas.width = 640;
        canvas.height = 960;
        const ctx = canvas.getContext("2d")!;
        const gradient = ctx.createLinearGradient(0, 0, 640, 960);
        gradient.addColorStop(0, "#647c61");
        gradient.addColorStop(1, "#f0ded1");
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, 640, 960);
        ctx.fillStyle = "#cba27d";
        ctx.beginPath();
        ctx.arc(320, 180, 70, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#444c42";
        ctx.fillRect(220, 270, 200, 400);
        return Promise.resolve(canvas.captureStream(10));
      },
    });
  });
  await page.getByRole("button", { name: "拍攝", exact: true }).first().click();
  await page.getByRole("button", { name: "3 秒倒數拍攝" }).click();
  await expect(page.locator(".countdown")).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0, { timeout: 10000 });
  await expect(page.getByAltText("正面照預覽")).toBeVisible();
  await page.getByRole("button", { name: "確認使用這張照片" }).click();
  await expect(page.locator(".photo-card").first()).toContainText("已確認");
});
