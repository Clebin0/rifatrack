import { readFileSync } from "node:fs";
import { stripTypeScriptTypes } from "node:module";
import assert from "node:assert/strict";
import { test } from "node:test";
const code = stripTypeScriptTypes(readFileSync(new URL("../lib/password-recovery.ts", import.meta.url), "utf8"));
const { checkPasswordSession, authErrorMessage } = await import("data:text/javascript;base64," + Buffer.from(code).toString("base64"));
function fake(session, currentLevel, nextLevel, failure = null) {
  return { getSession: async () => ({ data: { session }, error: null }),
    mfa: { getAuthenticatorAssuranceLevel: async () => ({ data: { currentLevel, nextLevel }, error: failure }) } };
}
test("recovery session with MFA must challenge before password update", async () => {
  assert.equal(await checkPasswordSession(fake({}, "aal1", "aal2")), "mfa");
});
test("verified MFA returns to password form", async () => {
  assert.equal(await checkPasswordSession(fake({}, "aal2", "aal2")), "ready");
});
test("account without enrolled MFA can recover", async () => {
  assert.equal(await checkPasswordSession(fake({}, "aal1", "aal1")), "ready");
});
test("expired session cannot access password form", async () => {
  assert.equal(await checkPasswordSession(fake(null)), "missing");
});
test("network error does not masquerade as expired link", async () => {
  await assert.rejects(checkPasswordSession(fake({}, null, null, new Error("offline"))), /offline/);
});
test("unavailable assurance fails closed", async () => {
  await assert.rejects(checkPasswordSession(fake({}, null, null)), /assurance_unavailable/);
});
test("MFA and email limits give distinct actionable messages", () => {
  assert.match(authErrorMessage({ code: "insufficient_aal" }), /autenticador/);
  assert.match(authErrorMessage({ status: 429 }), /limite/);
  assert.match(authErrorMessage({ code: "same_password" }), /diferente/);
});
