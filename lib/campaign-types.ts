export type BuyerCampaign = {
  id: string;
  name: string;
  slug: string;
  description: string;
  price_cents: number;
  total_numbers: number;
  ends_at: string | null;
  status: "active" | "closed";
  deadline_reached: boolean;
  finalized_at: string | null;
  seller_name: string | null;
  seller_whatsapp: string | null;
  sellers: {
    name: string;
    code: string;
    team: string | null;
    whatsapp: string;
  }[];
  unavailable: number[];
  sold?: number[];
  reserved?: number[];
  sold_numbers: number;
  reserved_numbers: number;
  draw_result: { number: number; drawn_at: string } | null;
};
