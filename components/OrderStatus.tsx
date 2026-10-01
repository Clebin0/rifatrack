"use client";
import { useEffect, useState } from "react";
import { CheckCircle2, Clock3, Copy, RefreshCw, XCircle } from "lucide-react";

type Order = {
  status: "pending"|"paid"|"cancelled"|"expired"; amount_cents: number; expires_at: string;
  payment_reference: string; campaign_name: string; campaign_slug: string; pix_key: string; pix_receiver: string; numbers: number[];
};

export default function OrderStatus({ token }: { token: string }) {
  const [order,setOrder]=useState<Order|null>(null);
  const [loading,setLoading]=useState(true);
  const [copied,setCopied]=useState(false);

  async function load(){
    try{const r=await fetch("/api/orders/"+token,{cache:"no-store"});if(!r.ok)throw new Error();setOrder(await r.json());}
    catch{setOrder(null);} finally{setLoading(false);}
  }
  useEffect(()=>{load();const t=setInterval(load,15000);return()=>clearInterval(t)},[token]);

  if(loading) return <main className="min-h-screen grid place-items-center"><RefreshCw className="animate-spin"/></main>;
  if(!order) return <main className="min-h-screen grid place-items-center p-6 text-center"><div><h1 className="text-3xl font-bold">Pedido não encontrado</h1><a href="/" className="text-emerald-400 inline-block mt-3">Voltar ao início</a></div></main>;

  const statusInfo = order.status==="paid"
    ? {label:"Pagamento confirmado",icon:<CheckCircle2/>,cls:"text-emerald-300 bg-emerald-950 border-emerald-800"}
    : order.status==="pending"
    ? {label:"Aguardando confirmação",icon:<Clock3/>,cls:"text-amber-300 bg-amber-950 border-amber-800"}
    : {label:order.status==="expired"?"Reserva expirada":"Pedido cancelado",icon:<XCircle/>,cls:"text-rose-300 bg-rose-950 border-rose-800"};

  async function copyPix(){if(!order?.pix_key)return;const key=order.pix_key;await navigator.clipboard.writeText(key);setCopied(true);setTimeout(()=>setCopied(false),1500)}

  return <main className="min-h-screen bg-zinc-950 px-5 py-10">
    <div className="max-w-2xl mx-auto">
      <a href="/" className="font-black text-xl">Rifa<span className="text-emerald-400">Track</span></a>
      <section className="mt-8 bg-zinc-900 border border-zinc-800 rounded-3xl p-6 md:p-8">
        <div className={"inline-flex items-center gap-2 border rounded-full px-3 py-2 text-sm "+statusInfo.cls}>{statusInfo.icon}{statusInfo.label}</div>
        <h1 className="text-3xl font-black mt-5">{order.campaign_name}</h1>
        <p className="text-zinc-500 text-sm mt-1">Referência {order.payment_reference}</p>

        <div className="grid sm:grid-cols-2 gap-3 mt-6">
          <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-4"><p className="text-zinc-500 text-sm">Total</p><p className="text-2xl font-black mt-1">R$ {(order.amount_cents/100).toFixed(2).replace(".",",")}</p></div>
          <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-4"><p className="text-zinc-500 text-sm">Números</p><p className="font-bold mt-1">{order.numbers.map(n=>String(n).padStart(3,"0")).join(", ") || "—"}</p></div>
        </div>

        {order.status==="pending" && <div className="mt-6 border-t border-zinc-800 pt-6">
          <h2 className="font-bold text-xl">Pagamento por Pix</h2>
          {order.pix_key ? <>
            <p className="text-sm text-zinc-400 mt-2">Envie o valor exato para {order.pix_receiver || "o responsável pela campanha"} e use a referência acima na identificação.</p>
            <div className="mt-4 flex gap-2"><code className="flex-1 bg-zinc-950 border border-zinc-800 rounded-xl p-3 break-all">{order.pix_key}</code><button onClick={copyPix} className="px-4 rounded-xl bg-white text-black"><Copy size={18}/></button></div>
            {copied && <p className="text-emerald-400 text-sm mt-2">Chave copiada.</p>}
          </> : <p className="text-sm text-zinc-400 mt-2">A organização ainda não cadastrou uma chave Pix nesta campanha. Entre em contato com o responsável.</p>}
          <p className="text-xs text-zinc-500 mt-4">Reserva válida até {new Date(order.expires_at).toLocaleString("pt-BR")}.</p>
        </div>}

        <button onClick={load} className="mt-6 inline-flex gap-2 items-center bg-zinc-800 hover:bg-zinc-700 rounded-xl px-4 py-2"><RefreshCw size={16}/> Atualizar status</button>
      </section>
    </div>
  </main>;
}
