# Status de hardening e lançamento

## Implementado e publicado

- Histórico do banco recuperado e sincronizado: 43 migrations aplicadas em produção.
- Chave Supabase server-only e RPCs internos restritos a `service_role`.
- Protocolo antigo de segredo em parâmetro aposentado e grants antigos revogados.
- Webhook com validação de data, referência e valor, idempotência, atrasos, reembolso e chargeback.
- Painel de conciliação para divergências financeiras.
- Rate limit por IP e GETs, códigos HTTP corretos, telefone normalizado e PII pública reduzida.
- Comprovantes e declaração do pagador atrás das APIs server-side.
- Timeouts em integrações, outbox recuperável, manutenção autenticada e health de banco.
- Sorteio com fonte externa futura e verificação criptográfica.
- CSP com nonce por requisição e `script-src` sem `unsafe-inline` em produção.
- Node 24, ESLint, Prettier, Vitest, testes SQL, PostgreSQL, concorrência e pgTAP.
- Backup v3 com conciliação, fila e declaração do pagador.
- MFA TOTP verificado para o owner.
- Bucket `payment-proofs` privado, com limite de tamanho e tipos permitidos.
- `SUPABASE_SECRET_KEY` configurada server-side na Vercel.
- Produção publicada com `PAYMENT_PROVIDER=manual`, `ASAAS_ENV=sandbox` e `FINANCIAL_PRODUCTION_APPROVED=false`.
- CI e smoke operacional do deployment de produção concluídos com sucesso.

## Pendências antes de dinheiro real

- Homologar Asaas Sandbox de ponta a ponta antes de qualquer credencial produtiva.
- Confirmar enquadramento/autorização aplicável, responsável, regulamento, extração, correspondência dos números, prêmios, suplência e entrega.
- Finalizar controlador LGPD, base legal, retenção e rotina de exclusão/anonimização.
- Executar um exercício real de restauração em ambiente isolado, incluindo conferência de Auth e Storage.
- Criar staging Supabase separado quando houver orçamento/aprovação para o custo.
- Configurar e validar scheduler/monitoramento externo antes de depender deles operacionalmente.

## Segurança externa

- O Security Advisor não aponta função `SECURITY DEFINER` executável por `anon`.
- As funções `SECURITY DEFINER` deliberadamente disponíveis a `authenticated` possuem `search_path` fixado e guarda de identidade/role; mutações administrativas críticas exigem AAL2.
- Leaked Password Protection continua reportada como desativada pelo Security Advisor. O recurso é dependente de plano compatível do Supabase e não deve ser marcado como concluído enquanto o advisor não confirmar.
- A proteção da branch `main` não pôde ser aplicada enquanto este repositório permaneceu privado no plano atual.
- O histórico antigo contém um valor sensível aposentado. Não tornar este repositório histórico público; usar um snapshot/histórico limpo para a versão pública.

## Experiência do comprador

Home pública, prêmios/destino social/organizador/data, grade paginada, busca/faixas/legenda, avisos de colisão de seleção, formulário em etapas, confirmação de maioridade, recibo e fluxo de pedido resiliente. Admin possui navegação dedicada; portal do vendedor possui QR, link e meta.

A homologação visual dos fluxos autenticados e a separação adicional de componentes grandes continuam como melhoria de manutenção, não como autorização para abrir operação financeira.
