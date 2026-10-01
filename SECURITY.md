# Política de Segurança

## Escopo

O RifaTrack processa dados de compradores, atribuição de vendedores, reservas de números, comprovantes e eventos de pagamento. Falhas em autenticação, autorização, integridade de pedidos, exposição de dados pessoais, manipulação de webhooks ou vazamento de segredos são tratadas como vulnerabilidades de segurança.

## Controles aplicados

- Row Level Security no PostgreSQL
- tabelas sensíveis sem leitura/escrita pública direta
- funções administrativas com verificação explícita de administrador
- segredo interno entre API e RPCs sensíveis
- tokens públicos aleatórios para consulta de pedidos
- reservas transacionais para impedir venda duplicada
- rate limit e limites por comprador
- webhook Asaas autenticado e idempotente
- validação do valor recebido antes de confirmar números
- bucket privado para comprovantes, com limite de tamanho e MIME types
- URLs temporárias para acesso administrativo a comprovantes
- CSP, HSTS, anti-clickjacking, nosniff e Permissions Policy
- Dependabot, auditoria de dependências e CI com build/typecheck
- CODEOWNERS para caminhos sensíveis
- arquivos de ambiente e segredos excluídos do Git

## Dependências

A pipeline executa `npm audit --omit=dev --audit-level=high`. Dependências com vulnerabilidades altas ou críticas bloqueiam a validação até serem removidas ou corrigidas.

## Segredos

Nunca coloque em Issues, commits, logs ou screenshots:

- `ASAAS_API_KEY`
- `ASAAS_WEBHOOK_TOKEN`
- `RIFATRACK_INTERNAL_API_SECRET`
- credenciais do Supabase
- chaves privadas ou tokens de sessão

Se um segredo for exposto, considere-o comprometido e rotacione-o imediatamente.

## Divulgação responsável

Não publique detalhes exploráveis em uma Issue pública. Use um canal privado do responsável pelo repositório ou um Security Advisory privado do GitHub quando disponível. Inclua impacto, passos mínimos para reprodução e a versão/commit afetado.

## Resposta a incidente

Em caso de suspeita de comprometimento:

1. desabilitar temporariamente o provedor automático de pagamentos;
2. rotacionar os segredos afetados;
3. revisar `payment_events`, `audit_logs` e logs da Vercel/Supabase;
4. bloquear a origem abusiva quando aplicável;
5. reconciliar pagamentos e pedidos manualmente antes de reativar automações;
6. corrigir a causa raiz e executar novamente os testes de segurança.

Nenhum sistema exposto à internet pode ser declarado invulnerável. Segurança aqui significa reduzir superfície de ataque, aplicar privilégio mínimo, detectar falhas cedo e manter capacidade de resposta e rotação.
