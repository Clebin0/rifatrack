import { NextResponse } from "next/server";
import { supabaseInternal } from "@/lib/supabase";
export async function GET() {
  try {
    const { data, error } = await supabaseInternal().rpc("health_check_internal");
    if (error || data !== true) throw error ?? new Error("unhealthy");
    return NextResponse.json(
      { ok: true, service: "rifatrack", database: "up" },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return NextResponse.json(
      { ok: false, service: "rifatrack", database: "unavailable" },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
