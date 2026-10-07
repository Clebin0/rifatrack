import { it, expect } from "vitest";
import { paymentTimestamp } from "@/lib/webhook-validation";
it("does not infer midnight or a timezone from provider day-only values", () => {
  const received = new Date("2026-10-05T20:00:00Z");
  expect(paymentTimestamp(["2026-10-05", "2026-10-05 14:30:00"], received)).toBe(
    received.toISOString(),
  );
});
it("uses an explicit provider timestamp when one exists", () => {
  expect(paymentTimestamp(["2026-10-05", "2026-10-05T14:30:00-03:00"])).toBe(
    "2026-10-05T17:30:00.000Z",
  );
});
