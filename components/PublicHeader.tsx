import ThemeToggle from "./ThemeToggle";
export default function PublicHeader() {
  return (
    <header className="ui-header">
      <div className="max-w-6xl mx-auto px-5 py-4 flex items-center justify-between gap-4">
        <a href="/" className="text-xl font-extrabold tracking-tight">
          Rifa<span className="text-emerald-400">Track</span>
        </a>
        <nav aria-label="Navegação principal" className="flex items-center gap-4 text-sm">
          <a href="/#campanhas">Campanhas</a>
          <a href="/termos" className="hidden sm:block">
            Como participar
          </a>
          <ThemeToggle />
        </nav>
      </div>
    </header>
  );
}
