-- Recovered verbatim from Supabase migration history; 20261003141640.

alter table public.admin_users
  add column if not exists role text not null default 'admin',
  add column if not exists active boolean not null default true,
  add column if not exists updated_at timestamptz not null default now();

update public.admin_users set role='owner' where active=true and role='admin';

do $$ begin
  alter table public.admin_users add constraint admin_users_role_check
  check(role in ('owner','admin','financeiro','operador','auditor'));
exception when duplicate_object then null; end $$;

create table if not exists public.admin_invites(
  id uuid primary key default gen_random_uuid(),
  email text not null,
  role text not null check(role in ('owner','admin','financeiro','operador','auditor')),
  code_hash text not null,
  expires_at timestamptz not null default(now()+interval '7 days'),
  used_at timestamptz,
  created_by text not null,
  created_at timestamptz not null default now()
);
alter table public.admin_invites enable row level security;
revoke all on public.admin_invites from anon,authenticated;
drop policy if exists deny_admin_invites_anon on public.admin_invites;
create policy deny_admin_invites_anon on public.admin_invites for all to anon using(false) with check(false);
drop policy if exists deny_admin_invites_auth on public.admin_invites;
create policy deny_admin_invites_auth on public.admin_invites for all to authenticated using(false) with check(false);
create index if not exists admin_invites_email_idx on public.admin_invites(lower(email));

create or replace function public.current_admin_role()
returns text language sql stable security definer set search_path=public as $$
  select role from public.admin_users
  where email=lower(coalesce(auth.jwt()->>'email','')) and active=true
  limit 1
$$;
revoke all on function public.current_admin_role() from public,anon;
grant execute on function public.current_admin_role() to authenticated;

create or replace function public.has_admin_role(p_roles text[])
returns boolean language sql stable security definer set search_path=public as $$
  select exists(
    select 1 from public.admin_users
    where email=lower(coalesce(auth.jwt()->>'email',''))
      and active=true
      and role=any(p_roles)
  )
$$;
revoke all on function public.has_admin_role(text[]) from public,anon;
grant execute on function public.has_admin_role(text[]) to authenticated;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path=public as $$
  select public.has_admin_role(array['owner','admin','financeiro','operador','auditor'])
$$;
revoke all on function public.is_admin() from public,anon;
grant execute on function public.is_admin() to authenticated;

create or replace function public.is_admin_aal2()
returns boolean language sql stable security definer set search_path=public as $$
  select public.is_admin() and coalesce(auth.jwt()->>'aal','aal1')='aal2'
$$;
revoke all on function public.is_admin_aal2() from public,anon;
grant execute on function public.is_admin_aal2() to authenticated;

create or replace function public.admin_role_aal2(p_roles text[])
returns boolean language sql stable security definer set search_path=public as $$
  select public.has_admin_role(p_roles) and coalesce(auth.jwt()->>'aal','aal1')='aal2'
$$;
revoke all on function public.admin_role_aal2(text[]) from public,anon;
grant execute on function public.admin_role_aal2(text[]) to authenticated;

create or replace function public.claim_first_admin(p_code text)
returns boolean language plpgsql security definer set search_path=public,extensions as $$
declare email_value text; expected_hash text;
begin
  email_value:=lower(coalesce(auth.jwt()->>'email',''));
  if auth.uid() is null or email_value='' then raise exception 'authentication required'; end if;
  if coalesce(auth.jwt()->>'aal','aal1')<>'aal2' then raise exception 'mfa_required'; end if;
  select value_hash into expected_hash from app_settings where key='bootstrap_admin' for update;
  if expected_hash is null then
    if is_admin() then return true; end if;
    raise exception 'setup already completed';
  end if;
  if encode(extensions.digest(convert_to(coalesce(p_code,''),'UTF8'),'sha256'),'hex')<>expected_hash then raise exception 'invalid setup code'; end if;
  insert into admin_users(email,role,active) values(email_value,'owner',true)
  on conflict(email) do update set role='owner',active=true,updated_at=now();
  delete from app_settings where key='bootstrap_admin';
  insert into audit_logs(actor_email,action,entity_type,entity_id,payload)
  values(email_value,'bootstrap_admin','admin',email_value,jsonb_build_object('role','owner','aal','aal2'));
  return true;
end $$;

create or replace function public.admin_create_team_invite(p_email text,p_role text)
returns jsonb language plpgsql security definer set search_path=public,extensions as $$
declare code text; inv admin_invites;
begin
  if not public.admin_role_aal2(array['owner']) then raise exception 'owner_mfa_required'; end if;
  if p_email !~* '^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$' then raise exception 'invalid email'; end if;
  if p_role not in ('owner','admin','financeiro','operador','auditor') then raise exception 'invalid role'; end if;
  code:='AD-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,22));
  update admin_invites set used_at=now() where lower(email)=lower(trim(p_email)) and used_at is null;
  insert into admin_invites(email,role,code_hash,created_by)
  values(lower(trim(p_email)),p_role,encode(digest(convert_to(code,'UTF8'),'sha256'),'hex'),lower(auth.jwt()->>'email'))
  returning * into inv;
  insert into audit_logs(actor_email,action,entity_type,entity_id,payload)
  values(lower(auth.jwt()->>'email'),'admin_invite','admin',inv.email,jsonb_build_object('role',p_role));
  return jsonb_build_object('code',code,'email',inv.email,'role',inv.role,'expires_at',inv.expires_at);
end $$;
revoke all on function public.admin_create_team_invite(text,text) from public,anon;
grant execute on function public.admin_create_team_invite(text,text) to authenticated;

create or replace function public.claim_admin_invite(p_code text)
returns boolean language plpgsql security definer set search_path=public,extensions as $$
declare inv admin_invites; mail text;
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  if coalesce(auth.jwt()->>'aal','aal1')<>'aal2' then raise exception 'mfa_required'; end if;
  mail:=lower(coalesce(auth.jwt()->>'email',''));
  select * into inv from admin_invites
  where used_at is null and expires_at>now() and email=mail
    and code_hash=encode(digest(convert_to(trim(p_code),'UTF8'),'sha256'),'hex')
  order by created_at desc limit 1 for update;
  if not found then raise exception 'invalid invite'; end if;
  insert into admin_users(email,role,active) values(mail,inv.role,true)
  on conflict(email) do update set role=excluded.role,active=true,updated_at=now();
  update admin_invites set used_at=now() where id=inv.id;
  insert into audit_logs(actor_email,action,entity_type,entity_id,payload)
  values(mail,'admin_access_claimed','admin',mail,jsonb_build_object('role',inv.role,'aal','aal2'));
  return true;
end $$;
revoke all on function public.claim_admin_invite(text) from public,anon;
grant execute on function public.claim_admin_invite(text) to authenticated;

create or replace function public.admin_team_dashboard()
returns jsonb language plpgsql security definer set search_path=public as $$
begin
  if not public.admin_role_aal2(array['owner']) then raise exception 'owner_mfa_required'; end if;
  return jsonb_build_object(
    'members',coalesce((select jsonb_agg(jsonb_build_object(
      'email',email,'role',role,'active',active,'created_at',created_at,'updated_at',updated_at
    ) order by created_at) from admin_users),'[]'::jsonb),
    'pending_invites',coalesce((select jsonb_agg(jsonb_build_object(
      'id',id,'email',email,'role',role,'expires_at',expires_at,'created_at',created_at
    ) order by created_at desc) from admin_invites where used_at is null and expires_at>now()),'[]'::jsonb)
  );
end $$;
revoke all on function public.admin_team_dashboard() from public,anon;
grant execute on function public.admin_team_dashboard() to authenticated;

create or replace function public.admin_set_team_member(p_email text,p_role text,p_active boolean)
returns boolean language plpgsql security definer set search_path=public as $$
declare target admin_users; owner_count integer;
begin
  if not public.admin_role_aal2(array['owner']) then raise exception 'owner_mfa_required'; end if;
  if p_role not in ('owner','admin','financeiro','operador','auditor') then raise exception 'invalid role'; end if;
  select * into target from admin_users where email=lower(trim(p_email)) for update;
  if not found then return false; end if;

  if target.role='owner' and (p_role<>'owner' or not p_active) then
    select count(*) into owner_count from admin_users where role='owner' and active=true;
    if owner_count<=1 then raise exception 'cannot remove last owner'; end if;
  end if;

  update admin_users set role=p_role,active=p_active,updated_at=now() where email=target.email;
  insert into audit_logs(actor_email,action,entity_type,entity_id,payload)
  values(lower(auth.jwt()->>'email'),'admin_member_update','admin',target.email,
    jsonb_build_object('role',p_role,'active',p_active));
  return true;
end $$;
revoke all on function public.admin_set_team_member(text,text,boolean) from public,anon;
grant execute on function public.admin_set_team_member(text,text,boolean) to authenticated;


