"use client";
import { useEffect, useState } from "react";
import Input from "./ui/Input";
import Button from "./ui/Button";

export default function PayerDeclaration({ token }: { token: string }) {
  const [name, setName] = useState("");
  const [reference, setReference] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;
    fetch(`/api/orders/${token}/payer`, { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error("load_failed");
        return response.json();
      })
      .then((data: { payer_name?: string; transaction_reference?: string } | null) => {
        if (!active) return;
        if (data?.payer_name) {
          setName(data.payer_name);
          setReference(data.transaction_reference || "");
          setMessage("Declaração salva neste pedido.");
        }
        setReady(true);
      })
      .catch(() => {
        if (active)
          setMessage(
            "Não foi possível carregar a declaração anterior. Reabra esta página antes de enviar.",
          );
      });
    return () => {
      active = false;
    };
  }, [token]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch(`/api/orders/${token}/payer`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: name.trim(), reference: reference.trim() }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || "save_failed");
      setMessage("Dados vinculados ao pedido para conferência. Isso não confirma o pagamento.");
    } catch {
      setMessage(
        "Não foi possível salvar. Aguarde um minuto entre alterações. Após 7 dias ou 5 alterações, procure a organização com o código do pedido.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mt-5 rounded-2xl border border-zinc-700 p-4">
      <h2 className="font-bold">Pagou com a conta de outra pessoa?</h2>
      <p className="text-sm ui-muted mt-2">
        Use sempre o Pix deste pedido. Os números continuam no nome do comprador. Informe abaixo o
        titular que aparece no comprovante para ajudar na conferência. Não envie CPF, senha ou dados
        da conta bancária.
      </p>
      <form onSubmit={save} className="space-y-3 mt-4">
        <Input
          label="Nome de quem fez o Pix"
          required
          minLength={2}
          maxLength={100}
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoComplete="off"
        />
        <Input
          label="Identificador da transação no comprovante (opcional)"
          maxLength={120}
          value={reference}
          onChange={(e) => setReference(e.target.value)}
          hint="Pode aparecer como ID da transação ou EndToEndId. Não é a chave Pix."
        />
        <Button type="submit" disabled={!ready || busy || name.trim().length < 2}>
          {busy ? "Salvando…" : "Salvar dados de quem pagou"}
        </Button>
      </form>
      {message && (
        <p role="status" className="text-sm mt-3">
          {message}
        </p>
      )}
      <p className="text-xs ui-muted mt-3">
        Informação declarada pelo comprador. A confirmação depende do recebimento e da conferência
        do Pix.
      </p>
    </section>
  );
}
