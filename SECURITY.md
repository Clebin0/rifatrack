# Segurança

## Controles implementados

- RPCs financeiros/internos restritos a `service_role` e chave Supabase exclusivamente server-side.
- Revogação dos RPCs antigos baseados em segredo enviado como parâmetro.
- Permissões administrativas e MFA para alterações críticas.
- Reserva transacional com locks.
- Webhook autenticado, idempotente e validado por referência, valor e estado.
- Pagamentos tardios/divergentes, reembolsos e disputas tratados por conciliação.
- Sorteio verificável com fonte externa futura.
- CSP com nonce por requisição; scripts sem `unsafe-inline` em produção.
- Rate limit atômico por IP e códigos HTTP distintos para limite, conflito e erro interno.
- Dados públicos minimizados; comprovantes e declaração do pagador passam pelo servidor.
- Fila durável com lease, tentativas limitadas e idempotência.
- Timeouts em Asaas, Supabase, Resend e fonte de aleatoriedade.
- Health check consulta o banco.
- Bucket de comprovantes privado.

## Supabase Security Advisor

Nenhuma função `SECURITY DEFINER` está executável por `anon`.

O advisor ainda sinaliza funções `SECURITY DEFINER` deliberadamente disponíveis a usuários autenticados. Essas funções possuem `search_path` fixado e guarda de identidade/role; mutações administrativas críticas exigem AAL2. O alerta permanece como lembrete de arquitetura e deve ser reavaliado sempre que uma função nova for criada.

Leaked Password Protection ainda é reportada como desativada pelo Security Advisor. Não considerar esse controle ativo enquanto o advisor não confirmar a configuração em um plano compatível.

## Publicação do repositório

A árvore atual não deve ser confundida com o histórico completo do repositório. Uma varredura encontrou um valor sensível antigo em commits históricos. O mecanismo associado foi aposentado e seus grants foram revogados, mas o histórico não deve ser publicado.

Para disponibilizar o código publicamente, use um snapshot/histórico limpo sem os commits antigos. Não transforme o repositório histórico em público apenas porque a versão atual não contém o valor.

## Segredos

Nunca armazene chaves em commits, logs, payloads do navegador ou comentários de PR. Em incidente, revogue a credencial, preserve auditoria, interrompa compras e reconcilie pagamentos antes de reabrir.

O modelo de confiança inclui a chave administrativa do servidor: quem controla servidor ou banco pode alterar registros. A verificabilidade do sorteio reduz a possibilidade de escolha prévia do resultado, mas não transforma um administrador do banco em parte não confiável por definição.
