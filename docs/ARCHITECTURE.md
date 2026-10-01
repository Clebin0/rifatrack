# Arquitetura do RifaTrack

## Fluxo público

1. O comprador abre uma campanha por `/campanha/:slug`.
2. O vendedor é atribuído pelo parâmetro `?vendedor=CODIGO` ou pela seleção obrigatória no checkout.
3. A API valida entrada, limita tamanho e cria uma reserva transacional no PostgreSQL.
4. Os números ficam reservados por 10 minutos.
5. Em modo Asaas, o servidor cria um QR Pix individual de pagamento único.
6. O comprador acompanha o pedido em `/pedido/:token`.
7. O webhook autenticado registra eventos idempotentes. Somente `PAYMENT_RECEIVED` confirma definitivamente o pagamento e os números.

## Perfis

### Administrador
Acesso a campanhas, vendedores, pedidos, comprovantes, financeiro, auditoria, sorteio e conciliação.

### Vendedor
Acesso somente às próprias campanhas e pedidos atribuídos ao seu `seller_id`. O vínculo é feito por convite de uso único associado ao e-mail autenticado.

### Público
Acesso somente às campanhas públicas e aos pedidos por token UUID imprevisível.

## Camadas

- Next.js: interface, APIs públicas e webhook.
- Supabase Auth: autenticação.
- PostgreSQL: regras de negócio, transações, RLS e auditoria.
- Supabase Storage: comprovantes privados.
- Vercel: hospedagem e variáveis de ambiente.
- Asaas: provedor Pix opcional.

## Integridade

A reserva dos números e a confirmação financeira são executadas no banco. O frontend nunca decide se um número está pago. Eventos financeiros duplicados são bloqueados por chave única de evento.
