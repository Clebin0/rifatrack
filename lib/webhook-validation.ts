import { z } from "zod";
const text = z.string().max(256).nullable().optional();
export const webhookSchema = z.object({
  id: z.string().min(3).max(256),
  event: z.enum([
    "PAYMENT_RECEIVED",
    "PAYMENT_CONFIRMED",
    "PAYMENT_REFUNDED",
    "PAYMENT_CHARGEBACK_REQUESTED",
    "PAYMENT_CHARGEBACK_DISPUTE",
  ]),
  dateCreated: text,
  payment: z.object({
    id: text,
    externalReference: z.string().uuid(),
    pixQrCodeId: text,
    status: text,
    billingType: text,
    value: z.number().finite().nonnegative().max(20000000),
    netValue: z.number().finite().nonnegative().max(20000000).nullable().optional(),
    paymentDate: text,
    confirmedDate: text,
    pixTransaction: z
      .union([z.string(), z.object({ id: z.string() })])
      .nullable()
      .optional(),
  }),
});
export function validDate(value: string | null | undefined) {
  if (!value) return null;
  const d = new Date(value);
  return Number.isFinite(d.getTime()) ? d.toISOString() : null;
}
export function cents(value: number | null | undefined) {
  return value == null ? null : Math.round(value * 100);
}

// A day-only or timezone-less value cannot prove a ten-minute payment deadline.
// Receipt time is conservative: events delivered during the grace period go to review.
export function paymentTimestamp(values: (string | null | undefined)[], receivedAt = new Date()) {
  for (const value of values) {
    if (
      value &&
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value)
    ) {
      const precise = validDate(value);
      if (precise) return precise;
    }
  }
  return receivedAt.toISOString();
}
