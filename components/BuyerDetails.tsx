"use client";
import { useState, type FormEvent } from "react";
import type { BuyerCampaign } from "@/lib/campaign-types";
import { formatPhone, moneyBRL } from "@/lib/buyer";
import Button from "./ui/Button";
import Input from "./ui/Input";
export type BuyerDetailsValue = {
  adultConfirmed?: boolean;
  buyerName: string;
  buyerPhone: string;
  buyerEmail: string;
  sellerCode: string;
  website: string;
};
export default function BuyerDetails({
  campaign,
  selected,
  referral,
  busy,
  error,
  onBack,
  onSubmit,
}: {
  campaign: BuyerCampaign;
  selected: number[];
  referral: string;
  busy: boolean;
  error: string;
  onBack: () => void;
  onSubmit: (value: BuyerDetailsValue) => Promise<void>;
}) {
  const [value, setValue] = useState<BuyerDetailsValue>({
    buyerName: "",
    buyerPhone: "",
    buyerEmail: "",
    sellerCode: referral,
    website: "",
  });
  const [consent, setConsent] = useState(false);
  const sellerRequired = Boolean(campaign.sellers?.length) && !campaign.seller_name;
  const phoneDigits = value.buyerPhone.replace(/\D/g, "");
  const missing =
    selected.length === 0
      ? "Escolha pelo menos um número."
      : value.buyerName.trim().length < 2
        ? "Preencha seu nome completo."
        : ![10, 11, 12, 13].includes(phoneDigits.length)
          ? "Informe o telefone com DDD."
          : sellerRequired && !value.sellerCode
            ? "Escolha quem indicou a campanha."
            : !consent
              ? "Leia e aceite a política de privacidade."
              : "";
  function update(key: keyof BuyerDetailsValue, next: string) {
    setValue((current) => ({ ...current, [key]: next }));
  }
  function submit(e: FormEvent) {
    e.preventDefault();
    if (!missing && !busy) void onSubmit({ ...value, adultConfirmed: consent });
  }
  return (
    <form id="buyer-details" onSubmit={submit} className="space-y-5" aria-busy={busy}>
      <div>
        <p className="text-xs font-semibold text-emerald-400">ETAPA 2 DE 2</p>
        <h2 tabIndex={-1} id="details-heading" className="text-xl font-bold mt-2">
          Seus dados e reserva
        </h2>
        <p className="text-sm ui-muted mt-2">Confira os números antes de gerar o pedido.</p>
      </div>
      <div className="rounded-xl border border-zinc-700 p-4">
        <div className="flex justify-between">
          <span>{selected.length} número(s)</span>
          <strong>{moneyBRL(selected.length * campaign.price_cents)}</strong>
        </div>
        <p className="text-xs ui-muted mt-3 break-words">
          {[...selected]
            .sort((a, b) => a - b)
            .map((n) => String(n).padStart(3, "0"))
            .join(", ") || "Nenhum número selecionado"}
        </p>
      </div>
      <Input
        label="Nome completo"
        autoComplete="name"
        name="buyerName"
        required
        minLength={2}
        maxLength={100}
        value={value.buyerName}
        onChange={(e) => update("buyerName", e.target.value)}
      />
      <Input
        label="WhatsApp ou telefone"
        type="tel"
        inputMode="tel"
        autoComplete="tel"
        name="buyerPhone"
        required
        maxLength={20}
        placeholder="(00) 00000-0000"
        hint="Informe o DDD. Usado para identificar seu pedido."
        value={value.buyerPhone}
        onChange={(e) => update("buyerPhone", formatPhone(e.target.value))}
      />
      <Input
        label="E-mail (opcional)"
        type="email"
        autoComplete="email"
        name="buyerEmail"
        maxLength={180}
        value={value.buyerEmail}
        onChange={(e) => update("buyerEmail", e.target.value)}
        hint="Para receber notificações, quando disponíveis."
      />
      {sellerRequired && (
        <div>
          <label htmlFor="buyer-seller" className="block text-sm font-semibold mb-2">
            Quem indicou a campanha?
          </label>
          <select
            id="buyer-seller"
            required
            className="ui-input"
            value={value.sellerCode}
            onChange={(e) => update("sellerCode", e.target.value)}
          >
            <option value="">Escolha o vendedor</option>
            {campaign.sellers.map((s) => (
              <option key={s.code} value={s.code}>
                {s.name}
                {s.team ? ` · ${s.team}` : ""}
              </option>
            ))}
          </select>
        </div>
      )}
      {campaign.seller_name && (
        <p className="text-sm ui-muted">
          Indicação de <strong>{campaign.seller_name}</strong>
        </p>
      )}
      <input
        aria-hidden="true"
        className="hidden"
        tabIndex={-1}
        autoComplete="off"
        value={value.website}
        onChange={(e) => update("website", e.target.value)}
      />
      <label className="flex items-start gap-3 text-sm">
        <input
          className="mt-1 h-4 w-4"
          type="checkbox"
          checked={consent}
          required
          onChange={(e) => setConsent(e.target.checked)}
        />
        <span>
          Confirmo que tenho 18 anos ou mais e concordo com o uso dos dados para gestão deste
          pedido, conforme a{" "}
          <a href="/privacidade" target="_blank" rel="noreferrer" className="underline">
            Política de Privacidade
          </a>
          .
        </span>
      </label>
      {error && (
        <p
          role="alert"
          className="rounded-xl border border-rose-700 bg-rose-950 p-3 text-sm text-rose-200"
        >
          {error}
        </p>
      )}
      <p id="reservation-help" role="status" className="text-sm ui-muted">
        {missing || "Tudo pronto. O próximo passo gera uma reserva de 10 minutos."}
      </p>
      <Button
        type="submit"
        className="w-full"
        disabled={Boolean(missing) || busy}
        aria-describedby="reservation-help"
      >
        {busy ? "Gerando reserva…" : "Reservar e continuar"}
      </Button>
      <Button className="w-full" variant="secondary" onClick={onBack} disabled={busy}>
        Voltar aos números
      </Button>
      <p className="text-xs ui-muted">
        A reserva não confirma pagamento. Não pague depois do vencimento do pedido.
      </p>
    </form>
  );
}
