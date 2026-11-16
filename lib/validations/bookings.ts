import { z } from "zod";

/**
 * ============================================================================
 * RentA (Valul 1 Comercial) — Scheme de Validare Zod pentru Rezervări și Recenzii
 * (`lib/validations/bookings.ts`)
 * ============================================================================
 */

const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Parsează o dată `YYYY-MM-DD` în milisecunde UTC (la miezul nopții).
 */
export function parseIsoDateUtcMs(dateStr: string): number | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr.trim());
  if (!match) {
    return null;
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  if (month < 1 || month > 12 || day < 1 || day > 31) {
    return null;
  }

  const ms = Date.UTC(year, month - 1, day);
  return Number.isFinite(ms) ? ms : null;
}

export const createBookingSchema = z
  .object({
    listing_id: z
      .string()
      .trim()
      .uuid("ID-ul obiectului din cererea de rezervare este invalid."),
    start_date: z
      .string()
      .trim()
      .regex(
        ISO_DATE_REGEX,
        "Data de preluare (început) trebuie să fie în formatul YYYY-MM-DD."
      ),
    end_date: z
      .string()
      .trim()
      .regex(
        ISO_DATE_REGEX,
        "Data de returnare (sfârșit) trebuie să fie în formatul YYYY-MM-DD."
      ),
    notes: z
      .string()
      .trim()
      .max(1000, "Mesajul către proprietar nu poate depăși 1000 de caractere.")
      .optional()
      .nullable(),
  })
  .superRefine((val, ctx) => {
    const startMs = parseIsoDateUtcMs(val.start_date);
    const endMs = parseIsoDateUtcMs(val.end_date);

    if (startMs === null) {
      ctx.addIssue({
        code: "custom",
        path: ["start_date"],
        message: "Data de preluare (început) este invalidă.",
      });
      return;
    }

    if (endMs === null) {
      ctx.addIssue({
        code: "custom",
        path: ["end_date"],
        message: "Data de returnare (sfârșit) este invalidă.",
      });
      return;
    }

    if (endMs < startMs) {
      ctx.addIssue({
        code: "custom",
        path: ["end_date"],
        message:
          "Data de returnare (sfârșit) nu poate fi anterioară datei de preluare (început).",
      });
    }
  });

export const createReviewSchema = z.object({
  booking_id: z
    .string()
    .trim()
    .uuid("ID-ul rezervării asociate este invalid."),
  rating: z
    .number()
    .int("Nota trebuie să fie un număr întreg între 1 și 5 stele.")
    .min(1, "Nota minimă este 1 stea.")
    .max(5, "Nota maximă este 5 stele."),
  comment: z
    .string()
    .trim()
    .min(2, "Comentariul recenziei trebuie să conțină cel puțin 2 caractere.")
    .max(1000, "Comentariul recenziei nu poate depăși 1000 de caractere."),
});
