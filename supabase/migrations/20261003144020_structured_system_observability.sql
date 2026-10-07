-- Recovered verbatim from Supabase migration history; 20261003144020.

create table if not exists public.system_events(
  id bigint generated always as identity primary key,
  request_id text,
  severity text not null check(severity in ('info','warn','error','critical')),
  category text not null,
  code text not null,
  route text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
alter table public.system_events enable row level security;
revoke all on public.system_events from anon,authenticated;
drop policy if exists deny_system_events_anon on public.system_events;
create policy deny_system_events_anon on public.system_events for all to anon using(false) with check(false);
drop policy if exists deny_system_events_auth on public.system_events;
create policy deny_system_events_auth on public.system_events for all to authenticated using(false) with check(false);
create index if not exists system_events_created_idx on public.system_events(created_at desc);
create index if not exists system_events_severity_idx on public.system_events(severity,created_at desc);
create index if not exists system_events_code_idx on public.system_events(code,created_at desc);

create or replace function public.log_system_event_internal(
  p_internal_secret text,p_request_id text,p_severity text,p_category text,p_code text,p_route text,p_metadata jsonb default '{}'::jsonb
) returns boolean language plpgsql security definer set search_path=public as $$
begin
  if not internal_secret_ok(p_internal_secret) then raise exception 'unauthorized'; end if;
  if p_severity not in ('info','warn','error','critical') then raise exception 'invalid severity'; end if;
  insert into system_events(request_id,severity,category,code,route,metadata)
  values(left(coalesce(p_request_id,''),100),p_severity,left(coalesce(p_category,''),80),left(coalesce(p_code,''),120),left(coalesce(p_route,''),200),coalesce(p_metadata,'{}'::jsonb));
  return true;
end $$;
revoke all on function public.log_system_event_internal(text,text,text,text,text,text,jsonb) from public,authenticated;
grant execute on function public.log_system_event_internal(text,text,text,text,text,text,jsonb) to anon,service_role;

create or replace function public.admin_system_health_dashboard()
returns jsonb language plpgsql security definer set search_path=public as $$
begin
  if not public.has_admin_role(array['owner','admin','auditor']) then raise exception 'forbidden'; end if;
  return jsonb_build_object(
    'summary',jsonb_build_object(
      'errors_24h',(select count(*) from system_events where severity in ('error','critical') and created_at>now()-interval '24 hours'),
      'warnings_24h',(select count(*) from system_events where severity='warn' and created_at>now()-interval '24 hours'),
      'payment_alerts_24h',(select count(*) from payment_events where processing_note in ('amount_mismatch','numbers_not_reserved','late_or_cancelled_payment') and created_at>now()-interval '24 hours'),
      'failed_notifications',(select count(*) from notification_outbox where status='failed')
    ),
    'recent_events',coalesce((select jsonb_agg(to_jsonb(x) order by x.created_at desc) from (
      select id,request_id,severity,category,code,route,metadata,created_at
      from system_events order by created_at desc limit 250
    ) x),'[]'::jsonb),
    'top_codes',coalesce((select jsonb_agg(to_jsonb(x) order by x.count_value desc) from (
      select code,count(*) count_value,max(created_at) last_seen
      from system_events where created_at>now()-interval '24 hours'
      group by code order by count(*) desc limit 20
    ) x),'[]'::jsonb)
  );
end $$;
revoke all on function public.admin_system_health_dashboard() from public,anon;
grant execute on function public.admin_system_health_dashboard() to authenticated;


