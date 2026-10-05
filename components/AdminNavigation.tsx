export default function AdminNavigation({ role }: { role: string }) {
  const canCampaignWrite = ["owner", "admin"].includes(role),
    canOperate = ["owner", "admin", "operador"].includes(role),
    canFinanceWrite = ["owner", "admin", "financeiro"].includes(role),
    canFinanceRead = ["owner", "admin", "financeiro", "auditor"].includes(role),
    canAudit = ["owner", "admin", "auditor"].includes(role),
    isOwner = role === "owner";
  return (
    <nav className="hidden md:flex gap-2 text-sm">
      {canCampaignWrite && (
        <a
          href="/admin/nova-campanha"
          className="px-3 py-2 rounded-xl bg-emerald-950 text-emerald-300 border border-emerald-900"
        >
          Nova campanha
        </a>
      )}
      <a href="/admin/pedidos" className="px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-800">
        Pedidos
      </a>
      {canFinanceWrite && (
        <a
          href="/admin/vendas-manuais"
          className="px-3 py-2 rounded-xl bg-indigo-950 text-indigo-300 border border-indigo-900"
        >
          Vendas manuais
        </a>
      )}
      {canFinanceRead && (
        <>
          <a
            href="/admin/conciliacao"
            className="px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-800"
          >
            Conciliação
          </a>
          <a
            href="/admin/financeiro"
            className="px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-800"
          >
            Financeiro
          </a>
        </>
      )}
      {canAudit && (
        <a
          href="/admin/auditoria"
          className="px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-800"
        >
          Auditoria
        </a>
      )}
      <a
        href="/admin/notificacoes"
        className="px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-800"
      >
        Notificações
      </a>
      {canOperate && (
        <a href="/admin/qrs" className="px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-800">
          QRs
        </a>
      )}
      {isOwner && (
        <a href="/admin/equipe" className="px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-800">
          Equipe
        </a>
      )}
      {isOwner && (
        <a href="/admin/backup" className="px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-800">
          Backup
        </a>
      )}
      <a
        href="/admin/seguranca"
        className="px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-800"
      >
        Segurança
      </a>
    </nav>
  );
}
