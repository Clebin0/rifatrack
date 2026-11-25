"use client";

import { FormEvent, useEffect, useState } from "react";
import { authErrorMessage } from "@/lib/password-recovery";
import { supabaseBrowser } from "@/lib/supabase-browser";
import {
  EMPTY_MEMBER_PROFILE,
  memberProfileMetadata,
  type MemberProfile,
} from "@/lib/member-profile";
import MemberProfileFields from "./MemberProfileFields";

type Mode = "login" | "signup" | "forgot";
const cooldownKey = "rifatrack-public-auth-next";

export default function AccountAccess() {
  const [mode, setMode] = useState<Mode>("login");
  const [profile, setProfile] = useState<MemberProfile>(EMPTY_MEMBER_PROFILE);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [acceptedTerms, setAcceptedTerms] = useState(false);

  useEffect(() => {
    if (new URLSearchParams(location.search).get("password") === "updated") {
      setMessage("Senha atualizada. Entre com sua nova senha.");
    }
  }, []);

  function changeMode(next: Mode) {
    setMode(next);
    setPassword("");
    setMessage("");
    setAcceptedTerms(false);
  }

  function waitBeforeEmail() {
    setCooldown(60);
    window.setTimeout(() => setCooldown(0), 60000);
    try {
      localStorage.setItem(cooldownKey, String(Date.now() + 60000));
    } catch {
      // Server-side authentication limits continue to apply.
    }
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy || (mode === "forgot" && cooldown > 0)) return;
    setBusy(true);
    setMessage("");
    try {
      const auth = supabaseBrowser().auth;
      if (mode === "login") {
        const { error } = await auth.signInWithPassword({ email: email.trim(), password });
        if (error) setMessage(authErrorMessage(error));
        else location.assign("/conta");
      } else if (mode === "signup") {
        const { data, error } = await auth.signUp({
          email: email.trim(),
          password,
          options: { data: memberProfileMetadata(profile) },
        });
        if (error) {
          setMessage(authErrorMessage(error));
        } else if (data.session) {
          location.assign("/conta");
        } else {
          waitBeforeEmail();
          setMessage(
            "Cadastro recebido. Confirme seu e-mail e depois entre para acessar seu perfil.",
          );
        }
      } else {
        waitBeforeEmail();
        const { error } = await auth.resetPasswordForEmail(email.trim(), {
          redirectTo: location.origin + "/admin/redefinir-senha?returnTo=%2Facesso",
        });
        setMessage(
          error
            ? authErrorMessage(error)
            : "Se o e-mail estiver cadastrado, enviaremos um link para criar uma nova senha. Confira também o spam.",
        );
      }
    } catch {
      setMessage("Não foi possível conectar. Verifique sua conexão e tente novamente.");
    } finally {
      setBusy(false);
    }
  }

  const isSignup = mode === "signup";
  const title = mode === "forgot" ? "Recuperar senha" : isSignup ? "Criar sua conta" : "Entrar";

  return (
    <section className="ui-card w-full max-w-xl p-6 sm:p-8">
      <p className="text-sm font-semibold text-emerald-400">SUA CONTA RIFATRACK</p>
      <h1 className="text-3xl sm:text-4xl font-bold mt-2">{title}</h1>
      <p className="ui-muted mt-3">
        {mode === "forgot"
          ? "Informe o e-mail que você usou no cadastro."
          : isSignup
            ? "Conte um pouco sobre você para personalizarmos seu perfil."
            : "Acesse seu perfil ou crie uma conta para começar."}
      </p>

      <form onSubmit={submit} className="space-y-4 mt-6">
        {isSignup ? (
          <MemberProfileFields profile={profile} onChange={setProfile} disabled={busy} />
        ) : null}
        <div>
          <label htmlFor="account-email" className="text-sm font-semibold">
            E-mail
          </label>
          <input
            id="account-email"
            className="ui-input mt-1"
            type="email"
            autoComplete="email"
            required
            disabled={busy}
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </div>
        {mode !== "forgot" ? (
          <div>
            <label htmlFor="account-password" className="text-sm font-semibold">
              Senha {isSignup ? "(pelo menos 12 caracteres)" : ""}
            </label>
            <input
              id="account-password"
              className="ui-input mt-1"
              type="password"
              autoComplete={isSignup ? "new-password" : "current-password"}
              minLength={isSignup ? 12 : undefined}
              required
              disabled={busy}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </div>
        ) : null}
        {isSignup ? (
          <>
            <p className="ui-muted text-sm">
              O cargo e os vínculos são informados por você. Eles não liberam acesso administrativo
              nem ao portal de vendedores; essas áreas exigem convite ou autorização da organização.
              <br />
              <a className="underline" href="/privacidade">
                Veja como os dados do perfil são tratados.
              </a>
            </p>
            <label className="flex items-start gap-3 text-sm ui-muted">
              <input
                className="mt-1 accent-emerald-400"
                type="checkbox"
                required
                checked={acceptedTerms}
                disabled={busy}
                onChange={(event) => setAcceptedTerms(event.target.checked)}
              />
              <span>
                Confirmo que tenho 18 anos ou mais e aceito os{" "}
                <a className="underline" href="/termos">
                  Termos de Uso
                </a>{" "}
                e a{" "}
                <a className="underline" href="/privacidade">
                  Política de Privacidade
                </a>
                .
              </span>
            </label>
          </>
        ) : null}
        <button className="ui-button ui-button-primary w-full" disabled={busy || cooldown > 0}>
          {busy
            ? "Aguarde…"
            : cooldown > 0 && mode === "forgot"
              ? `Aguarde ${cooldown}s`
              : mode === "login"
                ? "Entrar na minha conta"
                : isSignup
                  ? "Criar conta"
                  : "Enviar link de recuperação"}
        </button>
      </form>

      {message ? (
        <p className="ui-card mt-4 text-sm" role="status">
          {message}
        </p>
      ) : null}

      <div className="flex flex-col gap-3 mt-5 text-sm">
        {mode === "login" ? (
          <>
            <button
              className="text-left text-emerald-400 underline"
              onClick={() => changeMode("signup")}
            >
              Ainda não tem conta? Criar cadastro
            </button>
            <button className="text-left ui-muted underline" onClick={() => changeMode("forgot")}>
              Esqueci minha senha
            </button>
          </>
        ) : (
          <button
            className="text-left text-emerald-400 underline"
            onClick={() => changeMode("login")}
          >
            Já tenho conta — voltar para entrar
          </button>
        )}
      </div>

      <div className="border-t border-zinc-700 mt-6 pt-5 text-sm ui-muted">
        <p>Já tem acesso interno?</p>
        <p className="mt-2 flex flex-wrap gap-x-4 gap-y-2">
          <a className="underline" href="/vendedor/login">
            Portal do vendedor
          </a>
          <a className="underline" href="/admin/login">
            Área da organização
          </a>
        </p>
      </div>
    </section>
  );
}
