import { describe, it, expect } from "vitest";
import { orderSchema, normalizePhone } from "../lib/validation";
import { validDate, webhookSchema } from "../lib/webhook-validation";
import { buildPixPayload } from "../lib/pix";
describe("Checkout", () => {
  const input = {
    campaignSlug: "teste",
    buyerName: "Teste",
    buyerPhone: "(41) 99999-9999",
    numbers: [1],
  };
  it("normaliza WhatsApp", () => expect(normalizePhone(input.buyerPhone)).toBe("+5541999999999"));
  it("aceita reserva válida", () => expect(orderSchema.safeParse(input).success).toBe(true));
  it("rejeita telefone inválido e números duplicados", () => {
    expect(orderSchema.safeParse({ ...input, buyerPhone: "00000000" }).success).toBe(false);
    expect(orderSchema.safeParse({ ...input, numbers: [1, 1] }).success).toBe(false);
  });
  it("rejeita honeypot", () =>
    expect(orderSchema.safeParse({ ...input, website: "spam" }).success).toBe(false));
});
describe("Webhook", () => {
  it("data inválida não lança exceção", () => expect(validDate("xxx")).toBeNull());
  it("converte data válida", () =>
    expect(validDate("2026-10-05")).toBe("2026-10-05T00:00:00.000Z"));
  const event = {
    id: "evt-123",
    event: "PAYMENT_RECEIVED",
    payment: { value: 5, externalReference: "00000000-0000-4000-8000-000000000001" },
  };
  it("exige referência do pedido", () => {
    expect(webhookSchema.safeParse(event).success).toBe(true);
    expect(webhookSchema.safeParse({ ...event, payment: { value: 5 } }).success).toBe(false);
  });
  it("rejeita valor negativo e evento desconhecido", () => {
    expect(webhookSchema.safeParse({ ...event, event: "OTHER" }).success).toBe(false);
    expect(
      webhookSchema.safeParse({ ...event, payment: { ...event.payment, value: -5 } }).success,
    ).toBe(false);
  });
});
describe("Pix CRC16", () => {
  it("confere CRC independente do gerador", () => {
    const payload = buildPixPayload({
      key: "teste@example.com",
      receiver: "AÇÃO SOCIAL",
      city: "CURITIBA",
      amountCents: 500,
      txid: "RT123",
    });
    let crc = 65535;
    for (const byte of new TextEncoder().encode(payload.slice(0, -4))) {
      crc ^= byte << 8;
      for (let bit = 0; bit < 8; bit++) crc = crc & 32768 ? (crc << 1) ^ 4129 : crc << 1;
      crc &= 65535;
    }
    expect(payload.slice(-4)).toBe(crc.toString(16).toUpperCase().padStart(4, "0"));
    expect(payload).toContain("54045.00");
  });
});
