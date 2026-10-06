"use client";
import { FormEvent, useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase-browser";
import { authErrorMessage, checkPasswordSession } from "@/lib/password-recovery";

const mfaUrl = "/admin/seguranca?return=%2Fadmin%2Fredefinir-senha";
export default function ResetPasswordPage() {
  const [state, setState] = useState<"loading" | "ready" | "missing" | "error">("loading");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let active = true;
    checkPasswordSession(supabaseBrowser().auth).then(result => {
      if (!active) return;
      if (result === "mfa") { location.replace(mfaUrl); return; }
      setState(result);
    }).catch(() => { if (active) setState("error"); });
    return () => { active = false; };
  }, []);
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    if (password.length < 12) { setMessage("Use pelo menos 12 caracteres."); return; }
    if (password !== confirm) { setMessage("As senhas não coincidem."); return; }
    setBusy(true); setMessage("");
    try {
      const auth = supabaseBrowser().auth;
      const result = await checkPasswordSession(auth);
      if (result === "mfa") { location.replace(mfaUrl); return; }
      if (result === "missing") { setState("missing"); return; }
      const { error } = await auth.updateUser({ password });
      if (error?.code === "insufficient_aal") { location.replace(mfaUrl); return; }
      if (error) { setMessage(authErrorMessage(error)); return; }
      setPassword(""); setConfirm("");
      await auth.signOut({ scope: "local" });
      location.replace("/admin/login?password=updated");
    } catch { setMessage("Não foi possível conectar. Tente novamente quando a conexão voltar."); }
    finally { setBusy(false); }
  }
  const input = "w-full bg-zinc-950 border border-zinc-700 rounded-xl p-3";
  return <main className="min-h-screen grid place-items-center bg-zinc-950 p-5">
    <section className="w-full max-w-md rounded-3xl bg-zinc-900 border border-zinc-800 p-6">
      <a href="/" className="font-bold text-emerald-400">RifaTrack</a>
      <h1 className="text-2xl font-bold mt-5">Definir nova senha</h1>
      {state === "loading" && <p role="status" className="mt-4">Validando sua sessão e a proteção da conta…</p>}
      {state === "missing" && <p role="alert" className="mt-4">Não há uma sessão ativa. Use o link mais recente recebido por e-mail ou solicite outro na recuperação de senha.</p>}
      {state === "error" && <div className="mt-4"><p role="alert">Não foi possível verificar a sessão. Isso pode ser uma falha de conexão.</p><button className="underline mt-3" onClick={() => location.reload()}>Tentar novamente</button></div>}
      {state === "ready" && <>
        <p className="text-sm text-zinc-300 mt-3">Escolha uma senha diferente da atual, com pelo menos 12 caracteres.</p>
        <form onSubmit={submit} className="space-y-4 mt-5">
          <div><label htmlFor="new-password">Nova senha</label><input id="new-password" className={input} type="password" required minLength={12} autoComplete="new-password" value={password} onChange={e => setPassword(e.target.value)} /></div>
          <div><label htmlFor="confirm-password">Confirmar nova senha</label><input id="confirm-password" className={input} type="password" required minLength={12} autoComplete="new-password" value={confirm} onChange={e => setConfirm(e.target.value)} /></div>
          <button disabled={busy} className="w-full bg-emerald-400 text-emerald-950 rounded-xl p-3 font-bold disabled:opacity-50">{busy ? "Salvando…" : "Salvar nova senha"}</button>
        </form>
      </>}
      {message && <p role="alert" className="mt-4 text-sm">{message}</p>}
      <a href="/admin/login?mode=forgot" className="block underline text-emerald-400 mt-5">Voltar à recuperação de senha</a>
    </section>
  </main>;
}
