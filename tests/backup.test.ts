import { it, expect } from "vitest";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import {
  coreEntities,
  validateBackup,
  decryptBackup,
  restoreTarget,
} from "../scripts/backup-format.mjs";
function fixture() {
  const names = [
    ...coreEntities,
    "financial_cases",
    "notification_outbox",
    "order_payer_declarations",
  ];
  return {
    schema_version: 3,
    counts: Object.fromEntries(names.map((name) => [name, 0])),
    entities: Object.fromEntries(names.map((name) => [name, []])),
  };
}
it("rejects incomplete and truncated operational backups", () => {
  const backup = fixture();
  expect(validateBackup(backup)).toBe(backup);
  backup.counts.financial_cases = 1;
  expect(() => validateBackup(backup)).toThrow(/Contagem/);
});
it("keeps version 2 backups readable without payer declarations", () => {
  const old = fixture();
  old.schema_version = 2;
  delete old.counts.order_payer_declarations;
  delete old.entities.order_payer_declarations;
  expect(validateBackup(old)).toBe(old);
});
it("blocks a production restore even with a trailing slash or different URL path", () => {
  expect(() =>
    restoreTarget("https://production.supabase.co/", "https://production.supabase.co"),
  ).toThrow(/produção/);
  expect(() =>
    restoreTarget("https://production.supabase.co/path", "https://production.supabase.co/"),
  ).toThrow(/produção/);
  expect(() => restoreTarget("https://staging.supabase.co", undefined)).toThrow(/obrigatórias/);
  expect(restoreTarget("https://staging.supabase.co/", "https://production.supabase.co")).toBe(
    "https://staging.supabase.co",
  );
});
it("decrypts the authenticated backup and rejects a tampered file or wrong password", async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "rifatrack-backup-test-"));
  const file = path.join(dir, "fixture.rtbackup");
  try {
    const password = "synthetic-test-password",
      salt = crypto.randomBytes(16),
      iv = crypto.randomBytes(12),
      iterations = 100000;
    const cipher = crypto.createCipheriv(
      "aes-256-gcm",
      crypto.pbkdf2Sync(password, salt, iterations, 32, "sha256"),
      iv,
    );
    const data = Buffer.concat([
      cipher.update(JSON.stringify(fixture())),
      cipher.final(),
      cipher.getAuthTag(),
    ]);
    const envelope = {
      format: "rifatrack-backup",
      version: 1,
      kdf: "PBKDF2-SHA256",
      cipher: "AES-256-GCM",
      iterations,
      salt: salt.toString("base64"),
      iv: iv.toString("base64"),
      data: data.toString("base64"),
    };
    await fs.writeFile(file, JSON.stringify(envelope));
    expect((await decryptBackup(file, password)).schema_version).toBe(3);
    await expect(decryptBackup(file, "wrong-password")).rejects.toThrow();
    data[0] ^= 1;
    await fs.writeFile(file, JSON.stringify({ ...envelope, data: data.toString("base64") }));
    await expect(decryptBackup(file, password)).rejects.toThrow();
  } finally {
    if (
      path.dirname(path.resolve(dir)) === path.resolve(os.tmpdir()) &&
      path.basename(dir).startsWith("rifatrack-backup-test-")
    )
      await fs.rm(dir, { recursive: true, force: true });
  }
});
