import Link from "next/link";
import { Plus } from "lucide-react";
import { BrandLogo } from "@/components/ui/BrandLogo";
import { MobileNav } from "@/components/layout/MobileNav";
import { SearchBar } from "@/components/layout/SearchBar";
import { UserMenu } from "@/components/layout/UserMenu";
import { NotificationBell } from "@/components/layout/NotificationBell";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";
import { isCurrentUserAdminAction } from "@/app/actions/admin";

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
 *      - Buton rotund icon-only `Favorite` cu badge flotant
 *      - `<UserMenu />` („Airbnb Pill”) sau butoanele `Autentificare` / `Cont Nou`
 */
export async function Header() {
  const configured = isSupabaseConfigured();
  const showStatusDb = process.env.NODE_ENV !== "production";

  let userEmail: string | null = null;
  let displayName = "";
  let accountType: "individual" | "company" = "individual";
  let avatarUrl: string | null = null;
  let isAdmin = false;

  if (configured) {
    try {
      const supabase = await createClient();
      if (supabase) {
        const { data } = await supabase.auth.getUser();
        if (data.user) {
          userEmail = data.user.email ?? null;

          const [{ data: profile }, adminFlag] = await Promise.all([
            supabase
              .from("profiles")
              .select("display_name, account_type, avatar_url")
              .eq("id", data.user.id)
              .maybeSingle(),
            isCurrentUserAdminAction(),
          ]);

          isAdmin = adminFlag;

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
        {/* Stânga: Identitatea de Brand (Sigla SVG + Wordmark RentA) */}
        <div className="flex items-center gap-3 min-w-0">
          <BrandLogo showTag={false} />
        </div>

        {/* Centru: Bară de căutare globală cu scurtătura Ctrl K / ⌘ K */}
        <SearchBar />

        {/* Dreapta Desktop: Doar 3 elemente aerisite (+ Listează, Notificări, Airbnb Pill / Auth) */}
        <div className="hidden md:flex items-center gap-2.5">
          {/* 1. Buton pronunțat + Listează (armonizat h-9 și rounded-full cu Notificări & UserMenu) */}
          <Link
            href="/listarile-mele/nou"
            className="h-9 inline-flex items-center gap-1.5 px-4 rounded-full bg-ochre hover:bg-ochre-hover text-white text-xs font-semibold shadow-sm hover:shadow transition-all"
          >
            <Plus
              className="w-3.5 h-3.5 shrink-0"
              strokeWidth={1.8}
              aria-hidden="true"
            />
            <span>Listează</span>
          </Link>

          {/* 2. Clopoțel Notificări In-App (doar pentru utilizatorii autentificați) */}
          {userEmail && <NotificationBell />}

          {/* 3. UserMenu („Airbnb Pill”) sau Butoane Autentificare */}
          {userEmail ? (
            <UserMenu
              email={userEmail}
              displayName={displayName}
              accountType={accountType}
              avatarUrl={avatarUrl}
              showStatusDb={showStatusDb}
              isAdmin={isAdmin}
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
          isAdmin={isAdmin}
        />
      </div>
    </header>
  );
}
