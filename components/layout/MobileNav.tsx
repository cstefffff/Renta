"use client";

import { useState } from "react";
import Link from "next/link";
import { signOutAction } from "@/app/actions/auth";

/**
 * Meniu de Navigație pentru Dispozitive Mobile (`components/layout/MobileNav.tsx`).
 *
 * Explicație pentru C/Java:
 * - Componenta `Header.tsx` este un Server Component (nu poate avea stare `open` în browser).
 * - Extragem meniul colapsabil pentru mobil într-un Client Component dedicat (`"use client"`),
 *   stilizat cu suprafețe albe curate, colțuri rotunjite și accente Emerald Teal.
 */
interface MobileNavProps {
  userEmail: string | null;
  showStatusDb: boolean;
}

export function MobileNav({ userEmail, showStatusDb }: MobileNavProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="md:hidden">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        aria-label="Deschide meniul de navigare"
        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-ink hover:bg-slate-50 transition-colors shadow-2xs"
      >
        {open ? "✕ Închide" : "☰ Meniu"}
      </button>

      {open && (
        <div className="absolute left-0 right-0 top-16 border-b border-slate-200 bg-white shadow-lg z-40 px-4 py-5 space-y-4 rounded-b-2xl">
          {/* Căutare rapidă pe mobil */}
          <form
            action="/catalog"
            method="GET"
            onSubmit={() => setOpen(false)}
            className="flex items-center bg-slate-100 rounded-xl px-3 py-2 border border-slate-200/80"
          >
            <input
              type="search"
              name="q"
              placeholder="Caută echipamente, unelte..."
              className="w-full bg-transparent text-sm text-ink placeholder:text-ink-muted focus:outline-none"
            />
            <button
              type="submit"
              className="text-xs font-semibold text-ochre px-2 py-1"
            >
              Caută
            </button>
          </form>

          <nav className="flex flex-col gap-1.5 text-sm font-medium">
            <Link
              href="/catalog"
              onClick={() => setOpen(false)}
              className="px-3.5 py-2.5 rounded-xl bg-slate-50 hover:bg-ochre-light hover:text-ochre text-ink transition-colors"
            >
              📦 Catalog Produse
            </Link>
            <Link
              href="/catalog?segment=individual"
              onClick={() => setOpen(false)}
              className="px-3.5 py-2.5 rounded-xl bg-slate-50 hover:bg-ochre-light hover:text-ochre text-ink transition-colors"
            >
              🤝 Segment P2P (Comunitate)
            </Link>
            <Link
              href="/catalog?segment=company"
              onClick={() => setOpen(false)}
              className="px-3.5 py-2.5 rounded-xl bg-slate-50 hover:bg-ochre-light hover:text-ochre text-ink transition-colors"
            >
              🏢 Segment Firme Verificate
            </Link>
            <Link
              href="/listarile-mele"
              onClick={() => setOpen(false)}
              className="px-3.5 py-2.5 rounded-xl bg-slate-50 hover:bg-ochre-light hover:text-ochre text-ink transition-colors"
            >
              🏷️ Inventarul Meu
            </Link>
            <Link
              href="/rezervarile-mele"
              onClick={() => setOpen(false)}
              className="px-3.5 py-2.5 rounded-xl bg-slate-50 hover:bg-ochre-light hover:text-ochre text-ink transition-colors"
            >
              📅 Rezervările Mele
            </Link>
            {showStatusDb && (
              <Link
                href="/status-db"
                onClick={() => setOpen(false)}
                className="px-3.5 py-2.5 rounded-xl bg-slate-50 hover:bg-slate-100 text-ink-muted text-xs font-mono transition-colors"
              >
                ⚙️ Diagnostic DB (/status-db)
              </Link>
            )}
          </nav>

          <div className="pt-3 border-t border-slate-200 flex flex-col gap-2 text-xs font-medium">
            {userEmail ? (
              <>
                <Link
                  href="/profil"
                  onClick={() => setOpen(false)}
                  className="p-2.5 rounded-xl bg-ochre-light text-ochre text-center font-semibold"
                >
                  Cont activ: {userEmail}
                </Link>
                <form action={signOutAction}>
                  <button
                    type="submit"
                    className="w-full p-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 text-ink font-medium transition-colors"
                  >
                    Delogare din Cont
                  </button>
                </form>
              </>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                <Link
                  href="/login"
                  onClick={() => setOpen(false)}
                  className="p-2.5 rounded-xl border border-slate-200 bg-white text-center text-ink font-semibold"
                >
                  Autentificare
                </Link>
                <Link
                  href="/inregistrare"
                  onClick={() => setOpen(false)}
                  className="p-2.5 rounded-xl bg-ochre text-white text-center font-semibold shadow-xs"
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
