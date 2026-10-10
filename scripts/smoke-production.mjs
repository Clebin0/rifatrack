const base = process.env.SMOKE_URL?.replace(/\/$/, "");
let slug = process.env.SMOKE_SLUG?.trim() || "";
if (!base) throw new Error("SMOKE_URL is required");

const checks = [];

async function request(path, init) {
  const res = await fetch(base + path, {
    redirect: "manual",
    signal: AbortSignal.timeout(15000),
    ...init,
  });
  return { res, text: await res.text() };
}

function servedFromVercelCache(response) {
  const cacheStatus = (response.headers.get("x-vercel-cache") || "").toUpperCase();
  const age = Number(response.headers.get("age") || "0");
  return ["HIT", "STALE", "REVALIDATED"].includes(cacheStatus) || age > 0;
}

function assert(ok, label) {
  checks.push({ label, ok });
  if (!ok) process.exitCode = 1;
}

const health = await request("/api/health");
assert(health.res.status === 200, "database health returns 200");
assert(health.res.headers.get("x-content-type-options") === "nosniff", "nosniff enabled");
assert(health.res.headers.get("x-frame-options") === "DENY", "clickjacking denied");
assert(!health.res.headers.get("x-powered-by"), "framework header hidden");

const campaigns = await request("/api/campaigns");
assert(campaigns.res.status === 200, "campaign list API succeeds");
assert(
  (campaigns.res.headers.get("cache-control") || "").includes("public"),
  "campaign list is marked public-cacheable",
);
const campaignsCacheProbe = await request("/api/campaigns");
assert(
  servedFromVercelCache(campaignsCacheProbe.res),
  "campaign list is served from Vercel CDN cache",
);
if (!slug && campaigns.res.ok) {
  try {
    const rows = JSON.parse(campaigns.text);
    const discovered = Array.isArray(rows)
      ? rows.find((item) => typeof item?.slug === "string")
      : null;
    if (discovered?.slug) slug = discovered.slug;
  } catch {
    assert(false, "campaign list returns valid JSON");
  }
}

if (slug) {
  console.log("INFO  smoke campaign:", slug);
  const page = await request("/campanha/" + encodeURIComponent(slug));
  const csp = page.res.headers.get("content-security-policy") || "";
  const nonce = csp.match(/'nonce-([^']+)'/)?.[1];
  assert(page.res.status === 200, "campaign HTML loads");
  assert(
    Boolean(nonce) && page.text.includes('nonce="' + nonce + '"'),
    "HTML scripts match CSP nonce",
  );
  assert(
    !csp
      .split(";")
      .find((value) => value.trim().startsWith("script-src"))
      ?.includes("unsafe-inline"),
    "scripts prohibit unsafe-inline",
  );
  const second = await request("/campanha/" + encodeURIComponent(slug));
  assert(second.res.headers.get("content-security-policy") !== csp, "nonce rotates per request");
  const campaign = await request("/api/campaigns/" + encodeURIComponent(slug));
  assert(campaign.res.status === 200, "campaign API succeeds");
  assert(
    (campaign.res.headers.get("cache-control") || "").includes("public"),
    "campaign API is marked public-cacheable",
  );
  const campaignCacheProbe = await request("/api/campaigns/" + encodeURIComponent(slug));
  assert(
    servedFromVercelCache(campaignCacheProbe.res),
    "campaign API is served from Vercel CDN cache",
  );
  if (campaign.res.ok) {
    let publicCampaign;
    try {
      publicCampaign = JSON.parse(campaign.text);
    } catch {
      assert(false, "campaign API returns valid JSON");
    }
    if (publicCampaign && typeof publicCampaign === "object") {
      assert(
        !Object.prototype.hasOwnProperty.call(publicCampaign, "seller_whatsapp"),
        "campaign API omits top-level seller contact",
      );
      assert(
        !Object.prototype.hasOwnProperty.call(publicCampaign, "finalized_by"),
        "campaign API omits operator identity",
      );
      assert(
        !Array.isArray(publicCampaign.sellers) ||
          publicCampaign.sellers.every(
            (seller) => !Object.prototype.hasOwnProperty.call(seller, "whatsapp"),
          ),
        "campaign API omits seller directory contact details",
      );
    }
  }
} else {
  console.log("INFO  no active campaign discovered; campaign-specific checks skipped");
}

const invalid = await request("/api/orders", {
  method: "POST",
  headers: { "content-type": "text/plain" },
  body: "x",
});
assert(
  [415, 503].includes(invalid.res.status),
  "checkout rejects invalid input or enforces preparation gate",
);
if (invalid.res.status === 503)
  assert(
    invalid.text.includes("preparação") || invalid.text.includes("indisponível"),
    "closed checkout explains preparation state",
  );

const invalidOrder = await request("/api/orders/not-a-token");
assert(invalidOrder.res.status === 400, "invalid public order token is rejected");

for (const endpoint of [
  "/api/admin/readiness",
  "/api/integrations/payment-status",
  "/api/integrations/notifications-status",
]) {
  const response = await request(endpoint);
  assert(response.res.status === 401, endpoint + " requires admin authentication");
}

for (const check of checks) console.log((check.ok ? "PASS" : "FAIL") + " " + check.label);
if (process.exitCode) throw new Error("Smoke test failed");
