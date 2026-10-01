"use client";
import { FormEvent, useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";
import { Download, LogOut, Plus, RefreshCw, Ticket, Users, WalletCards } from "lucide-react";
import { supabaseBrowser } from "@/lib/supabase-browser";

type Campaign={id:string;name:string;slug:string;description:string;price_cents:number;total_numbers:number;status:"draft"|"active"|"closed";pix_key:string;pix_receiver:string;ends_at:string|null;sold_numbers:number;reserved_numbers:number;revenue_cents:number;created_at:string};
type Seller={campaign_id:string;campaign_name:string;campaign_slug:string;id:string;name:string;code:string;team:string;goal:number;active:boolean;sold_numbers:number;revenue_cents:number};
type Order={id:string;public_token:string;buyer_name:string;buyer_phone:string;status:string;amount_cents:number;payment_reference:string;expires_at:string;created_at:string;campaign_name:string;campaign_slug:string;seller_name:string|null;numbers:number[]};
type Dashboard={admin_email:string;summary:{campaigns:number;active_campaigns:number;paid_revenue_cents:number;pending_orders:number};campaigns:Campaign[];sellers:Seller[];orders:Order[]};

const money=(c:number)=>"R$ "+(c/100).toFixed(2).replace(".",",");
const input="w-full bg-zinc-950 border border-zinc-700 rounded-xl p-3 outline-none focus:border-emerald-500";
const panel="bg-zinc-900 border border-zinc-800 rounded-3xl p-5";

export default function AdminClient(){
  const sb=supabaseBrowser();
  const [data,setData]=useState<Dashboard|null>(null);
  const [loading,setLoading]=useState(true);
  const [unauthorized,setUnauthorized]=useState(false);
  const [setupCode,setSetupCode]=useState("");
  const [message,setMessage]=useState("");
  const [search,setSearch]=useState("");
  const [campaignForm,setCampaignForm]=useState({name:"",slug:"",description:"",price:"5.00",total:"400",pix_key:"",pix_receiver:""});
  const [sellerForm,setSellerForm]=useState({campaign_id:"",name:"",code:"",team:"",goal:"30"});
  const [edit,setEdit]=useState({id:"",name:"",description:"",price:"",pix_key:"",pix_receiver:""});

  async function load(){
    setLoading(true); setMessage("");
    const {data:auth}=await sb.auth.getSession();
    if(!auth.session){location.href="/admin/login";return;}
    const {data:dashboard,error}=await sb.rpc("admin_dashboard");
    if(error){setUnauthorized(true);setData(null);}else{
      const d=dashboard as Dashboard; setData(d);setUnauthorized(false);
      if(!sellerForm.campaign_id&&d.campaigns[0]) setSellerForm(x=>({...x,campaign_id:d.campaigns[0].id}));
      if(!edit.id&&d.campaigns[0]) setEdit({id:d.campaigns[0].id,name:d.campaigns[0].name,description:d.campaigns[0].description,price:(d.campaigns[0].price_cents/100).toFixed(2),pix_key:d.campaigns[0].pix_key,pix_receiver:d.campaigns[0].pix_receiver});
    }
    setLoading(false);
  }

  useEffect(()=>{load()},[]);

  async function claimAdmin(e:FormEvent){
    e.preventDefault();setMessage("");
    const {error}=await sb.rpc("claim_first_admin",{p_code:setupCode});
    if(error)setMessage("Código inválido ou implantação já concluída.");
    else{setMessage("Administrador ativado.");await load();}
  }

  async function createCampaign(e:FormEvent){
    e.preventDefault();setMessage("");
    const {error}=await sb.rpc("admin_create_campaign",{
      p_name:campaignForm.name,p_slug:campaignForm.slug.toLowerCase().replace(/[^a-z0-9-]/g,"-"),
      p_description:campaignForm.description,p_price_cents:Math.round(Number(campaignForm.price.replace(",","."))*100),
      p_total_numbers:Number(campaignForm.total),p_pix_key:campaignForm.pix_key,p_pix_receiver:campaignForm.pix_receiver
    });
    if(error)setMessage("Não foi possível criar a campanha: "+error.message);
    else{setCampaignForm({name:"",slug:"",description:"",price:"5.00",total:"400",pix_key:"",pix_receiver:""});setMessage("Campanha criada em rascunho.");await load();}
  }

  async function saveCampaign(e:FormEvent){
    e.preventDefault();setMessage("");
    const {error}=await sb.rpc("admin_update_campaign",{p_id:edit.id,p_name:edit.name,p_description:edit.description,p_price_cents:Math.round(Number(edit.price.replace(",","."))*100),p_pix_key:edit.pix_key,p_pix_receiver:edit.pix_receiver});
    if(error)setMessage("Falha ao salvar campanha."); else{setMessage("Campanha atualizada.");await load();}
  }

  async function statusCampaign(id:string,status:"draft"|"active"|"closed"){
    const {error}=await sb.rpc("admin_set_campaign_status",{p_id:id,p_status:status});
    if(error)setMessage("Falha ao alterar status."); else await load();
  }

  async function createSeller(e:FormEvent){
    e.preventDefault();setMessage("");
    const {error}=await sb.rpc("admin_create_seller",{p_campaign_id:sellerForm.campaign_id,p_name:sellerForm.name,p_code:sellerForm.code,p_team:sellerForm.team,p_goal:Number(sellerForm.goal)});
    if(error)setMessage("Não foi possível cadastrar o vendedor: "+error.message);
    else{setSellerForm(x=>({...x,name:"",code:"",team:"",goal:"30"}));setMessage("Vendedor cadastrado.");await load();}
  }

  async function toggleSeller(s:Seller){
    const {error}=await sb.rpc("admin_set_seller_active",{p_campaign_id:s.campaign_id,p_seller_id:s.id,p_active:!s.active});
    if(error)setMessage("Falha ao alterar vendedor."); else await load();
  }

  async function orderStatus(id:string,status:"paid"|"cancelled"){
    if(status==="paid"&&!confirm("Confirmar recebimento do pagamento deste pedido?"))return;
    const {error}=await sb.rpc("admin_set_order_status",{p_order_id:id,p_status:status});
    if(error)setMessage("Não foi possível alterar o pedido. A reserva pode ter expirado."); else await load();
  }

  function sellerLink(s:Seller){return location.origin+"/campanha/"+s.campaign_slug+"?vendedor="+encodeURIComponent(s.code);}
  async function copyLink(s:Seller){await navigator.clipboard.writeText(sellerLink(s));setMessage("Link copiado.");}
  async function qr(s:Seller){const url=await QRCode.toDataURL(sellerLink(s),{width:720,margin:2,errorCorrectionLevel:"H"});const a=document.createElement("a");a.href=url;a.download=("qrcode-"+s.code+".png").toLowerCase();a.click();}

  async function exportOrders(){
    if(!data)return;
    const XLSX=await import("xlsx");
    const rows=data.orders.map(o=>({Pedido:o.payment_reference,Campanha:o.campaign_name,Comprador:o.buyer_name,Telefone:o.buyer_phone,Vendedor:o.seller_name||"Direto",Status:o.status,Valor:money(o.amount_cents),Numeros:o.numbers.join(", "),Criado:new Date(o.created_at).toLocaleString("pt-BR")}));
    const ws=XLSX.utils.json_to_sheet(rows),wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,ws,"Pedidos");XLSX.writeFile(wb,"rifatrack-pedidos.xlsx");
  }

  async function logout(){await sb.auth.signOut();location.href="/admin/login";}
  const filtered=useMemo(()=>data?.orders.filter(o=>[o.buyer_name,o.buyer_phone,o.payment_reference,o.seller_name||""].join(" ").toLowerCase().includes(search.toLowerCase()))||[],[data,search]);

  if(loading)return <main className="min-h-screen grid place-items-center"><RefreshCw className="animate-spin"/></main>;
  if(unauthorized)return <main className="min-h-screen grid place-items-center p-5"><form onSubmit={claimAdmin} className={panel+" w-full max-w-md"}><h1 className="text-2xl font-black">Ativar administrador</h1><p className="text-zinc-500 text-sm mt-2">Esta etapa só existe na primeira implantação.</p><input value={setupCode} onChange={e=>setSetupCode(e.target.value)} placeholder="Código de implantação" className={input+" mt-5"}/><button className="w-full mt-3 p-3 rounded-xl bg-emerald-400 text-emerald-950 font-black">Ativar acesso</button>{message&&<p className="text-sm mt-3">{message}</p>}</form></main>;
  if(!data)return null;

  function pickEdit(id:string){const c=data!.campaigns.find(x=>x.id===id);if(c)setEdit({id:c.id,name:c.name,description:c.description,price:(c.price_cents/100).toFixed(2),pix_key:c.pix_key,pix_receiver:c.pix_receiver});}

  return <main className="min-h-screen bg-zinc-950">
    <header className="border-b border-zinc-800 sticky top-0 bg-zinc-950/95 backdrop-blur z-20"><div className="max-w-7xl mx-auto px-5 py-4 flex justify-between items-center"><div><span className="font-black text-xl">Rifa<span className="text-emerald-400">Track</span></span><span className="text-zinc-600 text-sm ml-3 hidden sm:inline">{data.admin_email}</span></div><div className="flex gap-2"><button onClick={load} className="p-2 rounded-xl bg-zinc-900 border border-zinc-800"><RefreshCw size={18}/></button><button onClick={logout} className="p-2 rounded-xl bg-zinc-900 border border-zinc-800"><LogOut size={18}/></button></div></div></header>

    <div className="max-w-7xl mx-auto px-5 py-8 space-y-8">
      <div><p className="text-emerald-400 text-sm font-semibold">PAINEL ADMINISTRATIVO</p><h1 className="text-4xl font-black mt-1">Visão geral</h1></div>
      {message&&<div className="border border-zinc-700 bg-zinc-900 rounded-xl p-3 text-sm">{message}</div>}

      <section className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          ["Receita confirmada",money(data.summary.paid_revenue_cents),<WalletCards key="a"/>],
          ["Pedidos pendentes",String(data.summary.pending_orders),<Ticket key="b"/>],
          ["Campanhas ativas",String(data.summary.active_campaigns),<RefreshCw key="c"/>],
          ["Vendedores",String(data.sellers.filter(s=>s.active).length),<Users key="d"/>]
        ].map(([label,value,icon])=><div key={String(label)} className={panel}><div className="text-zinc-500">{icon}</div><p className="text-zinc-500 text-sm mt-4">{label}</p><p className="text-3xl font-black mt-1">{value}</p></div>)}
      </section>

      <section className="grid xl:grid-cols-2 gap-5">
        <form onSubmit={createCampaign} className={panel+" space-y-3"}><h2 className="text-xl font-black flex gap-2 items-center"><Plus size={20}/> Nova campanha</h2><div className="grid sm:grid-cols-2 gap-3"><input required placeholder="Nome" value={campaignForm.name} onChange={e=>setCampaignForm({...campaignForm,name:e.target.value})} className={input}/><input required placeholder="slug-exemplo" value={campaignForm.slug} onChange={e=>setCampaignForm({...campaignForm,slug:e.target.value})} className={input}/></div><textarea placeholder="Descrição" value={campaignForm.description} onChange={e=>setCampaignForm({...campaignForm,description:e.target.value})} className={input}/><div className="grid sm:grid-cols-2 gap-3"><input required type="number" min="0.01" step="0.01" placeholder="Preço" value={campaignForm.price} onChange={e=>setCampaignForm({...campaignForm,price:e.target.value})} className={input}/><input required type="number" min="1" max="100000" placeholder="Quantidade de números" value={campaignForm.total} onChange={e=>setCampaignForm({...campaignForm,total:e.target.value})} className={input}/></div><div className="grid sm:grid-cols-2 gap-3"><input placeholder="Chave Pix" value={campaignForm.pix_key} onChange={e=>setCampaignForm({...campaignForm,pix_key:e.target.value})} className={input}/><input placeholder="Recebedor Pix" value={campaignForm.pix_receiver} onChange={e=>setCampaignForm({...campaignForm,pix_receiver:e.target.value})} className={input}/></div><button className="bg-white text-black rounded-xl px-4 py-3 font-bold">Criar campanha</button></form>

        <form onSubmit={saveCampaign} className={panel+" space-y-3"}><h2 className="text-xl font-black">Configurar campanha</h2><select value={edit.id} onChange={e=>pickEdit(e.target.value)} className={input}>{data.campaigns.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select><input required value={edit.name} onChange={e=>setEdit({...edit,name:e.target.value})} className={input}/><textarea placeholder="Descrição" value={edit.description} onChange={e=>setEdit({...edit,description:e.target.value})} className={input}/><div className="grid sm:grid-cols-2 gap-3"><input required type="number" min="0.01" step="0.01" value={edit.price} onChange={e=>setEdit({...edit,price:e.target.value})} className={input}/><input placeholder="Chave Pix" value={edit.pix_key} onChange={e=>setEdit({...edit,pix_key:e.target.value})} className={input}/></div><input placeholder="Recebedor Pix" value={edit.pix_receiver} onChange={e=>setEdit({...edit,pix_receiver:e.target.value})} className={input}/><button className="bg-emerald-400 text-emerald-950 rounded-xl px-4 py-3 font-black">Salvar configurações</button></form>
      </section>

      <section className={panel}><h2 className="text-xl font-black mb-4">Campanhas</h2><div className="grid lg:grid-cols-2 gap-3">{data.campaigns.map(c=><div key={c.id} className="bg-zinc-950 border border-zinc-800 rounded-2xl p-4"><div className="flex justify-between gap-3"><div><h3 className="font-bold text-lg">{c.name}</h3><p className="text-xs text-zinc-500">/{c.slug} · {c.status}</p></div><strong>{money(c.revenue_cents)}</strong></div><div className="mt-4 h-2 bg-zinc-800 rounded-full overflow-hidden"><div className="h-full bg-emerald-500" style={{width:Math.round(c.sold_numbers/c.total_numbers*100)+"%"}}/></div><p className="text-xs text-zinc-500 mt-2">{c.sold_numbers} pagos · {c.reserved_numbers} reservados · {c.total_numbers} total</p><div className="flex flex-wrap gap-2 mt-4">{c.status!=="active"&&<button onClick={()=>statusCampaign(c.id,"active")} className="px-3 py-2 bg-emerald-950 text-emerald-300 rounded-lg text-sm">Ativar</button>}{c.status==="active"&&<button onClick={()=>statusCampaign(c.id,"closed")} className="px-3 py-2 bg-rose-950 text-rose-300 rounded-lg text-sm">Encerrar</button>}<button onClick={()=>pickEdit(c.id)} className="px-3 py-2 bg-zinc-800 rounded-lg text-sm">Editar acima</button><a target="_blank" href={"/campanha/"+c.slug} className="px-3 py-2 bg-zinc-800 rounded-lg text-sm">Abrir página</a></div></div>)}</div></section>

      <section className="grid xl:grid-cols-[360px_1fr] gap-5">
        <form onSubmit={createSeller} className={panel+" h-fit space-y-3"}><h2 className="text-xl font-black">Adicionar vendedor</h2><select required value={sellerForm.campaign_id} onChange={e=>setSellerForm({...sellerForm,campaign_id:e.target.value})} className={input}>{data.campaigns.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select><input required placeholder="Nome" value={sellerForm.name} onChange={e=>setSellerForm({...sellerForm,name:e.target.value})} className={input}/><input required placeholder="Código (ex: JOAO)" value={sellerForm.code} onChange={e=>setSellerForm({...sellerForm,code:e.target.value.toUpperCase()})} className={input}/><input placeholder="Equipe / grupo" value={sellerForm.team} onChange={e=>setSellerForm({...sellerForm,team:e.target.value})} className={input}/><input required type="number" min="0" placeholder="Meta de números" value={sellerForm.goal} onChange={e=>setSellerForm({...sellerForm,goal:e.target.value})} className={input}/><button className="bg-white text-black rounded-xl px-4 py-3 font-bold">Cadastrar</button></form>

        <div className={panel}><h2 className="text-xl font-black mb-4">Vendedores e links</h2><div className="overflow-x-auto"><table className="w-full text-sm"><thead className="text-zinc-500 text-left"><tr><th className="pb-3">Vendedor</th><th>Campanha</th><th>Vendas</th><th>Meta</th><th>Ações</th></tr></thead><tbody>{data.sellers.map(s=><tr key={s.campaign_id+s.id} className="border-t border-zinc-800"><td className="py-4"><b>{s.name}</b><div className="text-xs text-zinc-500">{s.code} · {s.team||"Sem equipe"}</div></td><td>{s.campaign_name}</td><td>{s.sold_numbers}</td><td>{s.goal}</td><td><div className="flex gap-2"><button onClick={()=>copyLink(s)} className="px-2 py-1 bg-zinc-800 rounded">Link</button><button onClick={()=>qr(s)} className="px-2 py-1 bg-zinc-800 rounded">QR</button><button onClick={()=>toggleSeller(s)} className={"px-2 py-1 rounded "+(s.active?"bg-emerald-950 text-emerald-300":"bg-rose-950 text-rose-300")}>{s.active?"Ativo":"Inativo"}</button></div></td></tr>)}</tbody></table></div></div>
      </section>

      <section className={panel}><div className="flex flex-col sm:flex-row gap-3 justify-between sm:items-center"><div><h2 className="text-xl font-black">Pedidos</h2><p className="text-sm text-zinc-500">Últimos 250 pedidos</p></div><div className="flex gap-2"><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar pedido..." className="bg-zinc-950 border border-zinc-700 rounded-xl px-3 py-2"/><button onClick={exportOrders} className="px-3 py-2 rounded-xl bg-zinc-800 flex gap-2 items-center"><Download size={16}/> XLSX</button></div></div><div className="overflow-x-auto mt-5"><table className="w-full text-sm min-w-[900px]"><thead className="text-zinc-500 text-left"><tr><th className="pb-3">Pedido</th><th>Comprador</th><th>Campanha</th><th>Vendedor</th><th>Números</th><th>Valor</th><th>Status</th><th>Ações</th></tr></thead><tbody>{filtered.map(o=><tr key={o.id} className="border-t border-zinc-800"><td className="py-4 font-mono">{o.payment_reference}</td><td><b>{o.buyer_name}</b><div className="text-xs text-zinc-500">{o.buyer_phone}</div></td><td>{o.campaign_name}</td><td>{o.seller_name||"Direto"}</td><td className="max-w-[180px] truncate">{o.numbers.join(", ")}</td><td>{money(o.amount_cents)}</td><td><span className={"px-2 py-1 rounded-full text-xs "+(o.status==="paid"?"bg-emerald-950 text-emerald-300":o.status==="pending"?"bg-amber-950 text-amber-300":"bg-zinc-800 text-zinc-400")}>{o.status}</span></td><td>{o.status==="pending"&&<div className="flex gap-2"><button onClick={()=>orderStatus(o.id,"paid")} className="px-2 py-1 bg-emerald-950 text-emerald-300 rounded">Pago</button><button onClick={()=>orderStatus(o.id,"cancelled")} className="px-2 py-1 bg-rose-950 text-rose-300 rounded">Cancelar</button></div>}</td></tr>)}</tbody></table></div></section>
    </div>
  </main>
}
