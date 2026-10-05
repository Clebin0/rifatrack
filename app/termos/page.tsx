import CampaignNotice from "@/components/CampaignNotice";
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
        <h2 className="text-xl font-bold text-white">Campanha de Dia das Crianças</h2>
        <p>
          A finalidade informada é uma ação social das atléticas. O Instagram @impostoresuc é um
          contato temporário. A identidade do organizador responsável, a descrição e entrega do
          prêmio, as regras finais, a data do sorteio e a autorização aplicável ainda não foram
          confirmadas. Este texto não declara que a campanha está autorizada. A operação financeira
          permanece bloqueada até a conclusão dessas pendências e dos testes operacionais.
        </p>
        <h2 className="text-xl font-bold text-white">Reservas e pagamento</h2>
        <p>
          O valor e os números escolhidos aparecem antes da reserva. O pedido vence em 10 minutos.
          No Pix automático, os números ficam bloqueados por mais 2 minutos para receber a
          confirmação de pagamentos feitos dentro do prazo. Essa tolerância não permite pagar depois
          do vencimento. Somente a confirmação de recebimento válida marca o pedido como pago.
        </p>
        <h2 className="text-xl font-bold text-white">Pagamento fora do prazo e reembolso</h2>
        <p>
          Um pagamento tardio ou divergente é encaminhado para conciliação e não garante números.
          Procure o contato da organização com a referência do pedido e o comprovante. O responsável
          financeiro verifica a transação e realiza o estorno no provedor quando aplicável. O
          registro de conciliação no RifaTrack não executa uma transferência de dinheiro.
        </p>
        <h2 className="text-xl font-bold text-white">Encerramento e sorteio</h2>
        <p>
          O encerramento bloqueia novas vendas e congela a lista elegível. Os novos sorteios usam
          uma rodada futura da rede drand quicknet, fixada no encerramento, com assinatura
          verificável. A lista, o compromisso e o resultado ficam disponíveis na página de
          transparência. Pendências financeiras precisam ser resolvidas antes do sorteio. Reembolsos
          posteriores não alteram retroativamente o registro do sorteio.
        </p>
        <h2 className="text-xl font-bold text-white">Dados e suporte</h2>
        <p>
          Os dados são utilizados para identificação, gestão de pedidos, prevenção de duplicidades e
          conciliação, conforme a{" "}
          <a className="underline text-emerald-300" href="/privacidade">
            Política de Privacidade
          </a>
          . Não tente interferir em autenticação, reservas ou pagamentos. O canal temporário para
          dúvidas é{" "}
          <a className="underline text-emerald-300" href="https://www.instagram.com/impostoresuc/">
            @impostoresuc
          </a>
          .
        </p>
      </article>
      <p className="text-sm text-zinc-400 mt-8">
        Versão de preparação: 05/10/2026. Regras finais e responsável pendentes.
      </p>
    </main>
  );
}
