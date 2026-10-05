# Atualizações solicitadas e evidência

## Implementado na branch, ainda não publicado em produção

- Histórico completo de 34 migrations recuperado; schema obsoleto e duplicatas removidos; duas novas migrations.
- Chave Supabase server-only e grants service_role; retirada do segredo em RPC/fingerprint.
- Webhook com validação de data, referência e valor, idempotência, tardios, reembolso e chargeback; painel de conciliação.
- Rate limit por IP e GETs, códigos HTTP, telefone normalizado, PII pública mascarada.
- Timeouts, checkout sem envio de e-mail, outbox recuperável, manutenção autenticada e health real.
- Sorteio drand futuro e verificação de assinatura no servidor/navegador.
- Nonce CSP e layout dinâmico; duplicação da campanha removida.
- TypeScript sem any explícito no código de aplicação, ESLint/Prettier, Node 24 e CI com testes.
- Scripts de teste SQL/pgTAP e concorrência PostgreSQL; smoke parametrizável após deployment.
- Contato temporário da ação social, termos/privacidade de preparação, foco de teclado, rótulos e metadados.
- LICENSE de uso privado, CONTRIBUTING e documentação operacional/rotação.

## Evidências locais

Build, typecheck e lint passam. Vitest: 12 testes, incluindo assinatura BLS válida e falsificada. Replay das 36 migrations passa em PGlite; testes de reserva, valor/vínculo, duplicidade, atraso, reembolso, disputa, privacidade, permissões e leases passam. PostgreSQL concorrente/pgTAP devem ser confirmados pela CI; não foram executados no Docker local indisponível.

## Pendências externas ou de homologação

- SUPABASE_SECRET_KEY na Vercel e publicação coordenada das migrations/app.
- Proteção main e Leaked Password Protection com evidência de configuração.
- Staging Supabase separado e homologação Asaas Sandbox; credenciais reais somente depois.
- Configuração e confirmação do scheduler, monitor externo e notificações de falha.
- Primeiro exercício de restauração completo (incluindo Auth/Storage), depois mensal.
- Responsável pela campanha, prêmio/regras/datas e regularização aplicável.
- Controlador LGPD, base legal e retenção final; rotina de exclusão/anonimização.
- Teste visual e de hidratação CSP em ambiente servido e fluxo completo de pagamento.

Não marcar esta lista toda como concluída nem liberar produção financeira apenas com os testes locais.
