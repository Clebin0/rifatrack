const base=(process.env.SMOKE_URL||"https://rifatrack.vercel.app").replace(/\/$/,"");
const checks=[];
async function request(path,init){
  const res=await fetch(base+path,{redirect:"manual",...init});
  const text=await res.text();
  return {res,text};
}
function assert(ok,label){checks.push({label,ok});if(!ok)process.exitCode=1}

const health=await request("/api/health");
assert(health.res.status===200,"health returns 200");
assert(health.res.headers.get("x-content-type-options")==="nosniff","nosniff enabled");
assert(health.res.headers.get("x-frame-options")==="DENY","clickjacking denied");
assert((health.res.headers.get("strict-transport-security")||"").includes("max-age"),"HSTS enabled");
assert((health.res.headers.get("content-security-policy")||"").includes("nonce-"),"nonce CSP enabled");
assert(!health.res.headers.get("x-powered-by"),"framework header hidden");

const campaign=await request("/api/campaigns/dia-das-criancas");
assert([200,404].includes(campaign.res.status),"campaign endpoint responds safely");

const invalidOrder=await request("/api/orders",{method:"POST",headers:{"content-type":"text/plain"},body:"x"});
const closedMessage = "A campanha ainda está em preparação";
assert(invalidOrder.res.status===415 || (invalidOrder.res.status===503 && invalidOrder.text.includes(closedMessage)),"checkout rejects invalid request or explicitly reports closed sales");
if(invalidOrder.res.status===503)console.log("INFO  Sales are closed; this test does not certify payment processing.");

const readiness=await request("/api/admin/readiness");
assert(readiness.res.status===401,"readiness configuration requires admin authentication");

const invalidToken=await request("/api/orders/not-a-token");
assert(invalidToken.res.status===400,"order lookup rejects invalid token");

for(const c of checks)console.log((c.ok?"PASS":"FAIL")+"  "+c.label);
if(process.exitCode)throw new Error("Smoke test failed");
