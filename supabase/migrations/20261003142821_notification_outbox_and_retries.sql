-- Recovered verbatim from Supabase migration history; 20261003142821.

create table if not exists public.notification_outbox(
  id uuid primary key default gen_random_uuid(),
  channel text not null default 'email' check(channel in ('email')),
  recipient text not null,
  template text not null check(template in ('order_reserved','payment_received','reservation_expired','seller_sale')),
  order_id uuid references public.orders(id) on delete cascade,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'pending' check(status in ('pending','processing','sent','failed')),
  attempts integer not null default 0,
  next_attempt_at timestamptz not null default now(),
  last_error text,
  dedupe_key text not null unique,
  created_at timestamptz not null default now(),
  sent_at timestamptz
);
alter table public.notification_outbox enable row level security;
revoke all on public.notification_outbox from anon,authenticated;
drop policy if exists deny_notification_outbox_anon on public.notification_outbox;
create policy deny_notification_outbox_anon on public.notification_outbox for all to anon using(false) with check(false);
drop policy if exists deny_notification_outbox_auth on public.notification_outbox;
create policy deny_notification_outbox_auth on public.notification_outbox for all to authenticated using(false) with check(false);
create index if not exists notification_outbox_status_idx on public.notification_outbox(status,next_attempt_at);

create or replace function public.enqueue_order_notification_internal(p_internal_secret text,p_order_id uuid,p_event text)
returns integer language plpgsql security definer set search_path=public as $$
declare o orders; c campaigns; s sellers; seller_mail text; inserted_count integer:=0; buyer_template text;
begin
  if not internal_secret_ok(p_internal_secret) then raise exception 'unauthorized'; end if;
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
revoke all on function public.enqueue_order_notification_internal(text,uuid,text) from public,authenticated;
grant execute on function public.enqueue_order_notification_internal(text,uuid,text) to anon,service_role;

create or replace function public.claim_notification_batch_internal(p_internal_secret text,p_limit integer default 10)
returns jsonb language plpgsql security definer set search_path=public as $$
declare result jsonb;
begin
  if not internal_secret_ok(p_internal_secret) then raise exception 'unauthorized'; end if;
  with picked as (
    select id from notification_outbox
    where status in ('pending','failed') and attempts<5 and next_attempt_at<=now()
    order by created_at
    limit least(greatest(coalesce(p_limit,10),1),50)
    for update skip locked
  ), upd as (
    update notification_outbox n
    set status='processing',attempts=attempts+1
    from picked p where n.id=p.id
    returning n.*
  )
  select coalesce(jsonb_agg(to_jsonb(upd)),'[]'::jsonb) into result from upd;
  return result;
end $$;
revoke all on function public.claim_notification_batch_internal(text,integer) from public,authenticated;
grant execute on function public.claim_notification_batch_internal(text,integer) to anon,service_role;

create or replace function public.finish_notification_internal(p_internal_secret text,p_id uuid,p_ok boolean,p_error text default null)
returns boolean language plpgsql security definer set search_path=public as $$
begin
  if not internal_secret_ok(p_internal_secret) then raise exception 'unauthorized'; end if;
  update notification_outbox
  set status=case when p_ok then 'sent' else 'failed' end,
      sent_at=case when p_ok then now() else sent_at end,
      last_error=case when p_ok then null else left(coalesce(p_error,'unknown'),500) end,
      next_attempt_at=case when p_ok then next_attempt_at else now()+make_interval(mins=>least(60,greatest(2,attempts*5))) end
  where id=p_id;
  return found;
end $$;
revoke all on function public.finish_notification_internal(text,uuid,boolean,text) from public,authenticated;
grant execute on function public.finish_notification_internal(text,uuid,boolean,text) to anon,service_role;

create or replace function public.admin_notification_dashboard()
returns jsonb language plpgsql security definer set search_path=public as $$
begin
  if not public.has_admin_role(array['owner','admin','operador','financeiro','auditor']) then raise exception 'forbidden'; end if;
  return jsonb_build_object(
    'summary',jsonb_build_object(
      'pending',(select count(*) from notification_outbox where status='pending'),
      'failed',(select count(*) from notification_outbox where status='failed'),
      'sent',(select count(*) from notification_outbox where status='sent'),
      'processing',(select count(*) from notification_outbox where status='processing')
    ),
    'items',coalesce((select jsonb_agg(to_jsonb(x) order by created_at desc) from (
      select id,recipient,template,status,attempts,last_error,created_at,sent_at,next_attempt_at
      from notification_outbox order by created_at desc limit 250
    ) x),'[]'::jsonb)
  );
end $$;
revoke all on function public.admin_notification_dashboard() from public,anon;
grant execute on function public.admin_notification_dashboard() to authenticated;


