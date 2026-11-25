"use client";
import { useEffect, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { LogOut } from "lucide-react";
import { supabaseBrowser } from "@/lib/supabase-browser";
import { getMfaLevel } from "@/lib/mfa-browser";
import AdminNavigation, { adminNavigationLabel } from "./AdminNavigation";
import ThemeToggle from "./ThemeToggle";
export default function AdminShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [role, setRole] = useState("");
  const [verifiedAdminAccess, setVerifiedAdminAccess] = useState(false);
  const currentPage = adminNavigationLabel(pathname);
  const login = pathname === "/admin/login" || pathname === "/admin/redefinir-senha";
  useEffect(() => {
    if (login) return;
    let active = true;
    setRole("");
    setVerifiedAdminAccess(false);
    async function loadVerifiedRole() {
      try {
        const sb = supabaseBrowser();
        const { data: sessionData, error: sessionError } = await sb.auth.getSession();
        if (sessionError || !sessionData.session || (await getMfaLevel()) !== "aal2") return;

        const { data, error } = await sb.rpc("current_admin_role");
        if (active && !error && typeof data === "string" && data) {
          setRole(data);
          setVerifiedAdminAccess(true);
        }
      } catch {
        // Keep navigation hidden unless both the session and second factor are verified.
      }
    }
    void loadVerifiedRole();
    return () => {
      active = false;
    };
  }, [login]);
  if (login) return children;
  async function signOut() {
    await supabaseBrowser().auth.signOut();
    location.replace("/admin/login");
  }
  return (
    <div className={verifiedAdminAccess ? "lg:pl-64" : undefined}>
      {verifiedAdminAccess && (
        <>
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
            <button
              type="button"
              onClick={signOut}
              className="mt-4 inline-flex items-center gap-2 rounded-xl border border-zinc-800 px-4 py-3 text-sm ui-muted hover:bg-zinc-900"
            >
              <LogOut size={16} /> Sair
            </button>
          </aside>
          <div className="lg:hidden sticky top-0 z-30 ui-header px-4 py-3 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <a href="/admin" className="font-extrabold">
                Rifa<span className="text-emerald-400">Track</span>
              </a>
              <p className="text-xs ui-muted truncate">{currentPage}</p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <details className="relative">
                <summary className="cursor-pointer rounded-xl border border-zinc-800 px-3 py-2 text-sm font-bold">
                  Menu
                </summary>
                <div className="absolute right-0 top-full mt-2 w-72 max-h-[75vh] overflow-y-auto rounded-2xl border border-zinc-800 ui-header p-3 shadow-2xl">
                  <AdminNavigation role={role} />
                  <a
                    href="/"
                    className="mt-2 block rounded-xl px-4 py-3 text-sm ui-muted hover:bg-zinc-900"
                  >
                    Ver site
                  </a>
                  <div className="mt-2 flex justify-end px-3 py-2">
                    <ThemeToggle />
                  </div>
                </div>
              </details>
              <button
                type="button"
                onClick={signOut}
                aria-label="Sair da área administrativa"
                className="inline-flex items-center gap-1 rounded-xl border border-zinc-800 px-3 py-2 text-sm font-bold"
              >
                <LogOut size={16} /> Sair
              </button>
            </div>
          </div>
        </>
      )}
      {children}
    </div>
  );
}
