import Link from "next/link";
import { LISTING_CATEGORIES, getCategoryLabel } from "@/lib/constants/categories";
import type { CatalogSortOption } from "@/lib/types/database";

/**
 * Sidebar Vertical de Filtrare & Căutare (`components/catalog/FilterBar.tsx`).
 *
 * Analogie pentru C/Java:
 * - Funcționează ca un panou de filtre declarativ („stateless view”) într-o aplicație MVC:
 *   starea curentă este citită din URL (`FilterBarValues`), iar fiecare acțiune (bifă categorie,
 *   prag de preț, pill de oraș, rating sau segment) generează un nou query string (`/catalog?...`)
 *   evaluat server-side în PostgreSQL.
 * - Respectă ghidul Modern Web Guidance (`brand-consistent-forms` & `color`):
 *   starea selectată este marcată întotdeauna prin pictogramă vizibilă (`✓` sau `★`) + bordură,
 *   nu doar prin schimbarea culorii.
 */
export interface FilterBarValues {
  segment?: "all" | "individual" | "company";
  q?: string;
  category?: string;
  city?: string;
  minPrice?: string;
  maxPrice?: string;
  sort?: CatalogSortOption;
}

const CITY_PILLS: readonly { name: string; dotClass: string }[] = [
  { name: "București", dotClass: "bg-emerald-500" },
  { name: "Cluj-Napoca", dotClass: "bg-blue-500" },
  { name: "Timișoara", dotClass: "bg-orange-500" },
  { name: "Iași", dotClass: "bg-purple-500" },
  { name: "Brașov", dotClass: "bg-amber-500" },
];

const PRICE_RANGES: readonly {
  label: string;
  min: string;
  max: string;
}[] = [
  { label: "Sub 50 RON", min: "", max: "50" },
  { label: "50 RON – 100 RON", min: "50", max: "100" },
  { label: "100 RON – 250 RON", min: "100", max: "250" },
  { label: "Peste 250 RON", min: "250", max: "" },
];

const RATING_PILLS: readonly {
  label: string;
  sortValue: CatalogSortOption;
}[] = [
  { label: "5 ★", sortValue: "rating_desc" },
  { label: "> 4 ★", sortValue: "rating_desc" },
  { label: "> 3 ★", sortValue: "rating_desc" },
  { label: "> 2 ★", sortValue: "rating_desc" },
  { label: "Toate", sortValue: "newest" },
];

export function FilterBar({ values }: { values: FilterBarValues }) {
  const activeSegment = values.segment || "all";
  const activeSort = values.sort || "newest";
  const activeCategory = values.category || "";
  const activeCity = values.city || "";
  const activeMinPrice = values.minPrice || "";
  const activeMaxPrice = values.maxPrice || "";
  const activeQ = values.q || "";

  /**
   * Funcție utilitară care construiește un URL `/catalog?...` aplicând modificări
   * peste parametrii activi (similar cu un Builder pattern din Java).
   */
  function buildFilterHref(overrides: Partial<FilterBarValues>): string {
    const merged: FilterBarValues = {
      segment: activeSegment,
      q: activeQ,
      category: activeCategory,
      city: activeCity,
      minPrice: activeMinPrice,
      maxPrice: activeMaxPrice,
      sort: activeSort,
      ...overrides,
    };

    const params = new URLSearchParams();
    if (merged.segment && merged.segment !== "all") {
      params.set("segment", merged.segment);
    }
    if (merged.q) params.set("q", merged.q);
    if (merged.category) params.set("category", merged.category);
    if (merged.city) params.set("city", merged.city);
    if (merged.minPrice) params.set("minPrice", merged.minPrice);
    if (merged.maxPrice) params.set("maxPrice", merged.maxPrice);
    if (merged.sort && merged.sort !== "newest") {
      params.set("sort", merged.sort);
    }

    const qs = params.toString();
    return qs ? `/catalog?${qs}` : "/catalog";
  }

  const hasActiveFilters =
    activeSegment !== "all" ||
    Boolean(activeCategory) ||
    Boolean(activeCity) ||
    Boolean(activeMinPrice) ||
    Boolean(activeMaxPrice) ||
    Boolean(activeQ);

  return (
    <aside className="bg-white border border-slate-200/90 rounded-2xl p-5 space-y-6 shadow-sm">
      {/* Antet Filtre */}
      <div className="flex items-center justify-between gap-2 pb-3 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <svg
            className="w-4 h-4 text-ochre"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M10.5 6h9.75M10.5 6a1.5 1.5 0 11-3 0m3 0a1.5 1.5 0 10-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-9.75 0h9.75"
            />
          </svg>
          <h2 className="font-display font-bold text-sm text-ink">Filtre</h2>
        </div>

        <Link
          href="/catalog"
          className="text-xs font-semibold text-ochre hover:underline"
        >
          Șterge tot
        </Link>
      </div>

      {/* Chip-uri de filtre active */}
      {hasActiveFilters && (
        <div className="flex flex-wrap gap-1.5 pb-4 border-b border-slate-100">
          {activeQ && (
            <Link
              href={buildFilterHref({ q: "" })}
              className="bg-slate-100 hover:bg-slate-200 text-ink text-[11px] px-2.5 py-1 rounded-md inline-flex items-center gap-1.5 transition-colors"
              title="Elimină căutarea"
            >
              <span className="truncate max-w-[130px]">&ldquo;{activeQ}&rdquo;</span>
              <span className="text-slate-500 font-bold leading-none">&times;</span>
            </Link>
          )}

          {activeSegment !== "all" && (
            <Link
              href={buildFilterHref({ segment: "all" })}
              className="bg-slate-100 hover:bg-slate-200 text-ink text-[11px] px-2.5 py-1 rounded-md inline-flex items-center gap-1.5 transition-colors"
            >
              <span>
                {activeSegment === "company" ? "Firme B2C" : "Peer-to-Peer"}
              </span>
              <span className="text-slate-500 font-bold leading-none">&times;</span>
            </Link>
          )}

          {activeCategory && (
            <Link
              href={buildFilterHref({ category: "" })}
              className="bg-slate-100 hover:bg-slate-200 text-ink text-[11px] px-2.5 py-1 rounded-md inline-flex items-center gap-1.5 transition-colors"
            >
              <span>{getCategoryLabel(activeCategory)}</span>
              <span className="text-slate-500 font-bold leading-none">&times;</span>
            </Link>
          )}

          {activeCity && (
            <Link
              href={buildFilterHref({ city: "" })}
              className="bg-slate-100 hover:bg-slate-200 text-ink text-[11px] px-2.5 py-1 rounded-md inline-flex items-center gap-1.5 transition-colors"
            >
              <span>{activeCity}</span>
              <span className="text-slate-500 font-bold leading-none">&times;</span>
            </Link>
          )}

          {(activeMinPrice || activeMaxPrice) && (
            <Link
              href={buildFilterHref({ minPrice: "", maxPrice: "" })}
              className="bg-slate-100 hover:bg-slate-200 text-ink text-[11px] px-2.5 py-1 rounded-md inline-flex items-center gap-1.5 transition-colors"
            >
              <span>
                {activeMinPrice || "0"} – {activeMaxPrice || "∞"} RON
              </span>
              <span className="text-slate-500 font-bold leading-none">&times;</span>
            </Link>
          )}
        </div>
      )}

      {/* Căutare rapidă după cuvânt cheie sau cod #OBJ */}
      <form action="/catalog" method="GET" className="space-y-2">
        {activeSegment !== "all" && (
          <input type="hidden" name="segment" value={activeSegment} />
        )}
        {activeCategory && (
          <input type="hidden" name="category" value={activeCategory} />
        )}
        {activeCity && <input type="hidden" name="city" value={activeCity} />}
        {activeMinPrice && (
          <input type="hidden" name="minPrice" value={activeMinPrice} />
        )}
        {activeMaxPrice && (
          <input type="hidden" name="maxPrice" value={activeMaxPrice} />
        )}
        {activeSort !== "newest" && (
          <input type="hidden" name="sort" value={activeSort} />
        )}

        <label
          htmlFor="sidebar-q"
          className="block text-xs font-semibold text-ink"
        >
          Caută în catalog
        </label>
        <div className="flex items-center gap-1.5">
          <input
            id="sidebar-q"
            name="q"
            type="text"
            defaultValue={activeQ}
            placeholder="Ex: Bosch, Sony, #OBJ..."
            className="w-full rounded-lg border border-slate-200 bg-slate-50/70 px-3 py-1.5 text-xs text-ink placeholder:text-ink-muted focus:border-ochre focus:bg-white focus:outline-none"
          />
          <button
            type="submit"
            className="shrink-0 rounded-lg bg-slate-100 hover:bg-ochre hover:text-white text-ink px-2.5 py-1.5 text-xs font-semibold transition-colors"
            title="Caută"
          >
            Caută
          </button>
        </div>
      </form>

      {/* Secțiunea 1: Categorie (Category) */}
      <div className="space-y-3 pt-2 border-t border-slate-100">
        <div className="flex items-center justify-between">
          <h3 className="font-display text-xs font-bold uppercase tracking-wider text-ink">
            Categorie
          </h3>
          <svg
            className="w-3.5 h-3.5 text-ink-muted"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M19.5 8.25l-7.5 7.5-7.5-7.5"
            />
          </svg>
        </div>

        <ul className="space-y-2">
          <li>
            <Link
              href={buildFilterHref({ category: "" })}
              className="flex items-center gap-2.5 text-xs group"
            >
              <span
                className={`w-4 h-4 rounded flex items-center justify-center border text-[10px] font-bold transition-colors ${
                  !activeCategory
                    ? "bg-ochre border-ochre text-white"
                    : "border-slate-300 bg-white group-hover:border-ochre"
                }`}
              >
                {!activeCategory ? "✓" : null}
              </span>
              <span
                className={
                  !activeCategory
                    ? "font-semibold text-ink"
                    : "text-ink-muted group-hover:text-ink"
                }
              >
                Toate categoriile
              </span>
            </Link>
          </li>

          {LISTING_CATEGORIES.map((cat) => {
            const isSelected = activeCategory === cat.slug;
            return (
              <li key={cat.slug}>
                <Link
                  href={buildFilterHref({
                    category: isSelected ? "" : cat.slug,
                  })}
                  className="flex items-center justify-between gap-2 text-xs group"
                >
                  <span className="flex items-center gap-2.5 min-w-0">
                    <span
                      className={`w-4 h-4 shrink-0 rounded flex items-center justify-center border text-[10px] font-bold transition-colors ${
                        isSelected
                          ? "bg-ochre border-ochre text-white"
                          : "border-slate-300 bg-white group-hover:border-ochre"
                      }`}
                    >
                      {isSelected ? "✓" : null}
                    </span>
                    <span
                      className={`truncate ${
                        isSelected
                          ? "font-semibold text-ink"
                          : "text-ink-muted group-hover:text-ink"
                      }`}
                    >
                      {cat.label}
                    </span>
                  </span>
                  <span className="font-mono text-[10px] text-slate-400 shrink-0">
                    {cat.code.replace("#CAT-", "")}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>

      {/* Secțiunea 2: Preț / Zi (Price) */}
      <div className="space-y-3 pt-4 border-t border-slate-100">
        <div className="flex items-center justify-between">
          <h3 className="font-display text-xs font-bold uppercase tracking-wider text-ink">
            Preț / Zi
          </h3>
          <svg
            className="w-3.5 h-3.5 text-ink-muted"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M19.5 8.25l-7.5 7.5-7.5-7.5"
            />
          </svg>
        </div>

        {/* Praguri rapide */}
        <ul className="space-y-2">
          {PRICE_RANGES.map((range) => {
            const isSelected =
              activeMinPrice === range.min && activeMaxPrice === range.max;
            return (
              <li key={range.label}>
                <Link
                  href={buildFilterHref(
                    isSelected
                      ? { minPrice: "", maxPrice: "" }
                      : { minPrice: range.min, maxPrice: range.max }
                  )}
                  className="flex items-center gap-2.5 text-xs group"
                >
                  <span
                    className={`w-4 h-4 shrink-0 rounded flex items-center justify-center border text-[10px] font-bold transition-colors ${
                      isSelected
                        ? "bg-ochre border-ochre text-white"
                        : "border-slate-300 bg-white group-hover:border-ochre"
                    }`}
                  >
                    {isSelected ? "✓" : null}
                  </span>
                  <span
                    className={
                      isSelected
                        ? "font-semibold text-ink"
                        : "text-ink-muted group-hover:text-ink"
                    }
                  >
                    {range.label}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>

        {/* Formular compact Min - Max */}
        <form action="/catalog" method="GET" className="pt-1 space-y-2">
          {activeSegment !== "all" && (
            <input type="hidden" name="segment" value={activeSegment} />
          )}
          {activeQ && <input type="hidden" name="q" value={activeQ} />}
          {activeCategory && (
            <input type="hidden" name="category" value={activeCategory} />
          )}
          {activeCity && <input type="hidden" name="city" value={activeCity} />}
          {activeSort !== "newest" && (
            <input type="hidden" name="sort" value={activeSort} />
          )}

          <div className="flex items-center gap-1.5">
            <input
              name="minPrice"
              type="number"
              min={0}
              defaultValue={activeMinPrice}
              placeholder="Min"
              aria-label="Preț minim RON pe zi"
              className="w-full rounded-lg border border-slate-200 bg-slate-50/70 px-2.5 py-1.5 text-xs text-ink placeholder:text-ink-muted focus:border-ochre focus:bg-white focus:outline-none"
            />
            <span className="text-xs text-ink-muted">-</span>
            <input
              name="maxPrice"
              type="number"
              min={0}
              defaultValue={activeMaxPrice}
              placeholder="Max"
              aria-label="Preț maxim RON pe zi"
              className="w-full rounded-lg border border-slate-200 bg-slate-50/70 px-2.5 py-1.5 text-xs text-ink placeholder:text-ink-muted focus:border-ochre focus:bg-white focus:outline-none"
            />
            <button
              type="submit"
              className="shrink-0 rounded-lg bg-ochre hover:bg-ochre-hover text-white px-2.5 py-1.5 text-xs font-semibold transition-colors"
            >
              OK
            </button>
          </div>
        </form>
      </div>

      {/* Secțiunea 3: Oraș / Locație (în stilul pill-urilor Color din imaginea de referință) */}
      <div className="space-y-3 pt-4 border-t border-slate-100">
        <div className="flex items-center justify-between">
          <h3 className="font-display text-xs font-bold uppercase tracking-wider text-ink">
            Oraș / Locație
          </h3>
          <svg
            className="w-3.5 h-3.5 text-ink-muted"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M19.5 8.25l-7.5 7.5-7.5-7.5"
            />
          </svg>
        </div>

        <div className="flex flex-wrap gap-2">
          {CITY_PILLS.map((cityItem) => {
            const isSelected = activeCity === cityItem.name;
            return (
              <Link
                key={cityItem.name}
                href={buildFilterHref({
                  city: isSelected ? "" : cityItem.name,
                })}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                  isSelected
                    ? "bg-ochre text-white border-ochre shadow-sm"
                    : "bg-white text-ink border-slate-200 hover:border-slate-300"
                }`}
              >
                {isSelected ? (
                  <span className="text-[11px] font-bold leading-none">✓</span>
                ) : (
                  <span
                    className={`w-2.5 h-2.5 rounded-full ${cityItem.dotClass}`}
                    aria-hidden="true"
                  />
                )}
                <span>{cityItem.name}</span>
              </Link>
            );
          })}
        </div>
      </div>

      {/* Secțiunea 4: Rating (în stilul pill-urilor Rating din imaginea de referință) */}
      <div className="space-y-3 pt-4 border-t border-slate-100">
        <div className="flex items-center justify-between">
          <h3 className="font-display text-xs font-bold uppercase tracking-wider text-ink">
            Rating
          </h3>
          <svg
            className="w-3.5 h-3.5 text-ink-muted"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M19.5 8.25l-7.5 7.5-7.5-7.5"
            />
          </svg>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {RATING_PILLS.map((pill, idx) => {
            const isSelected =
              pill.label === "Toate"
                ? activeSort !== "rating_desc"
                : activeSort === "rating_desc" && idx === 0;
            return (
              <Link
                key={pill.label}
                href={buildFilterHref({ sort: pill.sortValue })}
                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors ${
                  isSelected
                    ? "bg-ochre text-white border-ochre shadow-sm"
                    : "bg-slate-50 text-ink border-slate-200 hover:border-ochre"
                }`}
              >
                <span>{pill.label}</span>
              </Link>
            );
          })}
        </div>
      </div>

      {/* Secțiunea 5: Segment Proprietar (în stilul Shipping Options din imaginea de referință) */}
      <div className="space-y-3 pt-4 border-t border-slate-100">
        <div className="flex items-center justify-between">
          <h3 className="font-display text-xs font-bold uppercase tracking-wider text-ink">
            Segment Proprietar
          </h3>
          <svg
            className="w-3.5 h-3.5 text-ink-muted"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M19.5 8.25l-7.5 7.5-7.5-7.5"
            />
          </svg>
        </div>

        <ul className="space-y-2">
          {(
            [
              {
                key: "all",
                label: "Toate ofertele (P2P + Firme)",
              },
              {
                key: "individual",
                label: "Peer-to-Peer (Proprietari)",
              },
              {
                key: "company",
                label: "Firme de Închirieri (B2C)",
              },
            ] as const
          ).map((option) => {
            const isSelected = activeSegment === option.key;
            return (
              <li key={option.key}>
                <Link
                  href={buildFilterHref({ segment: option.key })}
                  className="flex items-center gap-2.5 text-xs group"
                >
                  <span
                    className={`w-4 h-4 shrink-0 rounded flex items-center justify-center border text-[10px] font-bold transition-colors ${
                      isSelected
                        ? "bg-ochre border-ochre text-white"
                        : "border-slate-300 bg-white group-hover:border-ochre"
                    }`}
                  >
                    {isSelected ? "✓" : null}
                  </span>
                  <span
                    className={
                      isSelected
                        ? "font-semibold text-ink"
                        : "text-ink-muted group-hover:text-ink"
                    }
                  >
                    {option.label}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </aside>
  );
}
