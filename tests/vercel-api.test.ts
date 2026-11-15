import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import handler from "../api/index";
import { catalog } from "../shared/catalog";

test("Vercel API 入口：未設定資料庫仍回傳商品、設定與健康狀態的 JSON", async () => {
  const previousUrl = process.env.SUPABASE_URL;
  const previousKey = process.env.SUPABASE_PUBLISHABLE_KEY;
  delete process.env.SUPABASE_URL;
  delete process.env.SUPABASE_PUBLISHABLE_KEY;
  const server = createServer(handler);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  try {
    const products = await fetch(origin + "/api/products?from=cloud");
    assert.equal(products.status, 200);
    assert.match(products.headers.get("content-type")!, /application\/json/);
    assert.deepEqual(await products.json(), {
      products: catalog,
      source: "preview-fixtures",
    });
    const config = await (await fetch(origin + "/api/config")).json();
    assert.equal(config.configured, false);
    assert.equal(config.supabaseKey, "");
    const health = await (await fetch(origin + "/api/health")).json();
    assert.equal(health.ok, true);
    assert.equal(health.configured, false);
    const missing = await fetch(origin + "/api/unknown");
    assert.equal(missing.status, 404);
    assert.deepEqual(await missing.json(), { error: "找不到此 API。" });
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => error ? reject(error) : resolve()),
    );
    if (previousUrl === undefined) delete process.env.SUPABASE_URL;
    else process.env.SUPABASE_URL = previousUrl;
    if (previousKey === undefined) delete process.env.SUPABASE_PUBLISHABLE_KEY;
    else process.env.SUPABASE_PUBLISHABLE_KEY = previousKey;
  }
});
