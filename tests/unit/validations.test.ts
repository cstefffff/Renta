import { afterEach, describe, expect, it } from "vitest";
import {
  LISTING_CATEGORIES,
  getCategoryCode,
  getCategoryLabel,
  isValidCategory,
} from "@/lib/constants/categories";
import {
  getSupabaseEnv,
  isSupabaseConfigured,
} from "@/lib/supabase/config";
import {
  createBookingSchema,
  createReviewSchema,
  parseIsoDateUtcMs,
} from "@/lib/validations/bookings";
import {
  createListingSchema,
  updateListingSchema,
} from "@/lib/validations/listings";
import {
  formatZodIssues,
  signUpSchema,
  updateProfileSchema,
} from "@/lib/validations/profile";

/**
 * ============================================================================
 * RentA (Faza 16 / M16.1) — Suite de Teste Unitare: Validări Zod, Categorii &
 * Configurare Supabase (`tests/unit/validations.test.ts`)
 * ============================================================================
 *
 * Analogie pentru dezvoltatori C / Java:
 * - Echivalentul testelor unitare JUnit 5 (`@Test` + `assertEquals`/`assertFalse`)
 *   care verifică DTO-urile de intrare și utilitarele pure înainte ca aplicația
 *   să atingă baza de date PostgreSQL.
 */

const VALID_UUID = "550e8400-e29b-41d4-a716-446655440000";

describe("Validări Zod — Creare și Editare Anunț (lib/validations/listings.ts)", () => {
  const validListingPayload = {
    title: "Bormașină Bosch Professional GSB 18V",
    description:
      "Stare impecabilă, vine cu 2 acumulatori de 5Ah, încărcător rapid și valiză L-BOXX.",
    category: "scule-unelte",
    city: "București",
    price_per_day: 65,
    price_per_hour: 15,
    deposit_ron: 200,
    min_rental_days: 1,
    cancellation_policy: "moderate" as const,
  };

  it("acceptă un payload complet valid și aplică valorile implicite corecte", () => {
    const result = createListingSchema.safeParse({
      title: validListingPayload.title,
      description: validListingPayload.description,
      category: validListingPayload.category,
      city: validListingPayload.city,
      price_per_day: validListingPayload.price_per_day,
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.deposit_ron).toBe(0);
      expect(result.data.min_rental_days).toBe(1);
      expect(result.data.cancellation_policy).toBe("moderate");
    }
  });

  it("respinge un preț pe zi negativ sau zero", () => {
    const negativePrice = createListingSchema.safeParse({
      ...validListingPayload,
      price_per_day: -50,
    });
    expect(negativePrice.success).toBe(false);

    const zeroPrice = createListingSchema.safeParse({
      ...validListingPayload,
      price_per_day: 0,
    });
    expect(zeroPrice.success).toBe(false);
  });

  it("respinge un titlu prea scurt (< 3 caractere) sau gol după trim", () => {
    const shortTitle = createListingSchema.safeParse({
      ...validListingPayload,
      title: "AB",
    });
    expect(shortTitle.success).toBe(false);

    const whitespaceTitle = createListingSchema.safeParse({
      ...validListingPayload,
      title: "   ",
    });
    expect(whitespaceTitle.success).toBe(false);
  });

  it("respinge o categorie inexistentă în nomenclatorul RentA și o garanție negativă", () => {
    const badCategory = createListingSchema.safeParse({
      ...validListingPayload,
      category: "categorie-inventata",
    });
    expect(badCategory.success).toBe(false);

    const negativeDeposit = createListingSchema.safeParse({
      ...validListingPayload,
      deposit_ron: -10,
    });
    expect(negativeDeposit.success).toBe(false);
  });

  it("acceptă actualizarea unui anunț cu status valid în updateListingSchema", () => {
    const ok = updateListingSchema.safeParse({
      ...validListingPayload,
      status: "unavailable",
    });
    expect(ok.success).toBe(true);

    const badStatus = updateListingSchema.safeParse({
      ...validListingPayload,
      status: "deleted",
    });
    expect(badStatus.success).toBe(false);
  });
});

describe("Validări Zod — Profil & Autentificare (lib/validations/profile.ts)", () => {
  it("acceptă înregistrarea validă pentru persoană fizică și firmă cu telefon și CUI românesc", () => {
    const companySignup = signUpSchema.safeParse({
      email: "contact@sculepro.ro",
      password: "ParolaSigura123",
      display_name: "SculePro Rentals SRL",
      account_type: "company",
      city: "Cluj-Napoca",
      phone: "+40722123456",
      company_cui: "RO12345678",
    });
    expect(companySignup.success).toBe(true);
  });

  it("respinge un număr de telefon invalid sau un CUI malformat", () => {
    const badPhone = updateProfileSchema.safeParse({
      display_name: "Andrei Popescu",
      account_type: "individual",
      city: "Iași",
      phone: "12345",
    });
    expect(badPhone.success).toBe(false);

    const badCui = updateProfileSchema.safeParse({
      display_name: "Atelier SRL",
      account_type: "company",
      city: "Brașov",
      company_cui: "ABC-INVALID",
    });
    expect(badCui.success).toBe(false);
  });

  it("formatează corect erorile Zod prin formatZodIssues", () => {
    const parsed = updateProfileSchema.safeParse({
      display_name: "A",
      account_type: "individual",
      city: "B",
    });

    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      const formatted = formatZodIssues(parsed.error.issues);
      expect(formatted.firstMessage.length).toBeGreaterThan(0);
      expect(formatted.fieldErrors.display_name).toBeDefined();
      expect(formatted.fieldErrors.city).toBeDefined();
    }
  });
});

describe("Validări Zod — Rezervări & Recenzii (lib/validations/bookings.ts)", () => {
  it("respinge o rezervare unde end_date < start_date", () => {
    const res = createBookingSchema.safeParse({
      listing_id: VALID_UUID,
      start_date: "2026-12-15",
      end_date: "2026-12-10",
      notes: "Ridicare la ora 10:00",
    });

    expect(res.success).toBe(false);
    if (!res.success) {
      const hasEndDateError = res.error.issues.some(
        (issue) => issue.path[0] === "end_date"
      );
      expect(hasEndDateError).toBe(true);
    }
  });

  it("acceptă o rezervare validă de 1 zi (end_date === start_date) sau mai multe zile", () => {
    const oneDay = createBookingSchema.safeParse({
      listing_id: VALID_UUID,
      start_date: "2026-12-20",
      end_date: "2026-12-20",
    });
    expect(oneDay.success).toBe(true);

    const multiDay = createBookingSchema.safeParse({
      listing_id: VALID_UUID,
      start_date: "2026-12-20",
      end_date: "2026-12-25",
      notes: "Am nevoie și de valiza de transport.",
    });
    expect(multiDay.success).toBe(true);
  });

  it("respinge un listing_id care nu este UUID valid și date malformate", () => {
    const badUuid = createBookingSchema.safeParse({
      listing_id: "not-a-uuid",
      start_date: "2026-12-20",
      end_date: "2026-12-22",
    });
    expect(badUuid.success).toBe(false);

    expect(parseIsoDateUtcMs("2026-13-40")).toBeNull();
    expect(parseIsoDateUtcMs("20-12-2026")).toBeNull();
    expect(parseIsoDateUtcMs("2026-12-20")).toBe(Date.UTC(2026, 11, 20));
  });

  it("validează corect recenziile (1..5 stele întregi și comentariu minim 2 caractere)", () => {
    const okReview = createReviewSchema.safeParse({
      booking_id: VALID_UUID,
      rating: 5,
      comment: "Echipament curat și predare punctuală!",
    });
    expect(okReview.success).toBe(true);

    const outOfRange = createReviewSchema.safeParse({
      booking_id: VALID_UUID,
      rating: 6,
      comment: "Prea bun",
    });
    expect(outOfRange.success).toBe(false);

    const fractional = createReviewSchema.safeParse({
      booking_id: VALID_UUID,
      rating: 4.5,
      comment: "Bun",
    });
    expect(fractional.success).toBe(false);
  });
});

describe("Nomenclator Categorii (lib/constants/categories.ts)", () => {
  it("recunoaște toate slug-urile oficiale și respinge valorile necunoscute", () => {
    for (const category of LISTING_CATEGORIES) {
      expect(isValidCategory(category.slug)).toBe(true);
    }
    expect(isValidCategory("inexistent")).toBe(false);
    expect(isValidCategory("")).toBe(false);
  });

  it("returnează eticheta și codul tehnic corect, respectiv fallback-ul sigur", () => {
    expect(getCategoryLabel("scule-unelte")).toBe("Scule & Unelte Bricolaj");
    expect(getCategoryLabel("foto-video")).toBe("Foto, Video & Audio");
    expect(getCategoryLabel("unknown-slug")).toBe("unknown-slug");

    expect(getCategoryCode("scule-unelte")).toBe("#CAT-01");
    expect(getCategoryCode("altele")).toBe("#CAT-08");
    expect(getCategoryCode("unknown-slug")).toBe("#CAT-00");
  });
});

describe("Configurare & Normalizare URL Supabase (lib/supabase/config.ts)", () => {
  const originalUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const originalAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const originalSiteUrl = process.env.NEXT_PUBLIC_SITE_URL;

  afterEach(() => {
    if (originalUrl === undefined) {
      delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    } else {
      process.env.NEXT_PUBLIC_SUPABASE_URL = originalUrl;
    }

    if (originalAnonKey === undefined) {
      delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    } else {
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = originalAnonKey;
    }

    if (originalSiteUrl === undefined) {
      delete process.env.NEXT_PUBLIC_SITE_URL;
    } else {
      process.env.NEXT_PUBLIC_SITE_URL = originalSiteUrl;
    }
  });

  it("elimină sufixul /rest/v1 și slash-urile finale din NEXT_PUBLIC_SUPABASE_URL", () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL =
      "https://exemplu.supabase.co/rest/v1/";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY =
      "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.valid_dummy_key";
    process.env.NEXT_PUBLIC_SITE_URL = "https://renta.ro///";

    const env = getSupabaseEnv();
    expect(env.url).toBe("https://exemplu.supabase.co");
    expect(env.siteUrl).toBe("https://renta.ro");
    expect(env.isConfigured).toBe(true);
    expect(isSupabaseConfigured()).toBe(true);
  });

  it("elimină și varianta /rest/v1 fără slash final (case-insensitive)", () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL =
      "https://proiect.supabase.co/REST/V1";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY =
      "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.valid_dummy_key";

    expect(getSupabaseEnv().url).toBe("https://proiect.supabase.co");
  });

  it("marchează isConfigured = false pentru placeholder-uri neconfigurate", () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL =
      "https://PROIECTUL_TAU.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "CHEIA_TA_ANON_KEY_PLACEHOLDER";

    expect(isSupabaseConfigured()).toBe(false);
  });
});
