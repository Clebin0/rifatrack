# Segurança

Vulnerabilidades devem ser comunicadas de forma privada ao responsável pelo repositório. Não publique credenciais, tokens, chaves privadas ou detalhes exploráveis em Issues.

Controles aplicados: Row Level Security, tabelas sem acesso direto público, RPCs com validação explícita, autorização administrativa baseada em sessão, segredo interno entre a API e a função de reserva, rate limit, bloqueio transacional dos números, tokens públicos aleatórios para consulta de pedidos, expiração automática, validação de entrada, CSP, HSTS e trilha de auditoria.

Nenhum serviço conectado à internet é literalmente invulnerável. Dependências e configurações precisam de manutenção contínua, e qualquer segredo exposto deve ser rotacionado imediatamente.
