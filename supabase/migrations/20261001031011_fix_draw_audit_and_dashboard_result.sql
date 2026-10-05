-- Recovered verbatim from Supabase migration history; 20261001031011.

create or replace function public.admin_draw_campaign(p_campaign_id uuid)
returns jsonb
language plpgsql
security definer
set search_path=public, extensions
as $$
declare
  v_email text;
  v_campaign public.campaigns;
  v_count bigint;
  v_pick bigint;
  v_row record;
  v_existing public.draws;
begin
  v_email:=lower(coalesce(auth.jwt()->>'email',''));
  if not public.is_admin() then raise exception 'admin required'; end if;

  select * into v_campaign from public.campaigns where id=p_campaign_id for update;
  if not found then raise exception 'campaign not found'; end if;
  if v_campaign.status <> 'closed' then raise exception 'campaign must be closed'; end if;

  select * into v_existing from public.draws where campaign_id=p_campaign_id;
  if found then
    return jsonb_build_object('number',v_existing.number,'drawn_at',v_existing.drawn_at,'already_drawn',true);
  end if;

  select count(*) into v_count
  from public.raffle_numbers
  where campaign_id=p_campaign_id and status='paid';

  if v_count < 1 then raise exception 'no paid numbers'; end if;

  v_pick := (
    ('x' || substr(encode(extensions.digest(gen_random_uuid()::text || clock_timestamp()::text,'sha256'),'hex'),1,16))::bit(64)::bigint
    & 9223372036854775807
  ) % v_count;

  select rn.number, rn.order_id
  into v_row
  from public.raffle_numbers rn
  where rn.campaign_id=p_campaign_id and rn.status='paid'
  order by rn.number
  offset v_pick limit 1;

  insert into public.draws(campaign_id,order_id,number,actor_email)
  values(p_campaign_id,v_row.order_id,v_row.number,v_email)
  returning * into v_existing;

  insert into public.audit_logs(actor_email,action,entity_type,entity_id,payload)
  values(v_email,'draw_campaign','campaign',p_campaign_id::text,jsonb_build_object('number',v_existing.number));

  return jsonb_build_object('number',v_existing.number,'drawn_at',v_existing.drawn_at,'already_drawn',false);
end $$;

revoke execute on function public.admin_draw_campaign(uuid) from public,anon;
grant execute on function public.admin_draw_campaign(uuid) to authenticated;

create or replace function public.admin_dashboard()
returns jsonb language plpgsql security definer set search_path=public as $$
begin
  if not is_admin() then raise exception 'forbidden'; end if;
  perform release_expired_reservations(null);
  return jsonb_build_object(
    'admin_email',lower(auth.jwt()->>'email'),
    'summary',jsonb_build_object(
      'campaigns',(select count(*) from campaigns),
      'active_campaigns',(select count(*) from campaigns where status='active'),
      'paid_revenue_cents',(select coalesce(sum(amount_cents),0) from orders where status='paid'),
      'pending_orders',(select count(*) from orders where status='pending')
    ),
    'campaigns',coalesce((select jsonb_agg(to_jsonb(x) order by x.created_at desc) from (
      select c.id,c.name,c.slug,c.description,c.price_cents,c.total_numbers,c.status,c.pix_key,c.pix_receiver,c.ends_at,c.created_at,
      (select count(*) from raffle_numbers rn where rn.campaign_id=c.id and rn.status='paid') sold_numbers,
      (select count(*) from raffle_numbers rn where rn.campaign_id=c.id and rn.status='reserved') reserved_numbers,
      (select coalesce(sum(o.amount_cents),0) from orders o where o.campaign_id=c.id and o.status='paid') revenue_cents,
      (select d.number from draws d where d.campaign_id=c.id) draw_number,
      (select d.drawn_at from draws d where d.campaign_id=c.id) drawn_at
      from campaigns c
    ) x),'[]'::jsonb),
    'sellers',coalesce((select jsonb_agg(to_jsonb(x) order by x.sold_numbers desc,x.name) from (
      select cs.campaign_id,c.name campaign_name,c.slug campaign_slug,s.id,s.name,s.code,s.team,cs.goal,cs.active,
      (select count(*) from raffle_numbers rn join orders o on o.id=rn.order_id where o.campaign_id=cs.campaign_id and o.seller_id=s.id and rn.status='paid') sold_numbers,
      (select coalesce(sum(o.amount_cents),0) from orders o where o.campaign_id=cs.campaign_id and o.seller_id=s.id and o.status='paid') revenue_cents
      from campaign_sellers cs join campaigns c on c.id=cs.campaign_id join sellers s on s.id=cs.seller_id
    ) x),'[]'::jsonb),
    'orders',coalesce((select jsonb_agg(to_jsonb(x) order by x.created_at desc) from (
      select o.id,o.public_token,o.buyer_name,o.buyer_phone,o.status,o.amount_cents,o.payment_reference,o.expires_at,o.created_at,
      c.name campaign_name,c.slug campaign_slug,s.name seller_name,
      coalesce((select jsonb_agg(rn.number order by rn.number) from raffle_numbers rn where rn.order_id=o.id),'[]'::jsonb) numbers
      from orders o join campaigns c on c.id=o.campaign_id left join sellers s on s.id=o.seller_id
      order by o.created_at desc limit 250
    ) x),'[]'::jsonb)
  );
end $$;


