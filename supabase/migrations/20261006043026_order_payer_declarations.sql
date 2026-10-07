create table public.order_payer_declarations (
 order_id uuid primary key references public.orders(id) on delete cascade,
 payer_name text not null check (char_length(payer_name) between 2 and 100),
 transaction_reference text not null default '' check (char_length(transaction_reference)<=120),
 revision integer not null default 1 check (revision between 1 and 5),
 updated_at timestamptz not null default now()
);
alter table public.order_payer_declarations enable row level security;
revoke all on public.order_payer_declarations from public, anon, authenticated;
create or replace function public.report_order_payer(p_token uuid,p_name text,p_reference text default '')
returns void language plpgsql security definer set search_path = '' as $$
declare oid uuid; previous public.order_payer_declarations;
begin
 if p_name is null or char_length(trim(p_name)) not between 2 and 100 or char_length(coalesce(p_reference,''))>120 then raise exception 'invalid declaration'; end if;
 select id into oid from public.orders where public_token=p_token and created_at>now()-interval '7 days' for update;
 if not found then raise exception 'order unavailable'; end if;
 select * into previous from public.order_payer_declarations where order_id=oid;
 if previous.revision>=5 or previous.updated_at>now()-interval '60 seconds' then raise exception 'declaration limit'; end if;
 insert into public.order_payer_declarations(order_id,payer_name,transaction_reference)
 values(oid,trim(p_name),trim(coalesce(p_reference,'')))
 on conflict(order_id) do update set payer_name=excluded.payer_name,transaction_reference=excluded.transaction_reference,revision=order_payer_declarations.revision+1,updated_at=now();
 insert into public.audit_logs(action,entity_type,entity_id,payload)
 values('payer_declared','order',oid::text,jsonb_build_object('source','buyer_declaration','payment_confirmed',false));
end $$;
revoke all on function public.report_order_payer(uuid,text,text) from public;
grant execute on function public.report_order_payer(uuid,text,text) to anon,authenticated;
create or replace function public.order_payer_declaration(p_token uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
 select jsonb_build_object('payer_name',d.payer_name,'transaction_reference',d.transaction_reference,'updated_at',d.updated_at)
 from public.order_payer_declarations d join public.orders o on o.id=d.order_id where o.public_token=p_token
$$;
revoke all on function public.order_payer_declaration(uuid) from public;
grant execute on function public.order_payer_declaration(uuid) to anon,authenticated;
create or replace function public.admin_order_payer_declaration(p_order_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
 if auth.uid() is null or not public.admin_role_aal2(array['owner','admin','financeiro','operador','auditor']) then raise exception 'forbidden'; end if;
 return (select jsonb_build_object('payer_name',payer_name,'transaction_reference',transaction_reference,'updated_at',updated_at) from public.order_payer_declarations where order_id=p_order_id);
end $$;
revoke all on function public.admin_order_payer_declaration(uuid) from public;
grant execute on function public.admin_order_payer_declaration(uuid) to authenticated;

