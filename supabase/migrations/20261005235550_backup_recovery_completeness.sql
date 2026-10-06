CREATE OR REPLACE FUNCTION public.admin_backup_counts()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not public.admin_role_aal2(array['owner']) then raise exception 'owner_mfa_required'; end if;
  return jsonb_build_object(
    'campaigns',(select count(*) from campaigns),
    'sellers',(select count(*) from sellers),
    'campaign_sellers',(select count(*) from campaign_sellers),
    'orders',(select count(*) from orders),
    'raffle_numbers',(select count(*) from raffle_numbers),
    'draws',(select count(*) from draws),
    'draw_commitments',(select count(*) from draw_commitments),
    'admin_users',(select count(*) from admin_users),
    'audit_logs',(select count(*) from audit_logs),
    'payment_events',(select count(*) from payment_events),
    'financial_cases',(select count(*) from financial_cases),
    'notification_outbox',(select count(*) from notification_outbox)
  );
end $function$
;

CREATE OR REPLACE FUNCTION public.admin_backup_chunk(p_entity text, p_offset integer DEFAULT 0, p_limit integer DEFAULT 2000)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare lim integer:=least(greatest(coalesce(p_limit,2000),1),5000); off integer:=greatest(coalesce(p_offset,0),0); result jsonb;
begin
  if not public.admin_role_aal2(array['owner']) then raise exception 'owner_mfa_required'; end if;
  case p_entity
    when 'campaigns' then select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) into result from (select * from campaigns order by created_at,id limit lim offset off) x;
    when 'sellers' then select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) into result from (select * from sellers order by created_at,id limit lim offset off) x;
    when 'campaign_sellers' then select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) into result from (select * from campaign_sellers order by campaign_id,seller_id limit lim offset off) x;
    when 'orders' then select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) into result from (select * from orders order by created_at,id limit lim offset off) x;
    when 'raffle_numbers' then select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) into result from (select * from raffle_numbers order by campaign_id,number limit lim offset off) x;
    when 'draws' then select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) into result from (select * from draws order by drawn_at,id limit lim offset off) x;
    when 'draw_commitments' then select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) into result from (select * from draw_commitments order by created_at,campaign_id limit lim offset off) x;
    when 'admin_users' then select coalesce(jsonb_agg(jsonb_build_object('email',email,'role',role,'active',active,'created_at',created_at,'updated_at',updated_at)),'[]'::jsonb) into result from (select * from admin_users order by created_at,email limit lim offset off) a;
    when 'audit_logs' then select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) into result from (select * from audit_logs order by created_at,id limit lim offset off) x;
    when 'payment_events' then select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) into result from (select * from payment_events order by created_at,id limit lim offset off) x;
    when 'financial_cases' then select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) into result from (select * from financial_cases order by created_at,id limit lim offset off) x;
    when 'notification_outbox' then select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) into result from (select * from notification_outbox order by created_at,id limit lim offset off) x;
    else raise exception 'unsupported backup entity';
  end case;
  return result;
end $function$
;
