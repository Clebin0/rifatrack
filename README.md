# RifaTrack

Gestão de campanhas, vendedores, reservas, Pix, conciliação e sorteios verificáveis. Next.js App Router, Supabase/Postgres, Vercel, Asaas e Resend opcional.

## Estado financeiro

Pré-produção financeira. A campanha de Dia das Crianças é uma ação social; o contato da organização é https://www.instagram.com/atleticasemacao/. A ação social está divulgada para 17/10/2026; o sorteio foi informado para 12/10/2026 às 18h. Extração, responsável legal, regras finais e autorização aplicável ainda precisam ser definidos. Não habilitar dinheiro real enquanto as pendências do ROADMAP e de OPERATIONS não forem encerradas.

`FINANCIAL_PRODUCTION_APPROVED=false` permanece como trava explícita. O modo de pagamento publicado está em `manual`; `ASAAS_ENV` permanece em `sandbox` até homologação.

## Desenvolvimento

Use Node 24. Execute `npm ci`, copie `.env.example` para `.env.local` e preencha somente credenciais do ambiente de desenvolvimento. Depois rode `npm run dev`.

`NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` são públicas. `SUPABASE_SECRET_KEY` é a secret API key do Supabase, exclusivamente server-side, sem prefixo `NEXT_PUBLIC_`. Ela permite que os RPCs internos sejam executados com `service_role`; nunca deve chegar ao navegador. O protocolo antigo baseado em `RIFATRACK_INTERNAL_API_SECRET` foi aposentado pelo código e pelos grants do banco.

## Banco reproduzível

`supabase/migrations` é a fonte de schema. O histórico registrado no Supabase foi recuperado e as migrations de hardening já foram aplicadas em produção. Produção e repositório estão sincronizados em 43 migrations, incluindo a negação explícita de acesso direto às declarações do pagador.

Não edite nem reaplique migrations já publicadas. Toda mudança de schema deve entrar como uma nova migration.

## Qualidade

- `npm run lint` e `npm run format:check`
- `npm run typecheck` e `npm test`
- `npm run test:sql`: replay do banco, permissões, pagamento, privacidade e leases
- PostgreSQL 17: testes de integração, concorrência e pgTAP
- `npm run build` e `npm run audit:prod`

A CI executa audit, lint, formatação, typecheck, testes de autenticação, Vitest, replay SQL, PostgreSQL, concorrência, pgTAP e build. O workflow operacional executa smoke test após deployments bem-sucedidos.

## Integrações

`PAYMENT_PROVIDER=manual` ou `asaas`. `ASAAS_ENV=sandbox` ou `production`. Asaas requer `ASAAS_API_KEY`, `ASAAS_PIX_ADDRESS_KEY` e `ASAAS_WEBHOOK_TOKEN`. O script `npm run asaas:webhook` registra a URL do webhook. Só `PAYMENT_RECEIVED` válido confirma recebimento. O endpoint autentica, valida datas, valor e `externalReference` e grava eventos idempotentes.

Resend requer `RESEND_API_KEY` e `NOTIFICATION_FROM_EMAIL` com remetente autorizado. O checkout apenas grava a fila; o worker envia com timeout, idempotência e lease recuperável.

`CRON_SECRET` protege `GET /api/internal/maintenance`. A rotina agendada só deve ser habilitada depois de configurar `OPERATIONS_URL`, `CRON_SECRET` e `OPERATIONS_ENABLED=true` no GitHub.

## Segurança

- CSP com nonce por resposta e `strict-dynamic`;
- `script-src` sem `unsafe-inline` em produção;
- rate limit atômico por IP;
- respostas públicas minimizadas;
- comprovantes privados;
- RPCs internos restritos a `service_role`;
- MFA nas operações administrativas críticas;
- webhook idempotente e conciliação financeira;
- sorteio verificável com fonte externa;
- health check real de banco.

Consulte `SECURITY.md` para o modelo de segurança e `OPERATIONS.md` para implantação, rotação, pagamentos, alertas e restauração.

## Publicação do código

A árvore atual foi preparada para publicação, mas o repositório histórico contém um valor sensível antigo já aposentado. O repositório histórico deve permanecer privado. A publicação do código deve ser feita a partir de um histórico limpo/snapshot saneado, sem copiar os commits antigos.

Publicar o código não habilita operação financeira. Regularização, homologação e controles externos continuam obrigatórios antes de receber dinheiro real.
