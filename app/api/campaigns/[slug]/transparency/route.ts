import { publicRateLimit } from "@/lib/rate-limit";
import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase";

export async function GET(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const limited = await publicRateLimit(req, "public-read", 180, 60);
  if (limited) return limited;
  const { slug } = await params;
  if (!/^[a-z0-9-]{2,80}$/.test(slug))
    return NextResponse.json({ error: "Campanha inválida" }, { status: 400 });
  const { data, error } = await supabaseServer().rpc("public_draw_verification", { p_slug: slug });
  if (error || !data)
    return NextResponse.json({ error: "Transparência indisponível" }, { status: 404 });
  return NextResponse.json(data, { headers: { "Cache-Control": "no-store", Pragma: "no-cache" } });
}
