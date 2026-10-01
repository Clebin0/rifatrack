"use client";
import { useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";
import { CheckCircle2, Clock3, Copy, RefreshCw, Upload, XCircle } from "lucide-react";
import { supabaseBrowser } from "@/lib/supabase-browser";

type Order = {
  status: "pending"|"paid"|"cancelled"|"expired";
  amount_cents: number;
  expires_at: string;
  payment_reference: string;
  pix_txid: string;
  campaign_name: string;
  campaign_slug: string;
  buyer_name: string;
  seller_name: string|null;
  pix_key: string;
  pix_receiver: string;
  pix_payload: string;
  proof_status:"none"|"submitted"|"approved"|"rejected";
  proof_uploaded_at:string|null;
  payment_provider:"manual"|"asaas"|string;
  provider_payment_id:string|null;
  provider_status:string|null;
  provider_paid_at:string|null;
  provider_net_value_cents:number|null;
  pix_transaction_id:string|null;
  numbers: number[];
};

export default function OrderStatus({ token }: { token: string }) {
  const [order,setOrder]=useState<Order|null>(null);
  const [loading,setLoading]=useState(true);
  const [copied,setCopied]=useState(false);
  const [qr,setQr]=useState("");
  const [uploading,setUploading]=useState(false);
  const [uploadMessage,setUploadMessage]=useState("");
  const [now,setNow]=useState(Date.now());

  async function load(){
    try{
      const r=await fetch("/api/orders/"+token,{cache:"no-store"});
      if(!r.ok)throw new Error();
      const data=await r.json();
      setOrder(data);
      if(data.pix_payload) setQr(await QRCode.toDataURL(data.pix_payload,{width:420,margin:2,errorCorrectionLevel:"M"}));
      else setQr("");
    }catch{setOrder(null)}
    finally{setLoading(false)}
  }

  useEffect(()=>{load();const t=setInterval(load,15000);return()=>clearInterval(t)},[token]);
  useEffect(()=>{const t=setInterval(()=>setNow(Date.now()),1000);return()=>clearInterval(t)},[]);

  const remaining=useMemo(()=>{
    if(!order)return 0;
    return Math.max(0,Math.floor((new Date(order.expires_at).getTime()-now)/1000));
  },[order,now]);
  const mm=String(Math.floor(remaining/60)).padStart(2,"0");
  const ss=String(remaining%60).padStart(2,"0");

  if(loading) return <main className="min-h-screen grid place-items-center"><RefreshCw className="animate-spin"/></main>;
  if(!order) return <main className="min-h-screen grid place-items-center p-6 text-center"><div><h1 className="text-3xl font-bold">Pedido não encontrado</h1><a href="/" className="text-emerald-400 inline-block mt-3">Voltar ao início</a></div></main>;

  const statusInfo = order.status==="paid"
    ? {label:"Pagamento confirmado",icon:<CheckCircle2/>,cls:"text-emerald-300 bg-emerald-950 border-emerald-800"}
    : order.status==="pending"
    ? {label:"Aguardando confirmação",icon:<Clock3/>,cls:"text-amber-300 bg-amber-950 border-amber-800"}
    : {label:order.status==="expired"?"Reserva expirada":"Pedido cancelado",icon:<XCircle/>,cls:"text-rose-300 bg-rose-950 border-rose-800"};

  async function copyPix(){
    const value=order?.pix_payload||order?.pix_key;
    if(!value)return;
    await navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(()=>setCopied(false),1500);
  }

  async function uploadProof(file:File){
    setUploadMessage("");
    const current=order;
    if(!current||current.status!=="pending"||remaining<=0){setUploadMessage("A reserva expirou. Não envie comprovante deste pedido.");return}
    if(file.size>5*1024*1024){setUploadMessage("O arquivo deve ter no máximo 5 MB.");return}
    const ext=file.type==="application/pdf"?"pdf":file.type==="image/png"?"png":file.type==="image/jpeg"?(file.name.toLowerCase().endsWith(".jpeg")?"jpeg":"jpg"):"";
    if(!ext){setUploadMessage("Envie JPG, PNG ou PDF.");return}
    setUploading(true);
    const sb=supabaseBrowser();
    const path=`${token}/comprovante.${ext}`;
    const {error:uploadError}=await sb.storage.from("payment-proofs").upload(path,file,{contentType:file.type,upsert:false});
    if(uploadError && !uploadError.message.toLowerCase().includes("already")){
      setUploadMessage("Não foi possível enviar o comprovante.");
      setUploading(false);
      return;
    }
    const {error}=await sb.rpc("register_payment_proof",{p_token:token,p_path:path});
    if(error)setUploadMessage("Arquivo enviado, mas não foi possível vinculá-lo ao pedido. Atualize e tente novamente.");
    else{setUploadMessage("Comprovante enviado. A organização já consegue visualizá-lo no painel.");await load()}
    setUploading(false);
  }

  return <main className="min-h-screen bg-zinc-950 px-5 py-10">
    <div className="max-w-2xl mx-auto">
      <a href="/" className="font-black text-xl">Rifa<span className="text-emerald-400">Track</span></a>
      <section className="mt-8 bg-zinc-900 border border-zinc-800 rounded-3xl p-6 md:p-8">
        <div className={"inline-flex items-center gap-2 border rounded-full px-3 py-2 text-sm "+statusInfo.cls}>{statusInfo.icon}{statusInfo.label}</div>
        <h1 className="text-3xl font-black mt-5">{order.campaign_name}</h1>
        <p className="text-zinc-500 text-sm mt-1">Pedido {order.payment_reference}</p>
        <p className="text-zinc-400 text-sm mt-2">Comprador: <strong>{order.buyer_name}</strong>{order.seller_name?<> · Vendedor: <strong>{order.seller_name}</strong></>:null}</p>
        {order.status==="paid" && <div className="mt-5 rounded-2xl border border-emerald-800 bg-emerald-950/40 p-4 text-sm"><p className="font-bold text-emerald-300">Pagamento conciliado automaticamente</p><div className="mt-2 space-y-1 text-zinc-300">{order.provider_payment_id&&<p>ID da transação: <span className="font-mono">{order.provider_payment_id}</span></p>}{order.pix_transaction_id&&<p>Pix transaction ID: <span className="font-mono">{order.pix_transaction_id}</span></p>}{order.provider_paid_at&&<p>Pago em: {new Date(order.provider_paid_at).toLocaleString("pt-BR")}</p>}</div></div>}

        <div className="grid sm:grid-cols-2 gap-3 mt-6">
          <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-4"><p className="text-zinc-500 text-sm">Total</p><p className="text-2xl font-black mt-1">R$ {(order.amount_cents/100).toFixed(2).replace(".",",")}</p></div>
          <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-4"><p className="text-zinc-500 text-sm">Números</p><p className="font-bold mt-1">{order.numbers.map(n=>String(n).padStart(3,"0")).join(", ") || "—"}</p></div>
        </div>

        {order.status==="pending" && <div className="mt-6 border-t border-zinc-800 pt-6">
          <div className="flex items-center justify-between gap-4"><h2 className="font-bold text-xl">Pagamento por Pix</h2><div className="font-mono text-lg font-black text-amber-300">{mm}:{ss}</div></div>
          <p className="text-sm text-zinc-400 mt-2">{order.payment_provider==="asaas"?"Este QR Code é individual, expira com este pedido e a confirmação ocorre automaticamente após o Pix.":"Pague dentro do tempo acima. Depois do vencimento, os números voltam a ficar disponíveis."}</p>

          {order.pix_payload ? <>
            {qr&&<div className="mt-5 bg-white rounded-2xl p-4 w-fit mx-auto"><img src={qr} alt="QR Code Pix" className="w-56 h-56"/></div>}
            <button onClick={copyPix} className="w-full mt-4 px-4 py-3 rounded-xl bg-white text-black font-bold flex justify-center gap-2 items-center"><Copy size={18}/> Copiar Pix Copia e Cola</button>
            {copied&&<p className="text-emerald-400 text-sm mt-2">Código Pix copiado.</p>}
            <div className="mt-4 text-xs text-zinc-500 space-y-1"><p>Recebedor: {order.pix_receiver||"—"}</p><p>TXID: {order.pix_txid}</p><p>Referência interna: {order.payment_reference}</p></div>
          </> : order.pix_key ? <>
            <p className="text-sm text-zinc-400 mt-3">Chave Pix configurada para esta campanha:</p>
            <div className="mt-3 flex gap-2"><code className="flex-1 bg-zinc-950 border border-zinc-800 rounded-xl p-3 break-all">{order.pix_key}</code><button onClick={copyPix} className="px-4 rounded-xl bg-white text-black"><Copy size={18}/></button></div>
          </> : <p className="text-sm text-zinc-400 mt-3">A organização ainda não cadastrou uma chave Pix nesta campanha.</p>}

          <div className="mt-6 rounded-2xl border border-zinc-800 bg-zinc-950 p-4">
            <h3 className="font-bold">{order.payment_provider==="asaas"?"Comprovante opcional":"Enviar comprovante"}</h3>
            <p className="text-sm text-zinc-500 mt-1">{order.payment_provider==="asaas"?"O pagamento é confirmado automaticamente pelo provedor. Se quiser, envie o comprovante apenas como registro adicional.":"JPG, PNG ou PDF, até 5 MB. O arquivo fica privado e aparece no painel administrativo deste pedido."}</p>
            {order.proof_status==="none" ? <label className="mt-4 inline-flex cursor-pointer items-center gap-2 rounded-xl bg-zinc-800 px-4 py-3 font-bold"><Upload size={18}/>{uploading?"Enviando...":"Selecionar comprovante"}<input disabled={uploading} type="file" accept="image/jpeg,image/png,application/pdf" className="hidden" onChange={e=>{const file=e.target.files?.[0];if(file)uploadProof(file)}}/></label> :
            <div className="mt-4 inline-flex items-center gap-2 rounded-xl bg-emerald-950 border border-emerald-800 px-4 py-3 text-emerald-300"><CheckCircle2 size={18}/> Comprovante recebido · {order.proof_status==="approved"?"aprovado":order.proof_status==="rejected"?"rejeitado":"aguardando conferência"}</div>}
            {uploadMessage&&<p className="text-sm mt-3 text-zinc-300">{uploadMessage}</p>}
          </div>
        </div>}

        <button onClick={load} className="mt-6 inline-flex gap-2 items-center bg-zinc-800 hover:bg-zinc-700 rounded-xl px-4 py-2"><RefreshCw size={16}/> Atualizar status</button>
      </section>
    </div>
  </main>;
}
