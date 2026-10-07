import { NextResponse } from "next/server";
import { publicRateLimit } from "@/lib/rate-limit";
import { supabaseInternal } from "@/lib/supabase";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function GET(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const limited = await publicRateLimit(req, "payer-read", 60, 60);
  if (limited) return limited;
  const { token } = await params;
  if (!UUID.test(token)) return NextResponse.json({ error: "Pedido inválido." }, { status: 400 });
  const { data, error } = await supabaseInternal().rpc("order_payer_declaration", {
    p_token: token,
  });
  if (error) return NextResponse.json({ error: "Não foi possível consultar." }, { status: 503 });
  return NextResponse.json(data ?? null, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const limited = await publicRateLimit(req, "payer-write", 12, 60);
  if (limited) return limited;
  const { token } = await params;
  if (!UUID.test(token)) return NextResponse.json({ error: "Pedido inválido." }, { status: 400 });
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }
  const value = body as { name?: unknown; reference?: unknown };
  const name = typeof value.name === "string" ? value.name.trim() : "";
  const reference = typeof value.reference === "string" ? value.reference.trim() : "";
  if (name.length < 2 || name.length > 100 || reference.length > 120)
    return NextResponse.json({ error: "Dados inválidos." }, { status: 400 });
  const { error } = await supabaseInternal().rpc("report_order_payer", {
    p_token: token,
    p_name: name,
    p_reference: reference,
  });
  if (error) {
    const throttled = /declaration limit/i.test(error.message);
    return NextResponse.json(
      { error: throttled ? "Aguarde antes de alterar novamente." : "Não foi possível salvar." },
      { status: throttled ? 429 : 400 },
    );
  }
  return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
}
