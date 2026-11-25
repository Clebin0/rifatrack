import { NextResponse } from "next/server";
import { z } from "zod";
import { supabaseInternal } from "@/lib/supabase";
import { publicRateLimit } from "@/lib/rate-limit";

const subscriptionSchema = z.object({
  email: z.string().trim().email().max(254),
  consent: z.literal(true),
  website: z.string().max(0).optional().default(""),
});

export async function POST(req: Request) {
  const limited = await publicRateLimit(req, "christmas-campaign-updates", 6, 3600);
  if (limited) return limited;

  if (!(req.headers.get("content-type") || "").toLowerCase().startsWith("application/json"))
    return NextResponse.json({ error: "Formato inválido." }, { status: 415 });
  if (Number(req.headers.get("content-length") || "0") > 4096)
    return NextResponse.json({ error: "Solicitação muito grande." }, { status: 413 });

  let input: unknown;
  try {
    input = JSON.parse(await req.text());
  } catch {
    return NextResponse.json({ error: "Não foi possível ler os dados enviados." }, { status: 400 });
  }
  const parsed = subscriptionSchema.safeParse(input);
  if (!parsed.success)
    return NextResponse.json(
      { error: "Informe um e-mail válido e confirme que deseja receber o aviso." },
      { status: 400 },
    );

  if (parsed.data.website) return NextResponse.json({ ok: true });

  const { error } = await supabaseInternal().from("campaign_update_subscribers").upsert(
    {
      campaign_key: "natal",
      email: parsed.data.email.toLowerCase(),
      consented_at: new Date().toISOString(),
      unsubscribed_at: null,
    },
    { onConflict: "campaign_key,email" },
  );

  if (error)
    return NextResponse.json(
      { error: "Não foi possível registrar agora. Tente novamente em alguns minutos." },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );

  return NextResponse.json({ ok: true }, { status: 201, headers: { "Cache-Control": "no-store" } });
}
