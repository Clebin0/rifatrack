
alter table draw_commitments add column if not exists eligible_numbers int[];
alter table draw_commitments add column if not exists drand_round bigint;
alter table draw_commitments add column if not exists drand_chain_hash text;
alter table draw_commitments add column if not exists beacon_commitment text;
alter table draws add column if not exists drand_round bigint;
alter table draws add column if not exists drand_randomness text;
alter table draws add column if not exists drand_signature text;
alter table draws add column if not exists drand_chain_hash text;
-- Preserve historic commitments and draws. Future rounds are assigned only to undrawn campaigns.
update draw_commitments cm set eligible_numbers=array(select number from raffle_numbers where campaign_id=cm.campaign_id and status='paid' order by number);
update draw_commitments cm set
 drand_round=floor((extract(epoch from now()+interval '5 minutes')-1692803367)/3)::bigint+1,
 drand_chain_hash='52db9ba70e0cc0f6eaf7803dd07447a1f5477735fd3f661792ba94600c84e971'
where not exists(select 1 from draws d where d.campaign_id=cm.campaign_id);
update draw_commitments set beacon_commitment=encode(extensions.digest(convert_to(drand_chain_hash||':'||drand_round||':'||paid_list_hash,'UTF8'),'sha256'),'hex') where drand_round is not null;
CREATE OR REPLACE FUNCTION public.admin_set_campaign_status(p_id uuid, p_status text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
declare
  c campaigns;
  paid_list text;
  list_hash text;
  seed text;
  commitment text;
  eligible integer;
  beacon_round bigint;
  chain text:='52db9ba70e0cc0f6eaf7803dd07447a1f5477735fd3f661792ba94600c84e971';
  frozen int[];
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

    if exists(select 1 from financial_cases fc join orders o on o.id=fc.order_id where o.campaign_id=p_id and fc.status='open') then raise exception 'unresolved financial cases'; end if;
    if exists(select 1 from orders where campaign_id=p_id and status='pending') then
      raise exception 'pending orders exist';
    end if;

    select count(*),coalesce(string_agg(number::text,',' order by number),'')
      into eligible,paid_list
    from raffle_numbers
    where campaign_id=p_id and status='paid';

    if eligible>0 then
      list_hash:=encode(extensions.digest(convert_to(paid_list,'UTF8'),'sha256'),'hex');
      seed:='';
      select array_agg(number order by number) into frozen from raffle_numbers where campaign_id=p_id and status='paid';
      beacon_round:=floor((extract(epoch from now()+interval '5 minutes')-1692803367)/3)::bigint+1;
      commitment:=encode(extensions.digest(convert_to(chain||':'||beacon_round||':'||list_hash,'UTF8'),'sha256'),'hex');

      insert into draw_commitments(campaign_id,eligible_count,paid_list_hash,seed_commitment,seed_secret,eligible_numbers,drand_round,drand_chain_hash,beacon_commitment)
      values(p_id,eligible,list_hash,commitment,seed,frozen,beacon_round,chain,commitment)
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
end $function$
;

create or replace function public.draw_state_internal(p_campaign_id uuid) returns jsonb
language sql security definer set search_path=public as $$
 select jsonb_build_object('round',cm.drand_round,'chain_hash',cm.drand_chain_hash,'finalized_at',c.finalized_at,'drawn',exists(select 1 from draws where campaign_id=c.id))
 from campaigns c join draw_commitments cm on cm.campaign_id=c.id where c.id=p_campaign_id and c.status='closed'
$$;
revoke all on function draw_state_internal(uuid) from public,anon,authenticated;
grant execute on function draw_state_internal(uuid) to service_role;

create or replace function public.complete_drand_draw_internal(p_campaign_id uuid,p_round bigint,p_randomness text,p_signature text,p_actor text)
returns jsonb language plpgsql security definer set search_path=public,extensions as $$
declare c campaigns; cm draw_commitments; d draws; pick bigint; n int; oid uuid; current_hash text;
begin
 select * into c from campaigns where id=p_campaign_id for update;
 if not found or c.finalized_at is null then raise exception 'campaign not finalized'; end if;
 select * into d from draws where campaign_id=p_campaign_id;
 if found then return jsonb_build_object('number',d.number,'drawn_at',d.drawn_at,'already_drawn',true,'method',d.method); end if;
 if exists(select 1 from financial_cases fc join orders o on o.id=fc.order_id where o.campaign_id=c.id and fc.status='open') then raise exception 'unresolved financial cases'; end if;
 select * into cm from draw_commitments where campaign_id=p_campaign_id for update;
 if cm.drand_round is null or cm.drand_round<>p_round or cm.drand_chain_hash<>'52db9ba70e0cc0f6eaf7803dd07447a1f5477735fd3f661792ba94600c84e971' then raise exception 'invalid beacon round'; end if;
 if now()<to_timestamp(1692803367+(p_round-1)*3) then raise exception 'beacon not yet available'; end if;
 if p_randomness !~ '^[0-9a-f]{64}$' or p_signature !~ '^[0-9a-f]{96}$'
 or encode(extensions.digest(decode(p_signature,'hex'),'sha256'),'hex')<>p_randomness then raise exception 'invalid randomness'; end if;
 if cm.eligible_count<>coalesce(array_length(cm.eligible_numbers,1),0) or cm.eligible_count<1 then raise exception 'invalid eligible snapshot'; end if;
 select encode(extensions.digest(convert_to(array_to_string(cm.eligible_numbers,','),'UTF8'),'sha256'),'hex') into current_hash;
 if current_hash<>cm.paid_list_hash then raise exception 'eligible list integrity check failed'; end if;
 pick:=(('x'||substr(encode(extensions.digest(convert_to(p_randomness||':'||cm.paid_list_hash||':RIFATRACK_DRAW_V2','UTF8'),'sha256'),'hex'),1,16))::bit(64)::bigint & 9223372036854775807)%cm.eligible_count;
 n:=cm.eligible_numbers[pick+1];
 select order_id into oid from raffle_numbers where campaign_id=c.id and number=n;
 if oid is null then raise exception 'winning order missing'; end if;
 insert into draws(campaign_id,order_id,number,actor_email,method,eligible_count,paid_list_hash,seed_commitment,seed_reveal,drand_round,drand_randomness,drand_signature,drand_chain_hash)
 values(c.id,oid,n,p_actor,'drand_quicknet_v2',cm.eligible_count,cm.paid_list_hash,cm.beacon_commitment,null,p_round,p_randomness,p_signature,cm.drand_chain_hash) returning * into d;
 update draw_commitments set revealed_at=now() where campaign_id=c.id;
 insert into audit_logs(actor_email,action,entity_type,entity_id,payload)
 values(p_actor,'draw_campaign','campaign',c.id::text,jsonb_build_object('number',n,'method',d.method,'round',p_round,'chain_hash',cm.drand_chain_hash));
 return jsonb_build_object('number',n,'drawn_at',d.drawn_at,'already_drawn',false,'method',d.method,'round',p_round);
end $$;
revoke all on function complete_drand_draw_internal(uuid,bigint,text,text,text) from public,anon,authenticated;
grant execute on function complete_drand_draw_internal(uuid,bigint,text,text,text) to service_role;

create or replace function public.public_draw_verification(p_slug text) returns jsonb
language plpgsql security definer set search_path=public as $$
declare c campaigns;cm draw_commitments;d draws;nums jsonb;
begin
 select * into c from campaigns where slug=p_slug and status='closed';
 if not found then return null; end if;
 select * into cm from draw_commitments where campaign_id=c.id;
 select * into d from draws where campaign_id=c.id;
 nums:=to_jsonb(cm.eligible_numbers);
 return jsonb_build_object('campaign_name',c.name,'slug',c.slug,'status',c.status,'eligible_numbers',coalesce(nums,'[]'),'eligible_count',coalesce(cm.eligible_count,0),
 'paid_list_hash',cm.paid_list_hash,'seed_commitment',case when d.method='commit_reveal_v1' then cm.seed_commitment else cm.beacon_commitment end,
 'commitment_created_at',cm.created_at,'drawn',d.id is not null,'number',d.number,'drawn_at',d.drawn_at,'method',coalesce(d.method,'drand_quicknet_v2'),'seed_reveal',d.seed_reveal,
 'drand_round',cm.drand_round,'drand_chain_hash',cm.drand_chain_hash,'drand_randomness',d.drand_randomness,'drand_signature',d.drand_signature);
end $$;
revoke all on function public_draw_verification(text) from public;
grant execute on function public_draw_verification(text) to anon,authenticated,service_role;
-- Complete the cutover only after the new application and server key are ready.
revoke all on function attach_asaas_qr(text,uuid,text,text) from public,anon,authenticated,service_role;
revoke all on function cancel_order_internal(text,uuid,text) from public,anon,authenticated,service_role;
revoke all on function claim_notification_batch_internal(text,integer) from public,anon,authenticated,service_role;
revoke all on function enqueue_order_notification_internal(text,uuid,text) from public,anon,authenticated,service_role;
revoke all on function finish_notification_internal(text,uuid,boolean,text) from public,anon,authenticated,service_role;
revoke all on function log_system_event_internal(text,text,text,text,text,text,jsonb) from public,anon,authenticated,service_role;
revoke all on function process_asaas_event(text,text,text,text,text,text,integer,integer,timestamp with time zone,text,jsonb) from public,anon,authenticated,service_role;
revoke all on function reserve_raffle_numbers(text,text,text,text,text,text,text,integer[]) from public,anon,authenticated,service_role;
revoke all on function internal_secret_ok(text) from public,anon,authenticated,service_role;
revoke all on function admin_draw_campaign(uuid) from public,anon,authenticated,service_role;
revoke all on function release_expired_reservations(uuid) from public,anon,authenticated;
grant execute on function release_expired_reservations(uuid) to service_role;
delete from app_settings where key='internal_api_secret';
