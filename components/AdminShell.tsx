"use client";
import { useEffect, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase-browser";
import AdminNavigation from "./AdminNavigation";
import ThemeToggle from "./ThemeToggle";
export default function AdminShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [role, setRole] = useState("");
  const login =
    pathname === "/admin/login" || pathname === "/admin/redefinir-senha";
  useEffect(() => {
    if (login) return;
    let active = true;
    const sb = supabaseBrowser();
    sb.rpc("current_admin_role").then(({ data }) => {
      if (active) setRole(data || "");
    });
    return () => {
      active = false;
    };
  }, [login]);
  if (login) return children;
  return (
    <div className="lg:pl-64">
      <aside className="hidden lg:flex fixed inset-y-0 left-0 w-64 ui-header !border-r flex-col p-5 z-30 overflow-y-auto">
        <a href="/admin" className="text-xl font-extrabold mb-2">
          Rifa<span className="text-emerald-400">Track</span>
        </a>
        <p className="text-sm ui-muted mb-6">Área da organização</p>
        <AdminNavigation role={role} />
        <div className="mt-auto pt-6 flex justify-between items-center">
          <a href="/" className="text-sm underline">
            Ver site
          </a>
          <ThemeToggle />
        </div>
      </aside>
      <div className="lg:hidden ui-header px-5 py-4">
        <details>
          <summary className="cursor-pointer font-bold">
            Menu da organização
          </summary>
          <div className="mt-4">
            <AdminNavigation role={role} />
          </div>
        </details>
      </div>
      {children}
    </div>
  );
}
