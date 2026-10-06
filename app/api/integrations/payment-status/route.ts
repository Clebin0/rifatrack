import { NextResponse } from "next/server";

export function GET() {
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
