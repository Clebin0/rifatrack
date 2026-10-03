"use client";
import {useEffect,useState} from "react";
import {CheckCircle2,Copy,RefreshCw,ShieldCheck} from "lucide-react";

type Data={
 campaign_name:string;slug:string;status:string;eligible_numbers:number[];eligible_count:number;
 paid_list_hash:string|null;seed_commitment:string|null;commitment_created_at:string|null;
 drawn:boolean;number:number|null;drawn_at:string|null;method:string|null;seed_reveal:string|null;
};

async function sha256(text:string){
 const bytes=new TextEncoder().encode(text);
 const hash=await crypto.subtle.digest("SHA-256",bytes);
 return Array.from(new Uint8Array(hash)).map(x=>x.toString(16).padStart(2,"0")).join("");
}

export default function TransparencyClient({slug}:{slug:string}){
 const [data,setData]=useState<Data|null>(null);const [loading,setLoading]=useState(true);const [verification,setVerification]=useState<{list:boolean;commit:boolean;winner:boolean;computed:number|null}|null>(null);
 async function load(){setLoading(true);const r=await fetch("/api/campaigns/"+encodeURIComponent(slug)+"/transparency",{cache:"no-store"});if(r.ok)setData(await r.json());else setData(null);setLoading(false)}
 useEffect(()=>{load()},[slug]);
 useEffect(()=>{(async()=>{if(!data||!data.paid_list_hash||!data.seed_commitment)return;const list=data.eligible_numbers.join(",");const listHash=await sha256(list);let commit=false,winner=false,computed:null|number=null;if(data.seed_reveal){const commitHash=await sha256(data.seed_reveal+":"+data.paid_list_hash);commit=commitHash===data.seed_commitment;const drawHash=await sha256(data.seed_reveal+":"+data.paid_list_hash+":RIFATRACK_DRAW_V1");const first64=BigInt("0x"+drawHash.slice(0,16));const index=Number((first64&((1n<<63n)-1n))%BigInt(Math.max(1,data.eligible_numbers.length)));computed=data.eligible_numbers[index]??null;winner=computed===data.number}setVerification({list:listHash===data.paid_list_hash,commit,winner,computed})})()},[data]);
 if(loading)return <main className="min-h-screen grid place-items-center bg-zinc-950"><RefreshCw className="animate-spin"/></main>;
 if(!data)return <main className="min-h-screen grid place-items-center bg-zinc-950 p-5 text-center"><div><h1 className="text-3xl font-black">Transparência indisponível</h1><p className="text-zinc-500 mt-2">A campanha precisa estar encerrada e possuir registro de integridade.</p><a href={"/campanha/"+slug} className="text-emerald-400 inline-block mt-4">Voltar à campanha</a></div></main>;
 return <main className="min-h-screen bg-zinc-950"><div className="max-w-4xl mx-auto px-5 py-10"><a href={"/campanha/"+slug} className="text-sm text-zinc-400">← Voltar à campanha</a><div className="mt-5 flex gap-3 items-center"><div className="w-12 h-12 grid place-items-center rounded-2xl bg-emerald-950 border border-emerald-800 text-emerald-300"><ShieldCheck/></div><div><p className="text-emerald-400 text-sm font-bold">TRANSPARÊNCIA</p><h1 className="text-3xl font-black">{data.campaign_name}</h1></div></div>
 <p className="text-zinc-400 mt-5">Ao encerrar a campanha, a lista de números pagos é congelada e recebe um hash SHA-256. O sistema também cria um segredo aleatório e publica apenas o compromisso criptográfico desse segredo. Depois do sorteio, o segredo é revelado para que qualquer pessoa possa recalcular o resultado.</p>
 <section className="grid sm:grid-cols-2 gap-4 mt-7">{[["Elegíveis",String(data.eligible_count)],["Status",data.drawn?"Sorteio realizado":"Aguardando sorteio"],["Compromisso criado",data.commitment_created_at?new Date(data.commitment_created_at).toLocaleString("pt-BR"):"—"],["Resultado",data.number?String(data.number).padStart(3,"0"):"—"]].map(([a,b])=><div key={a} className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4"><p className="text-xs text-zinc-500">{a}</p><b className="text-xl mt-1 block">{b}</b></div>)}</section>
 <section className="mt-5 rounded-3xl border border-zinc-800 bg-zinc-900 p-5 space-y-4"><h2 className="text-xl font-black">Provas criptográficas</h2>{[["Hash da lista paga",data.paid_list_hash],["Compromisso da semente",data.seed_commitment],["Semente revelada",data.seed_reveal]].map(([label,value])=><div key={label}><p className="text-xs text-zinc-500">{label}</p><div className="mt-1 flex gap-2"><code className="flex-1 break-all rounded-xl bg-zinc-950 border border-zinc-800 p-3 text-xs">{value||"Ainda não revelada"}</code>{value&&<button onClick={()=>navigator.clipboard.writeText(value)} className="p-3 rounded-xl bg-zinc-800"><Copy size={16}/></button>}</div></div>)}</section>
 {verification&&<section className="mt-5 rounded-3xl border border-zinc-800 bg-zinc-900 p-5"><h2 className="text-xl font-black">Verificação no seu navegador</h2><div className="grid sm:grid-cols-3 gap-3 mt-4">{[["Lista íntegra",verification.list],["Compromisso válido",data.drawn?verification.commit:true],["Resultado reproduzível",data.drawn?verification.winner:true]].map(([label,ok])=><div key={String(label)} className={"rounded-2xl border p-4 "+(ok?"border-emerald-800 bg-emerald-950/30":"border-rose-800 bg-rose-950/30")}><CheckCircle2 className={ok?"text-emerald-400":"text-rose-400"}/><b className="block mt-2">{label}</b></div>)}</div>{data.drawn&&<p className="text-sm text-zinc-500 mt-4">Resultado recalculado localmente: <b className="text-white">{verification.computed==null?"—":String(verification.computed).padStart(3,"0")}</b>.</p>}</section>}
 <section className="mt-5 rounded-3xl border border-zinc-800 bg-zinc-900 p-5"><h2 className="text-xl font-black">Números elegíveis congelados</h2><div className="flex flex-wrap gap-2 mt-4">{data.eligible_numbers.map(n=><span key={n} className="rounded-lg bg-zinc-950 border border-zinc-800 px-2 py-1 font-mono text-xs">{String(n).padStart(3,"0")}</span>)}</div></section>
 </div></main>
}