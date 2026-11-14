import { test, expect } from "@playwright/test";
import { mkdir } from "node:fs/promises";
test("手機優先：窄螢幕、首屏入口、底部導覽與鍵盤避讓", async ({
  page,
}, info) => {
  test.skip(info.project.name !== "mobile", "此案例專門驗證手機版");
  await mkdir("artifacts", { recursive: true });
  for (const [width, height] of [
    [320, 568],
    [360, 740],
    [390, 844],
    [430, 932],
  ]) {
    await page.setViewportSize({ width, height });
    await page.goto("/");
    const nav = page.getByRole("navigation", { name: "手機底部導覽" });
    await expect(nav).toBeVisible();
    await expect(nav.getByRole("link")).toHaveCount(5);
    const cta = await page
      .getByRole("link", { name: "建立我的 AI 分身" })
      .boundingBox();
    const bounds = await nav.boundingBox();
    expect(cta && bounds && cta.y + cta.height <= bounds.y).toBeTruthy();
    for (const link of await nav.getByRole("link").all()) {
      const box = await link.boundingBox();
      expect(box!.height).toBeGreaterThanOrEqual(44);
      expect(box!.width).toBeGreaterThanOrEqual(44);
    }
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    ).toBe(true);
    if (width === 390)
      await page.screenshot({ path: "artifacts/mobile-home-screen.png" });
  }
  const nav = page.getByRole("navigation", { name: "手機底部導覽" });
  await nav.getByRole("link", { name: "選品", exact: true }).click();
  await expect(page.locator(".style-agent")).toBeHidden();
  await expect(page.getByLabel("搜尋商品")).toBeVisible();
  await page.screenshot({ path: "artifacts/mobile-catalog-screen.png" });
  await nav.getByRole("link", { name: "AI 穿搭", exact: true }).click();
  await expect(page.locator(".style-agent")).toBeVisible();
  await page.screenshot({ path: "artifacts/mobile-agent-screen.png" });
  await expect(
    nav.getByRole("link", { name: "AI 穿搭", exact: true }),
  ).toHaveAttribute("aria-current", "page");
  const input = page.getByLabel("向穿搭助理描述需求");
  expect(
    await input.evaluate((el) => parseFloat(getComputedStyle(el).fontSize)),
  ).toBeGreaterThanOrEqual(16);
  await input.focus();
  await page.evaluate(() => {
    Object.defineProperty(window.visualViewport!, "height", {
      configurable: true,
      value: window.innerHeight - 320,
    });
    window.visualViewport!.dispatchEvent(new Event("resize"));
  });
  await expect(page.locator(".mobile-bottom-nav")).toBeHidden();
  await input.blur();
  await page.evaluate(() => {
    Reflect.deleteProperty(window.visualViewport!, "height");
    window.visualViewport!.dispatchEvent(new Event("resize"));
  });
  await expect(nav).toBeVisible();
  await nav.getByRole("link", { name: "選品", exact: true }).click();
  await expect(page.locator(".style-agent")).toBeHidden();
  await page
    .getByRole("link", { name: "查看雲感落肩西裝外套", exact: true })
    .click();
  const tryon = page
    .locator(".detail-cta")
    .getByRole("link", { name: "在我的分身上試穿" });
  const box = await tryon.boundingBox(),
    bottom = await nav.boundingBox();
  expect(box && bottom && box.y + box.height <= bottom.y).toBeTruthy();
  expect(box!.height).toBeGreaterThanOrEqual(48);
});
