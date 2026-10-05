-- Recovered verbatim from Supabase migration history; 20261001041736.

alter table public.sellers add column if not exists whatsapp text not null default '';

create table if not exists public.seller_accounts(
  user_id uuid primary key references auth.users(id) on delete cascade,
  seller_id uuid not null unique references public.sellers(id) on delete cascade,
  email text not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
alter table public.seller_accounts enable row level security;
revoke all on public.seller_accounts from anon,authenticated;

create table if not exists public.seller_invites(
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null references public.sellers(id) on delete cascade,
  email text not null,
  code_hash text not null,
  expires_at timestamptz not null default(now()+interval '7 days'),
  used_at timestamptz,
  created_by text,
  created_at timestamptz not null default now()
);
alter table public.seller_invites enable row level security;
revoke all on public.seller_invites from anon,authenticated;
create index if not exists seller_invites_seller_idx on public.seller_invites(seller_id);
create index if not exists seller_invites_email_idx on public.seller_invites(lower(email));

create or replace function public.is_seller()
returns boolean language sql stable security definer set search_path=public as $$
  select exists(
    select 1 from public.seller_accounts sa
    where sa.user_id=auth.uid() and sa.active=true
  )
$$;
revoke all on function public.is_seller() from public;
grant execute on function public.is_seller() to authenticated;

create or replace function public.admin_create_seller_v2(
  p_campaign_id uuid,p_name text,p_code text,p_team text,p_goal integer,p_whatsapp text
) returns uuid
language plpgsql security definer set search_path=public as $$
declare sid uuid;
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  if length(trim(p_name))<2 or p_code !~ '^[A-Za-z0-9_-]{2,32}$' then raise exception 'invalid seller'; end if;
  select id into sid from sellers where code=upper(trim(p_code));
  if sid is null then
    insert into sellers(name,code,team,goal,whatsapp)
    values(left(trim(p_name),100),upper(trim(p_code)),left(trim(coalesce(p_team,'')),100),greatest(coalesce(p_goal,0),0),left(trim(coalesce(p_whatsapp,'')),20))
    returning id into sid;
  else
    update sellers set name=left(trim(p_name),100),team=left(trim(coalesce(p_team,'')),100),
      goal=greatest(coalesce(p_goal,0),0),whatsapp=left(trim(coalesce(p_whatsapp,'')),20),updated_at=now()
    where id=sid;
  end if;
  insert into campaign_sellers(campaign_id,seller_id,goal,active)
  values(p_campaign_id,sid,greatest(coalesce(p_goal,0),0),true)
  on conflict(campaign_id,seller_id) do update set goal=excluded.goal,active=true;
  insert into audit_logs(actor_email,action,entity_type,entity_id,payload)
  values(lower(auth.jwt()->>'email'),'create_or_assign_seller','seller',sid::text,jsonb_build_object('campaign_id',p_campaign_id));
  return sid;
end $$;
revoke all on function public.admin_create_seller_v2(uuid,text,text,text,integer,text) from public,anon;
grant execute on function public.admin_create_seller_v2(uuid,text,text,text,integer,text) to authenticated;

create or replace function public.admin_update_seller(
  p_seller_id uuid,p_name text,p_team text,p_whatsapp text
) returns boolean
language plpgsql security definer set search_path=public as $$
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  update sellers set name=left(trim(p_name),100),team=left(trim(coalesce(p_team,'')),100),
    whatsapp=left(trim(coalesce(p_whatsapp,'')),20),updated_at=now()
  where id=p_seller_id;
  return found;
end $$;
revoke all on function public.admin_update_seller(uuid,text,text,text) from public,anon;
grant execute on function public.admin_update_seller(uuid,text,text,text) to authenticated;

create or replace function public.admin_create_seller_invite(p_seller_id uuid,p_email text)
returns jsonb language plpgsql security definer set search_path=public,extensions as $$
declare code text; inv seller_invites;
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  if p_email !~* '^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$' then raise exception 'invalid email'; end if;
  if not exists(select 1 from sellers where id=p_seller_id and active=true) then raise exception 'seller not found'; end if;
  code:='SV-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,20));
  update seller_invites set used_at=now() where seller_id=p_seller_id and used_at is null;
  insert into seller_invites(seller_id,email,code_hash,created_by)
  values(p_seller_id,lower(trim(p_email)),encode(digest(convert_to(code,'UTF8'),'sha256'),'hex'),lower(auth.jwt()->>'email'))
  returning * into inv;
  insert into audit_logs(actor_email,action,entity_type,entity_id,payload)
  values(lower(auth.jwt()->>'email'),'seller_invite','seller',p_seller_id::text,jsonb_build_object('email',lower(trim(p_email))));
  return jsonb_build_object('code',code,'expires_at',inv.expires_at,'email',inv.email);
end $$;
revoke all on function public.admin_create_seller_invite(uuid,text) from public,anon;
grant execute on function public.admin_create_seller_invite(uuid,text) to authenticated;

create or replace function public.claim_seller_access(p_code text)
returns boolean language plpgsql security definer set search_path=public,extensions as $$
declare inv seller_invites; mail text;
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  mail:=lower(coalesce(auth.jwt()->>'email',''));
  select * into inv from seller_invites
  where used_at is null and expires_at>now() and email=mail
    and code_hash=encode(digest(convert_to(trim(p_code),'UTF8'),'sha256'),'hex')
  order by created_at desc limit 1 for update;
  if not found then raise exception 'invalid invite'; end if;
  insert into seller_accounts(user_id,seller_id,email,active)
  values(auth.uid(),inv.seller_id,mail,true)
  on conflict(user_id) do update set seller_id=excluded.seller_id,email=excluded.email,active=true;
  update seller_invites set used_at=now() where id=inv.id;
  insert into audit_logs(actor_email,action,entity_type,entity_id,payload)
  values(mail,'seller_access_claimed','seller',inv.seller_id::text,'{}'::jsonb);
  return true;
end $$;
revoke all on function public.claim_seller_access(text) from public,anon;
grant execute on function public.claim_seller_access(text) to authenticated;

create or replace function public.seller_dashboard()
returns jsonb language plpgsql security definer set search_path=public as $$
declare sid uuid; seller_row sellers;
begin
  select sa.seller_id into sid from seller_accounts sa where sa.user_id=auth.uid() and sa.active=true;
  if sid is null then raise exception 'seller access required'; end if;
  select * into seller_row from sellers where id=sid;
  return jsonb_build_object(
    'seller',jsonb_build_object('id',seller_row.id,'name',seller_row.name,'code',seller_row.code,'team',seller_row.team,'whatsapp',seller_row.whatsapp,'email',lower(auth.jwt()->>'email')),
    'summary',jsonb_build_object(
      'sold_numbers',(select count(*) from raffle_numbers rn join orders o on o.id=rn.order_id where o.seller_id=sid and rn.status='paid'),
      'revenue_cents',(select coalesce(sum(o.amount_cents),0) from orders o where o.seller_id=sid and o.status='paid'),
      'pending_orders',(select count(*) from orders o where o.seller_id=sid and o.status='pending'),
      'buyers',(select count(distinct o.buyer_phone) from orders o where o.seller_id=sid and o.status='paid')
    ),
    'campaigns',coalesce((select jsonb_agg(to_jsonb(x) order by x.created_at desc) from (
      select c.id,c.name,c.slug,c.status,c.price_cents,c.total_numbers,cs.goal,cs.active,c.created_at,
      (select count(*) from raffle_numbers rn join orders o on o.id=rn.order_id where o.seller_id=sid and o.campaign_id=c.id and rn.status='paid') sold_numbers,
      (select coalesce(sum(o.amount_cents),0) from orders o where o.seller_id=sid and o.campaign_id=c.id and o.status='paid') revenue_cents
      from campaign_sellers cs join campaigns c on c.id=cs.campaign_id
      where cs.seller_id=sid
    ) x),'[]'::jsonb),
    'orders',coalesce((select jsonb_agg(to_jsonb(x) order by x.created_at desc) from (
      select o.id,o.public_token,o.buyer_name,o.buyer_phone,o.status,o.amount_cents,o.payment_reference,o.created_at,o.provider_paid_at,
      c.name campaign_name,c.slug campaign_slug,
      coalesce((select jsonb_agg(rn.number order by rn.number) from raffle_numbers rn where rn.order_id=o.id),'[]'::jsonb) numbers
      from orders o join campaigns c on c.id=o.campaign_id
      where o.seller_id=sid order by o.created_at desc limit 200
    ) x),'[]'::jsonb)
  );
end $$;
revoke all on function public.seller_dashboard() from public,anon;
grant execute on function public.seller_dashboard() to authenticated;

create or replace function public.admin_financial_dashboard()
returns jsonb language plpgsql security definer set search_path=public as $$
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  return jsonb_build_object(
    'summary',jsonb_build_object(
      'gross_cents',(select coalesce(sum(amount_cents),0) from orders where status='paid'),
      'net_cents',(select coalesce(sum(provider_net_value_cents),0) from orders where status='paid' and provider_net_value_cents is not null),
      'paid_orders',(select count(*) from orders where status='paid'),
      'pending_orders',(select count(*) from orders where status='pending'),
      'expired_orders',(select count(*) from orders where status='expired'),
      'cancelled_orders',(select count(*) from orders where status='cancelled'),
      'alerts',(select count(*) from orders where provider_status in ('AMOUNT_MISMATCH','PAYMENT_REVIEW_REQUIRED','PAYMENT_RECEIVED_AFTER_LOCAL_CLOSE','PAYMENT_REFUNDED','PAYMENT_CHARGEBACK_REQUESTED','PAYMENT_CHARGEBACK_DISPUTE'))
    ),
    'daily',coalesce((select jsonb_agg(to_jsonb(x) order by x.day_value) from (
      select d::date as day_value,
        coalesce((select sum(o.amount_cents) from orders o where o.status='paid' and o.provider_paid_at>=d and o.provider_paid_at<d+interval '1 day'),0) as gross_cents,
        coalesce((select sum(o.provider_net_value_cents) from orders o where o.status='paid' and o.provider_paid_at>=d and o.provider_paid_at<d+interval '1 day'),0) as net_cents,
        (select count(*) from orders o where o.status='paid' and o.provider_paid_at>=d and o.provider_paid_at<d+interval '1 day') as paid_orders
      from generate_series(date_trunc('day',now())-interval '29 days',date_trunc('day',now()),interval '1 day') d
    ) x),'[]'::jsonb),
    'by_seller',coalesce((select jsonb_agg(to_jsonb(x) order by x.revenue_cents desc) from (
      select s.id,s.name,s.code,
        count(*) filter(where o.status='paid') as paid_orders,
        coalesce(sum(o.amount_cents) filter(where o.status='paid'),0) as revenue_cents
      from sellers s left join orders o on o.seller_id=s.id
      group by s.id,s.name,s.code order by revenue_cents desc limit 20
    ) x),'[]'::jsonb),
    'by_campaign',coalesce((select jsonb_agg(to_jsonb(x) order by x.revenue_cents desc) from (
      select c.id,c.name,c.slug,
        count(*) filter(where o.status='paid') as paid_orders,
        coalesce(sum(o.amount_cents) filter(where o.status='paid'),0) as revenue_cents
      from campaigns c left join orders o on o.campaign_id=c.id
      group by c.id,c.name,c.slug order by revenue_cents desc
    ) x),'[]'::jsonb)
  );
end $$;
revoke all on function public.admin_financial_dashboard() from public,anon;
grant execute on function public.admin_financial_dashboard() to authenticated;

create or replace function public.admin_audit_dashboard()
returns jsonb language plpgsql security definer set search_path=public as $$
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  return jsonb_build_object(
    'audit_logs',coalesce((select jsonb_agg(to_jsonb(x) order by x.created_at desc) from (
      select id,actor_email,action,entity_type,entity_id,payload,created_at from audit_logs order by created_at desc limit 250
    ) x),'[]'::jsonb),
    'payment_events',coalesce((select jsonb_agg(to_jsonb(x) order by x.created_at desc) from (
      select id,provider,provider_event_id,event_type,provider_payment_id,provider_qr_id,processed,processing_note,created_at
      from payment_events order by created_at desc limit 250
    ) x),'[]'::jsonb)
  );
end $$;
revoke all on function public.admin_audit_dashboard() from public,anon;
grant execute on function public.admin_audit_dashboard() to authenticated;

create or replace function public.admin_duplicate_campaign(p_id uuid,p_name text,p_slug text)
returns uuid language plpgsql security definer set search_path=public as $$
declare src campaigns; nid uuid;
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  select * into src from campaigns where id=p_id;
  if not found then raise exception 'campaign not found'; end if;
  if p_slug !~ '^[a-z0-9-]{2,80}$' then raise exception 'invalid slug'; end if;
  insert into campaigns(name,slug,description,price_cents,total_numbers,status,pix_key,pix_receiver,pix_city)
  values(left(trim(p_name),120),p_slug,src.description,src.price_cents,src.total_numbers,'draft',src.pix_key,src.pix_receiver,src.pix_city)
  returning id into nid;
  insert into raffle_numbers(campaign_id,number,status)
    select nid,g.n,'available' from generate_series(1,src.total_numbers) g(n);
  insert into campaign_sellers(campaign_id,seller_id,goal,active)
    select nid,seller_id,goal,active from campaign_sellers where campaign_id=p_id;
  insert into audit_logs(actor_email,action,entity_type,entity_id,payload)
  values(lower(auth.jwt()->>'email'),'duplicate_campaign','campaign',nid::text,jsonb_build_object('source_id',p_id));
  return nid;
end $$;
revoke all on function public.admin_duplicate_campaign(uuid,text,text) from public,anon;
grant execute on function public.admin_duplicate_campaign(uuid,text,text) to authenticated;

create or replace function public.admin_bulk_sellers(p_campaign_id uuid,p_rows jsonb)
returns integer language plpgsql security definer set search_path=public as $$
declare r jsonb; count_rows integer:=0; sid uuid; v_code text; nm text; tm text; wa text; gl integer;
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  if jsonb_typeof(p_rows)<>'array' or jsonb_array_length(p_rows)>500 then raise exception 'invalid rows'; end if;
  for r in select * from jsonb_array_elements(p_rows) loop
    v_code:=upper(trim(coalesce(r->>'code','')));
    nm:=trim(coalesce(r->>'name',''));
    tm:=trim(coalesce(r->>'team',''));
    wa:=trim(coalesce(r->>'whatsapp',''));
    begin gl:=greatest(coalesce((r->>'goal')::integer,30),0); exception when others then gl:=30; end;
    if length(nm)<2 or v_code !~ '^[A-Z0-9_-]{2,32}$' then continue; end if;
    select id into sid from sellers where sellers.code=v_code;
    if sid is null then
      insert into sellers(name,code,team,goal,whatsapp) values(left(nm,100),v_code,left(tm,100),gl,left(wa,20)) returning id into sid;
    else
      update sellers set name=left(nm,100),team=left(tm,100),whatsapp=left(wa,20),updated_at=now() where id=sid;
    end if;
    insert into campaign_sellers(campaign_id,seller_id,goal,active) values(p_campaign_id,sid,gl,true)
      on conflict(campaign_id,seller_id) do update set goal=excluded.goal,active=true;
    count_rows:=count_rows+1;
  end loop;
  insert into audit_logs(actor_email,action,entity_type,entity_id,payload)
  values(lower(auth.jwt()->>'email'),'bulk_sellers','campaign',p_campaign_id::text,jsonb_build_object('count',count_rows));
  return count_rows;
end $$;
revoke all on function public.admin_bulk_sellers(uuid,jsonb) from public,anon;
grant execute on function public.admin_bulk_sellers(uuid,jsonb) to authenticated;


