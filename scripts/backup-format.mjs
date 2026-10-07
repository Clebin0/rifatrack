import fs from "node:fs/promises";
import crypto from "node:crypto";
export const coreEntities = [
  "campaigns",
  "sellers",
  "campaign_sellers",
  "orders",
  "raffle_numbers",
  "draws",
  "draw_commitments",
  "admin_users",
  "audit_logs",
  "payment_events",
];
export function validateBackup(backup) {
  if (!backup || ![1, 2, 3].includes(backup.schema_version) || !backup.entities || !backup.counts)
    throw new Error("Schema de backup não suportado.");
  const required =
    backup.schema_version === 3
      ? [...coreEntities, "financial_cases", "notification_outbox", "order_payer_declarations"]
      : backup.schema_version === 2
        ? [...coreEntities, "financial_cases", "notification_outbox"]
        : coreEntities;
  for (const name of required) {
    const rows = backup.entities[name],
      count = backup.counts[name];
    if (!Array.isArray(rows) || !Number.isSafeInteger(count) || count < 0 || rows.length !== count)
      throw new Error("Contagem de backup inválida: " + name);
  }
  return backup;
}
export async function decryptBackup(path, passphrase) {
  const envelope = JSON.parse(await fs.readFile(path, "utf8"));
  if (
    envelope.format !== "rifatrack-backup" ||
    envelope.version !== 1 ||
    envelope.cipher !== "AES-256-GCM" ||
    envelope.kdf !== "PBKDF2-SHA256" ||
    !Number.isSafeInteger(envelope.iterations) ||
    envelope.iterations < 100000 ||
    envelope.iterations > 1000000
  )
    throw new Error("Formato de backup inválido.");
  const salt = Buffer.from(envelope.salt, "base64"),
    iv = Buffer.from(envelope.iv, "base64"),
    payload = Buffer.from(envelope.data, "base64");
  if (salt.length !== 16 || iv.length !== 12 || payload.length < 16)
    throw new Error("Backup inválido.");
  const key = crypto.pbkdf2Sync(passphrase, salt, envelope.iterations, 32, "sha256");
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(payload.subarray(-16));
  return validateBackup(
    JSON.parse(
      Buffer.concat([decipher.update(payload.subarray(0, -16)), decipher.final()]).toString("utf8"),
    ),
  );
}
export function restoreTarget(url, productionUrl, allowProduction = false) {
  if (!url || !productionUrl)
    throw new Error("RESTORE_SUPABASE_URL e PRODUCTION_SUPABASE_URL são obrigatórias.");
  const target = new URL(url),
    production = new URL(productionUrl);
  if (!["https:", "http:"].includes(target.protocol))
    throw new Error("URL de restauração inválida.");
  if (target.hostname === production.hostname && !allowProduction)
    throw new Error("Restauração direta na produção bloqueada.");
  return target.origin;
}
