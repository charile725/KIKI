import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
} from "node:http";
import { readFile } from "node:fs/promises";
import { resolve, extname, sep } from "node:path";
import { pathToFileURL } from "node:url";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { catalog } from "../shared/catalog.js";
import type { Avatar, Product, Profile, Tryon } from "../shared/types.js";
import { recommendationSchema, tryonSchema } from "../shared/validation.js";
import { recommend } from "./recommend.js";
import { getTryonAdapter } from "./tryon.js";

class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
function configured() {
  const key = process.env.SUPABASE_PUBLISHABLE_KEY || "";
  if (!process.env.SUPABASE_URL || !key || key.startsWith("sb_secret_"))
    return false;
  if (key.startsWith("sb_publishable_")) return true;
  try {
    return (
      JSON.parse(Buffer.from(key.split(".")[1], "base64url").toString())
        .role === "anon"
    );
  } catch {
    return false;
  }
}
function client(token?: string): SupabaseClient {
  if (!configured())
    throw new HttpError(
      503,
      "尚未連接 Supabase，請依 README 設定測試專案與 .env。",
    );
  return createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_PUBLISHABLE_KEY!,
    {
      auth: { autoRefreshToken: false, persistSession: false },
      global: token
        ? { headers: { Authorization: `Bearer ${token}` } }
        : undefined,
    },
  );
}
function send(res: ServerResponse, status: number, data: unknown) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
  });
  res.end(JSON.stringify(data));
}
async function json(req: IncomingMessage) {
  if (!req.headers["content-type"]?.startsWith("application/json"))
    throw new HttpError(415, "需要 JSON 格式的請求。");
  // Vercel may have consumed the stream and exposed JSON through req.body.
  if ("body" in req) {
    let body: unknown;
    try {
      body = req.body;
    } catch {
      throw new HttpError(400, "無效的 JSON。");
    }
    if (body !== undefined) {
      if (Buffer.byteLength(JSON.stringify(body)) > 16_384)
        throw new HttpError(413, "請求內容過大。");
      return body;
    }
  }
  let size = 0;
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 16_384) throw new HttpError(413, "請求內容過大。");
    chunks.push(chunk);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString());
  } catch {
    throw new HttpError(400, "無效的 JSON。");
  }
}
async function authenticated(req: IncomingMessage) {
  const token = req.headers.authorization?.match(/^Bearer (.+)$/)?.[1];
  if (!token) throw new HttpError(401, "請先登入帳號。");
  const db = client(token);
  const { data, error } = await db.auth.getUser(token);
  if (error || !data.user) throw new HttpError(401, "登入已過期，請重新登入。");
  return { db, user: data.user };
}
function check(error: { message: string } | null) {
  if (error)
    throw new HttpError(
      503,
      "Supabase 資料存取失敗，請確認 Migration、Storage 與 RLS 已完成設定。",
    );
}
const active = new Set<string>();
const rates = new Map<string, { count: number; expires: number }>();
function rate(user: string) {
  const now = Date.now();
  if (rates.size > 1000)
    for (const [id, value] of rates) if (value.expires < now) rates.delete(id);
  const value = rates.get(user);
  if (!value || value.expires < now)
    rates.set(user, { count: 1, expires: now + 60_000 });
  else if (++value.count > 20)
    throw new HttpError(429, "操作太頻繁，請一分鐘後再試。");
}

export async function handler(req: IncomingMessage, res: ServerResponse) {
  try {
    const pathname = new URL(req.url || "/", "http://localhost").pathname;
    if (pathname.startsWith("/api/")) {
      if (
        req.method === "POST" &&
        req.headers.origin &&
        req.headers.origin !==
          (process.env.APP_ORIGIN || "http://127.0.0.1:5173")
      )
        throw new HttpError(403, "請從網站內發起操作。");
      if (req.method === "GET" && pathname === "/api/config")
        return send(res, 200, {
          configured: configured(),
          supabaseUrl: process.env.SUPABASE_URL || "",
          supabaseKey: configured() ? process.env.SUPABASE_PUBLISHABLE_KEY : "",
          recommendationMode:
            process.env.RECOMMENDATION_MODE === "ai" ? "ai" : "demo",
          tryonMode: process.env.TRYON_MODE === "ai" ? "ai" : "demo",
        });
      if (req.method === "GET" && pathname === "/api/health")
        return send(res, 200, {
          ok: true,
          database: "supabase",
          configured: configured(),
        });
      if (req.method === "GET" && pathname === "/api/products") {
        if (!configured())
          return send(res, 200, {
            products: catalog,
            source: "preview-fixtures",
          });
        const { data, error } = await client()
          .from("kiki_products")
          .select("*")
          .order("price");
        check(error);
        return send(res, 200, { products: data, source: "supabase" });
      }
      if (
        req.method !== "POST" ||
        !["/api/recommend", "/api/tryons"].includes(pathname)
      )
        throw new HttpError(404, "找不到此 API。");
      const { db, user } = await authenticated(req);
      rate(user.id);
      const payload = await json(req);
      const [{ data: profile, error: pe }, { data: avatar, error: ae }] =
        await Promise.all([
          db
            .from("kiki_profiles")
            .select("*")
            .eq("user_id", user.id)
            .maybeSingle(),
          db
            .from("kiki_avatars")
            .select("*")
            .eq("user_id", user.id)
            .maybeSingle(),
        ]);
      check(pe);
      check(ae);
      if (pathname === "/api/recommend") {
        const parsed = recommendationSchema.safeParse(payload);
        if (!parsed.success)
          throw new HttpError(400, parsed.error.issues[0].message);
        const { data, error } = await db.from("kiki_products").select("*");
        check(error);
        return send(
          res,
          200,
          await recommend(
            parsed.data.prompt,
            data as Product[],
            profile?.personalize ? (profile as Profile) : null,
            profile?.personalize ? (avatar as Avatar) : null,
            !!profile?.external_ai_consent,
          ),
        );
      }
      const parsed = tryonSchema.safeParse(payload);
      if (!parsed.success)
        throw new HttpError(400, "請選擇有效的商品、尺寸與顏色。");
      if (!avatar) throw new HttpError(409, "請先完成你的個人分身。");
      if (!profile) throw new HttpError(409, "請先完成個人設定。");
      const { product_id, size, color, request_id } = parsed.data;
      const { data: product, error } = await db
        .from("kiki_products")
        .select("*")
        .eq("id", product_id)
        .maybeSingle();
      check(error);
      if (!product) throw new HttpError(404, "商品不存在。");
      if (
        !(product as Product).sizes.some(
          (s) => s.label === size && s.stock > 0,
        ) ||
        !(product as Product).colors.some((c) => c.name === color)
      )
        throw new HttpError(400, "選擇的尺寸缺貨或顏色不存在。");
      const { data: existing, error: ee } = await db
        .from("kiki_tryons")
        .select("*")
        .eq("id", request_id)
        .maybeSingle();
      check(ee);
      if (existing) return send(res, 200, existing);
      if (active.has(user.id))
        throw new HttpError(429, "上一張試穿還在處理中，請稍候。");
      active.add(user.id);
      try {
        const mode = process.env.TRYON_MODE === "ai" ? "ai" : "demo";
        const { data: job, error: je } = await db
          .from("kiki_tryons")
          .insert({
            id: request_id,
            user_id: user.id,
            avatar_id: avatar.id,
            product_id,
            size,
            color,
            mode,
            status: "processing",
          })
          .select()
          .single();
        check(je);
        const path = `${user.id}/results/${request_id}.webp`;
        try {
          const { data: photo, error: de } = await db.storage
            .from("kiki-private")
            .download(avatar.front_path);
          check(de);
          if (!photo) throw new Error("找不到分身照片，請重新上傳。");
          const image = await getTryonAdapter().generate({
            photo: Buffer.from(await photo.arrayBuffer()),
            product,
            size,
            color,
            profile,
          });
          const { error: ue } = await db.storage
            .from("kiki-private")
            .upload(path, image, { contentType: "image/webp", upsert: false });
          check(ue);
          const { data: result, error: re } = await db
            .from("kiki_tryons")
            .update({ status: "completed", result_path: path, error: null })
            .eq("id", (job as Tryon).id)
            .select()
            .single();
          if (re) {
            await db.storage.from("kiki-private").remove([path]);
            check(re);
          }
          return send(res, 201, result);
        } catch (error) {
          const message =
            error instanceof Error &&
            !/fetch failed|Unexpected token|ZodError/.test(error.message)
              ? error.message.slice(0, 180)
              : "試穿服務未完成，請重新嘗試。";
          const { error: fe } = await db
            .from("kiki_tryons")
            .update({ status: "failed", error: message })
            .eq("id", request_id);
          check(fe);
          return send(res, 502, { error: message, tryon_id: request_id });
        }
      } finally {
        active.delete(user.id);
      }
    }
    if (req.method !== "GET" && req.method !== "HEAD")
      throw new HttpError(405, "不支援的操作。");
    const root = resolve("dist");
    const decoded = decodeURIComponent(pathname);
    if (decoded.split('/').some(segment => segment.startsWith('.'))) throw new HttpError(404, '檔案不存在。');
    let path = resolve(root, "." + decoded);
    if (path !== root && !path.startsWith(root + sep))
      throw new HttpError(403, "拒絕存取。");
    let body: Buffer;
    try {
      body = await readFile(path);
    } catch {
      if (extname(path)) throw new HttpError(404, "檔案不存在。");
      path = resolve(root, "index.html");
      try {
        body = await readFile(path);
      } catch {
        throw new HttpError(
          503,
          "請先執行 npm run build，或使用 npm run dev。",
        );
      }
    }
    const mime: Record<string, string> = {
      ".html": "text/html; charset=utf-8",
      ".js": "text/javascript",
      ".css": "text/css",
      ".svg": "image/svg+xml",
      ".jpg": "image/jpeg",
      ".webp": "image/webp",
      ".png": "image/png",
      ".woff2": "font/woff2",
    };
    res.writeHead(200, {
      "Content-Type": mime[extname(path)] || "application/octet-stream",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "no-referrer",
      "Cache-Control":
        extname(path) === ".html" ? "no-cache" : "public, max-age=3600",
    });
    res.end(req.method === "HEAD" ? undefined : body);
  } catch (error) {
    if (res.headersSent) {
      res.end();
      return;
    }
    send(res, error instanceof HttpError ? error.status : 500, {
      error:
        error instanceof HttpError
          ? error.message
          : "服務暫時無法完成操作，請稍後重試或確認 AI 設定。",
    });
  }
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  createServer(handler).listen(
    Number(process.env.PORT || 3001),
    "127.0.0.1",
    () =>
      console.log(
        `KIKI API http://127.0.0.1:${process.env.PORT || 3001} · Supabase ${configured() ? "configured" : "not configured (public preview only)"}`,
      ),
  );
}
