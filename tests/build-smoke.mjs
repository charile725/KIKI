// 以建置產物測試本機 Node 靜態服務；刻意不連接任何 Supabase 專案。
import { spawn } from "node:child_process";
import assert from "node:assert/strict";
import { chromium } from "@playwright/test";
const origin = "http://127.0.0.1:3219";
const server = spawn(process.execPath, ["--import", "tsx", "server/index.ts"], {
  env: {
    ...process.env,
    PORT: "3219",
    APP_ORIGIN: origin,
    SUPABASE_URL: "",
    SUPABASE_PUBLISHABLE_KEY: "",
    TRYON_MODE: "demo",
    RECOMMENDATION_MODE: "demo",
  },
  stdio: "pipe",
});
let logs = "";
server.stdout.on("data", (b) => (logs += b));
server.stderr.on("data", (b) => (logs += b));
let browser;
try {
  let ready = false;
  for (let i = 0; i < 50; i++) {
    try {
      ready = (await fetch(origin + "/api/health")).ok;
      if (ready) break;
    } catch {
      /* wait for owned server */
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  assert.ok(ready, logs);
  const config = await (await fetch(origin + "/api/config")).json();
  assert.equal(config.configured, false);
  assert.equal(config.supabaseKey, "");
  assert.equal((await fetch(origin + "/.env")).status, 404);
  assert.equal((await fetch(origin + "/server/index.ts")).status, 404);
  browser = await chromium.launch({ channel: "chrome" });
  const page = await browser.newPage({
    viewport: { width: 1280, height: 900 },
  });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(origin);
  await page.getByRole("heading", { name: /先試穿/ }).waitFor();
  await page
    .getByText("本機預覽 · 尚未連接 Supabase", { exact: false })
    .waitFor();
  await page.goto(origin + "/products/cloud-blazer");
  await page
    .getByRole("heading", { name: "雲感落肩西裝外套", exact: true })
    .waitFor();
  assert.equal(await page.locator("table tbody tr").count(), 3);
  await page.goto(origin + "/wardrobe");
  await page.waitForURL(/\/auth/);
  await page
    .getByText("先連接你的 Supabase 測試專案", { exact: true })
    .waitFor();
  assert.equal(
    await page.getByRole("button", { name: "註冊並建立分身" }).isDisabled(),
    true,
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(origin);
  const nav = page.getByRole("navigation", { name: "手機底部導覽" });
  await nav.waitFor();
  assert.equal(await nav.getByRole("link").count(), 5);
  await nav.getByRole("link", { name: "AI 穿搭", exact: true }).click();
  await page.getByLabel("向穿搭助理描述需求").waitFor();
  assert.deepEqual(errors, []);
  console.log(
    "PASS: 建置產物、桌機／手機動態頁面與底部導覽、未設定提示、私人頁面保護與秘密檔案拒絕存取。",
  );
} finally {
  await browser?.close();
  server.kill();
}
