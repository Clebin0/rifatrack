# Operação

## Antes de ativar uma campanha

- revisar nome, descrição, quantidade e valor;
- cadastrar vendedores e metas;
- testar ao menos um link e QR de vendedor;
- validar a chave Pix ou integração automática;
- conferir política de privacidade e responsável pela campanha.

## Pagamentos

No modo manual, o administrador confere o comprovante e confirma o pedido.

No modo automático, o Asaas envia eventos para `/api/webhooks/asaas`. Somente `PAYMENT_RECEIVED` transforma a reserva em venda paga.

## Alertas financeiros

Revisar imediatamente pedidos com:
- `AMOUNT_MISMATCH`;
- `PAYMENT_REVIEW_REQUIRED`;
- `PAYMENT_RECEIVED_AFTER_LOCAL_CLOSE`;
- `PAYMENT_REFUNDED`;
- eventos de chargeback.

## Incidente

1. alterar `PAYMENT_PROVIDER=manual` na Vercel;
2. rotacionar credenciais comprometidas;
3. revisar Auditoria e eventos de pagamento;
4. reconciliar pedidos afetados;
5. corrigir a causa e testar em Sandbox antes de reativar.

## Backup

O banco é a fonte de verdade. Antes de alterações estruturais relevantes, realizar backup/exportação pelo Supabase conforme o plano disponível.
