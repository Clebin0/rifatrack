import { NextResponse } from "next/server";
import { z } from "zod";
import { authenticatedAdminRole } from "@/lib/admin-auth-server";
import { supabaseInternal } from "@/lib/supabase";
import { QUICKNET, verifiedFutureBeacon } from "@/lib/drand";

export async function POST(req: Request) {
  const admin = await authenticatedAdminRole(req);
  if (!admin) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  if (!["owner", "admin"].includes(admin.role))
    return NextResponse.json({ error: "Sem permissão." }, { status: 403 });
  const { data: aal2, error: mfaError } = await admin.client.rpc("is_admin_aal2");
  if (mfaError || !aal2)
    return NextResponse.json({ error: "Confirme o MFA antes de sortear." }, { status: 403 });
  const body = z.object({ campaignId: z.uuid() }).safeParse(await req.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "Campanha inválida." }, { status: 400 });
  try {
    const sb = supabaseInternal();
    const campaign = await sb
      .from("campaigns")
      .select("slug")
      .eq("id", body.data.campaignId)
      .single();
    if (campaign.error) throw new Error("campaign_unavailable");
    if (campaign.data.slug === "dia-das-criancas")
      return NextResponse.json(
        {
          error:
            "Esta campanha informa sorteio pela Loteria Federal. O sorteio drand não se aplica. Confirme e registre a extração e a regra de correspondência do regulamento.",
        },
        { status: 409 },
      );
    const { data, error } = await sb.rpc("draw_state_internal", {
      p_campaign_id: body.data.campaignId,
    });
    const state = z
      .object({ round: z.number().int().positive(), chain_hash: z.literal(QUICKNET.hash) })
      .safeParse(data);
    if (error || !state.success)
      return NextResponse.json({ error: "Finalize a campanha antes de sortear." }, { status: 409 });
    const beacon = await verifiedFutureBeacon(state.data.round);
    const result = await sb.rpc("complete_drand_draw_internal", {
      p_campaign_id: body.data.campaignId,
      p_round: beacon.round,
      p_randomness: beacon.randomness,
      p_signature: beacon.signature,
      p_actor: admin.email,
    });
    if (result.error)
      return NextResponse.json(
        { error: "O sorteio foi bloqueado. Confira a conciliação e o encerramento." },
        { status: 409 },
      );
    return NextResponse.json(result.data, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const pending = error instanceof Error && error.message === "beacon_pending";
    return NextResponse.json(
      {
        error: pending
          ? "A rodada futura ainda não está disponível. Aguarde até cinco minutos após finalizar."
          : "Não foi possível validar a aleatoriedade externa. Tente novamente.",
      },
      { status: pending ? 409 : 503 },
    );
  }
}
