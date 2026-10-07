-- Recovered verbatim from Supabase migration history; 20261001040817.

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
      'pending_orders',(select count(*) from orders where status='pending'),
      'payment_alerts',(select count(*) from orders where provider_status in ('AMOUNT_MISMATCH','PAYMENT_REVIEW_REQUIRED','PAYMENT_RECEIVED_AFTER_LOCAL_CLOSE','PAYMENT_REFUNDED','PAYMENT_CHARGEBACK_REQUESTED','PAYMENT_CHARGEBACK_DISPUTE'))
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
      o.payment_provider,o.provider_qr_id,o.provider_payment_id,o.provider_status,o.provider_paid_at,o.provider_net_value_cents,o.pix_transaction_id,
      c.name campaign_name,c.slug campaign_slug,s.name seller_name,
      coalesce((select jsonb_agg(rn.number order by rn.number) from raffle_numbers rn where rn.order_id=o.id),'[]'::jsonb) numbers
      from orders o join campaigns c on c.id=o.campaign_id left join sellers s on s.id=o.seller_id
      order by o.created_at desc limit 250
    ) x),'[]'::jsonb)
  );
end $$;


