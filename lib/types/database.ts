/**
 * ============================================================================
 * RentA (Valul 1 Comercial) — Tipuri și Contracte de Date TypeScript (`lib/types/database.ts`)
 * ============================================================================
 *
 * Analogie pentru dezvoltatori C / Java:
 * - În C, definești structuri de date într-un fișier header (`.h`) folosind `struct`
 *   și `enum`.
 * - În Java (Spring Boot), definești clase POJO / `record` / DTO (Data Transfer Objects)
 *   și `enum`-uri pentru a transporta datele între stratul de Repository, Service
 *   și Controller.
 * - În Faza 10 (Hardening Comercial), am separat strict `Profile` (date publice
 *   sigure pentru afișarea în catalog) de `ProfilePrivate` (date PII: telefon,
 *   CUI, rol de sistem), exact ca separarea câmpurilor `public` vs. `private` în Java.
 */

export type AccountType = "individual" | "company";
export type UserRole = "user" | "moderator" | "admin";
export type ListingStatus = "available" | "unavailable" | "archived";
export type CancellationPolicy = "flexible" | "moderate" | "strict";

export type BookingStatus =
  | "pending"
  | "confirmed"
  | "rejected"
  | "completed"
  | "cancelled";

export type CatalogSortOption =
  | "newest"
  | "price_asc"
  | "price_desc"
  | "rating_desc";

export type CategorySlug =
  | "scule-unelte"
  | "scule-bricolaj"
  | "foto-video"
  | "camping-outdoor"
  | "evenimente-party"
  | "evenimente"
  | "electronice"
  | "gaming-tech"
  | "vestimentar"
  | "sport-timp-liber"
  | "sport-auto"
  | "sport-mobilitate"
  | "altele"
  | (string & {});

export const RENTA_CITIES = [
  "București",
  "Cluj-Napoca",
  "Timișoara",
  "Iași",
  "Brașov",
  "Constanța",
  "Sibiu",
  "Oradea",
] as const;

export interface ActionResponse<T = unknown> {
  /** `true` dacă operația pe server s-a finalizat cu succes */
  success: boolean;
  /** Alias pentru `success` (pentru ergonomie în formularele UI) */
  ok: boolean;
  /** Mesaj informativ (de succes sau de eroare) afișabil direct utilizatorului */
  message?: string;
  /** Mesaj de eroare (populat când `success === false`) */
  error?: string;
  /** Datele returnate de Server Action (echivalentul payload-ului din DTO) */
  data?: T;
  /** Erori de validare per câmp de formular */
  fieldErrors?: Record<string, string[]>;
}

/**
 * Reprezentarea unui rând din tabelul public `public.profiles` (100% sigur GDPR).
 * Câmpurile `phone` și `company_cui` sunt opționale în interfața TypeScript
 * și sunt atașate pe server din `public.profile_private` doar pentru propriul cont.
 */
export interface Profile {
  id: string;
  display_name: string;
  account_type: AccountType;
  city: string;
  bio: string | null;
  avatar_url: string | null;
  phone_verified: boolean;
  kyb_verified: boolean;
  rating_avg: number | null;
  rating_count: number;
  created_at: string;
  updated_at: string;
  // Câmpuri opționale provenite din `public.profile_private` (doar pt. contul propriu):
  phone?: string | null;
  company_cui?: string | null;
}

/**
 * Reprezentarea unui rând din tabelul izolat `public.profile_private`
 * (accesibil prin RLS strict doar proprietarului contului: `auth.uid() = id`).
 */
export interface ProfilePrivate {
  id: string;
  phone: string | null;
  company_cui: string | null;
  phone_verified: boolean;
  role: UserRole;
  updated_at: string;
}

/**
 * Reprezentarea unui rând din tabelul `public.listings` (extins în Faza 10).
 */
export interface Listing {
  id: string;
  catalog_code: string; // ex. "#OBJ-0001"
  owner_id: string;
  title: string;
  description: string;
  category: CategorySlug;
  price_per_day: number; // RON / zi
  price_per_hour: number | null; // RON / oră (opțional)
  deposit_ron: number; // Garanție returnabilă în RON (0 = fără garanție)
  min_rental_days: number; // Durata minimă de închiriere (implicit 1 zi)
  cancellation_policy: CancellationPolicy; // 'flexible' | 'moderate' | 'strict'
  rating_avg: number | null;
  rating_count: number;
  city: string;
  status: ListingStatus;
  created_at: string;
  updated_at: string;
}

/**
 * Reprezentarea unui rând din tabelul `public.listing_images`.
 */
export interface ListingImage {
  id: string;
  listing_id: string;
  storage_path: string;
  url: string;
  display_order: number;
  created_at: string;
}

/**
 * DTO îmbogățit pentru afișarea unui anunț în UI (include JOIN cu proprietarul și galeria foto).
 */
export interface ListingWithDetails extends Listing {
  owner: Pick<
    Profile,
    | "id"
    | "display_name"
    | "account_type"
    | "city"
    | "bio"
    | "avatar_url"
    | "phone_verified"
    | "kyb_verified"
    | "rating_avg"
    | "rating_count"
    | "company_cui"
    | "phone"
  >;
  images: ListingImage[];
  average_rating?: number | null;
  reviews_count?: number;
}

/**
 * Interval ocupat returnat de funcția RPC `get_listing_unavailable_ranges`.
 */
export interface UnavailableDateRange {
  start_date: string; // YYYY-MM-DD
  end_date: string; // YYYY-MM-DD
}

/**
 * Reprezentarea unui rând din tabelul `public.bookings`.
 */
export interface Booking {
  id: string;
  booking_code: string; // ex. "#REZ-0001"
  listing_id: string;
  renter_id: string;
  owner_id: string;
  start_date: string; // YYYY-MM-DD
  end_date: string; // YYYY-MM-DD
  total_days: number;
  total_price_ron: number;
  platform_fee_ron: number;
  status: BookingStatus;
  notes: string | null;
  created_at: string;
}

/**
 * DTO îmbogățit pentru afișarea unei rezervări în panoul utilizatorului.
 * Câmpul `partner_phone` este populat pe server prin RPC-ul `get_booking_partner_phone`
 * EXCLUSIV când rezervarea este în starea `'confirmed'` sau `'completed'`.
 */
export interface BookingWithDetails extends Booking {
  listing: Pick<
    Listing,
    "id" | "catalog_code" | "title" | "price_per_day" | "city" | "category"
  > & {
    primary_image_url?: string | null;
    images?: ListingImage[];
  };
  renter: Pick<
    Profile,
    | "id"
    | "display_name"
    | "account_type"
    | "city"
    | "avatar_url"
    | "phone_verified"
    | "kyb_verified"
    | "rating_avg"
    | "rating_count"
    | "company_cui"
    | "phone"
  >;
  owner: Pick<
    Profile,
    | "id"
    | "display_name"
    | "account_type"
    | "city"
    | "avatar_url"
    | "phone_verified"
    | "kyb_verified"
    | "rating_avg"
    | "rating_count"
    | "company_cui"
    | "phone"
  >;
  partner_phone?: string | null;
}

/**
 * Reprezentarea unui rând din tabelul `public.reviews`.
 */
export interface Review {
  id: string;
  booking_id: string;
  author_id: string;
  target_user_id: string;
  listing_id: string;
  rating: number; // Întreg între 1 și 5
  comment: string | null;
  created_at: string;
  author?: Pick<
    Profile,
    "id" | "display_name" | "account_type" | "city" | "avatar_url"
  >;
}

/**
 * Parametrii de filtrare, sortare și paginare pentru catalogul public (`/catalog`).
 */
export interface CatalogFilters {
  segment?: "all" | "individual" | "company";
  q?: string;
  category?: string;
  city?: string;
  minPrice?: number;
  maxPrice?: number;
  sort?: CatalogSortOption;
  page?: number;
  pageSize?: number;
}

/**
 * Rezultatul paginat returnat de `getPaginatedPublicListingsAction`.
 */
export interface PaginatedCatalogResult {
  items: ListingWithDetails[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
}
