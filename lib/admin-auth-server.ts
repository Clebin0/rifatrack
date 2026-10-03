import {createClient} from "@supabase/supabase-js";

export async function authenticatedAdminRole(req:Request){
  const auth=req.headers.get("authorization")||"";
  if(!auth.startsWith("Bearer "))return null;
  const token=auth.slice(7);
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if(!url||!key)return null;
  const client=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false},global:{headers:{Authorization:"Bearer "+token}}});
  const {data:user,error}=await client.auth.getUser(token);
  if(error||!user.user)return null;
  const {data:role,error:roleError}=await client.rpc("current_admin_role");
  if(roleError||!role)return null;
  return {role:String(role),email:user.user.email||"",client};
}
