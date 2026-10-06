-- Public number states contain no buyer or order identifiers.
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
    'sold',coalesce((select jsonb_agg(number order by number) from raffle_numbers where campaign_id=c.id and status='paid'),'[]'::jsonb),
    'reserved',coalesce((select jsonb_agg(number order by number) from raffle_numbers where campaign_id=c.id and status='reserved'),'[]'::jsonb),
    'sold_numbers',(select count(*) from raffle_numbers where campaign_id=c.id and status='paid'),
    'reserved_numbers',(select count(*) from raffle_numbers where campaign_id=c.id and status='reserved')
  );
end $$;
-- CREATE OR REPLACE preserves the existing grants. On the hardened deployment,
-- public_reads_through_server has already restricted execution to service_role.
