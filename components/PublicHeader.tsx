import { ArrowRight } from "lucide-react";
import ThemeToggle from "./ThemeToggle";

export default function PublicHeader() {
  return (
    <header className="ui-header public-header">
      <div className="max-w-7xl mx-auto px-5 sm:px-7 py-4 flex items-center justify-between gap-4">
        <a href="/" className="brand-mark" aria-label="RifaTrack — página inicial">
          <span className="brand-symbol" aria-hidden="true">R</span>
          <span>Rifa<span className="text-emerald-400">Track</span><small>PARTICIPAÇÃO COM PROPÓSITO</small></span>
        </a>
        <nav aria-label="Navegação principal" className="public-nav">
          <a href="/#campanhas">Campanhas</a>
          <a href="/termos">Como funciona</a>
          <ThemeToggle />
          <a href="/#campanhas" className="public-nav-cta">Participar <ArrowRight size={15} /></a>
        </nav>
      </div>
    </header>
  );
}
