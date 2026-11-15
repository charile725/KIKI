import { test } from "node:test";
import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { createClient } from "@supabase/supabase-js";
import { chromium } from "@playwright/test";
import sharp from "sharp";
import handler from "../../api/index";

test("真實 Supabase：瀏覽器註冊登入、資料保存、雙帳號 RLS 與私人 Storage", {
  skip: !process.env.SUPABASE_SECRET_KEY ? "需要明確載入後端管理金鑰" : false,
  timeout: 120_000,
}, async () => {
  const url = process.env.SUPABASE_URL!;
  const options = { auth: { persistSession: false, autoRefreshToken: false } };
  const admin = createClient(url, process.env.SUPABASE_SECRET_KEY!, options);
  const a = createClient(url, process.env.SUPABASE_PUBLISHABLE_KEY!, options);
  const b = createClient(url, process.env.SUPABASE_PUBLISHABLE_KEY!, options);
  const emails = [`kiki-check-${randomUUID()}@example.com`, `kiki-check-${randomUUID()}@example.com`];
  const password = randomBytes(3).toString("hex");
  const ids: string[] = [];
  let photoPath = "";
  const app = createServer(handler);
  await new Promise<void>((resolve) => app.listen(0, "127.0.0.1", resolve));
  const origin = `http://127.0.0.1:${(app.address() as AddressInfo).port}`;
  const previousOrigin = process.env.APP_ORIGIN;
  process.env.APP_ORIGIN = origin;
  const browser = await chromium.launch({ channel: "chrome" });
  try {
    const configResponse = await fetch(origin + "/api/config");
    const config = await configResponse.text();
    assert.equal(JSON.parse(config).instantSignup, true);
    assert.equal(config.includes(process.env.SUPABASE_SECRET_KEY!), false);
    const products = await (await fetch(origin + "/api/products")).json();
    assert.equal(products.source, "supabase");
    assert.ok(products.products.length >= 8);

    const page = await browser.newPage();
    const pageErrors: string[] = [];
    page.on("pageerror", (error) => pageErrors.push(error.message));
    await page.goto(origin + "/auth");
    assert.equal(await page.getByLabel("確認密碼").count(), 0);
    assert.equal(await page.getByRole("checkbox").count(), 0);
    await page.getByLabel("電子郵件").fill(emails[0]);
    await page.getByLabel("密碼", { exact: true }).fill(password);
    await page.getByRole("button", { name: "註冊並開始探索" }).click();
    await page.waitForURL(origin + "/products", { timeout: 30_000 });
    const loginA = await a.auth.signInWithPassword({ email: emails[0], password });
    assert.equal(loginA.error, null);
    const userA = loginA.data.user!;
    ids.push(userA.id);
    assert.ok(userA.email_confirmed_at);
    const profile = await a.from("kiki_profiles").select("*").single();
    assert.equal(profile.error, null);
    assert.equal(profile.data.user_id, userA.id);
    const favorite = await a.from("kiki_favorites").insert({ user_id: userA.id, product_id: "cloud-blazer" });
    assert.equal(favorite.error, null);
    await page.reload();
    await page.goto(origin + "/wardrobe");
    await page.getByRole("link", { name: "建立我的分身", exact: true }).waitFor();
    await page.getByRole("button", { name: /喜歡的商品/ }).click();
    await page.locator(".wardrobe-products .product-card").waitFor();
    await page.getByRole("button", { name: "登出", exact: true }).click();
    await page.waitForURL(/\/auth/);
    await page.getByRole("button", { name: "會員登入" }).click();
    await page.getByLabel("電子郵件").fill(emails[0]);
    await page.getByLabel("密碼", { exact: true }).fill(password);
    await page.getByRole("button", { name: "登入 KIKI" }).click();
    await page.waitForURL(origin + "/wardrobe");
    assert.deepEqual(pageErrors, []);

    const createdB = await admin.auth.admin.createUser({ email: emails[1], password, email_confirm: true });
    assert.equal(createdB.error, null);
    ids.push(createdB.data.user!.id);
    assert.equal((await b.auth.signInWithPassword({ email: emails[1], password })).error, null);
    for (const table of ["kiki_profiles", "kiki_avatars", "kiki_favorites", "kiki_tryons", "kiki_outfits"]) {
      const other = await b.from(table).select("*").eq("user_id", userA.id);
      assert.equal(other.error, null);
      assert.deepEqual(other.data, []);
    }
    const overwrite = await b.from("kiki_profiles").update({ display_name: "not-owner" }).eq("user_id", userA.id).select();
    assert.equal(overwrite.error, null);
    assert.deepEqual(overwrite.data, []);
    const image = await sharp({ create: { width: 10, height: 10, channels: 3, background: "#8ba185" } }).png().toBuffer();
    photoPath = `${userA.id}/photos/${randomUUID()}.png`;
    assert.equal((await a.storage.from("kiki-private").upload(photoPath, image, { contentType: "image/png" })).error, null);
    assert.equal((await a.storage.from("kiki-private").download(photoPath)).error, null);
    assert.ok((await b.storage.from("kiki-private").download(photoPath)).error);
    assert.equal((await fetch(`${url}/storage/v1/object/public/kiki-private/${photoPath}`)).ok, false);
    assert.ok((await b.auth.signInWithPassword({ email: emails[0], password: password + "wrong" })).error);
    console.log("PASS: 真實註冊免驗證信、六碼密碼、登入保持、重新登入、收藏保存、跨帳號讀寫隔離與私人照片存取。");
  } finally {
    await browser.close();
    if (photoPath) assert.equal((await admin.storage.from("kiki-private").remove([photoPath])).error, null);
    // Only remove randomly named accounts created by this test, including partial runs.
    const users = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    assert.equal(users.error, null);
    for (const user of users.data.users)
      if (emails.includes(user.email || "") && !ids.includes(user.id)) ids.push(user.id);
    for (const id of ids) assert.equal((await admin.auth.admin.deleteUser(id)).error, null);
    await Promise.all([a.auth.signOut({ scope: "local" }), b.auth.signOut({ scope: "local" })]);
    await new Promise<void>((resolve) => app.close(() => resolve()));
    if (previousOrigin === undefined) delete process.env.APP_ORIGIN;
    else process.env.APP_ORIGIN = previousOrigin;
  }
});
