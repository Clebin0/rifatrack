"use client";
import { useUI } from "@/components/ui/UIProvider";
import { FormEvent, useEffect, useState } from "react";
import {
  ArrowLeft,
  Copy,
  RefreshCw,
  ShieldCheck,
  UserPlus,
} from "lucide-react";
import { supabaseBrowser } from "@/lib/supabase-browser";
import { ensureMfa } from "@/lib/mfa-browser";

type Role = "owner" | "admin" | "financeiro" | "operador" | "auditor";
type Member = {
  email: string;
  role: Role;
  active: boolean;
  created_at: string;
  updated_at: string;
};
type Invite = {
  id: string;
  email: string;
  role: Role;
  expires_at: string;
  created_at: string;
};
type Data = { members: Member[]; pending_invites: Invite[] };
const roles: Role[] = ["owner", "admin", "financeiro", "operador", "auditor"];

export default function AdminTeamClient() {
  const { confirm, toast } = useUI();
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("operador");
  const [message, setMessage] = useState("");
  useEffect(() => {
    if (message) toast(message);
  }, [message, toast]);
  const sb = () => supabaseBrowser();
  async function load() {
    setLoading(true);
    if (!(await ensureMfa("admin", "/admin/equipe"))) {
      setLoading(false);
      return;
    }
    const { data: d, error } = await sb().rpc("admin_team_dashboard");
    if (error) {
      setMessage("Somente o proprietário pode administrar a equipe.");
      setData(null);
    } else setData(d as Data);
    setLoading(false);
  }
  useEffect(() => {
    load();
  }, []);
  async function invite(e: FormEvent) {
    e.preventDefault();
    setMessage("");
    const { data: i, error } = await sb().rpc("admin_create_team_invite", {
      p_email: email.trim(),
      p_role: role,
    });
    if (error) {
      setMessage(error.message);
      return;
    }
    const x = i as {
      code: string;
      email: string;
      role: Role;
      expires_at: string;
    };
    const text = `Convite administrativo RifaTrack\nE-mail: ${x.email}\nPerfil: ${x.role}\nPortal: ${location.origin}/admin/login\nCódigo: ${x.code}\nExpira: ${new Date(x.expires_at).toLocaleString("pt-BR")}`;
    await navigator.clipboard.writeText(text);
    setEmail("");
    setMessage("Convite criado e copiado. O código é de uso único.");
    await load();
  }
  async function update(m: Member, nextRole: Role, nextActive: boolean) {
    if (
      !(await confirm(
        `Alterar ${m.email} para ${nextRole} · ${nextActive ? "ativo" : "inativo"}?`,
      ))
    )
      return;
    const { error } = await sb().rpc("admin_set_team_member", {
      p_email: m.email,
      p_role: nextRole,
      p_active: nextActive,
    });
    if (error) setMessage(error.message);
    else await load();
  }
  if (loading)
    return (
      <main className="min-h-screen grid place-items-center bg-zinc-950">
        <RefreshCw className="animate-spin" />
      </main>
    );
  if (!data)
    return (
      <main className="min-h-screen grid place-items-center bg-zinc-950 p-5">
        <div className="text-center">
          <ShieldCheck className="mx-auto" />
          <p className="mt-3">
            {message || "Acesso restrito ao proprietário."}
          </p>
          <a href="/admin" className="text-emerald-400 inline-block mt-3">
            Voltar
          </a>
        </div>
      </main>
    );
  return (
    <main className="min-h-screen bg-zinc-950">
      <div className="max-w-6xl mx-auto px-5 py-8 space-y-6">
        <div>
          <a
            href="/admin"
            className="inline-flex gap-2 items-center text-sm text-zinc-400"
          >
            <ArrowLeft size={16} /> Painel
          </a>
          <h1 className="text-4xl font-black mt-3">Equipe administrativa</h1>
          <p className="text-zinc-500 mt-1">
            Privilégio mínimo por função. Todos os acessos administrativos
            exigem MFA.
          </p>
        </div>
        {message && (
          <div className="rounded-xl border border-zinc-700 bg-zinc-900 p-3 text-sm">
            {message}
          </div>
        )}
        <form
          onSubmit={invite}
          className="rounded-3xl border border-zinc-800 bg-zinc-900 p-5 grid md:grid-cols-[1fr_220px_auto] gap-3"
        >
          <input
            required
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="E-mail do novo membro"
            className="bg-zinc-950 border border-zinc-700 rounded-xl p-3"
          />
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as Role)}
            className="bg-zinc-950 border border-zinc-700 rounded-xl p-3"
          >
            {roles.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
          <button className="bg-white text-black rounded-xl px-4 py-3 font-black inline-flex gap-2 items-center justify-center">
            <UserPlus size={17} /> Criar convite
          </button>
        </form>
        <section className="rounded-3xl border border-zinc-800 bg-zinc-900 p-5">
          <h2 className="text-xl font-black">Membros</h2>
          <div className="overflow-x-auto mt-4">
            <table className="w-full text-sm">
              <thead className="text-zinc-500 text-left">
                <tr>
                  <th className="pb-3">E-mail</th>
                  <th>Perfil</th>
                  <th>Status</th>
                  <th>Criado</th>
                </tr>
              </thead>
              <tbody>
                {data.members.map((m) => (
                  <tr key={m.email} className="border-t border-zinc-800">
                    <td className="py-4 font-medium">{m.email}</td>
                    <td>
                      <select
                        value={m.role}
                        onChange={(e) =>
                          update(m, e.target.value as Role, m.active)
                        }
                        className="bg-zinc-950 border border-zinc-700 rounded-lg p-2"
                      >
                        {roles.map((r) => (
                          <option key={r}>{r}</option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <button
                        onClick={() => update(m, m.role, !m.active)}
                        className={
                          "px-3 py-2 rounded-lg " +
                          (m.active
                            ? "bg-emerald-950 text-emerald-300"
                            : "bg-rose-950 text-rose-300")
                        }
                      >
                        {m.active ? "Ativo" : "Inativo"}
                      </button>
                    </td>
                    <td className="text-zinc-500">
                      {new Date(m.created_at).toLocaleString("pt-BR")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
        <section className="rounded-3xl border border-zinc-800 bg-zinc-900 p-5">
          <h2 className="text-xl font-black">Convites pendentes</h2>
          <div className="space-y-3 mt-4">
            {data.pending_invites.map((i) => (
              <div
                key={i.id}
                className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4 flex justify-between gap-3"
              >
                <div>
                  <b>{i.email}</b>
                  <p className="text-xs text-zinc-500">
                    {i.role} · expira{" "}
                    {new Date(i.expires_at).toLocaleString("pt-BR")}
                  </p>
                </div>
                <Copy size={17} className="text-zinc-600" />
              </div>
            ))}
            {!data.pending_invites.length && (
              <p className="text-sm text-zinc-500">Nenhum convite pendente.</p>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
