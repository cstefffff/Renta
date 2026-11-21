"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  getMyNotificationsAction,
  markAllNotificationsReadAction,
  markNotificationReadAction,
} from "@/app/actions/notifications";
import type { NotificationRecord } from "@/lib/types/database";

/**
 * Clopoțel Notificări In-App pentru Header (`components/layout/NotificationBell.tsx`).
 *
 * Explicație pentru dezvoltatori C / Java:
 * - Este un Client Component (`"use client"`) deoarece gestionează stare locală
 *   (`open`, lista de notificări, `unreadCount`) și ascultă evenimente din DOM
 *   (`pointerdown` pentru click în exterior și `keydown` pentru tasta `Escape`),
 *   similar unui `JPopupMenu` atașat unui `JButton` în Java Swing.
 * - La montare și la fiecare schimbare de rută (`pathname`), invocă Server Action-ul
 *   `getMyNotificationsAction(8)` pentru a sincroniza badge-ul de notificări necitite.
 */

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

function getShortTypeLabel(type: string): string {
  const t = type.toLowerCase();
  if (t.includes("payment") || t.includes("payout") || t.includes("escrow")) {
    return "Plată / Escrow";
  }
  if (t.includes("dispute")) {
    return "Dispută";
  }
  if (t.includes("review")) {
    return "Recenzie";
  }
  if (t.includes("booking")) {
    return "Rezervare";
  }
  return "Sistem";
}

function formatShortTimestamp(isoDate: string): string {
  try {
    return new Intl.DateTimeFormat("ro-RO", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(isoDate));
  } catch {
    return "";
  }
}

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationRecord[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [markingAll, setMarkingAll] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const pathname = usePathname();
  const router = useRouter();

  const loadNotifications = useCallback(async () => {
    try {
      const result = await getMyNotificationsAction(8);
      setNotifications(result.notifications ?? []);
      setUnreadCount(result.unreadCount ?? 0);
    } catch {
      // Menținem interfața stabilă chiar dacă există o eroare tranzitorie de rețea
    } finally {
      setLoading(false);
    }
  }, []);

  // 1. Încărcăm notificările la montare și reîncărcăm la schimbarea rutei; închidem dropdown-ul
  useEffect(() => {
    setOpen(false);
    void loadNotifications();
  }, [pathname, loadNotifications]);

  // 2. Închidem dropdown-ul la click în exterior (`pointerdown`) sau la tasta `Escape`
  useEffect(() => {
    if (!open) return;

    const handlePointerDown = (event: PointerEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  async function handleNotificationClick(notification: NotificationRecord) {
    const alreadyRead = isNotificationRead(notification);

    if (!alreadyRead) {
      // Actualizare optimistă în UI înainte de răspunsul serverului
      setNotifications((prev) =>
        prev.map((item) =>
          item.id === notification.id ? markLocalNotificationRead(item) : item
        )
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));

      try {
        await markNotificationReadAction(notification.id);
      } catch {
        // Dacă eșuează, re-sincronizăm starea la următoarea încărcare
      }
    }

    setOpen(false);
    const targetUrl = notification.action_url || "/notificari";
    router.push(targetUrl);
  }

  async function handleMarkAllRead() {
    if (unreadCount === 0 || markingAll) return;

    setMarkingAll(true);
    setNotifications((prev) => prev.map(markLocalNotificationRead));
    setUnreadCount(0);

    try {
      await markAllNotificationsReadAction();
    } catch {
      await loadNotifications();
    } finally {
      setMarkingAll(false);
    }
  }

  return (
    <div ref={containerRef} className="relative">
      {/* Buton Clopoțel */}
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label="Notificări"
        title="Notificări"
        className="relative w-9 h-9 rounded-full border border-slate-200 bg-white hover:bg-slate-50 hover:border-slate-300 flex items-center justify-center text-ink-muted hover:text-ink transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ochre"
      >
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

        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-ochre text-white text-[10px] font-bold flex items-center justify-center ring-2 ring-white">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown Flotant */}
      {open && (
        <div
          role="dialog"
          aria-label="Panou notificări"
          className="absolute right-0 top-full mt-2 w-80 sm:w-96 rounded-2xl border border-slate-200/90 bg-white shadow-xl z-50 overflow-hidden"
        >
          {/* Antet Dropdown */}
          <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="font-display font-bold text-sm text-ink">
                Notificări
              </span>
              {unreadCount > 0 && (
                <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-ochre-light text-ochre text-[11px] font-bold">
                  {unreadCount}
                </span>
              )}
            </div>

            {unreadCount > 0 && (
              <button
                type="button"
                onClick={handleMarkAllRead}
                disabled={markingAll}
                className="text-[11px] font-semibold text-ochre hover:text-ochre-hover disabled:opacity-50 transition-colors"
              >
                {markingAll ? "Se actualizează..." : "Marchează toate citite"}
              </button>
            )}
          </div>

          {/* Listă Notificări */}
          <div className="max-h-96 overflow-y-auto divide-y divide-slate-100">
            {loading ? (
              <div className="px-4 py-8 text-center text-xs text-ink-muted">
                Se încarcă notificările...
              </div>
            ) : notifications.length === 0 ? (
              <div className="px-4 py-8 text-center space-y-1.5">
                <p className="text-sm font-semibold text-ink">
                  Nicio notificare încă
                </p>
                <p className="text-xs text-ink-muted">
                  Vei vedea aici actualizările despre rezervări, plăți Escrow,
                  dispute și recenzii.
                </p>
              </div>
            ) : (
              notifications.map((n) => {
                const read = isNotificationRead(n);
                const body = getNotificationBody(n);

                return (
                  <button
                    key={n.id}
                    type="button"
                    onClick={() => void handleNotificationClick(n)}
                    className={`w-full text-left px-4 py-3 flex items-start gap-3 hover:bg-slate-50 transition-colors ${
                      read ? "bg-white" : "bg-ochre-light/40"
                    }`}
                  >
                    {/* Indicator stare necitită (punct verde-smarald) */}
                    <span
                      aria-hidden="true"
                      className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${
                        read ? "bg-transparent" : "bg-ochre"
                      }`}
                    />

                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[10px] font-mono uppercase tracking-wider font-semibold text-ochre">
                          {getShortTypeLabel(String(n.type))}
                        </span>
                        <span className="text-[11px] text-ink-light shrink-0">
                          {formatShortTimestamp(n.created_at)}
                        </span>
                      </div>

                      <p
                        className={`text-xs leading-snug line-clamp-1 ${
                          read
                            ? "font-medium text-ink"
                            : "font-bold text-ink"
                        }`}
                      >
                        {n.title}
                      </p>

                      {body && (
                        <p className="text-xs text-ink-muted line-clamp-2 leading-relaxed">
                          {body}
                        </p>
                      )}
                    </div>
                  </button>
                );
              })
            )}
          </div>

          {/* Subsol Dropdown */}
          <div className="px-4 py-2.5 border-t border-slate-100 bg-slate-50/70">
            <Link
              href="/notificari"
              onClick={() => setOpen(false)}
              className="block w-full text-center text-xs font-semibold text-ochre hover:text-ochre-hover transition-colors py-1"
            >
              Vezi toate notificările &rarr;
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
