"use client";
import { useState } from "react";
import { ArrowLeft, Download, LockKeyhole, RefreshCw, ShieldCheck } from "lucide-react";
import { supabaseBrowser } from "@/lib/supabase-browser";
import { ensureMfa } from "@/lib/mfa-browser";

const entities = [
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
] as const;

function toBase64(bytes: Uint8Array) {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk)
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  return btoa(binary);
}

async function encryptJson(value: unknown, passphrase: string) {
  const enc = new TextEncoder();
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const iterations = 300000;
  const material = await crypto.subtle.importKey("raw", enc.encode(passphrase), "PBKDF2", false, [
    "deriveKey",
  ]);
  const key = await crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations, hash: "SHA-256" },
    material,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt"],
  );
  const plain = enc.encode(JSON.stringify(value));
  const encrypted = new Uint8Array(
    await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, plain),
  );
  return {
    format: "rifatrack-backup",
    version: 1,
    kdf: "PBKDF2-SHA256",
    iterations,
    salt: toBase64(salt),
    cipher: "AES-256-GCM",
    iv: toBase64(iv),
    data: toBase64(encrypted),
  };
}

export default function BackupClient() {
  const [passphrase, setPassphrase] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState("");
  const [message, setMessage] = useState("");
  async function generate() {
    if (passphrase.length < 16) {
      setMessage("Use uma senha de backup com pelo menos 16 caracteres.");
      return;
    }
    if (passphrase !== confirm) {
      setMessage("As senhas não conferem.");
      return;
    }
    setBusy(true);
    setMessage("");
    if (!(await ensureMfa("admin", "/admin/backup"))) {
      setBusy(false);
      return;
    }
    const sb = supabaseBrowser();
    const { data: counts, error: countError } = await sb.rpc("admin_backup_counts");
    if (countError) {
      setMessage("Somente o proprietário pode gerar backup.");
      setBusy(false);
      return;
    }
    const backup: {
      schema_version: number;
      generated_at: string;
      source: string;
      counts: unknown;
      entities: Record<string, unknown[]>;
    } = {
      schema_version: 1,
      generated_at: new Date().toISOString(),
      source: "RifaTrack",
      counts,
      entities: {},
    };
    for (const entity of entities) {
      const total = Number((counts as Record<string, number>)?.[entity] || 0);
      const rows: unknown[] = [];
      let offset = 0;
      do {
        setProgress(entity + " · " + Math.min(offset, total) + "/" + total);
        const { data, error } = await sb.rpc("admin_backup_chunk", {
          p_entity: entity,
          p_offset: offset,
          p_limit: 2000,
        });
        if (error) {
          setMessage("Falha ao exportar " + entity + ": " + error.message);
          setBusy(false);
          return;
        }
        const chunk = (data || []) as unknown[];
        rows.push(...chunk);
        offset += chunk.length;
        if (chunk.length < 2000) break;
      } while (offset < total);
      backup.entities[entity] = rows;
    }
    setProgress("Criptografando localmente...");
    const envelope = await encryptJson(backup, passphrase);
    const blob = new Blob([JSON.stringify(envelope)], { type: "application/octet-stream" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "rifatrack-backup-" + new Date().toISOString().replace(/[:.]/g, "-") + ".rtbackup";
    a.click();
    URL.revokeObjectURL(url);
    setPassphrase("");
    setConfirm("");
    setProgress("");
    setMessage(
      "Backup criptografado gerado. Guarde a senha separadamente; ela não é enviada ao servidor.",
    );
    setBusy(false);
  }
  return (
    <main className="min-h-screen bg-zinc-950">
      <div className="max-w-3xl mx-auto px-5 py-10">
        <a href="/admin" className="inline-flex gap-2 items-center text-sm text-zinc-400">
          <ArrowLeft size={16} /> Painel
        </a>
        <div className="mt-5 flex gap-3 items-center">
          <div className="w-12 h-12 rounded-2xl bg-emerald-950 border border-emerald-800 text-emerald-300 grid place-items-center">
            <LockKeyhole />
          </div>
          <div>
            <p className="text-emerald-400 text-sm font-bold">PROPRIETÁRIO + MFA</p>
            <h1 className="text-4xl font-black">Backup criptografado</h1>
          </div>
        </div>
        <section className="mt-7 rounded-3xl border border-zinc-800 bg-zinc-900 p-6">
          <div className="flex gap-3 text-sm text-zinc-400">
            <ShieldCheck className="shrink-0 text-emerald-400" />
            <p>
              Os dados são lidos com privilégio de proprietário e criptografados{" "}
              <b className="text-white">no seu navegador</b> com AES-256-GCM antes do download. A
              senha não é enviada ao RifaTrack.
            </p>
          </div>
          <div className="grid sm:grid-cols-2 gap-3 mt-6">
            <input
              type="password"
              minLength={16}
              value={passphrase}
              onChange={(e) => setPassphrase(e.target.value)}
              placeholder="Senha forte do backup"
              className="bg-zinc-950 border border-zinc-700 rounded-xl p-3"
            />
            <input
              type="password"
              minLength={16}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="Confirmar senha"
              className="bg-zinc-950 border border-zinc-700 rounded-xl p-3"
            />
          </div>
          <button
            disabled={busy}
            onClick={generate}
            className="mt-4 w-full rounded-xl bg-white text-black p-3 font-black inline-flex gap-2 justify-center items-center disabled:opacity-40"
          >
            {busy ? <RefreshCw className="animate-spin" size={18} /> : <Download size={18} />} Gerar
            backup
          </button>
          {progress && <p className="text-xs text-zinc-500 mt-3">{progress}</p>}
          {message && <p className="text-sm text-zinc-300 mt-4">{message}</p>}
        </section>
        <div className="mt-5 rounded-2xl border border-amber-800 bg-amber-950/20 p-4 text-sm text-amber-200">
          <b>Importante:</b> este arquivo cobre o banco operacional. Arquivos binários do bucket
          privado de comprovantes precisam de cópia separada. Em restauração, contas do Supabase
          Auth também devem ser recriadas e re-vinculadas.
        </div>
      </div>
    </main>
  );
}
