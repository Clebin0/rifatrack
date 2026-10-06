-- Recovered verbatim from Supabase migration history; 20261001023446.

create extension if not exists pgcrypto;

alter table campaigns add column if not exists description text not null default '';
alter table campaigns add column if not exists pix_key text not null default '';
alter table campaigns add column if not exists pix_receiver text not null default '';
alter table campaigns add column if not exists ends_at timestamptz;
alter table campaigns add column if not exists updated_at timestamptz not null default now();
alter table sellers add column if not exists updated_at timestamptz not null default now();
alter table orders add column if not exists public_token uuid not null default gen_random_uuid();
alter table orders add column if not exists payment_reference text;
create unique index if not exists orders_public_token_uidx on orders(public_token);

create table if not exists campaign_sellers(
  campaign_id uuid not null references campaigns(id) on delete cascade,
  seller_id uuid not null references sellers(id) on delete cascade,
  goal int not null default 30 check(goal >= 0),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  primary key(campaign_id,seller_id)
);

create table if not exists admin_users(
  email text primary key check(email = lower(email)),
  created_at timestamptz not null default now()
);

create table if not exists app_settings(
  key text primary key,
  value_hash text not null,
  created_at timestamptz not null default now()
);

create table if not exists api_rate_limits(
  fingerprint text not null,
  window_start timestamptz not null,
  requests int not null default 1,
  primary key(fingerprint,window_start)
);

create table if not exists audit_logs(
  id bigint generated always as identity primary key,
  actor_email text,
  action text not null,
  entity_type text not null,
  entity_id text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

insert into app_settings(key,value_hash) values
('bootstrap_admin','873c27faea26049939eaba030a8fac532373e1dfa47fb872e94bc37d6b9e8f22'),
('internal_api_secret','c3b2d454e6001d69d3245d195dc10aef2ac5f1293999de44b049a3c1ea9e5bf5')
on conflict(key) do update set value_hash=excluded.value_hash;

insert into campaign_sellers(campaign_id,seller_id,goal)
select c.id,s.id,s.goal from campaigns c cross join sellers s
on conflict(campaign_id,seller_id) do nothing;

insert into raffle_numbers(campaign_id,number,status)
select c.id,g.n,'available'
from campaigns c cross join lateral generate_series(1,c.total_numbers) g(n)
on conflict(campaign_id,number) do nothing;

alter table campaign_sellers enable row level security;
alter table admin_users enable row level security;
alter table app_settings enable row level security;
alter table api_rate_limits enable row level security;
alter table audit_logs enable row level security;

revoke all on campaigns,sellers,orders,raffle_numbers,campaign_sellers,admin_users,app_settings,api_rate_limits,audit_logs from anon,authenticated;

drop function if exists reserve_raffle_numbers(text,text,text,text,int[]);
drop function if exists public_campaign(text);

create or replace function release_expired_reservations(p_campaign_id uuid default null)
returns void language plpgsql security definer set search_path=public as $$
begin
  update orders set status='expired'
  where status='pending' and expires_at < now()
    and (p_campaign_id is null or campaign_id=p_campaign_id);
  update raffle_numbers set status='available',order_id=null,reserved_until=null
  where status='reserved' and reserved_until < now()
    and (p_campaign_id is null or campaign_id=p_campaign_id);
end $$;

create or replace function internal_secret_ok(p_secret text)
returns boolean language sql stable security definer set search_path=public,extensions as $$
  select exists(
    select 1 from app_settings
    where key='internal_api_secret'
      and value_hash=encode(extensions.digest(convert_to(coalesce(p_secret,''),'UTF8'),'sha256'),'hex')
  )
$$;

create or replace function is_admin()
returns boolean language sql stable security definer set search_path=public as $$
  select exists(
    select 1 from admin_users
    where email=lower(coalesce(auth.jwt()->>'email',''))
  )
$$;

create or replace function public_active_campaigns()
returns jsonb language plpgsql security definer set search_path=public as $$
begin
  perform release_expired_reservations(null);
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'name',c.name,'slug',c.slug,'description',c.description,
      'price_cents',c.price_cents,'total_numbers',c.total_numbers,
      'sold_numbers',(select count(*) from raffle_numbers rn where rn.campaign_id=c.id and rn.status='paid'),
      'ends_at',c.ends_at
    ) order by c.created_at desc)
    from campaigns c where c.status='active'
  ),'[]'::jsonb);
end $$;

create or replace function public_campaign(p_slug text,p_seller_code text default null)
returns jsonb language plpgsql security definer set search_path=public as $$
declare c campaigns; seller_name text;
begin
  if p_slug !~ '^[a-z0-9-]{2,80}$' then return null; end if;
  select * into c from campaigns where slug=p_slug and status='active';
  if not found then return null; end if;
  perform release_expired_reservations(c.id);
  if p_seller_code is not null and p_seller_code<>'' then
    select s.name into seller_name
    from sellers s join campaign_sellers cs on cs.seller_id=s.id
    where cs.campaign_id=c.id and cs.active=true and s.active=true and s.code=upper(p_seller_code);
  end if;
  return jsonb_build_object(
    'id',c.id,'name',c.name,'slug',c.slug,'description',c.description,
    'price_cents',c.price_cents,'total_numbers',c.total_numbers,
    'pix_key',c.pix_key,'pix_receiver',c.pix_receiver,'ends_at',c.ends_at,
    'seller_name',seller_name,
    'unavailable',coalesce((select jsonb_agg(number order by number) from raffle_numbers where campaign_id=c.id and status<>'available'),'[]'::jsonb),
    'sold_numbers',(select count(*) from raffle_numbers where campaign_id=c.id and status='paid'),
    'reserved_numbers',(select count(*) from raffle_numbers where campaign_id=c.id and status='reserved')
  );
end $$;

create or replace function public_order(p_token uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare o orders; c campaigns;
begin
  select * into o from orders where public_token=p_token;
  if not found then return null; end if;
  perform release_expired_reservations(o.campaign_id);
  select * into o from orders where public_token=p_token;
  select * into c from campaigns where id=o.campaign_id;
  return jsonb_build_object(
    'status',o.status,'amount_cents',o.amount_cents,'expires_at',o.expires_at,
    'payment_reference',o.payment_reference,'campaign_name',c.name,'campaign_slug',c.slug,
    'pix_key',c.pix_key,'pix_receiver',c.pix_receiver,
    'numbers',coalesce((select jsonb_agg(number order by number) from raffle_numbers where order_id=o.id),'[]'::jsonb)
  );
end $$;

create or replace function reserve_raffle_numbers(
  p_internal_secret text,p_fingerprint text,p_campaign_slug text,p_seller_code text,
  p_buyer_name text,p_buyer_phone text,p_numbers int[]
) returns jsonb language plpgsql security definer set search_path=public as $$
declare c campaigns; s sellers; o orders; wanted int; locked_available int; current_requests int;
begin
  if not internal_secret_ok(p_internal_secret) then raise exception 'unauthorized'; end if;
  if length(coalesce(p_fingerprint,''))<16 or length(p_fingerprint)>128 then raise exception 'invalid fingerprint'; end if;

  insert into api_rate_limits(fingerprint,window_start,requests)
  values(p_fingerprint,date_trunc('hour',now()),1)
  on conflict(fingerprint,window_start) do update set requests=api_rate_limits.requests+1
  returning requests into current_requests;
  if current_requests>20 then raise exception 'rate limit'; end if;

  wanted:=coalesce(array_length(p_numbers,1),0);
  if wanted<1 or wanted>50 then raise exception 'invalid quantity'; end if;
  if (select count(distinct x) from unnest(p_numbers)x)<>wanted then raise exception 'duplicate number'; end if;
  if length(trim(p_buyer_name))<2 or length(trim(p_buyer_name))>100 then raise exception 'invalid buyer'; end if;
  if length(trim(p_buyer_phone))<8 or length(trim(p_buyer_phone))>20 then raise exception 'invalid phone'; end if;
  if (select count(*) from orders where buyer_phone=left(trim(p_buyer_phone),20) and created_at>now()-interval '15 minutes')>=3 then
    raise exception 'too many orders';
  end if;

  select * into c from campaigns where slug=p_campaign_slug and status='active' for update;
  if not found or (c.ends_at is not null and c.ends_at<now()) then raise exception 'campaign unavailable'; end if;
  if exists(select 1 from unnest(p_numbers)x where x<1 or x>c.total_numbers) then raise exception 'invalid number'; end if;
  perform release_expired_reservations(c.id);

  if p_seller_code is not null and p_seller_code<>'' then
    select se.* into s from sellers se
    join campaign_sellers cs on cs.seller_id=se.id
    where cs.campaign_id=c.id and cs.active=true and se.active=true and se.code=upper(p_seller_code);
  end if;

  select count(*) into locked_available from (
    select id,status from raffle_numbers
    where campaign_id=c.id and number=any(p_numbers)
    for update
  ) q where q.status='available';
  if locked_available<>wanted then raise exception 'number unavailable'; end if;

  insert into orders(campaign_id,seller_id,buyer_name,buyer_phone,amount_cents,payment_reference)
  values(c.id,s.id,left(trim(p_buyer_name),100),left(trim(p_buyer_phone),20),wanted*c.price_cents,'RT-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,10)))
  returning * into o;

  update raffle_numbers set order_id=o.id,status='reserved',reserved_until=o.expires_at
  where campaign_id=c.id and number=any(p_numbers) and status='available';

  return jsonb_build_object('id',o.id,'public_token',o.public_token,'amount_cents',o.amount_cents,'expires_at',o.expires_at,'payment_reference',o.payment_reference);
end $$;

create or replace function claim_first_admin(p_code text)
returns boolean language plpgsql security definer set search_path=public,extensions as $$
declare email_value text; expected_hash text;
begin
  email_value:=lower(coalesce(auth.jwt()->>'email',''));
  if auth.uid() is null or email_value='' then raise exception 'authentication required'; end if;
  select value_hash into expected_hash from app_settings where key='bootstrap_admin' for update;
  if expected_hash is null then
    if is_admin() then return true; end if;
    raise exception 'setup already completed';
  end if;
  if encode(extensions.digest(convert_to(coalesce(p_code,''),'UTF8'),'sha256'),'hex')<>expected_hash then raise exception 'invalid setup code'; end if;
  insert into admin_users(email) values(email_value) on conflict(email) do nothing;
  delete from app_settings where key='bootstrap_admin';
  insert into audit_logs(actor_email,action,entity_type,entity_id) values(email_value,'bootstrap_admin','admin',email_value);
  return true;
end $$;

create or replace function admin_dashboard()
returns jsonb language plpgsql security definer set search_path=public as $$
begin
  if not is_admin() then raise exception 'forbidden'; end if;
  perform release_expired_reservations(null);
  return jsonb_build_object(
    'admin_email',lower(auth.jwt()->>'email'),
    'summary',jsonb_build_object(
      'campaigns',(select count(*) from campaigns),
      'active_campaigns',(select count(*) from campaigns where status='active'),
      'paid_revenue_cents',(select coalesce(sum(amount_cents),0) from orders where status='paid'),
      'pending_orders',(select count(*) from orders where status='pending')
    ),
    'campaigns',coalesce((select jsonb_agg(to_jsonb(x) order by x.created_at desc) from (
      select c.id,c.name,c.slug,c.description,c.price_cents,c.total_numbers,c.status,c.pix_key,c.pix_receiver,c.ends_at,c.created_at,
      (select count(*) from raffle_numbers rn where rn.campaign_id=c.id and rn.status='paid') sold_numbers,
      (select count(*) from raffle_numbers rn where rn.campaign_id=c.id and rn.status='reserved') reserved_numbers,
      (select coalesce(sum(o.amount_cents),0) from orders o where o.campaign_id=c.id and o.status='paid') revenue_cents
      from campaigns c
    ) x),'[]'::jsonb),
    'sellers',coalesce((select jsonb_agg(to_jsonb(x) order by x.sold_numbers desc,x.name) from (
      select cs.campaign_id,c.name campaign_name,c.slug campaign_slug,s.id,s.name,s.code,s.team,cs.goal,cs.active,
      (select count(*) from raffle_numbers rn join orders o on o.id=rn.order_id where o.campaign_id=cs.campaign_id and o.seller_id=s.id and rn.status='paid') sold_numbers,
      (select coalesce(sum(o.amount_cents),0) from orders o where o.campaign_id=cs.campaign_id and o.seller_id=s.id and o.status='paid') revenue_cents
      from campaign_sellers cs join campaigns c on c.id=cs.campaign_id join sellers s on s.id=cs.seller_id
    ) x),'[]'::jsonb),
    'orders',coalesce((select jsonb_agg(to_jsonb(x) order by x.created_at desc) from (
      select o.id,o.public_token,o.buyer_name,o.buyer_phone,o.status,o.amount_cents,o.payment_reference,o.expires_at,o.created_at,
      c.name campaign_name,c.slug campaign_slug,s.name seller_name,
      coalesce((select jsonb_agg(rn.number order by rn.number) from raffle_numbers rn where rn.order_id=o.id),'[]'::jsonb) numbers
      from orders o join campaigns c on c.id=o.campaign_id left join sellers s on s.id=o.seller_id
      order by o.created_at desc limit 250
    ) x),'[]'::jsonb)
  );
end $$;

create or replace function admin_create_campaign(
  p_name text,p_slug text,p_description text,p_price_cents int,p_total_numbers int,p_pix_key text,p_pix_receiver text,p_ends_at timestamptz default null
) returns uuid language plpgsql security definer set search_path=public as $$
declare cid uuid;
begin
  if not is_admin() then raise exception 'forbidden'; end if;
  if length(trim(p_name))<3 or p_slug !~ '^[a-z0-9-]{2,80}$' or p_price_cents<1 or p_total_numbers<1 or p_total_numbers>100000 then raise exception 'invalid campaign'; end if;
  insert into campaigns(name,slug,description,price_cents,total_numbers,pix_key,pix_receiver,ends_at,status)
  values(left(trim(p_name),120),p_slug,left(coalesce(p_description,''),2000),p_price_cents,p_total_numbers,left(coalesce(p_pix_key,''),180),left(coalesce(p_pix_receiver,''),180),p_ends_at,'draft')
  returning id into cid;
  insert into raffle_numbers(campaign_id,number,status) select cid,generate_series(1,p_total_numbers),'available';
  insert into audit_logs(actor_email,action,entity_type,entity_id) values(lower(auth.jwt()->>'email'),'create','campaign',cid::text);
  return cid;
end $$;

create or replace function admin_update_campaign(
  p_id uuid,p_name text,p_description text,p_price_cents int,p_pix_key text,p_pix_receiver text,p_ends_at timestamptz default null
) returns boolean language plpgsql security definer set search_path=public as $$
begin
  if not is_admin() then raise exception 'forbidden'; end if;
  update campaigns set name=left(trim(p_name),120),description=left(coalesce(p_description,''),2000),price_cents=p_price_cents,
    pix_key=left(coalesce(p_pix_key,''),180),pix_receiver=left(coalesce(p_pix_receiver,''),180),ends_at=p_ends_at,updated_at=now()
  where id=p_id;
  insert into audit_logs(actor_email,action,entity_type,entity_id) values(lower(auth.jwt()->>'email'),'update','campaign',p_id::text);
  return found;
end $$;

create or replace function admin_set_campaign_status(p_id uuid,p_status text)
returns boolean language plpgsql security definer set search_path=public as $$
begin
  if not is_admin() or p_status not in('draft','active','closed') then raise exception 'forbidden'; end if;
  update campaigns set status=p_status,updated_at=now() where id=p_id;
  insert into audit_logs(actor_email,action,entity_type,entity_id,payload) values(lower(auth.jwt()->>'email'),'status','campaign',p_id::text,jsonb_build_object('status',p_status));
  return found;
end $$;

create or replace function admin_create_seller(p_campaign_id uuid,p_name text,p_code text,p_team text,p_goal int)
returns uuid language plpgsql security definer set search_path=public as $$
declare sid uuid; clean_code text;
begin
  if not is_admin() then raise exception 'forbidden'; end if;
  clean_code:=upper(regexp_replace(coalesce(p_code,''),'[^A-Za-z0-9_-]','','g'));
  if length(trim(p_name))<2 or length(clean_code)<2 or p_goal<0 then raise exception 'invalid seller'; end if;
  insert into sellers(name,code,team,goal,active) values(left(trim(p_name),100),clean_code,left(coalesce(p_team,''),100),p_goal,true)
  on conflict(code) do update set name=excluded.name,team=excluded.team,active=true,updated_at=now()
  returning id into sid;
  insert into campaign_sellers(campaign_id,seller_id,goal,active) values(p_campaign_id,sid,p_goal,true)
  on conflict(campaign_id,seller_id) do update set goal=excluded.goal,active=true;
  insert into audit_logs(actor_email,action,entity_type,entity_id,payload) values(lower(auth.jwt()->>'email'),'create_or_assign','seller',sid::text,jsonb_build_object('campaign_id',p_campaign_id));
  return sid;
end $$;

create or replace function admin_set_seller_active(p_campaign_id uuid,p_seller_id uuid,p_active boolean)
returns boolean language plpgsql security definer set search_path=public as $$
begin
  if not is_admin() then raise exception 'forbidden'; end if;
  update campaign_sellers set active=p_active where campaign_id=p_campaign_id and seller_id=p_seller_id;
  return found;
end $$;

create or replace function admin_set_order_status(p_order_id uuid,p_status text)
returns boolean language plpgsql security definer set search_path=public as $$
declare o orders;
begin
  if not is_admin() or p_status not in('paid','cancelled') then raise exception 'forbidden'; end if;
  select * into o from orders where id=p_order_id for update;
  if not found then return false; end if;
  if p_status='paid' then
    if o.status='paid' then return true; end if;
    if o.status<>'pending' or o.expires_at<now() then raise exception 'order unavailable'; end if;
    update orders set status='paid' where id=o.id;
    update raffle_numbers set status='paid',reserved_until=null where order_id=o.id;
  else
    if o.status='paid' then raise exception 'paid order cannot be cancelled'; end if;
    update orders set status='cancelled' where id=o.id;
    update raffle_numbers set status='available',order_id=null,reserved_until=null where order_id=o.id and status='reserved';
  end if;
  insert into audit_logs(actor_email,action,entity_type,entity_id,payload) values(lower(auth.jwt()->>'email'),'status','order',o.id::text,jsonb_build_object('status',p_status));
  return true;
end $$;

revoke all on function release_expired_reservations(uuid) from public;
revoke all on function internal_secret_ok(text) from public;
revoke all on function is_admin() from public;

grant execute on function public_active_campaigns() to anon,authenticated;
grant execute on function public_campaign(text,text) to anon,authenticated;
grant execute on function public_order(uuid) to anon,authenticated;
grant execute on function reserve_raffle_numbers(text,text,text,text,text,text,int[]) to anon,authenticated;
grant execute on function claim_first_admin(text) to authenticated;
grant execute on function admin_dashboard() to authenticated;
grant execute on function admin_create_campaign(text,text,text,int,int,text,text,timestamptz) to authenticated;
grant execute on function admin_update_campaign(uuid,text,text,int,text,text,timestamptz) to authenticated;
grant execute on function admin_set_campaign_status(uuid,text) to authenticated;
grant execute on function admin_create_seller(uuid,text,text,text,int) to authenticated;
grant execute on function admin_set_seller_active(uuid,uuid,boolean) to authenticated;
grant execute on function admin_set_order_status(uuid,text) to authenticated;


