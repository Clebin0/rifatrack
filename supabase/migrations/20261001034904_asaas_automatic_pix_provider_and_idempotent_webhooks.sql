-- Recovered verbatim from Supabase migration history; 20261001034904.

alter table public.orders
  add column if not exists payment_provider text not null default 'manual',
  add column if not exists provider_qr_id text,
  add column if not exists provider_qr_payload text,
  add column if not exists provider_payment_id text,
  add column if not exists provider_status text,
  add column if not exists provider_event_id text,
  add column if not exists provider_paid_at timestamptz,
  add column if not exists provider_net_value_cents integer,
  add column if not exists pix_transaction_id text;

create unique index if not exists orders_provider_qr_uidx
  on public.orders(provider_qr_id) where provider_qr_id is not null;
create unique index if not exists orders_provider_payment_uidx
  on public.orders(provider_payment_id) where provider_payment_id is not null;

create table if not exists public.payment_events(
  id bigint generated always as identity primary key,
  provider text not null,
  provider_event_id text not null,
  event_type text not null,
  provider_payment_id text,
  provider_qr_id text,
  payload jsonb not null default '{}'::jsonb,
  processed boolean not null default false,
  processing_note text,
  created_at timestamptz not null default now(),
  unique(provider,provider_event_id)
);
alter table public.payment_events enable row level security;
revoke all on public.payment_events from anon,authenticated;
drop policy if exists deny_public_payment_events on public.payment_events;
create policy deny_public_payment_events on public.payment_events
  for all to anon,authenticated using(false) with check(false);

create or replace function public.attach_asaas_qr(
  p_internal_secret text,
  p_order_id uuid,
  p_qr_id text,
  p_payload text
) returns boolean
language plpgsql
security definer
set search_path=public
as $$
begin
  if not internal_secret_ok(p_internal_secret) then raise exception 'unauthorized'; end if;
  update orders
  set payment_provider='asaas',
      provider_qr_id=left(p_qr_id,180),
      provider_qr_payload=p_payload,
      provider_status='QR_CREATED'
  where id=p_order_id and status='pending';
  return found;
end $$;

revoke all on function public.attach_asaas_qr(text,uuid,text,text) from public,authenticated;
grant execute on function public.attach_asaas_qr(text,uuid,text,text) to anon,service_role;

create or replace function public.cancel_order_internal(
  p_internal_secret text,
  p_order_id uuid,
  p_reason text default 'provider_error'
) returns boolean
language plpgsql
security definer
set search_path=public
as $$
declare o orders;
begin
  if not internal_secret_ok(p_internal_secret) then raise exception 'unauthorized'; end if;
  select * into o from orders where id=p_order_id for update;
  if not found or o.status<>'pending' then return false; end if;
  update orders set status='cancelled',provider_status=left(p_reason,100) where id=o.id;
  update raffle_numbers set status='available',order_id=null,reserved_until=null
    where order_id=o.id and status='reserved';
  return true;
end $$;

revoke all on function public.cancel_order_internal(text,uuid,text) from public,authenticated;
grant execute on function public.cancel_order_internal(text,uuid,text) to anon,service_role;

create or replace function public.process_asaas_event(
  p_internal_secret text,
  p_event_id text,
  p_event_type text,
  p_payment_id text,
  p_qr_id text,
  p_payment_status text,
  p_value_cents integer,
  p_net_value_cents integer,
  p_paid_at timestamptz,
  p_pix_transaction_id text,
  p_payload jsonb
) returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  o orders;
  already boolean:=false;
  note text:='';
begin
  if not internal_secret_ok(p_internal_secret) then raise exception 'unauthorized'; end if;
  if length(coalesce(p_event_id,''))<3 then raise exception 'invalid event'; end if;

  begin
    insert into payment_events(provider,provider_event_id,event_type,provider_payment_id,provider_qr_id,payload)
    values('asaas',p_event_id,p_event_type,p_payment_id,p_qr_id,coalesce(p_payload,'{}'::jsonb));
  exception when unique_violation then
    already:=true;
  end;

  if already then
    return jsonb_build_object('ok',true,'duplicate',true);
  end if;

  select * into o
  from orders
  where provider_qr_id=p_qr_id
     or (p_payment_id is not null and provider_payment_id=p_payment_id)
  order by created_at desc
  limit 1
  for update;

  if not found then
    update payment_events set processing_note='order_not_found' where provider='asaas' and provider_event_id=p_event_id;
    return jsonb_build_object('ok',true,'matched',false);
  end if;

  update orders
  set provider_payment_id=coalesce(provider_payment_id,p_payment_id),
      provider_event_id=p_event_id,
      provider_status=coalesce(p_payment_status,p_event_type),
      pix_transaction_id=coalesce(pix_transaction_id,p_pix_transaction_id)
  where id=o.id;

  if p_event_type in ('PAYMENT_RECEIVED','PAYMENT_CONFIRMED') then
    if p_value_cents is null or p_value_cents<>o.amount_cents then
      note:='amount_mismatch';
      update orders set provider_status='AMOUNT_MISMATCH' where id=o.id;
    elsif o.status='paid' then
      note:='already_paid';
    elsif o.status<>'pending' then
      note:='late_or_cancelled_payment';
      update orders set provider_status='PAYMENT_RECEIVED_AFTER_LOCAL_CLOSE' where id=o.id;
    elsif not exists(
      select 1 from raffle_numbers
      where order_id=o.id and status='reserved'
    ) then
      note:='numbers_not_reserved';
      update orders set provider_status='PAYMENT_REVIEW_REQUIRED' where id=o.id;
    else
      update orders
      set status='paid',
          provider_status='RECEIVED',
          provider_paid_at=coalesce(p_paid_at,now()),
          provider_net_value_cents=p_net_value_cents,
          proof_status=case when proof_status='submitted' then 'approved' else proof_status end
      where id=o.id;
      update raffle_numbers
      set status='paid',reserved_until=null
      where order_id=o.id and status='reserved';
      note:='paid';
      insert into audit_logs(actor_email,action,entity_type,entity_id,payload)
      values('asaas-webhook','auto_payment','order',o.id::text,
        jsonb_build_object('event_id',p_event_id,'payment_id',p_payment_id,'value_cents',p_value_cents));
    end if;
  elsif p_event_type in ('PAYMENT_REFUNDED','PAYMENT_CHARGEBACK_REQUESTED','PAYMENT_CHARGEBACK_DISPUTE') then
    update orders set provider_status=p_event_type where id=o.id;
    note:='provider_alert';
  else
    note:='status_updated';
  end if;

  update payment_events
  set processed=true,processing_note=note
  where provider='asaas' and provider_event_id=p_event_id;

  return jsonb_build_object('ok',true,'matched',true,'order_id',o.id,'note',note);
end $$;

revoke all on function public.process_asaas_event(text,text,text,text,text,text,integer,integer,timestamptz,text,jsonb) from public,authenticated;
grant execute on function public.process_asaas_event(text,text,text,text,text,text,integer,integer,timestamptz,text,jsonb) to anon,service_role;

create or replace function public.public_order(p_token uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare o orders; c campaigns; s sellers;
begin
  select * into o from orders where public_token=p_token;
  if not found then return null; end if;
  perform release_expired_reservations(o.campaign_id);
  select * into o from orders where public_token=p_token;
  select * into c from campaigns where id=o.campaign_id;
  if o.seller_id is not null then select * into s from sellers where id=o.seller_id; end if;
  return jsonb_build_object(
    'status',o.status,'amount_cents',o.amount_cents,'expires_at',o.expires_at,
    'payment_reference',o.payment_reference,'pix_txid',o.pix_txid,
    'buyer_name',o.buyer_name,'campaign_name',c.name,'campaign_slug',c.slug,
    'seller_name',s.name,'pix_key',c.pix_key,'pix_receiver',c.pix_receiver,'pix_city',c.pix_city,
    'proof_status',o.proof_status,'proof_uploaded_at',o.proof_uploaded_at,
    'payment_provider',o.payment_provider,'provider_qr_payload',o.provider_qr_payload,
    'provider_payment_id',o.provider_payment_id,'provider_status',o.provider_status,
    'provider_paid_at',o.provider_paid_at,'provider_net_value_cents',o.provider_net_value_cents,
    'pix_transaction_id',o.pix_transaction_id,
    'numbers',coalesce((select jsonb_agg(number order by number) from raffle_numbers where order_id=o.id),'[]'::jsonb)
  );
end $$;

revoke all on function public.public_order(uuid) from public;
grant execute on function public.public_order(uuid) to anon,authenticated,service_role;

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
      select c.id,c.name,c.slug,c.description,c.price_cents,c.total_numbers,c.status,c.pix_key,c.pix_receiver,c.pix_city,c.ends_at,c.created_at,
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
      select o.id,o.public_token,o.buyer_name,o.buyer_phone,o.buyer_email,o.status,o.amount_cents,o.payment_reference,o.pix_txid,o.expires_at,o.created_at,
      o.proof_path,o.proof_status,o.proof_uploaded_at,
      o.payment_provider,o.provider_qr_id,o.provider_payment_id,o.provider_status,o.provider_paid_at,o.provider_net_value_cents,o.pix_transaction_id,
      c.name campaign_name,c.slug campaign_slug,s.name seller_name,
      coalesce((select jsonb_agg(rn.number order by rn.number) from raffle_numbers rn where rn.order_id=o.id),'[]'::jsonb) numbers
      from orders o join campaigns c on c.id=o.campaign_id left join sellers s on s.id=o.seller_id
      order by o.created_at desc limit 250
    ) x),'[]'::jsonb)
  );
end $$;


