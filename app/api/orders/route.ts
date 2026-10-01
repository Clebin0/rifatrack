import { createHash } from "crypto";
import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase";
import { orderSchema } from "@/lib/validation";

export async function POST(req: Request) {
  try {
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
      p_numbers: parsed.data.numbers,
    });

    if (error) return NextResponse.json({ error: "Não foi possível reservar. Atualize a página e tente novamente." }, { status: 409 });
    return NextResponse.json({ order: data }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Requisição inválida." }, { status: 400 });
  }
}
