import Link from "next/link";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { getPublicListingsAction } from "@/app/actions/listings";
import { LISTING_CATEGORIES } from "@/lib/constants/categories";
import { ObjectCard } from "@/components/catalog/ObjectCard";
import type { ListingWithDetails } from "@/lib/types/database";

export const dynamic = "force-dynamic";

/**
 * Pagina Principală (Homepage Storefront) — `app/page.tsx`
 *
 * Explicație pentru C/Java:
 * Homepage-ul este un Async Server Component care citește opțional parametrul
 * `?segment=` din URL (`all`, `individual`, `company`) și interoghează direct
 * din PostgreSQL obiectele disponibile, afișând un Storefront modern E-Commerce
 * cu Hero Banner, filtre rapide pe categorii, segmente (Peer-to-Peer vs Firme)
 * și grila de carduri în 4 coloane pe ecrane mari.
 */
interface HomePageProps {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}

export default async function HomePage({ searchParams }: HomePageProps) {
  const configured = isSupabaseConfigured();
  const resolvedParams = searchParams ? await searchParams : {};
  const rawSegment = Array.isArray(resolvedParams.segment)
    ? resolvedParams.segment[0]
    : resolvedParams.segment;

  const activeSegment: "all" | "individual" | "company" =
    rawSegment === "individual" || rawSegment === "company"
      ? rawSegment
      : "all";

  const rawListings = configured
    ? await getPublicListingsAction({ segment: activeSegment })
    : [];
  const listings: ListingWithDetails[] = Array.isArray(rawListings)
    ? rawListings
    : [];

  return (
    <div className="max-w-[1400px] mx-auto px-4 sm:px-6 py-6 space-y-8">
      {/* Banner de avertizare dacă .env.local nu este încă completat */}
      {!configured && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-sm">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-amber-800">
              <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 font-mono">
                #CFG-00
              </span>
              <span>Conexiunea Supabase nu este configurată în .env.local</span>
            </div>
            <p className="text-sm text-ink">
              Pentru a încărca inventarul din PostgreSQL, configurează cheile în{" "}
              <code className="font-mono text-xs bg-white px-2 py-0.5 rounded-md border border-amber-200">
                .env.local
              </code>
              .
            </p>
          </div>
          <Link
            href="/status-db"
            className="bg-ochre hover:bg-ochre-hover text-white font-semibold text-sm px-4 py-2.5 rounded-xl shadow-sm transition-all shrink-0"
          >
            Deschide Diagnostic DB &rarr;
          </Link>
        </div>
      )}

      {/* Hero Banner Modern Storefront */}
      <section className="bg-white border border-slate-200/90 rounded-2xl p-6 sm:p-8 shadow-sm relative overflow-hidden space-y-6">
        {/* Accent decorativ subtil mint/emerald în colțul dreapta-sus */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-24 -right-24 w-80 h-80 rounded-full bg-ochre-light/60 blur-3xl"
        />

        <div className="relative flex flex-wrap items-center justify-between gap-3">
          <span className="bg-ochre-light text-ochre font-semibold text-xs px-3 py-1 rounded-full inline-flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-ochre animate-pulse" />
            Platformă Hibridă: Peer-to-Peer &amp; Firme de Închirieri
          </span>

          <span className="font-mono text-xs text-ink-muted bg-slate-100 px-3 py-1 rounded-full">
            REGISTRU ACTIV &bull; #CAT-2025-RO
          </span>
        </div>

        <div className="relative max-w-3xl space-y-3">
          <h1 className="font-display text-2xl sm:text-4xl lg:text-[40px] font-extrabold text-ink tracking-tight leading-[1.15]">
            Închiriază unelte, echipamente și produse verificate direct din
            orașul tău.
          </h1>

          <p className="text-sm sm:text-base text-ink-muted leading-relaxed">
            Explorează un storefront unificat unde atât proprietarii individuali
            (Peer-to-Peer), cât și firmele locale de închirieri (B2C) își
            publică inventarul cu preț clar pe zi și rezervare rapidă.
          </p>
        </div>

        {/* Bară integrată de căutare rapidă către /catalog */}
        <form
          action="/catalog"
          method="GET"
          className="relative bg-slate-50/90 border border-slate-200/90 rounded-2xl p-3 grid grid-cols-1 sm:grid-cols-12 gap-3"
        >
          <div className="sm:col-span-5">
            <input
              type="text"
              name="q"
              placeholder="Caută scule Bosch, cameră Sony, cort, #OBJ-0001..."
              className="w-full bg-white border border-slate-200/90 rounded-xl px-4 py-2.5 text-sm text-ink placeholder:text-ink-muted focus:outline-none focus:border-ochre focus:ring-2 focus:ring-ochre/15 transition-all"
            />
          </div>
          <div className="sm:col-span-3">
            <select
              name="category"
              defaultValue=""
              className="w-full bg-white border border-slate-200/90 rounded-xl px-3.5 py-2.5 text-sm text-ink focus:outline-none focus:border-ochre focus:ring-2 focus:ring-ochre/15 transition-all"
            >
              <option value="">Toate categoriile</option>
              {LISTING_CATEGORIES.map((cat) => (
                <option key={cat.slug} value={cat.slug}>
                  {cat.label}
                </option>
              ))}
            </select>
          </div>
          <div className="sm:col-span-2">
            <select
              name="city"
              defaultValue=""
              className="w-full bg-white border border-slate-200/90 rounded-xl px-3.5 py-2.5 text-sm text-ink focus:outline-none focus:border-ochre focus:ring-2 focus:ring-ochre/15 transition-all"
            >
              <option value="">Toate orașele</option>
              <option value="București">București</option>
              <option value="Cluj-Napoca">Cluj-Napoca</option>
              <option value="Brașov">Brașov</option>
              <option value="Timișoara">Timișoara</option>
              <option value="Iași">Iași</option>
            </select>
          </div>
          <div className="sm:col-span-2">
            <button
              type="submit"
              className="w-full h-full bg-ochre hover:bg-ochre-hover text-white font-semibold text-sm py-2.5 px-4 rounded-xl shadow-sm transition-all flex items-center justify-center gap-1.5"
            >
              <span>Caută echipamente</span>
            </button>
          </div>
        </form>

        {/* Pill-uri rapide de Categorii sub bara de căutare */}
        <div className="relative pt-1 space-y-2.5">
          <div className="flex items-center justify-between text-xs text-ink-muted">
            <span className="font-semibold text-ink">
              Categorii Populare în Storefront:
            </span>
            <div className="hidden sm:flex items-center gap-3">
              <Link
                href="/listarile-mele"
                className="text-ink-muted hover:text-ink font-medium transition-colors"
              >
                Inventarul Meu
              </Link>
              <span>&bull;</span>
              <Link
                href="/listarile-mele/nou"
                className="text-ochre hover:text-ochre-hover font-semibold transition-colors"
              >
                + Adaugă Obiect Nou
              </Link>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/catalog"
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold bg-ochre-light text-ochre hover:bg-ochre hover:text-white transition-all"
            >
              <span>📦</span>
              <span>Toate Produsele</span>
            </Link>
            {LISTING_CATEGORIES.map((cat) => (
              <Link
                key={cat.slug}
                href={`/catalog?category=${cat.slug}`}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-medium bg-slate-100 text-ink hover:bg-ochre-light hover:text-ochre border border-transparent hover:border-ochre/20 transition-all"
              >
                <span className="font-mono text-[10px] text-ink-muted">
                  {cat.code}
                </span>
                <span>{cat.label}</span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Secțiunea Storefront pe Homepage: Antet + Filtre Segment + Grila de Carduri */}
      <section className="space-y-6">
        <div className="bg-white border border-slate-200/90 rounded-2xl p-4 sm:p-5 shadow-sm flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h2 className="font-display text-xl sm:text-2xl font-extrabold text-ink">
              Echipamente &amp; Produse Disponibile
            </h2>
            <p className="text-xs sm:text-sm text-ink-muted mt-0.5">
              Showing{" "}
              <span className="font-semibold text-ink">{listings.length}</span>{" "}
              obiecte verificate în timp real
            </p>
          </div>

          {/* Pill-urile de filtrare după segment + Link către /catalog */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex flex-wrap items-center gap-1.5 bg-slate-100 p-1 rounded-xl">
              <Link
                href="/"
                scroll={false}
                className={`px-3.5 py-1.5 text-xs font-semibold transition-all rounded-lg ${
                  activeSegment === "all"
                    ? "bg-ochre text-white shadow-sm"
                    : "text-ink-muted hover:text-ink"
                }`}
              >
                Toate ({activeSegment === "all" ? listings.length : "All"})
              </Link>

              <Link
                href="/?segment=individual"
                scroll={false}
                className={`px-3.5 py-1.5 text-xs font-semibold transition-all rounded-lg ${
                  activeSegment === "individual"
                    ? "bg-ochre text-white shadow-sm"
                    : "text-ink-muted hover:text-ink"
                }`}
              >
                🤝 Peer-to-Peer (P2P)
              </Link>

              <Link
                href="/?segment=company"
                scroll={false}
                className={`px-3.5 py-1.5 text-xs font-semibold transition-all rounded-lg ${
                  activeSegment === "company"
                    ? "bg-ochre text-white shadow-sm"
                    : "text-ink-muted hover:text-ink"
                }`}
              >
                🏢 Firme de Închirieri
              </Link>
            </div>

            <Link
              href="/catalog"
              className="px-3.5 py-2 text-xs font-semibold text-ochre bg-ochre-light hover:bg-ochre hover:text-white rounded-xl transition-all"
            >
              Filtre Avansate &rarr;
            </Link>
          </div>
        </div>

        {/* Grila de produse */}
        {listings.length === 0 ? (
          <div className="bg-white border border-slate-200/90 rounded-2xl p-10 text-center space-y-4 shadow-sm">
            <div className="inline-block font-mono text-xs px-3 py-1 rounded-full bg-slate-100 text-ink-muted font-semibold">
              NICIUN OBIECT ÎN ACEST SEGMENT
            </div>
            <h3 className="font-display text-xl font-bold text-ink">
              Nu există încă obiecte publicate în acest segment
            </h3>
            <p className="text-sm text-ink-muted max-w-md mx-auto">
              Poți schimba filtrul de segment sau poți adăuga chiar acum un
              obiect nou în catalogul RentA.
            </p>
            <div className="pt-2 flex flex-wrap items-center justify-center gap-3">
              {activeSegment !== "all" && (
                <Link
                  href="/"
                  className="px-4 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-ink transition-all"
                >
                  Vezi Toate Segmentele
                </Link>
              )}
              <Link
                href="/listarile-mele/nou"
                className="px-5 py-2.5 rounded-xl bg-ochre hover:bg-ochre-hover text-white text-xs font-semibold shadow-sm transition-all"
              >
                + Adaugă Obiect în Catalog
              </Link>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {listings.map((item) => (
              <ObjectCard key={item.id} listing={item} />
            ))}
          </div>
        )}

        <div className="flex justify-center pt-2">
          <Link
            href="/catalog"
            className="bg-white hover:bg-slate-50 text-ink border border-slate-200/90 font-semibold text-sm px-6 py-3 rounded-xl shadow-sm transition-all"
          >
            Deschide Catalogul Complet cu Filtre Avansate &rarr;
          </Link>
        </div>
      </section>
    </div>
  );
}
