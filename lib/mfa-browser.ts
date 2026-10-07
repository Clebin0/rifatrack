import { supabaseBrowser } from "@/lib/supabase-browser";

function withTimeout<T>(promise: Promise<T>, ms = 8000): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("auth_timeout")), ms);
    promise.then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      (e) => {
        clearTimeout(timer);
        reject(e);
      },
    );
  });
}
const loginPath = (area: "admin" | "vendedor") =>
  area === "admin" ? "/admin/login" : "/vendedor/login";
const securityPath = (area: "admin" | "vendedor") =>
  area === "admin" ? "/admin/seguranca" : "/vendedor/seguranca";

export async function ensureSession(area: "admin" | "vendedor", returnTo: string) {
  try {
    const { data, error } = await withTimeout(supabaseBrowser().auth.getSession());
    if (error || !data.session) {
      location.replace(loginPath(area) + "?return=" + encodeURIComponent(returnTo));
      return false;
    }
    return true;
  } catch {
    location.replace(loginPath(area) + "?return=" + encodeURIComponent(returnTo));
    return false;
  }
}
export async function getMfaLevel() {
  try {
    const { data, error } = await withTimeout(
      supabaseBrowser().auth.mfa.getAuthenticatorAssuranceLevel(),
    );
    if (error) return null;
    return data?.currentLevel || null;
  } catch {
    return null;
  }
}
export async function ensureMfa(area: "admin" | "vendedor", returnTo: string) {
  if (!(await ensureSession(area, returnTo))) return false;
  if ((await getMfaLevel()) === "aal2") return true;
  const target = securityPath(area);
  if (location.pathname !== target)
    location.replace(target + "?return=" + encodeURIComponent(returnTo));
  return false;
}
export async function postLoginMfaRedirect(area: "admin" | "vendedor", returnTo: string) {
  if (!(await ensureSession(area, returnTo))) return;
  if ((await getMfaLevel()) === "aal2") {
    location.replace(returnTo);
    return;
  }
  location.replace(securityPath(area) + "?return=" + encodeURIComponent(returnTo));
}
