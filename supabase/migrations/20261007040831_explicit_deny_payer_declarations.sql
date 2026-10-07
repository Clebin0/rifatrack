drop policy if exists deny_order_payer_declarations_anon on public.order_payer_declarations;
drop policy if exists deny_order_payer_declarations_auth on public.order_payer_declarations;

create policy deny_order_payer_declarations_anon
on public.order_payer_declarations for all to anon
using (false) with check (false);

create policy deny_order_payer_declarations_auth
on public.order_payer_declarations for all to authenticated
using (false) with check (false);
