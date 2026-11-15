import { test } from "node:test";
import assert from "node:assert/strict";
import { api } from "../src/lib/api";

test("API 客戶端保留正常 JSON 資料、請求內容與伺服器錯誤訊息", async (t) => {
  const fetch = t.mock.method(globalThis, "fetch", async () => Response.json({ ok: true }));
  assert.deepEqual(await api("/api/config"), { ok: true });
  assert.deepEqual(fetch.mock.calls[0].arguments, ["/api/config", {
    method: "GET", headers: { Accept: "application/json" }, body: undefined,
  }]);
  await api("/api/recommend", { body: { prompt: "通勤" } });
  assert.equal(fetch.mock.calls[1].arguments[1]?.body, '{"prompt":"通勤"}');
  fetch.mock.mockImplementation(async () => Response.json({ error: "請先登入帳號。" }, { status: 401 }));
  await assert.rejects(api("/api/recommend", { body: {} }), { message: "請先登入帳號。" });
});

test("API 客戶端遇到主機文字錯誤頁、HTML、空內容或損壞 JSON 時顯示可診斷訊息", async (t) => {
  const fetch = t.mock.method(globalThis, "fetch");
  for (const [body, status, type] of [
    ["The page could not be found", 404, "text/plain"],
    ["<html><body>Gateway error</body></html>", 502, "text/html"],
    ["<!doctype html><html>SPA fallback</html>", 200, "text/html"],
    ["", 500, "text/plain"],
    ['{"incomplete":', 200, "application/json"],
    ["null", 200, "application/json"],
    ['"The page could not be found"', 404, "application/json"],
  ] as const) {
    fetch.mock.mockImplementation(async () => new Response(body, { status, headers: { "Content-Type": type } }));
    await assert.rejects(api("/api/products"), (error: Error) => {
      assert.match(error.message, new RegExp(`HTTP ${status}`));
      assert.match(error.message, /\/api\/products/);
      assert.match(error.message, /正確轉送至後端/);
      assert.doesNotMatch(error.message, /Unexpected token|SyntaxError|<html>/);
      return true;
    });
  }
});

test("API 客戶端處理無 error 欄位的 JSON 失敗回應與網路中斷", async (t) => {
  const fetch = t.mock.method(globalThis, "fetch", async () => Response.json({ error: { message: "unexpected" } }, { status: 503 }));
  await assert.rejects(api("/api/config"), /HTTP 503/);
  fetch.mock.mockImplementation(async () => { throw new TypeError("Failed to fetch"); });
  await assert.rejects(api("/api/config"), /無法連線至服務（\/api\/config）/);
});
