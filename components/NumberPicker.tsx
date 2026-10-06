"use client";
import { useMemo, useState } from "react";
import { availableNumbers, availableNumberPage, NUMBER_PAGE_SIZE } from "@/lib/buyer";
import Button from "./ui/Button";
import Input from "./ui/Input";
type Props = { total: number; unavailable: Set<number>; sold: Set<number>; reserved: Set<number>; selected: number[]; salesOpen: boolean; onToggle: (n: number) => void };
export default function NumberPicker({ total, unavailable, sold, reserved, selected, salesOpen, onToggle }: Props) {
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState("");
  const [found, setFound] = useState<number | null>(null);
  const numbers = useMemo(() => availableNumbers(total, new Set([...unavailable, ...sold, ...reserved])), [total, unavailable, sold, reserved]);
  const window = availableNumberPage(numbers, page);
  const chosen = new Set(selected);
  const target = Number(search);
  const invalid = Boolean(search) && (!/^\d+$/.test(search) || target < 1 || target > total);
  const foundAvailable = found !== null && numbers.includes(found);
  function go(next: number) { setFound(null); setPage(availableNumberPage(numbers, next).page); }
  return <div className="space-y-4">
    <p className="text-sm ui-muted">Somente números disponíveis aparecem aqui. Toque para selecionar ou desmarcar.</p>
    <form className="flex items-end gap-2" onSubmit={e => {
      e.preventDefault();
      if (!search || invalid) return;
      const index = numbers.indexOf(target);
      if (index >= 0) setPage(Math.floor(index / NUMBER_PAGE_SIZE));
      setFound(target);
    }}>
      <div className="flex-1"><Input label="Procurar um número" value={search} onChange={e => setSearch(e.target.value)} inputMode="numeric" maxLength={6} placeholder={`De 1 a ${total}`} error={invalid ? `Informe um número de 1 a ${total}.` : undefined} /></div>
      <Button type="submit" variant="secondary" disabled={!search || invalid}>Buscar</Button>
    </form>
    {found !== null && <p role="status" className="text-sm ui-muted">Número {String(found).padStart(3, "0")}: {foundAvailable ? "disponível, destacado abaixo." : "não está disponível. Escolha outro número."}</p>}
    <div className="flex justify-between items-center gap-3 text-sm"><span className="ui-muted">{numbers.length.toLocaleString("pt-BR")} disponíveis</span><span className="font-semibold text-emerald-400">✓ {selected.length} selecionados</span></div>
    {!numbers.length ? <p role="status" className="rounded-xl border border-zinc-700 p-5 text-center ui-muted">Não há números disponíveis neste momento. Atualize a disponibilidade mais tarde.</p> : <>
      <div className="grid grid-cols-5 sm:grid-cols-10 gap-2" role="group" aria-label="Números disponíveis">
        {window.numbers.map(n => <button key={n} type="button" disabled={!salesOpen} aria-pressed={chosen.has(n)} aria-label={`Número ${n}: ${chosen.has(n) ? "selecionado" : "disponível"}${!salesOpen ? ". Reservas fechadas" : ""}`} onClick={() => onToggle(n)} className={`relative min-h-12 rounded-xl border font-bold text-sm transition-colors ${found === n ? "ring-2 ring-emerald-400 ring-offset-2 ring-offset-zinc-950 " : ""}${chosen.has(n) ? "bg-emerald-300 text-emerald-950 border-emerald-300" : "bg-zinc-900 text-zinc-100 border-zinc-600 enabled:hover:border-emerald-400 enabled:hover:bg-zinc-800"}`}>
          {String(n).padStart(3, "0")}{chosen.has(n) && <span aria-hidden="true" className="absolute right-1 top-0 text-xs">✓</span>}
        </button>)}
      </div>
      {window.pages > 1 && <nav aria-label="Páginas dos números disponíveis" className="flex items-center justify-between gap-2">
        <Button variant="secondary" disabled={window.page === 0} onClick={() => go(window.page - 1)}>Anterior</Button>
        <label className="text-xs ui-muted">Página <select aria-label="Ir para página de números disponíveis" className="ui-input !w-auto !inline-block !p-2" value={window.page} onChange={e => go(Number(e.target.value))}>{Array.from({ length: window.pages }, (_, i) => <option key={i} value={i}>{i + 1} de {window.pages}</option>)}</select></label>
        <Button variant="secondary" disabled={window.page + 1 >= window.pages} onClick={() => go(window.page + 1)}>Próxima</Button>
      </nav>}
    </>}
    <p className="text-xs ui-muted">A seleção só é garantida após a reserva. A disponibilidade é atualizada a cada 20 segundos.</p>
  </div>;
}
