-- Recovered verbatim from Supabase migration history; 20261001043510.

create or replace function public.admin_set_order_status(p_order_id uuid,p_status text)
returns boolean language plpgsql security definer set search_path=public as $$
declare o orders;
begin
  if not is_admin() or p_status not in('paid','cancelled') then raise exception 'forbidden'; end if;
  select * into o from orders where id=p_order_id for update;
  if not found then return false; end if;
  if p_status='paid' then
    if o.status='paid' then return true; end if;
    if o.status<>'pending' or o.expires_at<now() then raise exception 'order unavailable'; end if;
    update orders set
      status='paid',
      provider_paid_at=coalesce(provider_paid_at,now()),
      provider_status=case when payment_provider='manual' then 'MANUAL_CONFIRMED' else coalesce(provider_status,'ADMIN_CONFIRMED') end,
      proof_status=case when proof_status='submitted' then 'approved' else proof_status end
    where id=o.id;
    update raffle_numbers set status='paid',reserved_until=null where order_id=o.id;
  else
    if o.status='paid' then raise exception 'paid order cannot be cancelled'; end if;
    update orders set status='cancelled',provider_status=case when payment_provider='manual' then 'MANUAL_CANCELLED' else coalesce(provider_status,'ADMIN_CANCELLED') end where id=o.id;
    update raffle_numbers set status='available',order_id=null,reserved_until=null where order_id=o.id and status='reserved';
  end if;
  insert into audit_logs(actor_email,action,entity_type,entity_id,payload)
  values(lower(auth.jwt()->>'email'),'status','order',o.id::text,jsonb_build_object('status',p_status));
  return true;
end $$;

create or replace function public.admin_financial_dashboard()
returns jsonb language plpgsql security definer set search_path=public as $$
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
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
      select d::date as day_value,
        coalesce((select sum(o.amount_cents) from orders o where o.status='paid' and coalesce(o.provider_paid_at,o.created_at)>=d and coalesce(o.provider_paid_at,o.created_at)<d+interval '1 day'),0) as gross_cents,
        coalesce((select sum(o.provider_net_value_cents) from orders o where o.status='paid' and coalesce(o.provider_paid_at,o.created_at)>=d and coalesce(o.provider_paid_at,o.created_at)<d+interval '1 day'),0) as net_cents,
        (select count(*) from orders o where o.status='paid' and coalesce(o.provider_paid_at,o.created_at)>=d and coalesce(o.provider_paid_at,o.created_at)<d+interval '1 day') as paid_orders
      from generate_series(date_trunc('day',now())-interval '29 days',date_trunc('day',now()),interval '1 day') d
    ) x),'[]'::jsonb),
    'by_seller',coalesce((select jsonb_agg(to_jsonb(x) order by x.revenue_cents desc) from (
      select s.id,s.name,s.code,count(*) filter(where o.status='paid') as paid_orders,
        coalesce(sum(o.amount_cents) filter(where o.status='paid'),0) as revenue_cents
      from sellers s left join orders o on o.seller_id=s.id
      group by s.id,s.name,s.code order by revenue_cents desc limit 20
    ) x),'[]'::jsonb),
    'by_campaign',coalesce((select jsonb_agg(to_jsonb(x) order by x.revenue_cents desc) from (
      select c.id,c.name,c.slug,count(*) filter(where o.status='paid') as paid_orders,
        coalesce(sum(o.amount_cents) filter(where o.status='paid'),0) as revenue_cents
      from campaigns c left join orders o on o.campaign_id=c.id
      group by c.id,c.name,c.slug order by revenue_cents desc
    ) x),'[]'::jsonb)
  );
end $$;


