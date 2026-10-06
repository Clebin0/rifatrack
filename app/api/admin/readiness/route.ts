import { NextResponse } from "next/server";
import { authenticatedAdminRole } from "@/lib/admin-auth-server";
import { notificationsConfigured } from "@/lib/notifications";

export async function GET(req: Request) {
  const headers = { "Cache-Control": "no-store" };
  try {
    const admin = await authenticatedAdminRole(req);
    if (!admin) return NextResponse.json({ error: "Entre com uma conta administrativa." }, { status: 401, headers });
    if (!["owner", "admin", "auditor"].includes(admin.role)) return NextResponse.json({ error: "Sem permissão." }, { status: 403, headers });
    const env = process.env;
    return NextResponse.json({
      checkedAt: new Date().toISOString(),
      salesApproved: env.FINANCIAL_PRODUCTION_APPROVED === "true",
      paymentProvider: env.PAYMENT_PROVIDER || "manual",
      productionPixConfigured: env.PAYMENT_PROVIDER === "asaas" && env.ASAAS_ENV === "production" && Boolean(env.ASAAS_API_KEY && env.ASAAS_PIX_ADDRESS_KEY && (env.ASAAS_WEBHOOK_TOKEN?.length || 0) >= 32),
      notificationsConfigured: notificationsConfigured(),
      internalSecretConfigured: Boolean(env.RIFATRACK_INTERNAL_API_SECRET),
    }, { headers });
  } catch {
    return NextResponse.json({ error: "Não foi possível consultar a configuração. Tente novamente." }, { status: 503, headers });
  }
}
