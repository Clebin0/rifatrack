import { z } from "zod";
export function normalizePhone(value: string) {
  const digits = value.replace(/\D/g, "");
  return digits.startsWith("55") && digits.length >= 12 ? "+" + digits : "+55" + digits;
}
export const orderSchema = z
  .object({
    campaignSlug: z
      .string()
      .min(2)
      .max(80)
      .regex(/^[a-z0-9-]+$/),
    sellerCode: z
      .string()
      .max(64)
      .regex(/^[A-Za-z0-9_-]*$/)
      .optional()
      .default(""),
    buyerName: z.string().trim().min(2).max(100),
    buyerPhone: z
      .string()
      .trim()
      .regex(/^\+?[0-9 ()-]+$/)
      .transform(normalizePhone)
      .refine(
        (v) => /^\+55[1-9][0-9](?:[2-5][0-9]{7}|9[0-9]{8})$/.test(v),
        "Telefone brasileiro inválido",
      ),
    buyerEmail: z.string().trim().email().max(180).or(z.literal("")).optional().default(""),
    numbers: z
      .array(z.number().int().positive())
      .min(1)
      .max(50)
      .refine((v) => new Set(v).size === v.length, "Números duplicados"),
    adultConfirmed: z.boolean().optional(),
    website: z.string().max(0).optional().default(""),
  })
  .superRefine((value, context) => {
    if (value.campaignSlug === "dia-das-criancas" && value.adultConfirmed !== true)
      context.addIssue({
        code: "custom",
        path: ["adultConfirmed"],
        message: "Confirme que tem 18 anos ou mais para participar.",
      });
  });
