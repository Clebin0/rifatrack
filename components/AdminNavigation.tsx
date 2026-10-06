"use client";
import { usePathname } from "next/navigation";
const links = [
  [
    "/admin",
    "Visão geral",
    ["owner", "admin", "operador", "financeiro", "auditor"],
  ],
  ["/admin/nova-campanha", "Nova campanha", ["owner", "admin"]],
  [
    "/admin/pedidos",
    "Pedidos",
    ["owner", "admin", "operador", "financeiro", "auditor"],
  ],
  ["/admin/vendas-manuais", "Vendas manuais", ["owner", "admin", "financeiro"]],
  [
    "/admin/financeiro",
    "Financeiro",
    ["owner", "admin", "financeiro", "auditor"],
  ],
  ["/admin/auditoria", "Auditoria", ["owner", "admin", "auditor"]],
  [
    "/admin/notificacoes",
    "Notificações",
    ["owner", "admin", "operador", "financeiro", "auditor"],
  ],
  ["/admin/observabilidade", "Observabilidade", ["owner", "admin", "auditor"]],
  ["/admin/qrs", "Links e QRs", ["owner", "admin", "operador"]],
  ["/admin/equipe", "Equipe", ["owner"]],
  ["/admin/backup", "Backup", ["owner"]],
  [
    "/admin/seguranca",
    "Segurança",
    ["owner", "admin", "operador", "financeiro", "auditor"],
  ],
] as const;
export default function AdminNavigation({ role }: { role: string }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Administração" className="flex flex-col gap-2">
      {links
        .filter(([, , roles]) => (roles as readonly string[]).includes(role))
        .map(([href, label]) => (
          <a
            key={href}
            href={href}
            aria-current={pathname === href ? "page" : undefined}
            className={`rounded-xl px-4 py-3 text-sm font-medium ${pathname === href ? "bg-emerald-950 text-emerald-200 border border-emerald-800" : "ui-muted hover:bg-zinc-900 border border-transparent"}`}
          >
            {label}
          </a>
        ))}
      {!role && (
        <a href="/admin/seguranca" className="text-sm underline">
          Acesso e segurança
        </a>
      )}
    </nav>
  );
}
