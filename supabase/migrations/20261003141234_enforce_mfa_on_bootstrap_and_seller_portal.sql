-- Recovered verbatim from Supabase migration history; 20261003141234.

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
  insert into admin_users(email) values(email_value) on conflict(email) do nothing;
  delete from app_settings where key='bootstrap_admin';
  insert into audit_logs(actor_email,action,entity_type,entity_id,payload)
  values(email_value,'bootstrap_admin','admin',email_value,jsonb_build_object('aal','aal2'));
  return true;
end $$;

create or replace function public.claim_seller_access(p_code text)
returns boolean language plpgsql security definer set search_path=public,extensions as $$
declare inv seller_invites; mail text;
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  if coalesce(auth.jwt()->>'aal','aal1')<>'aal2' then raise exception 'mfa_required'; end if;
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
  values(mail,'seller_access_claimed','seller',inv.seller_id::text,jsonb_build_object('aal','aal2'));
  return true;
end $$;

create or replace function public.seller_dashboard()
returns jsonb language plpgsql security definer set search_path=public as $$
declare sid uuid; seller_row sellers;
begin
  if auth.uid() is null or coalesce(auth.jwt()->>'aal','aal1')<>'aal2' then raise exception 'mfa_required'; end if;
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
      from campaign_sellers cs join campaigns c on c.id=cs.campaign_id where cs.seller_id=sid
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


