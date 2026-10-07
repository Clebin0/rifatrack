-- Recovered verbatim from Supabase migration history; 20261003140602.

create or replace function public.is_admin_aal2()
returns boolean language sql stable security definer set search_path=public as $$
  select public.is_admin() and coalesce(auth.jwt()->>'aal','aal1')='aal2'
$$;
revoke all on function public.is_admin_aal2() from public,anon;
grant execute on function public.is_admin_aal2() to authenticated;

create or replace function public.admin_create_campaign(p_name text,p_slug text,p_description text,p_price_cents integer,p_total_numbers integer,p_pix_key text,p_pix_receiver text,p_ends_at timestamptz default null)
returns uuid language plpgsql security definer set search_path=public as $$
declare cid uuid;
begin
  if not public.is_admin_aal2() then raise exception 'mfa_required'; end if;
  if length(trim(p_name))<3 or p_slug !~ '^[a-z0-9-]{2,80}$' or p_price_cents<1 or p_total_numbers<1 or p_total_numbers>100000 then raise exception 'invalid campaign'; end if;
  insert into campaigns(name,slug,description,price_cents,total_numbers,pix_key,pix_receiver,ends_at,status)
  values(left(trim(p_name),120),p_slug,left(coalesce(p_description,''),2000),p_price_cents,p_total_numbers,left(coalesce(p_pix_key,''),180),left(coalesce(p_pix_receiver,''),180),p_ends_at,'draft')
  returning id into cid;
  insert into raffle_numbers(campaign_id,number,status) select cid,generate_series(1,p_total_numbers),'available';
  insert into audit_logs(actor_email,action,entity_type,entity_id,payload) values(lower(auth.jwt()->>'email'),'create','campaign',cid::text,jsonb_build_object('aal','aal2'));
  return cid;
end $$;

create or replace function public.admin_update_campaign(p_id uuid,p_name text,p_description text,p_price_cents integer,p_pix_key text,p_pix_receiver text,p_ends_at timestamptz default null)
returns boolean language plpgsql security definer set search_path=public as $$
begin
  if not public.is_admin_aal2() then raise exception 'mfa_required'; end if;
  update campaigns set name=left(trim(p_name),120),description=left(coalesce(p_description,''),2000),price_cents=p_price_cents,
    pix_key=left(coalesce(p_pix_key,''),180),pix_receiver=left(coalesce(p_pix_receiver,''),180),ends_at=p_ends_at,updated_at=now()
  where id=p_id;
  insert into audit_logs(actor_email,action,entity_type,entity_id,payload) values(lower(auth.jwt()->>'email'),'update','campaign',p_id::text,jsonb_build_object('aal','aal2'));
  return found;
end $$;

create or replace function public.admin_set_campaign_status(p_id uuid,p_status text)
returns boolean language plpgsql security definer set search_path=public as $$
begin
  if not public.is_admin_aal2() or p_status not in('draft','active','closed') then raise exception 'mfa_required'; end if;
  update campaigns set status=p_status,updated_at=now() where id=p_id;
  insert into audit_logs(actor_email,action,entity_type,entity_id,payload) values(lower(auth.jwt()->>'email'),'status','campaign',p_id::text,jsonb_build_object('status',p_status,'aal','aal2'));
  return found;
end $$;

create or replace function public.admin_set_order_status(p_order_id uuid,p_status text)
returns boolean language plpgsql security definer set search_path=public as $$
declare o orders;
begin
  if not public.is_admin_aal2() or p_status not in('paid','cancelled') then raise exception 'mfa_required'; end if;
  select * into o from orders where id=p_order_id for update;
  if not found then return false; end if;
  if p_status='paid' then
    if o.status='paid' then return true; end if;
    if o.status<>'pending' or o.expires_at<now() then raise exception 'order unavailable'; end if;
    update orders set status='paid',provider_paid_at=coalesce(provider_paid_at,now()),
      provider_status=case when payment_provider='manual' then 'MANUAL_CONFIRMED' else coalesce(provider_status,'ADMIN_CONFIRMED') end,
      proof_status=case when proof_status='submitted' then 'approved' else proof_status end
    where id=o.id;
    update raffle_numbers set status='paid',reserved_until=null where order_id=o.id;
  else
    if o.status='paid' then raise exception 'paid order cannot be cancelled'; end if;
    update orders set status='cancelled',provider_status=case when payment_provider='manual' then 'MANUAL_CANCELLED' else coalesce(provider_status,'ADMIN_CANCELLED') end where id=o.id;
    update raffle_numbers set status='available',order_id=null,reserved_until=null where order_id=o.id and status='reserved';
  end if;
  insert into audit_logs(actor_email,action,entity_type,entity_id,payload)
  values(lower(auth.jwt()->>'email'),'status','order',o.id::text,jsonb_build_object('status',p_status,'aal','aal2'));
  return true;
end $$;

create or replace function public.admin_set_proof_status(p_order_id uuid,p_status text)
returns boolean language plpgsql security definer set search_path=public as $$
begin
  if not public.is_admin_aal2() or p_status not in ('approved','rejected') then raise exception 'mfa_required'; end if;
  update public.orders set proof_status=p_status where id=p_order_id and proof_path is not null;
  if not found then return false; end if;
  insert into public.audit_logs(actor_email,action,entity_type,entity_id,payload)
  values(lower(auth.jwt()->>'email'),'proof_status','order',p_order_id::text,jsonb_build_object('status',p_status,'aal','aal2'));
  return true;
end $$;

create or replace function public.admin_create_seller_invite(p_seller_id uuid,p_email text)
returns jsonb language plpgsql security definer set search_path=public,extensions as $$
declare code text; inv seller_invites;
begin
  if not public.is_admin_aal2() then raise exception 'mfa_required'; end if;
  if p_email !~* '^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$' then raise exception 'invalid email'; end if;
  if not exists(select 1 from sellers where id=p_seller_id and active=true) then raise exception 'seller not found'; end if;
  code:='SV-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,20));
  update seller_invites set used_at=now() where seller_id=p_seller_id and used_at is null;
  insert into seller_invites(seller_id,email,code_hash,created_by)
  values(p_seller_id,lower(trim(p_email)),encode(digest(convert_to(code,'UTF8'),'sha256'),'hex'),lower(auth.jwt()->>'email'))
  returning * into inv;
  insert into audit_logs(actor_email,action,entity_type,entity_id,payload)
  values(lower(auth.jwt()->>'email'),'seller_invite','seller',p_seller_id::text,jsonb_build_object('email',lower(trim(p_email)),'aal','aal2'));
  return jsonb_build_object('code',code,'expires_at',inv.expires_at,'email',inv.email);
end $$;

create or replace function public.admin_duplicate_campaign(p_id uuid,p_name text,p_slug text)
returns uuid language plpgsql security definer set search_path=public as $$
declare src campaigns; nid uuid;
begin
  if not public.is_admin_aal2() then raise exception 'mfa_required'; end if;
  select * into src from campaigns where id=p_id;
  if not found then raise exception 'campaign not found'; end if;
  if p_slug !~ '^[a-z0-9-]{2,80}$' then raise exception 'invalid slug'; end if;
  insert into campaigns(name,slug,description,price_cents,total_numbers,status,pix_key,pix_receiver,pix_city)
  values(left(trim(p_name),120),p_slug,src.description,src.price_cents,src.total_numbers,'draft',src.pix_key,src.pix_receiver,src.pix_city)
  returning id into nid;
  insert into raffle_numbers(campaign_id,number,status) select nid,g.n,'available' from generate_series(1,src.total_numbers) g(n);
  insert into campaign_sellers(campaign_id,seller_id,goal,active) select nid,seller_id,goal,active from campaign_sellers where campaign_id=p_id;
  insert into audit_logs(actor_email,action,entity_type,entity_id,payload)
  values(lower(auth.jwt()->>'email'),'duplicate_campaign','campaign',nid::text,jsonb_build_object('source_id',p_id,'aal','aal2'));
  return nid;
end $$;

create or replace function public.admin_bulk_sellers(p_campaign_id uuid,p_rows jsonb)
returns integer language plpgsql security definer set search_path=public as $$
declare r jsonb; count_rows integer:=0; sid uuid; v_code text; nm text; tm text; wa text; gl integer;
begin
  if not public.is_admin_aal2() then raise exception 'mfa_required'; end if;
  if jsonb_typeof(p_rows)<>'array' or jsonb_array_length(p_rows)>500 then raise exception 'invalid rows'; end if;
  for r in select * from jsonb_array_elements(p_rows) loop
    v_code:=upper(trim(coalesce(r->>'code',''))); nm:=trim(coalesce(r->>'name','')); tm:=trim(coalesce(r->>'team','')); wa:=trim(coalesce(r->>'whatsapp',''));
    begin gl:=greatest(coalesce((r->>'goal')::integer,30),0); exception when others then gl:=30; end;
    if length(nm)<2 or v_code !~ '^[A-Z0-9_-]{2,32}$' then continue; end if;
    select id into sid from sellers where sellers.code=v_code;
    if sid is null then insert into sellers(name,code,team,goal,whatsapp) values(left(nm,100),v_code,left(tm,100),gl,left(wa,20)) returning id into sid;
    else update sellers set name=left(nm,100),team=left(tm,100),whatsapp=left(wa,20),updated_at=now() where id=sid; end if;
    insert into campaign_sellers(campaign_id,seller_id,goal,active) values(p_campaign_id,sid,gl,true)
      on conflict(campaign_id,seller_id) do update set goal=excluded.goal,active=true;
    count_rows:=count_rows+1;
  end loop;
  insert into audit_logs(actor_email,action,entity_type,entity_id,payload)
  values(lower(auth.jwt()->>'email'),'bulk_sellers','campaign',p_campaign_id::text,jsonb_build_object('count',count_rows,'aal','aal2'));
  return count_rows;
end $$;

create or replace function public.admin_draw_campaign(p_campaign_id uuid)
returns jsonb language plpgsql security definer set search_path=public,extensions as $$
declare v_email text; v_campaign public.campaigns; v_count bigint; v_pick bigint; v_row record; v_existing public.draws;
begin
  v_email:=lower(coalesce(auth.jwt()->>'email',''));
  if not public.is_admin_aal2() then raise exception 'mfa_required'; end if;
  select * into v_campaign from public.campaigns where id=p_campaign_id for update;
  if not found then raise exception 'campaign not found'; end if;
  if v_campaign.status <> 'closed' then raise exception 'campaign must be closed'; end if;
  select * into v_existing from public.draws where campaign_id=p_campaign_id;
  if found then return jsonb_build_object('number',v_existing.number,'drawn_at',v_existing.drawn_at,'already_drawn',true); end if;
  select count(*) into v_count from public.raffle_numbers where campaign_id=p_campaign_id and status='paid';
  if v_count < 1 then raise exception 'no paid numbers'; end if;
  v_pick := (('x' || substr(encode(extensions.digest(gen_random_uuid()::text || clock_timestamp()::text,'sha256'),'hex'),1,16))::bit(64)::bigint & 9223372036854775807) % v_count;
  select rn.number,rn.order_id into v_row from public.raffle_numbers rn where rn.campaign_id=p_campaign_id and rn.status='paid' order by rn.number offset v_pick limit 1;
  insert into public.draws(campaign_id,order_id,number,actor_email) values(p_campaign_id,v_row.order_id,v_row.number,v_email) returning * into v_existing;
  insert into public.audit_logs(actor_email,action,entity_type,entity_id,payload)
  values(v_email,'draw_campaign','campaign',p_campaign_id::text,jsonb_build_object('number',v_existing.number,'aal','aal2'));
  return jsonb_build_object('number',v_existing.number,'drawn_at',v_existing.drawn_at,'already_drawn',false);
end $$;


