import type { Metadata } from "next";
import PublicHeader from "@/components/PublicHeader";
import ChristmasUpdatesForm from "@/components/ChristmasUpdatesForm";
import { notificationsConfigured } from "@/lib/notifications";

export const metadata: Metadata = {
  title: "Novidades da campanha de Natal",
  description: "Receba um aviso quando os detalhes da próxima campanha forem publicados.",
};
export const dynamic = "force-dynamic";

export default function CampaignUpdatesPage() {
  return (
    <>
      <PublicHeader />
      <main className="max-w-7xl mx-auto px-5 sm:px-7 py-10 sm:py-16">
        <section className="mx-auto max-w-2xl rounded-3xl border border-zinc-800 bg-zinc-900/70 p-6 sm:p-10">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-300">
            Próxima campanha
          </p>
          <h1 className="mt-3 text-3xl font-black text-white sm:text-5xl">
            Fique por dentro da campanha de Natal
          </h1>
          <p className="mt-5 leading-7 text-zinc-300">
            A ação de Dia das Crianças já terminou. As datas, os prêmios e as regras da campanha de
            Natal serão publicados quando estiverem confirmados. Deixe seu e-mail para receber um
            único aviso quando as informações estiverem disponíveis.
          </p>
          <ChristmasUpdatesForm deliveryReady={notificationsConfigured()} />
          <p className="mt-5 text-xs text-zinc-500">
            Sem cobrança e sem reserva de números. A inscrição pode ser cancelada a qualquer momento
            pelo link incluído no e-mail.
          </p>
          <a href="/#campanhas" className="mt-7 inline-flex items-center gap-2 text-sm underline">
            <span aria-hidden="true">←</span> Voltar às campanhas
          </a>
        </section>
      </main>
    </>
  );
}
