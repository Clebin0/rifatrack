# RifaTrack

Aplicação para gestão de campanhas com rastreamento de vendas por vendedor.

## Problema
Um único link de campanha dificulta descobrir quem originou uma venda. O RifaTrack atribui a origem automaticamente por link/QR individual, mantendo os números em um pool global.

## MVP
- campanha pública e seleção de números
- atribuição via `?vendedor=CODIGO`
- vendedores, equipes e metas
- pedidos e status de pagamento
- dashboard administrativo
- estrutura PostgreSQL/Supabase
- preparado para QR Code, exportação XLSX e webhook Pix

## Rodar
```bash
npm install
cp .env.example .env.local
npm run dev
```
Abra http://localhost:3000. O painel está em `/admin`.

## Próximas etapas
Conectar Supabase, autenticação administrativa, reserva transacional dos números, geração de QR, exportação XLSX, webhook de pagamento e analytics.
