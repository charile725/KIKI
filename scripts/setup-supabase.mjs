import pg from "pg";
import { readFile } from "node:fs/promises";

const tables = ["kiki_profiles", "kiki_products", "kiki_avatars", "kiki_tryons", "kiki_favorites", "kiki_outfits"];
if (!process.env.DATABASE_URL || !process.env.SUPABASE_URL)
  throw new Error("Set DATABASE_URL in .env.supabase-admin and SUPABASE_URL in .env.");
const database = new URL(process.env.DATABASE_URL);
const project = new URL(process.env.SUPABASE_URL).hostname.split(".")[0];
if (decodeURIComponent(database.username) !== `postgres.${project}`)
  throw new Error("Database project does not match SUPABASE_URL; no changes made.");
const client = new pg.Client({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    ca: await readFile(new URL("../supabase/prod-supabase.cer", import.meta.url), "utf8"),
    rejectUnauthorized: true,
  },
  connectionTimeoutMillis: 15_000,
  query_timeout: 60_000,
});

try {
  await client.connect();
  const existing = await client.query(
    "select tablename from pg_tables where schemaname='public' and tablename=any($1::text[])",
    [tables],
  );
  if (existing.rowCount === 0) {
    const bucket = await client.query("select id from storage.buckets where id='kiki-private'");
    if (bucket.rowCount) throw new Error("Existing kiki-private bucket requires review; no schema changes made.");
    await client.query(await readFile(new URL("../supabase/migrations/202611140001_kiki_schema.sql", import.meta.url), "utf8"));
    console.log("Created KIKI tables, owner policies, signup trigger and private storage.");
  } else if (existing.rowCount !== tables.length) {
    throw new Error("Partial KIKI schema found; review existing tables before continuing.");
  } else {
    console.log("KIKI tables already exist; preserving the existing schema and records.");
  }
  await client.query(await readFile(new URL("../supabase/migrations/202611140002_demo_catalog.sql", import.meta.url), "utf8"));
  await client.query("notify pgrst, 'reload schema'");
  const products = await client.query("select count(*)::int as count from public.kiki_products");
  const policies = await client.query(
    "select tablename, rowsecurity from pg_tables where schemaname='public' and tablename=any($1::text[]) order by tablename",
    [tables],
  );
  const bucket = await client.query("select id, public, file_size_limit from storage.buckets where id='kiki-private'");
  if (policies.rows.some((table) => !table.rowsecurity) || bucket.rows[0]?.public !== false)
    throw new Error("RLS or private storage settings need review.");
  console.log(JSON.stringify({ products: products.rows[0].count, tables: policies.rows, bucket: bucket.rows[0] }, null, 2));
} finally {
  await client.end();
}
