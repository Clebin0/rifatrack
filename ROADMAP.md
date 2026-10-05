# Atualizações solicitadas e evidência

## Implementado na branch, ainda não publicado em produção

- Histórico completo de 34 migrations recuperado; schema obsoleto e duplicatas removidos; quatro novas migrations.
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

Build, typecheck e lint passam. Vitest: 17 testes, incluindo assinatura BLS válida/falsificada e datas financeiras sem fuso. Replay das 38 migrations passa em PGlite; testes de reserva, valor/vínculo, duplicidade, atraso, reembolso, disputa, privacidade, permissões, leases e sorteio passam. PostgreSQL 17, duas conexões concorrentes e oito verificações pgTAP passaram na CI; o Docker local não estava disponível.

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

Revisão adicional: RPCs de leitura acessíveis diretamente pelo navegador foram restringidos ao servidor, evitando desvio do limitador das APIs. O backup inclui conciliação/fila e rejeita inconsistências ou destinos de produção com variações de URL. Proteção da main: o GitHub respondeu 403 e exige GitHub Pro para repositório privado.
