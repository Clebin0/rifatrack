# Operação e implantação

## Implantação coordenada

1. Revisar e testar a PR. Manter FINANCIAL_PRODUCTION_APPROVED=false.
2. Criar staging com banco Supabase separado; configurar as URLs e chaves somente nesse ambiente. Não reutilizar o banco de produção em preview que possa criar pedidos.
3. Reproduzir as migrations em staging. Configurar SUPABASE_SECRET_KEY na Vercel somente no servidor. Não copiar a chave para o chat ou frontend.
4. Homologar reservas concorrentes, MFA, comprovantes privados, webhook de Sandbox, datas inválidas, duplicidade, valor divergente, pagamento atrasado, reembolso, disputa, leases e sorteio com rodada futura.
5. Gerar e verificar backup da produção. Testar restauração em destino isolado. As primeiras 34 migrations já existem na produção; aplicar somente as versões novas.
6. Em janela sem checkout ativo, aplicar financial_security_hardening e external_draw_and_server_boundary e publicar o app novo imediatamente. A segunda migration revoga o protocolo antigo: não a aplicar e deixar o app antigo servindo compras. Confirmar health, smoke, CSP/hidratação e leitura administrativa antes de reabrir.
7. Em caso de falha, manter checkout fechado, corrigir a versão nova e repetir os testes. Um rollback de app sozinho não restaura o antigo protocolo de RPC. Não remover dados financeiros nem alterar migrations já aplicadas.
8. Só habilitar true após responsável/regras/regularização, credenciais e controles externos aprovados e registrados.

## Agenda e monitoramento

.github/workflows/operations.yml executa manutenção a cada 10 minutos (agenda GitHub pode sofrer atrasos) e smoke após deployment_status de sucesso. Configure no GitHub a variável OPERATIONS_URL, SMOKE_SLUG e o secret CRON_SECRET; o mesmo CRON_SECRET precisa existir na Vercel. É possível disparar o workflow manualmente. Para limpeza em cinco minutos com SLA maior, mover o mesmo endpoint a um scheduler que suporte essa frequência; não declarar isso ativo sem confirmar execuções.

Falhas dos workflows aparecem no GitHub Actions; habilitar a notificação da conta responsável. Conectar monitor externo de disponibilidade a /api/health, com alerta após duas falhas consecutivas. O health devolve 503 sem expor detalhes quando não alcança o banco. Inspecionar /admin/observabilidade, /admin/notificacoes e /admin/conciliacao diariamente enquanto a campanha estiver ativa. Casos abertos bloqueiam encerramento/sorteio. Nenhum serviço externo de alerta foi provisionado automaticamente nesta alteração.

## Fluxos financeiros

- Recebimento dentro do prazo + QR/payment id vinculado + externalReference correto + valor exato: marcar pago uma vez.
- PAYMENT_CONFIRMED: registrar estado, aguardar PAYMENT_RECEIVED.
- Datas do provedor sem horário ou sem fuso não provam o instante do pagamento. Nesses casos, usar o recebimento do evento como referência conservadora; uma entrega durante a tolerância pode exigir conciliação. Validar esse caso no Sandbox. Referência: [eventos de cobrança Asaas](https://docs.asaas.com/docs/webhook-para-cobrancas).
- Tardio ou referência/valor divergente: abrir caso; preservar evento; verificar no provedor. Não reassociar números que já foram liberados ou vendidos.
- Reembolso confirmado antes da finalização: pedido cancelado, receita líquida zero, números disponíveis. Depois de finalizada: manter a lista e resultado históricos congelados; registrar o impacto financeiro e conciliação.
- Chargeback/disputa: abrir caso e sinalizar provedor. Não presumir que a disputa já terminou, nem eliminar números da lista congelada. Resolver conforme evidência do provedor, com MFA e nota de auditoria.
- Reembolso de pagamento tardio: efetuar no painel/API do Asaas com permissão financeira, guardar o identificador e então resolver o caso no RifaTrack. O botão de resolução não envia dinheiro.

## Rotação de segredos

Rodar após incidente ou troca de acesso e revisar trimestralmente. Emitir substituto no provedor, atualizar ambiente servidor, publicar, testar, revogar anterior e registrar data/responsável sem valor da chave. Supabase: chave secret server-only; testar health e checkout em Sandbox. Asaas: testar criação do Pix antes de revogar a anterior. Webhook: coordenar token no provedor e ASAAS_WEBHOOK_TOKEN no app em janela controlada, depois reenviar eventos pendentes. Cron: atualizar Vercel e GitHub/scheduler na mesma janela e confirmar uma execução. Resend: testar um envio sem duplicar transação. Remover RIFATRACK_INTERNAL_API_SECRET depois do cutover.

## Backups e restauração

Exportar backup criptografado no painel do proprietário. Verificar com npm run backup:verify e guardar a senha fora do arquivo. Exercício mensal em ambiente isolado: criar destino vazio, aplicar schema, configurar RESTORE_SUPABASE_URL, RESTORE_SUPABASE_SERVICE_ROLE_KEY, BACKUP_PASSPHRASE e ALLOW_RIFATRACK_RESTORE=YES e executar npm run backup:restore -- caminho-do-arquivo. Informar PRODUCTION_SUPABASE_URL para impedir destino de produção; não usar ALLOW_PRODUCTION_RESTORE no exercício. Conferir contagem, pedidos, transações, lista congelada, Auth e objetos de Storage. O export de dados não é um backup completo de Auth/Storage/segredos. Guardar evidência do ensaio sem dados pessoais. Uma agenda documental não equivale a um ensaio executado; o primeiro ensaio continua pendente.

## Privacidade e lançamento

Contato temporário: @impostoresuc. Falta definir o controlador/responsável, base legal por finalidade e tabela de retenção aprovada. Preparar canal privado de atendimento, verificação de titularidade, anonimização de dados quando cabível e preservação de auditoria/disputas. Não anunciar exclusão automática enquanto não implementada e validada. Termos/Privacidade publicados nesta alteração são versões de preparação e explicitam as pendências.
