"use client";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { ArrowLeft, CheckCircle2, MessageCircle, RefreshCw, ShieldCheck } from "lucide-react";
import { supabaseBrowser } from "@/lib/supabase-browser";
import { ensureMfa, ensureSession, getMfaLevel } from "@/lib/mfa-browser";

type Campaign = {
  id: string;
  name: string;
  slug: string;
  price_cents: number;
  total_numbers: number;
  status: string;
  finalized_at: string | null;
  ends_at: string | null;
};
type Seller = {
  campaign_id: string;
  id: string;
  name: string;
  code: string;
  team: string;
  active: boolean;
};
type Dashboard = { campaigns: Campaign[]; sellers: Seller[] };
const money = (v: number) => "R$ " + (v / 100).toFixed(2).replace(".", ",");
const input =
  "w-full bg-zinc-950 border border-zinc-700 rounded-xl p-3 outline-none focus:border-indigo-500";
function localNow() {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}
function parseNumbers(raw: string, total: number) {
  const values = new Set<number>();
  const bad: string[] = [];
  for (const token of raw
    .split(/[\s,;]+/)
    .map((x) => x.trim())
    .filter(Boolean)) {
    const range = token.match(/^(\d+)-(\d+)$/);
    if (range) {
      const a = Number(range[1]),
        b = Number(range[2]);
      if (a < 1 || b < a || b > total || b - a > 499) {
        bad.push(token);
        continue;
      }
      for (let n = a; n <= b; n++) values.add(n);
    } else {
      const n = Number(token);
      if (!Number.isInteger(n) || n < 1 || n > total) bad.push(token);
      else values.add(n);
    }
    if (values.size > 500) throw new Error("Máximo de 500 números por lançamento.");
  }
  if (bad.length) throw new Error("Números/intervalos inválidos: " + bad.slice(0, 8).join(", "));
  return [...values].sort((a, b) => a - b);
}

export default function ManualSalesClient() {
  const sb = () => supabaseBrowser();
  const [data, setData] = useState<Dashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [mfa, setMfa] = useState(false);
  const [message, setMessage] = useState("");
  const [form, setForm] = useState({
    campaign_id: "",
    seller_id: "",
    buyer_name: "",
    buyer_phone: "",
    buyer_email: "",
    numbers: "",
    sales_channel: "whatsapp",
    paid_at: localNow(),
    note: "",
  });
  async function load() {
    setLoading(true);
    setMessage("");
    if (!(await ensureSession("admin", "/admin/vendas-manuais"))) {
      setLoading(false);
      return;
    }
    setMfa((await getMfaLevel()) === "aal2");
    const { data: d, error } = await sb().rpc("admin_dashboard");
    if (error) {
      setMessage("Não foi possível carregar o painel.");
      setData(null);
    } else {
      const x = d as Dashboard;
      setData(x);
      if (!form.campaign_id) {
        const campaign =
          x.campaigns.find((c) => !c.finalized_at && c.status !== "closed") || x.campaigns[0];
        if (campaign) setForm((v) => ({ ...v, campaign_id: campaign.id }));
      }
    }
    setLoading(false);
  }
  useEffect(() => {
    load();
  }, []);
  const campaign = data?.campaigns.find((c) => c.id === form.campaign_id) || null;
  const sellers = useMemo(
    () => data?.sellers.filter((s) => s.campaign_id === form.campaign_id && s.active) || [],
    [data, form.campaign_id],
  );
  const parsed = useMemo(() => {
    try {
      return { numbers: parseNumbers(form.numbers, campaign?.total_numbers || 0), error: "" };
    } catch (e) {
      return {
        numbers: [] as number[],
        error: e instanceof Error ? e.message : "Entrada inválida",
      };
    }
  }, [form.numbers, campaign?.total_numbers]);
  const requiresSeller = sellers.length > 0;
  const total = parsed.numbers.length * (campaign?.price_cents || 0);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setMessage("");
    if (!campaign || campaign.finalized_at || campaign.status === "closed") {
      setMessage("Essa campanha já foi finalizada.");
      return;
    }
    if (parsed.error || !parsed.numbers.length) {
      setMessage(parsed.error || "Informe pelo menos um número.");
      return;
    }
    if (requiresSeller && !form.seller_id) {
      setMessage("Selecione o vendedor responsável pela venda.");
      return;
    }
    setSaving(true);
    if (!(await ensureMfa("admin", "/admin/vendas-manuais"))) {
      setSaving(false);
      return;
    }
    if (
      !confirm(
        "Registrar " +
          parsed.numbers.length +
          " número(s) como PAGOS por " +
          money(total) +
          "?\n\nUse esta opção somente para vendas que já foram realmente recebidas.",
      )
    ) {
      setSaving(false);
      return;
    }
    const { data: result, error } = await sb().rpc("admin_import_paid_numbers", {
      p_campaign_id: campaign.id,
      p_seller_id: form.seller_id || undefined,
      p_buyer_name: form.buyer_name,
      p_buyer_phone: form.buyer_phone,
      p_buyer_email: form.buyer_email,
      p_numbers: parsed.numbers,
      p_sales_channel: form.sales_channel,
      p_paid_at: form.paid_at ? new Date(form.paid_at).toISOString() : undefined,
      p_note: form.note,
    });
    if (error) {
      const msg = error.message || "";
      setMessage(
        msg.includes("number unavailable")
          ? "Um ou mais números já estão pagos ou reservados. Confira a lista."
          : msg.includes("seller required")
            ? "Selecione um vendedor."
            : msg.includes("campaign finalized")
              ? "A campanha já foi finalizada e a lista paga está congelada."
              : msg.includes("mfa")
                ? "Confirme seu MFA para registrar vendas pagas."
                : "Não foi possível registrar: " + msg,
      );
      setSaving(false);
      return;
    }
    const x = result as { payment_reference?: string };
    setMessage(
      "Venda manual registrada como paga" +
        (x?.payment_reference ? " · " + x.payment_reference : "") +
        ".",
    );
    setForm((v) => ({
      ...v,
      buyer_name: "",
      buyer_phone: "",
      buyer_email: "",
      numbers: "",
      note: "",
      paid_at: localNow(),
    }));
    setSaving(false);
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
      <main className="min-h-screen grid place-items-center bg-zinc-950 p-5">
        <div className="text-center">
          <p>{message || "Acesso administrativo necessário."}</p>
          <a href="/admin" className="text-indigo-300 mt-3 inline-block">
            Voltar
          </a>
        </div>
      </main>
    );
  return (
    <main className="min-h-screen bg-zinc-950">
      <div className="max-w-4xl mx-auto px-5 py-8 space-y-6">
        <div>
          <a href="/admin" className="inline-flex gap-2 items-center text-sm text-zinc-400">
            <ArrowLeft size={16} /> Painel
          </a>
          <div className="flex gap-3 items-center mt-4">
            <div className="w-12 h-12 rounded-2xl bg-indigo-950 border border-indigo-800 text-indigo-300 grid place-items-center">
              <MessageCircle />
            </div>
            <div>
              <p className="text-indigo-300 text-sm font-bold">CONCILIAÇÃO MANUAL</p>
              <h1 className="text-4xl font-black">Vendas feitas fora do site</h1>
            </div>
          </div>
          <p className="text-zinc-500 mt-3">
            Use para números vendidos e já pagos por WhatsApp, presencialmente ou em outra rifa
            manual. O lançamento entra no financeiro, no vendedor e no sorteio como uma venda paga.
          </p>
        </div>
        {!mfa && (
          <div className="rounded-2xl border border-amber-800 bg-amber-950/20 p-4 text-sm text-amber-100 flex gap-3">
            <ShieldCheck className="shrink-0" />
            <div>
              <b>MFA necessário para confirmar.</b>
              <p className="text-amber-200/70 mt-1">
                Você pode preencher tudo agora. Ao registrar, o sistema abre a etapa de segurança.
              </p>
            </div>
          </div>
        )}
        {message && (
          <div className="rounded-xl border border-zinc-700 bg-zinc-900 p-3 text-sm">{message}</div>
        )}
        <form
          onSubmit={submit}
          className="rounded-3xl border border-zinc-800 bg-zinc-900 p-6 space-y-5"
        >
          <div className="grid sm:grid-cols-2 gap-3">
            <label>
              <span className="text-xs text-zinc-500">Campanha</span>
              <select
                value={form.campaign_id}
                onChange={(e) => setForm({ ...form, campaign_id: e.target.value, seller_id: "" })}
                className={input + " mt-1"}
              >
                {data.campaigns.map((c) => (
                  <option
                    key={c.id}
                    value={c.id}
                    disabled={Boolean(c.finalized_at || c.status === "closed")}
                  >
                    {c.name}
                    {c.finalized_at ? " · finalizada" : ""}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span className="text-xs text-zinc-500">
                Vendedor {requiresSeller ? "(obrigatório)" : ""}
              </span>
              <select
                value={form.seller_id}
                onChange={(e) => setForm({ ...form, seller_id: e.target.value })}
                className={input + " mt-1"}
              >
                <option value="">Venda direta / sem vendedor</option>
                {sellers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} · {s.code}
                    {s.team ? " · " + s.team : ""}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div>
            <label className="text-xs text-zinc-500">Números já pagos</label>
            <textarea
              required
              rows={5}
              value={form.numbers}
              onChange={(e) => setForm({ ...form, numbers: e.target.value })}
              placeholder={"Ex.: 2, 8, 15, 21\nTambém aceita intervalos: 30-35"}
              className={input + " mt-1 font-mono"}
            />
            <div className="mt-2 flex flex-wrap gap-3 text-xs">
              <span className={parsed.error ? "text-rose-300" : "text-zinc-500"}>
                {parsed.error || parsed.numbers.length + " número(s) válido(s)"}
              </span>
              {!parsed.error && parsed.numbers.length > 0 && (
                <b className="text-emerald-300">{money(total)}</b>
              )}
            </div>
          </div>
          <div className="grid sm:grid-cols-3 gap-3">
            <input
              value={form.buyer_name}
              onChange={(e) => setForm({ ...form, buyer_name: e.target.value })}
              placeholder="Comprador (opcional)"
              className={input}
            />
            <input
              value={form.buyer_phone}
              onChange={(e) => setForm({ ...form, buyer_phone: e.target.value })}
              placeholder="Telefone (opcional)"
              className={input}
            />
            <input
              type="email"
              value={form.buyer_email}
              onChange={(e) => setForm({ ...form, buyer_email: e.target.value })}
              placeholder="E-mail (opcional)"
              className={input}
            />
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <label>
              <span className="text-xs text-zinc-500">Origem</span>
              <select
                value={form.sales_channel}
                onChange={(e) => setForm({ ...form, sales_channel: e.target.value })}
                className={input + " mt-1"}
              >
                <option value="whatsapp">WhatsApp</option>
                <option value="presencial">Presencial</option>
                <option value="outro">Outro</option>
              </select>
            </label>
            <label>
              <span className="text-xs text-zinc-500">Data/hora do pagamento</span>
              <input
                type="datetime-local"
                value={form.paid_at}
                onChange={(e) => setForm({ ...form, paid_at: e.target.value })}
                className={input + " mt-1"}
              />
            </label>
          </div>
          <textarea
            rows={3}
            maxLength={500}
            value={form.note}
            onChange={(e) => setForm({ ...form, note: e.target.value })}
            placeholder="Observação opcional: ex. vendido no grupo do WhatsApp antes do site"
            className={input}
          />
          <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4 flex gap-3">
            <CheckCircle2 className="text-emerald-400 shrink-0" />
            <p className="text-sm text-zinc-400">
              Ao confirmar, esses números passam diretamente para <b className="text-white">Pago</b>
              . Se algum já estiver reservado ou pago, o banco recusa o lançamento inteiro para
              evitar duplicidade.
            </p>
          </div>
          <button
            disabled={
              saving ||
              Boolean(parsed.error) ||
              !parsed.numbers.length ||
              (requiresSeller && !form.seller_id)
            }
            className="w-full rounded-xl bg-indigo-400 text-indigo-950 p-3 font-black disabled:opacity-40"
          >
            {saving ? "Registrando..." : "Registrar números como pagos"}
          </button>
        </form>
      </div>
    </main>
  );
}
