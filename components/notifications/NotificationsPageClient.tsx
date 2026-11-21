"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  markAllNotificationsReadAction,
  markNotificationReadAction,
} from "@/app/actions/notifications";
import type { NotificationRecord } from "@/lib/types/database";

/**
 * Interfața interactivă pentru pagina `/notificari` (`NotificationsPageClient.tsx`).
 *
 * Explicație pentru dezvoltatori C / Java:
 * - Pagina server (`app/(dashboard)/notificari/page.tsx`) pre-încarcă lista
 *   de notificări din baza de date și o pasează aici ca `Props` inițiale.
 * - Acest Client Component gestionează filtrarea (`Toate` vs `Necitite`) și
 *   marcarea ca citit (individual sau în masă) cu actualizare optimistă în memorie,
 *   evitând reîncărcarea completă a paginii la fiecare click.
 */

export interface NotificationsPageClientProps {
  initialNotifications: NotificationRecord[];
  initialUnreadCount: number;
  migrationMissing?: boolean;
  emailMode: "resend" | "sandbox";
}

type FilterTab = "all" | "unread";

function isNotificationRead(n: NotificationRecord): boolean {
  if ("read_at" in n) {
    return Boolean((n as { read_at?: string | null }).read_at);
  }
  if ("is_read" in n) {
    return Boolean((n as { is_read?: boolean }).is_read);
  }
  return false;
}

function markLocalNotificationRead(n: NotificationRecord): NotificationRecord {
  const nowIso = new Date().toISOString();
  return {
    ...n,
    ...("read_at" in n ? { read_at: nowIso } : {}),
    ...("is_read" in n ? { is_read: true } : {}),
  };
}

function getNotificationBody(n: NotificationRecord): string {
  if ("body" in n && typeof (n as { body?: unknown }).body === "string") {
    return (n as { body: string }).body;
  }
  if ("message" in n && typeof (n as { message?: unknown }).message === "string") {
    return (n as { message: string }).message;
  }
  return "";
}

interface TypeBadgeMeta {
  label: string;
  badgeClass: string;
  iconBgClass: string;
  kind: "booking" | "payment" | "dispute" | "review" | "system";
}

function getNotificationTypeMeta(type: string): TypeBadgeMeta {
  const t = type.toLowerCase();

  if (t.includes("payment") || t.includes("payout") || t.includes("escrow")) {
    return {
      label: "Plată / Escrow",
      badgeClass: "bg-emerald-50 text-emerald-700 border-emerald-200",
      iconBgClass: "bg-emerald-50 text-emerald-600 border-emerald-200/80",
      kind: "payment",
    };
  }
  if (t.includes("dispute")) {
    return {
      label: "Dispută",
      badgeClass: "bg-rose-50 text-rose-700 border-rose-200",
      iconBgClass: "bg-rose-50 text-rose-600 border-rose-200/80",
      kind: "dispute",
    };
  }
  if (t.includes("review")) {
    return {
      label: "Recenzie",
      badgeClass: "bg-amber-50 text-amber-700 border-amber-200",
      iconBgClass: "bg-amber-50 text-amber-600 border-amber-200/80",
      kind: "review",
    };
  }
  if (t.includes("booking")) {
    return {
      label: "Rezervare",
      badgeClass: "bg-ochre-light text-ochre border-ochre/25",
      iconBgClass: "bg-ochre-light text-ochre border-ochre/25",
      kind: "booking",
    };
  }

  return {
    label: "Sistem",
    badgeClass: "bg-slate-100 text-slate-700 border-slate-200",
    iconBgClass: "bg-slate-100 text-slate-600 border-slate-200",
    kind: "system",
  };
}

function NotificationTypeIcon({ kind }: { kind: TypeBadgeMeta["kind"] }) {
  switch (kind) {
    case "booking":
      return (
        <svg
          className="w-4 h-4"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
          <line x1="16" y1="2" x2="16" y2="6" />
          <line x1="8" y1="2" x2="8" y2="6" />
          <line x1="3" y1="10" x2="21" y2="10" />
        </svg>
      );
    case "payment":
      return (
        <svg
          className="w-4 h-4"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <rect x="2" y="5" width="20" height="14" rx="2" />
          <line x1="2" y1="10" x2="22" y2="10" />
        </svg>
      );
    case "dispute":
      return (
        <svg
          className="w-4 h-4"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
          <line x1="12" y1="9" x2="12" y2="13" />
          <line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
      );
    case "review":
      return (
        <svg
          className="w-4 h-4"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
        </svg>
      );
    default:
      return (
        <svg
          className="w-4 h-4"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
      );
  }
}

function formatFullTimestamp(isoDate: string): string {
  try {
    return new Intl.DateTimeFormat("ro-RO", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(isoDate));
  } catch {
    return isoDate;
  }
}

export function NotificationsPageClient({
  initialNotifications,
  initialUnreadCount,
  migrationMissing = false,
  emailMode,
}: NotificationsPageClientProps) {
  const [notifications, setNotifications] =
    useState<NotificationRecord[]>(initialNotifications);
  const [unreadCount, setUnreadCount] = useState<number>(initialUnreadCount);
  const [filter, setFilter] = useState<FilterTab>("all");
  const [markingId, setMarkingId] = useState<string | null>(null);
  const [markingAll, setMarkingAll] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const router = useRouter();

  const totalCount = notifications.length;
  const visibleNotifications =
    filter === "unread"
      ? notifications.filter((n) => !isNotificationRead(n))
      : notifications;

  async function handleMarkSingleRead(notification: NotificationRecord) {
    if (isNotificationRead(notification) || markingId === notification.id) {
      return;
    }

    setMarkingId(notification.id);
    setFeedback(null);

    // Actualizare optimistă
    setNotifications((prev) =>
      prev.map((item) =>
        item.id === notification.id ? markLocalNotificationRead(item) : item
      )
    );
    setUnreadCount((prev) => Math.max(0, prev - 1));

    try {
      const res = await markNotificationReadAction(notification.id);
      if (!res.success) {
        setFeedback(
          res.error || "Nu am putut marca notificarea ca citită. Încearcă din nou."
        );
      }
    } catch {
      setFeedback("Eroare de rețea la actualizarea notificării.");
    } finally {
      setMarkingId(null);
    }
  }

  async function handleOpenResource(notification: NotificationRecord) {
    if (!isNotificationRead(notification)) {
      await handleMarkSingleRead(notification);
    }
    if (notification.action_url) {
      router.push(notification.action_url);
    }
  }

  async function handleMarkAllRead() {
    if (unreadCount === 0 || markingAll) return;

    setMarkingAll(true);
    setFeedback(null);

    setNotifications((prev) => prev.map(markLocalNotificationRead));
    setUnreadCount(0);

    try {
      const res = await markAllNotificationsReadAction();
      if (!res.success) {
        setFeedback(
          res.error || "Nu am putut marca toate notificările ca citite."
        );
      } else {
        setFeedback("Toate notificările au fost marcate ca citite.");
      }
    } catch {
      setFeedback("Eroare de rețea la actualizarea notificărilor.");
    } finally {
      setMarkingAll(false);
    }
  }

  return (
    <div className="space-y-5">
      {/* 1. Banner migrație lipsă (dacă tabelul public.notifications nu a fost rulat încă) */}
      {migrationMissing && (
        <div className="rounded-2xl border border-amber-300 bg-amber-50/90 p-5 space-y-2">
          <div className="font-mono text-xs font-bold uppercase text-amber-800">
            [MIGRAȚIE SQL NECESARĂ // #NOTIF-006]
          </div>
          <h2 className="font-display text-base font-bold text-amber-950">
            Tabelul de notificări nu există încă în baza de date Supabase
          </h2>
          <p className="text-xs sm:text-sm text-amber-900 leading-relaxed">
            Pentru a activa centrul de notificări in-app și jurnalul de emailuri
            tranzacționale, rulează fișierul{" "}
            <code className="font-mono bg-amber-100 px-1.5 py-0.5 rounded border border-amber-200 font-semibold">
              supabase/migrations/006_notifications_and_emails.sql
            </code>{" "}
            în <strong>Supabase SQL Editor</strong>, apoi reîncarcă această
            pagină.
          </p>
        </div>
      )}

      {/* 2. Banner Status Canal Livrare (Resend Live vs Sandbox In-App) */}
      <div
        className={`rounded-2xl border p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
          emailMode === "resend"
            ? "bg-emerald-50/70 border-emerald-200"
            : "bg-slate-50 border-slate-200/90"
        }`}
      >
        <div className="flex items-start sm:items-center gap-3">
          <span
            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-bold shrink-0 ${
              emailMode === "resend"
                ? "bg-emerald-600 text-white"
                : "bg-amber-100 text-amber-900 border border-amber-200"
            }`}
          >
            {emailMode === "resend"
              ? "● RESEND EMAIL LIVE"
              : "● MOD IN-APP SANDBOX GRATUIT (Adaugă RESEND_API_KEY pentru emailuri automate)"}
          </span>
        </div>
        <p className="text-xs text-ink-muted">
          {emailMode === "resend"
            ? "Evenimentele tranzacționale sunt livrate instant în aplicație și pe email."
            : "Notificările apar instant în aplicație și în clopoțelul din header."}
        </p>
      </div>

      {/* 3. Bară de Filtre + Buton Marchează Toate Citite */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2" role="tablist" aria-label="Filtru notificări">
          <button
            type="button"
            role="tab"
            aria-selected={filter === "all"}
            onClick={() => setFilter("all")}
            className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-colors ${
              filter === "all"
                ? "bg-ochre text-white shadow-xs"
                : "bg-slate-100 text-ink-muted hover:bg-slate-200/70 hover:text-ink"
            }`}
          >
            Toate ({totalCount})
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={filter === "unread"}
            onClick={() => setFilter("unread")}
            className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-colors ${
              filter === "unread"
                ? "bg-ochre text-white shadow-xs"
                : "bg-slate-100 text-ink-muted hover:bg-slate-200/70 hover:text-ink"
            }`}
          >
            Necitite ({unreadCount})
          </button>
        </div>

        <button
          type="button"
          onClick={() => void handleMarkAllRead()}
          disabled={unreadCount === 0 || markingAll}
          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-ink disabled:opacity-45 disabled:cursor-not-allowed transition-colors"
        >
          <span>&#10003;</span>
          <span>
            {markingAll ? "Se marchează..." : "Marchează toate ca citite"}
          </span>
        </button>
      </div>

      {feedback && (
        <div className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-medium text-ink">
          {feedback}
        </div>
      )}

      {/* 4. Lista de Carduri de Notificări */}
      {visibleNotifications.length === 0 ? (
        <div className="bg-white border border-slate-200/90 rounded-2xl p-10 text-center space-y-2 shadow-xs">
          <div className="font-mono text-xs text-ink-light uppercase">
            {filter === "unread"
              ? "[NICIO NOTIFICARE NECITITĂ]"
              : "[ISTORIC NOTIFICĂRI GOL]"}
          </div>
          <h3 className="font-display text-lg font-bold text-ink">
            {filter === "unread"
              ? "Ești la zi cu toate notificările!"
              : "Nu ai primit încă nicio notificare"}
          </h3>
          <p className="text-xs sm:text-sm text-ink-muted max-w-md mx-auto">
            {filter === "unread"
              ? "Toate alertele tranzacționale au fost parcurse. Poți comuta pe fila „Toate” pentru a revedea istoricul complet."
              : "Când primești o cerere de rezervare, o confirmare de plată Escrow, o recenzie nouă sau o actualizare de dispută, aceasta va apărea aici."}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {visibleNotifications.map((notification) => {
            const read = isNotificationRead(notification);
            const body = getNotificationBody(notification);
            const meta = getNotificationTypeMeta(String(notification.type));

            return (
              <article
                key={notification.id}
                className={`rounded-2xl border p-4 sm:p-5 transition-all shadow-2xs ${
                  read
                    ? "bg-white border-slate-200/90"
                    : "bg-ochre-light/30 border-ochre/35"
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-start gap-4">
                  {/* Iconiță pe tip */}
                  <div
                    className={`w-10 h-10 rounded-xl border flex items-center justify-center shrink-0 ${meta.iconBgClass}`}
                  >
                    <NotificationTypeIcon kind={meta.kind} />
                  </div>

                  {/* Conținut */}
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full border text-[11px] font-semibold ${meta.badgeClass}`}
                      >
                        {meta.label}
                      </span>

                      {!read ? (
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-ochre text-white text-[10px] font-bold uppercase tracking-wide">
                          <span
                            aria-hidden="true"
                            className="w-1.5 h-1.5 rounded-full bg-white"
                          />
                          Necitită
                        </span>
                      ) : (
                        <span className="text-[11px] font-medium text-ink-light">
                          Citită
                        </span>
                      )}

                      <time
                        dateTime={notification.created_at}
                        className="text-xs text-ink-light sm:ml-auto font-mono"
                      >
                        {formatFullTimestamp(notification.created_at)}
                      </time>
                    </div>

                    <h3
                      className={`font-display text-sm sm:text-base text-ink ${
                        read ? "font-semibold" : "font-bold"
                      }`}
                    >
                      {notification.title}
                    </h3>

                    {body && (
                      <p className="text-xs sm:text-sm text-ink-muted leading-relaxed">
                        {body}
                      </p>
                    )}

                    {/* Acțiuni card */}
                    <div className="pt-2 flex flex-wrap items-center gap-2.5">
                      {notification.action_url && (
                        <button
                          type="button"
                          onClick={() => void handleOpenResource(notification)}
                          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-ochre hover:bg-ochre-hover text-white text-xs font-semibold shadow-2xs transition-colors"
                        >
                          <span>Deschide resursa</span>
                          <span aria-hidden="true">&rarr;</span>
                        </button>
                      )}

                      {!read && (
                        <button
                          type="button"
                          onClick={() => void handleMarkSingleRead(notification)}
                          disabled={markingId === notification.id}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full border border-slate-200 bg-white hover:bg-slate-50 text-xs font-medium text-ink-muted hover:text-ink disabled:opacity-50 transition-colors"
                        >
                          {markingId === notification.id
                            ? "Se marchează..."
                            : "Marchează ca citită"}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
