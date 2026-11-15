import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import sharp from "sharp";
import { randomUUID } from "node:crypto";
import handler from "../api/index";
import { createSupabaseFixture } from "./fixtures/supabase";
import { createClient } from "@supabase/supabase-js";
const listen = (server: Server) =>
  new Promise<string>((resolve) =>
    server.listen(0, "127.0.0.1", () =>
      resolve(`http://127.0.0.1:${(server.address() as AddressInfo).port}`),
    ),
  );
const close = (server: Server) =>
  new Promise<void>((resolve, reject) =>
    server.close((e) => (e ? reject(e) : resolve())),
  );
test("實際 Node API：驗證 JWT、庫存、照片、生成、冪等與失敗狀態（Supabase HTTP mock）", async () => {
  const fixture = createSupabaseFixture();
  const supabase = await listen(fixture.server);
  const app = createServer(async (req, res) => {
    // Emulate Vercel exposing a parsed body after consuming the raw stream.
    if (req.headers["x-test-parsed-body"] === "1") {
      const chunks: Buffer[] = [];
      for await (const chunk of req) chunks.push(chunk);
      Object.assign(req, { body: JSON.parse(Buffer.concat(chunks).toString()) });
    }
    await handler(req, res);
  });
  const url = await listen(app);
  process.env.SUPABASE_URL = supabase;
  process.env.SUPABASE_PUBLISHABLE_KEY = "sb_publishable_test_only";
  process.env.TRYON_MODE = "demo";
  try {
    const unauth = await fetch(url + "/api/tryons", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });
    assert.equal(unauth.status, 401);
    const db = createClient(supabase, "sb_publishable_test_only", {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await db.auth.signUp({
      email: "api-test@example.com",
      password: "Testing2026!",
      options: { data: { display_name: "API" } },
    });
    assert.equal(error, null);
    assert.ok(data.session);
    const user = data.user!.id;
    const headers = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${data.session!.access_token}`,
    };
    async function post(path: string, body: unknown) {
      return fetch(url + path, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
      });
    }
    let response = await post("/api/tryons", {
      request_id: randomUUID(),
      product_id: "cloud-blazer",
      size: "M",
      color: "燕麥灰",
    });
    assert.equal(response.status, 409);
    const avatarId = randomUUID();
    const photoPath = `${user}/photos/front.jpg`;
    const photo = await sharp({
      create: { width: 600, height: 900, channels: 3, background: "#899d82" },
    })
      .jpeg()
      .toBuffer();
    fixture.files.set(photoPath, photo);
    fixture.tables.kiki_avatars.push({
      id: avatarId,
      user_id: user,
      front_path: photoPath,
      side_path: photoPath,
      height: 168,
      weight: 60,
    });
    response = await post("/api/tryons", {
      request_id: randomUUID(),
      product_id: "sage-shirt",
      size: "L",
      color: "鼠尾草綠",
    });
    assert.equal(response.status, 400);
    response = await post("/api/tryons", {
      request_id: randomUUID(),
      product_id: "invented",
      size: "M",
      color: "墨黑",
    });
    assert.equal(response.status, 404);
    const request = {
      request_id: randomUUID(),
      product_id: "cloud-blazer",
      size: "M",
      color: "燕麥灰",
    };
    response = await post("/api/tryons", request);
    assert.equal(response.status, 201);
    const job = await response.json();
    assert.equal(job.status, "completed");
    assert.equal(job.user_id, user);
    assert.equal(job.mode, "demo");
    assert.ok(job.result_path.startsWith(user + "/results/"));
    assert.equal(
      (await sharp(fixture.files.get(job.result_path)!).metadata()).format,
      "webp",
    );
    response = await post("/api/tryons", request);
    assert.equal(response.status, 200);
    assert.equal((await response.json()).id, job.id);
    assert.equal(fixture.tables.kiki_tryons.length, 1);
    response = await post("/api/recommend", {
      prompt: "我想找上台報告適合的外套",
    });
    assert.equal(response.status, 200);
    assert.equal(
      (await response.json()).recommendations[0].product_id,
      "cloud-blazer",
    );
    response = await fetch(url + "/api/recommend", {
      method: "POST",
      headers: { ...headers, "x-test-parsed-body": "1" },
      body: JSON.stringify({ prompt: "我想找上台報告適合的外套" }),
    });
    assert.equal(response.status, 200);
    assert.equal(
      (await response.json()).recommendations[0].product_id,
      "cloud-blazer",
    );
    response = await fetch(url + "/api/recommend", {
      method: "POST",
      headers: { ...headers, "x-test-parsed-body": "1" },
      body: JSON.stringify({ prompt: "外套", padding: "a".repeat(16_385) }),
    });
    assert.equal(response.status, 413);
    fixture.files.delete(photoPath);
    response = await post("/api/tryons", {
      ...request,
      request_id: randomUUID(),
    });
    assert.equal(response.status, 502);
    assert.equal(fixture.tables.kiki_tryons.at(-1)?.status, "failed");
    const crossOrigin = await fetch(url + "/api/recommend", {
      method: "POST",
      headers: { ...headers, Origin: "https://untrusted.example" },
      body: '{"prompt":"韓系"}',
    });
    assert.equal(crossOrigin.status, 403);
    process.env.SUPABASE_PUBLISHABLE_KEY = "sb_secret_do_not_leak";
    const config = await (await fetch(url + "/api/config")).json();
    assert.equal(config.configured, false);
    assert.equal(config.supabaseKey, "");
  } finally {
    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_PUBLISHABLE_KEY;
    await close(app);
    await close(fixture.server);
  }
});
