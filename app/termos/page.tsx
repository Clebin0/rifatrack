import CampaignNotice from "@/components/CampaignNotice";
import { CHILDRENS_CAMPAIGN as content } from "@/lib/campaign-content";
export const metadata = { title: "Termos de uso | RifaTrack" };
export default function Terms() {
  return (
    <main className="max-w-3xl mx-auto px-5 py-10">
      <a href="/" className="text-emerald-300">
        RifaTrack
      </a>
      <h1 className="text-4xl font-bold mt-6">Termos de uso</h1>
      <CampaignNotice />
      <article className="mt-6 space-y-5 text-zinc-300 leading-7">
        <h2 className="text-xl font-bold text-white">
          Campanha de Dia das Crianças
        </h2>
        <p>
          Segundo as informações fornecidas, a campanha é uma iniciativa de{" "}
          {content.initiative}, sob responsabilidade de {content.organizer}.
          Todo o valor arrecadado será destinado à ação social de Dia das
          Crianças na {content.beneficiary}. Cada número custa R$ 5,00. Sorteio
          informado: {content.drawDate}, pela {content.method}. Participação
          somente para maiores de 18 anos. O Instagram @impostoresuc permanece o
          contato temporário. A autorização aplicável e o regulamento final
          ainda não foram confirmados. A operação financeira neste site
          permanece bloqueada enquanto essas pendências e a homologação não
          forem concluídas.
        </p>
        <h2 className="text-xl font-bold">Prêmios informados</h2>
        <ul className="list-disc pl-5 space-y-2">
          {content.prizes.map((prize) => (
            <li key={prize}>{prize}</li>
          ))}
        </ul>
        <h2 className="text-xl font-bold text-white">Reservas e pagamento</h2>
        <p>
          O valor e os números escolhidos aparecem antes da reserva. O pedido
          vence em 10 minutos. No Pix automático, os números ficam bloqueados
          por mais 2 minutos para receber a confirmação de pagamentos feitos
          dentro do prazo. Essa tolerância não permite pagar depois do
          vencimento. Somente a confirmação de recebimento válida marca o pedido
          como pago.
        </p>
        <h2 className="text-xl font-bold text-white">
          Pagamento fora do prazo e reembolso
        </h2>
        <p>
          Um pagamento tardio ou divergente é encaminhado para conciliação e não
          garante números. Procure o contato da organização com a referência do
          pedido e o comprovante. O responsável financeiro verifica a transação
          e realiza o estorno no provedor quando aplicável. O registro de
          conciliação no RifaTrack não executa uma transferência de dinheiro.
        </p>
        <h2 className="text-xl font-bold text-white">Encerramento e sorteio</h2>
        <p>
          Para esta campanha, o método informado é a Loteria Federal. A
          organização precisa identificar a extração utilizada, a
          correspondência entre o resultado e os números, a ordem de
          distribuição dos prêmios e o procedimento de entrega. A data informada
          para a campanha não é uma confirmação de extração oficial da Caixa. O
          RifaTrack não substituirá esse regulamento por um sorteio drand. Os
          dados e o resultado devem ser registrados com evidências antes de
          anunciar vencedores.
        </p>
        <h2 className="text-xl font-bold text-white">Dados e suporte</h2>
        <p>
          Os dados são utilizados para identificação, gestão de pedidos,
          prevenção de duplicidades e conciliação, conforme a{" "}
          <a className="underline text-emerald-300" href="/privacidade">
            Política de Privacidade
          </a>
          . Não tente interferir em autenticação, reservas ou pagamentos. O
          canal temporário para dúvidas é{" "}
          <a
            className="underline text-emerald-300"
            href="https://www.instagram.com/impostoresuc/"
          >
            @impostoresuc
          </a>
          .
        </p>
      </article>
      <p className="text-sm text-zinc-400 mt-8">
        Versão de preparação: 05/10/2026. Regulamento final e regularização
        pendentes.
      </p>
    </main>
  );
}
