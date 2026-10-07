-- Recovered verbatim from Supabase migration history; 20261001030841.

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

  if c.status='active' then
    perform release_expired_reservations(c.id);
  end if;

  if p_seller_code is not null and p_seller_code<>'' then
    select s.name into seller_name
    from sellers s join campaign_sellers cs on cs.seller_id=s.id
    where cs.campaign_id=c.id and cs.active=true and s.active=true and s.code=upper(p_seller_code);
  end if;

  select case when d.id is null then null else jsonb_build_object('number',d.number,'drawn_at',d.drawn_at) end
  into draw_json from (select 1) x
  left join draws d on d.campaign_id=c.id;

  return jsonb_build_object(
    'id',c.id,'name',c.name,'slug',c.slug,'description',c.description,
    'status',c.status,'price_cents',c.price_cents,'total_numbers',c.total_numbers,
    'pix_key',c.pix_key,'pix_receiver',c.pix_receiver,'ends_at',c.ends_at,
    'seller_name',seller_name,'draw_result',draw_json,
    'unavailable',coalesce((select jsonb_agg(number order by number) from raffle_numbers where campaign_id=c.id and status<>'available'),'[]'::jsonb),
    'sold_numbers',(select count(*) from raffle_numbers where campaign_id=c.id and status='paid'),
    'reserved_numbers',(select count(*) from raffle_numbers where campaign_id=c.id and status='reserved')
  );
end $$;

revoke all on function public.public_campaign(text,text) from public;
grant execute on function public.public_campaign(text,text) to anon,authenticated,service_role;


