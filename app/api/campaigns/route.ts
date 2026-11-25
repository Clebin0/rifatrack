import { publicRateLimit } from "@/lib/rate-limit";
import { NextResponse } from "next/server";
import { supabaseInternal } from "@/lib/supabase";
import { getVisibleCampaigns } from "@/lib/campaign-content";

export async function GET(req: Request) {
  const limited = await publicRateLimit(req, "public-read", 180, 60);
  if (limited) return limited;
  try {
    const { data, error } = await supabaseInternal().rpc("public_active_campaigns");
    if (error) throw error;
    const campaigns = Array.isArray(data)
      ? getVisibleCampaigns(
          (data as unknown[]).filter(
            (campaign): campaign is Record<string, unknown> & { slug: string } =>
              Boolean(campaign) &&
              typeof campaign === "object" &&
              typeof (campaign as Record<string, unknown>).slug === "string",
          ),
        )
      : [];
    return NextResponse.json(campaigns, {
      headers: { "Cache-Control": "public, s-maxage=10, stale-while-revalidate=30" },
    });
  } catch {
    return NextResponse.json({ error: "Serviço indisponível" }, { status: 503 });
  }
}
