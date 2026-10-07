import { publicRateLimit } from "@/lib/rate-limit";
import { NextResponse } from "next/server";
import { supabaseInternal } from "@/lib/supabase";
import { buildPixPayload } from "@/lib/pix";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function GET(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const limited = await publicRateLimit(req, "public-read", 180, 60);
  if (limited) return limited;
  const { token } = await params;
  if (!UUID.test(token)) return NextResponse.json({ error: "Pedido inválido" }, { status: 400 });
  try {
    const { data, error } = await supabaseInternal().rpc("public_order", { p_token: token });
    if (error || !data)
      return NextResponse.json({ error: "Pedido não encontrado" }, { status: 404 });
    const order = data as unknown as {
      status: "pending" | "paid" | "cancelled" | "expired";
      amount_cents: number;
      expires_at: string;
      payment_reference: string;
      pix_txid: string;
      buyer_name: string;
      campaign_name: string;
      campaign_slug: string;
      seller_name: string | null;
      seller_whatsapp: string | null;
      pix_key: string;
      pix_receiver: string;
      pix_city: string;
      proof_status: "none" | "submitted" | "approved" | "rejected";
      proof_uploaded_at: string | null;
      payment_provider: string;
      provider_qr_payload: string;
      provider_paid_at: string | null;
      numbers: number[];
    };
    const pix_payload =
      order?.provider_qr_payload ||
      (order?.pix_key
        ? buildPixPayload({
            key: order.pix_key,
            receiver: order.pix_receiver || "RECEBEDOR",
            city: order.pix_city || "CURITIBA",
            amountCents: order.amount_cents || 0,
            txid: order.pix_txid || "***",
          })
        : "");
    return NextResponse.json(
      {
        status: order.status,
        amount_cents: order.amount_cents,
        expires_at: order.expires_at,
        payment_reference: order.payment_reference,
        pix_txid: order.pix_txid,
        buyer_name: order.buyer_name,
        campaign_name: order.campaign_name,
        campaign_slug: order.campaign_slug,
        seller_name: order.seller_name,
        seller_whatsapp: order.seller_whatsapp,
        pix_key: order.pix_key,
        pix_receiver: order.pix_receiver,
        proof_status: order.proof_status,
        proof_uploaded_at: order.proof_uploaded_at,
        payment_provider: order.payment_provider,
        provider_paid_at: order.provider_paid_at,
        numbers: order.numbers,
        pix_payload,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return NextResponse.json({ error: "Serviço indisponível" }, { status: 503 });
  }
}
