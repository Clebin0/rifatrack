import { describe, it, expect } from "vitest";
import { numberPage, reconcileSelection, formatPhone } from "@/lib/buyer";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import NumberPicker from "@/components/NumberPicker";
import { orderSchema } from "@/lib/validation";
describe("buyer number selection", () => {
  it("renders all available controls for the current campaign and omits unavailable numbers", () => {
    const html = renderToStaticMarkup(
      createElement(NumberPicker, {
        total: 400,
        unavailable: new Set([1, 2]),
        sold: new Set([2]),
        reserved: new Set([1]),
        selected: [3],
        salesOpen: true,
        onToggle: () => {},
      }),
    );
    expect((html.match(/aria-pressed=/g) || []).length).toBe(398);
    expect(html).not.toContain("Número 1:");
    expect(html).not.toContain("Número 2:");
    expect(html).toContain("Número 3: selecionado");
  });
  it("requires the campaign's adult participation acknowledgment on the server schema", () => {
    const input = {
      campaignSlug: "dia-das-criancas",
      buyerName: "Teste",
      buyerPhone: "11999998888",
      numbers: [1],
    };
    expect(orderSchema.safeParse(input).success).toBe(false);
    expect(orderSchema.safeParse({ ...input, adultConfirmed: false }).success).toBe(false);
    expect(orderSchema.safeParse({ ...input, adultConfirmed: true }).success).toBe(true);
  });
  it("bounds the rendering window for 100,000 numbers and clamps invalid ranges", () => {
    expect(numberPage(100000, 0).numbers).toHaveLength(50);
    expect(numberPage(100000, 99999).end).toBe(100000);
    expect(numberPage(100000, -2).start).toBe(1);
    expect(numberPage(103, 2).numbers).toEqual([101, 102, 103]);
  });
  it("reports taken numbers without mutating or dropping valid selections", () => {
    const selected = [5, 1, 3];
    expect(reconcileSelection(selected, new Set([1, 2]))).toEqual({ kept: [5, 3], removed: [1] });
    expect(selected).toEqual([5, 1, 3]);
  });
  it("formats local and international telephone digits without corrupting them", () => {
    expect(formatPhone("11999998888")).toBe("(11) 99999-8888");
    expect(formatPhone("1133334444")).toBe("(11) 3333-4444");
    expect(formatPhone("+55 (11) 99999-8888").replace(/\D/g, "")).toBe("5511999998888");
  });
});
