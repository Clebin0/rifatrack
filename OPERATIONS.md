# Operação e implantação

## Estado atual

O hardening de banco e aplicação já foi publicado em produção com o checkout financeiro bloqueado por `FINANCIAL_PRODUCTION_APPROVED=false`. As 42 migrations registradas estão aplicadas. `PAYMENT_PROVIDER=manual` e `ASAAS_ENV=sandbox` permanecem como configuração conservadora.

O deployment atual passou pela CI e pelo smoke operacional. Isso valida a implantação técnica; não substitui homologação financeira, jurídica ou de restauração.

## Procedimento para próximas releases

1. Manter `FINANCIAL_PRODUCTION_APPROVED=false` durante mudanças relevantes.
2. Criar uma nova migration para qualquer alteração de banco; nunca editar migrations aplicadas.
3. Validar lint, format, typecheck, testes, replay SQL, concorrência, pgTAP e build.
4. Publicar primeiro em preview/staging quando o fluxo puder alterar estado.
5. Executar smoke e conferir `/api/health`, autenticação, CSP, checkout fechado e rotas administrativas.
6. Só reabrir operação financeira após conciliação e validação da release.

## Agenda e monitoramento

`.github/workflows/operations.yml` executa smoke após deployment bem-sucedido. A manutenção agendada só roda quando a variável `OPERATIONS_ENABLED` for explicitamente definida como `true`.

Para habilitar a manutenção:

- definir `OPERATIONS_URL` no GitHub;
- definir `CRON_SECRET` no GitHub Secrets e na Vercel;
- testar manualmente `/api/internal/maintenance`;
- somente então definir `OPERATIONS_ENABLED=true`.

Conectar monitor externo a `/api/health` e alertar após falhas consecutivas. Enquanto houver campanha ativa, revisar observabilidade, notificações e conciliação.

## Fluxos financeiros

- Recebimento dentro do prazo, referência correta e valor exato: confirmar uma única vez.
- `PAYMENT_CONFIRMED`: registrar estado e aguardar `PAYMENT_RECEIVED`.
- Data ambígua, atraso, referência divergente ou valor divergente: abrir conciliação.
- Reembolso antes da finalização: cancelar pedido e liberar números conforme evidência do provedor.
- Reembolso após finalização: preservar histórico do sorteio e registrar impacto financeiro.
- Chargeback/disputa: abrir caso e não presumir encerramento sem evidência.
- Resolver um caso no RifaTrack não envia dinheiro; reembolso financeiro ocorre no provedor.

## Rotação de segredos

Após incidente, troca de acesso ou revisão periódica:

1. emitir credencial substituta no provedor;
2. atualizar somente ambiente server-side;
3. publicar/testar;
4. revogar a credencial anterior;
5. registrar data e responsável, nunca o valor da chave.

O código atual não utiliza mais `RIFATRACK_INTERNAL_API_SECRET`. A variável legada deve ser removida da Vercel quando a limpeza operacional for feita.

## Backups e restauração

Exportar backup criptografado pelo fluxo de proprietário, verificar com `npm run backup:verify` e guardar a senha separadamente.

O exercício de restauração deve usar destino isolado, vazio e diferente da produção. Configure `RESTORE_SUPABASE_URL`, `RESTORE_SUPABASE_SERVICE_ROLE_KEY`, `BACKUP_PASSPHRASE`, `PRODUCTION_SUPABASE_URL` e `ALLOW_RIFATRACK_RESTORE=YES`. Não usar `ALLOW_PRODUCTION_RESTORE` em ensaio.

Conferir contagens, pedidos, eventos, conciliação, lista congelada, Auth e objetos do Storage. O export de dados não substitui backup de Auth, Storage e segredos.

## Privacidade e lançamento

Antes de dinheiro real, confirmar controlador, base legal, retenção, canal do titular, responsável legal, regulamento, autorização aplicável, extração e entrega dos prêmios. A trava financeira só deve mudar para `true` após essas evidências e a homologação de pagamento.
