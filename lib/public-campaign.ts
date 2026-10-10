export function sanitizePublicCampaign(campaign: Record<string, unknown>): Record<string, unknown> {
  const {
    seller_whatsapp: _sellerWhatsapp,
    finalized_by: _finalizedBy,
    sellers,
    ...publicCampaign
  } = campaign;

  const publicSellers = Array.isArray(sellers)
    ? sellers.map((value) => {
        if (!value || typeof value !== "object" || Array.isArray(value)) return value;
        const { whatsapp: _whatsapp, ...seller } = value as Record<string, unknown>;
        return seller;
      })
    : undefined;

  return {
    ...publicCampaign,
    ...(publicSellers === undefined ? {} : { sellers: publicSellers }),
  };
}
