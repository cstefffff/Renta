import { z } from "zod";

/**
 * ============================================================================
 * RentA (Valul 1 Comercial) — Scheme de Validare Zod pentru Autentificare & Profil
 * (`lib/validations/profile.ts`)
 * ============================================================================
 *
 * Analogie pentru dezvoltatori C / Java:
 * - În Spring Boot (Java), decorezi clasele DTO cu adnotări Jakarta Bean Validation
 *   (`@NotBlank`, `@Email`, `@Size(min = 2, max = 100)`, `@Pattern(...)`).
 * - În TypeScript, `zod` oferă validare la runtime + inferență statică de tipuri
 *   (`z.infer<typeof signUpSchema>`). Orice input invalid este respins înainte
 *   de a deschide o conexiune către baza de date PostgreSQL.
 */

const RO_PHONE_REGEX = /^(\+?40|0)\s?7\d{2}[\s.-]?\d{3}[\s.-]?\d{3}$/;
const RO_CUI_REGEX = /^(RO)?\s?\d{2,10}$/i;

export const signUpSchema = z
  .object({
    email: z
      .string()
      .trim()
      .min(3, "Te rugăm să introduci o adresă de email validă.")
      .email("Formatul adresei de email este invalid."),
    password: z
      .string()
      .min(6, "Parola trebuie să conțină minimum 6 caractere.")
      .max(128, "Parola nu poate depăși 128 de caractere."),
    display_name: z
      .string()
      .trim()
      .min(
        2,
        "Numele afișat (sau denumirea firmei) trebuie să aibă între 2 și 100 de caractere."
      )
      .max(100, "Numele afișat nu poate depăși 100 de caractere."),
    account_type: z.enum(["individual", "company"]),
    city: z
      .string()
      .trim()
      .min(2, "Te rugăm să selectezi un oraș valid.")
      .max(60, "Numele orașului este prea lung."),
    company_cui: z.string().trim().optional().nullable(),
    phone: z.string().trim().optional().nullable(),
  })
  .superRefine((val, ctx) => {
    if (val.phone && val.phone.length > 0 && !RO_PHONE_REGEX.test(val.phone)) {
      ctx.addIssue({
        code: "custom",
        path: ["phone"],
        message:
          "Numărul de telefon trebuie să fie în format românesc valid (ex: 0722 123 456 sau +40722123456).",
      });
    }

    if (
      val.company_cui &&
      val.company_cui.length > 0 &&
      !RO_CUI_REGEX.test(val.company_cui)
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["company_cui"],
        message:
          "CUI-ul firmei trebuie să aibă un format fiscal valid (ex: RO12345678 sau 12345678).",
      });
    }
  });

export const updateProfileSchema = z
  .object({
    display_name: z
      .string()
      .trim()
      .min(2, "Numele afișat trebuie să conțină între 2 și 100 de caractere.")
      .max(100, "Numele afișat nu poate depăși 100 de caractere."),
    account_type: z.enum(["individual", "company"]),
    city: z
      .string()
      .trim()
      .min(2, "Te rugăm să selectezi un oraș valid.")
      .max(60, "Numele orașului este prea lung."),
    bio: z
      .string()
      .trim()
      .max(500, "Descrierea scurtă (bio) poate avea maximum 500 de caractere.")
      .optional()
      .nullable(),
    company_cui: z.string().trim().optional().nullable(),
    phone: z.string().trim().optional().nullable(),
  })
  .superRefine((val, ctx) => {
    if (val.phone && val.phone.length > 0 && !RO_PHONE_REGEX.test(val.phone)) {
      ctx.addIssue({
        code: "custom",
        path: ["phone"],
        message:
          "Numărul de telefon trebuie să fie în format românesc valid (ex: 0722 123 456).",
      });
    }

    if (
      val.company_cui &&
      val.company_cui.length > 0 &&
      !RO_CUI_REGEX.test(val.company_cui)
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["company_cui"],
        message:
          "CUI-ul firmei trebuie să aibă un format fiscal valid (ex: RO12345678 sau 12345678).",
      });
    }
  });

/**
 * Helper compatibil Zod v4 pentru extragerea primului mesaj de eroare și a mapării
 * `fieldErrors` din `safeParseResult.error.issues`.
 */
export function formatZodIssues(
  issues: ReadonlyArray<{ path: PropertyKey[]; message: string }>
): { firstMessage: string; fieldErrors: Record<string, string[]> } {
  const fieldErrors: Record<string, string[]> = {};
  for (const issue of issues) {
    const key = issue.path[0] ? String(issue.path[0]) : "_form";
    if (!fieldErrors[key]) {
      fieldErrors[key] = [];
    }
    fieldErrors[key].push(issue.message);
  }
  const firstMessage =
    issues[0]?.message ?? "Datele introduse în formular sunt invalide.";
  return { firstMessage, fieldErrors };
}
