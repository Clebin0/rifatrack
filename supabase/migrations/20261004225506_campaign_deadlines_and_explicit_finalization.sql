-- Recovered verbatim from Supabase migration history; 20261004225506.

alter table public.campaigns
  add column if not exists finalized_at timestamptz,
  add column if not exists finalized_by text;

create or replace function public.admin_create_campaign(
  p_name text,p_slug text,p_description text,p_price_cents integer,p_total_numbers integer,
  p_pix_key text,p_pix_receiver text,p_ends_at timestamptz default null
) returns uuid language plpgsql security definer set search_path=public as $$
declare cid uuid;
begin
  if not public.admin_role_aal2(array['owner','admin','operador']) then raise exception 'forbidden'; end if;
  if length(trim(p_name))<3 or p_slug !~ '^[a-z0-9-]{2,80}$' or p_price_cents<1 or p_total_numbers<1 or p_total_numbers>100000 then
    raise exception 'invalid campaign';
  end if;
  if p_ends_at is not null and p_ends_at<=now() then raise exception 'deadline must be in the future'; end if;

  insert into campaigns(name,slug,description,price_cents,total_numbers,pix_key,pix_receiver,ends_at,status)
  values(left(trim(p_name),120),p_slug,left(coalesce(p_description,''),2000),p_price_cents,p_total_numbers,
    left(coalesce(p_pix_key,''),180),left(coalesce(p_pix_receiver,''),180),p_ends_at,'draft')
  returning id into cid;

  insert into raffle_numbers(campaign_id,number,status)
  select cid,generate_series(1,p_total_numbers),'available';

  insert into audit_logs(actor_email,action,entity_type,entity_id,payload)
  values(lower(auth.jwt()->>'email'),'create','campaign',cid::text,
    jsonb_build_object('role',current_admin_role(),'ends_at',p_ends_at));
  return cid;
end $$;

create or replace function public.admin_update_campaign(
  p_id uuid,p_name text,p_description text,p_price_cents integer,p_pix_key text,p_pix_receiver text,p_ends_at timestamptz default null
) returns boolean language plpgsql security definer set search_path=public as $$
declare c campaigns;
begin
  if not public.admin_role_aal2(array['owner','admin','operador']) then raise exception 'forbidden'; end if;
  select * into c from campaigns where id=p_id for update;
  if not found then return false; end if;
  if c.finalized_at is not null then raise exception 'finalized campaign cannot be edited'; end if;
  if p_ends_at is not null and p_ends_at<=now() then raise exception 'deadline must be in the future'; end if;

  update campaigns
  set name=left(trim(p_name),120),
      description=left(coalesce(p_description,''),2000),
      price_cents=p_price_cents,
      pix_key=left(coalesce(p_pix_key,''),180),
      pix_receiver=left(coalesce(p_pix_receiver,''),180),
      ends_at=p_ends_at,
      updated_at=now()
  where id=p_id;

  insert into audit_logs(actor_email,action,entity_type,entity_id,payload)
  values(lower(auth.jwt()->>'email'),'update','campaign',p_id::text,
    jsonb_build_object('role',current_admin_role(),'ends_at',p_ends_at));
  return true;
end $$;

create or replace function public.admin_set_campaign_status(p_id uuid,p_status text)
returns boolean language plpgsql security definer set search_path=public,extensions as $$
declare
  c campaigns;
  paid_list text;
  list_hash text;
  seed text;
  commitment text;
  eligible integer;
  actor text:=lower(coalesce(auth.jwt()->>'email',''));
begin
  if not public.admin_role_aal2(array['owner','admin','operador']) or p_status not in('draft','active','closed') then
    raise exception 'forbidden';
  end if;

  select * into c from campaigns where id=p_id for update;
  if not found then return false; end if;

  if c.finalized_at is not null and p_status<>'closed' then
    raise exception 'finalized campaign cannot be reopened';
  end if;

  if p_status='active' then
    if c.ends_at is null then raise exception 'deadline required'; end if;
    if c.ends_at<=now() then raise exception 'campaign deadline reached'; end if;
  end if;

  if p_status='closed' and c.finalized_at is null then
    perform release_expired_reservations(p_id);

    if exists(select 1 from orders where campaign_id=p_id and status='pending') then
      raise exception 'pending orders exist';
    end if;

    select count(*),coalesce(string_agg(number::text,',' order by number),'')
      into eligible,paid_list
    from raffle_numbers
    where campaign_id=p_id and status='paid';

    if eligible>0 then
      list_hash:=encode(extensions.digest(convert_to(paid_list,'UTF8'),'sha256'),'hex');
      seed:=encode(extensions.gen_random_bytes(32),'hex');
      commitment:=encode(extensions.digest(convert_to(seed||':'||list_hash,'UTF8'),'sha256'),'hex');

      insert into draw_commitments(campaign_id,eligible_count,paid_list_hash,seed_commitment,seed_secret)
      values(p_id,eligible,list_hash,commitment,seed)
      on conflict(campaign_id) do nothing;
    end if;

    update campaigns
    set status='closed',finalized_at=now(),finalized_by=actor,updated_at=now()
    where id=p_id;
  elsif p_status<>'closed' then
    update campaigns set status=p_status,updated_at=now() where id=p_id;
  end if;

  insert into audit_logs(actor_email,action,entity_type,entity_id,payload)
  values(actor,
    case when p_status='closed' then 'finalize_campaign' else 'status' end,
    'campaign',p_id::text,
    jsonb_build_object(
      'status',p_status,
      'role',current_admin_role(),
      'ends_at',c.ends_at,
      'finalized_at',case when p_status='closed' then now() else c.finalized_at end,
      'draw_commitment',(select seed_commitment from draw_commitments where campaign_id=p_id)
    )
  );
  return true;
end $$;

create or replace function public.public_active_campaigns()
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
    from campaigns c
    where c.status='active'
      and c.finalized_at is null
      and (c.ends_at is null or c.ends_at>now())
  ),'[]'::jsonb);
end $$;

create or replace function public.public_campaign(p_slug text,p_seller_code text default null)
returns jsonb language plpgsql security definer set search_path=public as $$
declare
  c campaigns;
  seller_name text;
  seller_whatsapp text;
  draw_json jsonb;
  effective_status text;
  deadline_reached boolean;
begin
  if p_slug !~ '^[a-z0-9-]{2,80}$' then return null; end if;

  select * into c
  from campaigns
  where slug=p_slug and status in ('active','closed');
  if not found then return null; end if;

  if c.status='active' then perform release_expired_reservations(c.id); end if;

  deadline_reached := c.ends_at is not null and c.ends_at<=now();
  effective_status := case
    when c.status='closed' or c.finalized_at is not null or deadline_reached then 'closed'
    else 'active'
  end;

  if p_seller_code is not null and p_seller_code<>'' then
    select s.name,s.whatsapp into seller_name,seller_whatsapp
    from sellers s join campaign_sellers cs on cs.seller_id=s.id
    where cs.campaign_id=c.id and cs.active=true and s.active=true and s.code=upper(p_seller_code);
  end if;

  select case when d.id is null then null else jsonb_build_object('number',d.number,'drawn_at',d.drawn_at) end
  into draw_json
  from (select 1) x left join draws d on d.campaign_id=c.id;

  return jsonb_build_object(
    'id',c.id,'name',c.name,'slug',c.slug,'description',c.description,
    'status',effective_status,'stored_status',c.status,'price_cents',c.price_cents,'total_numbers',c.total_numbers,
    'pix_key',c.pix_key,'pix_receiver',c.pix_receiver,'pix_city',c.pix_city,
    'ends_at',c.ends_at,'deadline_reached',deadline_reached,
    'finalized_at',c.finalized_at,'finalized_by',c.finalized_by,
    'seller_name',seller_name,'seller_whatsapp',seller_whatsapp,'draw_result',draw_json,
    'sellers',coalesce((
      select jsonb_agg(jsonb_build_object('name',s.name,'code',s.code,'team',s.team,'whatsapp',s.whatsapp) order by s.name)
      from sellers s join campaign_sellers cs on cs.seller_id=s.id
      where cs.campaign_id=c.id and cs.active=true and s.active=true
    ),'[]'::jsonb),
    'unavailable',coalesce((select jsonb_agg(number order by number) from raffle_numbers where campaign_id=c.id and status<>'available'),'[]'::jsonb),
    'sold_numbers',(select count(*) from raffle_numbers where campaign_id=c.id and status='paid'),
    'reserved_numbers',(select count(*) from raffle_numbers where campaign_id=c.id and status='reserved')
  );
end $$;

create or replace function public.admin_dashboard()
returns jsonb language plpgsql security definer set search_path=public as $$
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  perform release_expired_reservations(null);

  return jsonb_build_object(
    'admin_email',lower(auth.jwt()->>'email'),
    'admin_role',public.current_admin_role(),
    'summary',jsonb_build_object(
      'campaigns',(select count(*) from campaigns),
      'active_campaigns',(select count(*) from campaigns where status='active' and finalized_at is null and (ends_at is null or ends_at>now())),
      'paid_revenue_cents',(select coalesce(sum(amount_cents),0) from orders where status='paid'),
      'pending_orders',(select count(*) from orders where status='pending'),
      'payment_alerts',(select count(*) from orders where provider_status in ('AMOUNT_MISMATCH','PAYMENT_REVIEW_REQUIRED','PAYMENT_RECEIVED_AFTER_LOCAL_CLOSE','PAYMENT_REFUNDED','PAYMENT_CHARGEBACK_REQUESTED','PAYMENT_CHARGEBACK_DISPUTE'))
    ),
    'campaigns',coalesce((select jsonb_agg(to_jsonb(x) order by x.created_at desc) from (
      select c.id,c.name,c.slug,c.description,c.price_cents,c.total_numbers,c.status,c.pix_key,c.pix_receiver,c.pix_city,
        c.ends_at,c.finalized_at,c.finalized_by,
        (c.ends_at is not null and c.ends_at<=now()) deadline_reached,
        c.created_at,
        (select count(*) from raffle_numbers rn where rn.campaign_id=c.id and rn.status='paid') sold_numbers,
        (select count(*) from raffle_numbers rn where rn.campaign_id=c.id and rn.status='reserved') reserved_numbers,
        (select coalesce(sum(o.amount_cents),0) from orders o where o.campaign_id=c.id and o.status='paid') revenue_cents,
        (select d.number from draws d where d.campaign_id=c.id) draw_number,
        (select d.drawn_at from draws d where d.campaign_id=c.id) drawn_at
      from campaigns c
    ) x),'[]'::jsonb),
    'sellers',coalesce((select jsonb_agg(to_jsonb(x) order by x.sold_numbers desc,x.name) from (
      select cs.campaign_id,c.name campaign_name,c.slug campaign_slug,s.id,s.name,s.code,s.team,s.whatsapp,cs.goal,cs.active,
        (select count(*) from raffle_numbers rn join orders o on o.id=rn.order_id where o.campaign_id=cs.campaign_id and o.seller_id=s.id and rn.status='paid') sold_numbers,
        (select coalesce(sum(o.amount_cents),0) from orders o where o.campaign_id=cs.campaign_id and o.seller_id=s.id and o.status='paid') revenue_cents
      from campaign_sellers cs join campaigns c on c.id=cs.campaign_id join sellers s on s.id=cs.seller_id
    ) x),'[]'::jsonb),
    'orders',coalesce((select jsonb_agg(to_jsonb(x) order by x.created_at desc) from (
      select o.id,o.public_token,o.buyer_name,o.buyer_phone,o.buyer_email,o.status,o.amount_cents,o.payment_reference,o.pix_txid,o.expires_at,o.created_at,
        o.proof_path,o.proof_status,o.proof_uploaded_at,o.payment_provider,o.provider_qr_id,o.provider_payment_id,o.provider_status,o.provider_paid_at,o.provider_net_value_cents,o.pix_transaction_id,
        c.name campaign_name,c.slug campaign_slug,s.name seller_name,
        coalesce((select jsonb_agg(rn.number order by rn.number) from raffle_numbers rn where rn.order_id=o.id),'[]'::jsonb) numbers
      from orders o join campaigns c on c.id=o.campaign_id left join sellers s on s.id=o.seller_id
      order by o.created_at desc limit 250
    ) x),'[]'::jsonb)
  );
end $$;


