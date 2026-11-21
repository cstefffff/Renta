import Link from "next/link";
import { getPaginatedPublicListingsAction } from "@/app/actions/listings";
import { FilterBar, type FilterBarValues } from "@/components/catalog/FilterBar";
import { EndlessCatalogGrid } from "@/components/catalog/EndlessCatalogGrid";
import { getCategoryLabel } from "@/lib/constants/categories";
import type { CatalogFilters, CatalogSortOption } from "@/lib/types/database";

export const dynamic = "force-dynamic";

/**
 * Pagina de Catalog Public (`/catalog`) — Async Server Component cu Bară Orizontală de Filtre & Grilă Full-Width.
 *
 * Analogie pentru C / Java:
 * - Gândește-te la `CatalogPage` ca la un Controller + View template care primește parametrii
 *   HTTP GET (`searchParams`), îi validează tipizat și apelează serviciul de date
 *   (`getPaginatedPublicListingsAction`) direct pe server.
 * - Eliminarea sidebar-ului lateral secundar oferă grilei de anunțuri întreaga lățime
 *   disponibilă (`max-w-[1400px]`), prevenind efectul de „dublu sidebar” lângă `SidebarRail`.
 */
interface CatalogPageProps {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}

function firstParam(val: string | string[] | undefined): string {
  if (Array.isArray(val)) return val[0] ?? "";
  return val ?? "";
}

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

  const sort: CatalogSortOption =
    rawSort === "price_asc" ||
    rawSort === "price_desc" ||
    rawSort === "rating_desc"
      ? rawSort
      : "newest";

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
    page: 1,
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
  const { items: listings, totalCount } = paginated;

  // Cheie unică derivată din filtrele active pentru a reseta instant feed-ul Endless
  const filterKey = JSON.stringify([
    segment,
    q,
    category,
    city,
    minPrice ?? "",
    maxPrice ?? "",
    sort,
  ]);

  return (
    <div className="max-w-[1400px] mx-auto px-4 sm:px-6 py-6 space-y-5">
      {/* Antet curat al Catalogului */}
      <header className="space-y-1">
        <h1 className="font-display text-2xl sm:text-3xl font-bold text-ink tracking-tight">
          Catalog Echipamente
        </h1>
        <p className="text-xs sm:text-sm text-ink-muted">
          <strong className="text-ink font-semibold">{totalCount}</strong>{" "}
          {totalCount === 1 ? "anunț disponibil" : "anunțuri disponibile"}
          {category ? (
            <>
              {" "}
              în{" "}
              <span className="text-ochre font-semibold">
                {getCategoryLabel(category)}
              </span>
            </>
          ) : null}
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
                {segment === "company" ? "Business" : "Personal"}
              </span>
            </>
          ) : null}
        </p>
      </header>

      {/* Bara Orizontală de Filtre cu Dropdown-uri Pill */}
      <FilterBar values={filterBarValues} />

      {/* Grila Endless Full-Width sau Empty State */}
      {listings.length === 0 ? (
        <div className="bg-white border border-slate-200/90 rounded-2xl p-10 text-center space-y-4 shadow-sm">
          <div className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1 rounded-full bg-slate-100 text-ink-muted">
            <span>0 produse găsite pentru filtrele selectate</span>
          </div>
          <h2 className="font-display text-xl font-bold text-ink">
            Niciun obiect disponibil nu corespunde criteriilor actuale
          </h2>
          <p className="text-sm text-ink-muted max-w-md mx-auto">
            Încearcă să resetezi filtrele active din bara de mai sus sau
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
        <EndlessCatalogGrid
          key={filterKey}
          initialItems={listings}
          totalCount={totalCount}
          pageSize={12}
          filters={{
            segment,
            q: q || undefined,
            category: category || undefined,
            city: city || undefined,
            minPrice,
            maxPrice,
            sort,
          }}
          gridClassName="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5"
        />
      )}
    </div>
  );
}
