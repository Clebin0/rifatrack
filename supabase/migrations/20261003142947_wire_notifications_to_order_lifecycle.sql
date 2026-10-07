-- Recovered verbatim from Supabase migration history; 20261003142947.

create schema if not exists private;
revoke all on schema private from public,anon,authenticated;

create or replace function private.queue_order_notifications(p_order_id uuid,p_event text)
returns integer language plpgsql security definer set search_path=public,private as $$
declare o orders; c campaigns; s sellers; seller_mail text; inserted_count integer:=0; buyer_template text;
begin
  if p_event not in ('reserved','paid','expired') then raise exception 'invalid event'; end if;
  select * into o from orders where id=p_order_id;
  if not found then return 0; end if;
  select * into c from campaigns where id=o.campaign_id;
  if o.seller_id is not null then select * into s from sellers where id=o.seller_id; end if;
  buyer_template:=case p_event when 'reserved' then 'order_reserved' when 'paid' then 'payment_received' else 'reservation_expired' end;

  if coalesce(o.buyer_email,'')<>'' then
    insert into notification_outbox(recipient,template,order_id,payload,dedupe_key)
    values(lower(o.buyer_email),buyer_template,o.id,
      jsonb_build_object('buyer_name',o.buyer_name,'campaign_name',c.name,'campaign_slug',c.slug,'payment_reference',o.payment_reference,
        'seller_name',s.name,'amount_cents',o.amount_cents,'public_token',o.public_token,'expires_at',o.expires_at,
        'provider_payment_id',o.provider_payment_id,
        'numbers',coalesce((select jsonb_agg(number order by number) from raffle_numbers where order_id=o.id),'[]'::jsonb)),
      o.id::text||':'||buyer_template||':buyer')
    on conflict(dedupe_key) do nothing;
    if found then inserted_count:=inserted_count+1; end if;
  end if;

  if p_event='paid' and o.seller_id is not null then
    select sa.email into seller_mail from seller_accounts sa where sa.seller_id=o.seller_id and sa.active=true limit 1;
    if coalesce(seller_mail,'')<>'' then
      insert into notification_outbox(recipient,template,order_id,payload,dedupe_key)
      values(lower(seller_mail),'seller_sale',o.id,
        jsonb_build_object('seller_name',s.name,'buyer_name',o.buyer_name,'campaign_name',c.name,'payment_reference',o.payment_reference,
          'amount_cents',o.amount_cents,'numbers',coalesce((select jsonb_agg(number order by number) from raffle_numbers where order_id=o.id),'[]'::jsonb)),
        o.id::text||':seller_sale:'||lower(seller_mail))
      on conflict(dedupe_key) do nothing;
      if found then inserted_count:=inserted_count+1; end if;
    end if;
  end if;
  return inserted_count;
end $$;

create or replace function public.enqueue_order_notification_internal(p_internal_secret text,p_order_id uuid,p_event text)
returns integer language plpgsql security definer set search_path=public,private as $$
begin
  if not internal_secret_ok(p_internal_secret) then raise exception 'unauthorized'; end if;
  return private.queue_order_notifications(p_order_id,p_event);
end $$;

create or replace function public.release_expired_reservations(p_campaign_id uuid default null)
returns void language plpgsql security definer set search_path=public,private as $$
declare rec record;
begin
  for rec in
    select id from orders
    where status='pending'
      and (
        (payment_provider='asaas' and expires_at+interval '2 minutes'<now())
        or (payment_provider<>'asaas' and expires_at<now())
      )
      and (p_campaign_id is null or campaign_id=p_campaign_id)
    for update skip locked
  loop
    update orders set status='expired',
      provider_status=case when payment_provider='asaas' and provider_status is null then 'EXPIRED' else provider_status end
    where id=rec.id;
    perform private.queue_order_notifications(rec.id,'expired');
  end loop;

  update raffle_numbers rn
  set status='available',order_id=null,reserved_until=null
  where rn.status='reserved'
    and rn.reserved_until<now()
    and (p_campaign_id is null or rn.campaign_id=p_campaign_id)
    and not exists(
      select 1 from orders o where o.id=rn.order_id and o.status='pending'
        and o.payment_provider='asaas' and o.expires_at+interval '2 minutes'>=now()
    );
end $$;

create or replace function public.process_asaas_event(
  p_internal_secret text,p_event_id text,p_event_type text,p_payment_id text,p_qr_id text,p_payment_status text,
  p_value_cents integer,p_net_value_cents integer,p_paid_at timestamptz,p_pix_transaction_id text,p_payload jsonb
) returns jsonb language plpgsql security definer set search_path=public,private as $$
declare o orders; already boolean:=false; note text:='';
begin
  if not internal_secret_ok(p_internal_secret) then raise exception 'unauthorized'; end if;
  if length(coalesce(p_event_id,''))<3 then raise exception 'invalid event'; end if;
  begin
    insert into payment_events(provider,provider_event_id,event_type,provider_payment_id,provider_qr_id,payload)
    values('asaas',p_event_id,p_event_type,p_payment_id,p_qr_id,coalesce(p_payload,'{}'::jsonb));
  exception when unique_violation then already:=true; end;
  if already then return jsonb_build_object('ok',true,'duplicate',true); end if;

  select * into o from orders
  where provider_qr_id=p_qr_id or (p_payment_id is not null and provider_payment_id=p_payment_id)
  order by created_at desc limit 1 for update;

  if not found then
    update payment_events set processing_note='order_not_found' where provider='asaas' and provider_event_id=p_event_id;
    return jsonb_build_object('ok',true,'matched',false);
  end if;

  update orders set provider_payment_id=coalesce(provider_payment_id,p_payment_id),provider_event_id=p_event_id,
    provider_status=coalesce(p_payment_status,p_event_type),pix_transaction_id=coalesce(pix_transaction_id,p_pix_transaction_id)
  where id=o.id;

  if p_event_type='PAYMENT_RECEIVED' then
    if p_value_cents is null or p_value_cents<>o.amount_cents then
      note:='amount_mismatch';update orders set provider_status='AMOUNT_MISMATCH' where id=o.id;
    elsif o.status='paid' then note:='already_paid';
    elsif o.status<>'pending' then note:='late_or_cancelled_payment';update orders set provider_status='PAYMENT_RECEIVED_AFTER_LOCAL_CLOSE' where id=o.id;
    elsif not exists(select 1 from raffle_numbers where order_id=o.id and status='reserved') then
      note:='numbers_not_reserved';update orders set provider_status='PAYMENT_REVIEW_REQUIRED' where id=o.id;
    else
      update orders set status='paid',provider_status='RECEIVED',provider_paid_at=coalesce(p_paid_at,now()),
        provider_net_value_cents=p_net_value_cents,proof_status=case when proof_status='submitted' then 'approved' else proof_status end
      where id=o.id;
      update raffle_numbers set status='paid',reserved_until=null where order_id=o.id and status='reserved';
      note:='paid';
      perform private.queue_order_notifications(o.id,'paid');
      insert into audit_logs(actor_email,action,entity_type,entity_id,payload)
      values('asaas-webhook','auto_payment','order',o.id::text,jsonb_build_object('event_id',p_event_id,'payment_id',p_payment_id,'value_cents',p_value_cents));
    end if;
  elsif p_event_type='PAYMENT_CONFIRMED' then
    note:='confirmed_awaiting_received';update orders set provider_status='CONFIRMED_AWAITING_RECEIVED' where id=o.id and status='pending';
  elsif p_event_type in ('PAYMENT_REFUNDED','PAYMENT_CHARGEBACK_REQUESTED','PAYMENT_CHARGEBACK_DISPUTE') then
    update orders set provider_status=p_event_type where id=o.id;note:='provider_alert';
    insert into audit_logs(actor_email,action,entity_type,entity_id,payload)
    values('asaas-webhook','payment_alert','order',o.id::text,jsonb_build_object('event_id',p_event_id,'event_type',p_event_type,'payment_id',p_payment_id));
  else note:='status_updated'; end if;

  update payment_events set processed=true,processing_note=note where provider='asaas' and provider_event_id=p_event_id;
  return jsonb_build_object('ok',true,'matched',true,'order_id',o.id,'note',note);
end $$;

create or replace function public.admin_set_order_status(p_order_id uuid,p_status text)
returns boolean language plpgsql security definer set search_path=public,private as $$
declare o orders;
begin
  if not public.admin_role_aal2(array['owner','admin','financeiro']) or p_status not in('paid','cancelled') then raise exception 'forbidden'; end if;
  select * into o from orders where id=p_order_id for update;
  if not found then return false; end if;
  if p_status='paid' then
    if o.status='paid' then return true; end if;
    if o.status<>'pending' or o.expires_at<now() then raise exception 'order unavailable'; end if;
    update orders set status='paid',provider_paid_at=coalesce(provider_paid_at,now()),
      provider_status=case when payment_provider='manual' then 'MANUAL_CONFIRMED' else coalesce(provider_status,'ADMIN_CONFIRMED') end,
      proof_status=case when proof_status='submitted' then 'approved' else proof_status end where id=o.id;
    update raffle_numbers set status='paid',reserved_until=null where order_id=o.id;
    perform private.queue_order_notifications(o.id,'paid');
  else
    if o.status='paid' then raise exception 'paid order cannot be cancelled'; end if;
    update orders set status='cancelled',provider_status=case when payment_provider='manual' then 'MANUAL_CANCELLED' else coalesce(provider_status,'ADMIN_CANCELLED') end where id=o.id;
    update raffle_numbers set status='available',order_id=null,reserved_until=null where order_id=o.id and status='reserved';
  end if;
  insert into audit_logs(actor_email,action,entity_type,entity_id,payload)
  values(lower(auth.jwt()->>'email'),'status','order',o.id::text,jsonb_build_object('status',p_status,'role',current_admin_role()));
  return true;
end $$;


