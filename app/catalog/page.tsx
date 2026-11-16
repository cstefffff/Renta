import Link from "next/link";
import { getPaginatedPublicListingsAction } from "@/app/actions/listings";
import { FilterBar, type FilterBarValues } from "@/components/catalog/FilterBar";
import { ObjectCard } from "@/components/catalog/ObjectCard";
import { getCategoryLabel } from "@/lib/constants/categories";
import type { CatalogFilters, CatalogSortOption } from "@/lib/types/database";

export const dynamic = "force-dynamic";

/**
 * Pagina de Catalog Public (`/catalog`) — Async Server Component cu Sidebar de Filtre & Grilă de Produse.
 *
 * Analogie pentru C/Java:
 * - Gândește-te la `CatalogPage` ca la un Controller + View template care primește parametrii
 *   HTTP GET (`searchParams`), îi validează tipizat și apelează serviciul de date (`getPaginatedPublicListingsAction`).
 * - Respectă ghidul Modern Web Guidance (`css-layout`):
 *   folosește layout pe 2 coloane (`lg:flex-row`) cu `w-full lg:w-72 shrink-0` pentru Sidebar-ul de filtre
 *   și `flex-1 min-w-0` pe coloana principală pentru a preveni depășirea orizontală a grilei.
 */
interface CatalogPageProps {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}

function firstParam(val: string | string[] | undefined): string {
  if (Array.isArray(val)) return val[0] ?? "";
  return val ?? "";
}

const SORT_OPTIONS: readonly {
  value: CatalogSortOption;
  label: string;
  icon: string;
}[] = [
  { value: "rating_desc", label: "Rating", icon: "⭐" },
  { value: "newest", label: "Cele mai noi", icon: "🕒" },
  { value: "price_asc", label: "Preț crescător", icon: "↑" },
  { value: "price_desc", label: "Preț descrescător", icon: "↓" },
];

export default async function CatalogPage({ searchParams }: CatalogPageProps) {
  const resolvedParams = searchParams ? await searchParams : {};

  const rawSegment = firstParam(resolvedParams.segment);
  const segment: "all" | "individual" | "company" =
    rawSegment === "individual" || rawSegment === "company"
      ? rawSegment
      : "all";

  const q = firstParam(resolvedParams.q).trim();
  const category = firstParam(resolvedParams.category).trim();
  const city = firstParam(resolvedParams.city).trim();
  const rawMinPrice = firstParam(resolvedParams.minPrice).trim();
  const rawMaxPrice = firstParam(resolvedParams.maxPrice).trim();
  const rawSort = firstParam(resolvedParams.sort).trim();
  const rawPage = firstParam(resolvedParams.page).trim();

  const sort: CatalogSortOption =
    rawSort === "price_asc" ||
    rawSort === "price_desc" ||
    rawSort === "rating_desc"
      ? rawSort
      : "newest";

  const page = Math.max(1, Number.parseInt(rawPage || "1", 10) || 1);

  const minPrice =
    rawMinPrice && Number.isFinite(Number(rawMinPrice))
      ? Number(rawMinPrice)
      : undefined;
  const maxPrice =
    rawMaxPrice && Number.isFinite(Number(rawMaxPrice))
      ? Number(rawMaxPrice)
      : undefined;

  const filters: CatalogFilters = {
    segment,
    q: q || undefined,
    category: category || undefined,
    city: city || undefined,
    minPrice,
    maxPrice,
    sort,
    page,
    pageSize: 12,
  };

  const filterBarValues: FilterBarValues = {
    segment,
    q,
    category,
    city,
    minPrice: rawMinPrice,
    maxPrice: rawMaxPrice,
    sort,
  };

  const paginated = await getPaginatedPublicListingsAction(filters);
  const { items: listings, totalCount, totalPages } = paginated;

  function buildCatalogHref(overrides: {
    page?: number;
    sort?: CatalogSortOption;
  }): string {
    const nextSort = overrides.sort ?? sort;
    const nextPage = overrides.page ?? page;

    const params = new URLSearchParams();
    if (segment !== "all") params.set("segment", segment);
    if (q) params.set("q", q);
    if (category) params.set("category", category);
    if (city) params.set("city", city);
    if (rawMinPrice) params.set("minPrice", rawMinPrice);
    if (rawMaxPrice) params.set("maxPrice", rawMaxPrice);
    if (nextSort !== "newest") params.set("sort", nextSort);
    if (nextPage > 1) params.set("page", String(nextPage));

    const qs = params.toString();
    return qs ? `/catalog?${qs}` : "/catalog";
  }

  return (
    <div className="max-w-[1400px] mx-auto px-4 sm:px-6 py-6">
      <div className="flex flex-col lg:flex-row items-start gap-6">
        {/* Coloana Stângă: Sidebar Vertical de Filtre */}
        <div className="w-full lg:w-72 shrink-0 lg:sticky lg:top-20">
          <FilterBar values={filterBarValues} />
        </div>

        {/* Coloana Dreaptă: Antet Sortare + Grila de Produse + Paginare */}
        <div className="flex-1 min-w-0 space-y-5 w-full">
          {/* Antetul Secțiunii de Produse */}
          <div className="bg-white border border-slate-200/90 rounded-2xl p-4 sm:p-5 shadow-sm flex flex-col xl:flex-row xl:items-center justify-between gap-4">
            <div className="space-y-1">
              <h1 className="font-display text-2xl font-bold text-ink">
                Produse &amp; Echipamente
              </h1>
              <p className="text-xs sm:text-sm text-ink-muted">
                Afișare <strong className="text-ink">{totalCount}</strong>{" "}
                obiecte disponibile{" "}
                {category ? (
                  <>
                    în{" "}
                    <span className="text-ochre font-semibold">
                      &ldquo;{getCategoryLabel(category)}&rdquo;
                    </span>
                  </>
                ) : (
                  <>
                    în{" "}
                    <span className="text-ochre font-semibold">România</span>
                  </>
                )}
                {city ? (
                  <>
                    {" "}
                    &middot; Oraș:{" "}
                    <span className="text-ochre font-semibold">{city}</span>
                  </>
                ) : null}
                {segment !== "all" ? (
                  <>
                    {" "}
                    &middot; Segment:{" "}
                    <span className="text-ochre font-semibold">
                      {segment === "company"
                        ? "Firme B2C"
                        : "Peer-to-Peer (P2P)"}
                    </span>
                  </>
                ) : null}
              </p>
            </div>

            {/* Selector rapid de sortare + Buton Adaugă Obiect */}
            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-xs font-medium text-ink-muted mr-1">
                  Sort by:
                </span>
                {SORT_OPTIONS.map((opt) => {
                  const isActive = sort === opt.value;
                  return (
                    <Link
                      key={opt.value}
                      href={buildCatalogHref({ sort: opt.value, page: 1 })}
                      className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                        isActive
                          ? "bg-ochre/10 text-ochre border-ochre font-semibold"
                          : "bg-slate-50 text-ink border-slate-200 hover:border-slate-300"
                      }`}
                    >
                      <span aria-hidden="true">{opt.icon}</span>
                      <span>{opt.label}</span>
                    </Link>
                  );
                })}
              </div>

              <Link
                href="/listarile-mele/nou"
                className="inline-flex items-center justify-center gap-1.5 bg-ochre hover:bg-ochre-hover text-white text-xs font-semibold py-2 px-3.5 rounded-lg transition-colors shadow-sm shrink-0"
              >
                <span>+ Adaugă Obiect</span>
              </Link>
            </div>
          </div>

          {/* Grila de Produse sau Empty State */}
          {listings.length === 0 ? (
            <div className="bg-white border border-slate-200/90 rounded-2xl p-10 text-center space-y-4 shadow-sm">
              <div className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1 rounded-full bg-slate-100 text-ink-muted">
                <span>0 produse găsite pentru filtrele selectate</span>
              </div>
              <h2 className="font-display text-xl font-bold text-ink">
                Niciun obiect disponibil nu corespunde criteriilor actuale
              </h2>
              <p className="text-sm text-ink-muted max-w-md mx-auto">
                Încearcă să resetezi filtrele active din panoul lateral sau
                publică chiar tu primul obiect în această categorie.
              </p>
              <div className="pt-2 flex flex-wrap items-center justify-center gap-3">
                <Link
                  href="/catalog"
                  className="inline-flex items-center justify-center px-4 py-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-ink transition-colors"
                >
                  Resetează Toate Filtrele
                </Link>
                <Link
                  href="/listarile-mele/nou"
                  className="inline-flex items-center justify-center px-4 py-2 rounded-lg bg-ochre hover:bg-ochre-hover text-xs font-semibold text-white transition-colors shadow-sm"
                >
                  + Adaugă Obiect în Catalog
                </Link>
              </div>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-5">
                {listings.map((item) => (
                  <ObjectCard key={item.id} listing={item} />
                ))}
              </div>

              {/* Paginare modernă cu butoane rotunjite */}
              {totalPages > 1 && (
                <div className="bg-white border border-slate-200/90 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-4 shadow-sm text-xs">
                  <div className="text-ink-muted">
                    Pagina <strong className="text-ink">{page}</strong> din{" "}
                    <strong className="text-ink">{totalPages}</strong> ({totalCount}{" "}
                    obiecte totale)
                  </div>

                  <div className="flex items-center gap-2">
                    {page > 1 ? (
                      <Link
                        href={buildCatalogHref({ page: page - 1 })}
                        className="inline-flex items-center gap-1 px-3.5 py-2 rounded-xl border border-slate-200 bg-white hover:border-ochre hover:text-ochre font-semibold text-ink transition-colors"
                      >
                        &larr; Pagina anterioară
                      </Link>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-3.5 py-2 rounded-xl border border-slate-100 bg-slate-50 text-slate-400 cursor-not-allowed">
                        &larr; Pagina anterioară
                      </span>
                    )}

                    {page < totalPages ? (
                      <Link
                        href={buildCatalogHref({ page: page + 1 })}
                        className="inline-flex items-center gap-1 px-3.5 py-2 rounded-xl bg-ochre hover:bg-ochre-hover font-semibold text-white transition-colors shadow-sm"
                      >
                        Pagina următoare &rarr;
                      </Link>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-3.5 py-2 rounded-xl border border-slate-100 bg-slate-50 text-slate-400 cursor-not-allowed">
                        Pagina următoare &rarr;
                      </span>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
