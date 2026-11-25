import { describe, expect, it } from "vitest";
import { getVisibleCampaigns } from "../lib/campaign-content";
import { sanitizePublicCampaign } from "../lib/public-campaign";

describe("Public campaign projection", () => {
  it("removes operator identity, seller contact, and payment destination", () => {
    const result = sanitizePublicCampaign({
      slug: "campaign-test",
      finalized_by: "private-operator@example.invalid",
      seller_whatsapp: "5511999999999",
      pix_key: "private-pix-key",
      pix_receiver: "Private Receiver",
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

  it("keeps the ended children's action out of open campaign listings", () => {
    expect(
      getVisibleCampaigns([
        { slug: "dia-das-criancas", name: "Ação encerrada" },
        { slug: "campanha-de-natal", name: "Natal" },
      ]),
    ).toEqual([{ slug: "campanha-de-natal", name: "Natal" }]);
  });

  it("reports the ended children's campaign as closed in its public detail", () => {
    expect(sanitizePublicCampaign({ slug: "dia-das-criancas", status: "active" }).status).toBe(
      "closed",
    );
  });
});
