"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type {
  AccountType,
  ActionResponse,
  AdminAuditLog,
  AdminDashboardData,
  DisputeReason,
  DisputeRecord,
  DisputeStatus,
  ListingReportRecord,
  ListingReportStatus,
  ListingStatus,
  Profile,
} from "@/lib/types/database";

/**
 * ============================================================================
 * RentA (Faza 15) — Server Actions pentru Panoul de Administrare (`/admin`)
 * & Audit Log (`app/actions/admin.ts`)
 * ============================================================================
 *
 * Explicație pentru dezvoltatori C / Java:
 * - Acest fișier joacă rolul unui `AdminService` protejat prin `@PreAuthorize("hasRole('ADMIN')")`
 *   din Spring Boot: fiecare metodă sensibilă verifică direct pe server rolul
 *   utilizatorului în tabelul izolat `public.profile_private` (nu ne bazăm
 *   niciodată pe date venite din client/browser).
 * - Mutațiile critice (moderare anunț, aprobare/revocare KYB, soluționare
 *   dispute) delegă execuția către funcțiile SQL `SECURITY DEFINER` din
 *   Migrația 008 (`admin_moderate_listing`, `admin_verify_company`,
 *   `admin_resolve_dispute`), care rulează ca tranzacții atomice și scriu
 *   automat în jurnalul imutabil `public.admin_audit_logs`.
 * - Dacă Migrația `008_admin_panel_and_audit.sql` nu a fost rulată încă în
 *   Supabase, `getAdminDashboardDataAction()` detectează acest lucru grațios
 *   și returnează `migrationMissing: true` în loc să arunce o excepție.
 */

const MIGRATION_008_MISSING_MESSAGE =
  "Tabelele și funcțiile de administrare (Faza 15) nu au fost create încă în Supabase. Rulează fișierul supabase/migrations/008_admin_panel_and_audit.sql în Supabase SQL Editor și reîncearcă.";

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
      totalListings: 0,
      activeListings: 0,
      totalBookings: 0,
      openDisputes: 0,
      openReports: 0,
      totalCommissionRon: 0,
      totalGmvRon: 0,
    },
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
 * 2. Încarcă toate datele agregate pentru panoul `/admin` (KPI-uri, dispute,
 *    firme pentru verificare KYB, raportări anunțuri și jurnalul de audit).
 */
export async function getAdminDashboardDataAction(): Promise<AdminDashboardData> {
  const ctx = await requireAdminContext();
  if (!ctx.supabase || !ctx.isAdmin) {
    return buildEmptyAdminDashboardData(false, ctx.userId);
  }

  const supabase = ctx.supabase;

  // Rulăm interogările în paralel (echivalent cu `CompletableFuture.allOf` în Java)
  const [
    usersCountRes,
    listingsCountRes,
    activeListingsCountRes,
    bookingsCountRes,
    paymentsRes,
    disputesRes,
    companiesRes,
    reportsRes,
    auditLogsRes,
  ] = await Promise.all([
    supabase.from("profiles").select("id", { count: "exact", head: true }),
    supabase.from("listings").select("id", { count: "exact", head: true }),
    supabase
      .from("listings")
      .select("id", { count: "exact", head: true })
      .eq("status", "available"),
    supabase.from("bookings").select("id", { count: "exact", head: true }),
    supabase
      .from("payments")
      .select("rental_amount_ron, platform_fee_ron, total_charged_ron, payment_status"),
    supabase
      .from("disputes")
      .select(
        "id, booking_id, opened_by, reason, description, claimed_amount_ron, status, created_at, updated_at, bookings(booking_code)"
      )
      .order("created_at", { ascending: false })
      .limit(50),
    supabase
      .from("profiles")
      .select(
        "id, display_name, account_type, city, bio, avatar_url, phone_verified, kyb_verified, rating_avg, rating_count, created_at, updated_at, company_name, company_address, kyb_verified_at"
      )
      .eq("account_type", "company")
      .order("kyb_verified", { ascending: true })
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

  // Calcul KPI financiari (GMV și comision platformă) din plățile confirmate/eliberate/disputate
  let totalCommissionRon = 0;
  let totalGmvRon = 0;

  if (!paymentsRes.error && Array.isArray(paymentsRes.data)) {
    for (const row of paymentsRes.data) {
      const status = String(row.payment_status ?? "");
      if (status === "paid" || status === "released" || status === "disputed") {
        totalCommissionRon += Number(row.platform_fee_ron ?? 0) || 0;
        totalGmvRon += Number(row.rental_amount_ron ?? 0) || 0;
      }
    }
  }

  // Normalizare dispute + extragere `booking_code` din relația JOIN
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

  // Normalizare firme (conturi `account_type = 'company'`)
  const companies: Profile[] =
    !companiesRes.error && Array.isArray(companiesRes.data)
      ? companiesRes.data.map((row) => ({
          id: String(row.id),
          display_name: String(row.display_name ?? ""),
          account_type: String(row.account_type ?? "company") as AccountType,
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

  // Normalizare raportări anunțuri
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

  // Normalizare jurnal de audit administrativ
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

  const openDisputes = disputes.filter(
    (d) => d.status === "open" || d.status === "under_review"
  ).length;
  const openReports = reports.filter((r) => r.status === "open").length;

  return {
    authorized: true,
    currentUserId: ctx.userId,
    ...(migrationMissing ? { migrationMissing: true } : {}),
    kpis: {
      totalUsers: usersCountRes.count ?? 0,
      totalListings: listingsCountRes.count ?? 0,
      activeListings: activeListingsCountRes.count ?? 0,
      totalBookings: bookingsCountRes.count ?? 0,
      openDisputes,
      openReports,
      totalCommissionRon: roundRon(totalCommissionRon),
      totalGmvRon: roundRon(totalGmvRon),
    },
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
