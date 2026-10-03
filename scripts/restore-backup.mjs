import fs from "node:fs/promises";
import crypto from "node:crypto";
import {createClient} from "@supabase/supabase-js";

function fromBase64(v){return Buffer.from(v,"base64")}
async function decrypt(path,passphrase){
  const envelope=JSON.parse(await fs.readFile(path,"utf8"));
  if(envelope.format!=="rifatrack-backup"||envelope.version!==1)throw new Error("Formato de backup inválido.");
  const key=crypto.pbkdf2Sync(Buffer.from(passphrase),fromBase64(envelope.salt),envelope.iterations,32,"sha256");
  const payload=fromBase64(envelope.data),ciphertext=payload.subarray(0,payload.length-16),tag=payload.subarray(payload.length-16);
  const decipher=crypto.createDecipheriv("aes-256-gcm",key,fromBase64(envelope.iv));decipher.setAuthTag(tag);
  return JSON.parse(Buffer.concat([decipher.update(ciphertext),decipher.final()]).toString("utf8"));
}
async function chunks(rows,size=400){const out=[];for(let i=0;i<rows.length;i+=size)out.push(rows.slice(i,i+size));return out}
async function write(client,table,rows,onConflict){
  for(const batch of await chunks(rows)){
    if(!batch.length)continue;
    const q=onConflict?client.from(table).upsert(batch,{onConflict}):client.from(table).insert(batch);
    const {error}=await q;if(error)throw new Error(table+": "+error.message);
  }
  console.log("RESTORED",table,rows.length);
}

const [file]=process.argv.slice(2);
const password=process.env.BACKUP_PASSPHRASE;
const url=process.env.RESTORE_SUPABASE_URL;
const key=process.env.RESTORE_SUPABASE_SERVICE_ROLE_KEY;
if(process.env.ALLOW_RIFATRACK_RESTORE!=="YES")throw new Error("Defina ALLOW_RIFATRACK_RESTORE=YES conscientemente.");
if(!file||!password||!url||!key)throw new Error("Faltam arquivo, BACKUP_PASSPHRASE, RESTORE_SUPABASE_URL ou RESTORE_SUPABASE_SERVICE_ROLE_KEY.");
if(process.env.PRODUCTION_SUPABASE_URL&&url===process.env.PRODUCTION_SUPABASE_URL&&process.env.ALLOW_PRODUCTION_RESTORE!=="YES")throw new Error("Restauração direta na produção bloqueada.");

const backup=await decrypt(file,password);
const client=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
const {count,error:countError}=await client.from("campaigns").select("*",{count:"exact",head:true});
if(countError)throw countError;
if((count||0)>0&&process.env.ALLOW_NONEMPTY_TARGET!=="YES")throw new Error("Destino não está vazio. Use ALLOW_NONEMPTY_TARGET=YES somente após conferência.");

const e=backup.entities;
await write(client,"campaigns",e.campaigns||[],"id");
await write(client,"sellers",e.sellers||[],"id");
await write(client,"admin_users",e.admin_users||[],"email");
await write(client,"campaign_sellers",e.campaign_sellers||[],"campaign_id,seller_id");
await write(client,"orders",e.orders||[],"id");
await write(client,"raffle_numbers",e.raffle_numbers||[],"id");
await write(client,"draw_commitments",e.draw_commitments||[],"campaign_id");
await write(client,"draws",e.draws||[],"id");
await write(client,"audit_logs",(e.audit_logs||[]).map(({id,...x})=>x));
await write(client,"payment_events",(e.payment_events||[]).map(({id,...x})=>x));
console.log("Restauração de dados concluída. Recrie/revincule contas Auth, confira comprovantes do Storage e rotacione segredos antes de promover o ambiente.");
