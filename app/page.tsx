import { ArrowRight, Gift, HeartHandshake } from "lucide-react";
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
  const approved = !process.env.VERCEL_ENV || process.env.FINANCIAL_PRODUCTION_APPROVED === "true";
  return (
    <>
      <PublicHeader />
      <main className="max-w-6xl mx-auto px-5 py-10 sm:py-16">
        <section className="grid md:grid-cols-[1.3fr_1fr] gap-8 items-center">
          <div>
            <p className="text-emerald-400 font-semibold flex items-center gap-2 text-sm">
              <HeartHandshake size={18} /> Campanhas e ações sociais
            </p>
            <h1 className="text-4xl sm:text-6xl font-bold tracking-tight mt-5 leading-tight">
              Escolha seus números.
              <br />
              <span className="text-emerald-400">Acompanhe cada etapa.</span>
            </h1>
            <p className="text-lg ui-muted mt-6 max-w-lg">
              Conheça os prêmios, veja quem organiza e consulte as regras antes de participar. Seu
              pedido tem um link para acompanhar a confirmação.
            </p>
            <a className="ui-button ui-button-primary mt-7" href="#campanhas">
              Conhecer as campanhas <ArrowRight size={18} />
            </a>
          </div>
          <Card className="!p-7">
            <Gift size={32} className="text-emerald-400 mb-5" />
            <p className="text-xs font-semibold text-emerald-400 uppercase tracking-wider">
              Dia das Crianças · ação social
            </p>
            <h2 className="text-2xl font-bold mt-3">
              Prêmios para conhecer. Uma ação para apoiar.
            </h2>
            <p className="ui-muted mt-4">
              Curso Wizard, vouchers, chocolate e mais. Organização: {CHILDRENS_CAMPAIGN.organizer}.
            </p>
            <div className="border-t border-zinc-700 mt-5 pt-5 flex justify-between gap-3">
              <span className="ui-muted">Sorteio informado</span>
              <strong>{CHILDRENS_CAMPAIGN.drawDate}</strong>
            </div>
            {!approved && (
              <p className="text-sm text-amber-200 mt-4 rounded-xl bg-amber-950 p-3">
                Campanha em preparação. Compras ainda bloqueadas.
              </p>
            )}
            <a
              className="inline-flex gap-2 items-center underline mt-5"
              href="/campanha/dia-das-criancas"
            >
              Ver prêmios e informações <ArrowRight size={16} />
            </a>
          </Card>
        </section>
        <section id="campanhas" className="mt-16 scroll-mt-6">
          <h2 className="text-2xl font-bold">Conheça as campanhas</h2>
          <p className="ui-muted mt-2 mb-6">
            Confira as informações e as condições de participação.
          </p>
          {failed ? (
            <Card>
              <p role="alert">Não foi possível consultar as campanhas agora.</p>
              <p className="ui-muted mt-2">
                Tente novamente em alguns instantes ou{" "}
                <a className="underline" href="/campanha/dia-das-criancas">
                  acesse a campanha de Dia das Crianças
                </a>
                .
              </p>
            </Card>
          ) : !campaigns.length ? (
            <Card>
              <p>Nenhuma campanha aberta para novas participações.</p>
              <a className="underline inline-block mt-3" href="/campanha/dia-das-criancas">
                Consultar a campanha de Dia das Crianças
              </a>
            </Card>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
              {campaigns.map((c) => (
                <Card key={c.slug}>
                  <p className="text-sm text-emerald-400">
                    {approved ? "Participações abertas" : "Em preparação"}
                  </p>
                  <h3 className="text-2xl font-bold mt-2">{c.name}</h3>
                  <p className="ui-muted text-sm mt-3 line-clamp-3">
                    {c.description || "Confira os prêmios e as informações da campanha."}
                  </p>
                  <div className="flex justify-between mt-6 text-sm">
                    <span className="ui-muted">Por número</span>
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
                    Ver campanha <ArrowRight size={16} />
                  </a>
                </Card>
              ))}
            </div>
          )}
        </section>
        <section aria-label="Como funciona" className="grid sm:grid-cols-3 gap-5 mt-14">
          {[
            ["1", "Confira a campanha", "Leia os prêmios, o organizador e as regras."],
            ["2", "Escolha e reserve", "Selecione os números e confira seus dados."],
            ["3", "Acompanhe seu pedido", "Guarde o link. Consulte pagamento e resultado."],
          ].map(([n, title, description]) => (
            <div key={n}>
              <p className="text-emerald-400 font-bold">{n.padStart(2, "0")}</p>
              <h3 className="font-bold mt-2">{title}</h3>
              <p className="text-sm ui-muted mt-2">{description}</p>
            </div>
          ))}
        </section>
        <footer className="border-t border-zinc-700 mt-14 pt-6 flex flex-wrap gap-5 text-sm ui-muted">
          <a href="/termos">Termos e regras</a>
          <a href="/privacidade">Privacidade</a>
          <a href="/vendedor/login">Área do vendedor</a>
          <a href="/admin/login">Área da organização</a>
        </footer>
      </main>
    </>
  );
}
