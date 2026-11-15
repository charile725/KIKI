import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { createClient } from "@supabase/supabase-js";
import handler from "../api/index";
import { createSupabaseFixture } from "./fixtures/supabase";

const listen = (server: Server) => new Promise<string>((resolve) => server.listen(0, "127.0.0.1", () =>
  resolve(`http://127.0.0.1:${(server.address() as AddressInfo).port}`),
));
const close = (server: Server) => new Promise<void>((resolve, reject) =>
  server.close((error) => error ? reject(error) : resolve()),
);

test("快速註冊：Email＋六碼密碼可登入、暱稱選填、重複帳號不覆寫，管理金鑰不公開", async () => {
  const fixture = createSupabaseFixture();
  const supabase = await listen(fixture.server);
  const app = createServer(handler);
  const origin = await listen(app);
  process.env.SUPABASE_URL = supabase;
  process.env.SUPABASE_PUBLISHABLE_KEY = "sb_publishable_test_only";
  process.env.SUPABASE_SECRET_KEY = "sb_secret_test_only";
  const post = (body: unknown, requestOrigin = "http://127.0.0.1:5173") => fetch(origin + "/api/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: requestOrigin },
    body: JSON.stringify(body),
  });
  try {
    const config = await (await fetch(origin + "/api/config")).text();
    assert.equal(JSON.parse(config).instantSignup, true);
    assert.equal(config.includes("sb_secret_"), false);
    assert.equal((await post({ email: "quick@example.com", password: "12345" })).status, 400);
    assert.equal((await post({ email: "quick@example.com", password: "123456" }, "https://other.example")).status, 403);
    const response = await post({ email: " Quick@Example.com ", password: "123456" });
    assert.equal(response.status, 201);
    assert.deepEqual(await response.json(), { created: true });
    const db = createClient(supabase, "sb_publishable_test_only", { auth: { persistSession: false, autoRefreshToken: false } });
    const login = await db.auth.signInWithPassword({ email: "quick@example.com", password: "123456" });
    assert.equal(login.error, null);
    assert.ok(login.data.session);
    const { data: profile, error } = await db.from("kiki_profiles").select("*").single();
    assert.equal(error, null);
    assert.equal(profile.display_name, "quick");
    assert.equal((await post({ email: "quick@example.com", password: "different" })).status, 409);
    const unchanged = await db.auth.signInWithPassword({ email: "quick@example.com", password: "123456" });
    assert.equal(unchanged.error, null);
    const wrong = await db.auth.signInWithPassword({ email: "quick@example.com", password: "different" });
    assert.ok(wrong.error);
    delete process.env.SUPABASE_SECRET_KEY;
    assert.equal((await post({ email: "new@example.com", password: "123456" })).status, 503);
  } finally {
    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_PUBLISHABLE_KEY;
    delete process.env.SUPABASE_SECRET_KEY;
    await close(app);
    await close(fixture.server);
  }
});
