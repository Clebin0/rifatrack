# RifaTrack

Gestão de campanhas, vendedores, reservas, Pix, conciliação e sorteios verificáveis. Next.js App Router, Supabase/Postgres, Vercel, Asaas e Resend opcional.

## Estado financeiro

Pré-produção financeira. A campanha de Dia das Crianças é uma ação social; o contato da organização é https://www.instagram.com/atleticasemacao/. A ação social está divulgada para 17/10/2026; o sorteio foi informado para 12/10/2026 às 18h. Extração, responsável legal, regras finais e autorização aplicável ainda precisam ser definidos. Não habilitar dinheiro real enquanto as pendências do ROADMAP e de OPERATIONS não forem encerradas.

## Desenvolvimento

Use Node 24 (também fixado na Vercel por engines). Execute npm ci, copie .env.example para .env.local e preencha apenas as credenciais do ambiente de desenvolvimento. Execute npm run dev.

NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY são públicas. SUPABASE_SECRET_KEY é a secret API key do Supabase, exclusivamente no servidor, sem prefixo NEXT_PUBLIC_. Ela permite que os RPCs internos sejam executados com service_role; nunca deve chegar ao navegador. RIFATRACK_INTERNAL_API_SECRET foi aposentada.

## Banco reproduzível

supabase/migrations é a única fonte de schema. As primeiras 34 migrations foram recuperadas do histórico registrado no Supabase, com versões e SQL originais. Quatro migrations implementam segurança financeira e drand; ainda aguardam cutover. A migration aditiva 20261006003716_buyer_number_states já foi aplicada para a nova interface, preservando grants. O histórico completo tem 39 arquivos. Não reaplique migrations existentes na produção. O antigo schema.sql e os dois arquivos duplicados foram removidos.

## Qualidade

- npm run lint e npm run format:check
- npm run typecheck e npm test
- npm run test:sql: replay do banco, permissões, pagamento, privacidade e leases
- TEST_DATABASE_URL apontando para PostgreSQL local rifatrack_test: node scripts/test-postgres.mjs (banco vazio), npm run test:concurrency e node scripts/test-pgtap.mjs (extensão pgTAP instalada)
- npm run build e npm run audit:prod

A CI executa os mesmos testes, inclusive duas conexões PostgreSQL concorrentes e pgTAP. Os testes de infraestrutura imitam auth/storage do Supabase; não substituem a homologação de Auth, Storage, Asaas e Vercel em staging.

## Integrações

PAYMENT_PROVIDER=manual ou asaas. ASAAS_ENV=sandbox ou production. Asaas requer ASAAS_API_KEY, ASAAS_PIX_ADDRESS_KEY e ASAAS_WEBHOOK_TOKEN. O script npm run asaas:webhook registra a URL do webhook. Só PAYMENT_RECEIVED válido confirma recebimento. O endpoint autentica, valida datas, valor e externalReference e grava eventos idempotentes.

Resend requer RESEND_API_KEY e NOTIFICATION_FROM_EMAIL com remetente autorizado. O e-mail do comprador permanece opcional; pedidos sem e-mail não recebem notificações por e-mail. O checkout apenas grava a fila. O worker envia até cinco itens por execução, com timeout, chave de idempotência e lease recuperável.

CRON_SECRET protege GET /api/internal/maintenance. Use um valor aleatório com no mínimo 32 caracteres. A rota limpa reservas vencidas e processa a fila. O endpoint POST /api/internal/notifications/process continua disponível para integrações existentes, protegido por NOTIFICATION_CRON_SECRET; não confunda as duas variáveis.

FINANCIAL_PRODUCTION_APPROVED=false mantém o checkout de produção bloqueado. Mudar para true exige os testes, credenciais e definições da organização documentados em OPERATIONS. Não use a flag como substituta da regularização.

## Segurança e publicação

Scripts usam CSP com nonce por resposta e strict-dynamic; script-src não tem unsafe-inline em produção. O layout é dinâmico para evitar nonce reaproveitado em HTML estático. style-src ainda permite estilos inline usados nos componentes.

O limite por IP usa contador atômico no banco, separado da transação da reserva. Na Vercel o IP deve vir do cabeçalho sobrescrito pela plataforma; outro proxy precisa sobrescrever x-real-ip. GETs públicos têm limite compartilhado. Falha do limitador bloqueia a requisição.

Consulte SECURITY.md para os controles e OPERATIONS.md para implantação, rotação, pagamentos, alertas e restauração. O deploy deve ser coordenado com as quatro novas migrations e a chave do servidor. Nunca misture credenciais do banco de produção com previews de testes mutáveis.
