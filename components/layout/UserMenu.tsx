"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bell,
  Building2,
  Calendar,
  CreditCard,
  Database,
  Heart,
  LogOut,
  Menu,
  Plus,
  ShieldCheck,
  ShoppingBag,
  User,
} from "lucide-react";
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
  isAdmin?: boolean;
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
  isAdmin = false,
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
        {/* Stânga: Iconiță hamburger */}
        <Menu
          className="w-4 h-4 text-ink-muted shrink-0"
          strokeWidth={1.8}
          aria-hidden="true"
        />

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
              <span className="mt-1 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-ochre-light text-ochre">
                {accountType === "company" ? (
                  <>
                    <Building2
                      className="w-3 h-3 shrink-0"
                      strokeWidth={1.8}
                      aria-hidden="true"
                    />
                    <span>Cont Business</span>
                  </>
                ) : (
                  <>
                    <User
                      className="w-3 h-3 shrink-0"
                      strokeWidth={1.8}
                      aria-hidden="true"
                    />
                    <span>Cont Personal</span>
                  </>
                )}
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
            <Calendar
              className="w-4 h-4 text-ink-muted shrink-0"
              strokeWidth={1.8}
              aria-hidden="true"
            />
            <span>Rezervările mele</span>
          </Link>
          <Link
            href="/favorite"
            role="menuitem"
            onClick={() => setOpen(false)}
            className="flex items-center justify-between gap-3 px-4 py-2 text-sm font-medium text-ink hover:bg-slate-50 transition-colors"
          >
            <span className="flex items-center gap-3">
              <Heart
                className="w-4 h-4 text-rose-500 shrink-0"
                strokeWidth={1.8}
                aria-hidden="true"
              />
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
            <ShoppingBag
              className="w-4 h-4 text-ink-muted shrink-0"
              strokeWidth={1.8}
              aria-hidden="true"
            />
            <span>Inventarul meu</span>
          </Link>
          <Link
            href="/listarile-mele/nou"
            role="menuitem"
            onClick={() => setOpen(false)}
            className="flex items-center gap-3 px-4 py-2 text-sm font-semibold text-ochre hover:bg-ochre-light/50 transition-colors"
          >
            <Plus
              className="w-4 h-4 text-ochre shrink-0"
              strokeWidth={1.8}
              aria-hidden="true"
            />
            <span>Adaugă obiect nou</span>
          </Link>
          <Link
            href="/profil/plati"
            role="menuitem"
            onClick={() => setOpen(false)}
            className="flex items-center gap-3 px-4 py-2 text-sm font-medium text-ink hover:bg-slate-50 transition-colors"
          >
            <CreditCard
              className="w-4 h-4 text-ink-muted shrink-0"
              strokeWidth={1.8}
              aria-hidden="true"
            />
            <span>Plăți &amp; Încasări</span>
          </Link>

          <div className="border-t border-slate-100 my-1.5" />

          {/* Secțiunea 4: Cont & Sistem */}
          <Link
            href="/notificari"
            role="menuitem"
            onClick={() => setOpen(false)}
            className="flex items-center gap-3 px-4 py-2 text-sm font-medium text-ink hover:bg-slate-50 transition-colors"
          >
            <Bell
              className="w-4 h-4 text-ink-muted shrink-0"
              strokeWidth={1.8}
              aria-hidden="true"
            />
            <span>Notificări</span>
          </Link>
          <Link
            href="/profil"
            role="menuitem"
            onClick={() => setOpen(false)}
            className="flex items-center gap-3 px-4 py-2 text-sm font-medium text-ink hover:bg-slate-50 transition-colors"
          >
            <User
              className="w-4 h-4 text-ink-muted shrink-0"
              strokeWidth={1.8}
              aria-hidden="true"
            />
            <span>Profil &amp; setări</span>
          </Link>
          {isAdmin && (
            <Link
              href="/admin"
              role="menuitem"
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 px-4 py-2 text-sm font-semibold text-ochre hover:bg-ochre-light/60 transition-colors"
            >
              <ShieldCheck
                className="w-4 h-4 text-ochre shrink-0"
                strokeWidth={1.8}
                aria-hidden="true"
              />
              <span>Panou Admin</span>
            </Link>
          )}
          {showStatusDb && (
            <Link
              href="/status-db"
              role="menuitem"
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 px-4 py-2 text-sm font-medium text-ink-muted hover:bg-slate-50 hover:text-ink transition-colors"
            >
              <Database
                className="w-4 h-4 text-ink-muted shrink-0"
                strokeWidth={1.8}
                aria-hidden="true"
              />
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
              <LogOut
                className="w-4 h-4 text-rose-500 shrink-0"
                strokeWidth={1.8}
                aria-hidden="true"
              />
              <span>Delogare din cont</span>
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
