import "server-only";
import { createHash } from "node:crypto";
import { isIP } from "node:net";
import { NextResponse } from "next/server";
import { supabaseInternal } from "./supabase";
export function requestIp(req: Request) {
  const raw =
    process.env.VERCEL === "1"
      ? req.headers.get("x-vercel-forwarded-for")
      : req.headers.get("x-real-ip");
  const ip = raw?.split(",")[0].trim() ?? "";
  if (!isIP(ip)) {
    if (process.env.NODE_ENV !== "production") return "127.0.0.1";
    throw new Error("trusted_ip_missing");
  }
  return ip;
}
export async function publicRateLimit(req: Request, scope: string, limit = 120, seconds = 60) {
  try {
    const key = createHash("sha256")
      .update(scope + ":" + requestIp(req))
      .digest("hex");
    const { data, error } = await supabaseInternal().rpc("consume_rate_limit_internal", {
      p_key: key,
      p_limit: limit,
      p_seconds: seconds,
    });
    if (error || !data) throw error ?? new Error("rate_limiter_unavailable");
    const result = data as { allowed: boolean; retry_after: number };
    return result.allowed
      ? null
      : NextResponse.json(
          { error: "Muitas solicitações. Aguarde antes de tentar novamente." },
          {
            status: 429,
            headers: { "Retry-After": String(result.retry_after), "Cache-Control": "no-store" },
          },
        );
  } catch {
    return NextResponse.json(
      { error: "Serviço temporariamente indisponível." },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
