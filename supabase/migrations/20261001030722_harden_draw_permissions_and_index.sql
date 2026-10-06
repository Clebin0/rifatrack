-- Recovered verbatim from Supabase migration history; 20261001030722.

revoke execute on function public.admin_draw_campaign(uuid) from anon;
create index if not exists draws_order_idx on public.draws(order_id);
drop policy if exists deny_anon_draws on public.draws;
create policy deny_anon_draws on public.draws for all to anon using (false) with check (false);
drop policy if exists deny_authenticated_draws on public.draws;
create policy deny_authenticated_draws on public.draws for all to authenticated using (false) with check (false);


