import { createHash } from "crypto";
import { after, NextResponse } from "next/server";
import { supabaseInternal } from "@/lib/supabase";
import { orderSchema } from "@/lib/validation";
import { asaasAutomaticEnabled, createAsaasPixQr } from "@/lib/asaas";
import { publicRateLimit, requestIp } from "@/lib/rate-limit";
import { logSystemEvent, requestId } from "@/lib/observability";

export async function POST(req: Request) {
  if (Boolean(process.env.VERCEL_ENV) && process.env.FINANCIAL_PRODUCTION_APPROVED !== "true")
    return NextResponse.json(
      {
        error:
          "A campanha ainda está em preparação. As compras serão liberadas após a organização concluir as pendências.",
      },
      { status: 503 },
    );
  const rid = requestId(req);
  const headers = { "Cache-Control": "no-store", Pragma: "no-cache", "x-request-id": rid };
  const limited = await publicRateLimit(req, "checkout", 20, 3600);
  if (limited) return limited;
  try {
    if (!(req.headers.get("content-type") || "").toLowerCase().startsWith("application/json")) {
      await logSystemEvent({
        requestId: rid,
        severity: "warn",
        category: "checkout",
        code: "INVALID_CONTENT_TYPE",
        route: "/api/orders",
      });
      return NextResponse.json({ error: "Formato inválido." }, { status: 415, headers });
    }
    const contentLength = Number(req.headers.get("content-length") || "0");
    if (contentLength > 16384) {
      await logSystemEvent({
        requestId: rid,
        severity: "warn",
        category: "checkout",
        code: "PAYLOAD_TOO_LARGE",
        route: "/api/orders",
      });
      return NextResponse.json({ error: "Requisição muito grande." }, { status: 413, headers });
    }
    let input: unknown;
    try {
      const raw = await req.text();
      if (new TextEncoder().encode(raw).length > 16384)
        return NextResponse.json({ error: "Requisição muito grande." }, { status: 413, headers });
      input = JSON.parse(raw);
    } catch {
      return NextResponse.json({ error: "JSON inválido." }, { status: 400, headers });
    }
    const parsed = orderSchema.safeParse(input);
    if (!parsed.success) {
      await logSystemEvent({
        requestId: rid,
        severity: "warn",
        category: "checkout",
        code: "VALIDATION_FAILED",
        route: "/api/orders",
      });
      return NextResponse.json({ error: "Confira os dados informados." }, { status: 400, headers });
    }

    const fingerprint = createHash("sha256").update(requestIp(req)).digest("hex");

    const { data, error } = await supabaseInternal().rpc("reserve_raffle_numbers", {
      p_fingerprint: fingerprint,
      p_campaign_slug: parsed.data.campaignSlug,
      p_seller_code: parsed.data.sellerCode || null,
      p_buyer_name: parsed.data.buyerName,
      p_buyer_phone: parsed.data.buyerPhone,
      p_buyer_email: parsed.data.buyerEmail || "",
      p_numbers: parsed.data.numbers,
    });

    if (error) {
      await logSystemEvent({
        requestId: rid,
        severity: "warn",
        category: "checkout",
        code: "RESERVATION_REJECTED",
        route: "/api/orders",
        metadata: { campaign: parsed.data.campaignSlug },
      });
      return NextResponse.json(
        {
          error: /rate limit|too many orders/i.test(error.message)
            ? "Muitas tentativas. Aguarde antes de reservar novamente."
            : "Não foi possível reservar. Confira a disponibilidade e tente novamente.",
        },
        {
          status: /rate limit|too many orders/i.test(error.message)
            ? 429
            : /number unavailable|campaign unavailable|seller unavailable|seller required/.test(
                  error.message,
                )
              ? 409
              : 500,
          headers,
        },
      );
    }

    const order = data as {
      id: string;
      public_token: string;
      amount_cents: number;
      payment_reference: string;
    };
    if (asaasAutomaticEnabled()) {
      try {
        const qr = await createAsaasPixQr({
          orderId: order.id,
          reference: order.payment_reference,
          amountCents: order.amount_cents,
          description: `RifaTrack ${order.payment_reference}`,
        });
        const { error: attachError } = await supabaseInternal().rpc("attach_asaas_qr", {
          p_order_id: order.id,
          p_qr_id: qr.id,
          p_payload: qr.payload || "",
        });
        if (attachError) throw attachError;
      } catch {
        await supabaseInternal().rpc("cancel_order_internal", {
          p_order_id: order.id,
          p_reason: "asaas_qr_creation_failed",
        });
        await logSystemEvent({
          requestId: rid,
          severity: "error",
          category: "payments",
          code: "ASAAS_QR_CREATION_FAILED",
          route: "/api/orders",
          metadata: { order_id: order.id },
        });
        return NextResponse.json(
          { error: "Não foi possível gerar a cobrança Pix agora. Tente novamente em instantes." },
          { status: 502, headers },
        );
      }
    }

    const { error: queueError } = await supabaseInternal().rpc(
      "enqueue_order_notification_internal",
      { p_order_id: order.id, p_event: "reserved" },
    );
    if (queueError)
      after(() =>
        logSystemEvent({
          requestId: rid,
          severity: "error",
          category: "notifications",
          code: "ENQUEUE_FAILED",
          metadata: { order_id: order.id },
        }),
      );
    after(() =>
      logSystemEvent({
        requestId: rid,
        severity: "info",
        category: "checkout",
        code: "ORDER_RESERVED",
        route: "/api/orders",
        metadata: { order_id: order.id, provider: asaasAutomaticEnabled() ? "asaas" : "manual" },
      }),
    );
    return NextResponse.json({ order }, { status: 201, headers });
  } catch {
    await logSystemEvent({
      requestId: rid,
      severity: "error",
      category: "checkout",
      code: "UNHANDLED_ORDER_ERROR",
      route: "/api/orders",
    });
    return NextResponse.json(
      { error: "Falha interna ao criar o pedido." },
      { status: 500, headers },
    );
  }
}
