import {supabaseServer} from "@/lib/supabase";

type Severity="info"|"warn"|"error"|"critical";
export async function logSystemEvent(input:{requestId?:string|null;severity:Severity;category:string;code:string;route?:string;metadata?:Record<string,unknown>}){
  const secret=process.env.RIFATRACK_INTERNAL_API_SECRET;
  if(!secret)return;
  try{
    await supabaseServer().rpc("log_system_event_internal",{
      p_internal_secret:secret,
      p_request_id:input.requestId||"",
      p_severity:input.severity,
      p_category:input.category,
      p_code:input.code,
      p_route:input.route||"",
      p_metadata:input.metadata||{},
    });
  }catch{}
}
export function requestId(req:Request){return req.headers.get("x-request-id")||crypto.randomUUID()}
