import { publicRateLimit } from "@/lib/rate-limit";
import { NextResponse } from "next/server";
import { supabaseInternal } from "@/lib/supabase";

export async function GET(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const limited = await publicRateLimit(req, "public-read", 180, 60);
  if (limited) return limited;
  const { slug } = await params;
  if (!/^[a-z0-9-]{2,80}$/.test(slug))
    return NextResponse.json({ error: "Campanha inválida" }, { status: 400 });
  const seller = new URL(req.url).searchParams.get("vendedor") || "";
  try {
    const { data, error } = await supabaseInternal().rpc("public_campaign", {
      p_slug: slug,
      p_seller_code: seller,
    });
    if (error || !data)
      return NextResponse.json({ error: "Campanha não encontrada" }, { status: 404 });
    const campaign = data as unknown as {
      sellers?: Array<{ name: string; code: string; team: string | null; whatsapp?: string }>;
      [key: string]: unknown;
    };
    const sellers = (campaign.sellers || []).map(({ whatsapp: _whatsapp, ...seller }) => seller);
    return NextResponse.json(
      { ...campaign, sellers },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return NextResponse.json({ error: "Serviço indisponível" }, { status: 503 });
  }
}
