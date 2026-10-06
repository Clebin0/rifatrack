import { createHash } from "crypto";
import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase";
import { orderSchema } from "@/lib/validation";
import { asaasAutomaticEnabled, createAsaasPixQr } from "@/lib/asaas";
import { processNotificationBatch } from "@/lib/notifications";
import { logSystemEvent, requestId } from "@/lib/observability";

export async function POST(req: Request) {
  if (Boolean(process.env.VERCEL_ENV) && process.env.FINANCIAL_PRODUCTION_APPROVED !== "true") {
    return NextResponse.json({ error: "A campanha ainda está em preparação. As compras serão liberadas após a organização concluir as pendências." }, { status: 503 });
  }
  const rid=requestId(req);
  const headers={"Cache-Control":"no-store","Pragma":"no-cache","x-request-id":rid};
  try {
    if(!(req.headers.get("content-type")||"").toLowerCase().startsWith("application/json")){
      await logSystemEvent({requestId:rid,severity:"warn",category:"checkout",code:"INVALID_CONTENT_TYPE",route:"/api/orders"});
      return NextResponse.json({error:"Formato inválido."},{status:415,headers});
    }
    const contentLength=Number(req.headers.get("content-length")||"0");
    if(contentLength>16384){await logSystemEvent({requestId:rid,severity:"warn",category:"checkout",code:"PAYLOAD_TOO_LARGE",route:"/api/orders"});return NextResponse.json({error:"Requisição muito grande."},{status:413,headers})}
    const parsed = orderSchema.safeParse(await req.json());
    if (!parsed.success){await logSystemEvent({requestId:rid,severity:"warn",category:"checkout",code:"VALIDATION_FAILED",route:"/api/orders"});return NextResponse.json({ error: "Confira os dados informados." }, { status: 400,headers })}

    const secret = process.env.RIFATRACK_INTERNAL_API_SECRET;
    if (!secret){await logSystemEvent({requestId:rid,severity:"critical",category:"config",code:"INTERNAL_SECRET_MISSING",route:"/api/orders"});return NextResponse.json({ error: "Serviço temporariamente indisponível." }, { status: 503,headers })}

    const ip = (req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "unknown").split(",")[0].trim();
    const ua = req.headers.get("user-agent") || "unknown";
    const fingerprint = createHash("sha256").update(secret + "|" + ip + "|" + ua).digest("hex");

    const { data, error } = await supabaseServer().rpc("reserve_raffle_numbers", {
      p_internal_secret: secret,
      p_fingerprint: fingerprint,
      p_campaign_slug: parsed.data.campaignSlug,
      p_seller_code: parsed.data.sellerCode || null,
      p_buyer_name: parsed.data.buyerName,
      p_buyer_phone: parsed.data.buyerPhone,
      p_buyer_email: parsed.data.buyerEmail || "",
      p_numbers: parsed.data.numbers,
    });

    if (error){await logSystemEvent({requestId:rid,severity:"warn",category:"checkout",code:"RESERVATION_REJECTED",route:"/api/orders",metadata:{campaign:parsed.data.campaignSlug}});return NextResponse.json({ error: "Não foi possível reservar. Atualize a página e tente novamente." }, { status: 409,headers })}

    const order = data as {id:string;public_token:string;amount_cents:number;payment_reference:string};
    if (asaasAutomaticEnabled()) {
      try {
        const qr = await createAsaasPixQr({
          orderId: order.id,
          reference: order.payment_reference,
          amountCents: order.amount_cents,
          description: `RifaTrack ${order.payment_reference}`,
        });
        const { error: attachError } = await supabaseServer().rpc("attach_asaas_qr", {
          p_internal_secret: secret,
          p_order_id: order.id,
          p_qr_id: qr.id,
          p_payload: qr.payload || "",
        });
        if (attachError) throw attachError;
      } catch {
        await supabaseServer().rpc("cancel_order_internal", {
          p_internal_secret: secret,
          p_order_id: order.id,
          p_reason: "asaas_qr_creation_failed",
        });
        await logSystemEvent({requestId:rid,severity:"error",category:"payments",code:"ASAAS_QR_CREATION_FAILED",route:"/api/orders",metadata:{order_id:order.id}});
        return NextResponse.json({ error: "Não foi possível gerar a cobrança Pix agora. Tente novamente em instantes." }, { status: 502,headers });
      }
    }

    await supabaseServer().rpc("enqueue_order_notification_internal",{p_internal_secret:secret,p_order_id:order.id,p_event:"reserved"});
    try{await processNotificationBatch(4)}catch{}
    await logSystemEvent({requestId:rid,severity:"info",category:"checkout",code:"ORDER_RESERVED",route:"/api/orders",metadata:{order_id:order.id,provider:asaasAutomaticEnabled()?"asaas":"manual"}});
    return NextResponse.json({ order }, { status: 201, headers });
  } catch {
    await logSystemEvent({requestId:rid,severity:"error",category:"checkout",code:"UNHANDLED_ORDER_ERROR",route:"/api/orders"});
    return NextResponse.json({ error: "Requisição inválida." }, { status: 400,headers });
  }
}
