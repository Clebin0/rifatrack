export default function Loading() {
  return (
    <main className="max-w-6xl mx-auto px-5 py-12" aria-busy="true" aria-label="Carregando página">
      <p className="ui-muted mb-6" role="status">
        Carregando informações…
      </p>
      <div className="ui-skeleton h-10 w-2/3 mb-5" />
      <div className="ui-skeleton h-6 w-1/2 mb-10" />
      <div className="grid md:grid-cols-2 gap-5">
        <div className="ui-skeleton h-64" />
        <div className="ui-skeleton h-64" />
      </div>
    </main>
  );
}
