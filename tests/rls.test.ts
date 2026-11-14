import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
const a = "11111111-1111-4111-8111-111111111111",
  b = "22222222-2222-4222-8222-222222222222";
test("PostgreSQL Migration 與資料／Storage RLS 隔離（PGlite；非 Supabase 線上驗證）", async () => {
  const db = new PGlite();
  try {
    // 僅替身 auth/storage 平台 schema；應用 migration 與 RLS 原樣執行。
    await db.exec(`create role anon; create role authenticated; create schema auth; create schema storage;
      create table auth.users(id uuid primary key,raw_user_meta_data jsonb default '{}');
      create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
      create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
      create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text);
      alter table storage.objects enable row level security;
      create function storage.foldername(text) returns text[] language sql immutable as $$select (string_to_array($1,'/'))[1:array_length(string_to_array($1,'/'),1)-1]$$;
      grant usage on schema public,auth,storage to anon,authenticated;
      grant select,insert,update,delete on storage.objects to authenticated;
      grant select on storage.objects to anon;`);
    await db.exec(
      await readFile(
        "supabase/migrations/202611140001_kiki_schema.sql",
        "utf8",
      ),
    );
    await db.exec(
      await readFile(
        "supabase/migrations/202611140002_demo_catalog.sql",
        "utf8",
      ),
    );
    await db.exec(`insert into auth.users(id,raw_user_meta_data) values ('${a}','{"display_name":"A"}'),('${b}','{"display_name":"B"}');
      insert into public.kiki_avatars(id,user_id,front_path,side_path,height,weight) values('${a}','${a}','${a}/photos/front.jpg','${a}/photos/side.jpg',165,58);
      insert into storage.objects(bucket_id,name) values('kiki-private','${a}/photos/front.jpg');
      set role authenticated; select set_config('request.jwt.claim.sub','${b}',false);`);
    assert.equal(
      (await db.query("select * from public.kiki_products")).rows.length,
      8,
    );
    assert.equal(
      (await db.query("select * from public.kiki_profiles")).rows.length,
      1,
    );
    assert.equal(
      (await db.query("select * from public.kiki_avatars")).rows.length,
      0,
    );
    assert.equal(
      (await db.query("select * from storage.objects")).rows.length,
      0,
    );
    await assert.rejects(
      db.exec(
        `insert into public.kiki_favorites(user_id,product_id) values('${a}','cloud-blazer')`,
      ),
      /row-level security/,
    );
    await assert.rejects(
      db.exec(
        `insert into storage.objects(bucket_id,name) values('kiki-private','${a}/photos/evil.jpg')`,
      ),
      /row-level security/,
    );
    await assert.rejects(
      db.exec(
        `insert into public.kiki_avatars(user_id,front_path,side_path,height,weight) values('${b}','${a}/photos/front.jpg','${b}/photos/side.jpg',165,58)`,
      ),
      /check constraint/,
    );
    await assert.rejects(
      db.exec(
        `insert into public.kiki_tryons(user_id,avatar_id,product_id,size,color,mode) values('${b}','${a}','cloud-blazer','M','燕麥灰','demo')`,
      ),
      /foreign key/,
    );
    await db.exec(
      `update public.kiki_profiles set display_name='ATTACK' where user_id='${a}'; select set_config('request.jwt.claim.sub','${a}',false);`,
    );
    assert.equal(
      (
        await db.query<{ display_name: string }>(
          "select display_name from public.kiki_profiles",
        )
      ).rows[0].display_name,
      "A",
    );
    assert.equal(
      (await db.query("select * from storage.objects")).rows.length,
      1,
    );
    await db.exec(`insert into public.kiki_tryons(id,user_id,avatar_id,product_id,size,color,mode,status,result_path) values('${a}','${a}','${a}','cloud-blazer','M','燕麥灰','demo','completed','${a}/results/look.webp');
      insert into public.kiki_outfits(user_id,tryon_id,name) values('${a}','${a}','第一套穿搭');
      select set_config('request.jwt.claim.sub','${b}',false);`);
    assert.equal(
      (await db.query("select * from public.kiki_tryons")).rows.length,
      0,
    );
    assert.equal(
      (await db.query("select * from public.kiki_outfits")).rows.length,
      0,
    );
    await assert.rejects(
      db.exec(
        `insert into public.kiki_outfits(user_id,tryon_id,name) values('${b}','${a}','竊取')`,
      ),
      /row-level security|foreign key/,
    );
    await db.exec(
      `select set_config('request.jwt.claim.sub','${a}',false); delete from public.kiki_avatars;`,
    );
    assert.equal(
      (await db.query("select * from public.kiki_tryons")).rows.length,
      0,
    );
    assert.equal(
      (await db.query("select * from public.kiki_outfits")).rows.length,
      0,
    );
    await db.exec(`reset role; set role anon;`);
    assert.equal(
      (await db.query("select * from public.kiki_products")).rows.length,
      8,
    );
    assert.equal(
      (await db.query("select * from storage.objects")).rows.length,
      0,
    );
    await assert.rejects(
      db.query("select * from public.kiki_profiles"),
      /permission denied/,
    );
    await db.exec("reset role");
    const bucket = await db.query<{ public: boolean }>(
      `select public from storage.buckets where id='kiki-private'`,
    );
    assert.equal(bucket.rows[0]?.public, false);
  } finally {
    await db.close();
  }
});
