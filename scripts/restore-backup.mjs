import { decryptBackup, restoreTarget } from "./backup-format.mjs";
import { createClient } from "@supabase/supabase-js";

async function chunks(rows, size = 400) {
  const out = [];
  for (let i = 0; i < rows.length; i += size) out.push(rows.slice(i, i + size));
  return out;
}
async function write(client, table, rows, onConflict) {
  for (const batch of await chunks(rows)) {
    if (!batch.length) continue;
    const q = onConflict
      ? client.from(table).upsert(batch, { onConflict })
      : client.from(table).insert(batch);
    const { error } = await q;
    if (error) throw new Error(table + ": " + error.message);
  }
  console.log("RESTORED", table, rows.length);
}

const [file] = process.argv.slice(2);
const password = process.env.BACKUP_PASSPHRASE;
const url = process.env.RESTORE_SUPABASE_URL;
const key = process.env.RESTORE_SUPABASE_SERVICE_ROLE_KEY;
if (process.env.ALLOW_RIFATRACK_RESTORE !== "YES")
  throw new Error("Defina ALLOW_RIFATRACK_RESTORE=YES conscientemente.");
if (!file || !password || !url || !key)
  throw new Error(
    "Faltam arquivo, BACKUP_PASSPHRASE, RESTORE_SUPABASE_URL ou RESTORE_SUPABASE_SERVICE_ROLE_KEY.",
  );
const targetUrl = restoreTarget(
  url,
  process.env.PRODUCTION_SUPABASE_URL,
  process.env.ALLOW_PRODUCTION_RESTORE === "YES",
);

const backup = await decryptBackup(file, password);
const client = createClient(targetUrl, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const { count, error: countError } = await client
  .from("campaigns")
  .select("*", { count: "exact", head: true });
if (countError) throw countError;
if ((count || 0) > 0 && process.env.ALLOW_NONEMPTY_TARGET !== "YES")
  throw new Error(
    "Destino não está vazio. Use ALLOW_NONEMPTY_TARGET=YES somente após conferência.",
  );

const e = backup.entities;
await write(client, "campaigns", e.campaigns || [], "id");
await write(client, "sellers", e.sellers || [], "id");
await write(client, "admin_users", e.admin_users || [], "email");
await write(client, "campaign_sellers", e.campaign_sellers || [], "campaign_id,seller_id");
await write(client, "orders", e.orders || [], "id");
await write(client, "raffle_numbers", e.raffle_numbers || [], "id");
await write(client, "draw_commitments", e.draw_commitments || [], "campaign_id");
await write(client, "draws", e.draws || [], "id");
await write(
  client,
  "audit_logs",
  (e.audit_logs || []).map(({ id, ...x }) => x),
);
await write(
  client,
  "payment_events",
  (e.payment_events || []).map(({ id, ...x }) => x),
);
await write(client, "financial_cases", e.financial_cases || [], "id");
// Restore the queue for audit, but never resend historical mail automatically.
await write(
  client,
  "notification_outbox",
  (e.notification_outbox || []).map((row) => ({
    ...row,
    status: row.status === "sent" ? "sent" : "failed",
    attempts: 5,
    claim_token: null,
    lease_until: null,
    last_error: row.status === "sent" ? row.last_error : "restore_delivery_paused",
  })),
  "id",
);
console.log(
  "Restauração de dados concluída. Recrie/revincule contas Auth, confira comprovantes do Storage e rotacione segredos antes de promover o ambiente.",
);
