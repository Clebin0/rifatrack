"use client";
import { useEffect, useState } from "react";
import { ArrowLeft, Mail, RefreshCw, Send } from "lucide-react";
import { supabaseBrowser } from "@/lib/supabase-browser";
import { ensureSession } from "@/lib/mfa-browser";

type Item = {
  id: string;
  recipient: string;
  template: string;
  status: string;
  attempts: number;
  last_error: string | null;
  created_at: string;
  sent_at: string | null;
  next_attempt_at: string;
};
type Data = {
  summary: { pending: number; failed: number; sent: number; processing: number };
  items: Item[];
};

export default function NotificationsClient() {
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [configured, setConfigured] = useState<boolean | null>(null);
  async function load() {
    setLoading(true);
    if (!(await ensureSession("admin", "/admin/notificacoes"))) {
      setLoading(false);
      return;
    }
    const sb = supabaseBrowser();
    const [{ data: d, error }, status] = await Promise.all([
      sb.rpc("admin_notification_dashboard"),
      fetch("/api/integrations/notifications-status", { cache: "no-store" })
        .then((r) => r.json())
        .catch(() => null),
    ]);
    if (!error) setData(d as Data);
    setConfigured(Boolean(status?.configured));
    setLoading(false);
  }
  useEffect(() => {
    load();
  }, []);
  async function processQueue() {
    setMessage("");
    const sb = supabaseBrowser();
    const { data: s } = await sb.auth.getSession();
    const token = s.session?.access_token;
    if (!token) return;
    const r = await fetch("/api/admin/notifications/process", {
      method: "POST",
      headers: { Authorization: "Bearer " + token },
    });
    const body = await r.json();
    if (!r.ok) setMessage(body.error || "Falha ao processar.");
    else
      setMessage(`Processadas ${body.processed}; enviadas ${body.sent}; falharam ${body.failed}.`);
    await load();
  }
  if (loading)
    return (
      <main className="min-h-screen grid place-items-center bg-zinc-950">
        <RefreshCw className="animate-spin" />
      </main>
    );
  if (!data)
    return (
      <main className="min-h-screen grid place-items-center bg-zinc-950">
        Acesso administrativo necessário.
      </main>
    );
  return (
    <main className="min-h-screen bg-zinc-950">
      <div className="max-w-7xl mx-auto px-5 py-8 space-y-6">
        <div className="flex justify-between gap-4">
          <div>
            <a href="/admin" className="inline-flex gap-2 items-center text-sm text-zinc-400">
              <ArrowLeft size={16} /> Painel
            </a>
            <h1 className="text-4xl font-black mt-3">Notificações</h1>
            <p className="text-zinc-500 mt-1">
              Fila de e-mails transacionais e tentativas de reenvio.
            </p>
          </div>
          <button
            onClick={load}
            className="p-3 rounded-xl bg-zinc-900 border border-zinc-800 h-fit"
          >
            <RefreshCw />
          </button>
        </div>
        <div
          className={
            "rounded-2xl border p-4 text-sm " +
            (configured
              ? "border-emerald-800 bg-emerald-950/30"
              : "border-amber-800 bg-amber-950/20")
          }
        >
          <b>Resend:</b>{" "}
          {configured
            ? "configurado"
            : "aguardando credenciais RESEND_API_KEY e NOTIFICATION_FROM_EMAIL"}
        </div>
        {message && (
          <div className="rounded-xl border border-zinc-700 bg-zinc-900 p-3 text-sm">{message}</div>
        )}
        <section className="grid sm:grid-cols-4 gap-4">
          {[
            ["Pendentes", data.summary.pending],
            ["Processando", data.summary.processing],
            ["Enviadas", data.summary.sent],
            ["Falhas", data.summary.failed],
          ].map(([l, v]) => (
            <div key={String(l)} className="rounded-3xl border border-zinc-800 bg-zinc-900 p-5">
              <Mail className="text-zinc-500" />
              <p className="text-3xl font-black mt-4">{v}</p>
              <p className="text-zinc-500 text-sm">{l}</p>
            </div>
          ))}
        </section>
        <div>
          <button
            disabled={!configured}
            onClick={processQueue}
            className="inline-flex gap-2 items-center rounded-xl bg-white text-black px-4 py-3 font-black disabled:opacity-40"
          >
            <Send size={17} /> Processar fila agora
          </button>
        </div>
        <section className="rounded-3xl border border-zinc-800 bg-zinc-900 p-5">
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[850px]">
              <thead className="text-zinc-500 text-left">
                <tr>
                  <th className="pb-3">Data</th>
                  <th>Destino</th>
                  <th>Template</th>
                  <th>Status</th>
                  <th>Tentativas</th>
                  <th>Erro</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((i) => (
                  <tr key={i.id} className="border-t border-zinc-800">
                    <td className="py-3 whitespace-nowrap">
                      {new Date(i.created_at).toLocaleString("pt-BR")}
                    </td>
                    <td>{i.recipient}</td>
                    <td className="font-mono text-xs">{i.template}</td>
                    <td>{i.status}</td>
                    <td>{i.attempts}</td>
                    <td
                      className="text-xs text-zinc-500 max-w-[320px] truncate"
                      title={i.last_error || ""}
                    >
                      {i.last_error || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}
