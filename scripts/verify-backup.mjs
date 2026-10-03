import fs from "node:fs/promises";
import crypto from "node:crypto";

function fromBase64(v){return Buffer.from(v,"base64")}
async function decrypt(path,passphrase){
  const envelope=JSON.parse(await fs.readFile(path,"utf8"));
  if(envelope.format!=="rifatrack-backup"||envelope.version!==1)throw new Error("Formato de backup inválido.");
  const key=crypto.pbkdf2Sync(Buffer.from(passphrase),fromBase64(envelope.salt),envelope.iterations,32,"sha256");
  const payload=fromBase64(envelope.data);
  if(payload.length<16)throw new Error("Backup inválido.");
  const ciphertext=payload.subarray(0,payload.length-16),tag=payload.subarray(payload.length-16);
  const decipher=crypto.createDecipheriv("aes-256-gcm",key,fromBase64(envelope.iv));
  decipher.setAuthTag(tag);
  const plain=Buffer.concat([decipher.update(ciphertext),decipher.final()]);
  return JSON.parse(plain.toString("utf8"));
}

const [file]=process.argv.slice(2);
const password=process.env.BACKUP_PASSPHRASE;
if(!file||!password){console.error("Uso: BACKUP_PASSPHRASE='...' node scripts/verify-backup.mjs arquivo.rtbackup");process.exit(1)}
try{
  const backup=await decrypt(file,password);
  if(backup.schema_version!==1||!backup.entities)throw new Error("Schema de backup não suportado.");
  console.log("Backup válido:",backup.generated_at);
  for(const [name,rows] of Object.entries(backup.entities)){
    const expected=Number(backup.counts?.[name]??rows.length);
    const ok=Array.isArray(rows)&&rows.length===expected;
    console.log((ok?"PASS":"WARN").padEnd(5),name,String(rows.length).padStart(8),"esperado",expected);
  }
}catch(error){console.error("Falha ao verificar backup:",error.message);process.exit(1)}
