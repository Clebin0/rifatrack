export default function NotFound() {
  return (
    <main className="max-w-xl mx-auto px-5 py-20">
      <p className="text-emerald-400 font-semibold">Página não encontrada</p>
      <h1 className="text-4xl font-bold mt-3">Vamos voltar às campanhas?</h1>
      <p className="ui-muted my-6">
        O endereço pode estar incompleto. Confira o link enviado pela
        organização.
      </p>
      <a href="/" className="ui-button ui-button-primary">
        Ver campanhas
      </a>
    </main>
  );
}
