import { describe, expect, it } from "vitest";
import { sanitizePublicCampaign } from "../lib/public-campaign";

describe("Public campaign projection", () => {
  it("removes operator identity and top-level seller contact", () => {
    const result = sanitizePublicCampaign({
      slug: "campaign-test",
      finalized_by: "private-operator@example.invalid",
      seller_whatsapp: "5511999999999",
    });

    expect(result).toEqual({ slug: "campaign-test" });
  });

  it("removes contact details from each seller while preserving public fields", () => {
    const result = sanitizePublicCampaign({
      slug: "campaign-test",
      sellers: [
        {
          name: "Seller One",
          code: "SELLER01",
          team: "Blue",
          whatsapp: "5511999999999",
        },
      ],
    });

    expect(result.sellers).toEqual([{ name: "Seller One", code: "SELLER01", team: "Blue" }]);
  });

  it("preserves the sellers field when it is an empty array", () => {
    expect(sanitizePublicCampaign({ slug: "campaign-test", sellers: [] })).toEqual({
      slug: "campaign-test",
      sellers: [],
    });
  });
});
