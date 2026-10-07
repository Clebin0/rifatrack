import { createHash, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { supabaseInternal } from "@/lib/supabase";
import { processNotificationBatch } from "@/lib/notifications";
export const maxDuration = 60;
export async function GET(req: Request) {
  const expected = process.env.CRON_SECRET,
    received = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (
    !expected ||
    expected.length < 32 ||
    !received ||
    !timingSafeEqual(
      createHash("sha256").update(expected).digest(),
      createHash("sha256").update(received).digest(),
    )
  )
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  try {
    const { data, error } = await supabaseInternal().rpc("maintenance_internal");
    if (error) throw error;
    return NextResponse.json(
      { maintenance: data, notifications: await processNotificationBatch(5) },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return NextResponse.json({ error: "Falha na manutenção" }, { status: 500 });
  }
}
