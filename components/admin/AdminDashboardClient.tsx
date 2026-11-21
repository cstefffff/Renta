"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  adminModerateListingAction,
  adminResolveDisputeAction,
  adminVerifyCompanyAction,
} from "@/app/actions/admin";
import type {
  AdminDashboardData,
  DisputeReason,
  DisputeStatus,
  ListingReportStatus,
  ListingStatus,
} from "@/lib/types/database";

/**
 * Interfața interactivă a Panoului de Administrare (`/admin`) — Client Component.
 *
 * Explicație pentru dezvoltatori C / Java:
 * - Datele inițiale (`initialData`) sunt încărcate pe server de `app/(dashboard)/admin/page.tsx`
 *   (ca un Model injectat într-un View în Spring MVC).
 * - Această componentă gestionează starea locală a UI-ului (`activeTab`, `busyKey`,
 *   `feedback`, `disputeNotes`) și invocă Server Actions securizate pe server.
 * - După fiecare operațiune de moderare, apelăm `router.refresh()` pentru ca Next.js
 *   să re-execute Server Component-ul și să sincronizeze KPI-urile și Audit Log-ul.
 */
interface AdminDashboardClientProps {
  initialData: AdminDashboardData;
}

type AdminTab = "disputes" | "companies" | "reports" | "audit";

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
    label: "Indisponibil",
    badgeClass: "bg-amber-50 text-amber-700 border-amber-200",
  },
  archived: {
    label: "Arhivat",
    badgeClass: "bg-slate-100 text-ink-muted border-slate-200",
  },
};

function formatRon(amount: number): string {
  return new Intl.NumberFormat("ro-RO", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(Number(amount) || 0);
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

export function AdminDashboardClient({
  initialData,
}: AdminDashboardClientProps) {
  const router = useRouter();
  const [data, setData] = useState<AdminDashboardData>(initialData);
  const [activeTab, setActiveTab] = useState<AdminTab>("disputes");
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [disputeNotes, setDisputeNotes] = useState<Record<string, string>>({});
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  // Sincronizăm starea locală când Server Component-ul trimite date noi după `router.refresh()`
  useEffect(() => {
    setData(initialData);
  }, [initialData]);

  const { kpis, disputes, companies, reports, auditLogs, migrationMissing } =
    data;

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

  // --- Handler 3: Moderare Anunț / Raport ---
  async function handleModerateListing(
    listingId: string,
    newStatus: ListingStatus,
    reportId: string,
    actionLabel: string,
    notes: string
  ) {
    setBusyKey(`report:${reportId}:${actionLabel}`);
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

  return (
    <div className="max-w-[1400px] mx-auto px-4 sm:px-6 py-6 space-y-6">
      {/* Antet Panou Admin */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-sm flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-ochre-light text-ochre font-semibold text-xs">
              <span aria-hidden="true">🛡️</span>
              <span>Rol Admin Activ</span>
            </span>
            <span className="font-mono text-xs text-ink-muted bg-slate-100 px-2.5 py-1 rounded-lg">
              #ADMIN-OPS
            </span>
          </div>
          <h1 className="font-display text-2xl sm:text-3xl font-extrabold text-ink">
            Panou de Administrare &amp; Moderare RentA
          </h1>
          <p className="text-sm text-ink-muted">
            Monitorizează volumul tranzacțiilor, rezolvă dispute, aprobă firme
            B2C (KYB) și auditează toate acțiunile operaționale.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => router.refresh()}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-ink transition-colors"
          >
            ↻ Reîmprospătează
          </button>
          <Link
            href="/catalog"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-100 hover:bg-ochre-light text-xs font-semibold text-ink hover:text-ochre transition-colors"
          >
            &larr; Catalog Public
          </Link>
        </div>
      </div>

      {/* Avertisment dacă migrația 008 nu a fost rulată încă în Supabase */}
      {migrationMissing && (
        <div className="bg-amber-50 border border-amber-300 rounded-2xl p-5 space-y-2.5">
          <div className="flex items-center gap-2 text-amber-900 font-display font-bold text-sm">
            <span aria-hidden="true">⚠️</span>
            <span>
              Migrația SQL pentru Panoul Admin lipsește din baza de date
            </span>
          </div>
          <p className="text-xs text-amber-900/90 leading-relaxed">
            Tabelele <code className="font-mono font-semibold">admin_audit_logs</code>{" "}
            și/sau <code className="font-mono font-semibold">listing_reports</code>{" "}
            nu au fost detectate în Supabase. Rulează fișierul de migrație de
            mai jos în <strong>Supabase SQL Editor</strong>, apoi reîncarcă
            pagina:
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
          <span>{feedback.text}</span>
          <button
            type="button"
            onClick={() => setFeedback(null)}
            className="text-xs underline opacity-80 hover:opacity-100"
          >
            Închide
          </button>
        </div>
      )}

      {/* 4 Carduri KPI */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1: GMV & Comisioane (10%) */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-sm space-y-2">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-medium text-ink-muted">
              GMV &amp; Comisioane (10%)
            </span>
            <span className="font-mono text-[11px] px-2 py-0.5 rounded-md bg-ochre-light text-ochre font-semibold">
              FINANCIAR
            </span>
          </div>
          <div className="font-display text-2xl font-extrabold text-ink">
            {formatRon(kpis.totalGmvRon)}{" "}
            <span className="text-sm font-semibold text-ink-muted">RON</span>
          </div>
          <div className="text-xs text-ink-muted flex items-center justify-between pt-1 border-t border-slate-100">
            <span>
              Comision:{" "}
              <strong className="text-ochre font-semibold">
                {formatRon(kpis.totalCommissionRon)} RON
              </strong>
            </span>
            <span className="font-mono text-[11px]">
              {kpis.totalBookings} rez.
            </span>
          </div>
        </div>

        {/* KPI 2: Anunțuri Active / Total */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-sm space-y-2">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-medium text-ink-muted">
              Anunțuri Active / Total
            </span>
            <span className="font-mono text-[11px] px-2 py-0.5 rounded-md bg-slate-100 text-ink-muted font-semibold">
              CATALOG
            </span>
          </div>
          <div className="font-display text-2xl font-extrabold text-ink">
            {kpis.activeListings}{" "}
            <span className="text-base font-semibold text-ink-muted">
              / {kpis.totalListings}
            </span>
          </div>
          <div className="text-xs text-ink-muted flex items-center justify-between pt-1 border-t border-slate-100">
            <span>Utilizatori înregistrați</span>
            <strong className="font-mono text-ink">{kpis.totalUsers}</strong>
          </div>
        </div>

        {/* KPI 3: Dispute Deschise */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-sm space-y-2">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-medium text-ink-muted">
              Dispute Deschise
            </span>
            <span
              className={`font-mono text-[11px] px-2 py-0.5 rounded-md font-semibold ${
                kpis.openDisputes > 0
                  ? "bg-rose-50 text-rose-700"
                  : "bg-emerald-50 text-emerald-700"
              }`}
            >
              {kpis.openDisputes > 0 ? "NECESITĂ ACȚIUNE" : "CURAT"}
            </span>
          </div>
          <div className="font-display text-2xl font-extrabold text-ink">
            {kpis.openDisputes}
          </div>
          <div className="text-xs text-ink-muted flex items-center justify-between pt-1 border-t border-slate-100">
            <span>Total dispute în istoric</span>
            <strong className="font-mono text-ink">{disputes.length}</strong>
          </div>
        </div>

        {/* KPI 4: Rapoarte Anunțuri */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-sm space-y-2">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-medium text-ink-muted">
              Rapoarte Anunțuri
            </span>
            <span
              className={`font-mono text-[11px] px-2 py-0.5 rounded-md font-semibold ${
                kpis.openReports > 0
                  ? "bg-amber-50 text-amber-700"
                  : "bg-emerald-50 text-emerald-700"
              }`}
            >
              {kpis.openReports > 0 ? "DE MODERAT" : "LA ZI"}
            </span>
          </div>
          <div className="font-display text-2xl font-extrabold text-ink">
            {kpis.openReports}
          </div>
          <div className="text-xs text-ink-muted flex items-center justify-between pt-1 border-t border-slate-100">
            <span>Total sesizări primite</span>
            <strong className="font-mono text-ink">{reports.length}</strong>
          </div>
        </div>
      </div>

      {/* Bara de Tab-uri */}
      <div className="bg-white border border-slate-200/90 rounded-2xl shadow-sm overflow-hidden">
        <div
          role="tablist"
          aria-label="Secțiuni administrare RentA"
          className="flex flex-wrap items-center gap-1.5 p-3 border-b border-slate-200 bg-slate-50/70"
        >
          {(
            [
              { id: "disputes", label: `Dispute (${disputes.length})` },
              { id: "companies", label: `Firme B2C (${companies.length})` },
              {
                id: "reports",
                label: `Rapoarte Anunțuri (${reports.length})`,
              },
              { id: "audit", label: `Audit Log (${auditLogs.length})` },
            ] as const
          ).map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
                  isActive
                    ? "bg-ochre text-white shadow-xs"
                    : "bg-white text-ink-muted hover:text-ink hover:bg-slate-100 border border-slate-200/80"
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Conținut Tab Activ */}
        <div className="p-5">
          {/* TAB 1: DISPUTE */}
          {activeTab === "disputes" && (
            <div className="space-y-4">
              {disputes.length === 0 ? (
                <div className="p-8 rounded-xl border border-dashed border-slate-200 bg-slate-50/60 text-center text-sm text-ink-muted">
                  Nu există dispute înregistrate în platformă.
                </div>
              ) : (
                disputes.map((dispute) => {
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
                            Revendicat: {formatRon(dispute.claimed_amount_ron)}{" "}
                            RON
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
                })
              )}
            </div>
          )}

          {/* TAB 2: FIRME B2C */}
          {activeTab === "companies" && (
            <div className="space-y-3">
              {companies.length === 0 ? (
                <div className="p-8 rounded-xl border border-dashed border-slate-200 bg-slate-50/60 text-center text-sm text-ink-muted">
                  Nu există conturi de tip Firmă B2C înregistrate încă.
                </div>
              ) : (
                companies.map((company) => {
                  const isRowBusy = busyKey === `company:${company.id}`;
                  return (
                    <div
                      key={company.id}
                      className="p-4 rounded-xl border border-slate-200/90 bg-slate-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                    >
                      <div className="space-y-1.5 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-display font-bold text-sm text-ink">
                            {company.company_name || company.display_name}
                          </h3>
                          {company.kyb_verified ? (
                            <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-[11px] font-semibold">
                              ✓ Verificată ANAF
                            </span>
                          ) : (
                            <span className="px-2.5 py-0.5 rounded-full bg-amber-50 border border-amber-200 text-amber-700 text-[11px] font-semibold">
                              ⏳ În așteptare
                            </span>
                          )}
                          {company.company_cui && (
                            <span className="font-mono text-[11px] px-2 py-0.5 rounded-md bg-white border border-slate-200 text-ink">
                              CUI: {company.company_cui}
                            </span>
                          )}
                        </div>

                        <div className="text-xs text-ink-muted flex flex-wrap items-center gap-x-4 gap-y-1">
                          <span>📍 {company.city || "Oraș nespecificat"}</span>
                          {company.company_address && (
                            <span className="truncate max-w-md">
                              🏢 {company.company_address}
                            </span>
                          )}
                          {company.kyb_verified_at && (
                            <span className="font-mono text-[11px]">
                              Verificată:{" "}
                              {formatDateTimeRo(company.kyb_verified_at)}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {company.kyb_verified ? (
                          <button
                            type="button"
                            disabled={isRowBusy}
                            onClick={() =>
                              handleVerifyCompany(company.id, false)
                            }
                            className="px-3.5 py-1.5 rounded-lg border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-semibold transition-colors disabled:opacity-50"
                          >
                            {isRowBusy ? "Se actualizează..." : "Revocă KYB"}
                          </button>
                        ) : (
                          <button
                            type="button"
                            disabled={isRowBusy}
                            onClick={() =>
                              handleVerifyCompany(company.id, true)
                            }
                            className="px-3.5 py-1.5 rounded-lg bg-ochre hover:bg-ochre-hover text-white text-xs font-semibold transition-colors disabled:opacity-50"
                          >
                            {isRowBusy ? "Se actualizează..." : "Aprobă KYB"}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* TAB 3: RAPOARTE ANUNȚURI */}
          {activeTab === "reports" && (
            <div className="space-y-3">
              {reports.length === 0 ? (
                <div className="p-8 rounded-xl border border-dashed border-slate-200 bg-slate-50/60 text-center text-sm text-ink-muted">
                  Nu există anunțuri raportate de utilizatori.
                </div>
              ) : (
                reports.map((report) => {
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
                            className="font-display font-bold text-sm text-ochre hover:underline"
                          >
                            {report.listing_title ||
                              `Anunț ${report.listing_id.slice(0, 8)}`}
                            {" ↗"}
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
                            className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold transition-colors disabled:opacity-50"
                          >
                            Arhivează Anunț
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
                            className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold transition-colors disabled:opacity-50"
                          >
                            Reactivează
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* TAB 4: AUDIT LOG */}
          {activeTab === "audit" && (
            <div className="space-y-3">
              {auditLogs.length === 0 ? (
                <div className="p-8 rounded-xl border border-dashed border-slate-200 bg-slate-50/60 text-center text-sm text-ink-muted">
                  Jurnalul de audit este gol. Orice acțiune efectuată din acest
                  panou va fi înregistrată cronologic aici.
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
                      {auditLogs.map((log) => (
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
                            {log.target_id.slice(0, 12)}
                            {log.target_id.length > 12 ? "…" : ""}
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
