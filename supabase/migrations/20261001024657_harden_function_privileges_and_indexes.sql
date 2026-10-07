-- Recovered verbatim from Supabase migration history; 20261001024657.

revoke execute on function release_expired_reservations(uuid) from public,anon,authenticated;
revoke execute on function internal_secret_ok(text) from public,anon,authenticated;
revoke execute on function is_admin() from public,anon,authenticated;
revoke execute on function public_active_campaigns() from public,anon,authenticated;
revoke execute on function public_campaign(text,text) from public,anon,authenticated;
revoke execute on function public_order(uuid) from public,anon,authenticated;
revoke execute on function reserve_raffle_numbers(text,text,text,text,text,text,int[]) from public,anon,authenticated;
revoke execute on function claim_first_admin(text) from public,anon,authenticated;
revoke execute on function admin_dashboard() from public,anon,authenticated;
revoke execute on function admin_create_campaign(text,text,text,int,int,text,text,timestamptz) from public,anon,authenticated;
revoke execute on function admin_update_campaign(uuid,text,text,int,text,text,timestamptz) from public,anon,authenticated;
revoke execute on function admin_set_campaign_status(uuid,text) from public,anon,authenticated;
revoke execute on function admin_create_seller(uuid,text,text,text,int) from public,anon,authenticated;
revoke execute on function admin_set_seller_active(uuid,uuid,boolean) from public,anon,authenticated;
revoke execute on function admin_set_order_status(uuid,text) from public,anon,authenticated;

grant execute on function public_active_campaigns() to anon,authenticated;
grant execute on function public_campaign(text,text) to anon,authenticated;
grant execute on function public_order(uuid) to anon,authenticated;
grant execute on function reserve_raffle_numbers(text,text,text,text,text,text,int[]) to anon;
grant execute on function claim_first_admin(text) to authenticated;
grant execute on function admin_dashboard() to authenticated;
grant execute on function admin_create_campaign(text,text,text,int,int,text,text,timestamptz) to authenticated;
grant execute on function admin_update_campaign(uuid,text,text,int,text,text,timestamptz) to authenticated;
grant execute on function admin_set_campaign_status(uuid,text) to authenticated;
grant execute on function admin_create_seller(uuid,text,text,text,int) to authenticated;
grant execute on function admin_set_seller_active(uuid,uuid,boolean) to authenticated;
grant execute on function admin_set_order_status(uuid,text) to authenticated;

create index if not exists campaign_sellers_seller_idx on campaign_sellers(seller_id);
create index if not exists orders_campaign_idx on orders(campaign_id);
create index if not exists orders_seller_idx on orders(seller_id);
create index if not exists raffle_numbers_order_idx on raffle_numbers(order_id);


