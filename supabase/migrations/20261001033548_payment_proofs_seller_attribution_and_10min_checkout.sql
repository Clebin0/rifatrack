-- Recovered verbatim from Supabase migration history; 20261001033548.

alter table public.orders
  add column if not exists buyer_email text not null default '',
  add column if not exists pix_txid text,
  add column if not exists proof_path text,
  add column if not exists proof_uploaded_at timestamptz,
  add column if not exists proof_status text not null default 'none';

do $$ begin
  alter table public.orders add constraint orders_proof_status_check
    check (proof_status in ('none','submitted','approved','rejected'));
exception when duplicate_object then null; end $$;

update public.orders
set pix_txid = 'RT' || upper(substr(replace(id::text,'-',''),1,23))
where pix_txid is null;

alter table public.orders alter column pix_txid set not null;
create unique index if not exists orders_pix_txid_uidx on public.orders(pix_txid);

alter table public.campaigns add column if not exists pix_city text not null default 'CURITIBA';

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('payment-proofs','payment-proofs',false,5242880,array['image/jpeg','image/png','application/pdf'])
on conflict(id) do update set
  public=false,
  file_size_limit=5242880,
  allowed_mime_types=array['image/jpeg','image/png','application/pdf'];

create or replace function public.can_upload_payment_proof(p_name text)
returns boolean
language sql
stable
security definer
set search_path=public
as $$
  select exists(
    select 1 from public.orders o
    where o.public_token::text = split_part(p_name,'/',1)
      and o.status='pending'
      and o.expires_at > now()
      and split_part(p_name,'/',2) ~ '^comprovante\.(jpg|jpeg|png|pdf)$'
      and o.proof_path is null
  )
$$;

revoke all on function public.can_upload_payment_proof(text) from public;
grant execute on function public.can_upload_payment_proof(text) to anon, authenticated, service_role;

drop policy if exists payment_proofs_insert_pending on storage.objects;
create policy payment_proofs_insert_pending
on storage.objects for insert to anon
with check (
  bucket_id='payment-proofs'
  and public.can_upload_payment_proof(name)
);

drop policy if exists payment_proofs_admin_read on storage.objects;
create policy payment_proofs_admin_read
on storage.objects for select to authenticated
using (
  bucket_id='payment-proofs'
  and public.is_admin()
);

create or replace function public.register_payment_proof(p_token uuid,p_path text)
returns boolean
language plpgsql
security definer
set search_path=public
as $$
declare o public.orders;
begin
  select * into o from public.orders where public_token=p_token for update;
  if not found then raise exception 'order not found'; end if;
  if o.status<>'pending' or o.expires_at<=now() then raise exception 'order unavailable'; end if;
  if split_part(p_path,'/',1)<>p_token::text then raise exception 'invalid path'; end if;
  if split_part(p_path,'/',2) !~ '^comprovante\.(jpg|jpeg|png|pdf)$' then raise exception 'invalid file'; end if;
  if not exists(select 1 from storage.objects so where so.bucket_id='payment-proofs' and so.name=p_path) then
    raise exception 'file not found';
  end if;
  update public.orders
  set proof_path=p_path,proof_uploaded_at=now(),proof_status='submitted'
  where id=o.id;
  return true;
end $$;

revoke all on function public.register_payment_proof(uuid,text) from public,authenticated;
grant execute on function public.register_payment_proof(uuid,text) to anon,service_role;

create or replace function public.admin_set_proof_status(p_order_id uuid,p_status text)
returns boolean
language plpgsql
security definer
set search_path=public
as $$
begin
  if not public.is_admin() or p_status not in ('approved','rejected') then raise exception 'forbidden'; end if;
  update public.orders
    set proof_status=p_status
  where id=p_order_id and proof_path is not null;
  if not found then return false; end if;
  insert into public.audit_logs(actor_email,action,entity_type,entity_id,payload)
  values(lower(auth.jwt()->>'email'),'proof_status','order',p_order_id::text,jsonb_build_object('status',p_status));
  return true;
end $$;

revoke all on function public.admin_set_proof_status(uuid,text) from public,anon;
grant execute on function public.admin_set_proof_status(uuid,text) to authenticated;

create or replace function public.public_campaign(p_slug text,p_seller_code text default null)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  c campaigns;
  seller_name text;
  draw_json jsonb;
begin
  if p_slug !~ '^[a-z0-9-]{2,80}$' then return null; end if;
  select * into c from campaigns where slug=p_slug and status in ('active','closed');
  if not found then return null; end if;

  if c.status='active' then perform release_expired_reservations(c.id); end if;

  if p_seller_code is not null and p_seller_code<>'' then
    select s.name into seller_name
    from sellers s join campaign_sellers cs on cs.seller_id=s.id
    where cs.campaign_id=c.id and cs.active=true and s.active=true and s.code=upper(p_seller_code);
  end if;

  select case when d.id is null then null else jsonb_build_object('number',d.number,'drawn_at',d.drawn_at) end
  into draw_json from (select 1) x left join draws d on d.campaign_id=c.id;

  return jsonb_build_object(
    'id',c.id,'name',c.name,'slug',c.slug,'description',c.description,
    'status',c.status,'price_cents',c.price_cents,'total_numbers',c.total_numbers,
    'pix_key',c.pix_key,'pix_receiver',c.pix_receiver,'pix_city',c.pix_city,'ends_at',c.ends_at,
    'seller_name',seller_name,'draw_result',draw_json,
    'sellers',coalesce((
      select jsonb_agg(jsonb_build_object('name',s.name,'code',s.code,'team',s.team) order by s.name)
      from sellers s join campaign_sellers cs on cs.seller_id=s.id
      where cs.campaign_id=c.id and cs.active=true and s.active=true
    ),'[]'::jsonb),
    'unavailable',coalesce((select jsonb_agg(number order by number) from raffle_numbers where campaign_id=c.id and status<>'available'),'[]'::jsonb),
    'sold_numbers',(select count(*) from raffle_numbers where campaign_id=c.id and status='paid'),
    'reserved_numbers',(select count(*) from raffle_numbers where campaign_id=c.id and status='reserved')
  );
end $$;

revoke all on function public.public_campaign(text,text) from public;
grant execute on function public.public_campaign(text,text) to anon,authenticated,service_role;

drop function if exists public.reserve_raffle_numbers(text,text,text,text,text,text,int[]);

create or replace function public.reserve_raffle_numbers(
  p_internal_secret text,p_fingerprint text,p_campaign_slug text,p_seller_code text,
  p_buyer_name text,p_buyer_phone text,p_buyer_email text,p_numbers int[]
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
  if p_buyer_email<>'' and p_buyer_email !~* '^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$' then raise exception 'invalid email'; end if;
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
    if not found then raise exception 'seller unavailable'; end if;
  elsif exists(select 1 from campaign_sellers cs join sellers se on se.id=cs.seller_id where cs.campaign_id=c.id and cs.active=true and se.active=true) then
    raise exception 'seller required';
  end if;

  select count(*) into locked_available from (
    select id,status from raffle_numbers
    where campaign_id=c.id and number=any(p_numbers)
    for update
  ) q where q.status='available';
  if locked_available<>wanted then raise exception 'number unavailable'; end if;

  insert into orders(campaign_id,seller_id,buyer_name,buyer_phone,buyer_email,amount_cents,expires_at,payment_reference,pix_txid)
  values(
    c.id,s.id,left(trim(p_buyer_name),100),left(trim(p_buyer_phone),20),left(lower(trim(coalesce(p_buyer_email,''))),180),
    wanted*c.price_cents,now()+interval '10 minutes',
    'RT-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,10)),
    'RT'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,23))
  )
  returning * into o;

  update raffle_numbers set order_id=o.id,status='reserved',reserved_until=o.expires_at
  where campaign_id=c.id and number=any(p_numbers) and status='available';

  return jsonb_build_object(
    'id',o.id,'public_token',o.public_token,'amount_cents',o.amount_cents,
    'expires_at',o.expires_at,'payment_reference',o.payment_reference,'pix_txid',o.pix_txid
  );
end $$;

revoke all on function public.reserve_raffle_numbers(text,text,text,text,text,text,text,int[]) from public,authenticated;
grant execute on function public.reserve_raffle_numbers(text,text,text,text,text,text,text,int[]) to anon,service_role;

create or replace function public.public_order(p_token uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare o orders; c campaigns; s sellers;
begin
  select * into o from orders where public_token=p_token;
  if not found then return null; end if;
  perform release_expired_reservations(o.campaign_id);
  select * into o from orders where public_token=p_token;
  select * into c from campaigns where id=o.campaign_id;
  if o.seller_id is not null then select * into s from sellers where id=o.seller_id; end if;
  return jsonb_build_object(
    'status',o.status,'amount_cents',o.amount_cents,'expires_at',o.expires_at,
    'payment_reference',o.payment_reference,'pix_txid',o.pix_txid,
    'buyer_name',o.buyer_name,'campaign_name',c.name,'campaign_slug',c.slug,
    'seller_name',s.name,'pix_key',c.pix_key,'pix_receiver',c.pix_receiver,'pix_city',c.pix_city,
    'proof_status',o.proof_status,'proof_uploaded_at',o.proof_uploaded_at,
    'numbers',coalesce((select jsonb_agg(number order by number) from raffle_numbers where order_id=o.id),'[]'::jsonb)
  );
end $$;

revoke all on function public.public_order(uuid) from public;
grant execute on function public.public_order(uuid) to anon,authenticated,service_role;

create or replace function public.admin_dashboard()
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
      select c.id,c.name,c.slug,c.description,c.price_cents,c.total_numbers,c.status,c.pix_key,c.pix_receiver,c.pix_city,c.ends_at,c.created_at,
      (select count(*) from raffle_numbers rn where rn.campaign_id=c.id and rn.status='paid') sold_numbers,
      (select count(*) from raffle_numbers rn where rn.campaign_id=c.id and rn.status='reserved') reserved_numbers,
      (select coalesce(sum(o.amount_cents),0) from orders o where o.campaign_id=c.id and o.status='paid') revenue_cents,
      (select d.number from draws d where d.campaign_id=c.id) draw_number,
      (select d.drawn_at from draws d where d.campaign_id=c.id) drawn_at
      from campaigns c
    ) x),'[]'::jsonb),
    'sellers',coalesce((select jsonb_agg(to_jsonb(x) order by x.sold_numbers desc,x.name) from (
      select cs.campaign_id,c.name campaign_name,c.slug campaign_slug,s.id,s.name,s.code,s.team,cs.goal,cs.active,
      (select count(*) from raffle_numbers rn join orders o on o.id=rn.order_id where o.campaign_id=cs.campaign_id and o.seller_id=s.id and rn.status='paid') sold_numbers,
      (select coalesce(sum(o.amount_cents),0) from orders o where o.campaign_id=cs.campaign_id and o.seller_id=s.id and o.status='paid') revenue_cents
      from campaign_sellers cs join campaigns c on c.id=cs.campaign_id join sellers s on s.id=cs.seller_id
    ) x),'[]'::jsonb),
    'orders',coalesce((select jsonb_agg(to_jsonb(x) order by x.created_at desc) from (
      select o.id,o.public_token,o.buyer_name,o.buyer_phone,o.buyer_email,o.status,o.amount_cents,o.payment_reference,o.pix_txid,o.expires_at,o.created_at,
      o.proof_path,o.proof_status,o.proof_uploaded_at,
      c.name campaign_name,c.slug campaign_slug,s.name seller_name,
      coalesce((select jsonb_agg(rn.number order by rn.number) from raffle_numbers rn where rn.order_id=o.id),'[]'::jsonb) numbers
      from orders o join campaigns c on c.id=o.campaign_id left join sellers s on s.id=o.seller_id
      order by o.created_at desc limit 250
    ) x),'[]'::jsonb)
  );
end $$;


