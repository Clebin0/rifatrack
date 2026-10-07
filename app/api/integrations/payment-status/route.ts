import { NextResponse } from "next/server";
import { authenticatedAdminRole } from "@/lib/admin-auth-server";

export async function GET(req: Request) {
  const admin = await authenticatedAdminRole(req);
  if (!admin)
    return NextResponse.json({ error: "Autenticação administrativa necessária." }, { status: 401 });
  if (!["owner", "admin", "financeiro", "operador", "auditor"].includes(admin.role))
    return NextResponse.json({ error: "Sem permissão." }, { status: 403 });
  const provider = process.env.PAYMENT_PROVIDER || "manual";
  const configured =
    provider === "asaas"
      ? Boolean(
          process.env.ASAAS_API_KEY &&
          process.env.ASAAS_PIX_ADDRESS_KEY &&
          process.env.ASAAS_WEBHOOK_TOKEN,
        )
      : true;
  return NextResponse.json(
    {
      provider,
      environment: process.env.ASAAS_ENV || "sandbox",
      configured,
      automatic: provider === "asaas" && configured,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
