export const metadata = { title: "Privacidade | RifaTrack" };
const updatedAt = "06/10/2026";

export default function Privacy() {
  return (
    <main className="max-w-3xl mx-auto px-5 py-10">
      <a href="/" className="text-emerald-300">
        RifaTrack
      </a>
      <h1 className="text-4xl font-bold mt-6">Política de Privacidade</h1>
      <p className="mt-3 text-zinc-400">Atualizado em {updatedAt} · versão de preparação</p>
      <div
        className="mt-6 rounded-xl border border-amber-400/40 bg-amber-400/10 px-4 py-4 text-amber-100"
        role="alert"
      >
        <strong>Identificação ainda pendente.</strong> A organização precisa publicar nome ou razão
        social, documento, endereço, e, quando aplicável, o encarregado. O canal indicado para
        atendimento e privacidade é{" "}
        <a className="underline" href="mailto:rifatrack@gmail.com">
          rifatrack@gmail.com
        </a>
        .
      </div>
      <article className="mt-6 space-y-7 text-zinc-300 leading-7">
        <section>
          <h2 className="text-xl font-bold text-white">1. Quem trata os dados</h2>
          <p>
            A organização é informada como Atléticas em Ação, conduzida por Bianca Oliveira da
            Silva. Antes de abrir compras, deve confirmar quem é o controlador e publicar seus dados
            de identificação. A RifaTrack atua como provedora de tecnologia e pode operar dados
            conforme as instruções e serviços contratados. Solicitações de privacidade devem ser
            enviadas a
            <a href="mailto:rifatrack@gmail.com" className="underline text-emerald-300">
              {" "}
              rifatrack@gmail.com
            </a>
            . A organização também mantém o perfil
            <a
              href="https://www.instagram.com/atleticasemacao/"
              className="underline text-emerald-300"
            >
              {" "}
              @atleticasemacao
            </a>
            .
          </p>
        </section>
        <section>
          <h2 className="text-xl font-bold text-white">2. Dados coletados</h2>
          <ul className="list-disc pl-5 space-y-1">
            <li>nome, telefone e e-mail informado pelo comprador;</li>
            <li>números, pedido, vendedor, valor e status de pagamento;</li>
            <li>
              nome declarado do pagador e referência da transação quando a conta é de terceiro;
            </li>
            <li>comprovante enviado voluntariamente, em área privada quando habilitada;</li>
            <li>
              identificadores técnicos necessários para sessão, segurança, prevenção de abuso e
              auditoria.
            </li>
          </ul>
          <p className="mt-3">Não peça documentos ou dados sensíveis em comentários públicos.</p>
        </section>
        <section>
          <h2 className="text-xl font-bold text-white">3. Finalidades e bases</h2>
          <p>
            Os dados podem ser usados para criar e acompanhar pedidos, conciliar pagamentos,
            identificar o pagador indicado, atender suporte, prevenir fraude, cumprir obrigações
            legais e proteger a segurança. A organização deve confirmar a base legal de cada
            finalidade antes do lançamento; podem envolver execução de procedimento ou contrato,
            obrigação legal, exercício regular de direitos e legítimo interesse de segurança, sempre
            com necessidade e proporcionalidade. Consentimento não substitui definição da base
            adequada.
          </p>
        </section>
        <section>
          <h2 className="text-xl font-bold text-white">4. Compartilhamento e fornecedores</h2>
          <p>
            O tratamento pode envolver Supabase (banco e autenticação), Vercel (hospedagem) e,
            somente se habilitados, provedor de pagamentos e e-mail. Vendedores devem acessar apenas
            suas vendas; administradores, conforme perfil e necessidade. Dados podem ser fornecidos
            a autoridades, instituições financeiras, contabilidade ou assessoria jurídica quando
            houver obrigação ou necessidade de defesa. A organização deve manter contratos e avaliar
            transferências internacionais com fornecedores.
          </p>
        </section>
        <section>
          <h2 className="text-xl font-bold text-white">5. Retenção, segurança e cookies</h2>
          <p>
            Registros de pedidos, pagamentos, auditoria e disputas podem ser mantidos pelo tempo
            necessário a obrigações e defesa. Comprovantes e dados de suporte devem ser eliminados
            ou anonimizados quando a finalidade terminar e não houver base para conservação. O prazo
            exato depende da organização e de orientação profissional; não prometemos exclusão
            imediata. São aplicados autenticação, permissões, RLS e armazenamento privado quando
            configurados, mas nenhum serviço garante risco zero. Usamos apenas cookies e
            armazenamento necessários; não há publicidade comportamental prevista neste fluxo.
          </p>
        </section>
        <section>
          <h2 className="text-xl font-bold text-white">6. Direitos do titular</h2>
          <p>
            O titular pode pedir confirmação e acesso, correção, informação sobre uso e
            compartilhamento, portabilidade quando aplicável, eliminação de dados tratados com
            consentimento, oposição e revisão de decisões automatizadas, além de revogar
            consentimento. A organização verificará a identidade, responderá nos prazos aplicáveis e
            explicará quando retenção legal impedir a eliminação. Também é possível reclamar à{" "}
            <a className="underline text-emerald-300" href="https://www.gov.br/anpd/pt-br">
              ANPD
            </a>
            .
          </p>
          <p className="mt-3">
            Envie sua solicitação a{" "}
            <a className="underline text-emerald-300" href="mailto:rifatrack@gmail.com">
              rifatrack@gmail.com
            </a>
            , indicando o direito que deseja exercer. Não envie senhas ou códigos de autenticação. A
            organização poderá solicitar somente os dados necessários para verificar sua identidade,
            por canal privado.
          </p>
        </section>
        <section>
          <h2 className="text-xl font-bold text-white">7. Menores e mudanças</h2>
          <p>
            A campanha é destinada somente a maiores de 18 anos. Não solicitamos dados de crianças
            ou adolescentes para participação. Esta política será atualizada antes da abertura
            financeira e quando finalidades, fornecedores ou regras mudarem.
          </p>
        </section>
      </article>
      <p className="text-sm text-zinc-400 mt-8">
        Esta página informa o funcionamento previsto e não substitui a definição formal do
        controlador, do encarregado, das bases legais ou a revisão por profissional de privacidade.
        A LGPD e outros direitos obrigatórios prevalecem.
      </p>
    </main>
  );
}
