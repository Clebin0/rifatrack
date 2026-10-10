create index if not exists financial_cases_order_id_idx
  on public.financial_cases (order_id);

create index if not exists notification_outbox_order_id_idx
  on public.notification_outbox (order_id);
