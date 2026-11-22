"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type {
  AccountType,
  ActionResponse,
  AdminAuditLog,
  AdminBookingRow,
  AdminBreakdownItem,
  AdminDashboardData,
  AdminListingRow,
  AdminUserInspectionData,
  AdminUserRow,
  BookingStatus,
  CancellationPolicy,
  CategorySlug,
  DepositStatus,
  DisputeReason,
  DisputeRecord,
  DisputeStatus,
  EFacturaStatus,
  InvoiceProvider,
  InvoiceRecord,
  ListingImage,
  ListingReportRecord,
  ListingReportStatus,
  ListingStatus,
  ListingWithDetails,
  PaymentStatus,
  Profile,
  UserRole,
} from "@/lib/types/database";

/**
 * ============================================================================
 * RentA (Faza 15 / Super-Admin Command Center) — Server Actions pentru Panoul
 * de Administrare (`/admin`) & Audit Log (`app/actions/admin.ts`)
 * ============================================================================
 *
 * Explicație pentru dezvoltatori C / Java:
 * - Acest fișier joacă rolul unui `AdminService` protejat prin `@PreAuthorize("hasRole('ADMIN')")`
 *   din Spring Boot: fiecare metodă sensibilă verifică direct pe server rolul
 *   utilizatorului în tabelul izolat `public.profile_private` (nu ne bazăm
 *   niciodată pe date venite din client/browser).
 * - Mutațiile critice (moderare anunț, aprobare/revocare KYB, soluționare
 *   dispute, schimbare rol utilizator, forțare status rezervare, trimitere
 *   notificare de sistem) delegă execuția către funcțiile SQL `SECURITY DEFINER`
 *   din Migrațiile 008 și 009, care rulează ca tranzacții atomice și scriu
 *   automat în jurnalul imutabil `public.admin_audit_logs`.
 * - Dacă Migrația `008_admin_panel_and_audit.sql` sau `009_admin_super_controls.sql`
 *   nu a fost rulată încă în Supabase, degradăm grațios cu mesaje explicative.
 */

const MIGRATION_008_MISSING_MESSAGE =
  "Tabelele și funcțiile de administrare (Faza 15) nu au fost create încă în Supabase. Rulează fișierul supabase/migrations/008_admin_panel_and_audit.sql în Supabase SQL Editor și reîncearcă.";

const MIGRATION_009_MISSING_MESSAGE =
  "Funcțiile Super-Admin nu au fost create încă în Supabase. Rulează fișierul supabase/migrations/009_admin_super_controls.sql în Supabase SQL Editor și reîncearcă.";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const VALID_LISTING_STATUSES = new Set<ListingStatus>([
  "available",
  "unavailable",
  "archived",
]);

const VALID_DISPUTE_RESOLUTIONS = new Set<
  "resolved_owner" | "resolved_renter" | "closed"
>(["resolved_owner", "resolved_renter", "closed"]);

const VALID_USER_ROLES = new Set<UserRole>(["user", "moderator", "admin"]);

const VALID_BOOKING_STATUSES = new Set<BookingStatus>([
  "pending",
  "confirmed",
  "completed",
  "cancelled",
  "rejected",
]);

function errorResponse<T = null>(message: string): ActionResponse<T> {
  return {
    success: false,
    ok: false,
    error: message,
    message,
  };
}

function successResponse<T = null>(
  message: string,
  data?: T
): ActionResponse<T> {
  return {
    success: true,
    ok: true,
    message,
    data,
  };
}

function roundRon(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Grupează un vector de etichete (ex. categorii, orașe, statusuri) într-o listă
 * sortată descrescător cu procentaje calculate cu o zecimală (echivalent cu
 * `Collectors.groupingBy(..., Collectors.counting())` în Java Streams).
 */
function buildBreakdown(labels: string[]): AdminBreakdownItem[] {
  const total = labels.length;
  if (total === 0) return [];

  const counts = new Map<string, number>();
  for (const raw of labels) {
    const label = raw.trim() || "nespecificat";
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }

  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([label, count]) => ({
      label,
      count,
      percentage: Math.round((count / total) * 1000) / 10,
    }));
}

/**
 * Construiește un DTO gol de tip `AdminDashboardData` pentru utilizatori
 * neautentificați sau fără rol de administrator (nu expune nicio dată).
 */
function buildEmptyAdminDashboardData(
  authorized: boolean,
  currentUserId: string | null,
  migrationMissing?: boolean
): AdminDashboardData {
  return {
    authorized,
    currentUserId,
    ...(migrationMissing ? { migrationMissing: true } : {}),
    kpis: {
      totalUsers: 0,
      personalUsers: 0,
      businessUsers: 0,
      verifiedPhones: 0,
      verifiedBusinesses: 0,
      totalListings: 0,
      activeListings: 0,
      pausedListings: 0,
      archivedListings: 0,
      totalBookings: 0,
      completedBookings: 0,
      activeBookings: 0,
      conversionRatePercent: 0,
      openDisputes: 0,
      openReports: 0,
      totalCommissionRon: 0,
      totalGmvRon: 0,
      escrowHeldRon: 0,
      averageBookingValueRon: 0,
      totalInvoices: 0,
      avgPlatformRating: null,
    },
    users: [],
    allListings: [],
    allBookings: [],
    invoices: [],
    categoryBreakdown: [],
    cityBreakdown: [],
    bookingStatusBreakdown: [],
    disputes: [],
    companies: [],
    reports: [],
    auditLogs: [],
  };
}

/**
 * Detectează erorile PostgreSQL / PostgREST care indică lipsa tabelelor sau
 * funcțiilor RPC din Migrația 008 (`42P01`, `42883`, `PGRST202`, `PGRST205`).
 */
function isMissingMigration008Error(
  error: { code?: string; message?: string } | null | undefined
): boolean {
  if (!error) return false;
  const code = error.code ?? "";
  const msg = (error.message ?? "").toLowerCase();
  return (
    code === "42P01" ||
    code === "42883" ||
    code === "PGRST202" ||
    code === "PGRST205" ||
    msg.includes("could not find the table") ||
    msg.includes("could not find the function") ||
    msg.includes("admin_audit_logs") ||
    msg.includes("listing_reports") ||
    msg.includes("admin_moderate_listing") ||
    msg.includes("admin_verify_company") ||
    msg.includes("admin_resolve_dispute") ||
    msg.includes("does not exist")
  );
}

/**
 * Detectează lipsa funcțiilor RPC din Migrația 009 (`009_admin_super_controls.sql`).
 */
function isMissingMigration009Error(
  error: { code?: string; message?: string } | null | undefined
): boolean {
  if (!error) return false;
  const code = error.code ?? "";
  const msg = (error.message ?? "").toLowerCase();
  return (
    code === "42883" ||
    code === "PGRST202" ||
    msg.includes("could not find the function") ||
    msg.includes("admin_set_user_role") ||
    msg.includes("admin_force_booking_status") ||
    msg.includes("admin_send_system_notification")
  );
}

/**
 * Helper intern server-side care verifică sesiunea și rolul `admin` din
 * `public.profile_private` (echivalent cu `SecurityContextHolder` în Spring).
 */
async function requireAdminContext() {
  const supabase = await createClient();
  if (!supabase) {
    return {
      supabase: null,
      userId: null,
      isAdmin: false,
      error: "Supabase nu este configurat în acest mediu.",
    };
  }

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return {
      supabase,
      userId: null,
      isAdmin: false,
      error: "Trebuie să fii autentificat pentru această acțiune.",
    };
  }

  const { data: privateProfile, error: roleError } = await supabase
    .from("profile_private")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (roleError || !privateProfile || privateProfile.role !== "admin") {
    return {
      supabase,
      userId: user.id,
      isAdmin: false,
      error: "Acces interzis: această operațiune necesită rol de administrator.",
    };
  }

  return {
    supabase,
    userId: user.id,
    isAdmin: true,
    error: null,
  };
}

/**
 * 1. Verifică rapid pe server dacă utilizatorul autentificat are rolul `admin`.
 */
export async function isCurrentUserAdminAction(): Promise<boolean> {
  const ctx = await requireAdminContext();
  return ctx.isAdmin;
}

/**
 * 2. Încarcă toate datele agregate pentru Super-Admin Command Center (`/admin`):
 *    KPI-uri extinse, utilizatori cu roluri, toate anunțurile, toate rezervările,
 *    plăți & escrow, facturi, distribuții (categorii, orașe, statusuri),
 *    dispute, firme KYB, raportări anunțuri și jurnalul de audit.
 */
export async function getAdminDashboardDataAction(): Promise<AdminDashboardData> {
  const ctx = await requireAdminContext();
  if (!ctx.supabase || !ctx.isAdmin) {
    return buildEmptyAdminDashboardData(false, ctx.userId);
  }

  const supabase = ctx.supabase;

  // Rulăm interogările în paralel (echivalent cu `CompletableFuture.allOf` în Java)
  const [
    allProfilesRes,
    privateRolesRes,
    allListingsRes,
    allBookingsRes,
    paymentsRes,
    invoicesRes,
    disputesRes,
    reportsRes,
    auditLogsRes,
  ] = await Promise.all([
    supabase
      .from("profiles")
      .select(
        "id, display_name, account_type, city, bio, avatar_url, phone_verified, kyb_verified, rating_avg, rating_count, created_at, updated_at, company_name, company_address, kyb_verified_at"
      )
      .order("created_at", { ascending: false })
      .limit(500),
    supabase.from("profile_private").select("id, role").limit(500),
    supabase
      .from("listings")
      .select(
        "id, catalog_code, owner_id, title, category, city, price_per_day, deposit_ron, status, rating_avg, rating_count, created_at"
      )
      .order("created_at", { ascending: false })
      .limit(500),
    supabase
      .from("bookings")
      .select(
        "id, booking_code, listing_id, renter_id, owner_id, start_date, end_date, total_days, total_price_ron, platform_fee_ron, status, created_at"
      )
      .order("created_at", { ascending: false })
      .limit(500),
    supabase
      .from("payments")
      .select(
        "booking_id, rental_amount_ron, platform_fee_ron, deposit_amount_ron, total_charged_ron, payment_status, deposit_status"
      ),
    supabase
      .from("invoices")
      .select(
        "id, invoice_number, booking_id, payment_id, owner_id, renter_id, issuer_name, issuer_cui, client_name, client_cui, client_address, subtotal_ron, vat_rate, vat_amount_ron, total_ron, currency, provider, external_invoice_id, efactura_status, issued_at, created_at"
      )
      .order("issued_at", { ascending: false })
      .limit(200),
    supabase
      .from("disputes")
      .select(
        "id, booking_id, opened_by, reason, description, claimed_amount_ron, status, created_at, updated_at, bookings(booking_code)"
      )
      .order("created_at", { ascending: false })
      .limit(50),
    supabase
      .from("listing_reports")
      .select(
        "id, listing_id, reporter_id, reason, details, status, created_at, listings(title, catalog_code, status)"
      )
      .order("created_at", { ascending: false })
      .limit(50),
    supabase
      .from("admin_audit_logs")
      .select("id, admin_id, action, target_type, target_id, details, created_at")
      .order("created_at", { ascending: false })
      .limit(100),
  ]);

  const migrationMissing =
    isMissingMigration008Error(reportsRes.error) ||
    isMissingMigration008Error(auditLogsRes.error);

  // 1. Hartă de roluri din `public.profile_private` (fallback grațios "user" dacă Migrația 009 lipsește)
  const roleByUserId = new Map<string, UserRole>();
  if (!privateRolesRes.error && Array.isArray(privateRolesRes.data)) {
    for (const row of privateRolesRes.data) {
      const rawRole = String(row.role ?? "user") as UserRole;
      roleByUserId.set(
        String(row.id),
        VALID_USER_ROLES.has(rawRole) ? rawRole : "user"
      );
    }
  }
  if (ctx.userId && !roleByUserId.has(ctx.userId)) {
    roleByUserId.set(ctx.userId, "admin");
  }

  // 2. Normalizare profiluri + indexare rapidă în Map (O(1) lookup, ca `HashMap` în Java)
  const normalizedProfiles: Profile[] =
    !allProfilesRes.error && Array.isArray(allProfilesRes.data)
      ? allProfilesRes.data.map((row) => ({
          id: String(row.id),
          display_name: String(row.display_name ?? ""),
          account_type: String(row.account_type ?? "individual") as AccountType,
          city: String(row.city ?? ""),
          bio: row.bio ? String(row.bio) : null,
          avatar_url: row.avatar_url ? String(row.avatar_url) : null,
          phone_verified: Boolean(row.phone_verified),
          kyb_verified: Boolean(row.kyb_verified),
          rating_avg:
            row.rating_avg !== null && row.rating_avg !== undefined
              ? Number(row.rating_avg)
              : null,
          rating_count: Number(row.rating_count ?? 0) || 0,
          created_at: String(row.created_at),
          updated_at: String(row.updated_at),
          company_name: row.company_name ? String(row.company_name) : null,
          company_address: row.company_address
            ? String(row.company_address)
            : null,
          kyb_verified_at: row.kyb_verified_at
            ? String(row.kyb_verified_at)
            : null,
        }))
      : [];

  const profileById = new Map<string, Profile>();
  for (const profile of normalizedProfiles) {
    profileById.set(profile.id, profile);
  }

  // 3. Normalizare toate anunțurile + numărare anunțuri per proprietar
  const listingsCountByOwner = new Map<string, number>();
  const allListings: AdminListingRow[] =
    !allListingsRes.error && Array.isArray(allListingsRes.data)
      ? allListingsRes.data.map((row) => {
          const ownerId = String(row.owner_id);
          listingsCountByOwner.set(
            ownerId,
            (listingsCountByOwner.get(ownerId) ?? 0) + 1
          );
          const owner = profileById.get(ownerId);
          return {
            id: String(row.id),
            catalog_code: String(row.catalog_code ?? ""),
            title: String(row.title ?? ""),
            category: String(row.category ?? "altele"),
            city: String(row.city ?? ""),
            price_per_day: Number(row.price_per_day ?? 0) || 0,
            deposit_ron: Number(row.deposit_ron ?? 0) || 0,
            status: String(row.status ?? "available") as ListingStatus,
            rating_avg:
              row.rating_avg !== null && row.rating_avg !== undefined
                ? Number(row.rating_avg)
                : null,
            rating_count: Number(row.rating_count ?? 0) || 0,
            owner_id: ownerId,
            owner_name: owner?.display_name || "Utilizator necunoscut",
            owner_type: owner?.account_type ?? "individual",
            created_at: String(row.created_at),
          };
        })
      : [];

  const listingById = new Map<string, AdminListingRow>();
  for (const listing of allListings) {
    listingById.set(listing.id, listing);
  }

  // 4. Lista completă de utilizatori cu rol + număr anunțuri
  const users: AdminUserRow[] = normalizedProfiles.map((profile) => ({
    ...profile,
    role: roleByUserId.get(profile.id) ?? "user",
    listings_count: listingsCountByOwner.get(profile.id) ?? 0,
  }));

  // 5. Firme (conturi `account_type = 'company'`, sortate neverificate primele)
  const companies: Profile[] = normalizedProfiles
    .filter((p) => p.account_type === "company")
    .sort((a, b) => {
      if (a.kyb_verified !== b.kyb_verified) {
        return a.kyb_verified ? 1 : -1;
      }
      return b.created_at.localeCompare(a.created_at);
    });

  // 6. Calcul KPI financiari (GMV, comision, escrow blocat) + mapare plăți per rezervare
  let totalCommissionRon = 0;
  let totalGmvRon = 0;
  let escrowHeldRon = 0;
  const paymentByBookingId = new Map<
    string,
    { payment_status: PaymentStatus; deposit_status: DepositStatus }
  >();

  if (!paymentsRes.error && Array.isArray(paymentsRes.data)) {
    for (const row of paymentsRes.data) {
      const bookingId = String(row.booking_id ?? "");
      const paymentStatus = String(row.payment_status ?? "unpaid") as PaymentStatus;
      const depositStatus = String(row.deposit_status ?? "none") as DepositStatus;

      if (bookingId) {
        paymentByBookingId.set(bookingId, {
          payment_status: paymentStatus,
          deposit_status: depositStatus,
        });
      }

      if (
        paymentStatus === "paid" ||
        paymentStatus === "released" ||
        paymentStatus === "disputed"
      ) {
        totalCommissionRon += Number(row.platform_fee_ron ?? 0) || 0;
        totalGmvRon += Number(row.rental_amount_ron ?? 0) || 0;
      }

      if (
        paymentStatus === "paid" ||
        paymentStatus === "authorized" ||
        paymentStatus === "disputed"
      ) {
        escrowHeldRon += Number(row.rental_amount_ron ?? 0) || 0;
      }

      if (depositStatus === "held") {
        escrowHeldRon += Number(row.deposit_amount_ron ?? 0) || 0;
      }
    }
  }

  // 7. Normalizare toate rezervările cu nume participanți, obiect și status plată
  const allBookings: AdminBookingRow[] =
    !allBookingsRes.error && Array.isArray(allBookingsRes.data)
      ? allBookingsRes.data.map((row) => {
          const id = String(row.id);
          const listingId = String(row.listing_id);
          const renterId = String(row.renter_id);
          const ownerId = String(row.owner_id);
          const listing = listingById.get(listingId);
          const renter = profileById.get(renterId);
          const owner = profileById.get(ownerId);
          const payment = paymentByBookingId.get(id);

          return {
            id,
            booking_code: String(row.booking_code ?? ""),
            listing_id: listingId,
            listing_title: listing?.title || "Obiect șters / indisponibil",
            listing_code: listing?.catalog_code || "—",
            renter_name: renter?.display_name || "Chiriaș necunoscut",
            owner_name: owner?.display_name || "Proprietar necunoscut",
            start_date: String(row.start_date),
            end_date: String(row.end_date),
            total_days: Number(row.total_days ?? 1) || 1,
            total_price_ron: Number(row.total_price_ron ?? 0) || 0,
            platform_fee_ron: Number(row.platform_fee_ron ?? 0) || 0,
            status: String(row.status ?? "pending") as BookingStatus,
            payment_status: payment?.payment_status ?? null,
            deposit_status: payment?.deposit_status ?? null,
            created_at: String(row.created_at),
          };
        })
      : [];

  // 8. Normalizare facturi
  const invoices: InvoiceRecord[] =
    !invoicesRes.error && Array.isArray(invoicesRes.data)
      ? invoicesRes.data.map((row) => ({
          id: String(row.id),
          invoice_number: String(row.invoice_number ?? ""),
          booking_id: String(row.booking_id),
          payment_id: row.payment_id ? String(row.payment_id) : null,
          owner_id: String(row.owner_id),
          renter_id: String(row.renter_id),
          issuer_name: String(row.issuer_name ?? ""),
          issuer_cui: String(row.issuer_cui ?? ""),
          client_name: String(row.client_name ?? ""),
          client_cui: row.client_cui ? String(row.client_cui) : null,
          client_address: row.client_address ? String(row.client_address) : null,
          subtotal_ron: Number(row.subtotal_ron ?? 0) || 0,
          vat_rate: Number(row.vat_rate ?? 19) || 0,
          vat_amount_ron: Number(row.vat_amount_ron ?? 0) || 0,
          total_ron: Number(row.total_ron ?? 0) || 0,
          currency: String(row.currency ?? "RON"),
          provider: String(row.provider ?? "internal") as InvoiceProvider,
          external_invoice_id: row.external_invoice_id
            ? String(row.external_invoice_id)
            : null,
          efactura_status: String(
            row.efactura_status ?? "pending_anaf"
          ) as EFacturaStatus,
          issued_at: String(row.issued_at),
          created_at: String(row.created_at),
        }))
      : [];

  // 9. Normalizare dispute + extragere `booking_code` din relația JOIN
  const disputes: (DisputeRecord & { booking_code?: string })[] =
    !disputesRes.error && Array.isArray(disputesRes.data)
      ? disputesRes.data.map((row) => {
          const bookingJoin = Array.isArray(row.bookings)
            ? row.bookings[0]
            : row.bookings;
          return {
            id: String(row.id),
            booking_id: String(row.booking_id),
            opened_by: String(row.opened_by),
            reason: String(row.reason) as DisputeReason,
            description: String(row.description ?? ""),
            claimed_amount_ron: Number(row.claimed_amount_ron ?? 0) || 0,
            status: String(row.status) as DisputeStatus,
            created_at: String(row.created_at),
            updated_at: String(row.updated_at),
            booking_code: bookingJoin?.booking_code
              ? String(bookingJoin.booking_code)
              : undefined,
          };
        })
      : [];

  // 10. Normalizare raportări anunțuri
  const reports: ListingReportRecord[] =
    !reportsRes.error && Array.isArray(reportsRes.data)
      ? reportsRes.data.map((row) => {
          const listingJoin = Array.isArray(row.listings)
            ? row.listings[0]
            : row.listings;
          return {
            id: String(row.id),
            listing_id: String(row.listing_id),
            reporter_id: String(row.reporter_id),
            reason: String(row.reason ?? ""),
            details: row.details ? String(row.details) : null,
            status: String(row.status ?? "open") as ListingReportStatus,
            created_at: String(row.created_at),
            listing_title: listingJoin?.title
              ? String(listingJoin.title)
              : undefined,
            listing_catalog_code: listingJoin?.catalog_code
              ? String(listingJoin.catalog_code)
              : undefined,
            listing_status: listingJoin?.status
              ? (String(listingJoin.status) as ListingStatus)
              : undefined,
          };
        })
      : [];

  // 11. Normalizare jurnal de audit administrativ
  const auditLogs: AdminAuditLog[] =
    !auditLogsRes.error && Array.isArray(auditLogsRes.data)
      ? auditLogsRes.data.map((row) => ({
          id: String(row.id),
          admin_id: String(row.admin_id),
          action: String(row.action ?? ""),
          target_type: String(row.target_type ?? ""),
          target_id: String(row.target_id ?? ""),
          details:
            row.details &&
            typeof row.details === "object" &&
            !Array.isArray(row.details)
              ? (row.details as Record<string, unknown>)
              : {},
          created_at: String(row.created_at),
        }))
      : [];

  // 12. Calcul KPI-uri agregate & distribuții
  const totalUsers = users.length;
  const personalUsers = users.filter(
    (u) => u.account_type === "individual"
  ).length;
  const businessUsers = users.filter((u) => u.account_type === "company").length;
  const verifiedPhones = users.filter((u) => u.phone_verified).length;
  const verifiedBusinesses = users.filter(
    (u) => u.account_type === "company" && u.kyb_verified
  ).length;

  const totalListings = allListings.length;
  const activeListings = allListings.filter(
    (l) => l.status === "available"
  ).length;
  const pausedListings = allListings.filter(
    (l) => l.status === "unavailable"
  ).length;
  const archivedListings = allListings.filter(
    (l) => l.status === "archived"
  ).length;

  const totalBookings = allBookings.length;
  const completedBookings = allBookings.filter(
    (b) => b.status === "completed"
  ).length;
  const confirmedBookings = allBookings.filter(
    (b) => b.status === "confirmed"
  ).length;
  const activeBookings = allBookings.filter(
    (b) => b.status === "pending" || b.status === "confirmed"
  ).length;
  const conversionRatePercent =
    totalBookings > 0
      ? Math.round(((confirmedBookings + completedBookings) / totalBookings) * 1000) /
        10
      : 0;

  const totalBookingsValueRon = allBookings.reduce(
    (sum, b) => sum + b.total_price_ron,
    0
  );
  const averageBookingValueRon =
    totalBookings > 0 ? roundRon(totalBookingsValueRon / totalBookings) : 0;

  // Media ponderată a rating-ului pe platformă (după numărul de recenzii)
  let weightedRatingSum = 0;
  let totalRatingCount = 0;
  for (const listing of allListings) {
    if (listing.rating_avg !== null && listing.rating_count > 0) {
      weightedRatingSum += listing.rating_avg * listing.rating_count;
      totalRatingCount += listing.rating_count;
    }
  }
  const avgPlatformRating =
    totalRatingCount > 0 ? roundRon(weightedRatingSum / totalRatingCount) : null;

  const openDisputes = disputes.filter(
    (d) => d.status === "open" || d.status === "under_review"
  ).length;
  const openReports = reports.filter((r) => r.status === "open").length;

  const categoryBreakdown = buildBreakdown(allListings.map((l) => l.category));
  const cityBreakdown = buildBreakdown(allListings.map((l) => l.city));
  const bookingStatusBreakdown = buildBreakdown(
    allBookings.map((b) => b.status)
  );

  return {
    authorized: true,
    currentUserId: ctx.userId,
    ...(migrationMissing ? { migrationMissing: true } : {}),
    kpis: {
      totalUsers,
      personalUsers,
      businessUsers,
      verifiedPhones,
      verifiedBusinesses,
      totalListings,
      activeListings,
      pausedListings,
      archivedListings,
      totalBookings,
      completedBookings,
      activeBookings,
      conversionRatePercent,
      openDisputes,
      openReports,
      totalCommissionRon: roundRon(totalCommissionRon),
      totalGmvRon: roundRon(totalGmvRon),
      escrowHeldRon: roundRon(escrowHeldRon),
      averageBookingValueRon,
      totalInvoices: invoices.length,
      avgPlatformRating,
    },
    users,
    allListings,
    allBookings,
    invoices,
    categoryBreakdown,
    cityBreakdown,
    bookingStatusBreakdown,
    disputes,
    companies,
    reports,
    auditLogs,
  };
}

/**
 * 3. Permite oricărui utilizator autentificat să raporteze un anunț suspect
 *    (inserat în `public.listing_reports`, cu RLS `auth.uid() = reporter_id`).
 */
export async function reportListingAction(
  listingId: string,
  reason: string,
  details?: string
): Promise<ActionResponse<null>> {
  if (!UUID_REGEX.test(listingId)) {
    return errorResponse("Identificatorul anunțului este invalid.");
  }

  const cleanReason = reason.trim();
  if (cleanReason.length < 3 || cleanReason.length > 120) {
    return errorResponse(
      "Motivul raportării trebuie să aibă între 3 și 120 de caractere."
    );
  }

  const cleanDetails = details ? details.trim() : "";
  if (cleanDetails.length > 1000) {
    return errorResponse(
      "Detaliile suplimentare nu pot depăși 1000 de caractere."
    );
  }

  const supabase = await createClient();
  if (!supabase) {
    return errorResponse("Supabase nu este configurat în acest mediu.");
  }

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return errorResponse(
      "Trebuie să fii autentificat pentru a raporta un anunț."
    );
  }

  // Verificăm că anunțul există și că utilizatorul nu își raportează propriul anunț
  const { data: listing, error: listingError } = await supabase
    .from("listings")
    .select("id, owner_id")
    .eq("id", listingId)
    .maybeSingle();

  if (listingError || !listing) {
    return errorResponse("Anunțul selectat nu a fost găsit.");
  }

  if (listing.owner_id === user.id) {
    return errorResponse("Nu poți raporta propriul tău anunț.");
  }

  const { error: insertError } = await supabase.from("listing_reports").insert({
    listing_id: listingId,
    reporter_id: user.id,
    reason: cleanReason,
    details: cleanDetails || null,
    status: "open",
  });

  if (insertError) {
    if (isMissingMigration008Error(insertError)) {
      return errorResponse(MIGRATION_008_MISSING_MESSAGE);
    }
    return errorResponse(
      insertError.message || "Nu am putut înregistra raportarea anunțului."
    );
  }

  revalidatePath("/admin");

  return successResponse(
    "Raportarea a fost trimisă către echipa de moderare RentA.",
    null
  );
}

/**
 * 4. Moderează statusul unui anunț (`available` | `unavailable` | `archived`)
 *    și închide raportarea asociată (dacă există), scriind atomic în audit log.
 */
export async function adminModerateListingAction(
  listingId: string,
  newStatus: ListingStatus,
  reportId?: string,
  notes?: string
): Promise<ActionResponse<null>> {
  if (!UUID_REGEX.test(listingId)) {
    return errorResponse("Identificatorul anunțului este invalid.");
  }

  if (!VALID_LISTING_STATUSES.has(newStatus)) {
    return errorResponse("Statusul ales pentru anunț nu este valid.");
  }

  if (reportId && !UUID_REGEX.test(reportId)) {
    return errorResponse("Identificatorul raportării este invalid.");
  }

  const cleanNotes = notes ? notes.trim() : "";
  if (cleanNotes.length > 1000) {
    return errorResponse("Notele de moderare nu pot depăși 1000 de caractere.");
  }

  const ctx = await requireAdminContext();
  if (!ctx.supabase || !ctx.isAdmin) {
    return errorResponse(ctx.error ?? "Acces interzis.");
  }

  const { error } = await ctx.supabase.rpc("admin_moderate_listing", {
    p_listing_id: listingId,
    p_new_status: newStatus,
    p_report_id: reportId ?? null,
    p_notes: cleanNotes || null,
  });

  if (error) {
    if (isMissingMigration008Error(error)) {
      return errorResponse(MIGRATION_008_MISSING_MESSAGE);
    }
    return errorResponse(
      error.message || "Eroare la moderarea anunțului în baza de date."
    );
  }

  revalidatePath("/admin");
  revalidatePath("/catalog");
  revalidatePath(`/listings/${listingId}`);

  return successResponse(
    `Anunțul a fost actualizat la statusul „${newStatus}” și acțiunea a fost salvată în jurnalul de audit.`,
    null
  );
}

/**
 * 5. Aprobă sau revocă verificarea KYB pentru un cont de firmă (`account_type = 'company'`).
 */
export async function adminVerifyCompanyAction(
  userId: string,
  approve: boolean
): Promise<ActionResponse<null>> {
  if (!UUID_REGEX.test(userId)) {
    return errorResponse("Identificatorul utilizatorului este invalid.");
  }

  if (typeof approve !== "boolean") {
    return errorResponse("Parametrul de aprobare KYB este invalid.");
  }

  const ctx = await requireAdminContext();
  if (!ctx.supabase || !ctx.isAdmin) {
    return errorResponse(ctx.error ?? "Acces interzis.");
  }

  const { error } = await ctx.supabase.rpc("admin_verify_company", {
    p_user_id: userId,
    p_approve: approve,
  });

  if (error) {
    if (isMissingMigration008Error(error)) {
      return errorResponse(MIGRATION_008_MISSING_MESSAGE);
    }
    return errorResponse(
      error.message || "Eroare la actualizarea verificării KYB."
    );
  }

  revalidatePath("/admin");
  revalidatePath("/catalog");
  revalidatePath("/dashboard/profile");

  return successResponse(
    approve
      ? "Firma a fost marcată ca verificată KYB și decizia a fost înregistrată în audit log."
      : "Verificarea KYB a firmei a fost revocată și decizia a fost înregistrată în audit log.",
    null
  );
}

/**
 * 6. Soluționează o dispută comercială (`resolved_owner` | `resolved_renter` | `closed`),
 *    actualizează starea escrow din `public.payments` și consemnează în audit log.
 */
export async function adminResolveDisputeAction(
  disputeId: string,
  resolution: "resolved_owner" | "resolved_renter" | "closed",
  notes?: string
): Promise<ActionResponse<null>> {
  if (!UUID_REGEX.test(disputeId)) {
    return errorResponse("Identificatorul disputei este invalid.");
  }

  if (!VALID_DISPUTE_RESOLUTIONS.has(resolution)) {
    return errorResponse("Rezoluția aleasă pentru dispută este invalidă.");
  }

  const cleanNotes = notes ? notes.trim() : "";
  if (cleanNotes.length > 1000) {
    return errorResponse("Notele de soluționare nu pot depăși 1000 de caractere.");
  }

  const ctx = await requireAdminContext();
  if (!ctx.supabase || !ctx.isAdmin) {
    return errorResponse(ctx.error ?? "Acces interzis.");
  }

  const { error } = await ctx.supabase.rpc("admin_resolve_dispute", {
    p_dispute_id: disputeId,
    p_resolution: resolution,
    p_notes: cleanNotes || null,
  });

  if (error) {
    if (isMissingMigration008Error(error)) {
      return errorResponse(MIGRATION_008_MISSING_MESSAGE);
    }
    return errorResponse(
      error.message || "Eroare la soluționarea disputei în baza de date."
    );
  }

  revalidatePath("/admin");
  revalidatePath("/dashboard/bookings");

  return successResponse(
    "Disputa a fost soluționată, starea escrow a fost actualizată și decizia a fost salvată în audit log.",
    null
  );
}

/**
 * 7. Modifică rolul unui utilizator (`user` | `moderator` | `admin`) prin RPC
 *    privilegiat `admin_set_user_role` (cu protecție anti auto-retrogradare și audit log).
 */
export async function adminSetUserRoleAction(
  targetUserId: string,
  newRole: UserRole
): Promise<ActionResponse<null>> {
  if (!UUID_REGEX.test(targetUserId)) {
    return errorResponse("Identificatorul utilizatorului este invalid.");
  }

  if (!VALID_USER_ROLES.has(newRole)) {
    return errorResponse("Rolul selectat nu este valid.");
  }

  const ctx = await requireAdminContext();
  if (!ctx.supabase || !ctx.isAdmin) {
    return errorResponse(ctx.error ?? "Acces interzis.");
  }

  if (targetUserId === ctx.userId && newRole !== "admin") {
    return errorResponse("Nu îți poți revoca propriul rol de admin.");
  }

  const { error } = await ctx.supabase.rpc("admin_set_user_role", {
    p_target_user_id: targetUserId,
    p_new_role: newRole,
  });

  if (error) {
    if (isMissingMigration009Error(error)) {
      return errorResponse(MIGRATION_009_MISSING_MESSAGE);
    }
    return errorResponse(
      error.message || "Eroare la actualizarea rolului utilizatorului."
    );
  }

  revalidatePath("/admin");

  return successResponse(
    `Rolul utilizatorului a fost actualizat la „${newRole}” și acțiunea a fost consemnată în audit log.`,
    null
  );
}

/**
 * 8. Forțează statusul unei rezervări (`pending` | `confirmed` | `completed` |
 *    `cancelled` | `rejected`) prin RPC privilegiat `admin_force_booking_status`.
 */
export async function adminForceBookingStatusAction(
  bookingId: string,
  newStatus: BookingStatus,
  notes?: string
): Promise<ActionResponse<null>> {
  if (!UUID_REGEX.test(bookingId)) {
    return errorResponse("Identificatorul rezervării este invalid.");
  }

  if (!VALID_BOOKING_STATUSES.has(newStatus)) {
    return errorResponse("Statusul selectat pentru rezervare este invalid.");
  }

  const cleanNotes = notes ? notes.trim() : "";
  if (cleanNotes.length > 1000) {
    return errorResponse(
      "Notele administrative nu pot depăși 1000 de caractere."
    );
  }

  const ctx = await requireAdminContext();
  if (!ctx.supabase || !ctx.isAdmin) {
    return errorResponse(ctx.error ?? "Acces interzis.");
  }

  const { error } = await ctx.supabase.rpc("admin_force_booking_status", {
    p_booking_id: bookingId,
    p_new_status: newStatus,
    p_notes: cleanNotes || null,
  });

  if (error) {
    if (isMissingMigration009Error(error)) {
      return errorResponse(MIGRATION_009_MISSING_MESSAGE);
    }
    return errorResponse(
      error.message || "Eroare la actualizarea forțată a statusului rezervării."
    );
  }

  revalidatePath("/admin");
  revalidatePath("/dashboard/bookings");

  return successResponse(
    `Statusul rezervării a fost actualizat la „${newStatus}” și acțiunea a fost salvată în audit log.`,
    null
  );
}

/**
 * 9. Trimite o notificare de sistem (`type = 'system'`) către un utilizator
 *    prin RPC privilegiat `admin_send_system_notification` și jurnalizează în audit log.
 */
export async function adminSendSystemNotificationAction(
  targetUserId: string,
  title: string,
  body: string,
  actionUrl?: string
): Promise<ActionResponse<null>> {
  if (!UUID_REGEX.test(targetUserId)) {
    return errorResponse("Identificatorul utilizatorului destinatar este invalid.");
  }

  const cleanTitle = title.trim();
  if (cleanTitle.length < 2 || cleanTitle.length > 160) {
    return errorResponse(
      "Titlul notificării trebuie să aibă între 2 și 160 de caractere."
    );
  }

  const cleanBody = body.trim();
  if (cleanBody.length < 2 || cleanBody.length > 2000) {
    return errorResponse(
      "Mesajul notificării trebuie să aibă între 2 și 2000 de caractere."
    );
  }

  const cleanActionUrl = actionUrl ? actionUrl.trim() : "";
  if (cleanActionUrl.length > 500) {
    return errorResponse("Link-ul de acțiune nu poate depăși 500 de caractere.");
  }
  if (
    cleanActionUrl &&
    !cleanActionUrl.startsWith("/") &&
    !cleanActionUrl.startsWith("https://")
  ) {
    return errorResponse(
      "Link-ul de acțiune trebuie să fie o cale internă (ex. /dashboard) sau un URL https://."
    );
  }

  const ctx = await requireAdminContext();
  if (!ctx.supabase || !ctx.isAdmin) {
    return errorResponse(ctx.error ?? "Acces interzis.");
  }

  const { error } = await ctx.supabase.rpc("admin_send_system_notification", {
    p_target_user_id: targetUserId,
    p_title: cleanTitle,
    p_body: cleanBody,
    p_action_url: cleanActionUrl || null,
  });

  if (error) {
    if (isMissingMigration009Error(error)) {
      return errorResponse(MIGRATION_009_MISSING_MESSAGE);
    }
    return errorResponse(
      error.message || "Eroare la trimiterea notificării de sistem."
    );
  }

  revalidatePath("/admin");
  revalidatePath("/dashboard");

  return successResponse(
    "Notificarea de sistem a fost trimisă utilizatorului și înregistrată în audit log.",
    null
  );
}

/**
 * Construiește un DTO gol de tip `AdminUserInspectionData` (echivalent cu un
 * `Optional.empty()` / Null-Object Pattern în Java) atunci când apelantul nu
 * are rol de administrator sau când `targetUserId` nu este valid.
 */
function buildEmptyAdminUserInspectionData(
  authorized: boolean,
  adminUserId: string | null
): AdminUserInspectionData {
  return {
    authorized,
    adminUserId,
    user: null,
    stats: {
      totalListings: 0,
      activeListings: 0,
      pausedListings: 0,
      archivedListings: 0,
      bookingsAsOwnerCount: 0,
      bookingsAsRenterCount: 0,
      completedBookingsCount: 0,
      totalEarnedAsOwnerRon: 0,
      totalSpentAsRenterRon: 0,
      invoicesCount: 0,
    },
    listings: [],
    bookingsAsOwner: [],
    bookingsAsRenter: [],
    invoices: [],
    auditLogs: [],
  };
}

/**
 * 10. Admin 360° Account Inspector (View-Only / Read-Only User View):
 *     Încarcă imaginea completă 360° a unui utilizator (profil public + date
 *     private PII din `profile_private`, inventar complet de anunțuri,
 *     rezervări ca proprietar și ca chiriaș, facturi și jurnal de audit).
 *
 * Analogie C / Java:
 * - În Spring Boot, această funcție este un serviciu `@Transactional(readOnly = true)`
 *   protejat cu `@PreAuthorize("hasRole('ADMIN')")` care agregă printr-un
 *   `CompletableFuture.allOf(...)` (`Promise.all`) datele din 6 tabele într-un
 *   singur DTO Read-Only (`AdminUserInspectionData`), fără a modifica starea
 *   utilizatorului inspectat și fără a-i prelua sesiunea (fără impersonare).
 */
export async function getAdminUserInspectionDataAction(
  targetUserId: string
): Promise<AdminUserInspectionData> {
  const ctx = await requireAdminContext();
  if (!ctx.supabase || !ctx.isAdmin) {
    return buildEmptyAdminUserInspectionData(false, ctx.userId);
  }

  const cleanTargetId = (targetUserId ?? "").trim();
  if (!UUID_REGEX.test(cleanTargetId)) {
    return buildEmptyAdminUserInspectionData(true, ctx.userId);
  }

  const supabase = ctx.supabase;

  // Interogăm în paralel toate sursele de date folosind politicile RLS `*_select_admin`
  // din Migrațiile 008 și 009 (echivalent cu `CompletableFuture.allOf` în Java)
  const [
    profileRes,
    privateRes,
    listingsRes,
    bookingsRes,
    invoicesRes,
    auditLogsRes,
  ] = await Promise.all([
    supabase
      .from("profiles")
      .select(
        "id, display_name, account_type, city, bio, avatar_url, phone_verified, kyb_verified, rating_avg, rating_count, created_at, updated_at, company_name, company_address, kyb_verified_at"
      )
      .eq("id", cleanTargetId)
      .maybeSingle(),
    supabase
      .from("profile_private")
      .select("phone, company_cui, phone_verified, role")
      .eq("id", cleanTargetId)
      .maybeSingle(),
    supabase
      .from("listings")
      .select(
        "id, catalog_code, owner_id, title, description, category, price_per_day, price_per_hour, deposit_ron, min_rental_days, cancellation_policy, rating_avg, rating_count, city, status, created_at, updated_at, images:listing_images(*)"
      )
      .eq("owner_id", cleanTargetId)
      .order("created_at", { ascending: false }),
    supabase
      .from("bookings")
      .select(
        "id, booking_code, listing_id, renter_id, owner_id, start_date, end_date, total_days, total_price_ron, platform_fee_ron, status, created_at, listings(id, catalog_code, title)"
      )
      .or(`owner_id.eq.${cleanTargetId},renter_id.eq.${cleanTargetId}`)
      .order("created_at", { ascending: false }),
    supabase
      .from("invoices")
      .select(
        "id, invoice_number, booking_id, payment_id, owner_id, renter_id, issuer_name, issuer_cui, client_name, client_cui, client_address, subtotal_ron, vat_rate, vat_amount_ron, total_ron, currency, provider, external_invoice_id, efactura_status, issued_at, created_at"
      )
      .or(`owner_id.eq.${cleanTargetId},renter_id.eq.${cleanTargetId}`)
      .order("issued_at", { ascending: false }),
    supabase
      .from("admin_audit_logs")
      .select("id, admin_id, action, target_type, target_id, details, created_at")
      .eq("target_id", cleanTargetId)
      .order("created_at", { ascending: false })
      .limit(25),
  ]);

  if (profileRes.error || !profileRes.data) {
    return buildEmptyAdminUserInspectionData(true, ctx.userId);
  }

  const pRow = profileRes.data;
  const privRow = !privateRes.error ? privateRes.data : null;

  const rawRole = String(privRow?.role ?? "user") as UserRole;
  const resolvedRole: UserRole = VALID_USER_ROLES.has(rawRole)
    ? rawRole
    : "user";
  const resolvedPhone = privRow?.phone ? String(privRow.phone) : null;
  const resolvedCompanyCui = privRow?.company_cui
    ? String(privRow.company_cui)
    : null;
  const resolvedPhoneVerified =
    Boolean(pRow.phone_verified) || Boolean(privRow?.phone_verified);

  const inspectedUser: Profile & {
    role: UserRole;
    phone: string | null;
    company_cui: string | null;
  } = {
    id: String(pRow.id),
    display_name: String(pRow.display_name ?? ""),
    account_type: String(pRow.account_type ?? "individual") as AccountType,
    city: String(pRow.city ?? ""),
    bio: pRow.bio ? String(pRow.bio) : null,
    avatar_url: pRow.avatar_url ? String(pRow.avatar_url) : null,
    phone_verified: resolvedPhoneVerified,
    kyb_verified: Boolean(pRow.kyb_verified),
    rating_avg:
      pRow.rating_avg !== null && pRow.rating_avg !== undefined
        ? Number(pRow.rating_avg)
        : null,
    rating_count: Number(pRow.rating_count ?? 0) || 0,
    created_at: String(pRow.created_at),
    updated_at: String(pRow.updated_at),
    company_name: pRow.company_name ? String(pRow.company_name) : null,
    company_address: pRow.company_address ? String(pRow.company_address) : null,
    kyb_verified_at: pRow.kyb_verified_at ? String(pRow.kyb_verified_at) : null,
    role: resolvedRole,
    phone: resolvedPhone,
    company_cui: resolvedCompanyCui,
  };

  // Normalizare anunțuri (`ListingWithDetails[]`)
  const ownerSummary: ListingWithDetails["owner"] = {
    id: inspectedUser.id,
    display_name: inspectedUser.display_name,
    account_type: inspectedUser.account_type,
    city: inspectedUser.city,
    bio: inspectedUser.bio,
    avatar_url: inspectedUser.avatar_url,
    phone_verified: inspectedUser.phone_verified,
    kyb_verified: inspectedUser.kyb_verified,
    rating_avg: inspectedUser.rating_avg,
    rating_count: inspectedUser.rating_count,
    company_cui: inspectedUser.company_cui,
    phone: inspectedUser.phone,
  };

  const listings: ListingWithDetails[] =
    !listingsRes.error && Array.isArray(listingsRes.data)
      ? listingsRes.data.map((row) => {
          const rawImages = Array.isArray(row.images) ? row.images : [];
          const sortedImages: ListingImage[] = rawImages
            .map((img: Record<string, unknown>) => ({
              id: String(img.id ?? ""),
              listing_id: String(img.listing_id ?? row.id),
              storage_path: String(img.storage_path ?? ""),
              url: String(img.url ?? ""),
              display_order: Number(img.display_order ?? 0) || 0,
              created_at: String(img.created_at ?? row.created_at),
            }))
            .sort((a, b) => a.display_order - b.display_order);

          const ratingAvg =
            row.rating_avg !== null && row.rating_avg !== undefined
              ? Number(row.rating_avg)
              : null;
          const ratingCount = Number(row.rating_count ?? 0) || 0;

          return {
            id: String(row.id),
            catalog_code: String(row.catalog_code ?? ""),
            owner_id: String(row.owner_id),
            title: String(row.title ?? ""),
            description: String(row.description ?? ""),
            category: String(row.category ?? "altele") as CategorySlug,
            price_per_day: Number(row.price_per_day ?? 0) || 0,
            price_per_hour:
              row.price_per_hour !== null && row.price_per_hour !== undefined
                ? Number(row.price_per_hour)
                : null,
            deposit_ron: Number(row.deposit_ron ?? 0) || 0,
            min_rental_days: Number(row.min_rental_days ?? 1) || 1,
            cancellation_policy: String(
              row.cancellation_policy ?? "flexible"
            ) as CancellationPolicy,
            rating_avg: ratingAvg,
            rating_count: ratingCount,
            city: String(row.city ?? ""),
            status: String(row.status ?? "available") as ListingStatus,
            created_at: String(row.created_at),
            updated_at: String(row.updated_at),
            owner: ownerSummary,
            images: sortedImages,
            average_rating: ratingAvg,
            reviews_count: ratingCount,
          };
        })
      : [];

  const listingTitleById = new Map<
    string,
    { title: string; catalog_code: string }
  >();
  for (const item of listings) {
    listingTitleById.set(item.id, {
      title: item.title,
      catalog_code: item.catalog_code,
    });
  }

  // Colectăm ID-urile rezervărilor și ale partenerilor pentru a aduce plățile și numele partenerilor în paralel
  const rawBookings =
    !bookingsRes.error && Array.isArray(bookingsRes.data)
      ? bookingsRes.data
      : [];

  const bookingIds: string[] = [];
  const partnerUserIds = new Set<string>();

  for (const bRow of rawBookings) {
    bookingIds.push(String(bRow.id));
    const rId = String(bRow.renter_id ?? "");
    const oId = String(bRow.owner_id ?? "");
    if (rId && rId !== cleanTargetId) partnerUserIds.add(rId);
    if (oId && oId !== cleanTargetId) partnerUserIds.add(oId);
  }

  const [paymentsForBookingsRes, partnerProfilesRes] = await Promise.all([
    bookingIds.length > 0
      ? supabase
          .from("payments")
          .select("booking_id, payment_status, deposit_status")
          .in("booking_id", bookingIds)
      : Promise.resolve({ data: [], error: null }),
    partnerUserIds.size > 0
      ? supabase
          .from("profiles")
          .select("id, display_name")
          .in("id", Array.from(partnerUserIds))
      : Promise.resolve({ data: [], error: null }),
  ]);

  const paymentByBookingId = new Map<
    string,
    { payment_status: PaymentStatus; deposit_status: DepositStatus }
  >();
  if (
    !paymentsForBookingsRes.error &&
    Array.isArray(paymentsForBookingsRes.data)
  ) {
    for (const payRow of paymentsForBookingsRes.data) {
      const bId = String(payRow.booking_id ?? "");
      if (bId) {
        paymentByBookingId.set(bId, {
          payment_status: String(
            payRow.payment_status ?? "unpaid"
          ) as PaymentStatus,
          deposit_status: String(
            payRow.deposit_status ?? "none"
          ) as DepositStatus,
        });
      }
    }
  }

  const displayNameById = new Map<string, string>();
  displayNameById.set(inspectedUser.id, inspectedUser.display_name);
  if (
    !partnerProfilesRes.error &&
    Array.isArray(partnerProfilesRes.data)
  ) {
    for (const partRow of partnerProfilesRes.data) {
      displayNameById.set(
        String(partRow.id),
        String(partRow.display_name ?? "Utilizator RentA")
      );
    }
  }

  const bookingsAsOwner: AdminBookingRow[] = [];
  const bookingsAsRenter: AdminBookingRow[] = [];

  for (const row of rawBookings) {
    const id = String(row.id);
    const listingId = String(row.listing_id);
    const renterId = String(row.renter_id);
    const ownerId = String(row.owner_id);

    const listingJoin = Array.isArray(row.listings)
      ? row.listings[0]
      : row.listings;
    const fallbackListing = listingTitleById.get(listingId);

    const listingTitle = listingJoin?.title
      ? String(listingJoin.title)
      : fallbackListing?.title || "Obiect șters / indisponibil";
    const listingCode = listingJoin?.catalog_code
      ? String(listingJoin.catalog_code)
      : fallbackListing?.catalog_code || "—";

    const payment = paymentByBookingId.get(id);

    const normalizedBooking: AdminBookingRow = {
      id,
      booking_code: String(row.booking_code ?? ""),
      listing_id: listingId,
      listing_title: listingTitle,
      listing_code: listingCode,
      renter_name: displayNameById.get(renterId) || "Chiriaș necunoscut",
      owner_name: displayNameById.get(ownerId) || "Proprietar necunoscut",
      start_date: String(row.start_date),
      end_date: String(row.end_date),
      total_days: Number(row.total_days ?? 1) || 1,
      total_price_ron: Number(row.total_price_ron ?? 0) || 0,
      platform_fee_ron: Number(row.platform_fee_ron ?? 0) || 0,
      status: String(row.status ?? "pending") as BookingStatus,
      payment_status: payment?.payment_status ?? null,
      deposit_status: payment?.deposit_status ?? null,
      created_at: String(row.created_at),
    };

    if (ownerId === cleanTargetId) {
      bookingsAsOwner.push(normalizedBooking);
    }
    if (renterId === cleanTargetId) {
      bookingsAsRenter.push(normalizedBooking);
    }
  }

  // Normalizare facturi
  const invoices: InvoiceRecord[] =
    !invoicesRes.error && Array.isArray(invoicesRes.data)
      ? invoicesRes.data.map((row) => ({
          id: String(row.id),
          invoice_number: String(row.invoice_number ?? ""),
          booking_id: String(row.booking_id),
          payment_id: row.payment_id ? String(row.payment_id) : null,
          owner_id: String(row.owner_id),
          renter_id: String(row.renter_id),
          issuer_name: String(row.issuer_name ?? ""),
          issuer_cui: String(row.issuer_cui ?? ""),
          client_name: String(row.client_name ?? ""),
          client_cui: row.client_cui ? String(row.client_cui) : null,
          client_address: row.client_address
            ? String(row.client_address)
            : null,
          subtotal_ron: Number(row.subtotal_ron ?? 0) || 0,
          vat_rate: Number(row.vat_rate ?? 19) || 0,
          vat_amount_ron: Number(row.vat_amount_ron ?? 0) || 0,
          total_ron: Number(row.total_ron ?? 0) || 0,
          currency: String(row.currency ?? "RON"),
          provider: String(row.provider ?? "internal") as InvoiceProvider,
          external_invoice_id: row.external_invoice_id
            ? String(row.external_invoice_id)
            : null,
          efactura_status: String(
            row.efactura_status ?? "pending_anaf"
          ) as EFacturaStatus,
          issued_at: String(row.issued_at),
          created_at: String(row.created_at),
        }))
      : [];

  // Normalizare jurnal de audit pentru acest utilizator (ultimele 25 intrări)
  const auditLogs: AdminAuditLog[] =
    !auditLogsRes.error && Array.isArray(auditLogsRes.data)
      ? auditLogsRes.data.map((row) => ({
          id: String(row.id),
          admin_id: String(row.admin_id),
          action: String(row.action ?? ""),
          target_type: String(row.target_type ?? ""),
          target_id: String(row.target_id ?? ""),
          details:
            row.details &&
            typeof row.details === "object" &&
            !Array.isArray(row.details)
              ? (row.details as Record<string, unknown>)
              : {},
          created_at: String(row.created_at),
        }))
      : [];

  // Calcul statistici 360° ale contului
  const totalListings = listings.length;
  const activeListings = listings.filter(
    (l) => l.status === "available"
  ).length;
  const pausedListings = listings.filter(
    (l) => l.status === "unavailable"
  ).length;
  const archivedListings = listings.filter(
    (l) => l.status === "archived"
  ).length;

  const bookingsAsOwnerCount = bookingsAsOwner.length;
  const bookingsAsRenterCount = bookingsAsRenter.length;

  const completedBookingsCount =
    bookingsAsOwner.filter((b) => b.status === "completed").length +
    bookingsAsRenter.filter((b) => b.status === "completed").length;

  // Câștigul net ca proprietar = 90% din valoarea rezervărilor confirmate/finalizate
  const totalEarnedAsOwnerRon = roundRon(
    bookingsAsOwner
      .filter((b) => b.status === "confirmed" || b.status === "completed")
      .reduce((sum, b) => sum + b.total_price_ron * 0.9, 0)
  );

  // Cheltuiala totală ca chiriaș = 100% din valoarea rezervărilor confirmate/finalizate
  const totalSpentAsRenterRon = roundRon(
    bookingsAsRenter
      .filter((b) => b.status === "confirmed" || b.status === "completed")
      .reduce((sum, b) => sum + b.total_price_ron, 0)
  );

  return {
    authorized: true,
    adminUserId: ctx.userId,
    user: inspectedUser,
    stats: {
      totalListings,
      activeListings,
      pausedListings,
      archivedListings,
      bookingsAsOwnerCount,
      bookingsAsRenterCount,
      completedBookingsCount,
      totalEarnedAsOwnerRon,
      totalSpentAsRenterRon,
      invoicesCount: invoices.length,
    },
    listings,
    bookingsAsOwner,
    bookingsAsRenter,
    invoices,
    auditLogs,
  };
}
