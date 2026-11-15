import { test, expect } from "@playwright/test";

for (const path of ["/", "/products", "/products/cloud-blazer"]) {
  test(`商品 API 失敗時可顯示錯誤並重試：${path}`, async ({ page }) => {
    let broken = true;
    await page.route("**/api/products", async (route) => {
      if (broken) {
        await route.fulfill({
          status: 404,
          contentType: "text/plain",
          body: "The page could not be found",
        });
      } else {
        await route.continue();
      }
    });
    await page.goto(path);
    const alert = page.getByRole("alert");
    await expect(alert).toContainText("HTTP 404，/api/products");
    await expect(alert).toContainText("正確轉送至後端");
    await expect(page.getByText("載入商品資料", { exact: true })).toHaveCount(0);

    broken = false;
    await alert.getByRole("button", { name: "重試" }).click();
    await expect(alert).toHaveCount(0);
    if (path === "/") {
      await expect(page.locator(".home-products .product-card")).toHaveCount(4);
    } else if (path === "/products") {
      await expect(page.locator(".product-grid .product-card")).toHaveCount(8);
    } else {
      await expect(page.getByRole("heading", {
        name: "雲感落肩西裝外套", exact: true,
      })).toBeVisible();
    }
  });
}

test("會員設定 API 失敗仍可瀏覽已載入的公開商品", async ({ page }) => {
  await page.route("**/api/config", (route) => route.fulfill({
    status: 503,
    contentType: "application/json",
    body: JSON.stringify({ error: "會員設定暫時無法取得" }),
  }));
  await page.goto("/products");
  await expect(page.locator(".global-error")).toContainText("會員設定暫時無法取得");
  await expect(page.locator(".product-grid .product-card")).toHaveCount(8);
});
