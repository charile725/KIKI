import { test, expect } from "@playwright/test";

test("主機回傳文字錯誤頁時顯示路由提示，重試後可恢復", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  let broken = true;
  await page.route("**/api/config", async (route) => {
    if (broken) {
      await route.fulfill({ status: 404, contentType: "text/plain", body: "The page could not be found" });
    } else {
      await route.continue();
    }
  });
  await page.goto("/");
  const alert = page.locator(".global-error").getByRole("alert");
  await expect(alert).toContainText("HTTP 404，/api/config");
  await expect(alert).toContainText("正確轉送至後端");
  await expect(alert).not.toContainText("Unexpected token");
  broken = false;
  await alert.getByRole("button").click();
  await expect(page.locator(".global-error")).toHaveCount(0);
  await page.goto("/products/cloud-blazer");
  await expect(page.getByRole("heading", { name: "雲感落肩西裝外套", exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});
