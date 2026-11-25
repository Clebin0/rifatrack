import { supabaseInternal } from "@/lib/supabase";
import { publicRateLimit } from "@/lib/rate-limit";

const tokenPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const pageHeaders = {
  "Content-Type": "text/html; charset=utf-8",
  "Cache-Control": "no-store",
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
  "X-Robots-Tag": "noindex, nofollow",
  "Content-Security-Policy":
    "default-src 'none'; form-action 'self'; style-src 'unsafe-inline'; base-uri 'none'; frame-ancestors 'none'",
};

function page(title: string, description: string, token = "", status = 200) {
  const form = token
    ? `<form method="post" action="/api/campaign-updates/unsubscribe"><input type="hidden" name="token" value="${token}"><button type="submit">Cancelar avisos</button></form>`
    : "";
  return new Response(
    `<!doctype html><html lang="pt-BR"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title} · RifaTrack</title><body style="margin:0;background:#080b09;color:#f4f7f5;font:16px system-ui,sans-serif"><main style="max-width:36rem;margin:12vh auto;padding:2rem"><p style="color:#86efac;font-weight:700">RifaTrack</p><h1>${title}</h1><p>${description}</p>${form}<a href="/" style="color:#86efac">Voltar ao site</a></main></body></html>`,
    { status, headers: pageHeaders },
  );
}

export async function GET(req: Request) {
  const token = new URL(req.url).searchParams.get("token") || "";
  if (!tokenPattern.test(token))
    return page("Link inválido", "Este link de cancelamento não é válido.");
  return page(
    "Cancelar avisos de Natal",
    "Confirme abaixo se não deseja mais receber o aviso da campanha.",
    token,
  );
}

export async function POST(req: Request) {
  const limited = await publicRateLimit(req, "christmas-campaign-unsubscribe", 20, 3600);
  if (limited) return limited;

  let token = new URL(req.url).searchParams.get("token") || "";
  try {
    const form = await req.formData();
    token ||= String(form.get("token") || "");
  } catch {
    // RFC 8058 one-click unsubscribe sends its token in the URL.
  }
  if (!tokenPattern.test(token))
    return page("Link inválido", "Este link de cancelamento não é válido.");

  const { error } = await supabaseInternal()
    .from("campaign_update_subscribers")
    .update({ unsubscribed_at: new Date().toISOString() })
    .eq("unsubscribe_token", token)
    .is("unsubscribed_at", null);
  if (error)
    return page("Não foi possível concluir", "Tente novamente em alguns minutos.", "", 503);
  return page("Inscrição cancelada", "Este e-mail não receberá mais avisos da campanha de Natal.");
}
