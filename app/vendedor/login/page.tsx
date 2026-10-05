"use client";
import { FormEvent, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase-browser";
import { postLoginMfaRedirect } from "@/lib/mfa-browser";
import { BadgeDollarSign } from "lucide-react";

export default function SellerLogin() {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  async function submit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage("");
    const sb = supabaseBrowser();
    if (mode === "login") {
      const { error } = await sb.auth.signInWithPassword({ email, password });
      if (error) setMessage("E-mail ou senha inválidos.");
      else await postLoginMfaRedirect("vendedor", "/vendedor");
    } else {
      const { data, error } = await sb.auth.signUp({ email, password });
      if (error) setMessage(error.message);
      else if (data.session) await postLoginMfaRedirect("vendedor", "/vendedor");
      else
        setMessage(
          "Conta criada. Confirme o e-mail e depois entre com o código fornecido pela organização.",
        );
    }
    setLoading(false);
  }
  return (
    <main className="min-h-screen bg-zinc-950 grid place-items-center p-5">
      <div className="w-full max-w-md">
        <a href="/" className="font-black text-xl">
          Rifa<span className="text-emerald-400">Track</span>
        </a>
        <section className="mt-6 rounded-3xl border border-zinc-800 bg-zinc-900 p-6">
          <div className="w-11 h-11 grid place-items-center rounded-2xl bg-emerald-950 border border-emerald-800 text-emerald-400">
            <BadgeDollarSign />
          </div>
          <h1 className="text-3xl font-black mt-5">
            {mode === "login" ? "Portal do vendedor" : "Criar conta de vendedor"}
          </h1>
          <p className="text-sm text-zinc-500 mt-2">
            O acesso aos dados de vendas só é liberado após vincular o código individual fornecido
            pelo administrador.
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
            <button
              disabled={loading}
              className="w-full rounded-xl bg-emerald-400 text-emerald-950 p-3 font-black disabled:opacity-50"
            >
              {loading ? "Aguarde..." : mode === "login" ? "Entrar" : "Criar conta"}
            </button>
          </form>
          {message && <p className="mt-4 text-sm text-zinc-300">{message}</p>}
          <button
            onClick={() => {
              setMode(mode === "login" ? "signup" : "login");
              setMessage("");
            }}
            className="mt-5 text-sm text-emerald-400"
          >
            {mode === "login" ? "Primeiro acesso? Criar conta" : "Já possui conta? Entrar"}
          </button>
        </section>
      </div>
    </main>
  );
}
