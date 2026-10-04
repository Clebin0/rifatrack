import { ArrowRight, Clock3, ShieldCheck } from "lucide-react";
import { supabaseServer } from "@/lib/supabase";

export const dynamic = "force-dynamic";

type Campaign = { name:string; slug:string; description:string; price_cents:number; total_numbers:number; sold_numbers:number; ends_at:string|null };

export default async function Home(){
  let campaigns: Campaign[] = [];
  try { const {data}=await supabaseServer().rpc("public_active_campaigns"); campaigns=(data || []) as Campaign[]; } catch {}

  return <main className="min-h-screen bg-zinc-950">
    <header className="max-w-6xl mx-auto px-5 py-6 flex justify-between items-center">
      <div className="font-black text-xl">Rifa<span className="text-emerald-400">Track</span></div>
      <div className="flex gap-4 text-sm"><a href="/vendedor/login" className="text-zinc-400 hover:text-white">Vendedores</a><a href="/admin" className="text-zinc-400 hover:text-white">Administração</a></div>
    </header>
    <section className="max-w-6xl mx-auto px-5 pt-16 pb-20">
      <div className="max-w-3xl">
        <div className="inline-flex gap-2 items-center text-emerald-400 bg-emerald-950 border border-emerald-900 rounded-full px-3 py-2 text-sm"><ShieldCheck size={16}/> vendas rastreáveis por vendedor</div>
        <h1 className="text-5xl md:text-7xl font-black tracking-tight mt-5">Campanhas organizadas sem depender de planilha.</h1>
        <p className="text-zinc-400 text-lg md:text-xl mt-6 max-w-2xl">Números, reservas, pagamentos, metas e origem de cada venda em um único sistema.</p>
      </div>
      <div className="mt-14">
        <h2 className="text-xl font-bold mb-5">Campanhas ativas</h2>
        {campaigns.length===0 ? <div className="border border-zinc-800 bg-zinc-900 rounded-2xl p-6 text-zinc-400">Nenhuma campanha pública no momento.</div> :
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">{campaigns.map(c=>{
          const progress=Math.round((c.sold_numbers/c.total_numbers)*100);
          return <a key={c.slug} href={"/campanha/"+c.slug} className="group border border-zinc-800 bg-zinc-900 hover:border-zinc-700 rounded-3xl p-5 transition">
            <p className="text-xs uppercase tracking-wider text-emerald-400">Ativa</p>
            <h3 className="text-2xl font-black mt-2">{c.name}</h3>
            <p className="text-zinc-500 text-sm mt-2 line-clamp-2">{c.description || "Participe escolhendo seus números."}</p>
            <div className="h-2 bg-zinc-800 rounded-full mt-6 overflow-hidden"><div className="h-full bg-emerald-500" style={{width:progress+"%"}}/></div>
            <div className="flex justify-between mt-3 text-sm"><span>{c.sold_numbers}/{c.total_numbers} vendidos</span><strong>R$ {(c.price_cents/100).toFixed(2).replace(".",",")}</strong></div>
            {c.ends_at&&<p className="mt-3 text-xs text-zinc-500 flex gap-2 items-center"><Clock3 size={14}/> Participações até {new Date(c.ends_at).toLocaleString("pt-BR")}</p>}
            <span className="inline-flex gap-2 items-center mt-5 font-bold group-hover:text-emerald-400">Participar <ArrowRight size={18}/></span>
          </a>})}</div>}
      </div>
    </section>
  </main>
}
