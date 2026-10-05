type Props = {
  total: number;
  unavailable: Set<number>;
  selected: number[];
  salesOpen: boolean;
  onToggle: (number: number) => void;
};
export default function CampaignNumberGrid({
  total,
  unavailable,
  selected,
  salesOpen,
  onToggle,
}: Props) {
  const chosen = new Set(selected);
  return (
    <div className="grid grid-cols-5 sm:grid-cols-8 md:grid-cols-10 gap-2 max-h-[580px] overflow-y-auto pr-1">
      {Array.from({ length: total }, (_, i) => i + 1).map((n) => {
        const disabled = unavailable.has(n) || !salesOpen;
        return (
          <button
            key={n}
            type="button"
            disabled={disabled}
            aria-pressed={chosen.has(n)}
            aria-label={`Número ${n}${disabled ? ", indisponível" : ""}`}
            onClick={() => onToggle(n)}
            className={
              "aspect-square rounded-xl border text-xs font-bold transition " +
              (disabled
                ? "bg-zinc-950 text-zinc-500 border-zinc-800 cursor-not-allowed"
                : chosen.has(n)
                  ? "bg-emerald-400 text-emerald-950 border-emerald-300 scale-95"
                  : "bg-zinc-950 border-zinc-700 hover:border-zinc-500")
            }
          >
            {String(n).padStart(3, "0")}
          </button>
        );
      })}
    </div>
  );
}
