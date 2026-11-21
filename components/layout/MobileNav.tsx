"use client";

import { useState } from "react";
import Link from "next/link";
import { signOutAction } from "@/app/actions/auth";
import { FavoriteNavBadge } from "@/components/catalog/FavoriteNavBadge";

/**
 * Meniu de Navigație pentru Dispozitive Mobile (`components/layout/MobileNav.tsx`).
 *
 * Explicație pentru dezvoltatori C / Java:
 * - Componenta `Header.tsx` este un Server Component (nu poate avea stare `open` în browser).
 * - Extragem meniul colapsabil pentru mobil într-un Client Component dedicat (`"use client"`),
 *   organizat pe aceleași secțiuni semantice ca `UserMenu.tsx` (Explorează, Ca Chiriaș,
 *   Ca Proprietar, Cont & Sistem).
 */
export interface MobileNavProps {
  userEmail: string | null;
  displayName?: string | null;
  accountType?: "individual" | "company";
  showStatusDb: boolean;
}

export function MobileNav({
  userEmail,
  displayName,
  accountType = "individual",
  showStatusDb,
}: MobileNavProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="md:hidden">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        aria-label="Deschide meniul de navigare"
        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-full border border-slate-200 bg-white text-xs font-semibold text-ink hover:bg-slate-50 transition-colors shadow-2xs"
      >
        {open ? "✕ Închide" : "☰ Meniu"}
      </button>

      {open && (
        <div className="absolute left-0 right-0 top-16 border-b border-slate-200 bg-white shadow-xl z-40 px-4 py-5 space-y-4 rounded-b-2xl">
          {/* Căutare rapidă pe mobil */}
          <form
            action="/catalog"
            method="GET"
            onSubmit={() => setOpen(false)}
            className="flex items-center bg-slate-100 rounded-full px-3.5 py-2 border border-slate-200/80"
          >
            <input
              type="search"
              name="q"
              placeholder="Caută echipamente, unelte..."
              aria-label="Caută produse în catalog"
              className="w-full bg-transparent text-sm text-ink placeholder:text-ink-muted focus:outline-none"
            />
            <button
              type="submit"
              className="text-xs font-semibold text-ochre px-2 py-1"
            >
              Caută
            </button>
          </form>

          {/* Identitate utilizator (dacă este autentificat) */}
          {userEmail && (
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="font-display font-bold text-sm text-ink truncate">
                  {displayName || userEmail}
                </p>
                <p className="text-xs text-ink-muted truncate">{userEmail}</p>
              </div>
              <span className="shrink-0 inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-ochre-light text-ochre">
                {accountType === "company" ? "🏢 B2C" : "🤝 P2P"}
              </span>
            </div>
          )}

          {/* Grup 1: Explorare Catalog */}
          <div className="space-y-1">
            <p className="px-2 text-[10px] font-mono uppercase tracking-wider text-ink-light font-semibold">
              Explorează
            </p>
            <nav className="flex flex-col gap-1 text-sm font-medium">
              <Link
                href="/catalog"
                onClick={() => setOpen(false)}
                className="px-3.5 py-2 rounded-xl bg-slate-50 hover:bg-ochre-light hover:text-ochre text-ink transition-colors"
              >
                📦 Catalog Produse
              </Link>
              <Link
                href="/catalog?segment=individual"
                onClick={() => setOpen(false)}
                className="px-3.5 py-2 rounded-xl bg-slate-50 hover:bg-ochre-light hover:text-ochre text-ink transition-colors"
              >
                🤝 Segment P2P (Comunitate)
              </Link>
              <Link
                href="/catalog?segment=company"
                onClick={() => setOpen(false)}
                className="px-3.5 py-2 rounded-xl bg-slate-50 hover:bg-ochre-light hover:text-ochre text-ink transition-colors"
              >
                🏢 Segment Firme Verificate
              </Link>
            </nav>
          </div>

          {/* Grup 2: Ca Chiriaș */}
          <div className="space-y-1">
            <p className="px-2 text-[10px] font-mono uppercase tracking-wider text-ink-light font-semibold">
              Ca Chiriaș
            </p>
            <nav className="flex flex-col gap-1 text-sm font-medium">
              <Link
                href="/rezervarile-mele"
                onClick={() => setOpen(false)}
                className="px-3.5 py-2 rounded-xl bg-slate-50 hover:bg-ochre-light hover:text-ochre text-ink transition-colors"
              >
                📅 Rezervările mele
              </Link>
              <Link
                href="/favorite"
                onClick={() => setOpen(false)}
                className="px-3.5 py-2 rounded-xl bg-slate-50 hover:bg-rose-50 hover:text-rose-600 text-ink transition-colors flex items-center justify-between"
              >
                <span>❤️ Favorite &amp; Salvate</span>
                <FavoriteNavBadge />
              </Link>
            </nav>
          </div>

          {/* Grup 3: Ca Proprietar */}
          <div className="space-y-1">
            <p className="px-2 text-[10px] font-mono uppercase tracking-wider text-ink-light font-semibold">
              Ca Proprietar
            </p>
            <nav className="flex flex-col gap-1 text-sm font-medium">
              <Link
                href="/listarile-mele"
                onClick={() => setOpen(false)}
                className="px-3.5 py-2 rounded-xl bg-slate-50 hover:bg-ochre-light hover:text-ochre text-ink transition-colors"
              >
                🏷️ Inventarul meu
              </Link>
              <Link
                href="/listarile-mele/nou"
                onClick={() => setOpen(false)}
                className="px-3.5 py-2 rounded-xl bg-ochre-light/70 hover:bg-ochre-light text-ochre font-semibold transition-colors"
              >
                + Adaugă obiect nou
              </Link>
            </nav>
          </div>

          {/* Grup 4: Cont & Sistem */}
          <div className="pt-3 border-t border-slate-200 flex flex-col gap-2 text-xs font-medium">
            {userEmail ? (
              <>
                <Link
                  href="/profil"
                  onClick={() => setOpen(false)}
                  className="p-2.5 rounded-xl bg-slate-100 hover:bg-slate-200/70 text-ink text-center font-semibold transition-colors"
                >
                  👤 Profil &amp; setări
                </Link>
                {showStatusDb && (
                  <Link
                    href="/status-db"
                    onClick={() => setOpen(false)}
                    className="p-2 rounded-xl bg-slate-50 hover:bg-slate-100 text-ink-muted text-center font-mono transition-colors"
                  >
                    ⚙️ Diagnostic DB (/status-db)
                  </Link>
                )}
                <form action={signOutAction}>
                  <button
                    type="submit"
                    className="w-full p-2.5 rounded-xl border border-rose-200 bg-rose-50/60 hover:bg-rose-100 text-rose-600 font-semibold transition-colors"
                  >
                    Delogare din cont
                  </button>
                </form>
              </>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                <Link
                  href="/login"
                  onClick={() => setOpen(false)}
                  className="p-2.5 rounded-full border border-slate-200 bg-white text-center text-ink font-semibold"
                >
                  Autentificare
                </Link>
                <Link
                  href="/inregistrare"
                  onClick={() => setOpen(false)}
                  className="p-2.5 rounded-full bg-ochre text-white text-center font-semibold shadow-xs"
                >
                  Cont Nou
                </Link>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
