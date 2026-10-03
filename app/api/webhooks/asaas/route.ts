import { createHash, timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase";
import { processNotificationBatch } from "@/lib/notifications";
import { logSystemEvent, requestId } from "@/lib/observability";

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
  const rid=requestId(req);
  const headers={"Cache-Control":"no-store","x-request-id":rid};
  const expected=process.env.ASAAS_WEBHOOK_TOKEN;
  if(!expected || expected.length<32){await logSystemEvent({requestId:rid,severity:"critical",category:"config",code:"ASAAS_WEBHOOK_TOKEN_MISSING",route:"/api/webhooks/asaas"});return NextResponse.json({error:"Webhook não configurado"},{status:503,headers})}
  const contentLength=Number(req.headers.get("content-length")||"0");
  if(contentLength>262144){await logSystemEvent({requestId:rid,severity:"warn",category:"security",code:"WEBHOOK_PAYLOAD_TOO_LARGE",route:"/api/webhooks/asaas"});return NextResponse.json({error:"Payload muito grande"},{status:413,headers})}

  const received=req.headers.get("asaas-access-token")||"";
  if(!received || !safeEqual(received,expected)){
    await logSystemEvent({requestId:rid,severity:"warn",category:"security",code:"WEBHOOK_AUTH_FAILED",route:"/api/webhooks/asaas"});
    return NextResponse.json({error:"Não autorizado"},{status:401,headers});
  }

  let body:any;
  try{body=await req.json()}catch{await logSystemEvent({requestId:rid,severity:"warn",category:"payments",code:"WEBHOOK_INVALID_JSON",route:"/api/webhooks/asaas"});return NextResponse.json({error:"JSON inválido"},{status:400,headers})}

  const eventId=String(body?.id||"");
  const eventType=String(body?.event||"");
  const payment=body?.payment||{};
  const allowedEvents=new Set(["PAYMENT_RECEIVED","PAYMENT_CONFIRMED","PAYMENT_REFUNDED","PAYMENT_CHARGEBACK_REQUESTED","PAYMENT_CHARGEBACK_DISPUTE"]);
  if(!eventId || !allowedEvents.has(eventType)){
    await logSystemEvent({requestId:rid,severity:"warn",category:"payments",code:"WEBHOOK_EVENT_REJECTED",route:"/api/webhooks/asaas"});
    return NextResponse.json({error:"Evento inválido"},{status:400,headers});
  }

  const paidAtRaw=payment?.paymentDate || payment?.confirmedDate || body?.dateCreated || null;
  const paidAt=paidAtRaw ? new Date(paidAtRaw).toISOString() : null;
  const pixTransactionId=
    typeof payment?.pixTransaction==="string" ? payment.pixTransaction :
    payment?.pixTransaction?.id ? String(payment.pixTransaction.id) : null;

  const secret=process.env.RIFATRACK_INTERNAL_API_SECRET;
  if(!secret)return NextResponse.json({error:"Serviço indisponível"},{status:503,headers});

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
    p_payload:{
      id:eventId,
      event:eventType,
      payment:{
        id:payment?.id||null,
        status:payment?.status||null,
        value:payment?.value??null,
        netValue:payment?.netValue??null,
        pixQrCodeId:payment?.pixQrCodeId||null,
        billingType:payment?.billingType||null,
        paymentDate:payment?.paymentDate||null,
        confirmedDate:payment?.confirmedDate||null,
      }
    },
  });

  if(error){
    await logSystemEvent({requestId:rid,severity:"error",category:"payments",code:"WEBHOOK_PROCESSING_FAILED",route:"/api/webhooks/asaas",metadata:{event_type:eventType,event_id:eventId}});
    return NextResponse.json({error:"Falha ao registrar evento"},{status:500,headers});
  }
  try{await processNotificationBatch(8)}catch{}
  await logSystemEvent({requestId:rid,severity:"info",category:"payments",code:"WEBHOOK_PROCESSED",route:"/api/webhooks/asaas",metadata:{event_type:eventType,event_id:eventId}});
  return NextResponse.json({ok:true,result:data},{status:200,headers});
}
