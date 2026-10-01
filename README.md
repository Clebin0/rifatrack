# RifaTrack

Sistema de gestão de campanhas com rastreamento automático por vendedor, reservas transacionais e painel administrativo.

## Produção

Aplicação: https://rifatrack.vercel.app

## Funcionalidades

- Campanhas dinâmicas com páginas públicas por slug
- Seleção de números com atualização de disponibilidade
- Reserva transacional: dois compradores não conseguem reservar o mesmo número
- Expiração automática de reservas em 15 minutos
- Limite de pedidos e rate limit por fingerprint
- Link individual por vendedor e geração de QR Code
- Atribuição automática da origem de cada venda
- Página pública de acompanhamento do pedido
- Pagamento Pix com confirmação administrativa
- Painel autenticado com Supabase Auth
- Gestão de campanhas, vendedores, metas e pedidos
- Confirmação/cancelamento de pedidos
- Dashboard de receita e desempenho
- Exportação de pedidos em XLSX
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
```

Nunca exponha `RIFATRACK_INTERNAL_API_SECRET` no frontend ou no repositório.

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

O fluxo atual de Pix é funcional com confirmação manual pelo administrador. Conciliação automática depende da contratação/configuração de um provedor de pagamentos e das respectivas credenciais/webhooks.
