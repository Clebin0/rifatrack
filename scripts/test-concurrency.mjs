import { Pool } from "pg";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
const url = process.env.TEST_DATABASE_URL;
if (!url) throw new Error("TEST_DATABASE_URL is required; use a disposable local test database.");
const target = new URL(url);
if (
  !["localhost", "127.0.0.1"].includes(target.hostname) ||
  !target.pathname.startsWith("/rifatrack_test")
)
  throw new Error("Concurrency tests require a local rifatrack_test database.");
const pool = new Pool({ connectionString: url, max: 3 });
const id = randomUUID(),
  slug = "concurrency-" + id;
const a = await pool.connect(),
  b = await pool.connect();
try {
  await pool.query(
    "insert into campaigns(id,name,slug,price_cents,total_numbers,status) values($1,'Concurrent test',$2,500,1,'active')",
    [id, slug],
  );
  await pool.query("insert into raffle_numbers(campaign_id,number) values($1,1)", [id]);
  await a.query("begin");
  await b.query("begin; set local statement_timeout='5s'");
  const sql =
    "select reserve_raffle_numbers($1,$2,null,'Teste Comprador',$3,'test@example.org',array[1]) result";
  await a.query(sql, ["a".repeat(64), slug, "11999998888"]);
  let completed = false;
  const competing = b.query(sql, ["b".repeat(64), slug, "11999997777"]).then(
    () => {
      completed = true;
      return null;
    },
    (error) => {
      completed = true;
      return error;
    },
  );
  // The second backend must be waiting on the first transaction's lock.
  let blocked = false;
  for (let i = 0; i < 20; i++) {
    const blockers = (await pool.query("select pg_blocking_pids($1) pids", [b.processID])).rows[0]
      .pids;
    if (blockers.includes(a.processID)) {
      blocked = true;
      break;
    }
    await delay(50);
  }
  assert.ok(blocked, "second reservation waits on the first transaction");
  await a.query("commit");
  const failure = await competing;
  assert.ok(completed);
  assert.match(failure?.message || "", /number unavailable/);
  await b.query("rollback");
  assert.equal(
    (await pool.query("select count(*)::int n from orders where campaign_id=$1", [id])).rows[0].n,
    1,
  );
  assert.equal(
    (
      await pool.query(
        "select count(*)::int n from raffle_numbers where campaign_id=$1 and status='reserved'",
        [id],
      )
    ).rows[0].n,
    1,
  );
  console.log("PASS two independent PostgreSQL connections cannot reserve the same number");
} finally {
  await a.query("rollback");
  await b.query("rollback");
  a.release();
  b.release();
  await pool.query("delete from raffle_numbers where campaign_id=$1", [id]);
  await pool.query("delete from orders where campaign_id=$1", [id]);
  await pool.query("delete from campaigns where id=$1", [id]);
  await pool.end();
}
