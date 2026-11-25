"use client";

import { FormEvent, useEffect, useState } from "react";
import { authErrorMessage } from "@/lib/password-recovery";
import {
  EMPTY_MEMBER_PROFILE,
  memberProfileFromMetadata,
  memberProfileMetadata,
  type MemberProfile,
} from "@/lib/member-profile";
import { supabaseBrowser } from "@/lib/supabase-browser";
import MemberProfileFields from "./MemberProfileFields";

export default function MemberAccount() {
  const [profile, setProfile] = useState<MemberProfile>(EMPTY_MEMBER_PROFILE);
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let active = true;
    supabaseBrowser()
      .auth.getUser()
      .then(({ data, error }) => {
        if (!active) return;
        if (error || !data.user) {
          location.replace("/acesso");
          return;
        }
        setEmail(data.user.email ?? "");
        setProfile(memberProfileFromMetadata(data.user.user_metadata ?? {}));
      })
      .catch(() => {
        if (active) setMessage("Não foi possível carregar seu perfil. Tente novamente.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  async function save(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setMessage("");
    try {
      const { error } = await supabaseBrowser().auth.updateUser({
        data: memberProfileMetadata(profile),
      });
      setMessage(error ? authErrorMessage(error) : "Perfil atualizado.");
    } catch {
      setMessage("Não foi possível salvar agora. Verifique sua conexão e tente novamente.");
    } finally {
      setBusy(false);
    }
  }

  async function signOut() {
    await supabaseBrowser().auth.signOut();
    location.replace("/");
  }

  if (loading) {
    return (
      <section className="ui-card w-full max-w-xl p-6 sm:p-8" aria-busy="true">
        <p role="status" className="ui-muted">
          Carregando seu perfil…
        </p>
      </section>
    );
  }

  return (
    <section className="ui-card w-full max-w-xl p-6 sm:p-8">
      <p className="text-sm font-semibold text-emerald-400">CONTA RIFATRACK</p>
      <h1 className="text-3xl sm:text-4xl font-bold mt-2">Seu perfil</h1>
      <p className="ui-muted mt-3">Conta vinculada a {email || "seu e-mail"}.</p>
      <form onSubmit={save} className="space-y-4 mt-6">
        <MemberProfileFields profile={profile} onChange={setProfile} disabled={busy} />
        <p className="ui-muted text-sm">
          Este perfil é informado por você. O acesso ao portal de vendedores ou à área da
          organização continua dependendo de convite ou autorização.
        </p>
        <button className="ui-button ui-button-primary w-full" disabled={busy}>
          {busy ? "Salvando…" : "Salvar perfil"}
        </button>
      </form>
      {message ? (
        <p className="ui-card mt-4 text-sm" role="status">
          {message}
        </p>
      ) : null}
      <div className="border-t border-zinc-700 mt-6 pt-5">
        <p className="text-sm font-semibold">Acessos internos</p>
        <div className="flex flex-wrap gap-3 mt-3">
          <a className="ui-button ui-button-secondary" href="/vendedor/login">
            Portal do vendedor
          </a>
          <a className="ui-button ui-button-secondary" href="/admin/login">
            Área da organização
          </a>
        </div>
      </div>
      <button className="text-sm ui-muted underline mt-5" onClick={signOut}>
        Sair da conta
      </button>
    </section>
  );
}
