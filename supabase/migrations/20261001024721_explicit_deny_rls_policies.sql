-- Recovered verbatim from Supabase migration history; 20261001024721.

create policy deny_public on campaigns for all to anon,authenticated using(false) with check(false);
create policy deny_public on sellers for all to anon,authenticated using(false) with check(false);
create policy deny_public on orders for all to anon,authenticated using(false) with check(false);
create policy deny_public on raffle_numbers for all to anon,authenticated using(false) with check(false);
create policy deny_public on campaign_sellers for all to anon,authenticated using(false) with check(false);
create policy deny_public on admin_users for all to anon,authenticated using(false) with check(false);
create policy deny_public on app_settings for all to anon,authenticated using(false) with check(false);
create policy deny_public on api_rate_limits for all to anon,authenticated using(false) with check(false);
create policy deny_public on audit_logs for all to anon,authenticated using(false) with check(false);


