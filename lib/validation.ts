import { z } from "zod";

export const orderSchema = z.object({
  campaignSlug: z.string().min(2).max(80).regex(/^[a-z0-9-]+$/),
  sellerCode: z.string().max(64).regex(/^[A-Za-z0-9_-]*$/).optional().default(""),
  buyerName: z.string().trim().min(2).max(100),
  buyerPhone: z.string().trim().regex(/^\+?[0-9 ()-]{8,20}$/),
  buyerEmail: z.string().trim().email().max(180).or(z.literal("")).optional().default(""),
  numbers: z.array(z.number().int().positive()).min(1).max(50),
  website: z.string().max(0).optional().default(""),
});
