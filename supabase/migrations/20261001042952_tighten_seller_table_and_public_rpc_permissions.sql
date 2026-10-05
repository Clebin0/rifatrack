-- Recovered verbatim from Supabase migration history; 20261001042952.

drop policy if exists deny_all_seller_accounts_anon on public.seller_accounts;
create policy deny_all_seller_accounts_anon on public.seller_accounts for all to anon using(false) with check(false);
drop policy if exists deny_all_seller_accounts_auth on public.seller_accounts;
create policy deny_all_seller_accounts_auth on public.seller_accounts for all to authenticated using(false) with check(false);

drop policy if exists deny_all_seller_invites_anon on public.seller_invites;
create policy deny_all_seller_invites_anon on public.seller_invites for all to anon using(false) with check(false);
drop policy if exists deny_all_seller_invites_auth on public.seller_invites;
create policy deny_all_seller_invites_auth on public.seller_invites for all to authenticated using(false) with check(false);

revoke execute on function public.is_seller() from anon;
revoke execute on function public.public_active_campaigns() from authenticated;
revoke execute on function public.public_campaign(text,text) from authenticated;
revoke execute on function public.public_draw_result(text) from authenticated;
revoke execute on function public.public_order(uuid) from authenticated;


