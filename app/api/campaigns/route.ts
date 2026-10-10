import { publicRateLimit } from "@/lib/rate-limit";
import { NextResponse } from "next/server";
import { supabaseInternal } from "@/lib/supabase";

export async function GET(req: Request) {
  const limited = await publicRateLimit(req, "public-read", 180, 60);
  if (limited) return limited;
  try {
    const { data, error } = await supabaseInternal().rpc("public_active_campaigns");
    if (error) throw error;
    return NextResponse.json(data ?? [], {
      headers: { "Cache-Control": "public, s-maxage=10, stale-while-revalidate=30" },
    });
  } catch {
    return NextResponse.json({ error: "Serviço indisponível" }, { status: 503 });
  }
}
