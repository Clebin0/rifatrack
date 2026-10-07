import { createHash, timingSafeEqual } from "node:crypto";
import { after, NextResponse } from "next/server";
import { supabaseInternal } from "@/lib/supabase";
import { webhookSchema, validDate, paymentTimestamp, cents } from "@/lib/webhook-validation";
import { logSystemEvent, requestId } from "@/lib/observability";
export async function POST(req: Request) {
  const rid = requestId(req),
    headers = { "Cache-Control": "no-store", "x-request-id": rid };
  const expected = process.env.ASAAS_WEBHOOK_TOKEN;
  if (!expected || expected.length < 32)
    return NextResponse.json({ error: "Webhook não configurado" }, { status: 503, headers });
  const received = req.headers.get("asaas-access-token") || "";
  if (
    !received ||
    !timingSafeEqual(
      createHash("sha256").update(expected).digest(),
      createHash("sha256").update(received).digest(),
    )
  )
    return NextResponse.json({ error: "Não autorizado" }, { status: 401, headers });
  try {
    const raw = await req.text();
    if (new TextEncoder().encode(raw).length > 262144)
      return NextResponse.json({ error: "Payload muito grande" }, { status: 413, headers });
    let json: unknown;
    try {
      json = JSON.parse(raw);
    } catch {
      return NextResponse.json({ error: "JSON inválido" }, { status: 400, headers });
    }
    const parsed = webhookSchema.safeParse(json);
    if (!parsed.success)
      return NextResponse.json({ error: "Evento inválido" }, { status: 400, headers });
    const body = parsed.data,
      payment = body.payment;
    const dates = [payment.paymentDate, payment.confirmedDate, body.dateCreated];
    if (dates.some((value) => value && !validDate(value)))
      return NextResponse.json({ error: "Data inválida" }, { status: 400, headers });
    const paidAt = paymentTimestamp(dates);
    const pixId =
      typeof payment.pixTransaction === "string"
        ? payment.pixTransaction
        : (payment.pixTransaction?.id ?? null);
    const { data, error } = await supabaseInternal().rpc("process_asaas_event", {
      p_event_id: body.id,
      p_event_type: body.event,
      p_payment_id: payment.id ?? null,
      p_qr_id: payment.pixQrCodeId ?? null,
      p_payment_status: payment.status ?? null,
      p_value_cents: cents(payment.value)!,
      p_net_value_cents: cents(payment.netValue),
      p_paid_at: paidAt,
      p_pix_transaction_id: pixId,
      p_external_reference: payment.externalReference,
      p_payload: JSON.parse(
        JSON.stringify({
          id: body.id,
          event: body.event,
          payment: {
            id: payment.id,
            status: payment.status,
            value: payment.value,
            netValue: payment.netValue,
            externalReference: payment.externalReference,
            pixQrCodeId: payment.pixQrCodeId,
            paymentDate: payment.paymentDate,
          },
        }),
      ),
    });
    if (error) throw error;
    after(() =>
      logSystemEvent({
        requestId: rid,
        severity: "info",
        category: "payments",
        code: "WEBHOOK_PROCESSED",
        metadata: { event_id: body.id, event_type: body.event },
      }),
    );
    return NextResponse.json({ ok: true, result: data }, { headers });
  } catch {
    after(() =>
      logSystemEvent({
        requestId: rid,
        severity: "error",
        category: "payments",
        code: "WEBHOOK_PROCESSING_FAILED",
      }),
    );
    return NextResponse.json({ error: "Falha ao registrar evento" }, { status: 500, headers });
  }
}
