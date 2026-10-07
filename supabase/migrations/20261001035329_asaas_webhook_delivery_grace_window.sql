-- Recovered verbatim from Supabase migration history; 20261001035329.

create or replace function public.release_expired_reservations(p_campaign_id uuid default null)
returns void language plpgsql security definer set search_path=public as $$
begin
  update orders
  set status='expired',
      provider_status=case when payment_provider='asaas' and provider_status is null then 'EXPIRED' else provider_status end
  where status='pending'
    and (
      (payment_provider='asaas' and expires_at + interval '2 minutes' < now())
      or
      (payment_provider<>'asaas' and expires_at < now())
    )
    and (p_campaign_id is null or campaign_id=p_campaign_id);

  update raffle_numbers rn
  set status='available',order_id=null,reserved_until=null
  where rn.status='reserved'
    and rn.reserved_until < now()
    and (p_campaign_id is null or rn.campaign_id=p_campaign_id)
    and not exists(
      select 1 from orders o
      where o.id=rn.order_id
        and o.status='pending'
        and o.payment_provider='asaas'
        and o.expires_at + interval '2 minutes' >= now()
    );
end $$;

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
declare v_exp timestamptz;
begin
  if not internal_secret_ok(p_internal_secret) then raise exception 'unauthorized'; end if;
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
end $$;

revoke all on function public.attach_asaas_qr(text,uuid,text,text) from public,authenticated;
grant execute on function public.attach_asaas_qr(text,uuid,text,text) to anon,service_role;


