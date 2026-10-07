import { createHash, timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";
import { processNotificationBatch } from "@/lib/notifications";

function same(a: string, b: string) {
  const x = createHash("sha256").update(a).digest(),
    y = createHash("sha256").update(b).digest();
  return timingSafeEqual(x, y);
}
export async function POST(req: Request) {
  const expected = process.env.NOTIFICATION_CRON_SECRET;
  const received = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  if (!expected || expected.length < 32 || !received || !same(received, expected))
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  try {
    return NextResponse.json(await processNotificationBatch(50), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch {
    return NextResponse.json({ error: "Falha ao processar fila" }, { status: 500 });
  }
}
