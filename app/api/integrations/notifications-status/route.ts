import { NextResponse } from "next/server";
import { authenticatedAdminRole } from "@/lib/admin-auth-server";
import { notificationsConfigured } from "@/lib/notifications";

export async function GET(req: Request) {
  const admin = await authenticatedAdminRole(req);
  if (!admin)
    return NextResponse.json({ error: "Autenticação administrativa necessária." }, { status: 401 });
  if (!["owner", "admin", "financeiro", "operador", "auditor"].includes(admin.role))
    return NextResponse.json({ error: "Sem permissão." }, { status: 403 });
  return NextResponse.json(
    { provider: "resend", configured: notificationsConfigured() },
    { headers: { "Cache-Control": "no-store" } },
  );
}
