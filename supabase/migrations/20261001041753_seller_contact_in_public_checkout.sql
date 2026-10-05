-- Recovered verbatim from Supabase migration history; 20261001041753.

create or replace function public.public_campaign(p_slug text,p_seller_code text default null)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  c campaigns;
  seller_name text;
  seller_whatsapp text;
  draw_json jsonb;
begin
  if p_slug !~ '^[a-z0-9-]{2,80}$' then return null; end if;
  select * into c from campaigns where slug=p_slug and status in ('active','closed');
  if not found then return null; end if;

  if c.status='active' then perform release_expired_reservations(c.id); end if;

  if p_seller_code is not null and p_seller_code<>'' then
    select s.name,s.whatsapp into seller_name,seller_whatsapp
    from sellers s join campaign_sellers cs on cs.seller_id=s.id
    where cs.campaign_id=c.id and cs.active=true and s.active=true and s.code=upper(p_seller_code);
  end if;

  select case when d.id is null then null else jsonb_build_object('number',d.number,'drawn_at',d.drawn_at) end
  into draw_json from (select 1) x left join draws d on d.campaign_id=c.id;

  return jsonb_build_object(
    'id',c.id,'name',c.name,'slug',c.slug,'description',c.description,
    'status',c.status,'price_cents',c.price_cents,'total_numbers',c.total_numbers,
    'pix_key',c.pix_key,'pix_receiver',c.pix_receiver,'pix_city',c.pix_city,'ends_at',c.ends_at,
    'seller_name',seller_name,'seller_whatsapp',seller_whatsapp,'draw_result',draw_json,
    'sellers',coalesce((
      select jsonb_agg(jsonb_build_object('name',s.name,'code',s.code,'team',s.team,'whatsapp',s.whatsapp) order by s.name)
      from sellers s join campaign_sellers cs on cs.seller_id=s.id
      where cs.campaign_id=c.id and cs.active=true and s.active=true
    ),'[]'::jsonb),
    'unavailable',coalesce((select jsonb_agg(number order by number) from raffle_numbers where campaign_id=c.id and status<>'available'),'[]'::jsonb),
    'sold_numbers',(select count(*) from raffle_numbers where campaign_id=c.id and status='paid'),
    'reserved_numbers',(select count(*) from raffle_numbers where campaign_id=c.id and status='reserved')
  );
end $$;
revoke all on function public.public_campaign(text,text) from public;
grant execute on function public.public_campaign(text,text) to anon,authenticated,service_role;

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
    'seller_name',s.name,'seller_whatsapp',s.whatsapp,'pix_key',c.pix_key,'pix_receiver',c.pix_receiver,'pix_city',c.pix_city,
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


