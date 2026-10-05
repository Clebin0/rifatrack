import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { winningNumber, QUICKNET, sha256 } from "../lib/drand.ts";
export async function securityCases(db) {
  const q = async (sql, params = []) => (await db.query(sql, params)).rows[0];
  await db.query("begin");
  try {
    for (const role of ["anon", "authenticated"]) {
      for (const signature of [
        "public_active_campaigns()",
        "public_campaign(text,text)",
        "public_order(uuid)",
        "public_draw_result(text)",
        "public_draw_verification(text)",
      ]) {
        assert.equal(
          (
            await q("select has_function_privilege($1,$2,'execute') allowed", [
              role,
              "public." + signature,
            ])
          ).allowed,
          false,
          `${role} cannot bypass the HTTP rate limit through ${signature}`,
        );
      }
      const denied = await q(
        `select count(*)::int n from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and (p.proname like '%_internal' or p.proname in ('reserve_raffle_numbers','attach_asaas_qr','process_asaas_event','internal_secret_ok','admin_draw_campaign')) and has_function_privilege($1,p.oid,'execute')`,
        [role],
      );
      assert.equal(denied.n, 0, `${role} cannot call financial/internal RPCs`);
    }
    const campaign = await q(
      "insert into campaigns(name,slug,price_cents,total_numbers,status) values('SQL Test','sql-security-test',500,10,'active') returning id",
    );
    await db.query(
      "insert into raffle_numbers(campaign_id,number) select $1,generate_series(1,10)",
      [campaign.id],
    );
    const reserve = async (numbers, phone = "11999998888") =>
      (
        await q(
          "select reserve_raffle_numbers($1,'sql-security-test',null,'Teste Comprador',$2,'test@example.org',$3) result",
          ["a".repeat(64), phone, numbers],
        )
      ).result;
    const first = await reserve([1, 2]);
    await db.query("savepoint rejected");
    await assert.rejects(() => reserve([1], "11999997777"), /number unavailable/);
    await db.query("rollback to savepoint rejected");
    assert.equal(
      (await q("select count(*)::int n from orders where campaign_id=$1", [campaign.id])).n,
      1,
    );
    assert.equal(
      (await q("select public_order($1) result", [first.public_token])).result.buyer_name,
      "Comprador",
    );
    await db.query("select attach_asaas_qr($1,'qr-sql-test','pix-test')", [first.id]);
    const event = async (
      id,
      type = "PAYMENT_RECEIVED",
      amount = 1000,
      qr = "qr-sql-test",
      order = first.id,
    ) =>
      (
        await q(
          "select process_asaas_event($1,$2,$6,$3,'RECEIVED',$4,$4,now(),'pix-test','{}'::jsonb,$5) result",
          [id, type, qr, amount, order, "payment-" + order],
        )
      ).result;
    assert.equal((await event("evt-bad-value", "PAYMENT_RECEIVED", 999)).note, "AMOUNT_MISMATCH");
    assert.equal((await q("select status from orders where id=$1", [first.id])).status, "pending");
    assert.equal(
      (await event("evt-bad-reference", "PAYMENT_RECEIVED", 1000, "wrong-qr")).note,
      "EXTERNAL_REFERENCE_MISMATCH",
    );
    assert.equal(
      (await event("evt-confirmed", "PAYMENT_CONFIRMED")).note,
      "confirmed_awaiting_received",
    );
    assert.equal((await q("select status from orders where id=$1", [first.id])).status, "pending");
    assert.equal((await event("evt-received")).note, "paid");
    assert.equal((await event("evt-received")).duplicate, true);
    assert.equal(
      (
        await q("select count(*)::int n from raffle_numbers where order_id=$1 and status='paid'", [
          first.id,
        ])
      ).n,
      2,
    );
    await event("evt-chargeback", "PAYMENT_CHARGEBACK_REQUESTED");
    assert.equal((await q("select status from orders where id=$1", [first.id])).status, "paid");
    await event("evt-refunded", "PAYMENT_REFUNDED");
    assert.equal(
      (await q("select status from orders where id=$1", [first.id])).status,
      "cancelled",
    );
    assert.equal(
      (
        await q(
          "select count(*)::int n from raffle_numbers where campaign_id=$1 and number in(1,2) and status='available'",
          [campaign.id],
        )
      ).n,
      2,
    );
    const late = await reserve([3], "11999996666");
    await db.query("select attach_asaas_qr($1,'late-qr','pix-test')", [late.id]);
    await db.query("update orders set expires_at=now()-interval '10 minutes' where id=$1", [
      late.id,
    ]);
    assert.equal(
      (await event("evt-late", "PAYMENT_RECEIVED", 500, "late-qr", late.id)).note,
      "PAYMENT_RECEIVED_AFTER_LOCAL_CLOSE",
    );
    assert.equal(
      (await q("select status from raffle_numbers where order_id=$1", [late.id])).status,
      "reserved",
    );
    await db.query("select enqueue_order_notification_internal($1,'reserved')", [late.id]);
    const batch = (await q("select claim_notification_batch_internal(5) result")).result;
    assert.ok(batch.length > 0 && batch.length <= 5);
    const item = batch[0];
    await db.query(
      "update notification_outbox set lease_until=now()-interval '1 minute' where id=$1",
      [item.id],
    );
    const reclaimed = (await q("select claim_notification_batch_internal(5) result")).result.find(
      (x) => x.id === item.id,
    );
    assert.ok(reclaimed);
    assert.notEqual(reclaimed.claim_token, item.claim_token);
    assert.equal(
      (
        await q("select finish_notification_internal($1::uuid,$2::uuid,true) result", [
          item.id,
          item.claim_token,
        ])
      ).result,
      false,
    );
    assert.equal(
      (
        await q("select finish_notification_internal($1::uuid,$2::uuid,true) result", [
          item.id,
          reclaimed.claim_token,
        ])
      ).result,
      true,
    );
    const key = "f".repeat(64);
    assert.equal(
      (await q("select consume_rate_limit_internal($1,1,60) result", [key])).result.allowed,
      true,
    );
    assert.equal(
      (await q("select consume_rate_limit_internal($1,1,60) result", [key])).result.allowed,
      false,
    );
    const actor = "draw-test@example.org",
      uid = "11111111-1111-4111-8111-111111111111";
    await db.query("insert into auth.users(id,email) values($1,$2)", [uid, actor]);
    await db.query("insert into admin_users(email,active,role) values($1,true,'owner')", [actor]);
    await db.query("select set_config('request.jwt.claims',$1,true)", [
      JSON.stringify({ sub: uid, email: actor, aal: "aal2" }),
    ]);
    await db.query(
      "update financial_cases set status='resolved' where order_id in(select id from orders where campaign_id=$1)",
      [campaign.id],
    );
    await db.query(
      "update raffle_numbers set status='available',order_id=null,reserved_until=null where order_id=$1",
      [late.id],
    );
    await db.query("update orders set status='expired' where id=$1", [late.id]);
    const drawOrder = await reserve([5, 6], "11999995555");
    await db.query("update orders set status='paid' where id=$1", [drawOrder.id]);
    await db.query(
      "update raffle_numbers set status='paid',reserved_until=null where order_id=$1",
      [drawOrder.id],
    );
    await db.query("select admin_set_campaign_status($1,'closed')", [campaign.id]);
    const frozen = await q(
      "select eligible_numbers,paid_list_hash,drand_round from draw_commitments where campaign_id=$1",
      [campaign.id],
    );
    assert.deepEqual(frozen.eligible_numbers, [5, 6]);
    assert.ok(frozen.drand_round > (Date.now() / 1000 - QUICKNET.genesis_time) / 3);
    const beacon = JSON.parse(
      await fs.readFile(new URL("../tests/drand-beacon.json", import.meta.url), "utf8"),
    );
    // Simulate the committed future round becoming available, without waiting five minutes.
    await db.query(
      "update draw_commitments set drand_round=$2,beacon_commitment=$3 where campaign_id=$1",
      [
        campaign.id,
        beacon.round,
        await sha256(`${QUICKNET.hash}:${beacon.round}:${frozen.paid_list_hash}`),
      ],
    );
    const draw = await q("select complete_drand_draw_internal($1,$2,$3,$4,$5) result", [
      campaign.id,
      beacon.round,
      beacon.randomness,
      beacon.signature,
      actor,
    ]);
    assert.equal(
      draw.result.number,
      await winningNumber(beacon.randomness, frozen.paid_list_hash, frozen.eligible_numbers),
    );
    const repeated = await q("select complete_drand_draw_internal($1,$2,$3,$4,$5) result", [
      campaign.id,
      beacon.round,
      beacon.randomness,
      beacon.signature,
      actor,
    ]);
    assert.equal(repeated.result.already_drawn, true);
    const proof = (await q("select public_draw_verification('sql-security-test') result")).result;
    assert.deepEqual(proof.eligible_numbers, [5, 6]);
    assert.equal(proof.number, draw.result.number);
    const counts = (await q("select admin_backup_counts() result")).result;
    for (const entity of ["financial_cases", "notification_outbox"]) {
      assert.ok(counts[entity] > 0);
      const rows = (await q("select admin_backup_chunk($1,0,2000) result", [entity])).result;
      assert.equal(rows.length, counts[entity]);
    }
    console.log(
      "PASS RPC permissions, exclusive reservation, PII masking, payment matching/idempotency/refund/chargeback/late payment, leases and rate limits",
    );
  } finally {
    await db.query("rollback");
  }
}
