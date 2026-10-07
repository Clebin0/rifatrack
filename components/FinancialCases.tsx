"use client";
import { useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase-browser";
type Case = {
  id: string;
  reason: string;
  status: string;
  resolution: string | null;
  campaign_name: string;
  payment_reference: string;
  provider_payment_id: string | null;
  amount_cents: number;
};
export default function FinancialCases() {
  const [items, setItems] = useState<Case[]>([]),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false),
    [notes, setNotes] = useState<Record<string, string>>({});
  async function load() {
    const { data, error } = await supabaseBrowser().rpc("admin_financial_cases");
    if (error)
      setMessage("Entre com uma conta financeira autorizada para consultar a conciliação.");
    else setItems(data as unknown as Case[]);
  }
  useEffect(() => {
    void load();
  }, []);
  async function resolve(item: Case) {
    const resolution = notes[item.id]?.trim() || "";
    if (resolution.length < 20) {
      setMessage("Descreva a conciliação e a referência do provedor (mínimo de 20 caracteres).");
      return;
    }
    setBusy(true);
    setMessage("");
    try {
      const { error } = await supabaseBrowser().rpc("admin_resolve_financial_case", {
        p_id: item.id,
        p_resolution: resolution,
      });
      if (error) setMessage("Confirme o MFA e confira sua permissão financeira antes de concluir.");
      else {
        setMessage("Conciliação registrada na auditoria.");
        await load();
      }
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="max-w-4xl mx-auto px-5 py-10">
      <a href="/admin" className="text-emerald-300">
        ← Administração
      </a>
      <h1 className="text-3xl font-bold mt-5">Conciliação financeira</h1>
      <p className="text-zinc-300 mt-4">
        Confira o pagamento no Asaas. Efetue o estorno pelo provedor quando aplicável e registre a
        referência. Resolver um caso aqui apenas registra a conciliação; não movimenta dinheiro nem
        garante números expirados.
      </p>
      <p role="status" className="text-amber-300 mt-4">
        {message}
      </p>
      {items.map((item) => (
        <section key={item.id} className="border border-zinc-800 rounded-2xl p-5 mt-5">
          <h2 className="font-bold">
            {item.campaign_name} · {item.payment_reference}
          </h2>
          <p className="mt-2">
            {item.reason} · {item.status} · R$ {(item.amount_cents / 100).toFixed(2)}
          </p>
          <p className="text-sm break-all">
            Transação: {item.provider_payment_id || "não identificada"}
          </p>
          {item.status === "open" ? (
            <>
              <label htmlFor={item.id} className="block mt-3">
                Registro da conciliação
              </label>
              <textarea
                id={item.id}
                value={notes[item.id] || ""}
                onChange={(e) => setNotes({ ...notes, [item.id]: e.target.value })}
                minLength={20}
                maxLength={2000}
                className="bg-zinc-900 border border-zinc-700 p-3 w-full rounded-xl mt-2"
              />
              <button
                disabled={busy}
                onClick={() => resolve(item)}
                className="rounded-xl bg-emerald-400 text-emerald-950 font-bold px-4 py-2 mt-3 disabled:opacity-50"
              >
                Registrar resolução
              </button>
            </>
          ) : (
            <p className="mt-3 text-zinc-300">{item.resolution}</p>
          )}
        </section>
      ))}
    </main>
  );
}
