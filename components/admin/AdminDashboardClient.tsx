"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  Archive,
  ArrowRight,
  BadgeCheck,
  Building2,
  CalendarCheck,
  Check,
  CheckCircle2,
  Clock,
  Download,
  ExternalLink,
  Eye,
  FileText,
  LayoutDashboard,
  MapPin,
  Package,
  PauseCircle,
  Phone,
  RefreshCw,
  ScrollText,
  Search,
  Send,
  ShieldAlert,
  ShieldCheck,
  Star,
  TrendingUp,
  User,
  Users,
  Wallet,
  X,
  XCircle,
} from "lucide-react";
import {
  adminForceBookingStatusAction,
  adminModerateListingAction,
  adminResolveDisputeAction,
  adminSendSystemNotificationAction,
  adminSetUserRoleAction,
  adminVerifyCompanyAction,
} from "@/app/actions/admin";
import type {
  AdminBreakdownItem,
  AdminDashboardData,
  BookingStatus,
  DepositStatus,
  DisputeReason,
  DisputeStatus,
  EFacturaStatus,
  ListingReportStatus,
  ListingStatus,
  PaymentStatus,
  UserRole,
} from "@/lib/types/database";

/**
 * ============================================================================
 * RentA — Super-Admin Command Center (`/admin`) — Client Component
 * ============================================================================
 *
 * Explicație pentru dezvoltatori C / Java:
 * - Datele inițiale (`initialData`) sunt încărcate securizat pe server de
 *   `app/(dashboard)/admin/page.tsx` (echivalentul unui Model injectat într-un
 *   View în Spring MVC).
 * - Această componentă gestionează starea locală a UI-ului (tab activ, filtre
 *   de căutare, panou inline de notificare, busy state per acțiune) și invocă
 *   Server Actions protejate pe server (`app/actions/admin.ts`).
 * - Filtrarea tabelelor folosește `useMemo` (ca un cache în memorie recalculat
 *   doar când se schimbă lista sursă sau criteriul de căutare).
 * - După fiecare mutație reușită, apelăm `router.refresh()` pentru a sincroniza
 *   KPI-urile, tabelele și Jurnalul de Audit direct din PostgreSQL / Supabase.
 */
interface AdminDashboardClientProps {
  initialData: AdminDashboardData;
}

type AdminTab =
  | "overview"
  | "users"
  | "listings"
  | "bookings"
  | "moderation"
  | "audit";

type UserFilterSegment = "all" | "individual" | "company" | "admins";
type ListingFilterStatus = "all" | ListingStatus;

const DISPUTE_REASON_LABELS: Record<DisputeReason, string> = {
  damage: "Deteriorare obiect",
  missing_accessories: "Accesorii lipsă",
  late_return: "Întârziere returnare",
  not_as_described: "Neconform descrierii",
  other: "Alt motiv",
};

const DISPUTE_STATUS_META: Record<
  DisputeStatus,
  { label: string; badgeClass: string }
> = {
  open: {
    label: "Deschisă",
    badgeClass: "bg-rose-50 text-rose-700 border-rose-200",
  },
  under_review: {
    label: "În analiză",
    badgeClass: "bg-amber-50 text-amber-700 border-amber-200",
  },
  resolved_owner: {
    label: "Acordată Ofertantului",
    badgeClass: "bg-emerald-50 text-emerald-700 border-emerald-200",
  },
  resolved_renter: {
    label: "Rambursată Chiriașului",
    badgeClass: "bg-sky-50 text-sky-700 border-sky-200",
  },
  closed: {
    label: "Închisă",
    badgeClass: "bg-slate-100 text-ink-muted border-slate-200",
  },
};

const REPORT_STATUS_META: Record<
  ListingReportStatus,
  { label: string; badgeClass: string }
> = {
  open: {
    label: "Deschis",
    badgeClass: "bg-rose-50 text-rose-700 border-rose-200",
  },
  dismissed: {
    label: "Respins",
    badgeClass: "bg-slate-100 text-ink-muted border-slate-200",
  },
  action_taken: {
    label: "Măsură aplicată",
    badgeClass: "bg-emerald-50 text-emerald-700 border-emerald-200",
  },
};

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
    label: "Eliberată",
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

function formatRon(amount: number): string {
  return new Intl.NumberFormat("ro-RO", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(Number(amount) || 0);
}

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
 * Generează și descarcă un fișier CSV compatibil Excel (UTF-8 cu BOM)
 * direct în browser, fără a solicita serverul.
 */
function exportRowsToCsv(
  filename: string,
  headers: string[],
  rows: (string | number | boolean | null | undefined)[][]
) {
  const escapeCell = (
    value: string | number | boolean | null | undefined
  ): string => {
    const str = value === null || value === undefined ? "" : String(value);
    if (/[",\n\r;]/.test(str)) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const csvContent =
    "\uFEFF" +
    [
      headers.map(escapeCell).join(","),
      ...rows.map((row) => row.map(escapeCell).join(",")),
    ].join("\r\n");

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.setAttribute("download", filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function todayStamp(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Card reutilizabil pentru cele 3 diagrame de distribuție (CSS Progress Bars)
 * din tab-ul Overview.
 */
function BreakdownChartCard({
  title,
  subtitle,
  items,
  barColorClass,
}: {
  title: string;
  subtitle: string;
  items: AdminBreakdownItem[];
  barColorClass: string;
}) {
  const totalCount = items.reduce((acc, item) => acc + item.count, 0);

  return (
    <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-sm flex flex-col justify-between space-y-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="font-display font-bold text-sm text-ink">{title}</h3>
          <p className="text-xs text-ink-muted mt-0.5">{subtitle}</p>
        </div>
        <span className="font-mono text-[11px] font-semibold text-ink bg-slate-100 px-2 py-0.5 rounded-md">
          Total: {totalCount}
        </span>
      </div>

      {items.length === 0 ? (
        <div className="py-8 text-center text-xs text-ink-muted border border-dashed border-slate-200 rounded-xl bg-slate-50/50">
          Nu există încă date suficiente pentru această distribuție.
        </div>
      ) : (
        <div className="space-y-3">
          {items.slice(0, 8).map((item) => {
            const safePercent = Math.max(0, Math.min(100, item.percentage));
            return (
              <div key={item.label} className="space-y-1">
                <div className="flex items-center justify-between gap-2 text-xs">
                  <span className="font-medium text-ink truncate">
                    {item.label}
                  </span>
                  <span className="font-mono text-[11px] text-ink-muted shrink-0">
                    <strong className="text-ink">{item.count}</strong> (
                    {safePercent.toFixed(0)}%)
                  </span>
                </div>
                <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-300 ${barColorClass}`}
                    style={{ width: `${Math.max(safePercent, 2)}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function AdminDashboardClient({
  initialData,
}: AdminDashboardClientProps) {
  const router = useRouter();
  const [data, setData] = useState<AdminDashboardData>(initialData);
  const [activeTab, setActiveTab] = useState<AdminTab>("overview");
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [disputeNotes, setDisputeNotes] = useState<Record<string, string>>({});
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  // Stări de filtrare per tab
  const [userSearch, setUserSearch] = useState("");
  const [userSegment, setUserSegment] = useState<UserFilterSegment>("all");

  const [listingSearch, setListingSearch] = useState("");
  const [listingStatusFilter, setListingStatusFilter] =
    useState<ListingFilterStatus>("all");

  const [bookingSearch, setBookingSearch] = useState("");
  const [auditSearch, setAuditSearch] = useState("");

  // Stare pentru panoul inline de trimitere notificare oficială către un utilizator
  const [notifyTarget, setNotifyTarget] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [notifyTitle, setNotifyTitle] = useState("");
  const [notifyBody, setNotifyBody] = useState("");
  const [notifyUrl, setNotifyUrl] = useState("");

  // Sincronizăm starea locală când Server Component-ul trimite date noi după `router.refresh()`
  useEffect(() => {
    setData(initialData);
  }, [initialData]);

  const {
    kpis,
    users = [],
    allListings = [],
    allBookings = [],
    invoices = [],
    categoryBreakdown = [],
    cityBreakdown = [],
    bookingStatusBreakdown = [],
    disputes = [],
    reports = [],
    auditLogs = [],
    migrationMissing,
  } = data;

  const openModerationCount = kpis.openDisputes + kpis.openReports;

  // --- Liste filtrate cu `useMemo` ---
  const filteredUsers = useMemo(() => {
    const q = userSearch.trim().toLowerCase();
    return users.filter((u) => {
      if (userSegment === "individual" && u.account_type !== "individual") {
        return false;
      }
      if (userSegment === "company" && u.account_type !== "company") {
        return false;
      }
      if (
        userSegment === "admins" &&
        u.role !== "admin" &&
        u.role !== "moderator"
      ) {
        return false;
      }
      if (!q) return true;
      const haystack = [
        u.display_name,
        u.company_name ?? "",
        u.city,
        u.company_cui ?? "",
        u.role,
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [users, userSearch, userSegment]);

  const filteredListings = useMemo(() => {
    const q = listingSearch.trim().toLowerCase();
    return allListings.filter((item) => {
      if (
        listingStatusFilter !== "all" &&
        item.status !== listingStatusFilter
      ) {
        return false;
      }
      if (!q) return true;
      const haystack = [
        item.title,
        item.catalog_code,
        item.city,
        item.category,
        item.owner_name,
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [allListings, listingSearch, listingStatusFilter]);

  const filteredBookings = useMemo(() => {
    const q = bookingSearch.trim().toLowerCase();
    if (!q) return allBookings;
    return allBookings.filter((b) => {
      const haystack = [
        b.booking_code,
        b.listing_title,
        b.listing_code,
        b.renter_name,
        b.owner_name,
        b.status,
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [allBookings, bookingSearch]);

  const filteredAuditLogs = useMemo(() => {
    const q = auditSearch.trim().toLowerCase();
    if (!q) return auditLogs;
    return auditLogs.filter((log) => {
      const haystack = [
        log.action,
        log.target_type,
        log.target_id,
        log.admin_id,
        JSON.stringify(log.details ?? {}),
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [auditLogs, auditSearch]);

  // --- Handler 1: Rezolvare Dispută ---
  async function handleResolveDispute(
    disputeId: string,
    resolution: "resolved_owner" | "resolved_renter" | "closed"
  ) {
    setBusyKey(`dispute:${disputeId}:${resolution}`);
    setFeedback(null);
    try {
      const notes = disputeNotes[disputeId]?.trim() || undefined;
      const res = await adminResolveDisputeAction(disputeId, resolution, notes);
      if (res.success || res.ok) {
        setFeedback({
          type: "success",
          text: res.message || "Disputa a fost actualizată cu succes.",
        });
        router.refresh();
      } else {
        setFeedback({
          type: "error",
          text:
            res.error ||
            res.message ||
            "Nu am putut actualiza disputa selectată.",
        });
      }
    } catch {
      setFeedback({
        type: "error",
        text: "A apărut o eroare neașteptată la rezolvarea disputei.",
      });
    } finally {
      setBusyKey(null);
    }
  }

  // --- Handler 2: Aprobare / Revocare KYB Firmă B2C ---
  async function handleVerifyCompany(userId: string, approve: boolean) {
    setBusyKey(`company:${userId}`);
    setFeedback(null);
    try {
      const res = await adminVerifyCompanyAction(userId, approve);
      if (res.success || res.ok) {
        setFeedback({
          type: "success",
          text:
            res.message ||
            (approve
              ? "Firma a fost marcată ca verificată KYB."
              : "Verificarea KYB a fost revocată."),
        });
        router.refresh();
      } else {
        setFeedback({
          type: "error",
          text:
            res.error ||
            res.message ||
            "Nu am putut actualiza statusul KYB al firmei.",
        });
      }
    } catch {
      setFeedback({
        type: "error",
        text: "A apărut o eroare neașteptată la actualizarea KYB.",
      });
    } finally {
      setBusyKey(null);
    }
  }

  // --- Handler 3: Moderare Anunț (direct din tab Anunțuri sau din Rapoarte) ---
  async function handleModerateListing(
    listingId: string,
    newStatus: ListingStatus,
    reportId?: string,
    actionLabel = "moderate",
    notes?: string
  ) {
    setBusyKey(
      reportId
        ? `report:${reportId}:${actionLabel}`
        : `listing:${listingId}:${newStatus}`
    );
    setFeedback(null);
    try {
      const res = await adminModerateListingAction(
        listingId,
        newStatus,
        reportId,
        notes
      );
      if (res.success || res.ok) {
        setFeedback({
          type: "success",
          text: res.message || "Acțiunea de moderare a fost aplicată.",
        });
        router.refresh();
      } else {
        setFeedback({
          type: "error",
          text:
            res.error ||
            res.message ||
            "Nu am putut aplica acțiunea de moderare.",
        });
      }
    } catch {
      setFeedback({
        type: "error",
        text: "A apărut o eroare neașteptată la moderarea anunțului.",
      });
    } finally {
      setBusyKey(null);
    }
  }

  // --- Handler 4: Schimbare Rol Utilizator ---
  async function handleSetUserRole(targetUserId: string, newRole: UserRole) {
    setBusyKey(`role:${targetUserId}`);
    setFeedback(null);
    try {
      const res = await adminSetUserRoleAction(targetUserId, newRole);
      if (res.success || res.ok) {
        setFeedback({
          type: "success",
          text:
            res.message || `Rolul utilizatorului a fost schimbat în ${newRole}.`,
        });
        router.refresh();
      } else {
        setFeedback({
          type: "error",
          text:
            res.error ||
            res.message ||
            "Nu am putut actualiza rolul utilizatorului.",
        });
      }
    } catch {
      setFeedback({
        type: "error",
        text: "A apărut o eroare neașteptată la schimbarea rolului.",
      });
    } finally {
      setBusyKey(null);
    }
  }

  // --- Handler 5: Trimitere Notificare Oficială ---
  async function handleSendNotification(e: React.FormEvent) {
    e.preventDefault();
    if (!notifyTarget) return;

    const cleanTitle = notifyTitle.trim();
    const cleanBody = notifyBody.trim();
    const cleanUrl = notifyUrl.trim() || undefined;

    if (cleanTitle.length < 3 || cleanBody.length < 5) {
      setFeedback({
        type: "error",
        text: "Completează titlul (min. 3 caractere) și mesajul notificării (min. 5 caractere).",
      });
      return;
    }

    setBusyKey(`notify:${notifyTarget.id}`);
    setFeedback(null);
    try {
      const res = await adminSendSystemNotificationAction(
        notifyTarget.id,
        cleanTitle,
        cleanBody,
        cleanUrl
      );
      if (res.success || res.ok) {
        setFeedback({
          type: "success",
          text:
            res.message ||
            `Notificarea oficială a fost trimisă către ${notifyTarget.name}.`,
        });
        setNotifyTarget(null);
        setNotifyTitle("");
        setNotifyBody("");
        setNotifyUrl("");
        router.refresh();
      } else {
        setFeedback({
          type: "error",
          text:
            res.error ||
            res.message ||
            "Nu am putut trimite notificarea oficială.",
        });
      }
    } catch {
      setFeedback({
        type: "error",
        text: "A apărut o eroare neașteptată la trimiterea notificării.",
      });
    } finally {
      setBusyKey(null);
    }
  }

  // --- Handler 6: Intervenție Admin Status Rezervare ---
  async function handleForceBookingStatus(
    bookingId: string,
    newStatus: BookingStatus,
    notes: string
  ) {
    setBusyKey(`booking:${bookingId}:${newStatus}`);
    setFeedback(null);
    try {
      const res = await adminForceBookingStatusAction(
        bookingId,
        newStatus,
        notes
      );
      if (res.success || res.ok) {
        setFeedback({
          type: "success",
          text: res.message || "Statusul rezervării a fost actualizat.",
        });
        router.refresh();
      } else {
        setFeedback({
          type: "error",
          text:
            res.error ||
            res.message ||
            "Nu am putut actualiza statusul rezervării.",
        });
      }
    } catch {
      setFeedback({
        type: "error",
        text: "A apărut o eroare neașteptată la actualizarea rezervării.",
      });
    } finally {
      setBusyKey(null);
    }
  }

  // --- Export CSV Helpers ---
  function handleExportUsersCsv() {
    exportRowsToCsv(
      `renta-utilizatori-${todayStamp()}.csv`,
      [
        "ID",
        "Nume Afisat",
        "Firma",
        "CUI",
        "Tip Cont",
        "Rol",
        "Oras",
        "Telefon Verificat",
        "KYB Verificat",
        "Anunturi",
        "Rating Mediu",
        "Nr Recenzii",
        "Data Inregistrare",
      ],
      filteredUsers.map((u) => [
        u.id,
        u.display_name,
        u.company_name ?? "",
        u.company_cui ?? "",
        u.account_type === "company" ? "Business" : "Personal",
        u.role,
        u.city,
        u.phone_verified ? "Da" : "Nu",
        u.kyb_verified ? "Da" : "Nu",
        u.listings_count,
        u.rating_avg !== null ? u.rating_avg.toFixed(2) : "",
        u.rating_count,
        formatDateTimeRo(u.created_at),
      ])
    );
  }

  function handleExportListingsCsv() {
    exportRowsToCsv(
      `renta-anunturi-${todayStamp()}.csv`,
      [
        "Cod Catalog",
        "Titlu",
        "Categorie",
        "Oras",
        "Proprietar",
        "Tip Proprietar",
        "Pret/Zi (RON)",
        "Garantie (RON)",
        "Status",
        "Rating",
        "Creat La",
      ],
      filteredListings.map((l) => [
        l.catalog_code,
        l.title,
        l.category,
        l.city,
        l.owner_name,
        l.owner_type === "company" ? "Business" : "Personal",
        l.price_per_day,
        l.deposit_ron,
        LISTING_STATUS_META[l.status]?.label ?? l.status,
        l.rating_avg !== null ? l.rating_avg.toFixed(2) : "",
        formatDateTimeRo(l.created_at),
      ])
    );
  }

  function handleExportBookingsCsv() {
    exportRowsToCsv(
      `renta-tranzactii-${todayStamp()}.csv`,
      [
        "Cod Rezervare",
        "Cod Obiect",
        "Obiect",
        "Chirias",
        "Ofertant",
        "Data Start",
        "Data Final",
        "Zile",
        "Total (RON)",
        "Comision 10% (RON)",
        "Status Rezervare",
        "Status Plata",
        "Status Garantie",
        "Creat La",
      ],
      filteredBookings.map((b) => [
        b.booking_code,
        b.listing_code,
        b.listing_title,
        b.renter_name,
        b.owner_name,
        b.start_date,
        b.end_date,
        b.total_days,
        b.total_price_ron,
        b.platform_fee_ron,
        BOOKING_STATUS_META[b.status]?.label ?? b.status,
        b.payment_status
          ? PAYMENT_STATUS_META[b.payment_status]?.label ?? b.payment_status
          : "Neplătită",
        b.deposit_status
          ? DEPOSIT_STATUS_LABELS[b.deposit_status] ?? b.deposit_status
          : "—",
        formatDateTimeRo(b.created_at),
      ])
    );
  }

  const tabs: {
    id: AdminTab;
    label: string;
    icon: typeof LayoutDashboard;
    badge?: number;
    badgeAlert?: boolean;
  }[] = [
    {
      id: "overview",
      label: "Overview & Metrici",
      icon: LayoutDashboard,
    },
    {
      id: "users",
      label: `Utilizatori (${users.length})`,
      icon: Users,
    },
    {
      id: "listings",
      label: `Anunțuri (${allListings.length})`,
      icon: Package,
    },
    {
      id: "bookings",
      label: `Rezervări & Facturi (${allBookings.length})`,
      icon: CalendarCheck,
    },
    {
      id: "moderation",
      label: `Dispute & Rapoarte (${openModerationCount})`,
      icon: ShieldAlert,
      badge: openModerationCount > 0 ? openModerationCount : undefined,
      badgeAlert: openModerationCount > 0,
    },
    {
      id: "audit",
      label: `Audit Log (${auditLogs.length})`,
      icon: ScrollText,
    },
  ];

  return (
    <div className="max-w-[1440px] mx-auto px-4 sm:px-6 py-6 space-y-6">
      {/* Antet Super-Admin Command Center */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-sm flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-ochre-light text-ochre font-semibold text-xs">
              <ShieldCheck
                className="w-3.5 h-3.5 shrink-0"
                strokeWidth={1.8}
                aria-hidden="true"
              />
              <span>Super-Admin Command Center</span>
            </span>
            <span className="font-mono text-xs text-ink-muted bg-slate-100 px-2.5 py-1 rounded-lg">
              #ADMIN-OPS
            </span>
            {openModerationCount > 0 && (
              <button
                type="button"
                onClick={() => setActiveTab("moderation")}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-rose-50 border border-rose-200 text-rose-700 font-semibold text-xs hover:bg-rose-100 transition-colors"
              >
                <ShieldAlert
                  className="w-3.5 h-3.5 shrink-0"
                  strokeWidth={1.8}
                  aria-hidden="true"
                />
                <span>{openModerationCount} alerte active</span>
              </button>
            )}
          </div>
          <h1 className="font-display text-2xl sm:text-3xl font-extrabold text-ink">
            Centru de Comandă Operațională RentA
          </h1>
          <p className="text-sm text-ink-muted">
            Control complet asupra utilizatorilor, catalogului, fluxului
            financiar Escrow, facturării SRL și moderării platformei.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => router.refresh()}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-ink transition-colors"
          >
            <RefreshCw
              className="w-3.5 h-3.5 shrink-0"
              strokeWidth={1.8}
              aria-hidden="true"
            />
            <span>Reîmprospătează</span>
          </button>
          <Link
            href="/catalog"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-100 hover:bg-ochre-light text-xs font-semibold text-ink hover:text-ochre transition-colors"
          >
            <span>Catalog Public</span>
            <ExternalLink
              className="w-3.5 h-3.5 shrink-0"
              strokeWidth={1.8}
              aria-hidden="true"
            />
          </Link>
        </div>
      </div>

      {/* Avertisment dacă migrația 008 nu a fost rulată încă în Supabase */}
      {migrationMissing && (
        <div className="bg-amber-50 border border-amber-300 rounded-2xl p-5 space-y-2.5">
          <div className="flex items-center gap-2 text-amber-900 font-display font-bold text-sm">
            <AlertTriangle
              className="w-4 h-4 shrink-0 text-amber-700"
              strokeWidth={1.8}
              aria-hidden="true"
            />
            <span>
              Migrația SQL pentru Panoul Admin lipsește din baza de date
            </span>
          </div>
          <p className="text-xs text-amber-900/90 leading-relaxed">
            Tabelele{" "}
            <code className="font-mono font-semibold">admin_audit_logs</code>{" "}
            și/sau{" "}
            <code className="font-mono font-semibold">listing_reports</code> nu
            au fost detectate în Supabase. Rulează fișierul de migrație de mai
            jos în <strong>Supabase SQL Editor</strong>, apoi reîncarcă pagina:
          </p>
          <div className="bg-white/90 border border-amber-200 rounded-xl px-4 py-2.5 font-mono text-xs text-ink select-all">
            supabase/migrations/008_admin_panel_and_audit.sql
          </div>
        </div>
      )}

      {/* Banner feedback acțiuni */}
      {feedback && (
        <div
          role="status"
          className={`rounded-2xl border px-4 py-3 text-xs font-semibold flex items-center justify-between gap-3 ${
            feedback.type === "success"
              ? "bg-emerald-50 border-emerald-200 text-emerald-800"
              : "bg-rose-50 border-rose-200 text-rose-700"
          }`}
        >
          <span className="inline-flex items-center gap-2">
            {feedback.type === "success" ? (
              <CheckCircle2
                className="w-4 h-4 shrink-0"
                strokeWidth={1.8}
                aria-hidden="true"
              />
            ) : (
              <AlertTriangle
                className="w-4 h-4 shrink-0"
                strokeWidth={1.8}
                aria-hidden="true"
              />
            )}
            <span>{feedback.text}</span>
          </span>
          <button
            type="button"
            onClick={() => setFeedback(null)}
            className="inline-flex items-center gap-1 text-xs underline opacity-80 hover:opacity-100 shrink-0"
          >
            <X className="w-3.5 h-3.5" strokeWidth={1.8} aria-hidden="true" />
            <span>Închide</span>
          </button>
        </div>
      )}

      {/* Container Principal cu 6 Tab-uri */}
      <div className="bg-white border border-slate-200/90 rounded-2xl shadow-sm overflow-hidden">
        {/* Bara de navigare Tab-uri */}
        <div
          role="tablist"
          aria-label="Secțiuni Command Center RentA"
          className="flex flex-wrap items-center gap-1.5 p-3 border-b border-slate-200 bg-slate-50/70"
        >
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => setActiveTab(tab.id)}
                className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all ${
                  isActive
                    ? "bg-ochre text-white shadow-xs"
                    : "bg-white text-ink-muted hover:text-ink hover:bg-slate-100 border border-slate-200/80"
                }`}
              >
                <Icon
                  className="w-3.5 h-3.5 shrink-0"
                  strokeWidth={1.8}
                  aria-hidden="true"
                />
                <span>{tab.label}</span>
                {tab.badgeAlert && !isActive && (
                  <span className="inline-block w-2 h-2 rounded-full bg-rose-500" />
                )}
              </button>
            );
          })}
        </div>

        {/* Conținut Tab Activ */}
        <div className="p-5 sm:p-6">
          {/* ==============================================================
              TAB 1: OVERVIEW & METRICI (IMPLICIT)
              ============================================================== */}
          {activeTab === "overview" && (
            <div className="space-y-6">
              {/* 8 Carduri KPI (2 rânduri x 4 coloane pe desktop xl) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                {/* KPI 1: GMV Total & Comisioane (10%) */}
                <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-sm space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-medium text-ink-muted">
                      GMV Total
                    </span>
                    <span className="p-1.5 rounded-lg bg-ochre-light text-ochre">
                      <TrendingUp
                        className="w-4 h-4"
                        strokeWidth={1.8}
                        aria-hidden="true"
                      />
                    </span>
                  </div>
                  <div className="font-display text-2xl font-extrabold text-ink">
                    {formatRon(kpis.totalGmvRon)}{" "}
                    <span className="text-sm font-semibold text-ink-muted">
                      RON
                    </span>
                  </div>
                  <div className="text-xs text-ink-muted flex items-center justify-between pt-2 border-t border-slate-100">
                    <span>Comisioane RentA (10%)</span>
                    <strong className="font-mono text-ochre font-semibold">
                      {formatRon(kpis.totalCommissionRon)} RON
                    </strong>
                  </div>
                </div>

                {/* KPI 2: Fonduri în Escrow + Valoare Medie (AOV) */}
                <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-sm space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-medium text-ink-muted">
                      Fonduri în Escrow
                    </span>
                    <span className="p-1.5 rounded-lg bg-sky-50 text-sky-700">
                      <Wallet
                        className="w-4 h-4"
                        strokeWidth={1.8}
                        aria-hidden="true"
                      />
                    </span>
                  </div>
                  <div className="font-display text-2xl font-extrabold text-ink">
                    {formatRon(kpis.escrowHeldRon)}{" "}
                    <span className="text-sm font-semibold text-ink-muted">
                      RON
                    </span>
                  </div>
                  <div className="text-xs text-ink-muted flex items-center justify-between pt-2 border-t border-slate-100">
                    <span>Valoare Medie (AOV)</span>
                    <strong className="font-mono text-ink font-semibold">
                      {formatRon(kpis.averageBookingValueRon)} RON
                    </strong>
                  </div>
                </div>

                {/* KPI 3: Utilizatori (Personal vs Business + Verificări) */}
                <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-sm space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-medium text-ink-muted">
                      Utilizatori
                    </span>
                    <span className="p-1.5 rounded-lg bg-slate-100 text-ink">
                      <Users
                        className="w-4 h-4"
                        strokeWidth={1.8}
                        aria-hidden="true"
                      />
                    </span>
                  </div>
                  <div className="flex items-baseline justify-between gap-2">
                    <div className="font-display text-2xl font-extrabold text-ink">
                      {kpis.totalUsers}
                    </div>
                    <div className="font-mono text-[11px] text-ink-muted">
                      {kpis.personalUsers} Pers. / {kpis.businessUsers} Bus.
                    </div>
                  </div>
                  <div className="text-xs text-ink-muted flex items-center justify-between pt-2 border-t border-slate-100">
                    <span className="inline-flex items-center gap-1">
                      <Phone
                        className="w-3 h-3 text-emerald-600"
                        strokeWidth={1.8}
                        aria-hidden="true"
                      />
                      <span>Tel: {kpis.verifiedPhones}</span>
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <BadgeCheck
                        className="w-3 h-3 text-ochre"
                        strokeWidth={1.8}
                        aria-hidden="true"
                      />
                      <span>KYB: {kpis.verifiedBusinesses}</span>
                    </span>
                  </div>
                </div>

                {/* KPI 4: Anunțuri (Active / Pe pauză / Arhivate) */}
                <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-sm space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-medium text-ink-muted">
                      Anunțuri Catalog
                    </span>
                    <span className="p-1.5 rounded-lg bg-emerald-50 text-emerald-700">
                      <Package
                        className="w-4 h-4"
                        strokeWidth={1.8}
                        aria-hidden="true"
                      />
                    </span>
                  </div>
                  <div className="font-display text-2xl font-extrabold text-ink">
                    {kpis.totalListings}
                  </div>
                  <div className="text-[11px] font-mono text-ink-muted flex items-center justify-between gap-2 pt-2 border-t border-slate-100">
                    <span className="text-emerald-700 font-semibold">
                      Active: {kpis.activeListings}
                    </span>
                    <span className="text-amber-700">
                      Pauză: {kpis.pausedListings}
                    </span>
                    <span>Arh.: {kpis.archivedListings}</span>
                  </div>
                </div>

                {/* KPI 5: Rezervări (Finalizate / Active / Conversie %) */}
                <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-sm space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-medium text-ink-muted">
                      Rezervări
                    </span>
                    <span className="p-1.5 rounded-lg bg-indigo-50 text-indigo-700">
                      <CalendarCheck
                        className="w-4 h-4"
                        strokeWidth={1.8}
                        aria-hidden="true"
                      />
                    </span>
                  </div>
                  <div className="flex items-baseline justify-between gap-2">
                    <div className="font-display text-2xl font-extrabold text-ink">
                      {kpis.totalBookings}
                    </div>
                    <span className="font-mono text-[11px] px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 font-semibold">
                      Conv. {kpis.conversionRatePercent}%
                    </span>
                  </div>
                  <div className="text-xs text-ink-muted flex items-center justify-between pt-2 border-t border-slate-100">
                    <span>
                      Finalizate:{" "}
                      <strong className="font-mono text-ink">
                        {kpis.completedBookings}
                      </strong>
                    </span>
                    <span>
                      Active:{" "}
                      <strong className="font-mono text-ink">
                        {kpis.activeBookings}
                      </strong>
                    </span>
                  </div>
                </div>

                {/* KPI 6: Facturi SRL Emise */}
                <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-sm space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-medium text-ink-muted">
                      Facturi SRL Emise
                    </span>
                    <span className="p-1.5 rounded-lg bg-slate-100 text-ink">
                      <FileText
                        className="w-4 h-4"
                        strokeWidth={1.8}
                        aria-hidden="true"
                      />
                    </span>
                  </div>
                  <div className="font-display text-2xl font-extrabold text-ink">
                    {kpis.totalInvoices}
                  </div>
                  <div className="text-xs flex items-center justify-between pt-2 border-t border-slate-100">
                    <span className="text-ink-muted">Evidență RO e-Factura</span>
                    <button
                      type="button"
                      onClick={() => setActiveTab("bookings")}
                      className="inline-flex items-center gap-1 font-semibold text-ochre hover:underline"
                    >
                      <span>Vezi facturi</span>
                      <ArrowRight
                        className="w-3 h-3"
                        strokeWidth={1.8}
                        aria-hidden="true"
                      />
                    </button>
                  </div>
                </div>

                {/* KPI 7: Rating Mediu Platformă */}
                <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-sm space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-medium text-ink-muted">
                      Rating Mediu Platformă
                    </span>
                    <span className="p-1.5 rounded-lg bg-amber-50 text-amber-500">
                      <Star
                        className="w-4 h-4 fill-amber-400 text-amber-500"
                        strokeWidth={1.8}
                        aria-hidden="true"
                      />
                    </span>
                  </div>
                  <div className="flex items-baseline gap-1.5">
                    <span className="font-display text-2xl font-extrabold text-ink">
                      {kpis.avgPlatformRating !== null
                        ? kpis.avgPlatformRating.toFixed(2)
                        : "—"}
                    </span>
                    <span className="text-xs font-mono text-ink-muted">
                      / 5.00
                    </span>
                  </div>
                  <div className="text-xs text-ink-muted flex items-center justify-between pt-2 border-t border-slate-100">
                    <span>Calitate recenzii</span>
                    <span className="font-mono text-[11px] font-semibold text-amber-700">
                      {kpis.avgPlatformRating !== null
                        ? "Activ"
                        : "Fără recenzii"}
                    </span>
                  </div>
                </div>

                {/* KPI 8: Alertă Operațională */}
                <div
                  className={`border rounded-2xl p-5 shadow-sm space-y-2.5 ${
                    openModerationCount > 0
                      ? "bg-rose-50/40 border-rose-200"
                      : "bg-white border-slate-200/90"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-medium text-ink-muted">
                      Alertă Operațională
                    </span>
                    <span
                      className={`p-1.5 rounded-lg ${
                        openModerationCount > 0
                          ? "bg-rose-100 text-rose-700"
                          : "bg-emerald-50 text-emerald-700"
                      }`}
                    >
                      <ShieldAlert
                        className="w-4 h-4"
                        strokeWidth={1.8}
                        aria-hidden="true"
                      />
                    </span>
                  </div>
                  <div className="flex items-baseline justify-between gap-2">
                    <div className="font-display text-2xl font-extrabold text-ink">
                      {openModerationCount}
                    </div>
                    <button
                      type="button"
                      onClick={() => setActiveTab("moderation")}
                      className={`font-mono text-[11px] px-2 py-0.5 rounded-md font-semibold ${
                        openModerationCount > 0
                          ? "bg-rose-100 text-rose-700 hover:bg-rose-200"
                          : "bg-emerald-50 text-emerald-700"
                      }`}
                    >
                      {openModerationCount > 0 ? "MODERARE" : "CURAT"}
                    </button>
                  </div>
                  <div className="text-xs text-ink-muted flex items-center justify-between pt-2 border-t border-slate-200/60">
                    <span>
                      Dispute:{" "}
                      <strong className="font-mono text-ink">
                        {kpis.openDisputes}
                      </strong>
                    </span>
                    <span>
                      Rapoarte:{" "}
                      <strong className="font-mono text-ink">
                        {kpis.openReports}
                      </strong>
                    </span>
                  </div>
                </div>
              </div>

              {/* 3 Diagrame Vizuale Curate (CSS Progress Bars) */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                <BreakdownChartCard
                  title="Distribuție pe Categorii"
                  subtitle="Ponderea anunțurilor active și arhivate per categorie"
                  items={categoryBreakdown}
                  barColorClass="bg-ochre"
                />
                <BreakdownChartCard
                  title="Distribuție pe Orașe"
                  subtitle="Acoperirea geografică a catalogului RentA"
                  items={cityBreakdown}
                  barColorClass="bg-sky-600"
                />
                <BreakdownChartCard
                  title="Status Rezervări"
                  subtitle="Conversia fluxului de închiriere pe stări"
                  items={bookingStatusBreakdown}
                  barColorClass="bg-indigo-600"
                />
              </div>
            </div>
          )}

          {/* ==============================================================
              TAB 2: UTILIZATORI (Căutare, Filtre, Roluri, KYB, Notifică, CSV)
              ============================================================== */}
          {activeTab === "users" && (
            <div className="space-y-4">
              {/* Bară controale & filtrare */}
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2 flex-1">
                  <div className="relative flex-1 min-w-[220px] max-w-sm">
                    <Search
                      className="w-4 h-4 text-ink-muted absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                      strokeWidth={1.8}
                      aria-hidden="true"
                    />
                    <input
                      type="text"
                      value={userSearch}
                      onChange={(e) => setUserSearch(e.target.value)}
                      placeholder="Caută după nume, firmă, CUI sau oraș..."
                      className="catalog-input pl-9 text-xs py-2"
                    />
                  </div>

                  <div className="inline-flex items-center rounded-xl border border-slate-200 bg-slate-50 p-1 gap-1">
                    {(
                      [
                        { id: "all", label: "Toți" },
                        { id: "individual", label: "Personal" },
                        { id: "company", label: "Business" },
                        { id: "admins", label: "Admini" },
                      ] as const
                    ).map((seg) => (
                      <button
                        key={seg.id}
                        type="button"
                        onClick={() => setUserSegment(seg.id)}
                        className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors ${
                          userSegment === seg.id
                            ? "bg-white text-ink shadow-xs"
                            : "text-ink-muted hover:text-ink"
                        }`}
                      >
                        {seg.label}
                      </button>
                    ))}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleExportUsersCsv}
                  className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-ink transition-colors shrink-0"
                >
                  <Download
                    className="w-3.5 h-3.5 shrink-0"
                    strokeWidth={1.8}
                    aria-hidden="true"
                  />
                  <span>Export CSV Utilizatori</span>
                </button>
              </div>

              {/* Panou inline pentru trimitere notificare oficială */}
              {notifyTarget && (
                <form
                  onSubmit={handleSendNotification}
                  className="p-4 rounded-xl border border-ochre/30 bg-ochre-light/40 space-y-3"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 text-xs font-bold text-ink">
                      <Send
                        className="w-4 h-4 text-ochre shrink-0"
                        strokeWidth={1.8}
                        aria-hidden="true"
                      />
                      <span>
                        Trimite notificare oficială către{" "}
                        <span className="text-ochre">{notifyTarget.name}</span>
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setNotifyTarget(null)}
                      className="text-ink-muted hover:text-ink p-1 rounded-lg"
                      aria-label="Închide formular notificare"
                    >
                      <X
                        className="w-4 h-4"
                        strokeWidth={1.8}
                        aria-hidden="true"
                      />
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <input
                      type="text"
                      value={notifyTitle}
                      onChange={(e) => setNotifyTitle(e.target.value)}
                      placeholder="Titlu notificare (ex: Verificare cont finalizată)"
                      required
                      maxLength={120}
                      className="catalog-input text-xs py-2"
                    />
                    <input
                      type="text"
                      value={notifyUrl}
                      onChange={(e) => setNotifyUrl(e.target.value)}
                      placeholder="Link acțiune opțional (ex: /profil)"
                      maxLength={200}
                      className="catalog-input text-xs py-2"
                    />
                  </div>

                  <textarea
                    value={notifyBody}
                    onChange={(e) => setNotifyBody(e.target.value)}
                    placeholder="Mesajul complet pe care îl va primi utilizatorul în centrul de notificări..."
                    required
                    rows={2}
                    maxLength={600}
                    className="catalog-input text-xs py-2"
                  />

                  <div className="flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setNotifyTarget(null)}
                      className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-ink hover:bg-slate-50"
                    >
                      Anulează
                    </button>
                    <button
                      type="submit"
                      disabled={busyKey === `notify:${notifyTarget.id}`}
                      className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-ochre hover:bg-ochre-hover text-white text-xs font-semibold transition-colors disabled:opacity-50"
                    >
                      <Send
                        className="w-3.5 h-3.5 shrink-0"
                        strokeWidth={1.8}
                        aria-hidden="true"
                      />
                      <span>
                        {busyKey === `notify:${notifyTarget.id}`
                          ? "Se trimite..."
                          : "Trimite Notificare"}
                      </span>
                    </button>
                  </div>
                </form>
              )}

              {/* Tabel Utilizatori */}
              {filteredUsers.length === 0 ? (
                <div className="p-8 rounded-xl border border-dashed border-slate-200 bg-slate-50/60 text-center text-sm text-ink-muted">
                  Niciun utilizator nu corespunde filtrelor selectate.
                </div>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-slate-200/90">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-ink-muted font-mono uppercase text-[11px]">
                        <th className="py-3 px-3.5">Utilizator &amp; Tip</th>
                        <th className="py-3 px-3">Oraș</th>
                        <th className="py-3 px-3">Verificări</th>
                        <th className="py-3 px-3 text-center">Anunțuri</th>
                        <th className="py-3 px-3">Rating</th>
                        <th className="py-3 px-3">Rol Sistem</th>
                        <th className="py-3 px-3.5 text-right">Acțiuni</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                      {filteredUsers.map((u) => {
                        const isSelf = u.id === data.currentUserId;
                        const isBusiness = u.account_type === "company";
                        const isRoleBusy = busyKey === `role:${u.id}`;
                        const isKybBusy = busyKey === `company:${u.id}`;

                        return (
                          <tr key={u.id} className="hover:bg-slate-50/70">
                            <td className="py-3 px-3.5">
                              <div className="flex items-start gap-2.5">
                                <span
                                  className={`p-1.5 rounded-lg shrink-0 mt-0.5 ${
                                    isBusiness
                                      ? "bg-ochre-light text-ochre"
                                      : "bg-slate-100 text-ink-muted"
                                  }`}
                                >
                                  {isBusiness ? (
                                    <Building2
                                      className="w-3.5 h-3.5"
                                      strokeWidth={1.8}
                                      aria-hidden="true"
                                    />
                                  ) : (
                                    <User
                                      className="w-3.5 h-3.5"
                                      strokeWidth={1.8}
                                      aria-hidden="true"
                                    />
                                  )}
                                </span>
                                <div className="min-w-0">
                                  <div className="font-semibold text-ink truncate max-w-[220px]">
                                    {u.company_name || u.display_name}
                                    {isSelf && (
                                      <span className="ml-1.5 font-mono text-[10px] px-1.5 py-0.5 rounded bg-ochre-light text-ochre">
                                        TU
                                      </span>
                                    )}
                                  </div>
                                  <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-ink-muted mt-0.5">
                                    <span>
                                      {isBusiness ? "Business" : "Personal"}
                                    </span>
                                    {u.company_cui && (
                                      <span className="font-mono text-[10px] bg-slate-100 px-1.5 py-0.5 rounded">
                                        CUI: {u.company_cui}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </td>

                            <td className="py-3 px-3 whitespace-nowrap text-ink-muted">
                              <span className="inline-flex items-center gap-1">
                                <MapPin
                                  className="w-3.5 h-3.5 shrink-0"
                                  strokeWidth={1.8}
                                  aria-hidden="true"
                                />
                                <span>{u.city || "—"}</span>
                              </span>
                            </td>

                            <td className="py-3 px-3 whitespace-nowrap">
                              <div className="flex flex-wrap items-center gap-1.5">
                                <span
                                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[11px] font-semibold ${
                                    u.phone_verified
                                      ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                                      : "bg-slate-50 border-slate-200 text-ink-muted"
                                  }`}
                                >
                                  <Phone
                                    className="w-3 h-3 shrink-0"
                                    strokeWidth={1.8}
                                    aria-hidden="true"
                                  />
                                  <span>
                                    {u.phone_verified ? "Tel OK" : "Fără tel"}
                                  </span>
                                </span>

                                {isBusiness && (
                                  <span
                                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[11px] font-semibold ${
                                      u.kyb_verified
                                        ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                                        : "bg-amber-50 border-amber-200 text-amber-700"
                                    }`}
                                  >
                                    {u.kyb_verified ? (
                                      <BadgeCheck
                                        className="w-3 h-3 shrink-0"
                                        strokeWidth={1.8}
                                        aria-hidden="true"
                                      />
                                    ) : (
                                      <Clock
                                        className="w-3 h-3 shrink-0"
                                        strokeWidth={1.8}
                                        aria-hidden="true"
                                      />
                                    )}
                                    <span>
                                      {u.kyb_verified ? "KYB OK" : "KYB Pending"}
                                    </span>
                                  </span>
                                )}
                              </div>
                            </td>

                            <td className="py-3 px-3 text-center font-mono font-semibold text-ink">
                              {u.listings_count}
                            </td>

                            <td className="py-3 px-3 whitespace-nowrap">
                              {u.rating_avg !== null ? (
                                <span className="inline-flex items-center gap-1 font-mono text-ink font-semibold">
                                  <Star
                                    className="w-3.5 h-3.5 fill-amber-400 text-amber-500 shrink-0"
                                    strokeWidth={1.8}
                                    aria-hidden="true"
                                  />
                                  <span>{u.rating_avg.toFixed(1)}</span>
                                  <span className="text-ink-muted font-normal">
                                    ({u.rating_count})
                                  </span>
                                </span>
                              ) : (
                                <span className="text-ink-muted">—</span>
                              )}
                            </td>

                            <td className="py-3 px-3 whitespace-nowrap">
                              <select
                                aria-label={`Rol sistem pentru ${u.display_name}`}
                                value={u.role}
                                disabled={isSelf || isRoleBusy}
                                onChange={(e) =>
                                  handleSetUserRole(
                                    u.id,
                                    e.target.value as UserRole
                                  )
                                }
                                className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-mono font-semibold text-ink focus:border-ochre focus:outline-none disabled:opacity-50"
                              >
                                <option value="user">user</option>
                                <option value="moderator">moderator</option>
                                <option value="admin">admin</option>
                              </select>
                            </td>

                            <td className="py-3 px-3.5 whitespace-nowrap text-right">
                              <div className="inline-flex items-center gap-1.5">
                                <Link
                                  href={`/admin/utilizatori/${u.id}`}
                                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-slate-200 bg-slate-50 hover:bg-ochre-light hover:border-ochre/30 text-ink hover:text-ochre text-[11px] font-semibold transition-colors"
                                  title="Vizualizează contul 360° în mod Read-Only"
                                >
                                  <Eye
                                    className="w-3 h-3 shrink-0"
                                    strokeWidth={1.8}
                                    aria-hidden="true"
                                  />
                                  <span>Vezi Cont</span>
                                </Link>

                                {isBusiness && (
                                  <button
                                    type="button"
                                    disabled={isKybBusy}
                                    onClick={() =>
                                      handleVerifyCompany(u.id, !u.kyb_verified)
                                    }
                                    className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors disabled:opacity-50 ${
                                      u.kyb_verified
                                        ? "border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700"
                                        : "bg-ochre hover:bg-ochre-hover text-white"
                                    }`}
                                  >
                                    {isKybBusy
                                      ? "..."
                                      : u.kyb_verified
                                        ? "Revocă KYB"
                                        : "Aprobă KYB"}
                                  </button>
                                )}
                                <button
                                  type="button"
                                  onClick={() =>
                                    setNotifyTarget({
                                      id: u.id,
                                      name: u.company_name || u.display_name,
                                    })
                                  }
                                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-ink text-[11px] font-semibold transition-colors"
                                >
                                  <Send
                                    className="w-3 h-3 shrink-0"
                                    strokeWidth={1.8}
                                    aria-hidden="true"
                                  />
                                  <span>Notifică</span>
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* ==============================================================
              TAB 3: ANUNȚURI (Căutare, Filtru Status, 1-Click Moderare, CSV)
              ============================================================== */}
          {activeTab === "listings" && (
            <div className="space-y-4">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2 flex-1">
                  <div className="relative flex-1 min-w-[220px] max-w-sm">
                    <Search
                      className="w-4 h-4 text-ink-muted absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                      strokeWidth={1.8}
                      aria-hidden="true"
                    />
                    <input
                      type="text"
                      value={listingSearch}
                      onChange={(e) => setListingSearch(e.target.value)}
                      placeholder="Caută după titlu, #OBJ, oraș sau proprietar..."
                      className="catalog-input pl-9 text-xs py-2"
                    />
                  </div>

                  <div className="inline-flex items-center rounded-xl border border-slate-200 bg-slate-50 p-1 gap-1">
                    {(
                      [
                        { id: "all", label: "Toate" },
                        { id: "available", label: "Active" },
                        { id: "unavailable", label: "Pe pauză" },
                        { id: "archived", label: "Arhivate" },
                      ] as const
                    ).map((st) => (
                      <button
                        key={st.id}
                        type="button"
                        onClick={() => setListingStatusFilter(st.id)}
                        className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors ${
                          listingStatusFilter === st.id
                            ? "bg-white text-ink shadow-xs"
                            : "text-ink-muted hover:text-ink"
                        }`}
                      >
                        {st.label}
                      </button>
                    ))}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleExportListingsCsv}
                  className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-ink transition-colors shrink-0"
                >
                  <Download
                    className="w-3.5 h-3.5 shrink-0"
                    strokeWidth={1.8}
                    aria-hidden="true"
                  />
                  <span>Export CSV Anunțuri</span>
                </button>
              </div>

              {filteredListings.length === 0 ? (
                <div className="p-8 rounded-xl border border-dashed border-slate-200 bg-slate-50/60 text-center text-sm text-ink-muted">
                  Nu există anunțuri care să corespundă criteriilor selectate.
                </div>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-slate-200/90">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-ink-muted font-mono uppercase text-[11px]">
                        <th className="py-3 px-3.5">Cod</th>
                        <th className="py-3 px-3">Anunț</th>
                        <th className="py-3 px-3">Proprietar</th>
                        <th className="py-3 px-3">Oraș</th>
                        <th className="py-3 px-3">Tarif &amp; Garanție</th>
                        <th className="py-3 px-3">Status</th>
                        <th className="py-3 px-3.5 text-right">
                          Moderare 1-Click
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                      {filteredListings.map((item) => {
                        const statusMeta =
                          LISTING_STATUS_META[item.status] ??
                          LISTING_STATUS_META.available;
                        const isRowBusy =
                          busyKey?.startsWith(`listing:${item.id}:`) ?? false;

                        return (
                          <tr key={item.id} className="hover:bg-slate-50/70">
                            <td className="py-3 px-3.5 font-mono font-bold text-ink whitespace-nowrap">
                              {item.catalog_code}
                            </td>

                            <td className="py-3 px-3">
                              <Link
                                href={`/obiect/${item.id}`}
                                target="_blank"
                                className="inline-flex items-center gap-1 font-semibold text-ochre hover:underline max-w-[240px]"
                              >
                                <span className="truncate">{item.title}</span>
                                <ExternalLink
                                  className="w-3 h-3 shrink-0"
                                  strokeWidth={1.8}
                                  aria-hidden="true"
                                />
                              </Link>
                              <div className="text-[11px] text-ink-muted mt-0.5">
                                {item.category}
                              </div>
                            </td>

                            <td className="py-3 px-3 whitespace-nowrap">
                              <span className="inline-flex items-center gap-1.5 text-ink">
                                {item.owner_type === "company" ? (
                                  <Building2
                                    className="w-3.5 h-3.5 text-ochre shrink-0"
                                    strokeWidth={1.8}
                                    aria-hidden="true"
                                  />
                                ) : (
                                  <User
                                    className="w-3.5 h-3.5 text-ink-muted shrink-0"
                                    strokeWidth={1.8}
                                    aria-hidden="true"
                                  />
                                )}
                                <span>{item.owner_name}</span>
                              </span>
                            </td>

                            <td className="py-3 px-3 whitespace-nowrap text-ink-muted">
                              {item.city}
                            </td>

                            <td className="py-3 px-3 whitespace-nowrap">
                              <div className="font-mono font-semibold text-ink">
                                {formatRon(item.price_per_day)} RON/zi
                              </div>
                              <div className="font-mono text-[11px] text-ink-muted">
                                Gar: {formatRon(item.deposit_ron)} RON
                              </div>
                            </td>

                            <td className="py-3 px-3 whitespace-nowrap">
                              <span
                                className={`inline-flex items-center px-2.5 py-0.5 rounded-full border text-[11px] font-semibold ${statusMeta.badgeClass}`}
                              >
                                {statusMeta.label}
                              </span>
                            </td>

                            <td className="py-3 px-3.5 whitespace-nowrap text-right">
                              <div className="inline-flex items-center gap-1.5">
                                <button
                                  type="button"
                                  disabled={
                                    isRowBusy || item.status === "available"
                                  }
                                  onClick={() =>
                                    handleModerateListing(
                                      item.id,
                                      "available",
                                      undefined,
                                      "activate",
                                      "Anunț activat din panoul admin."
                                    )
                                  }
                                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-semibold transition-colors disabled:opacity-40"
                                >
                                  <CheckCircle2
                                    className="w-3 h-3 shrink-0"
                                    strokeWidth={1.8}
                                    aria-hidden="true"
                                  />
                                  <span>Activează</span>
                                </button>

                                <button
                                  type="button"
                                  disabled={
                                    isRowBusy || item.status === "unavailable"
                                  }
                                  onClick={() =>
                                    handleModerateListing(
                                      item.id,
                                      "unavailable",
                                      undefined,
                                      "pause",
                                      "Anunț pus pe pauză din panoul admin."
                                    )
                                  }
                                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-amber-200 bg-amber-50 hover:bg-amber-100 text-amber-800 text-[11px] font-semibold transition-colors disabled:opacity-40"
                                >
                                  <PauseCircle
                                    className="w-3 h-3 shrink-0"
                                    strokeWidth={1.8}
                                    aria-hidden="true"
                                  />
                                  <span>Pauză</span>
                                </button>

                                <button
                                  type="button"
                                  disabled={
                                    isRowBusy || item.status === "archived"
                                  }
                                  onClick={() =>
                                    handleModerateListing(
                                      item.id,
                                      "archived",
                                      undefined,
                                      "archive",
                                      "Anunț arhivat din panoul admin."
                                    )
                                  }
                                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 text-[11px] font-semibold transition-colors disabled:opacity-40"
                                >
                                  <Archive
                                    className="w-3 h-3 shrink-0"
                                    strokeWidth={1.8}
                                    aria-hidden="true"
                                  />
                                  <span>Arhivează</span>
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* ==============================================================
              TAB 4: REZERVĂRI & FACTURI SRL
              ============================================================== */}
          {activeTab === "bookings" && (
            <div className="space-y-8">
              {/* Secțiunea A: Rezervări */}
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="relative flex-1 max-w-sm">
                    <Search
                      className="w-4 h-4 text-ink-muted absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                      strokeWidth={1.8}
                      aria-hidden="true"
                    />
                    <input
                      type="text"
                      value={bookingSearch}
                      onChange={(e) => setBookingSearch(e.target.value)}
                      placeholder="Caută #REZ, obiect, chiriaș sau ofertant..."
                      className="catalog-input pl-9 text-xs py-2"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={handleExportBookingsCsv}
                    className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-ink transition-colors shrink-0"
                  >
                    <Download
                      className="w-3.5 h-3.5 shrink-0"
                      strokeWidth={1.8}
                      aria-hidden="true"
                    />
                    <span>Export CSV Tranzacții</span>
                  </button>
                </div>

                {filteredBookings.length === 0 ? (
                  <div className="p-8 rounded-xl border border-dashed border-slate-200 bg-slate-50/60 text-center text-sm text-ink-muted">
                    Nu există rezervări înregistrate conform filtrului curent.
                  </div>
                ) : (
                  <div className="overflow-x-auto rounded-xl border border-slate-200/90">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200 text-ink-muted font-mono uppercase text-[11px]">
                          <th className="py-3 px-3.5">Cod</th>
                          <th className="py-3 px-3">Obiect</th>
                          <th className="py-3 px-3">Chiriaș &rarr; Ofertant</th>
                          <th className="py-3 px-3">Perioadă</th>
                          <th className="py-3 px-3">Total &amp; Comision</th>
                          <th className="py-3 px-3">Status &amp; Escrow</th>
                          <th className="py-3 px-3.5 text-right">
                            Intervenție Admin
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 bg-white">
                        {filteredBookings.map((b) => {
                          const bookingMeta =
                            BOOKING_STATUS_META[b.status] ??
                            BOOKING_STATUS_META.pending;
                          const paymentMeta = b.payment_status
                            ? PAYMENT_STATUS_META[b.payment_status]
                            : null;
                          const isRowBusy =
                            busyKey?.startsWith(`booking:${b.id}:`) ?? false;
                          const canIntervene =
                            b.status !== "completed" &&
                            b.status !== "cancelled";

                          return (
                            <tr key={b.id} className="hover:bg-slate-50/70">
                              <td className="py-3 px-3.5 font-mono font-bold text-ink whitespace-nowrap">
                                {b.booking_code}
                              </td>

                              <td className="py-3 px-3">
                                <Link
                                  href={`/obiect/${b.listing_id}`}
                                  target="_blank"
                                  className="inline-flex items-center gap-1 font-semibold text-ochre hover:underline max-w-[200px]"
                                >
                                  <span className="truncate">
                                    {b.listing_title}
                                  </span>
                                  <ExternalLink
                                    className="w-3 h-3 shrink-0"
                                    strokeWidth={1.8}
                                    aria-hidden="true"
                                  />
                                </Link>
                                <div className="font-mono text-[10px] text-ink-muted">
                                  {b.listing_code}
                                </div>
                              </td>

                              <td className="py-3 px-3 whitespace-nowrap">
                                <span className="font-medium text-ink">
                                  {b.renter_name}
                                </span>
                                <span className="mx-1.5 text-ink-muted">
                                  &rarr;
                                </span>
                                <span className="text-ink-muted">
                                  {b.owner_name}
                                </span>
                              </td>

                              <td className="py-3 px-3 whitespace-nowrap font-mono text-[11px] text-ink-muted">
                                <div>
                                  {formatDateRo(b.start_date)} –{" "}
                                  {formatDateRo(b.end_date)}
                                </div>
                                <div className="text-[10px]">
                                  {b.total_days}{" "}
                                  {b.total_days === 1 ? "zi" : "zile"}
                                </div>
                              </td>

                              <td className="py-3 px-3 whitespace-nowrap">
                                <div className="font-mono font-bold text-ink">
                                  {formatRon(b.total_price_ron)} RON
                                </div>
                                <div className="font-mono text-[11px] text-ochre">
                                  Com: {formatRon(b.platform_fee_ron)} RON
                                </div>
                              </td>

                              <td className="py-3 px-3 whitespace-nowrap">
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
                                  {b.deposit_status &&
                                    b.deposit_status !== "none" && (
                                      <span className="text-[10px] font-mono text-ink-muted">
                                        {DEPOSIT_STATUS_LABELS[b.deposit_status]}
                                      </span>
                                    )}
                                </div>
                              </td>

                              <td className="py-3 px-3.5 whitespace-nowrap text-right">
                                {canIntervene ? (
                                  <div className="inline-flex items-center gap-1.5">
                                    <button
                                      type="button"
                                      disabled={isRowBusy}
                                      onClick={() =>
                                        handleForceBookingStatus(
                                          b.id,
                                          "completed",
                                          "Rezervare marcată finalizată de administrator."
                                        )
                                      }
                                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-semibold transition-colors disabled:opacity-50"
                                    >
                                      <CheckCircle2
                                        className="w-3 h-3 shrink-0"
                                        strokeWidth={1.8}
                                        aria-hidden="true"
                                      />
                                      <span>Marchează finalizată</span>
                                    </button>
                                    <button
                                      type="button"
                                      disabled={isRowBusy}
                                      onClick={() =>
                                        handleForceBookingStatus(
                                          b.id,
                                          "cancelled",
                                          "Rezervare anulată de administrator."
                                        )
                                      }
                                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 text-[11px] font-semibold transition-colors disabled:opacity-50"
                                    >
                                      <XCircle
                                        className="w-3 h-3 shrink-0"
                                        strokeWidth={1.8}
                                        aria-hidden="true"
                                      />
                                      <span>Anulează</span>
                                    </button>
                                  </div>
                                ) : (
                                  <span className="font-mono text-[11px] text-ink-muted">
                                    Închisă
                                  </span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Secțiunea B: Facturi Fiscale SRL Emise */}
              <div className="space-y-3 pt-4 border-t border-slate-200">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <FileText
                      className="w-4 h-4 text-ochre shrink-0"
                      strokeWidth={1.8}
                      aria-hidden="true"
                    />
                    <h2 className="font-display font-bold text-base text-ink">
                      Facturi Fiscale SRL Emise ({invoices.length})
                    </h2>
                  </div>
                  <span className="font-mono text-[11px] text-ink-muted">
                    Seria RNT &bull; RO e-Factura
                  </span>
                </div>

                {invoices.length === 0 ? (
                  <div className="p-6 rounded-xl border border-dashed border-slate-200 bg-slate-50/60 text-center text-sm text-ink-muted">
                    Nu există încă facturi fiscale emise în platformă.
                  </div>
                ) : (
                  <div className="overflow-x-auto rounded-xl border border-slate-200/90">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200 text-ink-muted font-mono uppercase text-[11px]">
                          <th className="py-3 px-3.5">Nr. Factură</th>
                          <th className="py-3 px-3">Client</th>
                          <th className="py-3 px-3">CUI Client</th>
                          <th className="py-3 px-3">Total (RON)</th>
                          <th className="py-3 px-3">Status RO e-Factura</th>
                          <th className="py-3 px-3">Emisă La</th>
                          <th className="py-3 px-3.5 text-right">Document</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 bg-white">
                        {invoices.map((inv) => {
                          const efMeta =
                            EFACTURA_STATUS_META[inv.efactura_status] ??
                            EFACTURA_STATUS_META.not_applicable;
                          return (
                            <tr key={inv.id} className="hover:bg-slate-50/70">
                              <td className="py-3 px-3.5 font-mono font-bold text-ink whitespace-nowrap">
                                {inv.invoice_number}
                              </td>
                              <td className="py-3 px-3 font-medium text-ink">
                                {inv.client_name}
                              </td>
                              <td className="py-3 px-3 font-mono text-[11px] text-ink-muted whitespace-nowrap">
                                {inv.client_cui || "Persoană Fizică"}
                              </td>
                              <td className="py-3 px-3 whitespace-nowrap">
                                <div className="font-mono font-bold text-ink">
                                  {formatRon(inv.total_ron)} RON
                                </div>
                                <div className="font-mono text-[10px] text-ink-muted">
                                  TVA {inv.vat_rate}%:{" "}
                                  {formatRon(inv.vat_amount_ron)} RON
                                </div>
                              </td>
                              <td className="py-3 px-3 whitespace-nowrap">
                                <span
                                  className={`inline-flex px-2.5 py-0.5 rounded-full border text-[11px] font-semibold ${efMeta.badgeClass}`}
                                >
                                  {efMeta.label}
                                </span>
                              </td>
                              <td className="py-3 px-3 font-mono text-[11px] text-ink-muted whitespace-nowrap">
                                {formatDateTimeRo(inv.issued_at)}
                              </td>
                              <td className="py-3 px-3.5 text-right whitespace-nowrap">
                                <Link
                                  href={`/profil/facturi/${inv.id}`}
                                  target="_blank"
                                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-slate-200 bg-white hover:bg-ochre-light hover:text-ochre hover:border-ochre/30 text-ink text-[11px] font-semibold transition-colors"
                                >
                                  <span>Deschide</span>
                                  <ExternalLink
                                    className="w-3 h-3 shrink-0"
                                    strokeWidth={1.8}
                                    aria-hidden="true"
                                  />
                                </Link>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ==============================================================
              TAB 5: MODERARE (DISPUTE + RAPOARTE ANUNȚURI)
              ============================================================== */}
          {activeTab === "moderation" && (
            <div className="space-y-8">
              {/* Sub-secțiunea 1: Dispute */}
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <ShieldAlert
                      className="w-4 h-4 text-rose-600 shrink-0"
                      strokeWidth={1.8}
                      aria-hidden="true"
                    />
                    <h2 className="font-display font-bold text-base text-ink">
                      Coada de Dispute ({disputes.length})
                    </h2>
                  </div>
                  <span className="font-mono text-[11px] text-ink-muted">
                    Deschise: {kpis.openDisputes}
                  </span>
                </div>

                {disputes.length === 0 ? (
                  <div className="p-8 rounded-xl border border-dashed border-slate-200 bg-slate-50/60 text-center text-sm text-ink-muted">
                    Nu există dispute înregistrate în platformă.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {disputes.map((dispute) => {
                      const statusMeta =
                        DISPUTE_STATUS_META[dispute.status] ??
                        DISPUTE_STATUS_META.open;
                      const isActionable =
                        dispute.status === "open" ||
                        dispute.status === "under_review";
                      const isRowBusy =
                        busyKey?.startsWith(`dispute:${dispute.id}:`) ?? false;

                      return (
                        <div
                          key={dispute.id}
                          className="p-4 rounded-xl border border-slate-200/90 bg-slate-50/50 space-y-3"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex flex-wrap items-center gap-2 text-xs">
                              <span className="font-mono font-bold text-ink bg-white border border-slate-200 px-2.5 py-0.5 rounded-lg">
                                {dispute.booking_code ||
                                  `#REZ-${dispute.booking_id.slice(0, 6).toUpperCase()}`}
                              </span>
                              <span className="px-2.5 py-0.5 rounded-full bg-white border border-slate-200 font-semibold text-ink">
                                {DISPUTE_REASON_LABELS[dispute.reason] ||
                                  dispute.reason}
                              </span>
                              <span
                                className={`px-2.5 py-0.5 rounded-full border font-semibold ${statusMeta.badgeClass}`}
                              >
                                {statusMeta.label}
                              </span>
                            </div>

                            <div className="flex items-center gap-3 text-xs">
                              <span className="font-mono font-bold text-rose-700 bg-rose-50 border border-rose-200 px-2.5 py-0.5 rounded-lg">
                                Revendicat:{" "}
                                {formatRon(dispute.claimed_amount_ron)} RON
                              </span>
                              <span className="font-mono text-[11px] text-ink-muted">
                                {formatDateTimeRo(dispute.created_at)}
                              </span>
                            </div>
                          </div>

                          <p className="text-sm text-ink leading-relaxed bg-white p-3 rounded-xl border border-slate-200/70">
                            {dispute.description}
                          </p>

                          {isActionable && (
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
                              <input
                                type="text"
                                value={disputeNotes[dispute.id] ?? ""}
                                onChange={(e) =>
                                  setDisputeNotes((prev) => ({
                                    ...prev,
                                    [dispute.id]: e.target.value,
                                  }))
                                }
                                disabled={isRowBusy}
                                placeholder="Notă internă de rezoluție (opțional)..."
                                className="catalog-input text-xs py-2 sm:max-w-sm"
                              />

                              <div className="flex flex-wrap items-center gap-2">
                                <button
                                  type="button"
                                  disabled={isRowBusy}
                                  onClick={() =>
                                    handleResolveDispute(
                                      dispute.id,
                                      "resolved_owner"
                                    )
                                  }
                                  className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold transition-colors disabled:opacity-50"
                                >
                                  Acordă Ofertantului
                                </button>
                                <button
                                  type="button"
                                  disabled={isRowBusy}
                                  onClick={() =>
                                    handleResolveDispute(
                                      dispute.id,
                                      "resolved_renter"
                                    )
                                  }
                                  className="px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-700 text-white text-xs font-semibold transition-colors disabled:opacity-50"
                                >
                                  Rambursează Chiriașul
                                </button>
                                <button
                                  type="button"
                                  disabled={isRowBusy}
                                  onClick={() =>
                                    handleResolveDispute(dispute.id, "closed")
                                  }
                                  className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 text-ink text-xs font-semibold transition-colors disabled:opacity-50"
                                >
                                  Închide
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Sub-secțiunea 2: Anunțuri Raportate */}
              <div className="space-y-3 pt-4 border-t border-slate-200">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <AlertTriangle
                      className="w-4 h-4 text-amber-600 shrink-0"
                      strokeWidth={1.8}
                      aria-hidden="true"
                    />
                    <h2 className="font-display font-bold text-base text-ink">
                      Anunțuri Raportate ({reports.length})
                    </h2>
                  </div>
                  <span className="font-mono text-[11px] text-ink-muted">
                    Deschise: {kpis.openReports}
                  </span>
                </div>

                {reports.length === 0 ? (
                  <div className="p-8 rounded-xl border border-dashed border-slate-200 bg-slate-50/60 text-center text-sm text-ink-muted">
                    Nu există anunțuri raportate de utilizatori.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {reports.map((report) => {
                      const reportMeta =
                        REPORT_STATUS_META[report.status] ??
                        REPORT_STATUS_META.open;
                      const listingMeta = report.listing_status
                        ? LISTING_STATUS_META[report.listing_status]
                        : null;
                      const isRowBusy =
                        busyKey?.startsWith(`report:${report.id}:`) ?? false;

                      return (
                        <div
                          key={report.id}
                          className="p-4 rounded-xl border border-slate-200/90 bg-slate-50/50 space-y-3"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex flex-wrap items-center gap-2 text-xs">
                              {report.listing_catalog_code && (
                                <span className="font-mono font-bold text-ink bg-white border border-slate-200 px-2 py-0.5 rounded-lg">
                                  {report.listing_catalog_code}
                                </span>
                              )}
                              <Link
                                href={`/obiect/${report.listing_id}`}
                                target="_blank"
                                className="inline-flex items-center gap-1 font-display font-bold text-sm text-ochre hover:underline"
                              >
                                <span>
                                  {report.listing_title ||
                                    `Anunț ${report.listing_id.slice(0, 8)}`}
                                </span>
                                <ExternalLink
                                  className="w-3.5 h-3.5 shrink-0"
                                  strokeWidth={1.8}
                                  aria-hidden="true"
                                />
                              </Link>
                              <span
                                className={`px-2.5 py-0.5 rounded-full border font-semibold ${reportMeta.badgeClass}`}
                              >
                                Raport: {reportMeta.label}
                              </span>
                              {listingMeta && (
                                <span
                                  className={`px-2.5 py-0.5 rounded-full border font-semibold ${listingMeta.badgeClass}`}
                                >
                                  Anunț: {listingMeta.label}
                                </span>
                              )}
                            </div>

                            <span className="font-mono text-[11px] text-ink-muted">
                              {formatDateTimeRo(report.created_at)}
                            </span>
                          </div>

                          <div className="text-xs text-ink bg-white p-3 rounded-xl border border-slate-200/70 space-y-1">
                            <div>
                              <span className="text-ink-muted font-medium">
                                Motiv:{" "}
                              </span>
                              <strong className="font-semibold text-ink">
                                {report.reason}
                              </strong>
                            </div>
                            {report.details && (
                              <p className="text-ink-muted leading-relaxed">
                                {report.details}
                              </p>
                            )}
                          </div>

                          <div className="flex flex-wrap items-center justify-end gap-2">
                            {report.listing_status !== "archived" && (
                              <button
                                type="button"
                                disabled={isRowBusy}
                                onClick={() =>
                                  handleModerateListing(
                                    report.listing_id,
                                    "archived",
                                    report.id,
                                    "archive",
                                    "Anunț arhivat de admin în urma raportului."
                                  )
                                }
                                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold transition-colors disabled:opacity-50"
                              >
                                <Archive
                                  className="w-3.5 h-3.5 shrink-0"
                                  strokeWidth={1.8}
                                  aria-hidden="true"
                                />
                                <span>Arhivează Anunț</span>
                              </button>
                            )}
                            {report.status === "open" && (
                              <button
                                type="button"
                                disabled={isRowBusy}
                                onClick={() =>
                                  handleModerateListing(
                                    report.listing_id,
                                    report.listing_status === "unavailable"
                                      ? "unavailable"
                                      : "available",
                                    report.id,
                                    "dismiss",
                                    "Raport respins de admin."
                                  )
                                }
                                className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 text-ink text-xs font-semibold transition-colors disabled:opacity-50"
                              >
                                Respinge Raport
                              </button>
                            )}
                            {report.listing_status !== "available" && (
                              <button
                                type="button"
                                disabled={isRowBusy}
                                onClick={() =>
                                  handleModerateListing(
                                    report.listing_id,
                                    "available",
                                    report.id,
                                    "reactivate",
                                    "Anunț reactivat de admin."
                                  )
                                }
                                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold transition-colors disabled:opacity-50"
                              >
                                <Check
                                  className="w-3.5 h-3.5 shrink-0"
                                  strokeWidth={1.8}
                                  aria-hidden="true"
                                />
                                <span>Reactivează</span>
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ==============================================================
              TAB 6: AUDIT LOG (Căutare instantă + Jurnal cronologic)
              ============================================================== */}
          {activeTab === "audit" && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="relative flex-1 max-w-sm">
                  <Search
                    className="w-4 h-4 text-ink-muted absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                    strokeWidth={1.8}
                    aria-hidden="true"
                  />
                  <input
                    type="text"
                    value={auditSearch}
                    onChange={(e) => setAuditSearch(e.target.value)}
                    placeholder="Filtrează după acțiune, țintă sau detalii..."
                    className="catalog-input pl-9 text-xs py-2"
                  />
                </div>
                <span className="font-mono text-[11px] text-ink-muted">
                  Afișate: {filteredAuditLogs.length} / {auditLogs.length}
                </span>
              </div>

              {filteredAuditLogs.length === 0 ? (
                <div className="p-8 rounded-xl border border-dashed border-slate-200 bg-slate-50/60 text-center text-sm text-ink-muted">
                  {auditLogs.length === 0
                    ? "Jurnalul de audit este gol. Orice acțiune efectuată din acest panou va fi înregistrată cronologic aici."
                    : "Nicio înregistrare din jurnalul de audit nu corespunde căutării."}
                </div>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-slate-200/90">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-ink-muted font-mono uppercase text-[11px]">
                        <th className="py-2.5 px-3">Data &amp; Ora</th>
                        <th className="py-2.5 px-3">Acțiune</th>
                        <th className="py-2.5 px-3">Țintă</th>
                        <th className="py-2.5 px-3">Detalii</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                      {filteredAuditLogs.map((log) => (
                        <tr key={log.id} className="hover:bg-slate-50/70">
                          <td className="py-2.5 px-3 font-mono text-[11px] text-ink-muted whitespace-nowrap">
                            {formatDateTimeRo(log.created_at)}
                          </td>
                          <td className="py-2.5 px-3 whitespace-nowrap">
                            <span className="font-mono font-semibold text-ochre bg-ochre-light px-2 py-0.5 rounded-md">
                              {log.action}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 font-mono text-[11px] text-ink whitespace-nowrap">
                            <span className="text-ink-muted">
                              {log.target_type}:
                            </span>{" "}
                            {log.target_type === "profile" &&
                            log.target_id.length >= 32 ? (
                              <Link
                                href={`/admin/utilizatori/${log.target_id}`}
                                className="font-semibold text-ink hover:text-ochre hover:underline"
                                title={`Vezi contul utilizatorului ${log.target_id}`}
                              >
                                {log.target_id.slice(0, 12)}…
                              </Link>
                            ) : log.target_type === "listing" &&
                              log.target_id.length >= 32 ? (
                              <Link
                                href={`/obiect/${log.target_id}`}
                                className="font-semibold text-ink hover:text-ochre hover:underline"
                                title={`Vezi anunțul ${log.target_id}`}
                              >
                                {log.target_id.slice(0, 12)}…
                              </Link>
                            ) : (
                              <>
                                {log.target_id.slice(0, 12)}
                                {log.target_id.length > 12 ? "…" : ""}
                              </>
                            )}
                          </td>
                          <td className="py-2.5 px-3 font-mono text-[11px] text-ink-muted max-w-md break-all">
                            {log.details && Object.keys(log.details).length > 0
                              ? JSON.stringify(log.details)
                              : "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
