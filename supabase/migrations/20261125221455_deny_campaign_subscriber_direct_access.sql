create policy campaign_update_subscribers_deny_direct_access
  on public.campaign_update_subscribers
  as restrictive
  for all
  to anon, authenticated
  using (false)
  with check (false);
