import { Gift, CalendarDays, Users, ShieldCheck } from "lucide-react";
import type { BuyerCampaign } from "@/lib/campaign-types";
import Card from "./ui/Card";
import { CHILDRENS_CAMPAIGN } from "@/lib/campaign-content";
export default function CampaignFacts({
  campaign,
}: {
  campaign: BuyerCampaign;
}) {
  const content =
    campaign.slug === "dia-das-criancas" ? CHILDRENS_CAMPAIGN : null;
  return (
    <section
      aria-label="Informações da campanha"
      className="grid sm:grid-cols-2 gap-3 my-6"
    >
      <Card className="sm:col-span-2">
        <div className="flex items-center gap-3">
          <Gift className="text-emerald-400" aria-hidden="true" />
          <h2 className="text-xl font-bold">
            {content ? "Conheça os prêmios" : "Prêmio"}
          </h2>
        </div>
        {content ? (
          <>
            <ul className="grid sm:grid-cols-2 gap-3 mt-5">
              {content.prizes.map((prize) => (
                <li
                  key={prize}
                  className="rounded-xl border border-zinc-700 p-3 text-sm"
                >
                  {prize}
                </li>
              ))}
            </ul>
            <p className="text-xs ui-muted mt-4">
              Prêmios informados pela organização. Fotos e regras de
              distribuição aguardam confirmação.
            </p>
          </>
        ) : (
          <p className="text-sm ui-muted mt-2">
            Descrição e foto aguardando confirmação da organização.
          </p>
        )}
      </Card>
      <Card>
        <CalendarDays className="text-emerald-400 mb-3" aria-hidden="true" />
        <h2 className="font-bold">Sorteio informado</h2>
        <p className="text-2xl font-bold mt-2">
          {content?.drawDate || "A confirmar"}
        </p>
        <p className="text-sm ui-muted mt-2">
          {content
            ? `Método informado: ${content.method}. O regulamento deve definir a extração e a correspondência dos números.`
            : "O prazo de participação não é a data do sorteio."}
        </p>
      </Card>
      <Card>
        <Users className="text-emerald-400 mb-3" aria-hidden="true" />
        <h2 className="font-bold">Quem organiza</h2>
        <p className="text-lg font-semibold mt-2">
          {content?.organizer || "A confirmar"}
        </p>
        <p className="text-sm ui-muted mt-2">
          {content
            ? `Responsável pela campanha, pelo sorteio e pela entrega dos prêmios. Ação: ${content.initiative}.`
            : "Responsável aguardando identificação."}
        </p>
        {content && (
          <a
            className="inline-block text-sm underline text-emerald-400 mt-2"
            href={content.contact}
            target="_blank"
            rel="noreferrer"
          >
            Falar com a organização · @impostoresuc
          </a>
        )}
      </Card>
      <Card className="sm:col-span-2">
        <ShieldCheck className="text-emerald-400 mb-3" aria-hidden="true" />
        <h2 className="font-bold">Descrição e regulamento</h2>
        <p className="text-sm ui-muted mt-2">
          {content
            ? `Segundo a organização, todo o valor arrecadado será destinado à ação social de Dia das Crianças na ${content.beneficiary}, proporcionando diversão, carinho e alegria a crianças em situação de vulnerabilidade social.`
            : "Consulte as regras e as condições da campanha."}
        </p>
        <p className="text-sm ui-muted mt-3">
          {content
            ? "Participação somente para maiores de 18 anos. Pagamento por Pix. Fotos, condições de entrega e regras de distribuição dos prêmios aguardam confirmação."
            : "A participação financeira depende da regularização da campanha."}
        </p>
        <div className="flex gap-4 mt-3 text-sm">
          <a className="underline" href="/termos">
            Regulamento
          </a>
          <a
            className="underline"
            href={`/campanha/${campaign.slug}/transparencia`}
          >
            Transparência
          </a>
        </div>
      </Card>
    </section>
  );
}
