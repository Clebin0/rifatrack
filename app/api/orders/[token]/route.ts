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
      provider_qr_payload: string;
      pix_key: string;
      pix_receiver: string;
      pix_city: string;
      amount_cents: number;
      pix_txid: string;
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
      { ...order, pix_payload },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return NextResponse.json({ error: "Serviço indisponível" }, { status: 503 });
  }
}
