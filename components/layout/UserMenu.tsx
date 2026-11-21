"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOutAction } from "@/app/actions/auth";
import { useFavorites } from "@/lib/favorites/useFavorites";

/**
 * Meniu Cont Utilizator în stil „Airbnb Pill” (`components/layout/UserMenu.tsx`).
 *
 * Explicație pentru dezvoltatori C / Java:
 * - Gândește-te la `UserMenu` ca la un widget de tip `PopupMenu` (ca `JPopupMenu` în Swing)
 *   care condensează toate acțiunile utilizatorului (Rezervări, Favorite, Inventar,
 *   Adăugare obiect nou, Profil și Delogare) într-un singur buton tip pastilă (`rounded-full`).
 * - Folosim trei hook-uri `useEffect` pentru ergonomia nativă:
 *   1. Închidere automată când se schimbă ruta (`pathname`).
 *   2. Închidere la click în afara containerului (`pointerdown` pe `document`).
 *   3. Închidere la tasta `Escape` cu restaurarea focusului pe butonul declanșator (`triggerRef`).
 */
export interface UserMenuProps {
  email: string;
  displayName: string;
  accountType: "individual" | "company";
  avatarUrl: string | null;
  showStatusDb: boolean;
}

/**
 * Calculează inițialele utilizatorului din `displayName` sau `email`
 * (ex: `"Andrei Popescu"` -> `"AP"`, `"andrei@renta.ro"` -> `"AN"`).
 */
function computeInitials(displayName: string, email: string): string {
  const cleanName = displayName.trim();
  if (cleanName.length > 0 && !cleanName.includes("@")) {
    const parts = cleanName.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
    }
    return cleanName.slice(0, 2).toUpperCase();
  }
  const emailPrefix = email.split("@")[0] || "RA";
  return emailPrefix.slice(0, 2).toUpperCase();
}

export function UserMenu({
  email,
  displayName,
  accountType,
  avatarUrl,
  showStatusDb,
}: UserMenuProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const pathname = usePathname();
  const { count, hydrated } = useFavorites();

  const initials = computeInitials(displayName, email);

  // 1. Închidem meniul automat la schimbarea rutei
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // 2. Închidem meniul la click în afara containerului sau la apăsarea tastei Escape
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

  return (
    <div ref={containerRef} className="relative">
      {/* Trigger Button („Airbnb Pill”) */}
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={`Meniu cont: ${displayName}`}
        className="inline-flex items-center gap-2.5 pl-3 pr-1.5 py-1 rounded-full border border-slate-200 bg-white hover:border-slate-300 hover:shadow-md transition-all focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ochre"
      >
        {/* Stânga: Iconiță hamburger ☰ */}
        <svg
          className="w-4 h-4 text-ink-muted"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <line x1="3" y1="6" x2="21" y2="6" />
          <line x1="3" y1="12" x2="21" y2="12" />
          <line x1="3" y1="18" x2="21" y2="18" />
        </svg>

        {/* Dreapta: Avatar rotund + punct verde de sesiune activă */}
        <span className="relative">
          <span className="w-8 h-8 rounded-full bg-ochre text-white text-xs font-bold flex items-center justify-center relative overflow-hidden">
            {avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={avatarUrl}
                alt={displayName}
                className="w-full h-full object-cover"
              />
            ) : (
              <span>{initials}</span>
            )}
          </span>
          <span
            aria-hidden="true"
            title="Sesiune activă"
            className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-white"
          />
        </span>
      </button>

      {/* Dropdown Card Flotant */}
      {open && (
        <div
          role="menu"
          aria-label="Meniu cont utilizator"
          className="absolute right-0 top-full mt-2 w-72 bg-white rounded-2xl border border-slate-200/90 shadow-xl py-2 z-50"
        >
          {/* Secțiunea 1: Antet Identitate */}
          <div className="px-4 py-3 flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-ochre text-white text-xs font-bold flex items-center justify-center shrink-0 overflow-hidden">
              {avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={avatarUrl}
                  alt={displayName}
                  className="w-full h-full object-cover"
                />
              ) : (
                <span>{initials}</span>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-display font-bold text-sm text-ink truncate">
                {displayName}
              </p>
              <p className="text-xs text-ink-muted truncate">{email}</p>
              <span className="mt-1 inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-ochre-light text-ochre">
                {accountType === "company"
                  ? "🏢 Cont Firmă B2C"
                  : "🤝 Cont P2P"}
              </span>
            </div>
          </div>

          <div className="border-t border-slate-100 my-1.5" />

          {/* Secțiunea 2: Ca Chiriaș */}
          <div className="px-4 pt-1 pb-0.5">
            <span className="text-[10px] font-mono uppercase tracking-wider text-ink-light font-semibold">
              Ca Chiriaș
            </span>
          </div>
          <Link
            href="/rezervarile-mele"
            role="menuitem"
            onClick={() => setOpen(false)}
            className="flex items-center gap-3 px-4 py-2 text-sm font-medium text-ink hover:bg-slate-50 transition-colors"
          >
            <svg
              className="w-4 h-4 text-ink-muted shrink-0"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.9"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
              <line x1="16" y1="2" x2="16" y2="6" />
              <line x1="8" y1="2" x2="8" y2="6" />
              <line x1="3" y1="10" x2="21" y2="10" />
            </svg>
            <span>Rezervările mele</span>
          </Link>
          <Link
            href="/favorite"
            role="menuitem"
            onClick={() => setOpen(false)}
            className="flex items-center justify-between gap-3 px-4 py-2 text-sm font-medium text-ink hover:bg-slate-50 transition-colors"
          >
            <span className="flex items-center gap-3">
              <svg
                className="w-4 h-4 text-rose-500 shrink-0"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.9"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
              </svg>
              <span>Favorite &amp; Salvate</span>
            </span>
            {hydrated && count > 0 && (
              <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-rose-500 text-white text-[11px] font-bold">
                {count > 99 ? "99+" : count}
              </span>
            )}
          </Link>

          <div className="border-t border-slate-100 my-1.5" />

          {/* Secțiunea 3: Ca Proprietar */}
          <div className="px-4 pt-1 pb-0.5">
            <span className="text-[10px] font-mono uppercase tracking-wider text-ink-light font-semibold">
              Ca Proprietar
            </span>
          </div>
          <Link
            href="/listarile-mele"
            role="menuitem"
            onClick={() => setOpen(false)}
            className="flex items-center gap-3 px-4 py-2 text-sm font-medium text-ink hover:bg-slate-50 transition-colors"
          >
            <svg
              className="w-4 h-4 text-ink-muted shrink-0"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.9"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
              <line x1="3" y1="6" x2="21" y2="6" />
              <path d="M16 10a4 4 0 0 1-8 0" />
            </svg>
            <span>Inventarul meu</span>
          </Link>
          <Link
            href="/listarile-mele/nou"
            role="menuitem"
            onClick={() => setOpen(false)}
            className="flex items-center gap-3 px-4 py-2 text-sm font-semibold text-ochre hover:bg-ochre-light/50 transition-colors"
          >
            <svg
              className="w-4 h-4 text-ochre shrink-0"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            <span>+ Adaugă obiect nou</span>
          </Link>

          <div className="border-t border-slate-100 my-1.5" />

          {/* Secțiunea 4: Cont & Sistem */}
          <Link
            href="/profil"
            role="menuitem"
            onClick={() => setOpen(false)}
            className="flex items-center gap-3 px-4 py-2 text-sm font-medium text-ink hover:bg-slate-50 transition-colors"
          >
            <svg
              className="w-4 h-4 text-ink-muted shrink-0"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.9"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
            <span>Profil &amp; setări</span>
          </Link>
          {showStatusDb && (
            <Link
              href="/status-db"
              role="menuitem"
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 px-4 py-2 text-sm font-medium text-ink-muted hover:bg-slate-50 hover:text-ink transition-colors"
            >
              <svg
                className="w-4 h-4 text-ink-muted shrink-0"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.9"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <ellipse cx="12" cy="5" rx="9" ry="3" />
                <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" />
                <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
              </svg>
              <span>Diagnostic DB</span>
            </Link>
          )}

          <div className="border-t border-slate-100 my-1.5" />

          {/* Secțiunea 5: Ieșire */}
          <form action={signOutAction}>
            <button
              type="submit"
              className="w-full flex items-center gap-3 px-4 py-2 text-sm font-medium text-rose-600 hover:bg-rose-50 transition-colors"
            >
              <svg
                className="w-4 h-4 text-rose-500 shrink-0"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.9"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
              <span>Delogare din cont</span>
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
