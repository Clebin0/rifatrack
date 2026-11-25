"use client";

import { FormEvent, useState } from "react";
import { ArrowRight, CheckCircle2, Mail } from "lucide-react";

export default function ChristmasUpdatesForm({ deliveryReady }: { deliveryReady: boolean }) {
  const [email, setEmail] = useState("");
  const [consent, setConsent] = useState(false);
  const [website, setWebsite] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [complete, setComplete] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/campaign-updates", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, consent, website }),
      });
      const result = (await response.json()) as { message?: string; error?: string };
      if (!response.ok) {
        setMessage(result.error || "Não foi possível registrar seu interesse. Tente novamente.");
        return;
      }
      setEmail("");
      setConsent(false);
      setWebsite("");
      setComplete(true);
      setMessage(
        deliveryReady
          ? "Inscrição registrada. Enviaremos um aviso único quando a campanha de Natal for publicada."
          : "Interesse registrado. O aviso só poderá ser enviado quando o serviço de e-mail estiver ativo.",
      );
    } catch {
      setMessage("Não foi possível conectar agora. Confira sua conexão e tente novamente.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      onSubmit={submit}
      className="mt-7 space-y-5"
      aria-label="Receber aviso da campanha de Natal"
    >
      <div>
        <label htmlFor="christmas-update-email" className="block text-sm font-semibold mb-2">
          Seu e-mail
        </label>
        <input
          id="christmas-update-email"
          type="email"
          autoComplete="email"
          maxLength={254}
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="voce@exemplo.com"
          className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-white placeholder:text-zinc-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
        />
      </div>
      <div className="sr-only" aria-hidden="true">
        <label htmlFor="christmas-update-website">Seu site</label>
        <input
          id="christmas-update-website"
          tabIndex={-1}
          autoComplete="off"
          value={website}
          onChange={(event) => setWebsite(event.target.value)}
        />
      </div>
      <label className="flex items-start gap-3 text-sm text-zinc-300">
        <input
          type="checkbox"
          required
          checked={consent}
          onChange={(event) => setConsent(event.target.checked)}
          className="mt-1 accent-emerald-400"
        />
        <span>
          Quero receber um e-mail quando os detalhes da campanha de Natal forem publicados. Meu
          endereço será usado somente para esse aviso. Posso cancelar quando quiser. Veja a{" "}
          <a href="/privacidade" className="underline text-emerald-300">
            Política de Privacidade
          </a>
          .
        </span>
      </label>
      {!deliveryReady && (
        <p className="rounded-xl border border-amber-800 bg-amber-950/20 p-3 text-sm text-amber-100">
          O canal de e-mail ainda está sendo preparado. Seu interesse pode ser registrado, mas o
          aviso não será enviado até a ativação do serviço.
        </p>
      )}
      <button
        type="submit"
        disabled={busy}
        className="ui-button ui-button-primary w-full justify-center disabled:cursor-not-allowed disabled:opacity-60"
      >
        {busy ? "Registrando…" : complete ? "Atualizar inscrição" : "Quero receber o aviso"}
        {complete ? <CheckCircle2 size={18} /> : <ArrowRight size={18} />}
      </button>
      {message && (
        <p
          role={complete ? "status" : "alert"}
          aria-live="polite"
          className="flex items-start gap-2 text-sm text-zinc-200"
        >
          {complete && <Mail size={17} className="mt-0.5 shrink-0 text-emerald-300" />}
          {message}
        </p>
      )}
    </form>
  );
}
