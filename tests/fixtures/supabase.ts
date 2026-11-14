// 僅供測試的 Supabase HTTP contract 替身，不會被正式程式匯入或當成資料庫。
import { randomUUID } from "node:crypto";
import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
} from "node:http";
import { catalog } from "../../shared/catalog";
type Row = Record<string, unknown>;
interface User {
  id: string;
  email: string;
  password: string;
  user_metadata: Row;
  aud: string;
  app_metadata: Row;
  created_at: string;
}
export function createSupabaseFixture() {
  const users: User[] = [],
    tokens = new Map<string, User>(),
    files = new Map<string, Buffer>();
  const tables: Record<string, Row[]> = {
    kiki_products: structuredClone(catalog) as unknown as Row[],
    kiki_profiles: [],
    kiki_avatars: [],
    kiki_tryons: [],
    kiki_favorites: [],
    kiki_outfits: [],
  };
  function send(
    res: ServerResponse,
    status: number,
    data: unknown,
    headers: Record<string, string> = {},
  ) {
    res.writeHead(status, {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "*",
      "Access-Control-Allow-Methods": "GET,POST,PATCH,DELETE,PUT,OPTIONS",
      ...headers,
    });
    res.end(
      status === 204
        ? undefined
        : Buffer.isBuffer(data)
          ? data
          : JSON.stringify(data),
    );
  }
  function session(user: User) {
    const token = "test-access-" + user.id;
    tokens.set(token, user);
    const { password: _, ...safe } = user;
    void _;
    return {
      access_token: token,
      refresh_token: "test-refresh-" + user.id,
      token_type: "bearer",
      expires_in: 3600,
      expires_at: Math.floor(Date.now() / 1000) + 3600,
      user: safe,
    };
  }
  async function handler(req: IncomingMessage, res: ServerResponse) {
    try {
      if (req.method === "OPTIONS") return send(res, 204, null);
      const url = new URL(req.url || "/", "http://localhost"),
        path = decodeURIComponent(url.pathname);
      const chunks: Buffer[] = [];
      for await (const chunk of req) chunks.push(chunk);
      const buffer = Buffer.concat(chunks);
      const body: Row =
        req.headers["content-type"]?.includes("application/json") &&
        buffer.length
          ? JSON.parse(buffer.toString())
          : {};
      if (path === "/__health") return send(res, 200, { mock: true });
      if (path === "/__reset") {
        users.length = 0;
        tokens.clear();
        files.clear();
        Object.keys(tables)
          .filter((t) => t !== "kiki_products")
          .forEach((t) => (tables[t] = []));
        return send(res, 200, { ok: true });
      }
      if (path === "/auth/v1/signup") {
        if (users.some((u) => u.email === body.email))
          return send(res, 422, { msg: "User already registered" });
        const user: User = {
          id: randomUUID(),
          email: String(body.email),
          password: String(body.password),
          user_metadata: (body.data as Row) || {},
          aud: "authenticated",
          app_metadata: { provider: "email", providers: ["email"] },
          created_at: new Date().toISOString(),
        };
        users.push(user);
        tables.kiki_profiles.push({
          user_id: user.id,
          display_name: user.user_metadata.display_name || "測試者",
          fit_preference: "微寬鬆",
          personalize: false,
          external_ai_consent: false,
        });
        return send(res, 200, session(user));
      }
      if (path === "/auth/v1/token") {
        const user =
          url.searchParams.get("grant_type") === "refresh_token"
            ? users.find((u) => "test-refresh-" + u.id === body.refresh_token)
            : users.find(
                (u) => u.email === body.email && u.password === body.password,
              );
        return user
          ? send(res, 200, session(user))
          : send(res, 400, { msg: "Invalid login credentials" });
      }
      const user = tokens.get(
        req.headers.authorization?.replace("Bearer ", "") || "",
      );
      if (path === "/auth/v1/user") {
        if (!user) return send(res, 401, { msg: "Unauthorized" });
        const { password: _, ...safe } = user;
        void _;
        return send(res, 200, safe);
      }
      if (path === "/auth/v1/logout") return send(res, 204, null);
      if (path.startsWith("/rest/v1/")) {
        const table = path.split("/").at(-1)!;
        if (!tables[table])
          return send(res, 404, { message: "Table not found" });
        if (table !== "kiki_products" && !user)
          return send(res, 401, { message: "Unauthorized" });
        const visible = () =>
          tables[table].filter(
            (row) => table === "kiki_products" || row.user_id === user?.id,
          );
        const matches = (row: Row) =>
          [...url.searchParams].every(
            ([key, value]) =>
              !value.startsWith("eq.") || String(row[key]) === value.slice(3),
          );
        let rows = visible().filter(matches);
        if (req.method === "POST") {
          if (table === "kiki_products" || body.user_id !== user?.id)
            return send(res, 403, { message: "RLS denied" });
          const conflict =
            url.searchParams.get("on_conflict")?.split(",") ||
            (table === "kiki_favorites" ? ["user_id", "product_id"] : ["id"]);
          const old = tables[table].find((row) =>
            conflict.every(
              (key) => row[key] !== undefined && row[key] === body[key],
            ),
          );
          const row = old
            ? Object.assign(old, body)
            : {
                id: randomUUID(),
                created_at: new Date().toISOString(),
                ...body,
              };
          if (!old) tables[table].push(row);
          rows = [row];
        } else if (req.method === "PATCH")
          rows.forEach((row) => Object.assign(row, body));
        else if (req.method === "DELETE") {
          tables[table] = tables[table].filter((row) => !rows.includes(row));
          if (table === "kiki_avatars") {
            const ids = tables.kiki_tryons
              .filter((t) => rows.some((a) => a.id === t.avatar_id))
              .map((t) => t.id);
            tables.kiki_tryons = tables.kiki_tryons.filter(
              (t) => !ids.includes(t.id),
            );
            tables.kiki_outfits = tables.kiki_outfits.filter(
              (o) => !ids.includes(o.tryon_id),
            );
          }
          if (table === "kiki_tryons")
            tables.kiki_outfits = tables.kiki_outfits.filter(
              (o) => !rows.some((t) => t.id === o.tryon_id),
            );
        }
        const order = url.searchParams.get("order");
        if (order) {
          const [key, direction] = order.split(".");
          rows.sort(
            (a, b) =>
              String(a[key]).localeCompare(String(b[key])) *
              (direction === "desc" ? -1 : 1),
          );
        }
        if (req.headers.accept?.includes("application/vnd.pgrst.object+json"))
          return rows.length === 1
            ? send(res, 200, rows[0])
            : send(res, 406, {
                message: "Expected single row",
                code: "PGRST116",
                details: `The result contains ${rows.length} rows`,
              });
        return send(res, 200, rows);
      }
      if (path.startsWith("/storage/v1/")) {
        if (!user) return send(res, 403, { message: "Unauthorized" });
        if (path === "/storage/v1/object/list/kiki-private") {
          if (!String(body.prefix).startsWith(user.id + "/"))
            return send(res, 403, { message: "RLS denied" });
          const list = [...files.keys()]
            .filter((p) => p.startsWith(String(body.prefix) + "/"))
            .map((p) => ({ name: p.split("/").at(-1), id: randomUUID() }));
          return send(res, 200, list.slice(0, Number(body.limit || 100)));
        }
        if (
          path === "/storage/v1/object/kiki-private" &&
          req.method === "DELETE"
        ) {
          const paths = body.prefixes as string[];
          if (paths.some((p) => !p.startsWith(user.id + "/")))
            return send(res, 403, { message: "RLS denied" });
          paths.forEach((p) => files.delete(p));
          return send(
            res,
            200,
            paths.map((name) => ({ name })),
          );
        }
        const filePath = path.replace(
          /^\/storage\/v1\/object\/(?:authenticated\/)?kiki-private\//,
          "",
        );
        if (!filePath.startsWith(user.id + "/"))
          return send(res, 403, { message: "RLS denied" });
        if (req.method === "GET") {
          const image = files.get(filePath);
          return image
            ? send(res, 200, image, {
                "Content-Type": filePath.endsWith(".webp")
                  ? "image/webp"
                  : "image/jpeg",
              })
            : send(res, 404, { message: "Object not found" });
        }
        let image = buffer;
        if (req.headers["content-type"]?.includes("multipart/form-data")) {
          const form = await new Response(new Uint8Array(buffer), {
            headers: { "Content-Type": req.headers["content-type"] },
          }).formData();
          const file = [...form.values()].find(
            (value) => value instanceof Blob,
          );
          if (!(file instanceof Blob))
            return send(res, 400, { message: "Missing image" });
          image = Buffer.from(await file.arrayBuffer());
        }
        files.set(filePath, image);
        return send(res, 200, {
          Key: "kiki-private/" + filePath,
          Id: randomUUID(),
        });
      }
      send(res, 404, { message: "Unknown mock endpoint" });
    } catch (error) {
      send(res, 500, { message: String(error) });
    }
  }
  return {
    server: createServer((req, res) => void handler(req, res)),
    tables,
    files,
    users,
  };
}
