-- Recovered verbatim from Supabase migration history; 20261003141934.

create or replace function public.admin_set_campaign_status(p_id uuid,p_status text)
returns boolean language plpgsql security definer set search_path=public,extensions as $$
declare c campaigns; paid_list text; list_hash text; seed text; commitment text; eligible integer;
begin
  if not public.admin_role_aal2(array['owner','admin','operador']) or p_status not in('draft','active','closed') then raise exception 'forbidden'; end if;
  select * into c from campaigns where id=p_id for update;
  if not found then return false; end if;
  if c.status='closed' and p_status<>'closed' and exists(select 1 from draw_commitments where campaign_id=p_id) then raise exception 'closed campaign is cryptographically locked'; end if;
  if p_status='closed' and c.status<>'closed' then
    perform release_expired_reservations(p_id);
    if exists(select 1 from orders where campaign_id=p_id and status='pending') then raise exception 'resolve pending orders before closing'; end if;
    select count(*),coalesce(string_agg(number::text,',' order by number),'') into eligible,paid_list from raffle_numbers where campaign_id=p_id and status='paid';
    if eligible>0 then
      list_hash:=encode(extensions.digest(convert_to(paid_list,'UTF8'),'sha256'),'hex');
      seed:=encode(extensions.gen_random_bytes(32),'hex');
      commitment:=encode(extensions.digest(convert_to(seed||':'||list_hash,'UTF8'),'sha256'),'hex');
      insert into draw_commitments(campaign_id,eligible_count,paid_list_hash,seed_commitment,seed_secret)
      values(p_id,eligible,list_hash,commitment,seed) on conflict(campaign_id) do nothing;
    end if;
  end if;
  update campaigns set status=p_status,updated_at=now() where id=p_id;
  insert into audit_logs(actor_email,action,entity_type,entity_id,payload)
  values(lower(auth.jwt()->>'email'),'status','campaign',p_id::text,
    jsonb_build_object('status',p_status,'role',current_admin_role(),'draw_commitment',(select seed_commitment from draw_commitments where campaign_id=p_id)));
  return true;
end $$;

create or replace function public.admin_dashboard()
returns jsonb language plpgsql security definer set search_path=public as $$
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  perform release_expired_reservations(null);
  return jsonb_build_object(
    'admin_email',lower(auth.jwt()->>'email'),
    'admin_role',public.current_admin_role(),
    'summary',jsonb_build_object(
      'campaigns',(select count(*) from campaigns),
      'active_campaigns',(select count(*) from campaigns where status='active'),
      'paid_revenue_cents',(select coalesce(sum(amount_cents),0) from orders where status='paid'),
      'pending_orders',(select count(*) from orders where status='pending'),
      'payment_alerts',(select count(*) from orders where provider_status in ('AMOUNT_MISMATCH','PAYMENT_REVIEW_REQUIRED','PAYMENT_RECEIVED_AFTER_LOCAL_CLOSE','PAYMENT_REFUNDED','PAYMENT_CHARGEBACK_REQUESTED','PAYMENT_CHARGEBACK_DISPUTE'))
    ),
    'campaigns',coalesce((select jsonb_agg(to_jsonb(x) order by x.created_at desc) from (
      select c.id,c.name,c.slug,c.description,c.price_cents,c.total_numbers,c.status,c.pix_key,c.pix_receiver,c.pix_city,c.ends_at,c.created_at,
      (select count(*) from raffle_numbers rn where rn.campaign_id=c.id and rn.status='paid') sold_numbers,
      (select count(*) from raffle_numbers rn where rn.campaign_id=c.id and rn.status='reserved') reserved_numbers,
      (select coalesce(sum(o.amount_cents),0) from orders o where o.campaign_id=c.id and o.status='paid') revenue_cents,
      (select d.number from draws d where d.campaign_id=c.id) draw_number,
      (select d.drawn_at from draws d where d.campaign_id=c.id) drawn_at
      from campaigns c
    ) x),'[]'::jsonb),
    'sellers',coalesce((select jsonb_agg(to_jsonb(x) order by x.sold_numbers desc,x.name) from (
      select cs.campaign_id,c.name campaign_name,c.slug campaign_slug,s.id,s.name,s.code,s.team,s.whatsapp,cs.goal,cs.active,
      (select count(*) from raffle_numbers rn join orders o on o.id=rn.order_id where o.campaign_id=cs.campaign_id and o.seller_id=s.id and rn.status='paid') sold_numbers,
      (select coalesce(sum(o.amount_cents),0) from orders o where o.campaign_id=cs.campaign_id and o.seller_id=s.id and o.status='paid') revenue_cents
      from campaign_sellers cs join campaigns c on c.id=cs.campaign_id join sellers s on s.id=cs.seller_id
    ) x),'[]'::jsonb),
    'orders',coalesce((select jsonb_agg(to_jsonb(x) order by x.created_at desc) from (
      select o.id,o.public_token,o.buyer_name,o.buyer_phone,o.buyer_email,o.status,o.amount_cents,o.payment_reference,o.pix_txid,o.expires_at,o.created_at,
      o.proof_path,o.proof_status,o.proof_uploaded_at,o.payment_provider,o.provider_qr_id,o.provider_payment_id,o.provider_status,o.provider_paid_at,o.provider_net_value_cents,o.pix_transaction_id,
      c.name campaign_name,c.slug campaign_slug,s.name seller_name,
      coalesce((select jsonb_agg(rn.number order by rn.number) from raffle_numbers rn where rn.order_id=o.id),'[]'::jsonb) numbers
      from orders o join campaigns c on c.id=o.campaign_id left join sellers s on s.id=o.seller_id
      order by o.created_at desc limit 250
    ) x),'[]'::jsonb)
  );
end $$;

create or replace function public.admin_financial_dashboard()
returns jsonb language plpgsql security definer set search_path=public as $$
begin
  if not public.has_admin_role(array['owner','admin','financeiro','auditor']) then raise exception 'forbidden'; end if;
  return jsonb_build_object(
    'summary',jsonb_build_object(
      'gross_cents',(select coalesce(sum(amount_cents),0) from orders where status='paid'),
      'net_cents',(select coalesce(sum(provider_net_value_cents),0) from orders where status='paid' and provider_net_value_cents is not null),
      'paid_orders',(select count(*) from orders where status='paid'),
      'pending_orders',(select count(*) from orders where status='pending'),
      'expired_orders',(select count(*) from orders where status='expired'),
      'cancelled_orders',(select count(*) from orders where status='cancelled'),
      'alerts',(select count(*) from orders where provider_status in ('AMOUNT_MISMATCH','PAYMENT_REVIEW_REQUIRED','PAYMENT_RECEIVED_AFTER_LOCAL_CLOSE','PAYMENT_REFUNDED','PAYMENT_CHARGEBACK_REQUESTED','PAYMENT_CHARGEBACK_DISPUTE'))
    ),
    'daily',coalesce((select jsonb_agg(to_jsonb(x) order by x.day_value) from (
      select d::date day_value,
        coalesce((select sum(o.amount_cents) from orders o where o.status='paid' and coalesce(o.provider_paid_at,o.created_at)>=d and coalesce(o.provider_paid_at,o.created_at)<d+interval '1 day'),0) gross_cents,
        coalesce((select sum(o.provider_net_value_cents) from orders o where o.status='paid' and coalesce(o.provider_paid_at,o.created_at)>=d and coalesce(o.provider_paid_at,o.created_at)<d+interval '1 day'),0) net_cents,
        (select count(*) from orders o where o.status='paid' and coalesce(o.provider_paid_at,o.created_at)>=d and coalesce(o.provider_paid_at,o.created_at)<d+interval '1 day') paid_orders
      from generate_series(date_trunc('day',now())-interval '29 days',date_trunc('day',now()),interval '1 day') d
    ) x),'[]'::jsonb),
    'by_seller',coalesce((select jsonb_agg(to_jsonb(x) order by x.revenue_cents desc) from (
      select s.id,s.name,s.code,count(*) filter(where o.status='paid') paid_orders,coalesce(sum(o.amount_cents) filter(where o.status='paid'),0) revenue_cents
      from sellers s left join orders o on o.seller_id=s.id group by s.id,s.name,s.code order by revenue_cents desc limit 20
    ) x),'[]'::jsonb),
    'by_campaign',coalesce((select jsonb_agg(to_jsonb(x) order by x.revenue_cents desc) from (
      select c.id,c.name,c.slug,count(*) filter(where o.status='paid') paid_orders,coalesce(sum(o.amount_cents) filter(where o.status='paid'),0) revenue_cents
      from campaigns c left join orders o on o.campaign_id=c.id group by c.id,c.name,c.slug order by revenue_cents desc
    ) x),'[]'::jsonb)
  );
end $$;

create or replace function public.admin_audit_dashboard()
returns jsonb language plpgsql security definer set search_path=public as $$
begin
  if not public.has_admin_role(array['owner','admin','auditor']) then raise exception 'forbidden'; end if;
  return jsonb_build_object(
    'audit_logs',coalesce((select jsonb_agg(to_jsonb(x) order by x.created_at desc) from (
      select id,actor_email,action,entity_type,entity_id,payload,created_at from audit_logs order by created_at desc limit 500
    ) x),'[]'::jsonb),
    'payment_events',coalesce((select jsonb_agg(to_jsonb(x) order by x.created_at desc) from (
      select id,provider,provider_event_id,event_type,provider_payment_id,provider_qr_id,processed,processing_note,created_at from payment_events order by created_at desc limit 500
    ) x),'[]'::jsonb)
  );
end $$;


