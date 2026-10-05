-- Reconcile already-paid numbers sold outside RifaTrack (WhatsApp/presential).
-- Applied to Supabase on 2026-10-05.

alter table public.orders
  add column if not exists sales_channel text not null default 'online',
  add column if not exists manual_note text;

do $$ begin
  alter table public.orders add constraint orders_sales_channel_check
    check (sales_channel in ('online','whatsapp','presencial','outro'));
exception when duplicate_object then null; end $$;

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
language plpgsql security definer set search_path=public as $$
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

  select exists(
    select 1 from campaign_sellers cs
    join sellers se on se.id=cs.seller_id
    where cs.campaign_id=c.id and cs.active=true and se.active=true
  ) into requires_seller;

  if p_seller_id is not null then
    select se.* into s from sellers se
    join campaign_sellers cs on cs.seller_id=se.id
    where cs.campaign_id=c.id and cs.seller_id=p_seller_id and cs.active=true and se.active=true;
    if not found then raise exception 'seller unavailable'; end if;
  elsif requires_seller then
    raise exception 'seller required';
  end if;

  select count(*) into locked_available from (
    select id,status from raffle_numbers
    where campaign_id=c.id and number=any(p_numbers)
    for update
  ) q where q.status='available';
  if locked_available<>wanted then raise exception 'number unavailable'; end if;

  insert into orders(
    campaign_id,seller_id,buyer_name,buyer_phone,buyer_email,status,amount_cents,expires_at,
    payment_reference,pix_txid,payment_provider,provider_status,provider_paid_at,sales_channel,manual_note
  ) values(
    c.id,s.id,left(coalesce(nullif(trim(p_buyer_name),''),'Venda manual'),100),
    left(coalesce(trim(p_buyer_phone),''),20),left(lower(coalesce(trim(p_buyer_email),'')),180),
    'paid',wanted*c.price_cents,actual_paid_at,
    'MAN-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,10)),
    'MAN'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,23)),
    'manual','MANUAL_IMPORTED',actual_paid_at,p_sales_channel,left(coalesce(p_note,''),500)
  ) returning * into o;

  update raffle_numbers
  set order_id=o.id,status='paid',reserved_until=null
  where campaign_id=c.id and number=any(p_numbers) and status='available';

  insert into audit_logs(actor_email,action,entity_type,entity_id,payload)
  values(lower(auth.jwt()->>'email'),'manual_paid_numbers_import','order',o.id::text,
    jsonb_build_object('campaign_id',c.id,'seller_id',s.id,'sales_channel',p_sales_channel,
      'paid_at',actual_paid_at,'numbers',to_jsonb(p_numbers),'amount_cents',o.amount_cents,
      'note',left(coalesce(p_note,''),500)));

  return jsonb_build_object('id',o.id,'public_token',o.public_token,'payment_reference',o.payment_reference,
    'amount_cents',o.amount_cents,'numbers',to_jsonb(p_numbers),'seller_name',s.name,
    'sales_channel',p_sales_channel,'paid_at',actual_paid_at);
end $$;

revoke all on function public.admin_import_paid_numbers(uuid,uuid,text,text,text,integer[],text,timestamptz,text) from public,anon;
grant execute on function public.admin_import_paid_numbers(uuid,uuid,text,text,text,integer[],text,timestamptz,text) to authenticated;

create or replace function public.admin_orders_page(
  p_page integer default 1,p_page_size integer default 25,p_search text default '',p_status text default '',
  p_campaign_id uuid default null,p_seller_id uuid default null,p_from timestamptz default null,p_to timestamptz default null
) returns jsonb language plpgsql security definer set search_path=public as $$
declare v_page integer:=greatest(coalesce(p_page,1),1); v_size integer:=least(greatest(coalesce(p_page_size,25),1),100);
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  perform release_expired_reservations(null);
  return jsonb_build_object(
    'page',v_page,'page_size',v_size,
    'total',(select count(*) from orders o join campaigns c on c.id=o.campaign_id left join sellers s on s.id=o.seller_id
      where (coalesce(p_status,'')='' or o.status=p_status)
        and (p_campaign_id is null or o.campaign_id=p_campaign_id)
        and (p_seller_id is null or o.seller_id=p_seller_id)
        and (p_from is null or o.created_at>=p_from) and (p_to is null or o.created_at<p_to)
        and (coalesce(trim(p_search),'')='' or o.buyer_name ilike '%'||trim(p_search)||'%' or o.buyer_phone ilike '%'||trim(p_search)||'%'
          or o.buyer_email ilike '%'||trim(p_search)||'%' or o.payment_reference ilike '%'||trim(p_search)||'%'
          or coalesce(s.name,'') ilike '%'||trim(p_search)||'%' or coalesce(o.provider_payment_id,'') ilike '%'||trim(p_search)||'%')),
    'orders',coalesce((select jsonb_agg(to_jsonb(x) order by x.created_at desc) from (
      select o.id,o.public_token,o.buyer_name,o.buyer_phone,o.buyer_email,o.status,o.amount_cents,o.payment_reference,
        o.expires_at,o.created_at,o.proof_path,o.proof_status,o.payment_provider,o.provider_payment_id,o.provider_status,
        o.provider_paid_at,o.provider_net_value_cents,o.pix_transaction_id,o.sales_channel,o.manual_note,
        c.id campaign_id,c.name campaign_name,c.slug campaign_slug,s.id seller_id,s.name seller_name,
        coalesce((select jsonb_agg(rn.number order by rn.number) from raffle_numbers rn where rn.order_id=o.id),'[]'::jsonb) numbers
      from orders o join campaigns c on c.id=o.campaign_id left join sellers s on s.id=o.seller_id
      where (coalesce(p_status,'')='' or o.status=p_status)
        and (p_campaign_id is null or o.campaign_id=p_campaign_id)
        and (p_seller_id is null or o.seller_id=p_seller_id)
        and (p_from is null or o.created_at>=p_from) and (p_to is null or o.created_at<p_to)
        and (coalesce(trim(p_search),'')='' or o.buyer_name ilike '%'||trim(p_search)||'%' or o.buyer_phone ilike '%'||trim(p_search)||'%'
          or o.buyer_email ilike '%'||trim(p_search)||'%' or o.payment_reference ilike '%'||trim(p_search)||'%'
          or coalesce(s.name,'') ilike '%'||trim(p_search)||'%' or coalesce(o.provider_payment_id,'') ilike '%'||trim(p_search)||'%')
      order by o.created_at desc limit v_size offset ((v_page-1)*v_size)
    ) x),'[]'::jsonb)
  );
end $$;
