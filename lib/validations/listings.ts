import { z } from "zod";
import { isValidCategory } from "@/lib/constants/categories";

/**
 * ============================================================================
 * RentA (Valul 1 Comercial) — Scheme de Validare Zod pentru Listări de Obiecte
 * (`lib/validations/listings.ts`)
 * ============================================================================
 *
 * Analogie pentru dezvoltatori C / Java:
 * - Echivalentul unui DTO de intrare `CreateListingRequest` / `UpdateListingRequest`
 *   validat cu `@Valid` în Spring Boot înainte de apelul către `ListingService`.
 */

export const createListingSchema = z.object({
  title: z
    .string()
    .trim()
    .min(3, "Titlul obiectului trebuie să conțină între 3 și 120 de caractere.")
    .max(120, "Titlul obiectului nu poate depăși 120 de caractere."),
  description: z
    .string()
    .trim()
    .min(
      10,
      "Descrierea tehnică trebuie să conțină cel puțin 10 caractere (stare, accesorii incluse, condiții)."
    )
    .max(4000, "Descrierea tehnică nu poate depăși 4000 de caractere."),
  category: z
    .string()
    .trim()
    .refine(
      (val) => isValidCategory(val),
      "Te rugăm să selectezi o categorie validă din nomenclatorul RentA."
    ),
  city: z
    .string()
    .trim()
    .min(2, "Te rugăm să selectezi un oraș valid.")
    .max(60, "Numele orașului este prea lung."),
  price_per_day: z
    .number()
    .refine((n) => Number.isFinite(n) && n > 0, {
      message: "Prețul pe zi (RON/zi) trebuie să fie un număr strict pozitiv (> 0).",
    })
    .refine((n) => n <= 50000, {
      message: "Prețul pe zi nu poate depăși 50.000 RON.",
    }),
  price_per_hour: z
    .number()
    .refine((n) => Number.isFinite(n) && n > 0, {
      message: "Prețul pe oră trebuie să fie un număr strict pozitiv (> 0).",
    })
    .refine((n) => n <= 10000, {
      message: "Prețul pe oră nu poate depăși 10.000 RON.",
    })
    .nullable()
    .optional(),
  deposit_ron: z
    .number()
    .refine((n) => Number.isFinite(n) && n >= 0, {
      message: "Garanția returnabilă (RON) trebuie să fie 0 sau un număr pozitiv.",
    })
    .refine((n) => n <= 100000, {
      message: "Garanția returnabilă nu poate depăși 100.000 RON.",
    })
    .default(0),
  min_rental_days: z
    .number()
    .int("Durata minimă de închiriere trebuie să fie un număr întreg de zile.")
    .min(1, "Durata minimă de închiriere este de cel puțin 1 zi.")
    .max(365, "Durata minimă nu poate depăși 365 de zile.")
    .default(1),
  cancellation_policy: z
    .enum(["flexible", "moderate", "strict"])
    .default("moderate"),
});

export const updateListingSchema = createListingSchema.extend({
  status: z.enum(["available", "unavailable", "archived"]).optional(),
});
