import { createHash, timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase";

function safeEqual(a:string,b:string){
  const ah=createHash("sha256").update(a).digest();
  const bh=createHash("sha256").update(b).digest();
  return timingSafeEqual(ah,bh);
}

function cents(value:unknown){
  const n=Number(value);
  return Number.isFinite(n) ? Math.round(n*100) : null;
}

export async function POST(req:Request){
  const expected=process.env.ASAAS_WEBHOOK_TOKEN;
  if(!expected) return NextResponse.json({error:"Webhook não configurado"},{status:503});

  const received=req.headers.get("asaas-access-token")||"";
  if(!received || !safeEqual(received,expected)){
    return NextResponse.json({error:"Não autorizado"},{status:401});
  }

  let body:any;
  try{body=await req.json()}catch{return NextResponse.json({error:"JSON inválido"},{status:400})}

  const eventId=String(body?.id||"");
  const eventType=String(body?.event||"");
  const payment=body?.payment||{};
  if(!eventId || !eventType){
    return NextResponse.json({error:"Evento inválido"},{status:400});
  }

  const paidAtRaw=payment?.paymentDate || payment?.confirmedDate || body?.dateCreated || null;
  const paidAt=paidAtRaw ? new Date(paidAtRaw).toISOString() : null;
  const pixTransactionId=
    typeof payment?.pixTransaction==="string" ? payment.pixTransaction :
    payment?.pixTransaction?.id ? String(payment.pixTransaction.id) : null;

  const secret=process.env.RIFATRACK_INTERNAL_API_SECRET;
  if(!secret) return NextResponse.json({error:"Serviço indisponível"},{status:503});

  const {data,error}=await supabaseServer().rpc("process_asaas_event",{
    p_internal_secret:secret,
    p_event_id:eventId,
    p_event_type:eventType,
    p_payment_id:payment?.id ? String(payment.id) : null,
    p_qr_id:payment?.pixQrCodeId ? String(payment.pixQrCodeId) : null,
    p_payment_status:payment?.status ? String(payment.status) : null,
    p_value_cents:cents(payment?.value),
    p_net_value_cents:cents(payment?.netValue),
    p_paid_at:paidAt,
    p_pix_transaction_id:pixTransactionId,
    p_payload:body,
  });

  if(error){
    return NextResponse.json({error:"Falha ao registrar evento"},{status:500});
  }
  return NextResponse.json({ok:true,result:data},{status:200});
}
