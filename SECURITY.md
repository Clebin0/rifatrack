# Segurança

## Controles implementados nesta alteração

- RPCs financeiros/internos exclusivamente service_role; chave Supabase server-only, sem segredo em parâmetros.
- Revogação dos RPCs antigos e exclusão do hash do segredo interno no cutover.
- Permissões administrativas e MFA para alterações críticas; sorteio via API autenticada com verificação de MFA.
- Reserva transacional com locks; apenas um pedido recebe cada número.
- Webhook autenticado, valor exato, referência e provedor vinculados ao pedido, eventos idempotentes.
- Pagamentos atrasados/divergentes e disputas geram conciliação; nada os transforma automaticamente em números pagos.
- Lista congelada e rodada drand futura; verificação BLS contra chave pública fixa no servidor e navegador.
- Nonce CSP por requisição, sem unsafe-inline para scripts de produção. Estilos inline ainda permitidos.
- Limite por IP em transação independente; 429 para limite, 409 para conflito, 500 para erro interno.
- Links aleatórios de pedido; nome mascarado e ausência de telefone/e-mail na resposta pública.
- Fila durável com lease, claim_token, tentativas limitadas e envio idempotente.
- Timeouts em Asaas, Supabase, Resend e drand; health consulta o banco.

## Controles externos ainda dependentes de configuração/evidência

Não considerar concluídos apenas porque o código passou: proteção da main, Leaked Password Protection, chave server-only na Vercel, staging separado, Sandbox Asaas, credenciais reais, cron/alertas configurados e exercício de restauração. A situação de cada item está no ROADMAP.

Nunca armazene chaves em commits, logs, payloads do navegador ou comentários de PR. Reporte incidentes privadamente ao proprietário do repositório. Revogue credenciais comprometidas, preserve os registros de auditoria, interrompa compras e execute a reconciliação antes de reabrir.

O modelo de confiança inclui a chave administrativa do servidor: quem controla o servidor ou o banco pode alterar os registros. Drand elimina a semente escolhida pelo operador; não promete tornar um administrador do banco incapaz de adulterar o sistema. Publicar e preservar a lista/rodada antes da emissão do beacon permite auditoria externa.
