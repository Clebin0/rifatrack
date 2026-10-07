-- Recovered verbatim from Supabase migration history; 20261001030650.

create table if not exists public.draws(
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null unique references public.campaigns(id) on delete cascade,
  order_id uuid not null references public.orders(id),
  number integer not null,
  actor_email text not null,
  drawn_at timestamptz not null default now()
);
alter table public.draws enable row level security;
revoke all on public.draws from anon, authenticated;

create or replace function public.admin_draw_campaign(p_campaign_id uuid)
returns jsonb
language plpgsql
security definer
set search_path=public, extensions
as $$
declare
  v_email text;
  v_campaign public.campaigns;
  v_count bigint;
  v_pick bigint;
  v_row record;
  v_existing public.draws;
begin
  v_email:=lower(coalesce(auth.jwt()->>'email',''));
  if not public.is_admin() then raise exception 'admin required'; end if;

  select * into v_campaign from public.campaigns where id=p_campaign_id for update;
  if not found then raise exception 'campaign not found'; end if;
  if v_campaign.status <> 'closed' then raise exception 'campaign must be closed'; end if;

  select * into v_existing from public.draws where campaign_id=p_campaign_id;
  if found then
    return jsonb_build_object('number',v_existing.number,'drawn_at',v_existing.drawn_at,'already_drawn',true);
  end if;

  select count(*) into v_count
  from public.raffle_numbers
  where campaign_id=p_campaign_id and status='paid';

  if v_count < 1 then raise exception 'no paid numbers'; end if;

  v_pick := (
    ('x' || substr(encode(extensions.digest(gen_random_uuid()::text || clock_timestamp()::text,'sha256'),'hex'),1,16))::bit(64)::bigint
    & 9223372036854775807
  ) % v_count;

  select rn.number, rn.order_id
  into v_row
  from public.raffle_numbers rn
  where rn.campaign_id=p_campaign_id and rn.status='paid'
  order by rn.number
  offset v_pick limit 1;

  insert into public.draws(campaign_id,order_id,number,actor_email)
  values(p_campaign_id,v_row.order_id,v_row.number,v_email)
  returning * into v_existing;

  insert into public.audit_logs(actor_email,action,entity_type,entity_id,metadata)
  values(v_email,'draw_campaign','campaign',p_campaign_id::text,jsonb_build_object('number',v_existing.number));

  return jsonb_build_object('number',v_existing.number,'drawn_at',v_existing.drawn_at,'already_drawn',false);
end $$;

revoke all on function public.admin_draw_campaign(uuid) from public;
grant execute on function public.admin_draw_campaign(uuid) to authenticated;

create or replace function public.public_draw_result(p_slug text)
returns jsonb
language sql
security definer
set search_path=public
as $$
  select case when d.id is null then null else
    jsonb_build_object('number',d.number,'drawn_at',d.drawn_at)
  end
  from public.campaigns c
  left join public.draws d on d.campaign_id=c.id
  where c.slug=p_slug
  limit 1
$$;

revoke all on function public.public_draw_result(text) from public;
grant execute on function public.public_draw_result(text) to anon, authenticated, service_role;


