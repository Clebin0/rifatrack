-- Recovered verbatim from Supabase migration history; 20261005012508.

create or replace function public.admin_import_paid_numbers(
  p_campaign_id uuid,
  p_seller_id uuid default null,
  p_buyer_name text default '',
  p_buyer_phone text default '',
  p_buyer_email text default '',
  p_numbers integer[] default '{}'::integer[],
  p_sales_channel text default 'whatsapp',
  p_paid_at timestamptz default now(),
  p_note text default ''
) returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  c campaigns; s sellers; o orders; wanted integer; locked_available integer; requires_seller boolean;
  actual_paid_at timestamptz:=coalesce(p_paid_at,now());
begin
  if not public.admin_role_aal2(array['owner','admin','financeiro']) then raise exception 'mfa_required'; end if;
  if p_sales_channel not in ('whatsapp','presencial','outro') then raise exception 'invalid sales channel'; end if;
  wanted:=coalesce(array_length(p_numbers,1),0);
  if wanted<1 or wanted>500 then raise exception 'invalid quantity'; end if;
  if (select count(distinct x) from unnest(p_numbers)x)<>wanted then raise exception 'duplicate number'; end if;
  if actual_paid_at>now()+interval '5 minutes' then raise exception 'invalid paid_at'; end if;
  if length(coalesce(p_buyer_name,''))>100 or length(coalesce(p_buyer_phone,''))>20 or length(coalesce(p_buyer_email,''))>180 then raise exception 'invalid buyer data'; end if;
  if coalesce(p_buyer_email,'')<>'' and p_buyer_email !~* '^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$' then raise exception 'invalid email'; end if;
  if length(coalesce(p_note,''))>500 then raise exception 'note too long'; end if;
  select * into c from campaigns where id=p_campaign_id for update;
  if not found then raise exception 'campaign not found'; end if;
  if c.finalized_at is not null or c.status='closed' then raise exception 'campaign finalized'; end if;
  perform release_expired_reservations(c.id);
  if exists(select 1 from unnest(p_numbers)x where x<1 or x>c.total_numbers) then raise exception 'invalid number'; end if;
  select exists(select 1 from campaign_sellers cs join sellers se on se.id=cs.seller_id where cs.campaign_id=c.id and cs.active=true and se.active=true) into requires_seller;
  if p_seller_id is not null then
    select se.* into s from sellers se join campaign_sellers cs on cs.seller_id=se.id
    where cs.campaign_id=c.id and cs.seller_id=p_seller_id and cs.active=true and se.active=true;
    if not found then raise exception 'seller unavailable'; end if;
  elsif requires_seller then raise exception 'seller required'; end if;
  select count(*) into locked_available from (
    select id,status from raffle_numbers where campaign_id=c.id and number=any(p_numbers) for update
  ) q where q.status='available';
  if locked_available<>wanted then raise exception 'number unavailable'; end if;
  insert into orders(campaign_id,seller_id,buyer_name,buyer_phone,buyer_email,status,amount_cents,expires_at,payment_reference,pix_txid,payment_provider,provider_status,provider_paid_at,sales_channel,manual_note)
  values(c.id,s.id,left(coalesce(nullif(trim(p_buyer_name),''),'Venda manual'),100),left(coalesce(trim(p_buyer_phone),''),20),left(lower(coalesce(trim(p_buyer_email),'')),180),'paid',wanted*c.price_cents,actual_paid_at,
    'MAN-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,10)),'MAN'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,23)),
    'manual','MANUAL_IMPORTED',actual_paid_at,p_sales_channel,left(coalesce(p_note,''),500))
  returning * into o;
  update raffle_numbers set order_id=o.id,status='paid',reserved_until=null
  where campaign_id=c.id and number=any(p_numbers) and status='available';
  insert into audit_logs(actor_email,action,entity_type,entity_id,payload)
  values(lower(auth.jwt()->>'email'),'manual_paid_numbers_import','order',o.id::text,
    jsonb_build_object('campaign_id',c.id,'seller_id',s.id,'sales_channel',p_sales_channel,'paid_at',actual_paid_at,'numbers',to_jsonb(p_numbers),'amount_cents',o.amount_cents,'note',left(coalesce(p_note,''),500)));
  return jsonb_build_object('id',o.id,'public_token',o.public_token,'payment_reference',o.payment_reference,'amount_cents',o.amount_cents,'numbers',to_jsonb(p_numbers),'seller_name',s.name,'sales_channel',p_sales_channel,'paid_at',actual_paid_at);
end $$;


