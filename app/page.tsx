import Link from "next/link";
import {
  Bike,
  Building2,
  Camera,
  Gamepad2,
  LayoutGrid,
  Package,
  PartyPopper,
  Search,
  Shirt,
  Tent,
  User,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { getPaginatedPublicListingsAction } from "@/app/actions/listings";
import { LISTING_CATEGORIES } from "@/lib/constants/categories";
import { EndlessCatalogGrid } from "@/components/catalog/EndlessCatalogGrid";
import type { CategorySlug, ListingWithDetails } from "@/lib/types/database";

export const dynamic = "force-dynamic";

/**
 * Mapare iconițe vectoriale (`lucide-react`) pentru categoriile de pe Homepage.
 * Analogie C/Java: un `Map<CategorySlug, LucideIcon>` (HashMap imutabil) care
 * asociază fiecărui slug de categorie o componentă SVG curată și uniformă.
 */
const CATEGORY_ICONS: Partial<Record<CategorySlug, LucideIcon>> = {
  "scule-unelte": Wrench,
  "foto-video": Camera,
  "camping-outdoor": Tent,
  "evenimente-party": PartyPopper,
  electronice: Gamepad2,
  vestimentar: Shirt,
  "sport-timp-liber": Bike,
  altele: Package,
};

/**
 * Pașii secțiunii „Cum funcționează RentA în 3 pași simpli”.
 * Structură statică de tip array de obiecte (echivalentul unui array de struct-uri
 * constante în C sau `List.of(...)` în Java).
 */
const HOW_IT_WORKS_STEPS = [
  {
    step: "1",
    title: "Găsești & rezervi online",
    description:
      "Alegi perioada dorită și vezi transparent prețul total și garanția returnabilă, fără costuri ascunse.",
  },
  {
    step: "2",
    title: "Predare sigură cu Proces-Verbal",
    description:
      "Încărcați poze de Check-in direct în aplicație, iar garanția rămâne protejată în Escrow.",
  },
  {
    step: "3",
    title: "Folosești & returnezi fără griji",
    description:
      "La returnarea obiectului, garanția este eliberată integral și poți lăsa o recenzie verificată.",
  },
] as const;

/**
 * Pagina Principală (Homepage) — `app/page.tsx`
 *
 * Explicație pentru C/Java:
 * Homepage-ul este un Async Server Component (rulează exclusiv pe server, nu trimite
 * cod JavaScript inutil în browser). Citește opțional parametrul `?segment=` din URL
 * (`all`, `individual`, `company`) și interoghează direct PostgreSQL prin Server Action-ul
 * `getPublicListingsAction`, apoi trimite HTML gata randat către vizitator.
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

  const paginated = configured
    ? await getPaginatedPublicListingsAction({
        segment: activeSegment,
        page: 1,
        pageSize: 12,
      })
    : { items: [], totalCount: 0, page: 1, pageSize: 12, totalPages: 1 };

  const items: ListingWithDetails[] = Array.isArray(paginated.items)
    ? paginated.items
    : [];
  const totalCount = paginated.totalCount ?? items.length;

  const catalogHref =
    activeSegment === "all" ? "/catalog" : `/catalog?segment=${activeSegment}`;

  return (
    <div className="max-w-[1400px] mx-auto px-4 sm:px-6 py-5 sm:py-6 space-y-8">
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

      {/* 1. Hero Banner Compact & Limbaj 100% Natural */}
      <section className="bg-white border border-slate-200/90 rounded-2xl p-5 sm:p-7 space-y-5 shadow-sm relative overflow-hidden">
        {/* Accent decorativ subtil verde-smarald în colțul dreapta-sus */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-24 -right-24 w-72 h-72 rounded-full bg-ochre-light/60 blur-3xl"
        />

        <div className="relative">
          <span className="bg-ochre-light text-ochre font-semibold text-xs px-3 py-1 rounded-full inline-flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-ochre" />
            <span>
              Închirieri sigure în România &middot; Garanție protejată în Escrow
            </span>
          </span>
        </div>

        <div className="relative max-w-3xl space-y-2.5">
          <h1 className="font-display text-2xl sm:text-4xl font-extrabold text-ink tracking-tight leading-[1.15]">
            Închiriază echipamente verificate, direct din orașul tău.
          </h1>

          <p className="text-sm sm:text-base text-ink-muted leading-relaxed">
            De la proprietari locali sau firme verificate — cu preț clar pe zi,
            proces-verbal foto și garanție returnabilă.
          </p>
        </div>

        {/* Bară compactă de căutare rapidă pe un singur rând pe desktop */}
        <form
          action="/catalog"
          method="GET"
          className="relative bg-slate-50 border border-slate-200/90 rounded-2xl p-2 grid grid-cols-1 sm:grid-cols-12 gap-2"
        >
          <div className="sm:col-span-5">
            <input
              type="text"
              name="q"
              aria-label="Caută echipamente"
              placeholder="Ce vrei să închiriezi? Ex: bormașină, cameră Sony, cort..."
              className="w-full bg-white border border-slate-200/90 rounded-xl px-3.5 py-2.5 text-sm text-ink placeholder:text-ink-muted focus:outline-none focus:border-ochre focus:ring-2 focus:ring-ochre/15 transition-all"
            />
          </div>
          <div className="sm:col-span-3">
            <select
              name="category"
              aria-label="Categorie"
              defaultValue=""
              className="w-full bg-white border border-slate-200/90 rounded-xl px-3 py-2.5 text-sm text-ink focus:outline-none focus:border-ochre focus:ring-2 focus:ring-ochre/15 transition-all"
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
              aria-label="Oraș"
              defaultValue=""
              className="w-full bg-white border border-slate-200/90 rounded-xl px-3 py-2.5 text-sm text-ink focus:outline-none focus:border-ochre focus:ring-2 focus:ring-ochre/15 transition-all"
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
              className="w-full h-full bg-ochre hover:bg-ochre-hover text-white font-semibold text-sm py-2.5 px-4 rounded-xl shadow-sm transition-all inline-flex items-center justify-center gap-2 cursor-pointer"
            >
              <Search
                className="w-4 h-4 shrink-0"
                strokeWidth={1.8}
                aria-hidden="true"
              />
              <span>Caută</span>
            </button>
          </div>
        </form>
      </section>

      {/* 2. Bară Orizontală de Categorii pe un singur rând */}
      <nav
        aria-label="Categorii de echipamente"
        className="flex items-center gap-2 overflow-x-auto pb-1"
      >
        <Link
          href="/catalog"
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-semibold bg-ochre-light text-ochre hover:bg-ochre hover:text-white whitespace-nowrap transition-all shrink-0"
        >
          <LayoutGrid
            className="w-3.5 h-3.5 shrink-0"
            strokeWidth={1.8}
            aria-hidden="true"
          />
          <span>Toate categoriile</span>
        </Link>
        {LISTING_CATEGORIES.map((cat) => {
          const CategoryIcon = CATEGORY_ICONS[cat.slug] ?? Package;
          return (
            <Link
              key={cat.slug}
              href={`/catalog?category=${cat.slug}`}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-medium bg-white text-ink border border-slate-200/90 hover:border-ochre/40 hover:bg-ochre-light hover:text-ochre whitespace-nowrap transition-all shrink-0 shadow-2xs"
            >
              <CategoryIcon
                className="w-3.5 h-3.5 shrink-0"
                strokeWidth={1.8}
                aria-hidden="true"
              />
              <span>{cat.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* 3. Secțiune super compactă „Cum funcționează RentA în 3 pași simpli” — deasupra feed-ului endless */}
      <section className="space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2 className="font-display text-base sm:text-lg font-extrabold text-ink">
              Cum funcționează RentA în 3 pași simpli
            </h2>
            <p className="text-xs text-ink-muted">
              Fără birocrație și fără surprize — tot procesul este clar de la
              rezervare până la returnare.
            </p>
          </div>
          <Link
            href="/listarile-mele/nou"
            className="text-xs font-semibold text-ochre hover:text-ochre-hover transition-colors whitespace-nowrap self-start sm:self-auto"
          >
            + Listează echipamentul tău &rarr;
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {HOW_IT_WORKS_STEPS.map((item) => (
            <div
              key={item.step}
              className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-2xs flex items-start gap-3"
            >
              <span className="w-7 h-7 rounded-full bg-ochre text-white font-display font-bold text-xs inline-flex items-center justify-center shadow-xs shrink-0 mt-0.5">
                {item.step}
              </span>
              <div className="space-y-1 min-w-0">
                <h3 className="font-display text-sm font-bold text-ink leading-snug">
                  {item.title}
                </h3>
                <p className="text-xs text-ink-muted leading-relaxed">
                  {item.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 4. Feed-ul Endless „Echipamente disponibile acum” (gen OLX / Vinted) */}
      <section className="space-y-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-0.5">
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <h2 className="font-display text-xl sm:text-2xl font-extrabold text-ink">
                Echipamente disponibile acum
              </h2>
              <Link
                href={catalogHref}
                className="text-xs sm:text-sm font-semibold text-ochre hover:text-ochre-hover transition-colors inline-flex items-center gap-1"
              >
                <span>Filtre avansate</span>
                <span aria-hidden="true">&rarr;</span>
              </Link>
            </div>
            <p className="text-xs sm:text-sm text-ink-muted">
              <span className="font-semibold text-ink">{totalCount}</span>{" "}
              anunțuri active, gata de rezervare
            </p>
          </div>

          {/* Filtre segment în limbaj natural */}
          <div className="inline-flex flex-wrap items-center gap-1.5 bg-white border border-slate-200/90 p-1 rounded-xl shadow-2xs self-start lg:self-auto">
            <Link
              href="/"
              scroll={false}
              className={`px-3.5 py-1.5 text-xs font-semibold transition-all rounded-lg ${
                activeSegment === "all"
                  ? "bg-ochre text-white shadow-sm"
                  : "text-ink-muted hover:text-ink"
              }`}
            >
              Toate
            </Link>

            <Link
              href="/?segment=individual"
              scroll={false}
              className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold transition-all rounded-lg ${
                activeSegment === "individual"
                  ? "bg-ochre text-white shadow-sm"
                  : "text-ink-muted hover:text-ink"
              }`}
            >
              <User
                className="w-3.5 h-3.5 shrink-0"
                strokeWidth={1.8}
                aria-hidden="true"
              />
              <span>Personal</span>
            </Link>

            <Link
              href="/?segment=company"
              scroll={false}
              className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold transition-all rounded-lg ${
                activeSegment === "company"
                  ? "bg-ochre text-white shadow-sm"
                  : "text-ink-muted hover:text-ink"
              }`}
            >
              <Building2
                className="w-3.5 h-3.5 shrink-0"
                strokeWidth={1.8}
                aria-hidden="true"
              />
              <span>Business</span>
            </Link>
          </div>
        </div>

        {/* Grila continuă cu Infinite Scroll sau Empty State */}
        {items.length === 0 ? (
          <div className="bg-white border border-slate-200/90 rounded-2xl p-10 text-center space-y-4 shadow-sm">
            <h3 className="font-display text-xl font-bold text-ink">
              Nu există încă anunțuri în această categorie
            </h3>
            <p className="text-sm text-ink-muted max-w-md mx-auto">
              Poți reveni la toate anunțurile sau poți publica chiar acum primul
              echipament disponibil pentru închiriere.
            </p>
            <div className="pt-2 flex flex-wrap items-center justify-center gap-3">
              {activeSegment !== "all" && (
                <Link
                  href="/"
                  className="px-4 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-ink transition-all"
                >
                  Vezi toate anunțurile
                </Link>
              )}
              <Link
                href="/listarile-mele/nou"
                className="px-5 py-2.5 rounded-xl bg-ochre hover:bg-ochre-hover text-white text-xs font-semibold shadow-sm transition-all"
              >
                + Listează primul tău obiect
              </Link>
            </div>
          </div>
        ) : (
          <EndlessCatalogGrid
            key={activeSegment}
            initialItems={items}
            totalCount={totalCount}
            pageSize={12}
            filters={{ segment: activeSegment }}
          />
        )}
      </section>
    </div>
  );
}
