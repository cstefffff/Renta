import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  Building2,
  CalendarCheck,
  CalendarDays,
  Clock,
  CreditCard,
  ExternalLink,
  Eye,
  FileText,
  Lock,
  MapPin,
  Package,
  Phone,
  ScrollText,
  ShieldAlert,
  ShieldCheck,
  Star,
  TrendingUp,
  User,
  Wallet,
} from "lucide-react";
import { getAdminUserInspectionDataAction } from "@/app/actions/admin";
import { getCategoryLabel } from "@/lib/constants/categories";
import type {
  AdminBookingRow,
  BookingStatus,
  CategorySlug,
  DepositStatus,
  EFacturaStatus,
  ListingStatus,
  PaymentStatus,
} from "@/lib/types/database";

export const dynamic = "force-dynamic";

/**
 * ============================================================================
 * Pagina Admin 360° Account Inspector (`/admin/utilizatori/[id]`)
 * ============================================================================
 *
 * Explicație pentru dezvoltatori C / Java:
 * - Această pagină este un **Async Server Component** în Next.js App Router
 *   (echivalentul unui Controller `@GetMapping("/admin/utilizatori/{id}")` din
 *   Spring MVC care populează un View imutabil pe server).
 * - Parametrul dinamic `id` din URL este primit ca `Promise<{ id: string }>`
 *   (convenția Next.js 15/16) și trimis către `getAdminUserInspectionDataAction(id)`.
 * - Toate verificările de securitate (`role === 'admin'` în `public.profile_private`)
 *   au loc pe server. Niciun formular de mutație nu este randat în această pagină:
 *   vizualizarea este 100% **Read-Only (View-Only)**, fără preluarea sesiunii
 *   utilizatorului (fără impersonare), conform principiilor GDPR Art. 6 & 32.
 */

interface AdminUserInspectionPageProps {
  params: Promise<{ id: string }>;
}

const LISTING_STATUS_META: Record<
  ListingStatus,
  { label: string; badgeClass: string }
> = {
  available: {
    label: "Activ",
    badgeClass: "bg-emerald-50 text-emerald-700 border-emerald-200",
  },
  unavailable: {
    label: "Pe pauză",
    badgeClass: "bg-amber-50 text-amber-700 border-amber-200",
  },
  archived: {
    label: "Arhivat",
    badgeClass: "bg-slate-100 text-ink-muted border-slate-200",
  },
};

const BOOKING_STATUS_META: Record<
  BookingStatus,
  { label: string; badgeClass: string }
> = {
  pending: {
    label: "În așteptare",
    badgeClass: "bg-amber-50 text-amber-700 border-amber-200",
  },
  confirmed: {
    label: "Confirmată",
    badgeClass: "bg-sky-50 text-sky-700 border-sky-200",
  },
  completed: {
    label: "Finalizată",
    badgeClass: "bg-emerald-50 text-emerald-700 border-emerald-200",
  },
  rejected: {
    label: "Respinsă",
    badgeClass: "bg-rose-50 text-rose-700 border-rose-200",
  },
  cancelled: {
    label: "Anulată",
    badgeClass: "bg-slate-100 text-ink-muted border-slate-200",
  },
};

const PAYMENT_STATUS_META: Record<
  PaymentStatus,
  { label: string; badgeClass: string }
> = {
  unpaid: {
    label: "Neplătită",
    badgeClass: "bg-slate-100 text-ink-muted border-slate-200",
  },
  authorized: {
    label: "Autorizată",
    badgeClass: "bg-amber-50 text-amber-700 border-amber-200",
  },
  paid: {
    label: "Escrow Activ",
    badgeClass: "bg-sky-50 text-sky-700 border-sky-200",
  },
  released: {
    label: "Eliberată (90%)",
    badgeClass: "bg-emerald-50 text-emerald-700 border-emerald-200",
  },
  refunded: {
    label: "Rambursată",
    badgeClass: "bg-slate-100 text-ink-muted border-slate-200",
  },
  disputed: {
    label: "În Dispută",
    badgeClass: "bg-rose-50 text-rose-700 border-rose-200",
  },
};

const DEPOSIT_STATUS_LABELS: Record<DepositStatus, string> = {
  none: "Fără garanție",
  held: "Garanție blocată",
  released: "Garanție eliberată",
  captured: "Garanție reținută",
};

const EFACTURA_STATUS_META: Record<
  EFacturaStatus,
  { label: string; badgeClass: string }
> = {
  not_applicable: {
    label: "B2C (Neaplicabil)",
    badgeClass: "bg-slate-100 text-ink-muted border-slate-200",
  },
  pending_anaf: {
    label: "În așteptare ANAF",
    badgeClass: "bg-amber-50 text-amber-700 border-amber-200",
  },
  submitted: {
    label: "Trimisă SPV",
    badgeClass: "bg-sky-50 text-sky-700 border-sky-200",
  },
  accepted: {
    label: "Acceptată ANAF",
    badgeClass: "bg-emerald-50 text-emerald-700 border-emerald-200",
  },
  rejected: {
    label: "Respinsă ANAF",
    badgeClass: "bg-rose-50 text-rose-700 border-rose-200",
  },
};

function formatDateRo(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("ro-RO", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

function formatDateTimeRo(iso: string): string {
  try {
    return new Date(iso).toLocaleString("ro-RO", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

/**
 * Tabel reutilizabil Read-Only pentru afișarea rezervărilor (fie ca Proprietar, fie ca Chiriaș).
 */
function BookingsReadOnlyTable({
  bookings,
  perspective,
  emptyText,
}: {
  bookings: AdminBookingRow[];
  perspective: "owner" | "renter";
  emptyText: string;
}) {
  if (bookings.length === 0) {
    return (
      <div className="p-6 rounded-xl border border-dashed border-slate-200 bg-slate-50/60 text-center text-xs text-ink-muted">
        {emptyText}
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200/90">
      <table className="w-full text-left border-collapse text-xs">
        <thead>
          <tr className="bg-slate-50 border-b border-slate-200 text-ink-muted font-mono uppercase text-[11px]">
            <th className="py-2.5 px-3">Cod</th>
            <th className="py-2.5 px-3">Obiect</th>
            <th className="py-2.5 px-3">
              {perspective === "owner" ? "Chiriaș (Partener)" : "Proprietar (Partener)"}
            </th>
            <th className="py-2.5 px-3">Perioadă</th>
            <th className="py-2.5 px-3">Sumă &amp; Comision</th>
            <th className="py-2.5 px-3">Status &amp; Escrow</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 bg-white">
          {bookings.map((b) => {
            const bookingMeta =
              BOOKING_STATUS_META[b.status] ?? BOOKING_STATUS_META.pending;
            const paymentMeta = b.payment_status
              ? PAYMENT_STATUS_META[b.payment_status]
              : null;
            const partnerName =
              perspective === "owner" ? b.renter_name : b.owner_name;

            return (
              <tr key={b.id} className="hover:bg-slate-50/70">
                <td className="py-2.5 px-3 font-mono font-bold text-ink whitespace-nowrap">
                  {b.booking_code}
                </td>
                <td className="py-2.5 px-3">
                  <Link
                    href={`/obiect/${b.listing_id}`}
                    className="inline-flex items-center gap-1 font-semibold text-ink hover:text-ochre hover:underline max-w-[200px]"
                  >
                    <span className="truncate">{b.listing_title}</span>
                    <ExternalLink
                      className="w-3 h-3 shrink-0 text-ink-muted"
                      strokeWidth={1.8}
                      aria-hidden="true"
                    />
                  </Link>
                  <div className="font-mono text-[10px] text-ink-muted">
                    {b.listing_code}
                  </div>
                </td>
                <td className="py-2.5 px-3 font-medium text-ink whitespace-nowrap">
                  {partnerName}
                </td>
                <td className="py-2.5 px-3 whitespace-nowrap font-mono text-[11px] text-ink-muted">
                  <div>
                    {formatDateRo(b.start_date)} – {formatDateRo(b.end_date)}
                  </div>
                  <div className="text-[10px]">
                    {b.total_days} {b.total_days === 1 ? "zi" : "zile"}
                  </div>
                </td>
                <td className="py-2.5 px-3 whitespace-nowrap">
                  <div className="font-mono font-bold text-ink">
                    {Number(b.total_price_ron).toFixed(0)} RON
                  </div>
                  <div className="font-mono text-[10px] text-ochre">
                    Com. 10%: {Number(b.platform_fee_ron).toFixed(0)} RON
                  </div>
                </td>
                <td className="py-2.5 px-3 whitespace-nowrap">
                  <div className="flex flex-col gap-1 items-start">
                    <span
                      className={`inline-flex px-2 py-0.5 rounded-full border text-[11px] font-semibold ${bookingMeta.badgeClass}`}
                    >
                      {bookingMeta.label}
                    </span>
                    {paymentMeta ? (
                      <span
                        className={`inline-flex px-2 py-0.5 rounded-full border text-[10px] font-semibold ${paymentMeta.badgeClass}`}
                      >
                        {paymentMeta.label}
                      </span>
                    ) : (
                      <span className="text-[10px] font-mono text-ink-muted">
                        Fără plată
                      </span>
                    )}
                    {b.deposit_status && b.deposit_status !== "none" && (
                      <span className="text-[10px] font-mono text-ink-muted">
                        {DEPOSIT_STATUS_LABELS[b.deposit_status]}
                      </span>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default async function AdminUserInspectionPage({
  params,
}: AdminUserInspectionPageProps) {
  const { id } = await params;
  const data = await getAdminUserInspectionDataAction(id);

  // 1. Garda de Autorizare (403 — Acces Restricționat)
  if (!data.authorized) {
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12">
        <div className="bg-white border border-slate-200/90 rounded-2xl p-6 sm:p-8 shadow-sm space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-50 border border-rose-200 text-rose-700 font-mono text-xs font-semibold">
              <ShieldAlert
                className="w-3.5 h-3.5 shrink-0"
                strokeWidth={1.8}
                aria-hidden="true"
              />
              <span>403 &bull; ACCES RESTRICȚIONAT</span>
            </span>
            <span className="font-mono text-xs text-ink-muted">
              NECESITĂ ROL: admin
            </span>
          </div>

          <div className="space-y-2">
            <h1 className="font-display text-2xl sm:text-3xl font-extrabold text-ink">
              Acces Restricționat (403) — Această pagină este disponibilă
              exclusiv administratorilor platformei RentA
            </h1>
            <p className="text-sm text-ink-muted leading-relaxed">
              Inspecția 360° a conturilor în mod Read-Only este protejată la
              nivel de server și politică RLS PostgreSQL. Dacă ești autentificat
              cu un cont standard, poți reveni la profilul tău sau la pagina
              principală.
            </p>
          </div>

          <div className="pt-2 flex flex-wrap items-center gap-3">
            <Link
              href="/profil"
              className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-ochre hover:bg-ochre/90 text-white text-xs font-semibold shadow-xs transition-colors"
            >
              <User className="w-4 h-4 shrink-0" strokeWidth={1.8} aria-hidden="true" />
              <span>Mergi la Profilul Meu</span>
            </Link>
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-ink text-xs font-semibold transition-colors"
            >
              <ArrowLeft
                className="w-4 h-4 shrink-0"
                strokeWidth={1.8}
                aria-hidden="true"
              />
              <span>Înapoi la Pagina Principală</span>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // 2. Utilizatorul căutat nu există în baza de date (404 logic în Panoul Admin)
  if (!data.user) {
    return (
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-12">
        <div className="bg-white border border-slate-200/90 rounded-2xl p-6 sm:p-8 shadow-sm space-y-5 text-center">
          <div className="w-12 h-12 rounded-2xl bg-slate-100 text-ink-muted flex items-center justify-center mx-auto">
            <User className="w-6 h-6" strokeWidth={1.8} aria-hidden="true" />
          </div>
          <div className="space-y-1.5">
            <h1 className="font-display text-2xl font-extrabold text-ink">
              Utilizatorul nu a fost găsit
            </h1>
            <p className="text-sm text-ink-muted">
              Contul cu identificatorul{" "}
              <code className="font-mono text-xs bg-slate-100 px-2 py-0.5 rounded">
                {id}
              </code>{" "}
              nu există sau a fost șters din baza de date.
            </p>
          </div>
          <div className="pt-2">
            <Link
              href="/admin"
              className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-ochre hover:bg-ochre/90 text-white text-xs font-semibold shadow-xs transition-colors"
            >
              <span>&larr; Înapoi la Panoul Admin</span>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const { user, stats, listings, bookingsAsOwner, bookingsAsRenter, invoices, auditLogs } =
    data;
  const isCompany = user.account_type === "company";

  return (
    <div className="max-w-[1400px] mx-auto px-4 sm:px-6 py-6 space-y-6">
      {/* 1. BANNER TOP: MOD VIZUALIZARE ADMIN (READ-ONLY) */}
      <div className="rounded-2xl bg-slate-900 text-white p-4 sm:p-5 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-ochre text-white font-mono text-[11px] font-bold tracking-wide">
              <Eye className="w-3.5 h-3.5 shrink-0" strokeWidth={1.8} aria-hidden="true" />
              <span>MOD VIZUALIZARE (READ-ONLY // GDPR ART. 6 &amp; 32)</span>
            </span>
            <span className="font-mono text-xs text-slate-300">
              360° Account Inspector
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-200 leading-relaxed">
            Vizualizezi contul utilizatorului în mod Read-Only pentru suport și
            verificare. Nicio modificare nu este aplicată automat în numele
            utilizatorului.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <Link
            href="/admin"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white border border-slate-700 text-xs font-semibold transition-colors"
          >
            <span>&larr; Înapoi la Admin</span>
          </Link>
          <Link
            href={`/profil/${user.id}`}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-ochre hover:bg-ochre/90 text-white text-xs font-semibold shadow-xs transition-colors"
          >
            <span>Vitrină Publică</span>
            <ExternalLink
              className="w-3.5 h-3.5 shrink-0"
              strokeWidth={1.8}
              aria-hidden="true"
            />
          </Link>
        </div>
      </div>

      {/* 2. HERO CARD UTILIZATOR — Aceeași estetică Modern Storefront ca în /profil */}
      <section className="relative overflow-hidden rounded-2xl bg-white border border-slate-200/90 p-5 sm:p-7 shadow-sm">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-20 -right-20 w-72 h-72 rounded-full bg-ochre-light/50 blur-3xl"
        />

        <div className="relative flex flex-col lg:flex-row lg:items-center justify-between gap-5">
          {/* Stânga: Avatar rounded-2xl + Identitate + Insigne */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-5">
            <div className="relative w-20 h-20 rounded-2xl border border-slate-200 bg-ochre-light/70 text-ochre ring-4 ring-slate-100 overflow-hidden flex items-center justify-center shrink-0 font-display text-2xl font-extrabold shadow-xs">
              {user.avatar_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={user.avatar_url}
                  alt={user.display_name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <span>
                  {(user.display_name || "R").slice(0, 2).toUpperCase()}
                </span>
              )}
            </div>

            <div className="space-y-2">
              {/* Rândul de insigne (Pills) */}
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-ochre-light text-ochre font-semibold">
                  {isCompany ? (
                    <Building2
                      className="w-3.5 h-3.5 shrink-0"
                      strokeWidth={1.8}
                      aria-hidden="true"
                    />
                  ) : (
                    <User
                      className="w-3.5 h-3.5 shrink-0"
                      strokeWidth={1.8}
                      aria-hidden="true"
                    />
                  )}
                  <span>{isCompany ? "Business" : "Personal"}</span>
                </span>

                {user.phone_verified ? (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 font-semibold">
                    <BadgeCheck
                      className="w-3.5 h-3.5 shrink-0"
                      strokeWidth={1.8}
                      aria-hidden="true"
                    />
                    <span>Telefon verificat</span>
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-50 text-amber-800 border border-amber-200 font-semibold">
                    <Clock
                      className="w-3.5 h-3.5 shrink-0"
                      strokeWidth={1.8}
                      aria-hidden="true"
                    />
                    <span>Telefon neverificat</span>
                  </span>
                )}

                {isCompany && (
                  <span
                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full border font-semibold ${
                      user.kyb_verified
                        ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                        : "bg-amber-50 text-amber-800 border-amber-200"
                    }`}
                  >
                    {user.kyb_verified ? (
                      <BadgeCheck
                        className="w-3.5 h-3.5 shrink-0"
                        strokeWidth={1.8}
                        aria-hidden="true"
                      />
                    ) : (
                      <Clock
                        className="w-3.5 h-3.5 shrink-0"
                        strokeWidth={1.8}
                        aria-hidden="true"
                      />
                    )}
                    <span>
                      {user.kyb_verified
                        ? "Business verificat ANAF"
                        : "KYB în așteptare"}
                    </span>
                  </span>
                )}

                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-slate-900 text-white font-mono text-[11px] font-semibold">
                  <ShieldCheck
                    className="w-3.5 h-3.5 shrink-0"
                    strokeWidth={1.8}
                    aria-hidden="true"
                  />
                  <span>Rol: {user.role.toUpperCase()}</span>
                </span>
              </div>

              {/* Numele utilizatorului / firmei */}
              <h1 className="font-display text-2xl sm:text-3xl font-extrabold text-ink tracking-tight">
                {user.company_name || user.display_name}
              </h1>

              {/* Meta informații: Oraș, Telefon privat, CUI, Data înregistrării */}
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-ink-muted">
                <span className="inline-flex items-center gap-1.5">
                  <MapPin
                    className="w-3.5 h-3.5 text-ochre shrink-0"
                    strokeWidth={1.8}
                    aria-hidden="true"
                  />
                  <strong className="text-ink font-medium">
                    {user.city || "Nespecificat"}
                  </strong>
                </span>

                <span className="inline-flex items-center gap-1.5">
                  <Phone
                    className="w-3.5 h-3.5 text-ochre shrink-0"
                    strokeWidth={1.8}
                    aria-hidden="true"
                  />
                  <span className="font-mono text-ink font-medium">
                    {user.phone || "Necompletat"}
                  </span>
                </span>

                {user.company_cui && (
                  <span className="font-mono text-[11px] bg-slate-100 text-ink px-2 py-0.5 rounded-md">
                    CUI: {user.company_cui}
                  </span>
                )}

                <span className="inline-flex items-center gap-1.5">
                  <CalendarDays
                    className="w-3.5 h-3.5 text-ink-muted shrink-0"
                    strokeWidth={1.8}
                    aria-hidden="true"
                  />
                  <span>Înregistrat la {formatDateRo(user.created_at)}</span>
                </span>
              </div>

              {user.bio && (
                <p className="text-xs text-ink-muted max-w-2xl leading-relaxed pt-0.5">
                  {user.bio}
                </p>
              )}
            </div>
          </div>

          {/* Dreapta: Insignă Read-Only & UUID scurt */}
          <div className="flex flex-col sm:items-end justify-center gap-2 shrink-0">
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 text-ink font-mono text-xs font-semibold">
              <Lock
                className="w-3.5 h-3.5 text-ochre shrink-0"
                strokeWidth={1.8}
                aria-hidden="true"
              />
              <span>Profil în Mod Read-Only</span>
            </span>
            <span className="font-mono text-[11px] text-ink-muted">
              UUID: {user.id}
            </span>
          </div>
        </div>
      </section>

      {/* 3. BANDA DE 4 CARDURI KPI — În stilul paginii /profil */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        {/* KPI 1: Inventar Complet */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-2xs flex items-center justify-between gap-3">
          <div className="space-y-1">
            <span className="text-xs text-ink-muted font-medium">
              Inventar Complet
            </span>
            <div className="font-display text-2xl font-extrabold text-ink">
              {stats.activeListings} active
            </div>
            <span className="block text-[11px] font-mono text-ink-muted">
              {stats.pausedListings} pauză &bull; {stats.archivedListings}{" "}
              arhivate din {stats.totalListings} total
            </span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-ochre-light text-ochre flex items-center justify-center shrink-0">
            <Package className="w-5 h-5" strokeWidth={1.8} aria-hidden="true" />
          </div>
        </div>

        {/* KPI 2: Încasări ca Proprietar (90%) */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-2xs flex items-center justify-between gap-3">
          <div className="space-y-1">
            <span className="text-xs text-ink-muted font-medium">
              Încasări ca Proprietar (90%)
            </span>
            <div className="font-display text-2xl font-extrabold text-ink">
              {stats.totalEarnedAsOwnerRon.toFixed(0)} RON
            </div>
            <span className="block text-[11px] text-ink-muted">
              din {stats.bookingsAsOwnerCount} rezervări primite
            </span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0">
            <TrendingUp
              className="w-5 h-5"
              strokeWidth={1.8}
              aria-hidden="true"
            />
          </div>
        </div>

        {/* KPI 3: Rulaj ca Chiriaș */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-2xs flex items-center justify-between gap-3">
          <div className="space-y-1">
            <span className="text-xs text-ink-muted font-medium">
              Rulaj ca Chiriaș
            </span>
            <div className="font-display text-2xl font-extrabold text-ink">
              {stats.totalSpentAsRenterRon.toFixed(0)} RON
            </div>
            <span className="block text-[11px] text-ink-muted">
              din {stats.bookingsAsRenterCount} închirieri plasate
            </span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-sky-50 text-sky-700 flex items-center justify-center shrink-0">
            <Wallet className="w-5 h-5" strokeWidth={1.8} aria-hidden="true" />
          </div>
        </div>

        {/* KPI 4: Reputație & Facturi */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-2xs flex items-center justify-between gap-3">
          <div className="space-y-1">
            <span className="text-xs text-ink-muted font-medium">
              Reputație &amp; Facturi
            </span>
            <div className="font-display text-2xl font-extrabold text-ink flex items-center gap-1.5">
              <span>
                {user.rating_avg !== null
                  ? Number(user.rating_avg).toFixed(1)
                  : "—"}
              </span>
              <span className="text-xs font-normal text-ink-muted">
                ({user.rating_count} recenzii)
              </span>
            </div>
            <span className="block text-[11px] font-mono text-ink-muted">
              {stats.invoicesCount} facturi fiscale
            </span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-500 flex items-center justify-center shrink-0">
            <Star
              className="w-5 h-5 fill-amber-400 text-amber-400"
              strokeWidth={1.8}
              aria-hidden="true"
            />
          </div>
        </div>
      </section>

      {/* 4. SECȚIUNI DETALIATE READ-ONLY */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* COLOANA STÂNGA (7 / 12): Fișa de Date a Contului + Toate Anunțurile Utilizatorului */}
        <div className="lg:col-span-7 space-y-6">
          {/* 4.A. Fișa de Date a Contului (Public + Privat GDPR — Read-Only) */}
          <section className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-sm space-y-5">
            <div className="border-b border-slate-100 pb-4 flex flex-wrap items-center justify-between gap-2">
              <div>
                <span className="inline-flex items-center gap-1 rounded-full bg-ochre-light px-2.5 py-0.5 text-[11px] font-semibold text-ochre">
                  <Lock
                    className="w-3 h-3 shrink-0"
                    strokeWidth={1.8}
                    aria-hidden="true"
                  />
                  <span>Inspecție Cont (Read-Only)</span>
                </span>
                <h2 className="font-display text-lg sm:text-xl font-bold text-ink mt-1">
                  Fișa de Date a Contului (Public + Privat GDPR — Read-Only)
                </h2>
              </div>
              <span className="font-mono text-[11px] text-ink-muted bg-slate-100 px-2.5 py-1 rounded-lg">
                profiles + profile_private
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div className="p-3.5 rounded-xl bg-slate-50/90 border border-slate-200/80 space-y-1">
                <span className="text-[11px] text-ink-muted font-medium">
                  Nume / Denumire
                </span>
                <div className="font-semibold text-ink text-sm">
                  {user.company_name || user.display_name || "—"}
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-50/90 border border-slate-200/80 space-y-1">
                <span className="text-[11px] text-ink-muted font-medium">
                  Tip Cont: Personal / Business
                </span>
                <div className="font-semibold text-ink text-sm">
                  {isCompany ? "Business (Persoană Juridică)" : "Personal (Persoană Fizică)"}
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-50/90 border border-slate-200/80 space-y-1">
                <span className="text-[11px] text-ink-muted font-medium">
                  Oraș
                </span>
                <div className="font-semibold text-ink text-sm">
                  {user.city || "Nespecificat"}
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-50/90 border border-slate-200/80 space-y-1">
                <span className="text-[11px] text-ink-muted font-medium">
                  Telefon Contact (Privat)
                </span>
                <div className="font-mono font-semibold text-ink text-sm">
                  {user.phone || "Necompletat"}
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-50/90 border border-slate-200/80 space-y-1">
                <span className="text-[11px] text-ink-muted font-medium">
                  CUI / CIF Firmă
                </span>
                <div className="font-mono font-semibold text-ink text-sm">
                  {user.company_cui || (isCompany ? "Necompletat" : "Nu se aplică (Cont Personal)")}
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-50/90 border border-slate-200/80 space-y-1">
                <span className="text-[11px] text-ink-muted font-medium">
                  Rol Sistem
                </span>
                <div className="font-mono font-bold text-ochre text-sm uppercase">
                  {user.role}
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-50/90 border border-slate-200/80 space-y-1">
                <span className="text-[11px] text-ink-muted font-medium">
                  Verificare Telefon OTP
                </span>
                <div className="font-semibold text-ink">
                  {user.phone_verified
                    ? "Verificat (OTP confirmat)"
                    : "Neverificat"}
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-50/90 border border-slate-200/80 space-y-1">
                <span className="text-[11px] text-ink-muted font-medium">
                  Verificare ANAF
                </span>
                <div className="font-semibold text-ink">
                  {isCompany
                    ? user.kyb_verified
                      ? `Verificat ANAF${user.kyb_verified_at ? ` (${formatDateRo(user.kyb_verified_at)})` : ""}`
                      : "În așteptare verificare KYB"
                    : "Nu se aplică (Cont Personal)"}
                </div>
              </div>

              <div className="sm:col-span-2 p-3.5 rounded-xl bg-slate-50/90 border border-slate-200/80 space-y-1">
                <span className="text-[11px] text-ink-muted font-medium">
                  UUID Cont
                </span>
                <div className="font-mono text-xs text-ink select-all break-all">
                  {user.id}
                </div>
              </div>

              {user.company_address && (
                <div className="sm:col-span-2 p-3.5 rounded-xl bg-slate-50/90 border border-slate-200/80 space-y-1">
                  <span className="text-[11px] text-ink-muted font-medium">
                    Sediu Social Firmă (ANAF)
                  </span>
                  <div className="text-xs text-ink">
                    {user.company_address}
                  </div>
                </div>
              )}

              <div className="sm:col-span-2 p-3.5 rounded-xl bg-slate-50/90 border border-slate-200/80 space-y-1">
                <span className="text-[11px] text-ink-muted font-medium">
                  Descriere &amp; Program Predare
                </span>
                <p className="text-xs text-ink leading-relaxed whitespace-pre-line">
                  {user.bio || "Utilizatorul nu a completat încă o descriere sau un program de predare."}
                </p>
              </div>
            </div>
          </section>

          {/* 4.B. Toate Anunțurile Utilizatorului (inclusiv unavailable & archived) */}
          <section className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-sm space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3.5">
              <div>
                <h2 className="font-display text-lg font-bold text-ink">
                  Toate Anunțurile Utilizatorului ({listings.length})
                </h2>
                <p className="text-xs text-ink-muted">
                  Inventar complet (include anunțurile active, puse pe pauză și
                  arhivate)
                </p>
              </div>
              <span className="font-mono text-xs text-ink-muted bg-slate-100 px-2.5 py-1 rounded-lg">
                {stats.activeListings} active / {stats.pausedListings} pauză /{" "}
                {stats.archivedListings} arhivate
              </span>
            </div>

            {listings.length === 0 ? (
              <div className="p-6 rounded-xl border border-dashed border-slate-200 bg-slate-50/60 text-center text-xs text-ink-muted">
                Acest utilizator nu are niciun anunț publicat sau arhivat în
                catalog.
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {listings.map((l) => {
                  const thumb = l.images?.[0]?.url || null;
                  const statusMeta =
                    LISTING_STATUS_META[l.status] ??
                    LISTING_STATUS_META.available;

                  return (
                    <div
                      key={l.id}
                      className="py-3.5 first:pt-0 last:pb-0 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    >
                      <div className="flex items-center gap-3.5 min-w-0">
                        <div className="w-14 h-14 rounded-xl bg-slate-100 overflow-hidden shrink-0 border border-slate-200/80 flex items-center justify-center">
                          {thumb ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={thumb}
                              alt={l.title}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <Package
                              className="w-5 h-5 text-slate-400"
                              strokeWidth={1.8}
                              aria-hidden="true"
                            />
                          )}
                        </div>

                        <div className="min-w-0 space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-mono text-[11px] font-bold text-ink bg-slate-100 px-2 py-0.5 rounded-md">
                              {l.catalog_code}
                            </span>
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded-full border text-[11px] font-semibold ${statusMeta.badgeClass}`}
                            >
                              {statusMeta.label}
                            </span>
                          </div>

                          <Link
                            href={`/obiect/${l.id}`}
                            className="font-display text-sm font-bold text-ink hover:text-ochre truncate block"
                          >
                            {l.title}
                          </Link>

                          <div className="text-xs text-ink-muted flex flex-wrap items-center gap-2">
                            <span>
                              {getCategoryLabel(l.category as CategorySlug)}
                            </span>
                            <span>&bull;</span>
                            <span>{l.city}</span>
                            <span>&bull;</span>
                            <strong className="font-mono text-ink">
                              {Number(l.price_per_day).toFixed(0)} RON / zi
                            </strong>
                            <span>&bull;</span>
                            <span className="font-mono text-[11px]">
                              Garanție: {Number(l.deposit_ron).toFixed(0)} RON
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <Link
                          href={`/obiect/${l.id}`}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-ochre-light text-ink hover:text-ochre text-xs font-semibold transition-colors"
                        >
                          <span>Vezi anunț</span>
                          <ArrowRight
                            className="w-3.5 h-3.5 shrink-0"
                            strokeWidth={1.8}
                            aria-hidden="true"
                          />
                        </Link>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>

        {/* COLOANA DREAPTA (5 / 12): Facturi Fiscale + Istoric Audit Admin */}
        <div className="lg:col-span-5 space-y-6">
          {/* 4.C. Facturi Fiscale ale Contului */}
          <section className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-3.5">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-ochre-light text-ochre flex items-center justify-center shrink-0">
                  <FileText
                    className="w-4 h-4"
                    strokeWidth={1.8}
                    aria-hidden="true"
                  />
                </div>
                <div>
                  <h2 className="font-display text-base font-bold text-ink">
                    Facturi Fiscale ({invoices.length})
                  </h2>
                  <p className="text-xs text-ink-muted">
                    Facturi de comision și RO e-Factura asociate contului
                  </p>
                </div>
              </div>
              <CreditCard
                className="w-4 h-4 text-ink-muted shrink-0"
                strokeWidth={1.8}
                aria-hidden="true"
              />
            </div>

            {invoices.length === 0 ? (
              <div className="p-5 rounded-xl border border-dashed border-slate-200 bg-slate-50/60 text-center text-xs text-ink-muted">
                Nu există facturi fiscale emise pentru acest cont.
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {invoices.map((inv) => {
                  const efMeta =
                    EFACTURA_STATUS_META[inv.efactura_status] ??
                    EFACTURA_STATUS_META.not_applicable;
                  return (
                    <div
                      key={inv.id}
                      className="py-3 first:pt-0 last:pb-0 flex items-center justify-between gap-3 text-xs"
                    >
                      <div className="space-y-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono font-bold text-ink">
                            {inv.invoice_number}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded-full border text-[10px] font-semibold ${efMeta.badgeClass}`}
                          >
                            {efMeta.label}
                          </span>
                        </div>
                        <div className="text-ink-muted truncate">
                          {inv.client_name} &bull;{" "}
                          <span className="font-mono">
                            {formatDateRo(inv.issued_at)}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2.5 shrink-0">
                        <span className="font-mono font-bold text-ink">
                          {Number(inv.total_ron).toFixed(2)} RON
                        </span>
                        <Link
                          href={`/profil/facturi/${inv.id}`}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-slate-200 bg-white hover:bg-ochre-light hover:text-ochre text-ink text-[11px] font-semibold transition-colors"
                        >
                          <span>Factură</span>
                          <ExternalLink
                            className="w-3 h-3 shrink-0"
                            strokeWidth={1.8}
                            aria-hidden="true"
                          />
                        </Link>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* 4.D. Istoric Audit Admin pentru acest Cont */}
          <section className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-3.5">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-slate-100 text-ink flex items-center justify-center shrink-0">
                  <ScrollText
                    className="w-4 h-4"
                    strokeWidth={1.8}
                    aria-hidden="true"
                  />
                </div>
                <div>
                  <h2 className="font-display text-base font-bold text-ink">
                    Istoric Audit Admin pentru acest Cont ({auditLogs.length})
                  </h2>
                  <p className="text-xs text-ink-muted">
                    Acțiuni administrative înregistrate în{" "}
                    <code className="font-mono">admin_audit_logs</code>
                  </p>
                </div>
              </div>
            </div>

            {auditLogs.length === 0 ? (
              <div className="p-5 rounded-xl border border-dashed border-slate-200 bg-slate-50/60 text-center text-xs text-ink-muted">
                Nicio intervenție administrativă înregistrată asupra acestui
                cont.
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {auditLogs.map((log) => (
                  <div
                    key={log.id}
                    className="py-3 first:pt-0 last:pb-0 space-y-1 text-xs"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono font-semibold text-ochre bg-ochre-light px-2 py-0.5 rounded-md">
                        {log.action}
                      </span>
                      <span className="font-mono text-[11px] text-ink-muted">
                        {formatDateTimeRo(log.created_at)}
                      </span>
                    </div>
                    {log.details && Object.keys(log.details).length > 0 && (
                      <div className="font-mono text-[11px] text-ink-muted bg-slate-50 p-2 rounded-lg border border-slate-200/70 break-all">
                        {JSON.stringify(log.details)}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>

      {/* 5. REZERVĂRI CA PROPRIETAR & REZERVĂRI CA CHIRIAȘ (2 Carduri Complete) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Card 1: Rezervări ca Proprietar */}
        <section className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-3.5">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0">
                <CalendarCheck
                  className="w-4 h-4"
                  strokeWidth={1.8}
                  aria-hidden="true"
                />
              </div>
              <div>
                <h2 className="font-display text-base font-bold text-ink">
                  Rezervări ca Proprietar ({bookingsAsOwner.length})
                </h2>
                <p className="text-xs text-ink-muted">
                  Cereri de închiriere primite pentru echipamentele proprii
                </p>
              </div>
            </div>
            <span className="font-mono text-xs font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg">
              90%: {stats.totalEarnedAsOwnerRon.toFixed(0)} RON
            </span>
          </div>

          <BookingsReadOnlyTable
            bookings={bookingsAsOwner}
            perspective="owner"
            emptyText="Utilizatorul nu a primit încă nicio rezervare în calitate de proprietar."
          />
        </section>

        {/* Card 2: Rezervări ca Chiriaș */}
        <section className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-3.5">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-sky-50 text-sky-700 flex items-center justify-center shrink-0">
                <CalendarDays
                  className="w-4 h-4"
                  strokeWidth={1.8}
                  aria-hidden="true"
                />
              </div>
              <div>
                <h2 className="font-display text-base font-bold text-ink">
                  Rezervări ca Chiriaș ({bookingsAsRenter.length})
                </h2>
                <p className="text-xs text-ink-muted">
                  Închirieri plasate de acest utilizator de la alți proprietari
                </p>
              </div>
            </div>
            <span className="font-mono text-xs font-semibold text-sky-700 bg-sky-50 px-2.5 py-1 rounded-lg">
              Rulaj: {stats.totalSpentAsRenterRon.toFixed(0)} RON
            </span>
          </div>

          <BookingsReadOnlyTable
            bookings={bookingsAsRenter}
            perspective="renter"
            emptyText="Utilizatorul nu a plasat încă nicio rezervare în calitate de chiriaș."
          />
        </section>
      </div>
    </div>
  );
}
