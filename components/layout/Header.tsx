import Link from "next/link";
import { BrandLogo } from "@/components/ui/BrandLogo";
import { MobileNav } from "@/components/layout/MobileNav";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";
import { signOutAction } from "@/app/actions/auth";

/**
 * Bara superioară orizontală (`Header.tsx` — Async Server Component).
 *
 * Explicație pentru C/Java:
 * - Această componentă rulează pe server la fiecare cerere, verifică sesiunea
 *   activă din Supabase și randează antetul modern în stilul "Corelystics Store":
 *   1. Stânga: Breadcrumb (`RentA Store › Catalog & Închirieri`)
 *   2. Centru: Bară de căutare rotunjită cu lupă SVG, `name="q"` și scurtătura `⌘ + F`
 *   3. Dreapta: Selector țară (`🇷🇴 RO`), acces rapid Rezervări/Inventar și Cont
 */
export async function Header() {
  const configured = isSupabaseConfigured();
  const showStatusDb = process.env.NODE_ENV !== "production";
  let userEmail: string | null = null;

  if (configured) {
    try {
      const supabase = await createClient();
      if (supabase) {
        const { data } = await supabase.auth.getUser();
        userEmail = data.user?.email ?? null;
      }
    } catch {
      userEmail = null;
    }
  }

  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-30 h-16">
      <div className="px-4 sm:px-6 lg:px-8 h-full flex items-center justify-between gap-4 relative">
        {/* Stânga: Brand (pe mobil) + Breadcrumb modern ("RentA Store › Catalog & Închirieri") */}
        <div className="flex items-center gap-3 min-w-0">
          <div className="md:hidden">
            <BrandLogo showTag={false} />
          </div>

          <nav
            aria-label="Breadcrumb"
            className="hidden md:flex items-center gap-2 text-sm"
          >
            <Link
              href="/"
              className="font-display font-bold text-ink hover:text-ochre transition-colors"
            >
              RentA Store
            </Link>
            <span className="text-ink-light select-none">›</span>
            <Link
              href="/catalog"
              className="font-semibold text-ochre hover:text-ochre-hover transition-colors"
            >
              Catalog &amp; Închirieri
            </Link>
          </nav>
        </div>

        {/* Centru: Bară de căutare globală rotunjită cu badge `⌘ + F` */}
        <form
          action="/catalog"
          method="GET"
          className="hidden md:flex items-center w-full max-w-md bg-slate-100/90 hover:bg-slate-100 focus-within:bg-white focus-within:ring-2 focus-within:ring-ochre/20 border border-transparent focus-within:border-ochre rounded-xl px-3.5 py-2 transition-all"
        >
          <svg
            className="w-4 h-4 text-ink-muted shrink-0 mr-2.5"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="search"
            name="q"
            placeholder="Caută echipamente, unelte, #OBJ..."
            aria-label="Caută produse în catalog"
            className="w-full bg-transparent text-sm text-ink placeholder:text-ink-muted focus:outline-none"
          />
          <kbd className="hidden lg:inline-flex items-center gap-0.5 px-2 py-0.5 text-[11px] font-mono font-medium text-ink-muted bg-white border border-slate-200 rounded-md shadow-2xs shrink-0">
            ⌘ + F
          </kbd>
        </form>

        {/* Dreapta Desktop: Selector limbă + Iconițe rapide + Cont Utilizator */}
        <div className="hidden md:flex items-center gap-2.5">
          {/* Selector regiune / limbă */}
          <span
            title="România — RON (Lei)"
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-100/80 text-xs font-medium text-ink select-none"
          >
            <span aria-hidden="true">🇷🇴</span>
            <span>RO</span>
          </span>

          {/* Buton rapid Rezervările Mele */}
          <Link
            href="/rezervarile-mele"
            title="Rezervările Mele"
            aria-label="Rezervările Mele"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-xs font-medium text-ink transition-colors"
          >
            <svg
              className="w-4 h-4 text-ink-muted"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.9"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
              <line x1="16" y1="2" x2="16" y2="6" />
              <line x1="8" y1="2" x2="8" y2="6" />
              <line x1="3" y1="10" x2="21" y2="10" />
            </svg>
            <span className="hidden xl:inline">Rezervări</span>
          </Link>

          {/* Buton rapid Inventarul Meu */}
          <Link
            href="/listarile-mele"
            title="Inventarul Meu"
            aria-label="Inventarul Meu"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-xs font-medium text-ink transition-colors"
          >
            <svg
              className="w-4 h-4 text-ink-muted"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.9"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
              <line x1="3" y1="6" x2="21" y2="6" />
              <path d="M16 10a4 4 0 0 1-8 0" />
            </svg>
            <span className="hidden xl:inline">Inventar</span>
          </Link>

          <div className="h-5 w-px bg-slate-200 mx-0.5" />

          {userEmail ? (
            <div className="flex items-center gap-2">
              <Link
                href="/profil"
                title="Profilul și Identitatea Mea"
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-ochre-light/70 hover:bg-ochre-light text-xs font-semibold text-ochre transition-colors max-w-[190px]"
              >
                <span className="w-2 h-2 rounded-full bg-ochre shrink-0" />
                <span className="truncate">{userEmail}</span>
              </Link>
              <form action={signOutAction}>
                <button
                  type="submit"
                  className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-xs font-medium text-ink-muted hover:text-ink transition-colors"
                >
                  Delogare
                </button>
              </form>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Link
                href="/login"
                className="px-3.5 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-xs font-medium text-ink transition-colors"
              >
                Autentificare
              </Link>
              <Link
                href="/inregistrare"
                className="px-3.5 py-1.5 rounded-lg bg-ochre hover:bg-ochre-hover text-xs font-semibold text-white shadow-xs transition-colors"
              >
                Cont Nou
              </Link>
            </div>
          )}
        </div>

        {/* Dreapta Mobil: Meniu Hamburger */}
        <MobileNav userEmail={userEmail} showStatusDb={showStatusDb} />
      </div>
    </header>
  );
}
