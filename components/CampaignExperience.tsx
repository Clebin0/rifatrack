"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { RefreshCw } from "lucide-react";
import type { BuyerCampaign } from "@/lib/campaign-types";
import { moneyBRL, reconcileSelection } from "@/lib/buyer";
import PublicHeader from "./PublicHeader";
import CampaignNotice from "./CampaignNotice";
import CampaignFacts from "./CampaignFacts";
import NumberPicker from "./NumberPicker";
import BuyerDetails, { type BuyerDetailsValue } from "./BuyerDetails";
import Button from "./ui/Button";
import Card from "./ui/Card";
import { useUI } from "./ui/UIProvider";
import Loading from "@/app/loading";
import { CHILDRENS_CAMPAIGN } from "@/lib/campaign-content";
export default function CampaignExperience({
  slug,
  salesApproved = true,
}: {
  slug: string;
  salesApproved?: boolean;
}) {
  const router = useRouter();
  const query = useSearchParams();
  const referral = (query.get("vendedor") || "").toUpperCase();
  const { toast } = useUI();
  const toastRef = useRef(toast);
  toastRef.current = toast;
  const [campaign, setCampaign] = useState<BuyerCampaign | null>(null);
  const [selected, setSelected] = useState<number[]>([]);
  const selectedRef = useRef<number[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [networkError, setNetworkError] = useState("");
  const [selectionNotice, setSelectionNotice] = useState("");
  const [submitError, setSubmitError] = useState("");
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState(1);
  const [now, setNow] = useState(() => Date.now());
  function select(numbers: number[]) {
    selectedRef.current = numbers;
    setSelected(numbers);
  }
  const refresh = useCallback(
    async (signal?: AbortSignal) => {
      setRefreshing(true);
      try {
        const res = await fetch(
          `/api/campaigns/${encodeURIComponent(slug)}${referral ? `?vendedor=${encodeURIComponent(referral)}` : ""}`,
          {
            cache: "no-store",
            signal: signal
              ? AbortSignal.any([signal, AbortSignal.timeout(10000)])
              : AbortSignal.timeout(10000),
          },
        );
        if (!res.ok)
          throw new Error(
            res.status === 404
              ? "Não encontramos esta campanha. Confira o endereço."
              : "Não foi possível atualizar a disponibilidade. Tente novamente antes de reservar.",
          );
        const data: BuyerCampaign = await res.json();
        if (signal?.aborted) return;
        setCampaign(data);
        setNetworkError("");
        const result = reconcileSelection(selectedRef.current, new Set(data.unavailable || []));
        if (result.removed.length) {
          select(result.kept);
          const notice = `Os números ${result.removed.map((n) => String(n).padStart(3, "0")).join(", ")} foram reservados por outra pessoa e saíram da sua seleção. Escolha outros para continuar.`;
          setSelectionNotice(notice);
          toastRef.current(notice);
        }
      } catch (error) {
        if (!signal?.aborted)
          setNetworkError(
            error instanceof Error ? error.message : "Falha de conexão. Tente novamente.",
          );
      } finally {
        if (!signal?.aborted) {
          setRefreshing(false);
          setLoading(false);
        }
      }
    },
    [slug, referral],
  );
  useEffect(() => {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    select([]);
    setCampaign(null);
    setLoading(true);
    setStep(1);
    setSelectionNotice("");
    async function poll() {
      if (!document.hidden) await refresh(controller.signal);
      if (!controller.signal.aborted) timer = setTimeout(poll, 20000);
    }
    void poll();
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [refresh]);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  const unavailable = useMemo(() => new Set(campaign?.unavailable || []), [campaign]);
  const sold = useMemo(() => new Set(campaign?.sold || []), [campaign]);
  const reserved = useMemo(() => new Set(campaign?.reserved || []), [campaign]);
  const closed = Boolean(
    campaign?.deadline_reached ||
    campaign?.finalized_at ||
    campaign?.status !== "active" ||
    (campaign.ends_at && now >= Date.parse(campaign.ends_at)),
  );
  const salesOpen = salesApproved && !closed;
  const amount = (campaign?.price_cents || 0) * selected.length;
  const drawRemaining = Math.max(0, Date.parse(CHILDRENS_CAMPAIGN.drawAt) - now);
  const drawDays = Math.floor(drawRemaining / 86400000);
  const drawHours = Math.floor((drawRemaining % 86400000) / 3600000);
  function toggle(n: number) {
    if (!salesOpen || unavailable.has(n)) return;
    const current = selectedRef.current;
    if (!current.includes(n) && current.length >= 50) {
      toastRef.current("Você pode escolher até 50 números por pedido.");
      return;
    }
    select(current.includes(n) ? current.filter((v) => v !== n) : [...current, n]);
  }
  function randomPick(qty: number) {
    if (!campaign || !salesOpen) return;
    // Reservoir sampling bounds memory even for campaigns with 100,000 numbers.
    const picks: number[] = [];
    let seen = 0;
    for (let n = 1; n <= campaign.total_numbers; n++) {
      if (unavailable.has(n)) continue;
      seen++;
      if (picks.length < qty) picks.push(n);
      else {
        const index = Math.floor(Math.random() * seen);
        if (index < qty) picks[index] = n;
      }
    }
    select(picks);
  }
  function continueToDetails() {
    if (!selected.length || !salesOpen) return;
    setStep(2);
    requestAnimationFrame(() => {
      document.getElementById("details-heading")?.focus();
      document
        .getElementById("buyer-summary")
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }
  async function submit(value: BuyerDetailsValue) {
    if (!salesOpen || !selectedRef.current.length || busy || networkError) return;
    setBusy(true);
    setSubmitError("");
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ campaignSlug: slug, ...value, numbers: selectedRef.current }),
        signal: AbortSignal.timeout(20000),
      });
      const data = await res.json();
      if (!res.ok)
        throw new Error(
          data.error || "Não foi possível reservar. Confira os números e tente novamente.",
        );
      router.push(`/pedido/${data.order.public_token}`);
    } catch (error) {
      setSubmitError(
        error instanceof Error && error.name === "TimeoutError"
          ? "A resposta demorou. Antes de tentar novamente, verifique se a reserva foi criada para evitar pedidos duplicados."
          : error instanceof Error
            ? error.message
            : "Não foi possível concluir a reserva.",
      );
      await refresh();
    } finally {
      setBusy(false);
    }
  }
  if (loading) return <Loading />;
  if (!campaign)
    return (
      <>
        <PublicHeader />
        <main className="max-w-xl mx-auto px-5 py-16">
          <h1 className="text-3xl font-bold">Não conseguimos abrir a campanha</h1>
          <p role="alert" className="ui-muted my-5">
            {networkError}
          </p>
          <Button onClick={() => void refresh()} disabled={refreshing}>
            Tentar novamente
          </Button>
          <a href="/" className="ml-4 underline">
            Ver campanhas
          </a>
        </main>
      </>
    );
  return (
    <>
      <PublicHeader />
      <main className="max-w-6xl mx-auto px-5 pt-8 pb-32 lg:pb-12">
        {slug === "dia-das-criancas" && <CampaignNotice />}
        <div className="mt-8">
          <p className="text-emerald-400 text-sm font-semibold">
            {campaign.finalized_at
              ? "Campanha finalizada"
              : !salesApproved
                ? "Campanha em preparação"
                : closed
                  ? "Participações encerradas"
                  : "Escolha seus números"}
          </p>
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight mt-3 max-w-3xl">
            {campaign.name}
          </h1>
          <p className="ui-muted mt-4 max-w-2xl text-lg">
            {campaign.description ||
              "Conheça a campanha, confira as informações e acompanhe seu pedido."}
          </p>
        </div>
        {slug === "dia-das-criancas" && (
          <p className="text-sm ui-muted mt-5" role="timer" aria-live="off">
            {drawRemaining
              ? `Faltam ${drawDays} dias e ${drawHours} horas para a data informada do sorteio.`
              : "A data informada do sorteio foi alcançada. Aguarde a publicação do resultado."}
          </p>
        )}
        <a href="#number-picker" className="ui-button ui-button-primary mt-5">
          {salesOpen ? "Escolher meus números" : "Ver números da campanha"}
        </a>
        <CampaignFacts campaign={campaign} />
        <div className="flex flex-wrap gap-3 text-sm mb-8">
          <span className="ui-card !py-3">
            Por número: <strong>{moneyBRL(campaign.price_cents)}</strong>
          </span>
          {campaign.ends_at && (
            <span className="ui-card !py-3">
              Participações até{" "}
              <strong>
                {new Date(campaign.ends_at).toLocaleString("pt-BR", {
                  timeZone: "America/Sao_Paulo",
                })}
              </strong>
            </span>
          )}
        </div>
        {campaign.draw_result && (
          <Card className="mb-6">
            <p className="ui-muted">Resultado publicado</p>
            <p className="text-3xl font-bold mt-2">
              Número {String(campaign.draw_result.number).padStart(3, "0")}
            </p>
            <a
              className="underline text-emerald-400 inline-block mt-3"
              href={`/campanha/${slug}/transparencia`}
            >
              Conferir a prova do sorteio
            </a>
          </Card>
        )}
        {networkError && (
          <div
            role="alert"
            className="rounded-xl border border-amber-700 bg-amber-950 text-amber-200 p-4 mb-5"
          >
            <p>{networkError}</p>
            <Button
              variant="secondary"
              className="mt-3"
              onClick={() => void refresh()}
              disabled={refreshing}
            >
              Tentar atualizar
            </Button>
          </div>
        )}
        {selectionNotice && (
          <div role="status" className="ui-card mb-5 text-sm">
            <p>{selectionNotice}</p>
            <button type="button" onClick={() => setSelectionNotice("")} className="underline mt-2">
              Entendi
            </button>
          </div>
        )}
        <section className="grid lg:grid-cols-[1fr_350px] gap-6 items-start">
          <Card id="number-picker" className="scroll-mt-6">
            <div className="flex justify-between items-start gap-3 mb-5">
              <div>
                <p className="text-xs text-emerald-400 font-semibold">ETAPA 1 DE 2</p>
                <h2 className="text-2xl font-bold mt-2">Escolha seus números</h2>
                <p className="text-sm ui-muted mt-2">
                  {Math.max(0, campaign.total_numbers - unavailable.size)} disponíveis ·{" "}
                  {campaign.reserved_numbers} reservados · {campaign.sold_numbers} vendidos
                </p>
              </div>
              <Button
                variant="secondary"
                aria-label="Atualizar disponibilidade"
                onClick={() => void refresh()}
                disabled={refreshing}
              >
                <RefreshCw size={18} className={refreshing ? "animate-spin" : ""} />
              </Button>
            </div>
            {salesOpen && (
              <div className="flex gap-2 mb-5">
                <Button variant="secondary" onClick={() => randomPick(5)}>
                  Escolher 5
                </Button>
                <Button variant="secondary" onClick={() => randomPick(10)}>
                  Escolher 10
                </Button>
              </div>
            )}
            <NumberPicker
              total={campaign.total_numbers}
              unavailable={unavailable}
              sold={sold}
              reserved={reserved}
              selected={selected}
              salesOpen={salesOpen && !networkError && !busy}
              onToggle={toggle}
            />
          </Card>
          <Card id="buyer-summary" className="lg:sticky lg:top-6 scroll-mt-5">
            {!salesOpen ? (
              <>
                <h2 className="text-xl font-bold">
                  {!salesApproved ? "Campanha em preparação" : "Reservas encerradas"}
                </h2>
                <p className="text-sm ui-muted mt-3">
                  {!salesApproved
                    ? "As compras estão bloqueadas enquanto a organização conclui as pendências da campanha."
                    : "Não é possível criar novas reservas nesta campanha."}
                </p>
                <a href="/termos" className="underline text-sm inline-block mt-4">
                  Consultar as regras
                </a>
              </>
            ) : (
              <>
                <div hidden={step !== 1}>
                  <h2 className="text-xl font-bold">Sua seleção</h2>
                  <div className="flex justify-between my-4">
                    <span>{selected.length} número(s)</span>
                    <strong>{moneyBRL(amount)}</strong>
                  </div>
                  <p className="text-sm ui-muted break-words mb-5">
                    {selected.length
                      ? [...selected]
                          .sort((a, b) => a - b)
                          .map((n) => String(n).padStart(3, "0"))
                          .join(", ")
                      : "Escolha um número na grade para começar."}
                  </p>
                  <Button
                    className="w-full"
                    disabled={!selected.length || Boolean(networkError)}
                    onClick={continueToDetails}
                  >
                    Continuar para seus dados
                  </Button>
                  <p className="text-xs ui-muted mt-3">
                    Até 50 números por pedido. A reserva é criada no próximo passo.
                  </p>
                </div>
                <div hidden={step !== 2}>
                  <BuyerDetails
                    campaign={campaign}
                    selected={selected}
                    referral={referral}
                    busy={busy || Boolean(networkError)}
                    error={submitError}
                    onBack={() => setStep(1)}
                    onSubmit={submit}
                  />
                </div>
              </>
            )}
          </Card>
        </section>
        <footer className="ui-muted text-sm pt-10 flex flex-wrap gap-5">
          <a href="/termos">Termos e regras</a>
          <a href="/privacidade">Privacidade</a>
          <a href="/">Outras campanhas</a>
        </footer>
      </main>
      <div className="lg:hidden fixed bottom-0 inset-x-0 ui-header !border-t p-4 pb-[max(1rem,env(safe-area-inset-bottom))] flex items-center gap-4 z-30">
        <div className="flex-1">
          <p className="text-xs ui-muted">{selected.length} número(s)</p>
          <strong>{moneyBRL(amount)}</strong>
        </div>
        <Button
          disabled={!salesOpen || !selected.length || Boolean(networkError) || busy}
          onClick={
            step === 1
              ? continueToDetails
              : () =>
                  (
                    document.getElementById("buyer-details") as HTMLFormElement | null
                  )?.requestSubmit()
          }
        >
          {!salesOpen
            ? "Reservas fechadas"
            : step === 1
              ? "Continuar"
              : busy
                ? "Reservando…"
                : "Reservar"}
        </Button>
      </div>
    </>
  );
}
