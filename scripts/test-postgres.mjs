import fs from "node:fs/promises";
import { Client } from "pg";
import { securityCases } from "./sql-cases.mjs";
const url = process.env.TEST_DATABASE_URL;
if (!url) throw new Error("TEST_DATABASE_URL required");
const target = new URL(url);
if (
  !["localhost", "127.0.0.1"].includes(target.hostname) ||
  !target.pathname.startsWith("/rifatrack_test")
)
  throw new Error("Only disposable local rifatrack_test databases are allowed");
const db = new Client({ connectionString: url });
await db.connect();
try {
  const count = (await db.query("select count(*)::int n from pg_tables where schemaname='public'"))
    .rows[0].n;
  if (count) throw new Error("Test database must be empty. Create a fresh database for each run.");
  const source = await fs.readFile(new URL("./test-database.mjs", import.meta.url), "utf8");
  const bootstrap = source.match(/await db.exec\(`([\s\S]*?)`\);/)[1];
  await db.query(bootstrap);
  const dir = new URL("../supabase/migrations/", import.meta.url);
  for (const name of (await fs.readdir(dir)).filter((n) => n.endsWith(".sql")).sort())
    await db.query(await fs.readFile(new URL(name, dir), "utf8"));
  await securityCases(db);
  console.log("PASS all migrations replayed on PostgreSQL");
} finally {
  await db.end();
}
