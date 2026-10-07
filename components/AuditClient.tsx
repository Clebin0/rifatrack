"use client";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, RefreshCw } from "lucide-react";
import { supabaseBrowser } from "@/lib/supabase-browser";
import { ensureSession } from "@/lib/mfa-browser";
type Audit = {
  id: number;
  actor_email: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  payload: Record<string, unknown>;
  created_at: string;
};
type Event = {
  id: number;
  provider: string;
  provider_event_id: string;
  event_type: string;
  provider_payment_id: string | null;
  provider_qr_id: string | null;
  processed: boolean;
  processing_note: string | null;
  created_at: string;
};
type Data = { audit_logs: Audit[]; payment_events: Event[] };
export default function AuditClient() {
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  async function load() {
    setLoading(true);
    if (!(await ensureSession("admin", "/admin/auditoria"))) {
      setLoading(false);
      return;
    }
    const sb = supabaseBrowser();
    const { data: d, error } = await sb.rpc("admin_audit_dashboard");
    if (!error) setData(d as Data);
    setLoading(false);
  }
  useEffect(() => {
    load();
  }, []);
  const audits = useMemo(
    () =>
      data?.audit_logs.filter((x) =>
        [x.actor_email, x.action, x.entity_type, x.entity_id]
          .join(" ")
          .toLowerCase()
          .includes(search.toLowerCase()),
      ) || [],
    [data, search],
  );
  const events = useMemo(
    () =>
      data?.payment_events.filter((x) =>
        [x.event_type, x.provider_event_id, x.provider_payment_id, x.processing_note]
          .join(" ")
          .toLowerCase()
          .includes(search.toLowerCase()),
      ) || [],
    [data, search],
  );
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
      <div className="max-w-7xl mx-auto px-5 py-8 space-y-8">
        <div className="flex flex-col sm:flex-row justify-between gap-4">
          <div>
            <a href="/admin" className="text-zinc-400 inline-flex gap-2 items-center text-sm">
              <ArrowLeft size={16} /> Painel
            </a>
            <h1 className="text-4xl font-black mt-3">Auditoria</h1>
            <p className="text-zinc-500">
              Trilha administrativa e eventos do provedor de pagamentos.
            </p>
          </div>
          <div className="flex gap-2">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar evento"
              className="bg-zinc-900 border border-zinc-700 rounded-xl px-3 py-2"
            />
            <button onClick={load} className="p-3 bg-zinc-900 border border-zinc-800 rounded-xl">
              <RefreshCw />
            </button>
          </div>
        </div>
        <section className="rounded-3xl border border-zinc-800 bg-zinc-900 p-5">
          <h2 className="text-xl font-black">Ações administrativas</h2>
          <div className="overflow-x-auto mt-4">
            <table className="w-full text-sm">
              <thead className="text-zinc-500 text-left">
                <tr>
                  <th className="pb-3">Data</th>
                  <th>Ator</th>
                  <th>Ação</th>
                  <th>Entidade</th>
                  <th>Detalhes</th>
                </tr>
              </thead>
              <tbody>
                {audits.map((x) => (
                  <tr key={x.id} className="border-t border-zinc-800">
                    <td className="py-3 whitespace-nowrap">
                      {new Date(x.created_at).toLocaleString("pt-BR")}
                    </td>
                    <td>{x.actor_email || "sistema"}</td>
                    <td className="font-mono text-xs">{x.action}</td>
                    <td>
                      {x.entity_type}
                      {x.entity_id ? " · " + x.entity_id : ""}
                    </td>
                    <td
                      className="max-w-[300px] truncate text-xs text-zinc-500"
                      title={JSON.stringify(x.payload)}
                    >
                      {JSON.stringify(x.payload)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
        <section className="rounded-3xl border border-zinc-800 bg-zinc-900 p-5">
          <h2 className="text-xl font-black">Eventos de pagamento</h2>
          <div className="overflow-x-auto mt-4">
            <table className="w-full text-sm">
              <thead className="text-zinc-500 text-left">
                <tr>
                  <th className="pb-3">Data</th>
                  <th>Evento</th>
                  <th>Pagamento</th>
                  <th>Processado</th>
                  <th>Resultado</th>
                </tr>
              </thead>
              <tbody>
                {events.map((x) => (
                  <tr key={x.id} className="border-t border-zinc-800">
                    <td className="py-3 whitespace-nowrap">
                      {new Date(x.created_at).toLocaleString("pt-BR")}
                    </td>
                    <td>
                      <b>{x.event_type}</b>
                      <div className="font-mono text-xs text-zinc-500">{x.provider_event_id}</div>
                    </td>
                    <td className="font-mono text-xs">{x.provider_payment_id || "—"}</td>
                    <td>{x.processed ? "sim" : "não"}</td>
                    <td className="text-zinc-400">{x.processing_note || "—"}</td>
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
