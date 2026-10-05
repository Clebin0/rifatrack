import { publicRateLimit } from "@/lib/rate-limit";
import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase";

export async function GET(req: Request) {
  const limited = await publicRateLimit(req, "public-read", 180, 60);
  if (limited) return limited;
  try {
    const { data, error } = await supabaseServer().rpc("public_active_campaigns");
    if (error) throw error;
    return NextResponse.json(data ?? [], { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Serviço indisponível" }, { status: 503 });
  }
}
