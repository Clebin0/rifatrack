import { supabaseInternal } from "@/lib/supabase";

type NotificationItem = {
  id: string;
  claim_token: string;
  recipient: string;
  template: "order_reserved" | "payment_received" | "reservation_expired" | "seller_sale";
  payload: Record<string, unknown>;
};

const esc = (v: unknown) =>
  String(v ?? "").replace(
    /[&<>"']/g,
    (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]!,
  );
const money = (c: number) => "R$ " + (Number(c || 0) / 100).toFixed(2).replace(".", ",");

function render(item: NotificationItem) {
  const p = item.payload || {};
  const base = (process.env.NEXT_PUBLIC_APP_URL || "https://rifatrack.vercel.app").replace(
    /\/$/,
    "",
  );
  const orderUrl = p.public_token
    ? base + "/pedido/" + encodeURIComponent(String(p.public_token))
    : base;
  const numbers = Array.isArray(p.numbers)
    ? p.numbers.map((n: unknown) => String(n).padStart(3, "0")).join(", ")
    : "";
  if (item.template === "order_reserved")
    return {
      subject: `Reserva criada · ${p.campaign_name || "RifaTrack"}`,
      html: `<h2>Reserva criada</h2><p>Olá, ${esc(p.buyer_name)}.</p><p>Seu pedido <b>${esc(p.payment_reference)}</b> foi reservado.</p><p>Números: <b>${esc(numbers)}</b><br>Valor: <b>${esc(money(Number(p.amount_cents)))}</b>${p.seller_name ? `<br>Vendedor: <b>${esc(p.seller_name)}</b>` : ""}</p><p><a href="${esc(orderUrl)}">Acompanhar e pagar pedido</a></p><p>A reserva expira no horário exibido na página do pedido.</p>`,
    };
  if (item.template === "payment_received")
    return {
      subject: `Pagamento confirmado · ${p.campaign_name || "RifaTrack"}`,
      html: `<h2>Pagamento confirmado</h2><p>Olá, ${esc(p.buyer_name)}.</p><p>O pagamento do pedido <b>${esc(p.payment_reference)}</b> foi confirmado.</p><p>Números: <b>${esc(numbers)}</b><br>Valor: <b>${esc(money(Number(p.amount_cents)))}</b>${p.seller_name ? `<br>Vendedor: <b>${esc(p.seller_name)}</b>` : ""}</p>${p.provider_payment_id ? `<p>ID da transação: <code>${esc(p.provider_payment_id)}</code></p>` : ""}<p><a href="${esc(orderUrl)}">Abrir recibo digital</a></p>`,
    };
  if (item.template === "reservation_expired")
    return {
      subject: `Reserva expirada · ${p.campaign_name || "RifaTrack"}`,
      html: `<h2>Reserva expirada</h2><p>Olá, ${esc(p.buyer_name)}.</p><p>O pedido <b>${esc(p.payment_reference)}</b> expirou sem confirmação de pagamento. Os números foram liberados novamente.</p><p><a href="${esc(base + "/campanha/" + p.campaign_slug)}">Voltar à campanha</a></p>`,
    };
  return {
    subject: `Venda confirmada · ${p.campaign_name || "RifaTrack"}`,
    html: `<h2>Nova venda confirmada</h2><p>Olá, ${esc(p.seller_name)}.</p><p>O pedido <b>${esc(p.payment_reference)}</b> foi confirmado.</p><p>Comprador: <b>${esc(p.buyer_name)}</b><br>Números: <b>${esc(numbers)}</b><br>Valor: <b>${esc(money(Number(p.amount_cents)))}</b></p><p><a href="${esc(base + "/vendedor")}">Abrir portal do vendedor</a></p>`,
  };
}

export function notificationsConfigured() {
  return Boolean(process.env.RESEND_API_KEY && process.env.NOTIFICATION_FROM_EMAIL);
}

async function sendOne(item: NotificationItem) {
  const apiKey = process.env.RESEND_API_KEY,
    from = process.env.NOTIFICATION_FROM_EMAIL;
  if (!apiKey || !from) throw new Error("notification_provider_not_configured");
  const content = render(item);
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      authorization: "Bearer " + apiKey,
      "content-type": "application/json",
      "Idempotency-Key": "notification-" + item.id,
    },
    body: JSON.stringify({
      from,
      to: [item.recipient],
      subject: content.subject,
      html: content.html,
    }),
    signal: AbortSignal.timeout(8000),
    cache: "no-store",
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error("resend_" + res.status + ":" + body.slice(0, 250));
  }
}

export async function processNotificationBatch(limit = 10) {
  if (!notificationsConfigured()) return { configured: false, processed: 0, sent: 0, failed: 0 };
  const sb = supabaseInternal();
  const { data, error } = await sb.rpc("claim_notification_batch_internal", {
    p_limit: Math.min(limit, 5),
  });
  if (error) throw error;
  const items = (data || []) as NotificationItem[];
  let sent = 0,
    failed = 0;
  for (const item of items) {
    try {
      await sendOne(item);
      const result = await sb.rpc("finish_notification_internal", {
        p_id: item.id,
        p_claim_token: item.claim_token,
        p_ok: true,
      });
      if (result.error || !result.data) throw result.error ?? new Error("lease_lost");
      sent++;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "unknown";
      await sb.rpc("finish_notification_internal", {
        p_id: item.id,
        p_claim_token: item.claim_token,
        p_ok: false,
        p_error: msg,
      });
      failed++;
    }
  }
  return { configured: true, processed: items.length, sent, failed };
}
