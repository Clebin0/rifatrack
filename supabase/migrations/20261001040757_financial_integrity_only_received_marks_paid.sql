-- Recovered verbatim from Supabase migration history; 20261001040757.

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
    update payment_events set processing_note='order_not_found'
    where provider='asaas' and provider_event_id=p_event_id;
    return jsonb_build_object('ok',true,'matched',false);
  end if;

  update orders
  set provider_payment_id=coalesce(provider_payment_id,p_payment_id),
      provider_event_id=p_event_id,
      provider_status=coalesce(p_payment_status,p_event_type),
      pix_transaction_id=coalesce(pix_transaction_id,p_pix_transaction_id)
  where id=o.id;

  if p_event_type='PAYMENT_RECEIVED' then
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
  elsif p_event_type='PAYMENT_CONFIRMED' then
    note:='confirmed_awaiting_received';
    update orders set provider_status='CONFIRMED_AWAITING_RECEIVED' where id=o.id and status='pending';
  elsif p_event_type in ('PAYMENT_REFUNDED','PAYMENT_CHARGEBACK_REQUESTED','PAYMENT_CHARGEBACK_DISPUTE') then
    update orders set provider_status=p_event_type where id=o.id;
    note:='provider_alert';
    insert into audit_logs(actor_email,action,entity_type,entity_id,payload)
    values('asaas-webhook','payment_alert','order',o.id::text,
      jsonb_build_object('event_id',p_event_id,'event_type',p_event_type,'payment_id',p_payment_id));
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


