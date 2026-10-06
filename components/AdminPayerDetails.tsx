"use client";
import {useState} from "react";
import {supabaseBrowser} from "@/lib/supabase-browser";
type Declaration={payer_name:string;transaction_reference:string;updated_at:string};
export default function AdminPayerDetails({orderId}:{orderId:string}){
 const [data,setData]=useState<Declaration|null>(null);const [loaded,setLoaded]=useState(false);const [busy,setBusy]=useState(false);const [error,setError]=useState("");
 async function load(){setBusy(true);setError("");try{const {data:d,error:e}=await supabaseBrowser().rpc("admin_order_payer_declaration",{p_order_id:orderId});if(e)throw e;setData(d as Declaration|null);setLoaded(true)}catch{setError("Não foi possível consultar. Confirme o autenticador e tente novamente.")}finally{setBusy(false)}}
 return <details className="mt-2 max-w-xs" onToggle={e=>{if(e.currentTarget.open&&!loaded&&!busy)void load()}}><summary className="cursor-pointer text-emerald-300 py-2">Quem fez o Pix</summary>
 {busy?<p>Consultando…</p>:error?<div role="alert">{error}<button type="button" className="underline block" onClick={load}>Tentar novamente</button></div>:data?<div className="space-y-1 text-xs"><p><b>Titular informado:</b> {data.payer_name}</p><p className="break-all"><b>Referência:</b> {data.transaction_reference||"Não informada"}</p><p>Declarado em {new Date(data.updated_at).toLocaleString("pt-BR")}</p><p className="text-amber-200">Declaração do comprador. Confira o recebimento no banco; nome e comprovante não confirmam pagamento.</p></div>:<p className="text-xs ui-muted">Nenhum titular diferente informado. Concilie pelo identificador do pedido e da transação.</p>}
 </details>
}

