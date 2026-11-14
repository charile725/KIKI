import { test } from "node:test";
import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";
const vars = [
  "TEST_SUPABASE_URL",
  "TEST_SUPABASE_PUBLISHABLE_KEY",
  "TEST_USER_A_EMAIL",
  "TEST_USER_A_PASSWORD",
  "TEST_USER_B_EMAIL",
  "TEST_USER_B_PASSWORD",
] as const;
test(
  "真實 Supabase 測試專案：唯讀雙帳號 RLS 與私人圖片驗證",
  {
    skip: vars.some((v) => !process.env[v])
      ? "尚未提供兩組 Supabase 測試帳號與連線資訊"
      : false,
  },
  async () => {
    const url = process.env.TEST_SUPABASE_URL!,
      key = process.env.TEST_SUPABASE_PUBLISHABLE_KEY!;
    const a = createClient(url, key, {
        auth: { persistSession: false, autoRefreshToken: false },
      }),
      b = createClient(url, key, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
    try {
      const [aa, bb] = await Promise.all([
        a.auth.signInWithPassword({
          email: process.env.TEST_USER_A_EMAIL!,
          password: process.env.TEST_USER_A_PASSWORD!,
        }),
        b.auth.signInWithPassword({
          email: process.env.TEST_USER_B_EMAIL!,
          password: process.env.TEST_USER_B_PASSWORD!,
        }),
      ]);
      assert.equal(aa.error, null);
      assert.equal(bb.error, null);
      assert.notEqual(aa.data.user!.id, bb.data.user!.id);
      const id = aa.data.user!.id;
      for (const table of [
        "kiki_profiles",
        "kiki_avatars",
        "kiki_tryons",
        "kiki_favorites",
        "kiki_outfits",
      ]) {
        const { data, error } = await b
          .from(table)
          .select("*")
          .eq("user_id", id);
        assert.equal(error, null);
        assert.deepEqual(data, [], `B 不能讀取 A 的 ${table}`);
      }
      const { data: avatar, error } = await a
        .from("kiki_avatars")
        .select("*")
        .maybeSingle();
      assert.equal(error, null);
      if (avatar) {
        const own = await a.storage
          .from("kiki-private")
          .download(avatar.front_path);
        assert.equal(own.error, null);
        const other = await b.storage
          .from("kiki-private")
          .download(avatar.front_path);
        assert.ok(other.error);
        const publicImage = await fetch(
          `${url}/storage/v1/object/public/kiki-private/${avatar.front_path}`,
        );
        assert.equal(publicImage.ok, false);
      }
      const catalog = await a.from("kiki_products").select("*");
      assert.equal(catalog.error, null);
      assert.ok(catalog.data?.length);
    } finally {
      await Promise.all([
        a.auth.signOut({ scope: "local" }),
        b.auth.signOut({ scope: "local" }),
      ]);
    }
  },
);
