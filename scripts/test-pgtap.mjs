import fs from "node:fs/promises";
import { Client } from "pg";
const target = new URL(process.env.TEST_DATABASE_URL || "");
if (
  !["localhost", "127.0.0.1"].includes(target.hostname) ||
  !target.pathname.startsWith("/rifatrack_test")
)
  throw new Error("A disposable local rifatrack_test database is required");
const db = new Client({ connectionString: target.href });
await db.connect();
try {
  const results = await db.query(
    await fs.readFile(new URL("../supabase/tests/security.test.sql", import.meta.url), "utf8"),
  );
  const lines = results.flatMap((result) => result.rows.flatMap((row) => Object.values(row)));
  for (const line of lines) console.log(line);
  if (lines.some((line) => String(line).startsWith("not ok"))) throw new Error("pgTAP failed");
} finally {
  await db.end();
}
