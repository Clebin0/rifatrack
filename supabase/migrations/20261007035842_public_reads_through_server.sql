-- Public HTTP reads are rate-limited by the app. Do not expose an unmetered
-- PostgREST route to the same data using the publishable browser key.
revoke all on function public_active_campaigns() from public,anon,authenticated;
revoke all on function public_campaign(text,text) from public,anon,authenticated;
revoke all on function public_order(uuid) from public,anon,authenticated;
revoke all on function public_draw_result(text) from public,anon,authenticated;
revoke all on function public_draw_verification(text) from public,anon,authenticated;
grant execute on function public_active_campaigns() to service_role;
grant execute on function public_campaign(text,text) to service_role;
grant execute on function public_order(uuid) to service_role;
grant execute on function public_draw_result(text) to service_role;
grant execute on function public_draw_verification(text) to service_role;
