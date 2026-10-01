import { createHash } from "crypto";
import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase";
import { orderSchema } from "@/lib/validation";
import { asaasAutomaticEnabled, createAsaasPixQr } from "@/lib/asaas";

export async function POST(req: Request) {
  try {
    if(!(req.headers.get("content-type")||"").toLowerCase().startsWith("application/json")){
      return NextResponse.json({error:"Formato inválido."},{status:415});
    }
    const contentLength=Number(req.headers.get("content-length")||"0");
    if(contentLength>16384) return NextResponse.json({error:"Requisição muito grande."},{status:413});
    const parsed = orderSchema.safeParse(await req.json());
    if (!parsed.success) return NextResponse.json({ error: "Confira os dados informados." }, { status: 400 });

    const secret = process.env.RIFATRACK_INTERNAL_API_SECRET;
    if (!secret) return NextResponse.json({ error: "Serviço temporariamente indisponível." }, { status: 503 });

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

    if (error) return NextResponse.json({ error: "Não foi possível reservar. Atualize a página e tente novamente." }, { status: 409 });

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
        return NextResponse.json({ error: "Não foi possível gerar a cobrança Pix agora. Tente novamente em instantes." }, { status: 502 });
      }
    }

    return NextResponse.json({ order }, { status: 201, headers: { "Cache-Control": "no-store", "Pragma":"no-cache" } });
  } catch {
    return NextResponse.json({ error: "Requisição inválida." }, { status: 400 });
  }
}
