import fs from "node:fs/promises";
import assert from "node:assert/strict";
import { PGlite } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";
import { securityCases } from "./sql-cases.mjs";
const db = new PGlite({ extensions: { pgcrypto } });
await db.exec(`
 create role anon;create role authenticated;create role service_role bypassrls;
 create schema extensions;create extension pgcrypto with schema extensions;
 create schema auth;create schema storage;
 create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb $$;
 create function auth.uid() returns uuid language sql stable as $$select nullif(auth.jwt()->>'sub','')::uuid$$;
 create table auth.users(id uuid primary key,email text);
 create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
 create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text);
 grant usage on schema public,auth,extensions,storage to anon,authenticated,service_role;
 grant all on all tables in schema storage to anon,authenticated,service_role;
 set search_path=public,extensions;
`);
const dir = new URL("../supabase/migrations/", import.meta.url);
for (const name of (await fs.readdir(dir)).filter((n) => n.endsWith(".sql")).sort()) {
  try {
    await db.exec(await fs.readFile(new URL(name, dir), "utf8"));
    console.log("MIGRATION", name);
  } catch (e) {
    console.error("MIGRATION FAILED", name, e.message);
    throw e;
  }
}
const q = async (sql, params = []) => {
  const r = await db.query(sql, params);
  return r.rows[0];
};
assert.equal(
  (
    await q(
      "select count(*)::int as n from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='process_asaas_event'",
    )
  ).n,
  2,
);
console.log("PASS complete migration replay");
await securityCases(db);
await db.close();
