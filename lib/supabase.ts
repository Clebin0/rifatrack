import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";
function client(key: string | undefined) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url || !key) throw new Error("Supabase não configurado");
  return createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input, init) =>
        fetch(input, { ...init, signal: init?.signal ?? AbortSignal.timeout(10000) }),
    },
  });
}
export function supabaseServer() {
  return client(process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);
}
export function supabaseInternal() {
  return client(process.env.SUPABASE_SECRET_KEY);
}
