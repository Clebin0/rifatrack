# RifaTrack

Sistema de gestão de campanhas com rastreamento automático por vendedor.

## Funcionalidades

- Campanhas dinâmicas e seleção de números em tempo real
- Reserva transacional para impedir venda duplicada
- Expiração automática de reservas
- Link individual por vendedor e geração de QR Code
- Painel administrativo autenticado com Supabase Auth
- Gestão de campanhas, vendedores e pedidos
- Confirmação manual de pagamento Pix
- Dashboard, metas, receita e exportação XLSX
- Página pública de acompanhamento do pedido
- RLS, RPCs com privilégios mínimos, rate limit, honeypot e cabeçalhos de segurança
- Auditoria de alterações administrativas
- CI com typecheck e build

## Stack

Next.js, TypeScript, Tailwind CSS, Supabase/PostgreSQL e Vercel.

## Ambiente

Configure NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, RIFATRACK_INTERNAL_API_SECRET e NEXT_PUBLIC_APP_URL em .env.local.

Nunca exponha o segredo interno no frontend.

## Desenvolvimento

npm install
npm run typecheck
npm run build
npm run dev
