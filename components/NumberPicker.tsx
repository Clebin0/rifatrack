"use client";
import { useState } from "react";
import { numberPage, NUMBER_PAGE_SIZE } from "@/lib/buyer";
import Button from "./ui/Button";
import Input from "./ui/Input";
type Props = {
  total: number;
  unavailable: Set<number>;
  sold: Set<number>;
  reserved: Set<number>;
  selected: number[];
  salesOpen: boolean;
  onToggle: (n: number) => void;
};
export default function NumberPicker({
  total,
  unavailable,
  sold,
  reserved,
  selected,
  salesOpen,
  onToggle,
}: Props) {
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState("");
  const [found, setFound] = useState<number | null>(null);
  const window = numberPage(total, page);
  const chosen = new Set(selected);
  const searchNumber = Number(search);
  const invalid =
    Boolean(search) && (!/^\d+$/.test(search) || searchNumber < 1 || searchNumber > total);
  function go(next: number) {
    setFound(null);
    setPage(numberPage(total, next).page);
  }
  return (
    <div className="space-y-5">
      <ul
        aria-label="Legenda dos números"
        className="flex flex-wrap gap-x-4 gap-y-2 text-xs ui-muted"
      >
        <li>○ Disponível</li>
        <li className="text-emerald-400">✓ Selecionado</li>
        <li className="number-reserved-label">◷ Reservado</li>
        <li className="number-sold-label">● Vendido</li>
        <li>× Indisponível</li>
      </ul>
      <form
        className="flex items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (search && !invalid) {
            go(Math.floor((searchNumber - 1) / NUMBER_PAGE_SIZE));
            setFound(searchNumber);
          }
        }}
      >
        <div className="flex-1">
          <Input
            label="Encontrar um número"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            inputMode="numeric"
            type="text"
            maxLength={6}
            placeholder={`De 1 a ${total}`}
            error={invalid ? `Informe um número de 1 a ${total}.` : undefined}
          />
        </div>
        <Button type="submit" variant="secondary" disabled={!search || invalid}>
          Buscar
        </Button>
      </form>
      {found !== null && (
        <p role="status" className="text-sm ui-muted">
          Número {String(found).padStart(3, "0")}:{" "}
          {sold.has(found)
            ? "já comprado"
            : reserved.has(found)
              ? "reservado"
              : unavailable.has(found)
                ? "indisponível"
                : "livre"}
          . Está destacado na página encontrada.
        </p>
      )}
      <details className="rounded-xl border border-zinc-700 p-3">
        <summary className="cursor-pointer min-h-11 flex items-center text-sm font-semibold">
          Ir para outra faixa de números
          <span aria-hidden="true" className="ml-auto">
            ▾
          </span>
        </summary>
        <div className="flex flex-wrap gap-2 mt-3">
          <Button variant="secondary" onClick={() => go(0)}>
            Primeiros
          </Button>
          <Button variant="secondary" onClick={() => go(window.pages - 1)}>
            Últimos
          </Button>
          <label className="sr-only" htmlFor="number-range">
            Faixa de números
          </label>
          <select
            id="number-range"
            className="ui-input !w-auto flex-1 min-w-32"
            value={window.page}
            onChange={(e) => go(Number(e.target.value))}
          >
            {Array.from({ length: window.pages }, (_, i) => (
              <option key={i} value={i}>
                {i * NUMBER_PAGE_SIZE + 1}–{Math.min(total, (i + 1) * NUMBER_PAGE_SIZE)}
              </option>
            ))}
          </select>
        </div>
      </details>
      <p role="status" className="text-sm ui-muted">
        Mostrando {window.start}–{window.end} de {total.toLocaleString("pt-BR")} números.{" "}
        {selected.length} selecionados.
      </p>
      <div
        className="grid grid-cols-5 sm:grid-cols-10 gap-2"
        role="group"
        aria-label={`Números de ${window.start} a ${window.end}`}
      >
        {window.numbers.map((n) => {
          const state = sold.has(n)
            ? "Vendido"
            : reserved.has(n)
              ? "Reservado"
              : unavailable.has(n)
                ? "Indisponível"
                : chosen.has(n)
                  ? "Selecionado"
                  : "Disponível";
          const blocked = unavailable.has(n) || !salesOpen;
          const symbol =
            state === "Vendido"
              ? "●"
              : state === "Reservado"
                ? "◷"
                : state === "Indisponível"
                  ? "×"
                  : state === "Selecionado"
                    ? "✓"
                    : "○";
          return (
            <button
              type="button"
              key={n}
              disabled={blocked}
              aria-pressed={chosen.has(n)}
              aria-label={`Número ${n}: ${state}${!salesOpen ? ". Reservas fechadas" : ""}`}
              title={state}
              onClick={() => onToggle(n)}
              className={`min-h-14 rounded-xl border p-1 font-semibold text-xs ${found === n ? "ring-2 ring-emerald-500 ring-offset-2 " : ""}${state === "Selecionado" ? "bg-emerald-300 text-emerald-950 border-emerald-300" : state === "Reservado" ? "bg-amber-950 text-amber-200 border-amber-700" : state === "Vendido" ? "bg-indigo-950 text-indigo-200 border-indigo-700" : "bg-zinc-950 text-zinc-300 border-zinc-700"}`}
            >
              <span className="block">{String(n).padStart(3, "0")}</span>
              <span aria-hidden="true" className="block text-xs mt-1">
                {symbol}
              </span>
            </button>
          );
        })}
      </div>
      <nav aria-label="Páginas dos números" className="flex items-center justify-between gap-3">
        <Button
          variant="secondary"
          disabled={window.page === 0}
          onClick={() => go(window.page - 1)}
        >
          Anterior
        </Button>
        <span className="text-xs ui-muted">
          {window.page + 1} / {window.pages}
        </span>
        <Button
          variant="secondary"
          disabled={window.page >= window.pages - 1}
          onClick={() => go(window.page + 1)}
        >
          Próxima
        </Button>
      </nav>
      <p className="text-xs ui-muted">
        A seleção só é garantida após a reserva. A disponibilidade é atualizada a cada 20 segundos.
      </p>
    </div>
  );
}
