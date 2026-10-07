import { NextResponse } from "next/server";
import { publicRateLimit } from "@/lib/rate-limit";
import { supabaseInternal } from "@/lib/supabase";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const TYPES = new Map([
  ["application/pdf", "pdf"],
  ["image/png", "png"],
  ["image/jpeg", "jpg"],
]);

export async function POST(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const limited = await publicRateLimit(req, "proof-upload", 8, 60);
  if (limited) return limited;
  const { token } = await params;
  if (!UUID.test(token)) return NextResponse.json({ error: "Pedido inválido." }, { status: 400 });

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Upload inválido." }, { status: 400 });
  }
  const file = form.get("file");
  if (!(file instanceof File))
    return NextResponse.json({ error: "Arquivo ausente." }, { status: 400 });
  if (file.size < 1 || file.size > 5 * 1024 * 1024)
    return NextResponse.json({ error: "O arquivo deve ter no máximo 5 MB." }, { status: 413 });
  const ext = TYPES.get(file.type);
  if (!ext) return NextResponse.json({ error: "Envie JPG, PNG ou PDF." }, { status: 415 });

  const sb = supabaseInternal();
  const { data: order, error: orderError } = await sb.rpc("public_order", { p_token: token });
  const state = order as { status?: string; expires_at?: string } | null;
  if (orderError || !state)
    return NextResponse.json({ error: "Pedido não encontrado." }, { status: 404 });
  if (
    state.status !== "pending" ||
    !state.expires_at ||
    new Date(state.expires_at).getTime() <= Date.now()
  )
    return NextResponse.json({ error: "A reserva não aceita mais comprovantes." }, { status: 409 });

  const path = `${token}/comprovante.${ext}`;
  const { error: uploadError } = await sb.storage
    .from("payment-proofs")
    .upload(path, file, { contentType: file.type, upsert: false });
  if (uploadError) {
    const exists = /already|duplicate|resource exists/i.test(uploadError.message);
    return NextResponse.json(
      {
        error: exists
          ? "Já existe um comprovante para este pedido."
          : "Não foi possível armazenar o comprovante.",
      },
      { status: exists ? 409 : 503 },
    );
  }
  const { error: linkError } = await sb.rpc("register_payment_proof", {
    p_token: token,
    p_path: path,
  });
  if (linkError) {
    await sb.storage.from("payment-proofs").remove([path]);
    return NextResponse.json(
      { error: "Não foi possível vincular o comprovante ao pedido." },
      { status: 409 },
    );
  }
  return NextResponse.json({ ok: true }, { status: 201, headers: { "Cache-Control": "no-store" } });
}
