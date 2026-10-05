"use client";
import { FormEvent, useEffect, useState } from "react";
import { CheckCircle2, KeyRound, RefreshCw, ShieldCheck } from "lucide-react";
import { supabaseBrowser } from "@/lib/supabase-browser";

type Props = { area: "admin" | "vendedor"; defaultReturn: string };
type Factor = { id: string; friendly_name?: string; status?: string; factor_type?: string };

export default function MfaSecurityClient({ area, defaultReturn }: Props) {
  const sb = () => supabaseBrowser();
  const [loading, setLoading] = useState(true);
  const [current, setCurrent] = useState<string | null>(null);
  const [factors, setFactors] = useState<Factor[]>([]);
  const [factorId, setFactorId] = useState("");
  const [qr, setQr] = useState("");
  const [secret, setSecret] = useState("");
  const [code, setCode] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const params = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null;
  const returnTo = params?.get("return") || defaultReturn;

  async function refresh() {
    setLoading(true);
    setMessage("");
    const client = sb();
    const { data: session } = await client.auth.getSession();
    if (!session.session) {
      location.href = area === "admin" ? "/admin/login" : "/vendedor/login";
      return;
    }
    const [aal, list] = await Promise.all([
      client.auth.mfa.getAuthenticatorAssuranceLevel(),
      client.auth.mfa.listFactors(),
    ]);
    setCurrent(aal.data?.currentLevel || null);
    const totp = (list.data?.totp || []) as Factor[];
    setFactors(totp.filter((f) => f.status === "verified"));
    setLoading(false);
  }
  useEffect(() => {
    refresh();
  }, []);

  async function startEnroll() {
    setBusy(true);
    setMessage("");
    setCode("");
    const { data, error } = await sb().auth.mfa.enroll({
      factorType: "totp",
      friendlyName: "RifaTrack " + (area === "admin" ? "Admin" : "Vendedor"),
    });
    if (error) {
      setMessage("Não foi possível iniciar o MFA: " + error.message);
      setBusy(false);
      return;
    }
    setFactorId(data.id);
    setQr(data.totp.qr_code);
    setSecret(data.totp.secret);
    setBusy(false);
  }

  async function verifyEnrollment(e: FormEvent) {
    e.preventDefault();
    if (!factorId) return;
    setBusy(true);
    setMessage("");
    const client = sb();
    const { data: challenge, error: challengeError } = await client.auth.mfa.challenge({
      factorId,
    });
    if (challengeError) {
      setMessage(challengeError.message);
      setBusy(false);
      return;
    }
    const { error } = await client.auth.mfa.verify({
      factorId,
      challengeId: challenge.id,
      code: code.trim(),
    });
    if (error) {
      setMessage("Código inválido ou expirado.");
      setBusy(false);
      return;
    }
    await client.auth.refreshSession();
    setMessage("MFA ativado com sucesso.");
    setQr("");
    setSecret("");
    setFactorId("");
    setCode("");
    await refresh();
    setTimeout(() => {
      location.href = returnTo;
    }, 500);
  }

  async function verifyExisting(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage("");
    const verified = factors[0];
    if (!verified) {
      setMessage("Nenhum autenticador verificado.");
      setBusy(false);
      return;
    }
    const client = sb();
    const { data: challenge, error: challengeError } = await client.auth.mfa.challenge({
      factorId: verified.id,
    });
    if (challengeError) {
      setMessage(challengeError.message);
      setBusy(false);
      return;
    }
    const { error } = await client.auth.mfa.verify({
      factorId: verified.id,
      challengeId: challenge.id,
      code: code.trim(),
    });
    if (error) {
      setMessage("Código inválido ou expirado.");
      setBusy(false);
      return;
    }
    await client.auth.refreshSession();
    setMessage("Segundo fator confirmado.");
    setTimeout(() => {
      location.href = returnTo;
    }, 350);
  }

  if (loading)
    return (
      <main className="min-h-screen grid place-items-center bg-zinc-950">
        <RefreshCw className="animate-spin" />
      </main>
    );

  const verified = factors.length > 0;
  const aal2 = current === "aal2";

  return (
    <main className="min-h-screen bg-zinc-950 grid place-items-center p-5">
      <div className="w-full max-w-xl">
        <a href="/" className="font-black text-xl">
          Rifa<span className="text-emerald-400">Track</span>
        </a>
        <section className="mt-6 rounded-3xl border border-zinc-800 bg-zinc-900 p-6">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-emerald-950 border border-emerald-800 text-emerald-300 grid place-items-center">
              <ShieldCheck />
            </div>
            <div>
              <p className="text-xs font-bold text-emerald-400 uppercase">Segurança obrigatória</p>
              <h1 className="text-2xl font-black">Autenticação em duas etapas</h1>
            </div>
          </div>
          <p className="text-zinc-500 text-sm mt-4">
            O {area === "admin" ? "painel administrativo" : "portal do vendedor"} só libera dados e
            ações após um código TOTP de um aplicativo autenticador.
          </p>

          {aal2 && (
            <div className="mt-5 rounded-2xl border border-emerald-800 bg-emerald-950/30 p-4 flex gap-3 text-emerald-200">
              <CheckCircle2 />
              <div>
                <b>Sessão protegida com AAL2.</b>
                <p className="text-sm text-emerald-300/70">Você pode continuar para o sistema.</p>
              </div>
            </div>
          )}

          {!verified && !qr && (
            <div className="mt-6">
              <p className="text-sm text-zinc-400">
                Nenhum autenticador foi configurado. Instale Google Authenticator, Microsoft
                Authenticator, 1Password ou outro app TOTP.
              </p>
              <button
                disabled={busy}
                onClick={startEnroll}
                className="mt-4 w-full bg-white text-black rounded-xl p-3 font-black inline-flex justify-center gap-2 items-center"
              >
                <KeyRound size={18} /> Configurar autenticador
              </button>
            </div>
          )}

          {qr && (
            <form onSubmit={verifyEnrollment} className="mt-6 space-y-4">
              <div className="bg-white rounded-2xl p-4 w-fit mx-auto">
                <img src={qr} alt="QR Code para configurar MFA" className="w-56 h-56" />
              </div>
              <div className="rounded-xl bg-zinc-950 border border-zinc-800 p-3">
                <p className="text-xs text-zinc-500">Código manual de configuração</p>
                <code className="text-xs break-all">{secret}</code>
              </div>
              <input
                required
                inputMode="numeric"
                pattern="[0-9]{6}"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                placeholder="Código de 6 dígitos"
                className="w-full bg-zinc-950 border border-zinc-700 rounded-xl p-3 text-center text-2xl tracking-[0.35em]"
              />
              <button
                disabled={busy || code.length !== 6}
                className="w-full bg-emerald-400 text-emerald-950 rounded-xl p-3 font-black disabled:opacity-40"
              >
                Ativar MFA
              </button>
            </form>
          )}

          {verified && !aal2 && !qr && (
            <form onSubmit={verifyExisting} className="mt-6 space-y-3">
              <p className="text-sm text-zinc-400">
                Abra seu aplicativo autenticador e informe o código atual.
              </p>
              <input
                autoFocus
                required
                inputMode="numeric"
                pattern="[0-9]{6}"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                placeholder="Código de 6 dígitos"
                className="w-full bg-zinc-950 border border-zinc-700 rounded-xl p-3 text-center text-2xl tracking-[0.35em]"
              />
              <button
                disabled={busy || code.length !== 6}
                className="w-full bg-emerald-400 text-emerald-950 rounded-xl p-3 font-black disabled:opacity-40"
              >
                Verificar segundo fator
              </button>
            </form>
          )}

          {aal2 && (
            <div className="mt-5 flex flex-col sm:flex-row gap-2">
              <a
                href={returnTo}
                className="flex-1 text-center bg-emerald-400 text-emerald-950 rounded-xl p-3 font-black"
              >
                Continuar
              </a>
              <button onClick={startEnroll} className="flex-1 bg-zinc-800 rounded-xl p-3 font-bold">
                Adicionar outro autenticador
              </button>
            </div>
          )}
          {verified && (
            <p className="mt-4 text-xs text-zinc-600">
              {factors.length} autenticador(es) verificado(s). Cadastre um segundo dispositivo antes
              de trocar ou perder o principal.
            </p>
          )}
          {message && <p className="mt-4 text-sm text-zinc-300">{message}</p>}
        </section>
      </div>
    </main>
  );
}
