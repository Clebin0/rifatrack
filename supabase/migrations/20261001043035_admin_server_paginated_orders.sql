-- Recovered verbatim from Supabase migration history; 20261001043035.

create or replace function public.admin_orders_page(
  p_page integer default 1,
  p_page_size integer default 25,
  p_search text default '',
  p_status text default '',
  p_campaign_id uuid default null,
  p_seller_id uuid default null,
  p_from timestamptz default null,
  p_to timestamptz default null
) returns jsonb
language plpgsql security definer set search_path=public as $$
declare v_page integer:=greatest(coalesce(p_page,1),1); v_size integer:=least(greatest(coalesce(p_page_size,25),1),100);
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  perform release_expired_reservations(null);
  return jsonb_build_object(
    'page',v_page,
    'page_size',v_size,
    'total',(
      select count(*) from orders o
      join campaigns c on c.id=o.campaign_id
      left join sellers s on s.id=o.seller_id
      where (coalesce(p_status,'')='' or o.status=p_status)
        and (p_campaign_id is null or o.campaign_id=p_campaign_id)
        and (p_seller_id is null or o.seller_id=p_seller_id)
        and (p_from is null or o.created_at>=p_from)
        and (p_to is null or o.created_at<p_to)
        and (coalesce(trim(p_search),'')='' or
          o.buyer_name ilike '%'||trim(p_search)||'%' or
          o.buyer_phone ilike '%'||trim(p_search)||'%' or
          o.buyer_email ilike '%'||trim(p_search)||'%' or
          o.payment_reference ilike '%'||trim(p_search)||'%' or
          coalesce(s.name,'') ilike '%'||trim(p_search)||'%' or
          coalesce(o.provider_payment_id,'') ilike '%'||trim(p_search)||'%')
    ),
    'orders',coalesce((select jsonb_agg(to_jsonb(x) order by x.created_at desc) from (
      select o.id,o.public_token,o.buyer_name,o.buyer_phone,o.buyer_email,o.status,o.amount_cents,o.payment_reference,
        o.expires_at,o.created_at,o.proof_path,o.proof_status,o.payment_provider,o.provider_payment_id,o.provider_status,
        o.provider_paid_at,o.provider_net_value_cents,o.pix_transaction_id,
        c.id campaign_id,c.name campaign_name,c.slug campaign_slug,s.id seller_id,s.name seller_name,
        coalesce((select jsonb_agg(rn.number order by rn.number) from raffle_numbers rn where rn.order_id=o.id),'[]'::jsonb) numbers
      from orders o join campaigns c on c.id=o.campaign_id left join sellers s on s.id=o.seller_id
      where (coalesce(p_status,'')='' or o.status=p_status)
        and (p_campaign_id is null or o.campaign_id=p_campaign_id)
        and (p_seller_id is null or o.seller_id=p_seller_id)
        and (p_from is null or o.created_at>=p_from)
        and (p_to is null or o.created_at<p_to)
        and (coalesce(trim(p_search),'')='' or
          o.buyer_name ilike '%'||trim(p_search)||'%' or
          o.buyer_phone ilike '%'||trim(p_search)||'%' or
          o.buyer_email ilike '%'||trim(p_search)||'%' or
          o.payment_reference ilike '%'||trim(p_search)||'%' or
          coalesce(s.name,'') ilike '%'||trim(p_search)||'%' or
          coalesce(o.provider_payment_id,'') ilike '%'||trim(p_search)||'%')
      order by o.created_at desc
      limit v_size offset ((v_page-1)*v_size)
    ) x),'[]'::jsonb)
  );
end $$;
revoke all on function public.admin_orders_page(integer,integer,text,text,uuid,uuid,timestamptz,timestamptz) from public,anon;
grant execute on function public.admin_orders_page(integer,integer,text,text,uuid,uuid,timestamptz,timestamptz) to authenticated;


