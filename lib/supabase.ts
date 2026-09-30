import {createClient} from "@supabase/supabase-js";
export function supabaseServer(){const u=process.env.NEXT_PUBLIC_SUPABASE_URL,k=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;if(!u||!k)throw new Error("Supabase não configurado");return createClient(u,k,{auth:{persistSession:false,autoRefreshToken:false}})}
