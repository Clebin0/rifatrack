"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CheckCircle2, Clock3, RefreshCw, ShieldCheck } from "lucide-react";

type Campaign = {
  id: string; name: string; slug: string; description: string; price_cents: number;
  total_numbers: number; pix_key: string; pix_receiver: string; ends_at: string | null; status:"active"|"closed";
  seller_name: string | null; unavailable: number[]; sold_numbers: number; reserved_numbers: number;
  draw_result:{number:number;drawn_at:string}|null;
};

export default function CampaignExperience({ slug }: { slug: string }) {
  const query = useSearchParams();
  const router = useRouter();
  const seller = (query.get("vendedor") || "").toUpperCase();
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [selected, setSelected] = useState<number[]>([]);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [consent, setConsent] = useState(false);
  const [website, setWebsite] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  async function load() {
    try {
      const suffix = seller ? "?vendedor=" + encodeURIComponent(seller) : "";
      const res = await fetch("/api/campaigns/" + encodeURIComponent(slug) + suffix, { cache: "no-store" });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setCampaign(data);
      setSelected((current) => current.filter((n) => !(data.unavailable || []).includes(n)));
    } catch { setCampaign(null); }
    finally { setLoading(false); }
  }

  useEffect(() => {
    load();
    const timer = setInterval(load, 20000);
    return () => clearInterval(timer);
  }, [slug, seller]);

  const unavailable = useMemo(() => new Set(campaign?.unavailable || []), [campaign]);
  const amount = (campaign?.price_cents || 0) * selected.length;

  function toggle(n: number) {
    if (campaign?.status!=="active" || unavailable.has(n)) return;
    setSelected((current) => current.includes(n) ? current.filter((x) => x !== n) : current.length < 50 ? [...current, n] : current);
  }

  function randomPick(qty: number) {
    if (!campaign || campaign.status!=="active") return;
    const available = Array.from({ length: campaign.total_numbers }, (_, i) => i + 1).filter((n) => !unavailable.has(n));
    for (let i = available.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [available[i], available[j]] = [available[j], available[i]]; }
    setSelected(available.slice(0, Math.min(qty, 50)));
  }

  async function submit() {
    if (!campaign || campaign.status!=="active" || !consent || selected.length === 0) return;
    setSubmitting(true); setMessage("");
    try {
      const res = await fetch("/api/orders", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ campaignSlug: slug, sellerCode: seller, buyerName: name, buyerPhone: phone, numbers: selected, website })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Falha na reserva");
      router.push("/pedido/" + data.order.public_token);
    } catch (e) { setMessage(e instanceof Error ? e.message : "Falha ao reservar."); await load(); }
    finally { setSubmitting(false); }
  }

  if (loading) return <main className="min-h-screen grid place-items-center"><RefreshCw className="animate-spin" /></main>;
  if (!campaign) return <main className="min-h-screen grid place-items-center p-6 text-center"><div><h1 className="text-3xl font-bold">Campanha indisponível</h1><p className="text-zinc-400 mt-2">Ela pode ter sido encerrada ou o endereço está incorreto.</p></div></main>;

  const progress = Math.round((campaign.sold_numbers / campaign.total_numbers) * 100);

  return <main className="min-h-screen bg-zinc-950">
    <header className="border-b border-zinc-800 bg-zinc-950/95 sticky top-0 z-20 backdrop-blur">
      <div className="max-w-6xl mx-auto px-5 py-4 flex items-center justify-between">
        <a href="/" className="font-black tracking-tight text-xl">Rifa<span className="text-emerald-400">Track</span></a>
        <span className="text-xs text-zinc-400 flex gap-2 items-center"><ShieldCheck size={16}/> reserva protegida</span>
      </div>
    </header>

    <div className="max-w-6xl mx-auto px-5 py-8">
      <section className="grid lg:grid-cols-[1fr_340px] gap-8">
        <div>
          <div className="mb-8">
            <span className={campaign.status==="active"?"text-emerald-400 text-sm font-semibold uppercase tracking-wider":"text-amber-400 text-sm font-semibold uppercase tracking-wider"}>{campaign.status==="active"?"Campanha ativa":"Campanha encerrada"}</span>
            <h1 className="text-4xl md:text-5xl font-black mt-2">{campaign.name}</h1>
            <p className="text-zinc-400 mt-3 max-w-2xl">{campaign.description || "Escolha seus números e acompanhe a confirmação do pedido em tempo real."}</p>
            {campaign.seller_name && <div className="mt-4 inline-flex items-center gap-2 bg-emerald-950 border border-emerald-800 rounded-full px-4 py-2 text-sm">Indicação de <strong>{campaign.seller_name}</strong> <CheckCircle2 size={15}/></div>}
            {campaign.draw_result && <div className="mt-5 rounded-2xl border border-amber-700 bg-amber-950/50 p-5"><p className="text-amber-300 text-sm font-bold uppercase tracking-wider">Resultado oficial</p><p className="text-4xl font-black mt-2">Número {String(campaign.draw_result.number).padStart(3,"0")}</p><p className="text-zinc-400 text-sm mt-1">Sorteado em {new Date(campaign.draw_result.drawn_at).toLocaleString("pt-BR")}.</p></div>}
          </div>

          <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-5">
            <div className="flex flex-wrap gap-3 items-end justify-between mb-5">
              <div><p className="text-sm text-zinc-500">Escolha até 50 números</p><p className="font-bold">{campaign.sold_numbers} vendidos · {campaign.reserved_numbers} reservados</p></div>
              <div className="flex gap-2">
                {campaign.status==="active" && [5,10].map((q) => <button key={q} onClick={() => randomPick(q)} className="px-3 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-sm">Escolher {q}</button>)}
                <button onClick={load} title="Atualizar" className="p-2 rounded-xl bg-zinc-800 hover:bg-zinc-700"><RefreshCw size={18}/></button>
              </div>
            </div>
            <div className="h-2 bg-zinc-800 rounded-full overflow-hidden mb-6"><div className="h-full bg-emerald-500" style={{ width: progress + "%" }}/></div>
            <div className="grid grid-cols-5 sm:grid-cols-8 md:grid-cols-10 gap-2 max-h-[580px] overflow-y-auto pr-1">
              {Array.from({ length: campaign.total_numbers }, (_, i) => i + 1).map((n) => {
                const blocked = unavailable.has(n), chosen = selected.includes(n);
                const disabled=blocked || campaign.status!=="active";
                return <button key={n} disabled={disabled} onClick={() => toggle(n)}
                  className={"aspect-square rounded-xl border text-xs font-bold transition " + (disabled ? "bg-zinc-950 text-zinc-700 border-zinc-900 cursor-not-allowed" : chosen ? "bg-emerald-400 text-emerald-950 border-emerald-300 scale-95" : "bg-zinc-950 border-zinc-800 hover:border-zinc-600")}>
                  {String(n).padStart(3,"0")}
                </button>;
              })}
            </div>
          </div>
        </div>

        <aside className="lg:sticky lg:top-24 h-fit bg-zinc-900 border border-zinc-800 rounded-3xl p-5">
          <h2 className="text-xl font-bold">{campaign.status==="active"?"Seu pedido":"Campanha encerrada"}</h2>
          {campaign.status==="closed" && <p className="text-zinc-400 text-sm mt-3">{campaign.draw_result?"O resultado do sorteio está publicado nesta página.":"O sorteio ainda não foi realizado pelo administrador."}</p>}
          {campaign.status==="active" && <>
          <div className="mt-4 rounded-2xl bg-zinc-950 p-4 border border-zinc-800">
            <div className="flex justify-between text-sm text-zinc-400"><span>Números</span><span>{selected.length}</span></div>
            <div className="flex justify-between mt-2"><span>Total</span><strong className="text-2xl">R$ {(amount / 100).toFixed(2).replace(".", ",")}</strong></div>
          </div>
          {selected.length > 0 && <p className="text-xs text-zinc-500 mt-3 break-words">{selected.sort((a,b)=>a-b).map(n=>String(n).padStart(3,"0")).join(", ")}</p>}
          <div className="space-y-3 mt-5">
            <input value={name} onChange={(e)=>setName(e.target.value)} maxLength={100} placeholder="Nome completo" className="w-full bg-zinc-950 border border-zinc-700 rounded-xl p-3 outline-none focus:border-emerald-500"/>
            <input value={phone} onChange={(e)=>setPhone(e.target.value)} maxLength={20} placeholder="WhatsApp / telefone" className="w-full bg-zinc-950 border border-zinc-700 rounded-xl p-3 outline-none focus:border-emerald-500"/>
            <input value={website} onChange={(e)=>setWebsite(e.target.value)} tabIndex={-1} autoComplete="off" className="hidden" aria-hidden="true"/>
            <label className="flex gap-2 text-xs text-zinc-400"><input type="checkbox" checked={consent} onChange={(e)=>setConsent(e.target.checked)}/> Concordo com o uso destes dados somente para identificação e gestão deste pedido.</label>
          </div>
          <button onClick={submit} disabled={submitting || selected.length===0 || name.trim().length<2 || phone.trim().length<8 || !consent}
            className="w-full mt-5 bg-emerald-400 hover:bg-emerald-300 disabled:opacity-40 text-emerald-950 rounded-xl p-3 font-black">
            {submitting ? "Reservando..." : "Reservar números"}
          </button>
          {message && <p className="text-sm text-rose-300 mt-3">{message}</p>}
          <p className="mt-4 text-xs text-zinc-500 flex gap-2"><Clock3 size={15}/> A reserva expira em 15 minutos se não for confirmada.</p>
          </>}
        </aside>
      </section>
    </div>
  </main>;
}
