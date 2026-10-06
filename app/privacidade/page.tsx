export const metadata = { title: "Privacidade | RifaTrack" };
export default function Privacy() {
  return (
    <main className="max-w-3xl mx-auto px-5 py-10">
      <a href="/" className="text-emerald-300">
        RifaTrack
      </a>
      <h1 className="text-4xl font-bold mt-6">Política de Privacidade</h1>
      <article className="mt-6 space-y-5 text-zinc-300 leading-7">
        <h2 className="text-xl font-bold text-white">Responsável e contato</h2>
        <p>
          A responsável informada pela campanha de Dia das Crianças é Bianca
          Oliveira da Silva, na iniciativa Atléticas em Ação. A política final
          ainda precisa confirmar o controlador e as bases de tratamento. O
          contato da organização para dúvidas e pedidos de acesso, correção ou
          exclusão é{" "}
          <a
            href="https://www.instagram.com/atleticasemacao/"
            className="underline text-emerald-300"
          >
            @atleticasemacao
          </a>
          . Não envie documentos ou comprovantes publicamente nos comentários. A
          política final precisa ser aprovada pelo responsável antes da operação
          financeira.
        </p>
        <h2 className="text-xl font-bold text-white">Dados e finalidades</h2>
        <p>
          Tratamos nome, telefone, e-mail opcional, números, vendedor indicado,
          referência e status do pedido para executar a reserva, comunicar
          pagamentos e conciliar transações. Comprovantes enviados
          voluntariamente ficam em armazenamento privado. Identificadores
          técnicos ajudam a limitar abusos. A atualização financeira em preparação
          prevê aprimorar os limites por IP e reduzir os dados expostos nas
          consultas públicas.
        </p>
        <h2 className="text-xl font-bold text-white">
          Base e compartilhamento
        </h2>
        <p>
          A política de lançamento deverá confirmar a base legal de cada
          finalidade, incluindo procedimentos relacionados ao pedido,
          cumprimento das obrigações aplicáveis e prevenção de fraude. O
          consentimento exibido não substitui essa definição. A hospedagem e o
          banco usam Vercel e Supabase. Asaas e Resend recebem apenas os dados
          necessários quando suas integrações estiverem habilitadas. Vendedores
          acessam somente suas próprias vendas; administradores têm acesso
          conforme o perfil.
        </p>
        <h2 className="text-xl font-bold text-white">Proteção e retenção</h2>
        <p>
          Quem possui o link aleatório pode consultar informações do pedido;
          evite divulgá-lo. O mascaramento do nome faz parte da atualização
          financeira em preparação. Registros financeiros e de
          auditoria são preservados para conciliação. A tabela de retenção e o
          procedimento de exclusão ainda dependem da aprovação do responsável;
          não há promessa de exclusão automática já implantada. Isso permanece
          uma pendência para a liberação financeira.
        </p>
        <h2 className="text-xl font-bold text-white">Direitos</h2>
        <p>
          É possível solicitar acesso, correção, informação sobre
          compartilhamento e exclusão pelo canal da organização. O responsável deve
          verificar a titularidade sem expor os dados e avaliar os registros que
          precisem ser mantidos por obrigação aplicável ou disputa. Nenhum dado
          é utilizado para publicidade neste fluxo.
        </p>
      </article>
      <p className="text-sm text-zinc-400 mt-8">
        Versão de preparação: 05/10/2026. Controlador, base legal e retenção
        final pendentes.
      </p>
    </main>
  );
}
