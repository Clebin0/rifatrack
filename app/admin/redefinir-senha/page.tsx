"use client";
import { FormEvent, useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase-browser";
import { KeyRound, ShieldCheck } from "lucide-react";

export default function ResetPasswordPage() {
  const [ready, setReady] = useState(false);
  const [valid, setValid] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const sb = supabaseBrowser();
    let mounted = true;
    async function check() {
      const recoveryCode = new URLSearchParams(window.location.search).get("code");
      if (recoveryCode) {
        try {
          await sb.auth.exchangeCodeForSession(recoveryCode);
        } catch {
          // O SDK pode ter trocado o código automaticamente durante a inicialização.
        }
      }
      const { data } = await sb.auth.getSession();
      if (mounted) {
        setValid(Boolean(data.session));
        setReady(true);
      }
    }
    check().catch(() => {
      if (mounted) {
        setValid(false);
        setReady(true);
      }
    });
    const { data: listener } = sb.auth.onAuthStateChange((event, session) => {
      if (!mounted) return;
      if (event === "PASSWORD_RECOVERY" || session) {
        setValid(true);
        setReady(true);
      }
    });
    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setMessage("");
    if (password.length < 12) {
      setMessage("A nova senha precisa ter pelo menos 12 caracteres.");
      return;
    }
    if (password !== confirm) {
      setMessage("As senhas não coincidem.");
      return;
    }
    setLoading(true);
    const sb = supabaseBrowser();
    const { data: sessionData } = await sb.auth.getSession();
    if (!sessionData.session) {
      setMessage("A sessão de recuperação não está mais ativa. Solicite um novo link e abra-o uma única vez.");
      setLoading(false);
      return;
    }
    const { error } = await sb.auth.updateUser({ password });
    if (error) {
      const code = (error as { code?: string }).code || "";
      const text = (error.message || "").toLowerCase();
      if (
        code === "otp_expired" ||
        text.includes("expired") ||
        text.includes("invalid token") ||
        text.includes("session missing")
      ) {
        setMessage("Este link expirou ou já foi usado. Solicite um novo link e abra-o uma única vez.");
      } else if (code === "same_password" || text.includes("different from the old password")) {
        setMessage("A nova senha precisa ser diferente da senha atual.");
      } else if (code === "weak_password" || text.includes("weak password")) {
        setMessage("Escolha uma senha mais forte com pelo menos 12 caracteres.");
      } else {
        setMessage(
          `Não foi possível alterar a senha agora. ${code ? `Código: ${code}. ` : ""}Solicite um novo link e tente novamente.`,
        );
      }
      setLoading(false);
      return;
    }
    await supabaseBrowser().auth.signOut();
    location.replace("/admin/login?password=updated");
  }

  if (!ready)
    return (
      <main className="min-h-screen grid place-items-center bg-zinc-950">
        <div className="animate-pulse text-zinc-500">Validando link...</div>
      </main>
    );
  return (
    <main className="min-h-screen grid place-items-center bg-zinc-950 p-5">
      <div className="w-full max-w-md">
        <a href="/" className="font-black text-xl">
          Rifa<span className="text-emerald-400">Track</span>
        </a>
        <section className="mt-6 bg-zinc-900 border border-zinc-800 rounded-3xl p-6">
          <div className="w-11 h-11 rounded-2xl bg-emerald-950 border border-emerald-800 grid place-items-center text-emerald-400">
            {valid ? <ShieldCheck /> : <KeyRound />}
          </div>
          <h1 className="text-3xl font-black mt-5">
            {valid ? "Definir nova senha" : "Link inválido ou expirado"}
          </h1>
          {!valid ? (
            <>
              <p className="text-zinc-500 text-sm mt-2">
                Solicite um novo link de recuperação para continuar.
              </p>
              <a
                href="/admin/login"
                className="block mt-5 text-center bg-emerald-400 text-emerald-950 rounded-xl p-3 font-black"
              >
                Voltar ao login
              </a>
            </>
          ) : (
            <>
              <p className="text-zinc-500 text-sm mt-2">
                Crie uma senha nova com pelo menos 12 caracteres. Depois da alteração, você fará
                login novamente.
              </p>
              <form onSubmit={submit} className="space-y-3 mt-6">
                <input
                  type="password"
                  required
                  minLength={12}
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Nova senha"
                  className="w-full bg-zinc-950 border border-zinc-700 rounded-xl p-3 outline-none focus:border-emerald-500"
                />
                <input
                  type="password"
                  required
                  minLength={12}
                  autoComplete="new-password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  placeholder="Confirmar nova senha"
                  className="w-full bg-zinc-950 border border-zinc-700 rounded-xl p-3 outline-none focus:border-emerald-500"
                />
                <button
                  disabled={loading}
                  className="w-full bg-emerald-400 text-emerald-950 rounded-xl p-3 font-black disabled:opacity-50"
                >
                  {loading ? "Alterando..." : "Salvar nova senha"}
                </button>
              </form>
              {message && <p className="text-sm text-zinc-300 mt-4">{message}</p>}
            </>
          )}
        </section>
      </div>
    </main>
  );
}
