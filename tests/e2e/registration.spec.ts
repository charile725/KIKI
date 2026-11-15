import { test, expect } from "@playwright/test";

test("簡單註冊與登入：暱稱選填、不重複輸入密碼、不強制建立分身", async ({ page }, info) => {
  await page.goto("/auth");
  await expect(page.getByLabel("你的暱稱（選填）")).not.toHaveAttribute("required");
  await expect(page.getByLabel("確認密碼")).toHaveCount(0);
  await expect(page.getByRole("checkbox")).toHaveCount(0);
  const email = `simple-${info.project.name}-${Date.now()}@example.com`;
  await page.getByLabel("電子郵件").fill(email);
  await page.getByLabel("密碼", { exact: true }).fill("123456");
  await page.getByRole("button", { name: "註冊並開始探索" }).click();
  await expect(page).toHaveURL(/\/products$/);
  await page.reload();
  await page.goto("/wardrobe");
  await expect(page.getByRole("link", { name: "建立我的分身", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "登出", exact: true }).click();
  await expect(page).toHaveURL(/\/auth/);
  await page.getByRole("button", { name: "會員登入" }).click();
  await page.getByLabel("電子郵件").fill(email);
  await page.getByLabel("密碼", { exact: true }).fill("123456");
  await page.getByRole("button", { name: "登入 KIKI" }).click();
  await expect(page).toHaveURL(/\/wardrobe$/);
});
