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
  // Câmpuri publice KYB (Faza 12 — Verificare Firme ANAF CUI):
  company_name?: string | null;
  company_address?: string | null;
  kyb_verified_at?: string | null;
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
  payment?: PaymentRecord | null;
}

/**
 * Tipuri pentru sistemul de Plăți Stripe Connect & Escrow (Faza 11).
 */
export type PaymentMode = "stripe" | "sandbox";
export type PayoutOnboardingStatus =
  | "not_started"
  | "pending"
  | "active"
  | "restricted";
export type PaymentStatus =
  | "unpaid"
  | "authorized"
  | "paid"
  | "released"
  | "refunded"
  | "disputed";
export type DepositStatus = "none" | "held" | "released" | "captured";

/**
 * Reprezentarea unui rând din tabelul `public.payout_accounts`.
 */
export interface PayoutAccount {
  id: string;
  user_id: string;
  stripe_account_id: string | null;
  mode: PaymentMode;
  onboarding_status: PayoutOnboardingStatus;
  charges_enabled: boolean;
  payouts_enabled: boolean;
  details_submitted: boolean;
  iban_last4: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Reprezentarea unui rând din tabelul `public.payments`.
 */
export interface PaymentRecord {
  id: string;
  booking_id: string;
  renter_id: string;
  owner_id: string;
  mode: PaymentMode;
  currency: string;
  rental_amount_ron: number;
  platform_fee_ron: number;
  owner_payout_ron: number;
  deposit_amount_ron: number;
  total_charged_ron: number;
  stripe_checkout_session_id: string | null;
  stripe_payment_intent_id: string | null;
  stripe_deposit_intent_id: string | null;
  payment_status: PaymentStatus;
  deposit_status: DepositStatus;
  paid_at: string | null;
  released_at: string | null;
  created_at: string;
  updated_at: string;
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
  /** Când e `true` (paginile 2+ la Infinite Scroll), sare peste `COUNT(*)` și `description` pentru viteză maximă. */
  skipCount?: boolean;
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

/**
 * Tipuri pentru Încredere, Verificare & Siguranță Comercială (Faza 12):
 * M12.2 ANAF CUI / KYB, M12.3 Protocol Foto Check-in/out, M12.4 Dispute.
 */
export type HandoverPhase = "checkin" | "checkout";
export type DisputeReason =
  | "damage"
  | "missing_accessories"
  | "late_return"
  | "not_as_described"
  | "other";
export type DisputeStatus =
  | "open"
  | "under_review"
  | "resolved_renter"
  | "resolved_owner"
  | "closed";

export interface HandoverProof {
  id: string;
  booking_id: string;
  uploaded_by: string;
  phase: HandoverPhase;
  storage_path: string;
  signed_url?: string | null;
  notes: string | null;
  created_at: string;
}

export interface DisputeRecord {
  id: string;
  booking_id: string;
  opened_by: string;
  reason: DisputeReason;
  description: string;
  claimed_amount_ron: number;
  status: DisputeStatus;
  created_at: string;
  updated_at: string;
}

export interface AnafCompanyResult {
  cui: string;
  denumire: string;
  adresa: string;
  stare: string;
  source: "anaf_live" | "checksum_fallback";
}

/**
 * Tipuri pentru Sistemul de Notificări In-App & Emailuri Tranzacționale (Faza 13 / M13.2).
 */
export type NotificationType =
  | "booking_created"
  | "booking_confirmed"
  | "booking_rejected"
  | "booking_completed"
  | "booking_cancelled"
  | "payment_paid"
  | "payment_released"
  | "dispute_opened"
  | "review_received"
  | "system";

export interface NotificationRecord {
  id: string;
  user_id: string;
  type: NotificationType;
  title: string;
  body: string;
  action_url: string | null;
  booking_id: string | null;
  is_read: boolean;
  email_sent: boolean;
  created_at: string;
}

/**
 * Tipuri pentru Conformitate Legală, GDPR & Facturare SRL / RO e-Factura (Faza 14).
 */
export type InvoiceProvider = "internal" | "oblio" | "smartbill";
export type EFacturaStatus =
  | "not_applicable"
  | "pending_anaf"
  | "submitted"
  | "accepted"
  | "rejected";

export interface InvoiceRecord {
  id: string;
  invoice_number: string;
  booking_id: string;
  payment_id: string | null;
  owner_id: string;
  renter_id: string;
  issuer_name: string;
  issuer_cui: string;
  client_name: string;
  client_cui: string | null;
  client_address: string | null;
  subtotal_ron: number;
  vat_rate: number;
  vat_amount_ron: number;
  total_ron: number;
  currency: string;
  provider: InvoiceProvider;
  external_invoice_id: string | null;
  efactura_status: EFacturaStatus;
  issued_at: string;
  created_at: string;
}

export interface GdprExportPayload {
  exported_at: string;
  user_id: string;
  email: string | null;
  profile: Record<string, unknown> | null;
  profile_private: Record<string, unknown> | null;
  listings: Record<string, unknown>[];
  bookings_as_renter: Record<string, unknown>[];
  bookings_as_owner: Record<string, unknown>[];
  payments: Record<string, unknown>[];
  invoices: Record<string, unknown>[];
  notifications: Record<string, unknown>[];
}

/**
 * Tipuri pentru Panoul de Administrare `/admin` & Audit Log (Faza 15 / M15.1).
 */
export type ListingReportStatus = "open" | "dismissed" | "action_taken";

export interface AdminAuditLog {
  id: string;
  admin_id: string;
  action: string;
  target_type: string;
  target_id: string;
  details: Record<string, unknown>;
  created_at: string;
}

export interface ListingReportRecord {
  id: string;
  listing_id: string;
  reporter_id: string;
  reason: string;
  details: string | null;
  status: ListingReportStatus;
  created_at: string;
  listing_title?: string;
  listing_catalog_code?: string;
  listing_status?: ListingStatus;
}

export interface AdminUserRow extends Profile {
  role: UserRole;
  listings_count: number;
}

export interface AdminListingRow {
  id: string;
  catalog_code: string;
  title: string;
  category: string;
  city: string;
  price_per_day: number;
  deposit_ron: number;
  status: ListingStatus;
  rating_avg: number | null;
  rating_count: number;
  owner_id: string;
  owner_name: string;
  owner_type: AccountType;
  created_at: string;
}

export interface AdminBookingRow {
  id: string;
  booking_code: string;
  listing_id: string;
  listing_title: string;
  listing_code: string;
  renter_name: string;
  owner_name: string;
  start_date: string;
  end_date: string;
  total_days: number;
  total_price_ron: number;
  platform_fee_ron: number;
  status: BookingStatus;
  payment_status: PaymentStatus | null;
  deposit_status: DepositStatus | null;
  created_at: string;
}

export interface AdminBreakdownItem {
  label: string;
  count: number;
  percentage: number;
}

export interface AdminDashboardData {
  authorized: boolean;
  currentUserId: string | null;
  migrationMissing?: boolean;
  kpis: {
    totalUsers: number;
    personalUsers: number;
    businessUsers: number;
    verifiedPhones: number;
    verifiedBusinesses: number;
    totalListings: number;
    activeListings: number;
    pausedListings: number;
    archivedListings: number;
    totalBookings: number;
    completedBookings: number;
    activeBookings: number;
    conversionRatePercent: number;
    openDisputes: number;
    openReports: number;
    totalCommissionRon: number;
    totalGmvRon: number;
    escrowHeldRon: number;
    averageBookingValueRon: number;
    totalInvoices: number;
    avgPlatformRating: number | null;
  };
  users: AdminUserRow[];
  allListings: AdminListingRow[];
  allBookings: AdminBookingRow[];
  invoices: InvoiceRecord[];
  categoryBreakdown: AdminBreakdownItem[];
  cityBreakdown: AdminBreakdownItem[];
  bookingStatusBreakdown: AdminBreakdownItem[];
  disputes: (DisputeRecord & { booking_code?: string })[];
  companies: Profile[];
  reports: ListingReportRecord[];
  auditLogs: AdminAuditLog[];
}
