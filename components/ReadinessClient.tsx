"use client";
import { useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase-browser";
import { ensureSession } from "@/lib/mfa-browser";

type Status = {
  checkedAt: string;
  salesApproved: boolean;
  paymentProvider: string;
  productionPixConfigured: boolean;
  notificationsConfigured: boolean;
  serverSecretConfigured: boolean;
};

export default function ReadinessClient() {
  const [status, setStatus] = useState<Status | null>(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");
  async function load() {
    setBusy(true);
    setError("");
    setStatus(null);
    try {
      if (!(await ensureSession("admin", "/admin/preparacao"))) return;
      const { data } = await supabaseBrowser().auth.getSession();
      const response = await fetch("/api/admin/readiness", {
        headers: { Authorization: `Bearer ${data.session?.access_token || ""}` },
        cache: "no-store",
        signal: AbortSignal.timeout(15000),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Falha ao consultar configuração.");
      setStatus(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao consultar configuração.");
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    void load();
  }, []);
  const items = status
    ? [
        [
          "Abertura das vendas",
          status.salesApproved ? "Liberação configurada" : "Compras fechadas",
          "A liberação técnica não comprova autorização jurídica nem homologação do pagamento.",
        ],
        [
          "Pix automático em produção",
          status.productionPixConfigured
            ? "Credenciais configuradas; falta conferir homologação"
            : `Não configurado. Modo atual: ${status.paymentProvider}`,
          "Confirme conta aprovada, chave Pix, webhook e uma transação conciliada antes de operar. O Pix manual exige conferência humana.",
        ],
        [
          "E-mails de pedidos",
          status.notificationsConfigured
            ? "Provedor configurado; entrega deve ser testada"
            : "Provedor não configurado",
          "O envio de pedidos e a recuperação de senha usam configurações diferentes. O SMTP do Supabase também precisa ser validado.",
        ],
        [
          "Integração interna",
          status.serverSecretConfigured
            ? "Chave server-only configurada"
            : "Chave server-only ausente",
          "A chave secret do Supabase deve existir somente no servidor; a presença da configuração não substitui o teste de reserva e conciliação.",
        ],
      ]
    : [];
  return (
    <main className="max-w-4xl mx-auto p-5 sm:p-8 space-y-6">
      <h1 className="text-3xl font-bold">Preparação para operar</h1>
      <p className="ui-muted">
        Acompanhe o que está configurado e o que ainda depende da organização. Esta tela consulta a
        configuração; não libera vendas.
      </p>
      <button
        className="rounded-xl border px-4 py-3 disabled:opacity-50"
        disabled={busy}
        onClick={() => void load()}
      >
        {busy ? "Consultando…" : "Atualizar verificações"}
      </button>
      {error && (
        <p role="alert" className="text-rose-300">
          {error}
        </p>
      )}
      {status && (
        <div aria-live="polite" className="space-y-4">
          <p className="text-sm ui-muted">
            Consultado em {new Date(status.checkedAt).toLocaleString("pt-BR")}
          </p>
          {items.map(([title, value, detail]) => (
            <section key={title} className="rounded-2xl border border-zinc-700 p-5">
              <h2 className="text-lg font-bold">{title}</h2>
              <p className="mt-2 font-medium">{value}</p>
              <p className="mt-2 text-sm ui-muted">{detail}</p>
            </section>
          ))}
          <section className="rounded-2xl border border-amber-600 p-5 space-y-3">
            <h2 className="text-xl font-bold">Dados da organização e regulamento</h2>
            <p>
              Responsável indicada: Bianca Oliveira da Silva. Atendimento e privacidade:{" "}
              <a className="underline" href="mailto:rifatrack@gmail.com">
                rifatrack@gmail.com
              </a>
              . Ainda faltam documento e endereço; autorização e enquadramento; extração e
              correspondência dos números; ordem dos dez prêmios, suplência e entrega. A data
              informada do sorteio é 12/10; a ação presencial é 17/10.
            </p>
            <a className="underline text-emerald-300" href="/termos">
              Revisar termos e pendências
            </a>
            {" · "}
            <a className="underline text-emerald-300" href="/privacidade">
              Revisar privacidade
            </a>
          </section>
          <section className="rounded-2xl border border-zinc-700 p-5 space-y-3">
            <h2 className="text-xl font-bold">Conferência antes da abertura</h2>
            <ol className="list-decimal pl-5 space-y-2">
              <li>Validar reserva concorrente e expiração em ambiente de teste.</li>
              <li>
                Conferir pagamento, evento duplicado, pagamento tardio e devolução no provedor.
              </li>
              <li>
                Testar pagamento por terceiro: comprador permanece no pedido; pagador e referência
                ficam registrados para conciliação.
              </li>
              <li>Testar recuperação de senha e acesso com autenticador.</li>
              <li>Confirmar backup recuperável e responsável pelo atendimento.</li>
            </ol>
            <div className="flex flex-wrap gap-4">
              {[
                ["/admin/pedidos", "Pedidos e pagadores"],
                ["/admin/financeiro", "Conciliação"],
                ["/admin/auditoria", "Eventos de pagamento"],
                ["/admin/notificacoes", "E-mails"],
                ["/admin/seguranca", "Segurança"],
                ["/admin/qrs", "Links dos vendedores"],
              ].map(([href, title]) => (
                <a key={href} href={href} className="underline text-emerald-300">
                  {title}
                </a>
              ))}
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
