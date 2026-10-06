"use client";
import { FormEvent, useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase-browser";
import { postLoginMfaRedirect } from "@/lib/mfa-browser";
import { authErrorMessage } from "@/lib/password-recovery";

type Mode = "login" | "signup" | "forgot";
const cooldownKey = "rifatrack-auth-email-next";
export default function AuthLogin({ area }: { area: "admin" | "vendedor" }) {
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get("mode") === "forgot") setMode("forgot");
    if (params.get("password") === "updated") setMessage("Senha alterada. Entre com sua nova senha.");
    const tick = () => {
      try { setCooldown(Math.max(0, Math.ceil((Number(localStorage.getItem(cooldownKey)) - Date.now()) / 1000))); }
      catch { /* Storage can be disabled; server limits still apply. */ }
    };
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, []);
  function waitBeforeEmail() {
    setCooldown(60);
    try { localStorage.setItem(cooldownKey, String(Date.now() + 60000)); } catch {}
  }
  function changeMode(next: Mode) { setMode(next); setPassword(""); setMessage(""); }
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy || (mode !== "login" && cooldown > 0)) return;
    setBusy(true); setMessage("");
    const auth = supabaseBrowser().auth;
    try {
      if (mode === "login") {
        const { error } = await auth.signInWithPassword({ email: email.trim(), password });
        if (error) setMessage(authErrorMessage(error));
        else await postLoginMfaRedirect(area, "/" + area);
      } else {
        waitBeforeEmail();
        if (mode === "signup") {
          const { data, error } = await auth.signUp({ email: email.trim(), password });
          if (error) setMessage(authErrorMessage(error));
          else if (data.session) await postLoginMfaRedirect(area, "/" + area);
          else setMessage("Confira seu e-mail para confirmar o cadastro. Se já possui conta, volte para entrar ou recuperar a senha.");
        } else {
          const { error } = await auth.resetPasswordForEmail(email.trim(), {
            redirectTo: location.origin + "/admin/redefinir-senha",
          });
          setMessage(error ? authErrorMessage(error) : "Se o e-mail estiver cadastrado, você receberá um link. Confira também o spam e use o e-mail mais recente. Contas com autenticação em duas etapas precisarão do código do aplicativo.");
        }
      }
    } catch { setMessage("Não foi possível conectar. Verifique sua conexão e tente novamente."); }
    finally { setBusy(false); }
  }
  const input = "w-full bg-zinc-950 border border-zinc-700 rounded-xl p-3";
  const title = mode === "forgot" ? "Recuperar senha" : mode === "signup" ? "Criar acesso" : area === "admin" ? "Área administrativa" : "Portal do vendedor";
  return <main className="min-h-screen grid place-items-center bg-zinc-950 p-5">
    <section className="w-full max-w-md rounded-3xl bg-zinc-900 border border-zinc-800 p-6">
      <a href="/" className="font-bold text-emerald-400">RifaTrack</a>
      <h1 className="text-3xl font-bold mt-5">{title}</h1>
      <p className="mt-3 text-sm text-zinc-300">{mode === "forgot" ? "Informe o e-mail da conta que você já usa." : area === "admin" ? "Contas administrativas precisam ser autorizadas pela organização." : "Use o mesmo e-mail do convite enviado pela organização."}</p>
      <form onSubmit={submit} className="space-y-4 mt-5">
        <div><label htmlFor="auth-email">E-mail</label><input id="auth-email" className={input} type="email" autoComplete="email" required value={email} onChange={e => setEmail(e.target.value)} /></div>
        {mode !== "forgot" && <div><label htmlFor="auth-password">{mode === "signup" ? "Senha (pelo menos 12 caracteres)" : "Senha"}</label><input id="auth-password" className={input} type="password" required minLength={mode === "signup" ? 12 : undefined} autoComplete={mode === "signup" ? "new-password" : "current-password"} value={password} onChange={e => setPassword(e.target.value)} /></div>}
        <button disabled={busy || (mode !== "login" && cooldown > 0)} className="w-full bg-emerald-400 text-emerald-950 rounded-xl p-3 font-bold disabled:opacity-50">{busy ? "Aguarde…" : mode !== "login" && cooldown > 0 ? "Aguarde " + cooldown + "s" : mode === "login" ? "Entrar" : mode === "signup" ? "Criar conta" : "Enviar link de recuperação"}</button>
      </form>
      {message && <p role="status" className="text-sm mt-4">{message}</p>}
      <div className="flex flex-col gap-3 mt-5">
        {mode === "login" ? <>
          <button className="text-left text-emerald-400 underline" onClick={() => changeMode("forgot")}>Esqueci minha senha</button>
          <button className="text-left text-zinc-300" onClick={() => changeMode("signup")}>Primeiro acesso? Criar conta</button>
        </> : <button className="text-left text-emerald-400 underline" onClick={() => changeMode("login")}>Já tenho conta — voltar para entrar</button>}
      </div>
    </section>
  </main>;
}
