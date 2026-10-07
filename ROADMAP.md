# Atualizações solicitadas e evidência

## Implementado na branch, ainda não publicado em produção

- Histórico completo recuperado e sincronizado; produção possui 42 migrations aplicadas, incluindo o hardening e a negação explícita de acesso às declarações de pagador.
- Chave Supabase server-only e grants service_role; retirada do segredo em RPC/fingerprint.
- Webhook com validação de data, referência e valor, idempotência, tardios, reembolso e chargeback; painel de conciliação.
- Rate limit por IP e GETs, códigos HTTP, telefone normalizado, PII pública mascarada; JSON público sem IDs financeiros internos, lista geral de vendedores sem WhatsApp e comprovantes/pagador atrás das APIs rate-limited do servidor.
- Timeouts, checkout sem envio de e-mail, outbox recuperável, manutenção autenticada e health real.
- Sorteio drand futuro e verificação de assinatura no servidor/navegador.
- Nonce CSP e layout dinâmico; duplicação da campanha removida.
- TypeScript sem any explícito no código de aplicação, ESLint/Prettier, Node 24 e CI com testes.
- Scripts de teste SQL/pgTAP e concorrência PostgreSQL; smoke parametrizável após deployment.
- Contato temporário da ação social, termos/privacidade de preparação, foco de teclado, rótulos e metadados.
- LICENSE de uso privado, CONTRIBUTING e documentação operacional/rotação.

## Evidências locais

Build, typecheck e lint passam. Vitest: 22 testes, incluindo 100.000 números com 50 controles renderizados, estados acessíveis, colisões de seleção, confirmação de maioridade, BLS e datas financeiras. Replay das 39 migrations passa em PGlite, com estados vendido/reservado verificados e grants restritos preservados. PostgreSQL 17, duas conexões concorrentes e oito verificações pgTAP passaram na CI anterior; o Docker local não estava disponível.

## Pendências externas ou de homologação

- Publicação coordenada do app após as migrations já aplicadas; a SUPABASE_SECRET_KEY server-only já está configurada na Vercel.
- Proteção main e Leaked Password Protection com evidência de configuração.
- Staging Supabase separado e homologação Asaas Sandbox; credenciais reais somente depois.
- Configuração e confirmação do scheduler, monitor externo e notificações de falha.
- Primeiro exercício de restauração completo (incluindo Auth/Storage), depois mensal.
- Responsável, prêmios e data informados; faltam fotos, extração/correspondência Federal, distribuição/entrega e regularização aplicável.
- Controlador LGPD, base legal e retenção final; rotina de exclusão/anonimização.
- Teste visual e de hidratação CSP em ambiente servido e fluxo completo de pagamento.

Não marcar esta lista toda como concluída nem liberar produção financeira apenas com os testes locais.

## Experiência do comprador

Home pública, prêmios/destino social/organizador/data, grade paginada de 50 números com busca/faixas/legenda, avisos de seleção tomada, formulário em duas etapas com rótulos e telefone, barra mobile fixa e pedido com erro de atualização sem perder o último estado. Geist, tema claro/escuro, componentes base, modais/toasts e telas de loading/erro/404. Admin com navegação lateral e ações sem prompt/confirm nativos; portal do vendedor com QR/link/meta. A separação completa das tabelas e formulários do AdminClient e a homologação visual dos fluxos autenticados ainda precisam continuar.

Revisão adicional: RPCs de leitura, declaração do pagador e upload de comprovantes foram movidos para a fronteira do servidor, evitando desvio do limitador das APIs. O backup v3 inclui conciliação, fila e declarações do pagador e rejeita inconsistências ou destinos de produção com variações de URL. Proteção da main: o GitHub respondeu 403 e exige GitHub Pro para repositório privado.
