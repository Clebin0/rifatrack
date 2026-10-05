import { decryptBackup } from "./backup-format.mjs";
const [file] = process.argv.slice(2),
  password = process.env.BACKUP_PASSPHRASE;
if (!file || !password) throw new Error("Informe arquivo e BACKUP_PASSPHRASE.");
try {
  const backup = await decryptBackup(file, password);
  console.log("Backup válido:", backup.generated_at);
  for (const [name, rows] of Object.entries(backup.entities))
    console.log("PASS", name, rows.length);
  if (backup.schema_version === 1)
    console.log("WARN: backup antigo não inclui conciliação/fila adicionadas na versão 2.");
} catch (error) {
  console.error("Falha ao verificar backup:", error.message);
  process.exitCode = 1;
}
