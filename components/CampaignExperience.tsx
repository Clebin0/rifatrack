"use client";
import CampaignNumberGrid from "@/components/CampaignNumberGrid";
import CampaignNotice from "@/components/CampaignNotice";
import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CheckCircle2, Clock3, MessageCircle, RefreshCw, ShieldCheck } from "lucide-react";

type SellerRef = { name: string; code: string; team: string | null; whatsapp: string };
type Campaign = {
  id: string;
  name: string;
  slug: string;
  description: string;
  price_cents: number;
  total_numbers: number;
  pix_key: string;
  pix_receiver: string;
  ends_at: string | null;
  status: "active" | "closed";
  stored_status: "active" | "closed";
  deadline_reached: boolean;
  finalized_at: string | null;
  finalized_by: string | null;
  seller_name: string | null;
  seller_whatsapp: string | null;
  sellers: SellerRef[];
  unavailable: number[];
  sold_numbers: number;
  reserved_numbers: number;
  draw_result: { number: number; drawn_at: string } | null;
};

export default function CampaignExperience({
  slug,
  salesApproved = true,
}: {
  slug: string;
  salesApproved?: boolean;
}) {
  const query = useSearchParams();
  const router = useRouter();
  const referralSeller = (query.get("vendedor") || "").toUpperCase();
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [selected, setSelected] = useState<number[]>([]);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [selectedSeller, setSelectedSeller] = useState("");
  const [consent, setConsent] = useState(false);
  const [website, setWebsite] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  async function load() {
    try {
      const suffix = referralSeller ? "?vendedor=" + encodeURIComponent(referralSeller) : "";
      const res = await fetch("/api/campaigns/" + encodeURIComponent(slug) + suffix, {
        cache: "no-store",
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setCampaign(data);
      setSelected((current) => current.filter((n) => !(data.unavailable || []).includes(n)));
    } catch {
      setCampaign(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    const timer = setInterval(load, 20000);
    return () => clearInterval(timer);
  }, [slug, referralSeller]);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const unavailable = useMemo(() => new Set(campaign?.unavailable || []), [campaign]);
  const amount = (campaign?.price_cents || 0) * selected.length;
  const sellerCode = referralSeller || selectedSeller;
  const needsSeller = Boolean(campaign?.sellers?.length) && !campaign?.seller_name;
  const chosenSeller = campaign?.seller_name
    ? { name: campaign.seller_name, whatsapp: campaign.seller_whatsapp || "" }
    : campaign?.sellers?.find((s) => s.code === selectedSeller) || null;
  const sellerWhatsApp = chosenSeller?.whatsapp?.replace(/\D/g, "") || "";
  const deadlineMs = campaign?.ends_at ? new Date(campaign.ends_at).getTime() : null;
  const deadlineReached = Boolean(campaign?.deadline_reached || (deadlineMs && now >= deadlineMs));
  const salesOpen = Boolean(salesApproved && campaign?.status === "active" && !deadlineReached);
  const remainingSeconds = deadlineMs ? Math.max(0, Math.floor((deadlineMs - now) / 1000)) : null;
  const countdown =
    remainingSeconds == null
      ? null
      : remainingSeconds <= 0
        ? "Prazo encerrado"
        : Math.floor(remainingSeconds / 86400) +
          "d " +
          Math.floor((remainingSeconds % 86400) / 3600) +
          "h " +
          Math.floor((remainingSeconds % 3600) / 60) +
          "m " +
          (remainingSeconds % 60) +
          "s";

  function toggle(n: number) {
    if (!salesOpen || unavailable.has(n)) return;
    setSelected((current) =>
      current.includes(n)
        ? current.filter((x) => x !== n)
        : current.length < 50
          ? [...current, n]
          : current,
    );
  }

  function randomPick(qty: number) {
    if (!campaign || !salesOpen) return;
    const available = Array.from({ length: campaign.total_numbers }, (_, i) => i + 1).filter(
      (n) => !unavailable.has(n),
    );
    for (let i = available.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [available[i], available[j]] = [available[j], available[i]];
    }
    setSelected(available.slice(0, Math.min(qty, 50)));
  }

  async function submit() {
    if (!campaign || !salesOpen || !consent || selected.length === 0) return;
    setSubmitting(true);
    setMessage("");
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          campaignSlug: slug,
          sellerCode,
          buyerName: name,
          buyerPhone: phone,
          buyerEmail: email,
          numbers: selected,
          website,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Falha na reserva");
      router.push("/pedido/" + data.order.public_token);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Falha ao reservar.");
      await load();
    } finally {
      setSubmitting(false);
    }
  }

  if (loading)
    return (
      <main className="min-h-screen grid place-items-center">
        <RefreshCw className="animate-spin" />
      </main>
    );
  if (!campaign)
    return (
      <main className="min-h-screen grid place-items-center p-6 text-center">
        <div>
          <h1 className="text-3xl font-bold">Campanha indisponível</h1>
          <p className="text-zinc-400 mt-2">
            Ela pode ter sido encerrada ou o endereço está incorreto.
          </p>
        </div>
      </main>
    );

  const progress = Math.round((campaign.sold_numbers / campaign.total_numbers) * 100);

  return (
    <main className="min-h-screen bg-zinc-950">
      {slug === "dia-das-criancas" && <CampaignNotice />}
      <header className="border-b border-zinc-800 bg-zinc-950/95 sticky top-0 z-20 backdrop-blur">
        <div className="max-w-6xl mx-auto px-5 py-4 flex items-center justify-between">
          <a href="/" className="font-black tracking-tight text-xl">
            Rifa<span className="text-emerald-400">Track</span>
          </a>
          <span className="text-xs text-zinc-400 flex gap-2 items-center">
            <ShieldCheck size={16} /> reserva protegida
          </span>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-5 py-8">
        <section className="grid lg:grid-cols-[1fr_340px] gap-8">
          <div>
            <div className="mb-8">
              <span
                className={
                  salesOpen
                    ? "text-emerald-400 text-sm font-semibold uppercase tracking-wider"
                    : "text-amber-400 text-sm font-semibold uppercase tracking-wider"
                }
              >
                {salesOpen
                  ? "Campanha ativa"
                  : campaign.finalized_at
                    ? "Campanha finalizada"
                    : !salesApproved
                      ? "Campanha em preparação"
                      : "Prazo encerrado"}
              </span>
              <h1 className="text-4xl md:text-5xl font-black mt-2">{campaign.name}</h1>
              <p className="text-zinc-400 mt-3 max-w-2xl">
                {campaign.description ||
                  "Escolha seus números e acompanhe a confirmação do pedido em tempo real."}
              </p>
              {campaign.ends_at && (
                <div
                  className={
                    "mt-4 inline-flex items-center gap-2 rounded-xl border px-4 py-3 text-sm " +
                    (deadlineReached
                      ? "border-amber-800 bg-amber-950/30 text-amber-200"
                      : "border-zinc-700 bg-zinc-900 text-zinc-300")
                  }
                >
                  <Clock3 size={17} />
                  <span>
                    {deadlineReached ? (
                      "Prazo de participação encerrado"
                    ) : (
                      <>
                        Encerra em <b>{countdown}</b> ·{" "}
                        {new Date(campaign.ends_at).toLocaleString("pt-BR")}
                      </>
                    )}
                  </span>
                </div>
              )}
              {campaign.seller_name && (
                <div className="mt-4 flex flex-wrap gap-2 items-center">
                  <div className="inline-flex items-center gap-2 bg-emerald-950 border border-emerald-800 rounded-full px-4 py-2 text-sm">
                    Indicação de <strong>{campaign.seller_name}</strong> <CheckCircle2 size={15} />
                  </div>
                  {sellerWhatsApp && (
                    <a
                      target="_blank"
                      rel="noreferrer"
                      href={"https://wa.me/" + sellerWhatsApp}
                      className="inline-flex items-center gap-2 rounded-full border border-zinc-700 bg-zinc-900 px-4 py-2 text-sm"
                    >
                      <MessageCircle size={15} /> Falar com vendedor
                    </a>
                  )}
                </div>
              )}
              {campaign.draw_result && (
                <div className="mt-5 rounded-2xl border border-amber-700 bg-amber-950/50 p-5">
                  <p className="text-amber-300 text-sm font-bold uppercase tracking-wider">
                    Resultado oficial
                  </p>
                  <p className="text-4xl font-black mt-2">
                    Número {String(campaign.draw_result.number).padStart(3, "0")}
                  </p>
                  <p className="text-zinc-400 text-sm mt-1">
                    Sorteado em {new Date(campaign.draw_result.drawn_at).toLocaleString("pt-BR")}.
                  </p>
                  <a
                    href={"/campanha/" + campaign.slug + "/transparencia"}
                    className="inline-block mt-3 text-sm text-amber-300 underline"
                  >
                    Ver prova criptográfica do sorteio
                  </a>
                </div>
              )}
            </div>

            <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-5">
              <div className="flex flex-wrap gap-3 items-end justify-between mb-5">
                <div>
                  <p className="text-sm text-zinc-500">Escolha até 50 números</p>
                  <p className="font-bold">
                    {campaign.sold_numbers} vendidos · {campaign.reserved_numbers} reservados
                  </p>
                </div>
                <div className="flex gap-2">
                  {salesOpen &&
                    [5, 10].map((q) => (
                      <button
                        key={q}
                        onClick={() => randomPick(q)}
                        className="px-3 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-sm"
                      >
                        Escolher {q}
                      </button>
                    ))}
                  <button
                    onClick={load}
                    aria-label="Atualizar disponibilidade"
                    title="Atualizar"
                    className="p-2 rounded-xl bg-zinc-800 hover:bg-zinc-700"
                  >
                    <RefreshCw size={18} />
                  </button>
                </div>
              </div>
              <div className="h-2 bg-zinc-800 rounded-full overflow-hidden mb-6">
                <div className="h-full bg-emerald-500" style={{ width: progress + "%" }} />
              </div>
              <CampaignNumberGrid
                total={campaign.total_numbers}
                unavailable={unavailable}
                selected={selected}
                salesOpen={salesOpen}
                onToggle={toggle}
              />
            </div>
          </div>

          <aside className="lg:sticky lg:top-24 h-fit bg-zinc-900 border border-zinc-800 rounded-3xl p-5">
            <h2 className="text-xl font-bold">
              {salesOpen
                ? "Seu pedido"
                : campaign.finalized_at
                  ? "Campanha finalizada"
                  : !salesApproved
                    ? "Campanha em preparação"
                    : "Prazo encerrado"}
            </h2>
            {!salesOpen && (
              <>
                {campaign.finalized_at ? (
                  <>
                    <p className="text-zinc-400 text-sm mt-3">
                      {campaign.draw_result
                        ? "O resultado do sorteio está publicado nesta página."
                        : "As vendas foram finalizadas. O sorteio ainda não foi realizado pelo administrador."}
                    </p>
                    <a
                      href={"/campanha/" + campaign.slug + "/transparencia"}
                      className="inline-block mt-3 text-sm text-emerald-400 underline"
                    >
                      Transparência e integridade do sorteio
                    </a>
                  </>
                ) : (
                  <p className="text-zinc-400 text-sm mt-3">
                    {!salesApproved
                      ? "As compras estão bloqueadas enquanto a organização conclui as pendências da campanha."
                      : "O prazo de participação terminou e novas reservas estão bloqueadas. A organização ainda precisa finalizar a campanha no painel administrativo."}
                  </p>
                )}
              </>
            )}
            {salesOpen && (
              <>
                <div className="mt-4 rounded-2xl bg-zinc-950 p-4 border border-zinc-800">
                  <div className="flex justify-between text-sm text-zinc-400">
                    <span>Números</span>
                    <span>{selected.length}</span>
                  </div>
                  <div className="flex justify-between mt-2">
                    <span>Total</span>
                    <strong className="text-2xl">
                      R$ {(amount / 100).toFixed(2).replace(".", ",")}
                    </strong>
                  </div>
                </div>
                {selected.length > 0 && (
                  <p className="text-xs text-zinc-500 mt-3 break-words">
                    {[...selected]
                      .sort((a, b) => a - b)
                      .map((n) => String(n).padStart(3, "0"))
                      .join(", ")}
                  </p>
                )}
                <div className="space-y-3 mt-5">
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    maxLength={100}
                    aria-label="Nome completo"
                    autoComplete="name"
                    placeholder="Nome completo"
                    className="w-full bg-zinc-950 border border-zinc-700 rounded-xl p-3 outline-none focus:border-emerald-500"
                  />
                  <input
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    maxLength={20}
                    aria-label="WhatsApp ou telefone"
                    inputMode="tel"
                    autoComplete="tel"
                    placeholder="WhatsApp / telefone"
                    className="w-full bg-zinc-950 border border-zinc-700 rounded-xl p-3 outline-none focus:border-emerald-500"
                  />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    maxLength={180}
                    aria-label="E-mail para notificações (opcional)"
                    autoComplete="email"
                    placeholder="E-mail (opcional)"
                    className="w-full bg-zinc-950 border border-zinc-700 rounded-xl p-3 outline-none focus:border-emerald-500"
                  />
                  {needsSeller && (
                    <select
                      aria-label="Vendedor que indicou a campanha"
                      required
                      value={selectedSeller}
                      onChange={(e) => setSelectedSeller(e.target.value)}
                      className="w-full bg-zinc-950 border border-zinc-700 rounded-xl p-3 outline-none focus:border-emerald-500"
                    >
                      <option value="">Quem te indicou / vendedor</option>
                      {campaign.sellers.map((s) => (
                        <option key={s.code} value={s.code}>
                          {s.name}
                          {s.team ? " — " + s.team : ""}
                        </option>
                      ))}
                    </select>
                  )}
                  {chosenSeller && (
                    <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-3 text-sm">
                      <span className="text-zinc-500">Venda atribuída a</span>
                      <div className="font-bold mt-1">{chosenSeller.name}</div>
                      {sellerWhatsApp && (
                        <a
                          target="_blank"
                          rel="noreferrer"
                          href={"https://wa.me/" + sellerWhatsApp}
                          className="text-emerald-400 text-xs inline-flex gap-1 items-center mt-2"
                        >
                          <MessageCircle size={13} /> WhatsApp do vendedor
                        </a>
                      )}
                    </div>
                  )}
                  <input
                    value={website}
                    onChange={(e) => setWebsite(e.target.value)}
                    tabIndex={-1}
                    autoComplete="off"
                    className="hidden"
                    aria-hidden="true"
                  />
                  <label className="flex gap-2 text-xs text-zinc-400">
                    <input
                      type="checkbox"
                      checked={consent}
                      onChange={(e) => setConsent(e.target.checked)}
                    />
                    <span>
                      Concordo com o uso destes dados somente para identificação e gestão deste
                      pedido, conforme a{" "}
                      <a href="/privacidade" target="_blank" className="text-emerald-400 underline">
                        Política de Privacidade
                      </a>
                      .
                    </span>
                  </label>
                </div>
                <button
                  onClick={submit}
                  disabled={
                    !salesOpen ||
                    submitting ||
                    selected.length === 0 ||
                    name.trim().length < 2 ||
                    phone.trim().length < 8 ||
                    (needsSeller && !selectedSeller) ||
                    !consent
                  }
                  className="w-full mt-5 bg-emerald-400 hover:bg-emerald-300 disabled:opacity-40 text-emerald-950 rounded-xl p-3 font-black"
                >
                  {submitting ? "Reservando..." : "Reservar números"}
                </button>
                {message && <p className="text-sm text-rose-300 mt-3">{message}</p>}
                <p className="mt-4 text-xs text-zinc-500 flex gap-2">
                  <Clock3 size={15} /> O Pix vence em 10 minutos. Para Pix automático, os números
                  permanecem bloqueados por mais 2 minutos para conciliação. Não pague após o
                  vencimento.
                </p>
              </>
            )}
          </aside>
        </section>
      </div>
    </main>
  );
}
