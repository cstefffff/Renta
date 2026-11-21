import Link from "next/link";
import { BrandLogo } from "@/components/ui/BrandLogo";
import { MobileNav } from "@/components/layout/MobileNav";
import { SearchBar } from "@/components/layout/SearchBar";
import { UserMenu } from "@/components/layout/UserMenu";
import { FavoriteNavBadge } from "@/components/catalog/FavoriteNavBadge";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

/**
 * Bara superioară orizontală (`Header.tsx` — Async Server Component).
 *
 * Explicație pentru dezvoltatori C / Java:
 * - Această componentă rulează pe server la fiecare cerere, verifică sesiunea
 *   activă din Supabase și profilul utilizatorului (`public.profiles`).
 * - Arhitectura vizuală (Varianta A — „Airbnb Pill”):
 *   1. Stânga: Breadcrumb (`RentA Store › Catalog & Închirieri`)
 *   2. Centru: `<SearchBar />` cu focus prin scurtătura `Ctrl K` / `⌘ K`
 *   3. Dreapta (doar 3 elemente curate):
 *      - Link discret `+ Listează` (`/listarile-mele/nou`)
 *      - Buton rotund icon-only `Favorite (♥)` cu badge flotant
 *      - `<UserMenu />` („Airbnb Pill”) sau butoanele `Autentificare` / `Cont Nou`
 */
export async function Header() {
  const configured = isSupabaseConfigured();
  const showStatusDb = process.env.NODE_ENV !== "production";

  let userEmail: string | null = null;
  let displayName = "";
  let accountType: "individual" | "company" = "individual";
  let avatarUrl: string | null = null;

  if (configured) {
    try {
      const supabase = await createClient();
      if (supabase) {
        const { data } = await supabase.auth.getUser();
        if (data.user) {
          userEmail = data.user.email ?? null;

          const { data: profile } = await supabase
            .from("profiles")
            .select("display_name, account_type, avatar_url")
            .eq("id", data.user.id)
            .maybeSingle();

          const fallbackName =
            (typeof data.user.user_metadata?.display_name === "string" &&
              data.user.user_metadata.display_name.trim()) ||
            userEmail?.split("@")[0] ||
            "Utilizator RentA";

          displayName = profile?.display_name?.trim() || fallbackName;
          accountType =
            profile?.account_type === "company" ? "company" : "individual";
          avatarUrl = profile?.avatar_url ?? null;
        }
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

        {/* Centru: Bară de căutare globală cu scurtătura Ctrl K / ⌘ K */}
        <SearchBar />

        {/* Dreapta Desktop: Doar 3 elemente aerisite (+ Listează, Favorite ♥, Airbnb Pill / Auth) */}
        <div className="hidden md:flex items-center gap-2.5">
          {/* 1. Buton pronunțat + Listează (armonizat h-9 și rounded-full cu Favorite & UserMenu) */}
          <Link
            href="/listarile-mele/nou"
            className="h-9 inline-flex items-center gap-1.5 px-4 rounded-full bg-ochre hover:bg-ochre-hover text-white text-xs font-semibold shadow-sm hover:shadow transition-all"
          >
            <svg
              className="w-3.5 h-3.5 shrink-0"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            <span>Listează</span>
          </Link>

          {/* 2. Buton rotund icon-only Favorite (♥) */}
          <Link
            href="/favorite"
            title="Anunțuri Apreciate / Favorite"
            aria-label="Anunțuri Apreciate / Favorite"
            className="relative w-9 h-9 rounded-full border border-slate-200 bg-white hover:bg-rose-50 hover:border-rose-200 flex items-center justify-center text-ink-muted hover:text-rose-500 transition-colors"
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
              <path d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
            </svg>
            <span className="absolute -top-1 -right-1">
              <FavoriteNavBadge />
            </span>
          </Link>

          {/* 3. UserMenu („Airbnb Pill”) sau Butoane Autentificare */}
          {userEmail ? (
            <UserMenu
              email={userEmail}
              displayName={displayName}
              accountType={accountType}
              avatarUrl={avatarUrl}
              showStatusDb={showStatusDb}
            />
          ) : (
            <div className="flex items-center gap-2">
              <Link
                href="/login"
                className="px-3.5 py-1.5 rounded-full border border-slate-200 bg-white hover:bg-slate-50 text-xs font-medium text-ink transition-colors"
              >
                Autentificare
              </Link>
              <Link
                href="/inregistrare"
                className="px-3.5 py-1.5 rounded-full bg-ochre hover:bg-ochre-hover text-xs font-semibold text-white shadow-xs transition-colors"
              >
                Cont Nou
              </Link>
            </div>
          )}
        </div>

        {/* Dreapta Mobil: Meniu Hamburger */}
        <MobileNav
          userEmail={userEmail}
          displayName={displayName}
          accountType={accountType}
          showStatusDb={showStatusDb}
        />
      </div>
    </header>
  );
}
