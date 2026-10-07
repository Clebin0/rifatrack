"use client";
import { useEffect, useMemo, useState } from "react";
import { availableNumbers } from "@/lib/buyer";
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
  const [search, setSearch] = useState("");
  const [found, setFound] = useState<number | null>(null);
  const numbers = useMemo(
    () => availableNumbers(total, new Set([...unavailable, ...sold, ...reserved])),
    [total, unavailable, sold, reserved],
  );
  const chosen = new Set(selected);
  const target = Number(search);
  const invalid = Boolean(search) && (!/^\d+$/.test(search) || target < 1 || target > total);
  const foundAvailable = found !== null && numbers.includes(found);
  useEffect(() => {
    if (found !== null && foundAvailable) {
      document
        .getElementById(`available-number-${found}`)
        ?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [found, foundAvailable]);
  return (
    <div className="space-y-4">
      <p className="text-sm ui-muted">
        Somente números disponíveis aparecem aqui. Toque para selecionar ou desmarcar.
      </p>
      <form
        className="flex items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (!search || invalid) return;
          setFound(target);
        }}
      >
        <div className="flex-1">
          <Input
            label="Procurar um número"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            inputMode="numeric"
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
          {foundAvailable
            ? "disponível, destacado abaixo."
            : "não está disponível. Escolha outro número."}
        </p>
      )}
      <div className="flex justify-between items-center gap-3 text-sm">
        <span className="ui-muted">{numbers.length.toLocaleString("pt-BR")} disponíveis</span>
        <span className="font-semibold text-emerald-400">✓ {selected.length} selecionados</span>
      </div>
      {!numbers.length ? (
        <p role="status" className="rounded-xl border border-zinc-700 p-5 text-center ui-muted">
          Não há números disponíveis neste momento. Atualize a disponibilidade mais tarde.
        </p>
      ) : (
        <>
          <div
            className="grid grid-cols-5 sm:grid-cols-10 gap-2"
            role="group"
            aria-label="Todos os números disponíveis"
          >
            {numbers.map((n) => (
              <button
                id={`available-number-${n}`}
                key={n}
                type="button"
                disabled={!salesOpen}
                aria-pressed={chosen.has(n)}
                aria-label={`Número ${n}: ${chosen.has(n) ? "selecionado" : "disponível"}${!salesOpen ? ". Reservas fechadas" : ""}`}
                onClick={() => onToggle(n)}
                className={`relative min-h-12 rounded-xl border font-bold text-sm transition-colors ${found === n ? "ring-2 ring-emerald-400 ring-offset-2 ring-offset-zinc-950 " : ""}${chosen.has(n) ? "bg-emerald-300 text-emerald-950 border-emerald-300" : "bg-zinc-900 text-zinc-100 border-zinc-600 enabled:hover:border-emerald-400 enabled:hover:bg-zinc-800"}`}
              >
                {String(n).padStart(3, "0")}
                {chosen.has(n) && (
                  <span aria-hidden="true" className="absolute right-1 top-0 text-xs">
                    ✓
                  </span>
                )}
              </button>
            ))}
          </div>
        </>
      )}
      <p className="text-xs ui-muted">
        A seleção só é garantida após a reserva. A disponibilidade é atualizada a cada 20 segundos.
      </p>
    </div>
  );
}
