"use client";
import { FormEvent, useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase-browser";
import { postLoginMfaRedirect } from "@/lib/mfa-browser";
import { KeyRound, ShieldCheck } from "lucide-react";

export default function AdminLogin() {
  const [mode, setMode] = useState<"login" | "signup" | "forgot">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => setCooldown((v) => Math.max(0, v - 1)), 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage("");
    const sb = supabaseBrowser();
    try {
      if (mode === "login") {
        const { error } = await sb.auth.signInWithPassword({ email, password });
        if (error) setMessage("E-mail ou senha inválidos.");
        else await postLoginMfaRedirect("admin", "/admin");
      } else if (mode === "signup") {
        const { data, error } = await sb.auth.signUp({ email, password });
        if (error) setMessage(error.message);
        else if (data.session) await postLoginMfaRedirect("admin", "/admin");
        else setMessage("Conta criada. Confirme o e-mail recebido e depois entre no painel.");
      } else {
        const redirectTo = location.origin + "/admin/redefinir-senha";
        const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo });
        if (error) {
          const code = (error as { code?: string; status?: number }).code || "";
          const status = (error as { code?: string; status?: number }).status || 0;
          const text = (error.message || "").toLowerCase();
          if (
            status === 429 ||
            code === "over_email_send_rate_limit" ||
            text.includes("rate limit")
          ) {
            setMessage(
              "O provedor de autenticação recusou um novo envio por limite de e-mails. Tente novamente quando o limite do servidor liberar.",
            );
          } else {
            setMessage("Não foi possível solicitar a recuperação agora. Tente novamente.");
          }
        } else {
          setCooldown(5);
          setMessage(
            "Se esse e-mail estiver cadastrado, enviaremos um link para redefinir a senha. Você poderá solicitar outro em 5 segundos.",
          );
        }
      }
    } catch {
      setMessage(
        "Não foi possível concluir a solicitação. Verifique sua conexão e tente novamente.",
      );
    } finally {
      setLoading(false);
    }
  }

  const title =
    mode === "login"
      ? "Área administrativa"
      : mode === "signup"
        ? "Criar acesso"
        : "Recuperar senha";
  return (
    <main className="min-h-screen grid place-items-center bg-zinc-950 p-5">
      <div className="w-full max-w-md">
        <a href="/" className="font-black text-xl">
          Rifa<span className="text-emerald-400">Track</span>
        </a>
        <section className="mt-6 bg-zinc-900 border border-zinc-800 rounded-3xl p-6">
          <div className="w-11 h-11 rounded-2xl bg-emerald-950 border border-emerald-800 grid place-items-center text-emerald-400">
            {mode === "forgot" ? <KeyRound /> : <ShieldCheck />}
          </div>
          <h1 className="text-3xl font-black mt-5">{title}</h1>
          <p className="text-zinc-500 text-sm mt-2">
            {mode === "forgot"
              ? "Informe o e-mail da sua conta. O link recebido permitirá escolher uma nova senha."
              : "O cadastro não concede privilégios automaticamente. Contas administrativas precisam ser autorizadas."}
          </p>
          <form onSubmit={submit} className="space-y-3 mt-6">
            <input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="E-mail"
              className="w-full bg-zinc-950 border border-zinc-700 rounded-xl p-3 outline-none focus:border-emerald-500"
            />
            {mode !== "forgot" && (
              <input
                type="password"
                required
                minLength={12}
                autoComplete={mode === "login" ? "current-password" : "new-password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Senha (mínimo 12 caracteres)"
                className="w-full bg-zinc-950 border border-zinc-700 rounded-xl p-3 outline-none focus:border-emerald-500"
              />
            )}
            <button
              disabled={loading || (mode === "forgot" && cooldown > 0)}
              className="w-full bg-emerald-400 text-emerald-950 rounded-xl p-3 font-black disabled:opacity-50"
            >
              {loading
                ? "Aguarde..."
                : mode === "login"
                  ? "Entrar"
                  : mode === "signup"
                    ? "Criar conta"
                    : cooldown > 0
                      ? `Tentar novamente em ${cooldown}s`
                      : "Enviar link de recuperação"}
            </button>
          </form>
          {message && <p className="text-sm text-zinc-300 mt-4">{message}</p>}
          <div className="mt-5 flex flex-col gap-3">
            {mode === "login" && (
              <button
                type="button"
                onClick={() => {
                  setMode("forgot");
                  setMessage("");
                  setPassword("");
                }}
                className="text-sm text-emerald-400 text-left"
              >
                Esqueci minha senha
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                setMode(mode === "login" ? "signup" : "login");
                setMessage("");
                setPassword("");
              }}
              className="text-sm text-zinc-400 text-left"
            >
              {mode === "login" ? "Primeiro acesso? Criar conta" : "Voltar para entrar"}
            </button>
          </div>
        </section>
      </div>
    </main>
  );
}
