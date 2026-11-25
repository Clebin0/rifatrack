create table if not exists public.campaign_update_subscribers (
  id uuid primary key default gen_random_uuid(),
  campaign_key text not null check (campaign_key = 'natal'),
  email text not null check (
    email = lower(btrim(email))
    and length(email) <= 254
    and email ~* '^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$'
  ),
  consented_at timestamptz not null default now(),
  unsubscribe_token uuid not null unique default gen_random_uuid(),
  unsubscribed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (campaign_key, email)
);

alter table public.campaign_update_subscribers enable row level security;
revoke all on public.campaign_update_subscribers from public, anon, authenticated;
grant all on public.campaign_update_subscribers to service_role;
create index if not exists campaign_update_subscribers_active_idx
  on public.campaign_update_subscribers (campaign_key, created_at)
  where unsubscribed_at is null;

alter table public.notification_outbox
  drop constraint if exists notification_outbox_template_check;
alter table public.notification_outbox
  add constraint notification_outbox_template_check
  check (template in ('order_reserved', 'payment_received', 'reservation_expired', 'seller_sale', 'campaign_announcement'));

create or replace function public.enqueue_christmas_campaign_announcement()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status <> 'active'
    or (tg_op = 'UPDATE' and old.status = 'active')
    or (lower(coalesce(new.slug, '')) not like '%natal%'
      and lower(coalesce(new.name, '')) not like '%natal%') then
    return new;
  end if;

  insert into public.notification_outbox (
    recipient,
    template,
    order_id,
    payload,
    dedupe_key
  )
  select
    subscriber.email,
    'campaign_announcement',
    null,
    jsonb_build_object(
      'campaign_name', new.name,
      'campaign_slug', new.slug,
      'campaign_description', coalesce(new.description, ''),
      'unsubscribe_token', subscriber.unsubscribe_token
    ),
    'campaign_announcement:' || new.id::text || ':' || subscriber.id::text
  from public.campaign_update_subscribers as subscriber
  where subscriber.campaign_key = 'natal'
    and subscriber.unsubscribed_at is null
  on conflict (dedupe_key) do nothing;

  return new;
end;
$$;

revoke all on function public.enqueue_christmas_campaign_announcement() from public, anon, authenticated;
grant execute on function public.enqueue_christmas_campaign_announcement() to service_role;

drop trigger if exists enqueue_christmas_campaign_announcement on public.campaigns;
create trigger enqueue_christmas_campaign_announcement
  after insert or update of status on public.campaigns
  for each row execute function public.enqueue_christmas_campaign_announcement();

create or replace function public.enqueue_christmas_announcement_for_subscriber()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.unsubscribed_at is not null then
    return new;
  end if;

  insert into public.notification_outbox (
    recipient,
    template,
    order_id,
    payload,
    dedupe_key
  )
  select
    new.email,
    'campaign_announcement',
    null,
    jsonb_build_object(
      'campaign_name', campaign.name,
      'campaign_slug', campaign.slug,
      'campaign_description', coalesce(campaign.description, ''),
      'unsubscribe_token', new.unsubscribe_token
    ),
    'campaign_announcement:' || campaign.id::text || ':' || new.id::text
  from public.campaigns as campaign
  where campaign.status = 'active'
    and (lower(coalesce(campaign.slug, '')) like '%natal%'
      or lower(coalesce(campaign.name, '')) like '%natal%')
  on conflict (dedupe_key) do nothing;

  return new;
end;
$$;

revoke all on function public.enqueue_christmas_announcement_for_subscriber() from public, anon, authenticated;
grant execute on function public.enqueue_christmas_announcement_for_subscriber() to service_role;

drop trigger if exists enqueue_christmas_announcement_for_subscriber on public.campaign_update_subscribers;
create trigger enqueue_christmas_announcement_for_subscriber
  after insert or update of consented_at, unsubscribed_at on public.campaign_update_subscribers
  for each row execute function public.enqueue_christmas_announcement_for_subscriber();

create or replace function public.admin_backup_counts()
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if not public.admin_role_aal2(array['owner']) then raise exception 'owner_mfa_required'; end if;
  return jsonb_build_object(
    'campaigns',(select count(*) from campaigns),
    'sellers',(select count(*) from sellers),
    'campaign_sellers',(select count(*) from campaign_sellers),
    'orders',(select count(*) from orders),
    'order_payer_declarations',(select count(*) from order_payer_declarations),
    'raffle_numbers',(select count(*) from raffle_numbers),
    'draws',(select count(*) from draws),
    'draw_commitments',(select count(*) from draw_commitments),
    'admin_users',(select count(*) from admin_users),
    'audit_logs',(select count(*) from audit_logs),
    'payment_events',(select count(*) from payment_events),
    'financial_cases',(select count(*) from financial_cases),
    'notification_outbox',(select count(*) from notification_outbox),
    'campaign_update_subscribers',(select count(*) from campaign_update_subscribers)
  );
end $$;

create or replace function public.admin_backup_chunk(p_entity text, p_offset integer default 0, p_limit integer default 2000)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare lim integer:=least(greatest(coalesce(p_limit,2000),1),5000); off integer:=greatest(coalesce(p_offset,0),0); result jsonb;
begin
  if not public.admin_role_aal2(array['owner']) then raise exception 'owner_mfa_required'; end if;
  case p_entity
    when 'campaigns' then select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) into result from (select * from campaigns order by created_at,id limit lim offset off) x;
    when 'sellers' then select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) into result from (select * from sellers order by created_at,id limit lim offset off) x;
    when 'campaign_sellers' then select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) into result from (select * from campaign_sellers order by campaign_id,seller_id limit lim offset off) x;
    when 'orders' then select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) into result from (select * from orders order by created_at,id limit lim offset off) x;
    when 'order_payer_declarations' then select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) into result from (select * from order_payer_declarations order by updated_at,order_id limit lim offset off) x;
    when 'raffle_numbers' then select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) into result from (select * from raffle_numbers order by campaign_id,number limit lim offset off) x;
    when 'draws' then select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) into result from (select * from draws order by drawn_at,id limit lim offset off) x;
    when 'draw_commitments' then select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) into result from (select * from draw_commitments order by created_at,campaign_id limit lim offset off) x;
    when 'admin_users' then select coalesce(jsonb_agg(jsonb_build_object('email',email,'role',role,'active',active,'created_at',created_at,'updated_at',updated_at)),'[]'::jsonb) into result from (select * from admin_users order by created_at,email limit lim offset off) a;
    when 'audit_logs' then select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) into result from (select * from audit_logs order by created_at,id limit lim offset off) x;
    when 'payment_events' then select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) into result from (select * from payment_events order by created_at,id limit lim offset off) x;
    when 'financial_cases' then select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) into result from (select * from financial_cases order by created_at,id limit lim offset off) x;
    when 'notification_outbox' then select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) into result from (select * from notification_outbox order by created_at,id limit lim offset off) x;
    when 'campaign_update_subscribers' then select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) into result from (select * from campaign_update_subscribers order by created_at,id limit lim offset off) x;
    else raise exception 'unsupported backup entity';
  end case;
  return result;
end $$;

revoke all on function public.admin_backup_counts() from public, anon;
revoke all on function public.admin_backup_chunk(text,integer,integer) from public, anon;
grant execute on function public.admin_backup_counts() to authenticated;
grant execute on function public.admin_backup_chunk(text,integer,integer) to authenticated;

create or replace function public.admin_notification_dashboard()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.admin_role_aal2(array['owner','admin','operador','financeiro','auditor']) then
    raise exception 'mfa_required';
  end if;
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
revoke all on function public.admin_notification_dashboard() from public, anon;
grant execute on function public.admin_notification_dashboard() to authenticated;
