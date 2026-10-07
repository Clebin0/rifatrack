-- Recovered verbatim from Supabase migration history; 20261003141346.

create table if not exists public.draw_commitments(
  campaign_id uuid primary key references public.campaigns(id) on delete cascade,
  eligible_count integer not null check(eligible_count>=0),
  paid_list_hash text not null,
  seed_commitment text not null,
  seed_secret text not null,
  created_at timestamptz not null default now(),
  revealed_at timestamptz
);
alter table public.draw_commitments enable row level security;
revoke all on public.draw_commitments from anon,authenticated;
drop policy if exists deny_public_draw_commitments on public.draw_commitments;
create policy deny_public_draw_commitments on public.draw_commitments for all to anon,authenticated using(false) with check(false);

alter table public.draws
  add column if not exists method text not null default 'legacy_random',
  add column if not exists eligible_count integer,
  add column if not exists paid_list_hash text,
  add column if not exists seed_commitment text,
  add column if not exists seed_reveal text;

create or replace function public.admin_set_campaign_status(p_id uuid,p_status text)
returns boolean language plpgsql security definer set search_path=public,extensions as $$
declare
  c campaigns;
  paid_list text;
  list_hash text;
  seed text;
  commitment text;
  eligible integer;
begin
  if not public.is_admin_aal2() or p_status not in('draft','active','closed') then raise exception 'mfa_required'; end if;
  select * into c from campaigns where id=p_id for update;
  if not found then return false; end if;

  if c.status='closed' and p_status<>'closed' and exists(select 1 from draw_commitments where campaign_id=p_id) then
    raise exception 'closed campaign is cryptographically locked';
  end if;

  if p_status='closed' and c.status<>'closed' then
    perform release_expired_reservations(p_id);
    if exists(select 1 from orders where campaign_id=p_id and status='pending') then
      raise exception 'resolve pending orders before closing';
    end if;

    select count(*),coalesce(string_agg(number::text,',' order by number),'')
      into eligible,paid_list
    from raffle_numbers where campaign_id=p_id and status='paid';

    if eligible>0 then
      list_hash:=encode(extensions.digest(convert_to(paid_list,'UTF8'),'sha256'),'hex');
      seed:=encode(extensions.gen_random_bytes(32),'hex');
      commitment:=encode(extensions.digest(convert_to(seed||':'||list_hash,'UTF8'),'sha256'),'hex');
      insert into draw_commitments(campaign_id,eligible_count,paid_list_hash,seed_commitment,seed_secret)
      values(p_id,eligible,list_hash,commitment,seed)
      on conflict(campaign_id) do nothing;
    end if;
  end if;

  update campaigns set status=p_status,updated_at=now() where id=p_id;
  insert into audit_logs(actor_email,action,entity_type,entity_id,payload)
  values(lower(auth.jwt()->>'email'),'status','campaign',p_id::text,
    jsonb_build_object('status',p_status,'aal','aal2',
      'draw_commitment',(select seed_commitment from draw_commitments where campaign_id=p_id)));
  return true;
end $$;

create or replace function public.admin_draw_campaign(p_campaign_id uuid)
returns jsonb language plpgsql security definer set search_path=public,extensions as $$
declare
  v_email text;
  v_campaign public.campaigns;
  v_count integer;
  v_pick bigint;
  v_row record;
  v_existing public.draws;
  v_commit public.draw_commitments;
  v_paid_list text;
  v_list_hash text;
begin
  v_email:=lower(coalesce(auth.jwt()->>'email',''));
  if not public.is_admin_aal2() then raise exception 'mfa_required'; end if;
  select * into v_campaign from public.campaigns where id=p_campaign_id for update;
  if not found then raise exception 'campaign not found'; end if;
  if v_campaign.status<>'closed' then raise exception 'campaign must be closed'; end if;

  select * into v_existing from public.draws where campaign_id=p_campaign_id;
  if found then
    return jsonb_build_object(
      'number',v_existing.number,'drawn_at',v_existing.drawn_at,'already_drawn',true,
      'method',v_existing.method,'eligible_count',v_existing.eligible_count,
      'paid_list_hash',v_existing.paid_list_hash,'seed_commitment',v_existing.seed_commitment,'seed_reveal',v_existing.seed_reveal
    );
  end if;

  select * into v_commit from draw_commitments where campaign_id=p_campaign_id for update;
  if not found then raise exception 'draw commitment missing'; end if;

  select count(*),coalesce(string_agg(number::text,',' order by number),'')
    into v_count,v_paid_list
  from raffle_numbers where campaign_id=p_campaign_id and status='paid';

  v_list_hash:=encode(extensions.digest(convert_to(v_paid_list,'UTF8'),'sha256'),'hex');
  if v_count<>v_commit.eligible_count or v_list_hash<>v_commit.paid_list_hash then
    raise exception 'eligible list integrity check failed';
  end if;
  if v_count<1 then raise exception 'no paid numbers'; end if;

  v_pick := (
    ('x'||substr(encode(extensions.digest(convert_to(v_commit.seed_secret||':'||v_commit.paid_list_hash||':RIFATRACK_DRAW_V1','UTF8'),'sha256'),'hex'),1,16))::bit(64)::bigint
    & 9223372036854775807
  ) % v_count;

  select rn.number,rn.order_id into v_row
  from raffle_numbers rn
  where rn.campaign_id=p_campaign_id and rn.status='paid'
  order by rn.number
  offset v_pick limit 1;

  insert into draws(campaign_id,order_id,number,actor_email,method,eligible_count,paid_list_hash,seed_commitment,seed_reveal)
  values(p_campaign_id,v_row.order_id,v_row.number,v_email,'commit_reveal_v1',v_count,v_commit.paid_list_hash,v_commit.seed_commitment,v_commit.seed_secret)
  returning * into v_existing;

  update draw_commitments set revealed_at=now() where campaign_id=p_campaign_id;

  insert into audit_logs(actor_email,action,entity_type,entity_id,payload)
  values(v_email,'draw_campaign','campaign',p_campaign_id::text,
    jsonb_build_object('number',v_existing.number,'method','commit_reveal_v1','eligible_count',v_count,
      'paid_list_hash',v_commit.paid_list_hash,'seed_commitment',v_commit.seed_commitment,'aal','aal2'));

  return jsonb_build_object(
    'number',v_existing.number,'drawn_at',v_existing.drawn_at,'already_drawn',false,
    'method',v_existing.method,'eligible_count',v_existing.eligible_count,
    'paid_list_hash',v_existing.paid_list_hash,'seed_commitment',v_existing.seed_commitment,'seed_reveal',v_existing.seed_reveal
  );
end $$;

create or replace function public.public_draw_verification(p_slug text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare
  c campaigns;
  cm draw_commitments;
  d draws;
  nums jsonb;
begin
  select * into c from campaigns where slug=p_slug and status='closed';
  if not found then return null; end if;
  select * into cm from draw_commitments where campaign_id=c.id;
  select * into d from draws where campaign_id=c.id;
  select coalesce(jsonb_agg(number order by number),'[]'::jsonb) into nums
    from raffle_numbers where campaign_id=c.id and status='paid';

  return jsonb_build_object(
    'campaign_name',c.name,'slug',c.slug,'status',c.status,
    'eligible_numbers',nums,
    'eligible_count',coalesce(cm.eligible_count,0),
    'paid_list_hash',cm.paid_list_hash,
    'seed_commitment',cm.seed_commitment,
    'commitment_created_at',cm.created_at,
    'drawn',d.id is not null,
    'number',d.number,
    'drawn_at',d.drawn_at,
    'method',d.method,
    'seed_reveal',d.seed_reveal
  );
end $$;
revoke all on function public.public_draw_verification(text) from public;
grant execute on function public.public_draw_verification(text) to anon,service_role;


