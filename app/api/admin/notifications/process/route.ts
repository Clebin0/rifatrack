import { NextResponse } from "next/server";
import { authenticatedAdminRole } from "@/lib/admin-auth-server";
import { processNotificationBatch } from "@/lib/notifications";

export async function POST(req: Request) {
  const admin = await authenticatedAdminRole(req);
  if (!admin) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  if (!["owner", "admin", "financeiro", "operador"].includes(admin.role))
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
  const { data: aal2, error: mfaError } = await admin.client.rpc("is_admin_aal2");
  if (mfaError || !aal2)
    return NextResponse.json(
      { error: "Confirme o segundo fator antes de enviar e-mails." },
      { status: 403 },
    );
  try {
    return NextResponse.json(await processNotificationBatch(5), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch {
    return NextResponse.json({ error: "Falha ao processar notificações" }, { status: 500 });
  }
}
