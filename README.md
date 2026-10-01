# RifaTrack

Sistema de gestão de campanhas com rastreamento automático por vendedor, reservas transacionais e painel administrativo.

## Produção

Aplicação: https://rifatrack.vercel.app

## Funcionalidades

- Campanhas dinâmicas com páginas públicas por slug
- Seleção de números com atualização de disponibilidade
- Reserva transacional: dois compradores não conseguem reservar o mesmo número
- Reserva e QR Pix com expiração em 10 minutos
- Limite de pedidos e rate limit por fingerprint
- Link individual por vendedor e geração de QR Code
- Atribuição automática da origem de cada venda
- Página pública de acompanhamento do pedido
- Pix manual com comprovante ou Pix automático via Asaas
- Painel autenticado com Supabase Auth
- Gestão de campanhas, vendedores, metas e pedidos
- Confirmação automática por webhook, com idempotência por evento
- IDs de transação, valor líquido, horário do pagamento e status do provedor
- Exportação de pedidos em CSV compatível com Excel
- Sorteio auditado entre números pagos após encerramento da campanha
- Resultado do sorteio persistente e público
- Log de ações administrativas
- CI com typecheck e build

## Segurança

O sistema usa RLS no PostgreSQL, tabelas sem acesso direto para usuários públicos, funções RPC com validação de privilégios, segredo interno para criação de reservas, validação server-side, honeypot, limites de requisição, tokens públicos aleatórios para pedidos e cabeçalhos HTTP de segurança.

Nenhum sistema exposto à internet pode ser considerado invulnerável. Dependências, credenciais e regras de acesso devem ser revisadas e atualizadas continuamente.

## Stack

- Next.js 16
- React
- TypeScript
- Tailwind CSS
- Supabase / PostgreSQL
- Supabase Auth
- Vercel

## Variáveis de ambiente

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
RIFATRACK_INTERNAL_API_SECRET=
NEXT_PUBLIC_APP_URL=
PAYMENT_PROVIDER=manual
ASAAS_ENV=sandbox
ASAAS_API_KEY=
ASAAS_PIX_ADDRESS_KEY=
ASAAS_WEBHOOK_TOKEN=
```

Nunca exponha `RIFATRACK_INTERNAL_API_SECRET`, `ASAAS_API_KEY` ou `ASAAS_WEBHOOK_TOKEN` no frontend ou no repositório.

## Primeiro administrador

A primeira conta é criada em `/admin/login`. Depois da autenticação, o sistema pede um código de implantação de uso único. Ao ser utilizado corretamente, o código é invalidado no banco e aquela conta passa a ser administradora.

## Desenvolvimento

```bash
npm install
npm run typecheck
npm run build
npm run dev
```

## Pagamentos

O RifaTrack possui dois modos:

### Manual
`PAYMENT_PROVIDER=manual`

Usa a chave Pix cadastrada na campanha e mantém upload privado de comprovante e confirmação administrativa.

### Asaas automático
`PAYMENT_PROVIDER=asaas`

Requer `ASAAS_API_KEY`, `ASAAS_PIX_ADDRESS_KEY` e `ASAAS_WEBHOOK_TOKEN`. Cada pedido cria um QR Code Pix individual de pagamento único com expiração de 600 segundos. O webhook está em:

`POST /api/webhooks/asaas`

O endpoint valida o header `asaas-access-token`, persiste o ID do evento antes de processá-lo e trata reenvios de forma idempotente. Eventos de recebimento vinculam o ID da cobrança, status do provedor, valor líquido, horário do pagamento e identificador da transação Pix ao pedido e confirmam os números automaticamente.

Use uma conta Sandbox do Asaas para homologação e altere `ASAAS_ENV=production` somente com credenciais produtivas.
