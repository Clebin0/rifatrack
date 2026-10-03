import { supabaseBrowser } from "@/lib/supabase-browser";

export async function ensureMfa(area:"admin"|"vendedor", returnTo:string){
  const sb=supabaseBrowser();
  const {data:session}=await sb.auth.getSession();
  if(!session.session){
    location.href=area==="admin"?"/admin/login":"/vendedor/login";
    return false;
  }
  const {data,error}=await sb.auth.mfa.getAuthenticatorAssuranceLevel();
  if(error || data.currentLevel!=="aal2"){
    const target=area==="admin"?"/admin/seguranca":"/vendedor/seguranca";
    location.href=target+"?return="+encodeURIComponent(returnTo);
    return false;
  }
  return true;
}

export async function postLoginMfaRedirect(area:"admin"|"vendedor", returnTo:string){
  const sb=supabaseBrowser();
  const {data}=await sb.auth.mfa.getAuthenticatorAssuranceLevel();
  if(data?.currentLevel==="aal2"){
    location.href=returnTo;
    return;
  }
  const target=area==="admin"?"/admin/seguranca":"/vendedor/seguranca";
  location.href=target+"?return="+encodeURIComponent(returnTo);
}
