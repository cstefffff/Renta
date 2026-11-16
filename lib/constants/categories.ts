import type { CategorySlug } from "@/lib/types/database";

/**
 * ============================================================================
 * RentA (MVP) — Nomenclatorul Oficial de Categorii (`lib/constants/categories.ts`)
 * ============================================================================
 *
 * Analogie pentru dezvoltatori C / Java:
 * - În Java, ai folosi un `enum Category { SCULE_UNELTE("scule-unelte", "Scule & Unelte"), ... }`
 *   cu câmpuri asociate și metode getter.
 * - În Next.js, fișierele marcate cu `"use server"` pot exporta EXCLUSIV funcții
 *   `async` (deoarece compilatorul le transformă în endpoint-uri RPC). De aceea,
 *   constantele partajate între Server Actions și Componentele UI (Client/Server)
 *   se păstrează într-un modul separat din `lib/constants/`.
 */

export interface CategoryOption {
  slug: CategorySlug;
  code: string;
  label: string;
  description: string;
}

/**
 * Lista completă de categorii disponibile în catalogul RentA.
 */
export const LISTING_CATEGORIES: readonly CategoryOption[] = [
  {
    slug: "scule-unelte",
    code: "#CAT-01",
    label: "Scule & Unelte Bricolaj",
    description: "Bormașini, rotopercutoare, polizoare, scări, compresoare, aparate de sudură",
  },
  {
    slug: "foto-video",
    code: "#CAT-02",
    label: "Foto, Video & Audio",
    description: "Aparate mirrorless/DSLR, obiective, lumini studio, microfoane, drone",
  },
  {
    slug: "camping-outdoor",
    code: "#CAT-03",
    label: "Camping & Outdoor",
    description: "Corturi, saci de dormit, lăzi frigorifice, suporturi auto/bicicletă",
  },
  {
    slug: "evenimente-party",
    code: "#CAT-04",
    label: "Evenimente & Party",
    description: "Boxe active, proiectoare, mașini de fum, pavilioane, mese pliante",
  },
  {
    slug: "electronice",
    code: "#CAT-05",
    label: "Electronice & Gaming",
    description: "Console PS5/Xbox, ochelari VR, proiectoare 4K, stații de energie portabile",
  },
  {
    slug: "vestimentar",
    code: "#CAT-06",
    label: "Vestimentar & Ocazii",
    description: "Costume de gală, smochinguri, rochii de eveniment, echipamente tematice",
  },
  {
    slug: "sport-timp-liber",
    code: "#CAT-07",
    label: "Sport & Timp Liber",
    description: "Biciclete, plăci SUP/caiac, echipament schi/snowboard, role",
  },
  {
    slug: "altele",
    code: "#CAT-08",
    label: "Alte Echipamente",
    description: "Aparate de curățat cu abur/presiune, dezumidificatoare, instrumente muzicale",
  },
] as const;

/**
 * Array simplu cu slug-urile valide, folosit pentru validare rapidă `O(1)` / `.includes()`
 * în Server Actions.
 */
export const VALID_CATEGORY_SLUGS: readonly string[] = LISTING_CATEGORIES.map(
  (cat) => cat.slug
);

/**
 * Verifică dacă un string primit din `FormData` este o categorie validă.
 */
export function isValidCategory(slug: string): slug is CategorySlug {
  return VALID_CATEGORY_SLUGS.includes(slug);
}

/**
 * Returnează eticheta lizibilă în română pentru un slug de categorie.
 */
export function getCategoryLabel(slug: string): string {
  const found = LISTING_CATEGORIES.find((c) => c.slug === slug);
  return found ? found.label : slug;
}

/**
 * Returnează codul tehnic de catalog (ex: `#CAT-01`) pentru un slug de categorie.
 */
export function getCategoryCode(slug: string): string {
  const found = LISTING_CATEGORIES.find((c) => c.slug === slug);
  return found ? found.code : "#CAT-00";
}
