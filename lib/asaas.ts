type AsaasQrResponse = {
  id: string;
  payload?: string;
  encodedImage?: string;
  expirationDate?: string;
};

export function asaasBaseUrl() {
  return process.env.ASAAS_ENV === "production"
    ? "https://api.asaas.com/v3"
    : "https://api-sandbox.asaas.com/v3";
}

function headers() {
  const key = process.env.ASAAS_API_KEY;
  if (!key) throw new Error("ASAAS_API_KEY não configurada");
  return {
    "content-type": "application/json",
    "user-agent": "RifaTrack/1.0",
    access_token: key,
  };
}

export function asaasAutomaticEnabled() {
  return process.env.PAYMENT_PROVIDER === "asaas";
}

export async function createAsaasPixQr(input: {
  orderId: string;
  reference: string;
  amountCents: number;
  description: string;
}) {
  if (
    process.env.ASAAS_ENV === "production" &&
    process.env.FINANCIAL_PRODUCTION_APPROVED !== "true"
  )
    throw new Error("financial_production_not_approved");
  const addressKey = process.env.ASAAS_PIX_ADDRESS_KEY;
  if (!addressKey) throw new Error("ASAAS_PIX_ADDRESS_KEY não configurada");
  const res = await fetch(asaasBaseUrl() + "/pix/qrCodes/static", {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({
      addressKey,
      description: input.description.slice(0, 120),
      value: input.amountCents / 100,
      format: "ALL",
      expirationSeconds: 600,
      allowsMultiplePayments: false,
      externalReference: input.orderId,
    }),
    signal: AbortSignal.timeout(10000),
    cache: "no-store",
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data?.id || !data?.payload) {
    throw new Error("Falha ao criar QR Pix no Asaas");
  }
  return data as AsaasQrResponse;
}

export async function cancelAsaasQr(qrId: string) {
  if (!qrId) return;
  // QR estático com expiração curta não exige cancelamento para bloquear pagamento.
  // Mantido como ponto de extensão para eventual endpoint de remoção no provedor.
}
