export const NUMBER_PAGE_SIZE = 50;
export function availableNumbers(total: number, blocked: Set<number>) {
  return Array.from({ length: Math.max(0, total) }, (_, i) => i + 1).filter((n) => !blocked.has(n));
}
export function availableNumberPage(numbers: number[], page: number) {
  const pages = Math.max(1, Math.ceil(numbers.length / NUMBER_PAGE_SIZE));
  const safePage = Math.max(0, Math.min(pages - 1, Math.floor(page)));
  return {
    page: safePage,
    pages,
    numbers: numbers.slice(safePage * NUMBER_PAGE_SIZE, (safePage + 1) * NUMBER_PAGE_SIZE),
  };
}
export function numberPage(total: number, page: number) {
  const pages = Math.max(1, Math.ceil(total / NUMBER_PAGE_SIZE));
  const safePage = Math.max(0, Math.min(pages - 1, Math.floor(page)));
  const start = safePage * NUMBER_PAGE_SIZE + 1;
  return {
    page: safePage,
    pages,
    start,
    end: Math.min(total, start + NUMBER_PAGE_SIZE - 1),
    numbers: Array.from(
      { length: Math.max(0, Math.min(NUMBER_PAGE_SIZE, total - start + 1)) },
      (_, i) => start + i,
    ),
  };
}
export function reconcileSelection(selected: number[], unavailable: Set<number>) {
  return {
    kept: selected.filter((n) => !unavailable.has(n)),
    removed: selected.filter((n) => unavailable.has(n)),
  };
}
export function formatPhone(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 13);
  if (digits.length > 11) return `+${digits.slice(0, 2)} ${digits.slice(2)}`;
  if (digits.length <= 2) return digits;
  const local = digits.slice(2);
  return `(${digits.slice(0, 2)}) ${local.length > 4 ? local.slice(0, local.length > 8 ? 5 : 4) + "-" + local.slice(local.length > 8 ? 5 : 4) : local}`;
}
export const moneyBRL = (cents: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
