import CampaignNotice from "@/components/CampaignNotice";
import { CHILDRENS_CAMPAIGN as content } from "@/lib/campaign-content";

export const metadata = { title: "Termos de uso | RifaTrack" };
const updatedAt = "06/10/2026";

export default function Terms() {
  return (
    <main className="max-w-3xl mx-auto px-5 py-10">
      <a href="/" className="text-emerald-300">
        RifaTrack
      </a>
      <h1 className="text-4xl font-bold mt-6">Termos de uso</h1>
      <p className="mt-3 text-zinc-400">Atualizado em {updatedAt} · versão de preparação</p>
      <CampaignNotice />
      <div
        className="mt-6 rounded-xl border border-amber-400/40 bg-amber-400/10 px-4 py-4 text-amber-100"
        role="alert"
      >
        <strong>Leia antes de participar.</strong> Estes termos não tornam a campanha legal por si
        só, não substituem autorização pública e não eliminam direitos previstos em lei. A campanha
        está em preparação e as compras permanecem fechadas até a organização concluir a
        regularização.
      </div>
      <article className="mt-6 space-y-7 text-zinc-300 leading-7">
        <section>
          <h2 className="text-xl font-bold text-white">1. Quem participa</h2>
          <p>
            A RifaTrack fornece tecnologia para publicar campanhas, controlar números, pedidos e
            pagamentos. A organização responsável é a iniciativa{" "}
            <strong>{content.initiative}</strong>, informada como conduzida por
            <strong> {content.organizer}</strong>, com valores destinados à ação na{" "}
            <strong>{content.beneficiary}</strong>. A organização, e não a RifaTrack, responde pela
            autorização, divulgação, arrecadação, sorteio, prêmios e entrega. O atendimento é feito
            por{" "}
            <a className="underline text-emerald-300" href="mailto:rifatrack@gmail.com">
              rifatrack@gmail.com
            </a>
            . A identidade jurídica, documento e endereço ainda precisam ser confirmados antes da
            abertura.
          </p>
        </section>
        <section>
          <h2 className="text-xl font-bold text-white">2. Situação desta campanha</h2>
          <p>
            Foram informados preço de R$ 5,00 por número, sorteio em {content.drawDate} e uso da{" "}
            {content.method}. Isso ainda não confirma uma extração oficial da Caixa nem define como
            o resultado será convertido em números ou na ordem dos dez prêmios. Antes de vender, a
            organização deve publicar extração, regra matemática, suplentes, prazo de reclamação,
            entrega e autorização aplicável. Sem esses itens, a campanha não deve operar.
          </p>
          <p className="mt-3">
            A legislação brasileira exige autorização prévia para operações de distribuição de
            prêmios em hipóteses previstas na{" "}
            <a
              className="underline text-emerald-300"
              href="https://planalto.gov.br/ccivil_03/leis/l5768.htm"
            >
              Lei nº 5.768/1971
            </a>{" "}
            e no{" "}
            <a
              className="underline text-emerald-300"
              href="https://www.planalto.gov.br/ccivil_03/decreto/antigos/d70951.htm"
            >
              Decreto nº 70.951/1972
            </a>
            . A RifaTrack não afirma que esta campanha esteja autorizada.
          </p>
        </section>
        <section>
          <h2 className="text-xl font-bold text-white">3. Prêmios informados</h2>
          <ul className="list-disc pl-5 space-y-1">
            {content.prizes.map((prize) => (
              <li key={prize}>{prize}</li>
            ))}
          </ul>
          <p className="mt-3">
            A lista é uma declaração da organização e deverá ser confirmada no regulamento final,
            com disponibilidade, validade e responsável pela entrega. A RifaTrack não garante prêmio
            de terceiro.
          </p>
        </section>
        <section>
          <h2 className="text-xl font-bold text-white">4. Reserva e pagamento</h2>
          <p>
            Uma seleção só é garantida depois de reserva válida e confirmação do pagamento. O pedido
            vence em dez minutos; no Pix automático pode existir tolerância técnica de dois minutos
            para confirmação feita dentro do prazo. Pagar fora do prazo, para a chave errada ou sem
            referência correta não garante o número. O comprador deve guardar pedido e comprovante e
            falar com a organização.
          </p>
          <p className="mt-3">
            Para pagamento feito por conta bancária de outra pessoa, declare o nome do pagador e, se
            disponível, a referência da transação. Isso ajuda a conciliação, mas não transforma a
            declaração em confirmação nem autoriza divulgar dados do pagador.
          </p>
        </section>
        <section>
          <h2 className="text-xl font-bold text-white">5. Valor pago e reembolso</h2>
          <p>
            O valor pago <strong>não é automaticamente reembolsável</strong> quando a reserva foi
            validamente confirmada e a campanha é executada conforme o regulamento. Essa frase não
            resolve o assunto de forma absoluta: nenhuma cláusula pode afastar devolução exigida por
            lei, decisão de autoridade, falha comprovada, cobrança duplicada, fraude, cancelamento
            da campanha ou outra hipótese reconhecida no regulamento e na legislação aplicável.
          </p>
          <p className="mt-3">
            Pagamentos tardios ou divergentes serão analisados pela organização. Se a devolução for
            devida, será feita pelo provedor ou meio definido pela organização, após a conferência.
            A RifaTrack registra a conciliação, mas não promete nem executa por conta própria a
            transferência. Em contratações à distância, a organização deve avaliar também o{" "}
            <a
              className="underline text-emerald-300"
              href="https://www.planalto.gov.br/ccivil_03/leis/l8078compilado.htm"
            >
              Código de Defesa do Consumidor
            </a>
            , inclusive o art. 49 quando aplicável.
          </p>
        </section>
        <section>
          <h2 className="text-xl font-bold text-white">6. Sorteio, reclamação e entrega</h2>
          <p>
            O resultado só deve ser divulgado depois do registro da extração, da regra de
            correspondência, da ordem dos prêmios e das evidências. A organização informará o
            vencedor por canal verificável e publicará prazo e procedimento de reclamação no
            regulamento final. Entrega, custos, validade e eventual substituição são
            responsabilidade da organização e dos parceiros.
          </p>
        </section>
        <section>
          <h2 className="text-xl font-bold text-white">7. Dados, segurança e suporte</h2>
          <p>
            O uso de dados está explicado na{" "}
            <a className="underline text-emerald-300" href="/privacidade">
              Política de Privacidade
            </a>
            . Não tente interferir em autenticação, reservas, pagamentos ou resultados. Para
            atendimento, use
            <a className="underline text-emerald-300" href="mailto:rifatrack@gmail.com">
              {" "}
              rifatrack@gmail.com
            </a>
            . A organização também está em
            <a className="underline text-emerald-300" href={content.contact}>
              {" "}
              @atleticasemacao
            </a>
            . Não envie documentos ou comprovantes em comentários públicos.
          </p>
        </section>
        <section>
          <h2 className="text-xl font-bold text-white">8. Aceite e alterações</h2>
          <p>
            Ao continuar, a pessoa confirma ter pelo menos 18 anos e ter lido estes termos.
            Alterações relevantes serão publicadas antes de nova reserva. Em caso de conflito,
            prevalecem a lei, decisões de autoridade e direitos que não possam ser renunciados.
          </p>
        </section>
      </article>
      <p className="text-sm text-zinc-400 mt-8">
        A revisão por advogada(o), a identificação formal da organização e a autorização continuam
        pendentes. Nenhum texto de site garante ausência de risco jurídico.
      </p>
    </main>
  );
}
