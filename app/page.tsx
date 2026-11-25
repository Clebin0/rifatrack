import { ArrowRight, Gift, HeartHandshake, ShieldCheck, Sparkles, Ticket } from "lucide-react";
import { supabaseInternal } from "@/lib/supabase";
import PublicHeader from "@/components/PublicHeader";
import Card from "@/components/ui/Card";
import { moneyBRL } from "@/lib/buyer";
import { CHILDRENS_CAMPAIGN } from "@/lib/campaign-content";

export const dynamic = "force-dynamic";

type Campaign = {
  name: string;
  slug: string;
  description: string;
  price_cents: number;
  total_numbers: number;
  sold_numbers: number;
  ends_at: string | null;
};

export default async function Home() {
  let campaigns: Campaign[] = [];
  let failed = false;
  try {
    const result = await supabaseInternal().rpc("public_active_campaigns");
    if (result.error) failed = true;
    else campaigns = (result.data || []) as Campaign[];
  } catch {
    failed = true;
  }
  const featuredCampaign = campaigns[0] ?? null;
  const approved = !process.env.VERCEL_ENV || process.env.FINANCIAL_PRODUCTION_APPROVED === "true";
  return (
    <>
      <PublicHeader />
      <main className="public-home">
        <section className="home-hero">
          <div className="home-hero-copy">
            <p className="eyebrow">
              <span className="eyebrow-dot" /> Campanhas com propósito
            </p>
            <h1>
              Uma escolha simples.
              <br />
              <span>Um impacto real.</span>
            </h1>
            <p className="home-lede">
              Descubra campanhas, conheça os prêmios e participe com clareza em cada etapa. Sem
              complicação: você escolhe, acompanha e sabe o que acontece com seu pedido.
            </p>
            <div className="home-actions">
              <a
                className="ui-button ui-button-primary"
                href={featuredCampaign ? `/campanha/${featuredCampaign.slug}` : "#campanhas"}
              >
                {featuredCampaign ? "Ver campanha" : "Explorar campanhas"} <ArrowRight size={18} />
              </a>
              <a className="home-secondary-link" href="/termos">
                Como funciona <ArrowRight size={15} />
              </a>
            </div>
            <div className="home-value-points">
              <span>
                <ShieldCheck size={16} /> Informações transparentes
              </span>
              <span>
                <Ticket size={16} /> Escolha seus números
              </span>
            </div>
          </div>
          <div className="home-feature-wrap">
            <div className="home-feature-glow" aria-hidden="true" />
            <Card className="home-feature-card">
              <div className="home-feature-top">
                <span className="home-feature-icon">
                  <HeartHandshake size={23} />
                </span>
                <span className={`home-feature-tag${!approved ? " is-preparing" : ""}`}>
                  {featuredCampaign
                    ? approved
                      ? "Participações abertas"
                      : "Em preparação"
                    : failed
                      ? "Atualize a página"
                      : "Acompanhe por aqui"}
                </span>
              </div>
              <p className="home-feature-kicker">
                {featuredCampaign
                  ? "CAMPANHA EM DESTAQUE"
                  : failed
                    ? "CAMPANHAS INDISPONÍVEIS"
                    : "NENHUMA CAMPANHA ABERTA"}
              </p>
              <h2>
                {featuredCampaign?.name ??
                  (failed ? "Não conseguimos carregar as campanhas" : "Novas campanhas em breve")}
              </h2>
              <p className="ui-muted mt-3">
                {featuredCampaign?.description ||
                  (featuredCampaign
                    ? "Confira os prêmios, as regras e as informações da campanha."
                    : failed
                      ? "Não conseguimos confirmar se há campanhas abertas. Atualize a página para tentar novamente."
                      : "No momento não há participações abertas. Volte em breve para conhecer as próximas campanhas.")}
              </p>
              <div className="home-prize-preview">
                <span className="home-prize-icon">
                  <Gift size={21} />
                </span>
                <div>
                  <strong>
                    {featuredCampaign
                      ? "Prêmios e regras"
                      : failed
                        ? "Tente novamente em instantes"
                        : "Informação em primeiro lugar"}
                  </strong>
                  <p>
                    {featuredCampaign
                      ? "Consulte os detalhes e as condições informadas pela organização."
                      : failed
                        ? "A disponibilidade não pôde ser consultada agora."
                        : "As campanhas aparecem aqui quando estiverem disponíveis."}
                  </p>
                </div>
              </div>
              {featuredCampaign ? (
                <div className="home-feature-meta">
                  <div>
                    <span>Valor por número</span>
                    <strong>{moneyBRL(featuredCampaign.price_cents)}</strong>
                  </div>
                  <div>
                    <span>Números vendidos</span>
                    <strong>
                      {featuredCampaign.sold_numbers.toLocaleString("pt-BR")} de{" "}
                      {featuredCampaign.total_numbers.toLocaleString("pt-BR")}
                    </strong>
                  </div>
                </div>
              ) : null}
              {featuredCampaign ? (
                <a
                  className="ui-button ui-button-primary w-full mt-5"
                  href={`/campanha/${featuredCampaign.slug}`}
                >
                  Ver campanha <ArrowRight size={17} />
                </a>
              ) : failed ? (
                <a className="ui-button ui-button-secondary w-full mt-5" href="/">
                  Atualizar página <ArrowRight size={17} />
                </a>
              ) : (
                <a className="ui-button ui-button-secondary w-full mt-5" href="#campanhas">
                  Ver campanhas <ArrowRight size={17} />
                </a>
              )}
              {featuredCampaign?.slug === "dia-das-criancas" ? (
                <p className="home-organizer">
                  Organização informada: {CHILDRENS_CAMPAIGN.organizer}
                </p>
              ) : null}
            </Card>
          </div>
          <div className="home-hero-index" aria-hidden="true">
            <span>01</span>
            <span className="home-index-line" />
            <span>PROPÓSITO · PARTICIPAÇÃO · TRANSPARÊNCIA</span>
          </div>
        </section>

        <section id="campanhas" className="home-campaigns">
          <div className="section-heading">
            <div>
              <p className="eyebrow">
                <Sparkles size={15} /> ENCONTRE SUA CAMPANHA
              </p>
              <h2>
                Feito para participar
                <br className="sm:hidden" /> sem dúvidas.
              </h2>
            </div>
            <p className="ui-muted section-description">
              Leia os detalhes, veja as condições e escolha com todas as informações à mão.
            </p>
          </div>
          {failed ? (
            <Card className="home-empty-state">
              <p className="font-semibold">Não foi possível carregar as campanhas.</p>
              <p className="ui-muted mt-2">
                Tente atualizar a página ou consulte as informações da campanha anterior.
              </p>
              <a className="ui-button ui-button-secondary mt-5" href="/campanha/dia-das-criancas">
                Ver campanha anterior <ArrowRight size={16} />
              </a>
            </Card>
          ) : !campaigns.length ? (
            <Card className="home-empty-state">
              <span className="home-empty-icon">
                <Ticket size={22} />
              </span>
              <h3 className="text-lg font-bold mt-4">Novas campanhas em breve</h3>
              <p className="ui-muted mt-2">
                Consulte as informações da campanha anterior ou volte em breve para ver novas
                oportunidades.
              </p>
              <a className="ui-button ui-button-secondary mt-5" href="/campanha/dia-das-criancas">
                Ver campanha anterior <ArrowRight size={16} />
              </a>
            </Card>
          ) : (
            <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
              {campaigns.map((c, index) => (
                <Card key={c.slug} className="home-campaign-card">
                  <div className="home-campaign-card-top">
                    <span className="home-campaign-number">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <span className={`home-campaign-status${approved ? "" : " is-preparing"}`}>
                      <span />
                      {approved ? "Participações abertas" : "Em preparação"}
                    </span>
                  </div>
                  <h3>{c.name}</h3>
                  <p className="ui-muted mt-3 line-clamp-3">
                    {c.description || "Confira os prêmios e as informações da campanha."}
                  </p>
                  <div className="home-campaign-price">
                    <span>Por número</span>
                    <strong>{moneyBRL(c.price_cents)}</strong>
                  </div>
                  {c.ends_at && (
                    <p className="text-xs ui-muted mt-3">
                      Participações até{" "}
                      {new Date(c.ends_at).toLocaleString("pt-BR", {
                        timeZone: "America/Sao_Paulo",
                      })}
                    </p>
                  )}
                  <a
                    className="ui-button ui-button-secondary w-full mt-5"
                    href={`/campanha/${c.slug}`}
                  >
                    Ver detalhes <ArrowRight size={16} />
                  </a>
                </Card>
              ))}
            </div>
          )}
        </section>

        <section className="home-steps" aria-label="Como funciona">
          <div className="home-step-intro">
            <p className="eyebrow">CLARO DO INÍCIO AO FIM</p>
            <h2>
              Três passos.
              <br />
              <span>Você no controle.</span>
            </h2>
          </div>
          {[
            ["01", "Conheça", "Confira os prêmios, a organização e as regras antes de participar."],
            ["02", "Escolha", "Selecione os números disponíveis e confira o valor do pedido."],
            ["03", "Acompanhe", "Guarde o link do pedido e consulte o status do pagamento."],
          ].map(([n, title, description]) => (
            <div className="home-step" key={n}>
              <span>{n}</span>
              <h3>{title}</h3>
              <p className="ui-muted">{description}</p>
            </div>
          ))}
        </section>

        <footer className="home-footer">
          <a href="/" className="text-lg font-extrabold tracking-tight">
            Rifa<span className="text-emerald-400">Track</span>
          </a>
          <p>Participação clara. Informação em primeiro lugar.</p>
          <nav aria-label="Links do rodapé">
            <a href="/termos">Termos e regras</a>
            <a href="/privacidade">Privacidade</a>
            <a href="/vendedor/login">Área do vendedor</a>
            <a href="/admin/login">Área da organização</a>
          </nav>
          <span className="home-footer-copy">© {new Date().getFullYear()} RifaTrack</span>
        </footer>
      </main>
    </>
  );
}
