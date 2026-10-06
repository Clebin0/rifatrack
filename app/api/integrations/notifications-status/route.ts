import { NextResponse } from "next/server";
import { notificationsConfigured } from "@/lib/notifications";
export function GET() {
  return NextResponse.json(
    { provider: "resend", configured: notificationsConfigured() },
    { headers: { "Cache-Control": "no-store" } },
  );
}
