-- Server-only RPCs. Legacy endpoints are disabled in the final cutover migration.
CREATE OR REPLACE FUNCTION public.attach_asaas_qr(p_order_id uuid, p_qr_id text, p_payload text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_exp timestamptz;
begin
  update orders
  set payment_provider='asaas',
      provider_qr_id=left(p_qr_id,180),
      provider_qr_payload=p_payload,
      provider_status='AWAITING_PAYMENT'
  where id=p_order_id and status='pending'
  returning expires_at into v_exp;

  if not found then return false; end if;

  update raffle_numbers
  set reserved_until=v_exp + interval '2 minutes'
  where order_id=p_order_id and status='reserved';

  return true;
end $function$
;
REVOKE ALL ON FUNCTION attach_asaas_qr(uuid,text,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION attach_asaas_qr(uuid,text,text) TO service_role;

CREATE OR REPLACE FUNCTION public.cancel_order_internal(p_order_id uuid, p_reason text DEFAULT 'provider_error'::text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare o orders;
begin
  select * into o from orders where id=p_order_id for update;
  if not found or o.status<>'pending' then return false; end if;
  update orders set status='cancelled',provider_status=left(p_reason,100) where id=o.id;
  update raffle_numbers set status='available',order_id=null,reserved_until=null
    where order_id=o.id and status='reserved';
  return true;
end $function$
;
REVOKE ALL ON FUNCTION cancel_order_internal(uuid,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION cancel_order_internal(uuid,text) TO service_role;

CREATE OR REPLACE FUNCTION public.enqueue_order_notification_internal(p_order_id uuid, p_event text)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private'
AS $function$
begin
  return private.queue_order_notifications(p_order_id,p_event);
end $function$
;
REVOKE ALL ON FUNCTION enqueue_order_notification_internal(uuid,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION enqueue_order_notification_internal(uuid,text) TO service_role;

CREATE OR REPLACE FUNCTION public.log_system_event_internal(p_request_id text, p_severity text, p_category text, p_code text, p_route text, p_metadata jsonb DEFAULT '{}'::jsonb)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if p_severity not in ('info','warn','error','critical') then raise exception 'invalid severity'; end if;
  insert into system_events(request_id,severity,category,code,route,metadata)
  values(left(coalesce(p_request_id,''),100),p_severity,left(coalesce(p_category,''),80),left(coalesce(p_code,''),120),left(coalesce(p_route,''),200),coalesce(p_metadata,'{}'::jsonb));
  return true;
end $function$
;
REVOKE ALL ON FUNCTION log_system_event_internal(text,text,text,text,text,jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION log_system_event_internal(text,text,text,text,text,jsonb) TO service_role;

CREATE OR REPLACE FUNCTION public.reserve_raffle_numbers(p_fingerprint text, p_campaign_slug text, p_seller_code text, p_buyer_name text, p_buyer_phone text, p_buyer_email text, p_numbers integer[])
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare c campaigns; s sellers; o orders; wanted int; locked_available int; current_requests int;
begin
  if length(coalesce(p_fingerprint,''))<16 or length(p_fingerprint)>128 then raise exception 'invalid fingerprint'; end if;


  wanted:=coalesce(array_length(p_numbers,1),0);
  if wanted<1 or wanted>50 then raise exception 'invalid quantity'; end if;
  if (select count(distinct x) from unnest(p_numbers)x)<>wanted then raise exception 'duplicate number'; end if;
  if length(trim(p_buyer_name))<2 or length(trim(p_buyer_name))>100 then raise exception 'invalid buyer'; end if;
  if length(trim(p_buyer_phone))<8 or length(trim(p_buyer_phone))>20 then raise exception 'invalid phone'; end if;
  if p_buyer_email<>'' and p_buyer_email !~* '^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$' then raise exception 'invalid email'; end if;
  if (select count(*) from orders where buyer_phone=left(trim(p_buyer_phone),20) and created_at>now()-interval '15 minutes')>=3 then
    raise exception 'too many orders';
  end if;

  select * into c from campaigns where slug=p_campaign_slug and status='active' for update;
  if not found or (c.ends_at is not null and c.ends_at<now()) then raise exception 'campaign unavailable'; end if;
  if exists(select 1 from unnest(p_numbers)x where x<1 or x>c.total_numbers) then raise exception 'invalid number'; end if;
  perform release_expired_reservations(c.id);

  if p_seller_code is not null and p_seller_code<>'' then
    select se.* into s from sellers se
    join campaign_sellers cs on cs.seller_id=se.id
    where cs.campaign_id=c.id and cs.active=true and se.active=true and se.code=upper(p_seller_code);
    if not found then raise exception 'seller unavailable'; end if;
  elsif exists(select 1 from campaign_sellers cs join sellers se on se.id=cs.seller_id where cs.campaign_id=c.id and cs.active=true and se.active=true) then
    raise exception 'seller required';
  end if;

  select count(*) into locked_available from (
    select id,status from raffle_numbers
    where campaign_id=c.id and number=any(p_numbers)
    for update
  ) q where q.status='available';
  if locked_available<>wanted then raise exception 'number unavailable'; end if;

  insert into orders(campaign_id,seller_id,buyer_name,buyer_phone,buyer_email,amount_cents,expires_at,payment_reference,pix_txid)
  values(
    c.id,s.id,left(trim(p_buyer_name),100),left(trim(p_buyer_phone),20),left(lower(trim(coalesce(p_buyer_email,''))),180),
    wanted*c.price_cents,now()+interval '10 minutes',
    'RT-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,10)),
    'RT'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,23))
  )
  returning * into o;

  update raffle_numbers set order_id=o.id,status='reserved',reserved_until=o.expires_at
  where campaign_id=c.id and number=any(p_numbers) and status='available';

  return jsonb_build_object(
    'id',o.id,'public_token',o.public_token,'amount_cents',o.amount_cents,
    'expires_at',o.expires_at,'payment_reference',o.payment_reference,'pix_txid',o.pix_txid
  );
end $function$
;
REVOKE ALL ON FUNCTION reserve_raffle_numbers(text,text,text,text,text,text,integer[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION reserve_raffle_numbers(text,text,text,text,text,text,integer[]) TO service_role;


alter table orders alter column expires_at set default(now()+interval '10 minutes');
alter table notification_outbox add column if not exists lease_until timestamptz;
alter table notification_outbox add column if not exists claim_token uuid;
create table if not exists financial_cases(
 id uuid primary key default gen_random_uuid(), order_id uuid not null references orders(id),
 event_id text not null unique, reason text not null,
 status text not null default 'open' check(status in('open','resolved')),
 resolution text, created_at timestamptz not null default now(), resolved_at timestamptz
);
alter table financial_cases enable row level security;
revoke all on financial_cases from public,anon,authenticated;
create policy financial_cases_admin_read on financial_cases for select to authenticated
 using(public.has_admin_role(array['owner','admin','financeiro','auditor']));
grant select on financial_cases to authenticated;
grant all on financial_cases to service_role;

create or replace function public.consume_rate_limit_internal(p_key text,p_limit int,p_seconds int)
returns jsonb language plpgsql security definer set search_path=public as $$
declare n int; ws timestamptz; retry int;
begin
 if p_limit<1 or p_seconds<1 or p_seconds>86400 or length(p_key)<>64 then raise exception 'invalid limit'; end if;
 ws:=to_timestamp(floor(extract(epoch from clock_timestamp())/p_seconds)*p_seconds);
 insert into api_rate_limits(fingerprint,window_start,requests) values(p_key,ws,1)
 on conflict(fingerprint,window_start) do update set requests=api_rate_limits.requests+1 returning requests into n;
 retry:=greatest(1,ceil(extract(epoch from ws+make_interval(secs=>p_seconds)-clock_timestamp()))::int);
 return jsonb_build_object('allowed',n<=p_limit,'retry_after',retry);
end $$;
revoke all on function consume_rate_limit_internal(text,int,int) from public,anon,authenticated;
grant execute on function consume_rate_limit_internal(text,int,int) to service_role;

create or replace function public.health_check_internal() returns boolean
language sql security invoker set search_path=public as $$ select 1=1 $$;
revoke all on function health_check_internal() from public,anon,authenticated;
grant execute on function health_check_internal() to service_role;

create or replace function public.claim_notification_batch_internal(p_limit int default 5)
returns jsonb language plpgsql security definer set search_path=public as $$
declare result jsonb;
begin
 update notification_outbox set status='failed',lease_until=null,claim_token=null,last_error='lease_expired_after_max_attempts'
 where status='processing' and lease_until<now() and attempts>=5;
 with picked as(
 select id from notification_outbox
 where attempts<5 and ((status in('pending','failed') and next_attempt_at<=now()) or (status='processing' and coalesce(lease_until,created_at)<now()))
 order by created_at limit least(greatest(coalesce(p_limit,5),1),5) for update skip locked
 ), upd as(
 update notification_outbox n set status='processing',attempts=attempts+1,lease_until=now()+interval '5 minutes',claim_token=gen_random_uuid()
 from picked p where n.id=p.id returning n.*
 ) select coalesce(jsonb_agg(to_jsonb(upd)),'[]') into result from upd;
 return result;
end $$;
revoke all on function claim_notification_batch_internal(int) from public,anon,authenticated;
grant execute on function claim_notification_batch_internal(int) to service_role;

create or replace function public.finish_notification_internal(p_id uuid,p_claim_token uuid,p_ok boolean,p_error text default null)
returns boolean language plpgsql security definer set search_path=public as $$
begin
 update notification_outbox set status=case when p_ok then 'sent' else 'failed' end,
 sent_at=case when p_ok then now() else sent_at end,
 last_error=case when p_ok then null else left(coalesce(p_error,'unknown'),500) end,
 next_attempt_at=case when p_ok then next_attempt_at else now()+make_interval(mins=>least(60,greatest(2,attempts*5))) end,
 lease_until=null,claim_token=null
 where id=p_id and status='processing' and claim_token=p_claim_token;
 return found;
end $$;
revoke all on function finish_notification_internal(uuid,uuid,boolean,text) from public,anon,authenticated;
grant execute on function finish_notification_internal(uuid,uuid,boolean,text) to service_role;

create or replace function public.maintenance_internal() returns jsonb
language plpgsql security definer set search_path=public as $$
declare expired int;
begin
 select count(*) into expired from orders where status='pending' and expires_at<now()-interval '2 minutes';
 perform release_expired_reservations(null);
 delete from api_rate_limits where window_start<now()-interval '2 days';
 return jsonb_build_object('expired_candidates',expired,'open_financial_cases',(select count(*) from financial_cases where status='open'),'stalled_notifications',(select count(*) from notification_outbox where status='failed' and attempts>=5));
end $$;
revoke all on function maintenance_internal() from public,anon,authenticated;
grant execute on function maintenance_internal() to service_role;

create or replace function public.process_asaas_event(
 p_event_id text,p_event_type text,p_payment_id text,p_qr_id text,p_payment_status text,
 p_value_cents int,p_net_value_cents int,p_paid_at timestamptz,p_pix_transaction_id text,p_payload jsonb,p_external_reference uuid)
returns jsonb language plpgsql security definer set search_path=public,private as $$
declare o orders; cid uuid; final_at timestamptz; note text:=''; expected_count int; actual_count int;
begin
 if length(coalesce(p_event_id,''))<3 or p_event_type not in('PAYMENT_RECEIVED','PAYMENT_CONFIRMED','PAYMENT_REFUNDED','PAYMENT_CHARGEBACK_REQUESTED','PAYMENT_CHARGEBACK_DISPUTE') then raise exception 'invalid event'; end if;
 insert into payment_events(provider,provider_event_id,event_type,provider_payment_id,provider_qr_id,payload)
 values('asaas',p_event_id,p_event_type,p_payment_id,p_qr_id,coalesce(p_payload,'{}')) on conflict(provider,provider_event_id) do nothing;
 if not found then return jsonb_build_object('ok',true,'duplicate',true); end if;
 select campaign_id into cid from orders where id=p_external_reference;
 if cid is null then
 update payment_events set processing_note='order_not_found' where provider='asaas' and provider_event_id=p_event_id;
 return jsonb_build_object('ok',true,'matched',false);
 end if;
 select finalized_at into final_at from campaigns where id=cid for update;
 select * into o from orders where id=p_external_reference for update;
 if o.payment_provider is distinct from 'asaas' or not coalesce((
 (p_qr_id is not null and p_qr_id=o.provider_qr_id) or
 (p_payment_id is not null and p_payment_id=o.provider_payment_id)
 ),false) or (p_qr_id is not null and p_qr_id is distinct from o.provider_qr_id)
 or (o.provider_payment_id is not null and p_payment_id is distinct from o.provider_payment_id)
 or exists(select 1 from orders other where other.provider_payment_id=p_payment_id and other.id<>o.id) then
 note:='EXTERNAL_REFERENCE_MISMATCH';
 elsif p_value_cents is distinct from o.amount_cents then note:='AMOUNT_MISMATCH';
 else
 update orders set provider_payment_id=coalesce(provider_payment_id,p_payment_id),provider_event_id=p_event_id,
 pix_transaction_id=coalesce(pix_transaction_id,p_pix_transaction_id) where id=o.id;
 if p_event_type='PAYMENT_RECEIVED' then
 if o.provider_status in('PAYMENT_REFUNDED','PAYMENT_CHARGEBACK_REQUESTED','PAYMENT_CHARGEBACK_DISPUTE') then note:='TERMINAL_PAYMENT_REVIEW_REQUIRED';
 elsif o.status='paid' then note:='already_paid';
 elsif o.status<>'pending' or final_at is not null or p_paid_at is null or p_paid_at>o.expires_at or now()>o.expires_at+interval '2 minutes' then
 note:='PAYMENT_RECEIVED_AFTER_LOCAL_CLOSE';
 else
 expected_count:=o.amount_cents/(select price_cents from campaigns where id=cid);
 select count(*) into actual_count from raffle_numbers where order_id=o.id and status='reserved';
 if actual_count<>expected_count or actual_count<1 then note:='PAYMENT_REVIEW_REQUIRED';
 else
 update orders set status='paid',provider_status='RECEIVED',provider_paid_at=p_paid_at,provider_net_value_cents=p_net_value_cents where id=o.id;
 update raffle_numbers set status='paid',reserved_until=null where order_id=o.id and status='reserved';
 perform private.queue_order_notifications(o.id,'paid');note:='paid';
 end if;
 end if;
 elsif p_event_type='PAYMENT_CONFIRMED' then
 note:='confirmed_awaiting_received';
 update orders set provider_status='CONFIRMED_AWAITING_RECEIVED' where id=o.id and status='pending' and provider_status not in('PAYMENT_REFUNDED','PAYMENT_CHARGEBACK_REQUESTED','PAYMENT_CHARGEBACK_DISPUTE');
 elsif p_event_type='PAYMENT_REFUNDED' then
 note:=p_event_type;
 update orders set status='cancelled',provider_status=p_event_type,provider_net_value_cents=0 where id=o.id;
 -- Frozen eligibility and historic results stay intact after finalization.
 if final_at is null then update raffle_numbers set status='available',order_id=null,reserved_until=null where order_id=o.id; end if;
 else
 note:=p_event_type;
 update orders set provider_status=p_event_type where id=o.id;
 end if;
 end if;
 if note not in('paid','already_paid','confirmed_awaiting_received') then
 insert into financial_cases(order_id,event_id,reason) values(o.id,p_event_id,note);
 update orders set provider_status=note where id=o.id;
 end if;
 insert into audit_logs(actor_email,action,entity_type,entity_id,payload)
 values('asaas-webhook','payment_event','order',o.id::text,jsonb_build_object('event_id',p_event_id,'event_type',p_event_type,'note',note,'value_cents',p_value_cents));
 update payment_events set processed=true,processing_note=note where provider='asaas' and provider_event_id=p_event_id;
 return jsonb_build_object('ok',true,'matched',true,'note',note);
end $$;
revoke all on function process_asaas_event(text,text,text,text,text,int,int,timestamptz,text,jsonb,uuid) from public,anon,authenticated;
grant execute on function process_asaas_event(text,text,text,text,text,int,int,timestamptz,text,jsonb,uuid) to service_role;

create or replace function public.admin_resolve_financial_case(p_id uuid,p_resolution text) returns boolean
language plpgsql security definer set search_path=public as $$
begin
 if not admin_role_aal2(array['owner','admin','financeiro']) or length(trim(p_resolution))<20 then raise exception 'forbidden or insufficient resolution'; end if;
 update financial_cases set status='resolved',resolution=left(p_resolution,2000),resolved_at=now() where id=p_id and status='open';
 if not found then return false; end if;
 insert into audit_logs(actor_email,action,entity_type,entity_id,payload)
 values(lower(auth.jwt()->>'email'),'resolve_financial_case','financial_case',p_id::text,jsonb_build_object('resolution',left(p_resolution,2000)));
 return true;
end $$;
revoke all on function admin_resolve_financial_case(uuid,text) from public,anon;
grant execute on function admin_resolve_financial_case(uuid,text) to authenticated;

create or replace function public.admin_financial_cases() returns jsonb
language plpgsql security definer set search_path=public as $$
declare result jsonb;
begin
 if not has_admin_role(array['owner','admin','financeiro','auditor']) then raise exception 'forbidden'; end if;
 select coalesce(jsonb_agg(to_jsonb(x)),'[]') into result from (
 select fc.*,o.payment_reference,o.amount_cents,o.provider_payment_id,c.name campaign_name
 from financial_cases fc join orders o on o.id=fc.order_id join campaigns c on c.id=o.campaign_id
 order by (fc.status='open') desc,fc.created_at desc limit 200
 ) x;
 return result;
end $$;
revoke all on function admin_financial_cases() from public,anon;
grant execute on function admin_financial_cases() to authenticated;

CREATE OR REPLACE FUNCTION public.public_order(p_token uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
    'buyer_name','Comprador','campaign_name',c.name,'campaign_slug',c.slug,
    'seller_name',s.name,'seller_whatsapp',s.whatsapp,'pix_key',c.pix_key,'pix_receiver',c.pix_receiver,'pix_city',c.pix_city,
    'proof_status',o.proof_status,'proof_uploaded_at',o.proof_uploaded_at,
    'payment_provider',o.payment_provider,'provider_qr_payload',o.provider_qr_payload,
    'provider_payment_id',o.provider_payment_id,'provider_status',o.provider_status,
    'provider_paid_at',o.provider_paid_at,'provider_net_value_cents',o.provider_net_value_cents,
    'pix_transaction_id',o.pix_transaction_id,
    'numbers',coalesce((select jsonb_agg(number order by number) from raffle_numbers where order_id=o.id),'[]'::jsonb)
  );
end $function$
;
