const base = process.env.SMOKE_URL?.replace(/\/$/, "");
const slug = process.env.SMOKE_SLUG;
if (!base || !slug) throw new Error("SMOKE_URL and SMOKE_SLUG are required");
const checks = [];
async function request(path, init) {
  const res = await fetch(base + path, {
    redirect: "manual",
    signal: AbortSignal.timeout(15000),
    ...init,
  });
  return { res, text: await res.text() };
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
    .find((v) => v.trim().startsWith("script-src"))
    ?.includes("unsafe-inline"),
  "scripts prohibit unsafe-inline",
);
const second = await request("/campanha/" + encodeURIComponent(slug));
assert(second.res.headers.get("content-security-policy") !== csp, "nonce rotates per request");
const campaign = await request("/api/campaigns/" + encodeURIComponent(slug));
assert(campaign.res.status === 200, "campaign API succeeds");
const invalid = await request("/api/orders", {
  method: "POST",
  headers: { "content-type": "text/plain" },
  body: "x",
});
assert(
  [415, 503].includes(invalid.res.status),
  "checkout rejects invalid input or enforces preparation gate",
);
for (const check of checks) console.log((check.ok ? "PASS" : "FAIL") + " " + check.label);
if (process.exitCode) throw new Error("Smoke test failed");
