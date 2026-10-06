import Image from "next/image";
import Card from "./ui/Card";
import { CHILDRENS_CAMPAIGN as campaign } from "@/lib/campaign-content";

const base = "/campaigns/dia-das-criancas/";
const artwork = [
  {
    file: "acao-social.jpg",
    title: "Onde e quando acontece",
    alt: "Arte da ação social: 17/10, Rua Verônica Tribek Moro, 493, Cidade Industrial de Curitiba, ONG Minha Vida Mudou.",
  },
  {
    file: "programacao.jpg",
    title: "Um dia de alegria",
    alt: "Programação da ação: kits de doces, lanches, personagens e brinquedos infláveis.",
  },
  {
    file: "como-ajudar.jpg",
    title: "Outras formas de ajudar",
    alt: "Doações diretamente nas atléticas da UniOpet, UniCesumar, Dom Bosco e Tuiuti. Consulte a organização.",
  },
];

export default function CampaignCommunity() {
  return (
    <section
      id="campaign-community"
      className="space-y-6 my-8 scroll-mt-6"
      aria-label="Atléticas, parceiros e ação social"
    >
      <Card>
        <div className="flex flex-wrap justify-between items-start gap-4">
          <div>
            <p className="text-sm text-emerald-400 font-semibold">
              Juntos pela mesma causa
            </p>
            <h2 className="text-2xl font-bold mt-2">Atléticas em Ação</h2>
            <p className="ui-muted text-sm mt-2">
              Atléticas participantes de {campaign.universities.join(", ")}.
            </p>
          </div>
          <a
            className="ui-button ui-button-secondary"
            href={campaign.contact}
            target="_blank"
            rel="noreferrer"
          >
            Instagram · @atleticasemacao
          </a>
        </div>
        <figure className="mt-5">
          <a
            href={base + "atleticas.png"}
            target="_blank"
            rel="noreferrer"
            className="block rounded-xl overflow-hidden focus-visible:outline"
          >
            <Image
              src={base + "atleticas.png"}
              alt="Faixa oficial com todos os escudos das atléticas participantes, enviada pela organização. Abra para ampliar."
              width={707}
              height={91}
              sizes="(max-width: 640px) 100vw, 1100px"
              className="w-full h-auto"
            />
          </a>
          <figcaption className="text-sm ui-muted mt-2">
            Todos os escudos da arte enviada pela organização. Toque na imagem
            para ampliar.
          </figcaption>
        </figure>
      </Card>

      <Card>
        <h2 className="text-2xl font-bold">Conheça os parceiros</h2>
        <p className="text-sm ui-muted mt-2">
          Apoios divulgados pela organização nas artes da campanha.
        </p>
        <div className="grid md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-6 mt-5 items-start">
          <a
            href={base + "parceiros.jpg"}
            target="_blank"
            rel="noreferrer"
            className="block rounded-2xl overflow-hidden"
          >
            <Image
              src={base + "parceiros.jpg"}
              alt={`Arte dos patrocinadores: ${campaign.partners.join(", ")}. Toque para ampliar.`}
              width={1080}
              height={1350}
              sizes="(max-width: 768px) 100vw, 550px"
              className="w-full h-auto"
            />
            <span className="block text-sm underline py-3">
              Ampliar todos os logos
            </span>
          </a>
          <div>
            <ul className="grid gap-3 text-sm">
              {campaign.partners.map((name) => (
                <li
                  key={name}
                  className="rounded-xl border border-zinc-700 p-3"
                >
                  {name}
                </li>
              ))}
            </ul>
            <p className="text-sm ui-muted mt-4">
              Os nomes seguem a arte enviada. O logo da Wizard aparece duas
              vezes no cartaz.
            </p>
          </div>
        </div>
      </Card>

      <Card>
        <h2 className="text-2xl font-bold">A ação social acontece em 17/10</h2>
        <p className="ui-muted mt-3">
          {campaign.beneficiary} · {campaign.address}.
        </p>
        <p className="text-sm ui-muted mt-2">
          Esta é a data do evento presencial. O sorteio foi informado para{" "}
          {campaign.drawDate}; a extração e as regras ainda precisam ser
          confirmadas.
        </p>
        <ul
          className="flex flex-wrap gap-2 mt-4 text-sm"
          aria-label="Atividades da ação"
        >
          {campaign.activities.map((activity) => (
            <li
              key={activity}
              className="rounded-xl border border-zinc-700 px-3 py-2"
            >
              {activity}
            </li>
          ))}
        </ul>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5 mt-6">
          {artwork.map((art) => (
            <figure key={art.file}>
              <a
                href={base + art.file}
                target="_blank"
                rel="noreferrer"
                className="block rounded-2xl overflow-hidden"
              >
                <Image
                  src={base + art.file}
                  alt={art.alt}
                  width={1080}
                  height={1350}
                  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 370px"
                  className="w-full h-auto"
                />
              </a>
              <figcaption className="mt-3 font-semibold">
                {art.title}{" "}
                <a
                  className="underline text-sm font-normal ui-muted"
                  href={base + art.file}
                  target="_blank"
                  rel="noreferrer"
                >
                  Ampliar arte
                </a>
              </figcaption>
            </figure>
          ))}
        </div>
        <p className="text-sm ui-muted mt-5">
          Para doar diretamente ou participar da ação presencial, fale com a
          organização pelo{" "}
          <a
            href={campaign.contact}
            target="_blank"
            rel="noreferrer"
            className="underline"
          >
            @atleticasemacao
          </a>
          .
        </p>
      </Card>
    </section>
  );
}
