"use client";
import { CHILDRENS_CAMPAIGN as content } from "@/lib/campaign-content";
export default function FederalTransparency() {
  return (
    <main className="max-w-3xl mx-auto px-5 py-12">
      <a className="underline" href="/campanha/dia-das-criancas">
        ← Voltar à campanha
      </a>
      <h1 className="text-3xl font-bold mt-6">Transparência da campanha</h1>
      <p className="ui-muted mt-5">
        Responsável informada: {content.organizer}. Sorteio informado:{" "}
        {content.drawDate}. Método: {content.method}.
      </p>
      <div className="ui-card mt-6">
        <h2 className="text-xl font-bold">Como conferir o resultado</h2>
        <p className="ui-muted mt-3">
          A organização precisa publicar a extração oficial utilizada, a
          correspondência entre os resultados e os números da campanha e a ordem
          de distribuição dos prêmios.
        </p>
        <p className="ui-muted mt-3">
          A data da campanha não confirma uma extração oficial da Caixa. Ainda
          não há resultado verificado publicado neste fluxo.
        </p>
      </div>
      <a className="underline inline-block mt-5" href="/termos">
        Consultar o regulamento de preparação
      </a>
    </main>
  );
}
