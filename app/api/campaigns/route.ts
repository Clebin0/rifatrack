import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase";

export async function GET() {
  try {
    const { data, error } = await supabaseServer().rpc("public_active_campaigns");
    if (error) throw error;
    return NextResponse.json(data ?? [], { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Serviço indisponível" }, { status: 503 });
  }
}
