"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowUpDown,
  Banknote,
  Building2,
  Check,
  ChevronDown,
  Layers,
  MapPin,
  Star,
  User,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";
import {
  LISTING_CATEGORIES,
  getCategoryLabel,
} from "@/lib/constants/categories";
import { RENTA_CITIES, type CatalogSortOption } from "@/lib/types/database";

/**
 * Bară Orizontală de Filtre cu Dropdown-uri „Pill” (`components/catalog/FilterBar.tsx`).
 *
 * Explicație pentru dezvoltatori C / Java:
 * - Aceasta este o componentă Client (`"use client"`) deoarece gestionează
 *   starea locală efemeră a dropdown-urilor deschise (`useState`), evenimentele
 *   de tastatură (`Escape`) și click-ul în afara barei (`useEffect` + `useRef`).
 * - Sursa de adevăr pentru filtre rămâne URL-ul (`/catalog?category=...&city=...`),
 *   iar fiecare selecție navighează prin Next.js Router (`router.push` / `<Link>`),
 *   declanșând re-evaluarea filtrării direct în PostgreSQL (Server Component).
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

type DropdownKey = "category" | "city" | "price" | "segment" | "sort";

const PRICE_RANGES: readonly {
  label: string;
  min: string;
  max: string;
}[] = [
  { label: "Sub 50 RON", min: "", max: "50" },
  { label: "50–100 RON", min: "50", max: "100" },
  { label: "100–250 RON", min: "100", max: "250" },
  { label: "Peste 250 RON", min: "250", max: "" },
];

const SEGMENT_OPTIONS: readonly {
  key: "all" | "individual" | "company";
  label: string;
  pillLabel: string;
  icon: LucideIcon;
}[] = [
  {
    key: "all",
    label: "Toate",
    pillLabel: "Personal / Business",
    icon: Users,
  },
  {
    key: "individual",
    label: "Personal",
    pillLabel: "Personal",
    icon: User,
  },
  {
    key: "company",
    label: "Business",
    pillLabel: "Business",
    icon: Building2,
  },
];

const SORT_OPTIONS: readonly {
  value: CatalogSortOption;
  label: string;
  showStar?: boolean;
}[] = [
  { value: "newest", label: "Cele mai noi" },
  { value: "rating_desc", label: "Rating", showStar: true },
  { value: "price_asc", label: "Preț crescător" },
  { value: "price_desc", label: "Preț descrescător" },
];

export function FilterBar({ values }: { values: FilterBarValues }) {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement | null>(null);

  const activeSegment = values.segment || "all";
  const activeSort: CatalogSortOption = values.sort || "newest";
  const activeCategory = values.category || "";
  const activeCity = values.city || "";
  const activeMinPrice = values.minPrice || "";
  const activeMaxPrice = values.maxPrice || "";
  const activeQ = values.q || "";

  // Ce dropdown este deschis curent (analog unui enum nullable în Java)
  const [openDropdown, setOpenDropdown] = useState<DropdownKey | null>(null);
  // Starea controlată a câmpurilor Min/Max din popover-ul de preț
  const [minPriceInput, setMinPriceInput] = useState<string>(activeMinPrice);
  const [maxPriceInput, setMaxPriceInput] = useState<string>(activeMaxPrice);

  // Sincronizează input-urile de preț atunci când URL-ul se schimbă extern (ex. „Șterge tot”)
  useEffect(() => {
    setMinPriceInput(activeMinPrice);
    setMaxPriceInput(activeMaxPrice);
  }, [activeMinPrice, activeMaxPrice]);

  // Închide popover-ul activ la apăsarea tastei Escape sau la click în afara barei
  useEffect(() => {
    if (!openDropdown) return;

    function handlePointerDown(event: PointerEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setOpenDropdown(null);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpenDropdown(null);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [openDropdown]);

  /**
   * Construiește URL-ul `/catalog?...` aplicând modificări parțiale peste
   * parametrii activi (similar cu Builder pattern în Java).
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

  function applyFilter(overrides: Partial<FilterBarValues>) {
    setOpenDropdown(null);
    router.push(buildFilterHref(overrides));
  }

  function toggleDropdown(key: DropdownKey) {
    setOpenDropdown((prev) => (prev === key ? null : key));
  }

  function handleCustomPriceSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    applyFilter({
      minPrice: minPriceInput.trim(),
      maxPrice: maxPriceInput.trim(),
    });
  }

  const hasPriceFilter = Boolean(activeMinPrice || activeMaxPrice);
  const hasActiveFilters =
    Boolean(activeQ) ||
    Boolean(activeCategory) ||
    Boolean(activeCity) ||
    hasPriceFilter ||
    activeSegment !== "all";

  // Etichetă compactă pentru pill-ul de preț
  const pricePillLabel = (() => {
    if (activeMinPrice && activeMaxPrice) {
      return `${activeMinPrice}–${activeMaxPrice} RON`;
    }
    if (activeMinPrice) {
      return `Peste ${activeMinPrice} RON`;
    }
    if (activeMaxPrice) {
      return `Sub ${activeMaxPrice} RON`;
    }
    return "Preț / zi";
  })();

  const activeSegmentOption =
    SEGMENT_OPTIONS.find((opt) => opt.key === activeSegment) ??
    SEGMENT_OPTIONS[0];
  const ActiveSegmentIcon = activeSegmentOption.icon;

  const activeSortOption =
    SORT_OPTIONS.find((opt) => opt.value === activeSort) ?? SORT_OPTIONS[0];

  const pillClass = (isActive: boolean, isOpen: boolean) =>
    `inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs border transition-colors cursor-pointer select-none ${
      isActive
        ? "bg-ochre-light text-ochre border-ochre/30 font-semibold"
        : "bg-white text-ink border-slate-200 hover:border-slate-300 hover:bg-slate-50 font-medium"
    } ${isOpen ? "ring-2 ring-ochre/20 border-ochre/40" : ""}`;

  const optionItemClass = (isSelected: boolean) =>
    `w-full flex items-center justify-between gap-2 px-3 py-2 rounded-xl text-xs text-left transition-colors cursor-pointer ${
      isSelected
        ? "bg-ochre-light text-ochre font-semibold"
        : "text-ink hover:bg-slate-50"
    }`;

  return (
    <div ref={containerRef} className="space-y-3">
      {/* Rândul principal orizontal: 4 Pill-uri Filtre (stânga) + Pill Ordonare (dreapta) */}
      <div className="bg-white border border-slate-200/90 rounded-2xl px-3.5 py-2.5 shadow-sm flex flex-wrap items-center justify-between gap-2.5">
        {/* Stânga — 4 Pill-uri Dropdown interactive */}
        <div className="flex flex-wrap items-center gap-2">
          {/* 1. Pill Categorie */}
          <div className="relative">
            <button
              type="button"
              onClick={() => toggleDropdown("category")}
              aria-expanded={openDropdown === "category"}
              aria-haspopup="listbox"
              className={pillClass(
                Boolean(activeCategory),
                openDropdown === "category"
              )}
            >
              <Layers
                className="w-3.5 h-3.5 shrink-0"
                strokeWidth={1.8}
                aria-hidden="true"
              />
              <span className="max-w-[160px] truncate">
                {activeCategory
                  ? getCategoryLabel(activeCategory)
                  : "Categorie"}
              </span>
              <ChevronDown
                className={`w-3.5 h-3.5 shrink-0 transition-transform ${
                  openDropdown === "category" ? "rotate-180" : ""
                }`}
                strokeWidth={1.8}
                aria-hidden="true"
              />
            </button>

            {openDropdown === "category" && (
              <div
                role="listbox"
                aria-label="Selectează categoria"
                className="absolute left-0 top-full mt-2 w-64 max-h-80 overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-xl p-2 z-40 space-y-0.5"
              >
                <button
                  type="button"
                  role="option"
                  aria-selected={!activeCategory}
                  onClick={() => applyFilter({ category: "" })}
                  className={optionItemClass(!activeCategory)}
                >
                  <span>Toate categoriile</span>
                  {!activeCategory && (
                    <Check
                      className="w-3.5 h-3.5 shrink-0"
                      strokeWidth={1.8}
                      aria-hidden="true"
                    />
                  )}
                </button>

                {LISTING_CATEGORIES.map((cat) => {
                  const isSelected = activeCategory === cat.slug;
                  return (
                    <button
                      key={cat.slug}
                      type="button"
                      role="option"
                      aria-selected={isSelected}
                      onClick={() =>
                        applyFilter({ category: isSelected ? "" : cat.slug })
                      }
                      className={optionItemClass(isSelected)}
                    >
                      <span className="truncate">{cat.label}</span>
                      {isSelected && (
                        <Check
                          className="w-3.5 h-3.5 shrink-0"
                          strokeWidth={1.8}
                          aria-hidden="true"
                        />
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* 2. Pill Oraș */}
          <div className="relative">
            <button
              type="button"
              onClick={() => toggleDropdown("city")}
              aria-expanded={openDropdown === "city"}
              aria-haspopup="listbox"
              className={pillClass(
                Boolean(activeCity),
                openDropdown === "city"
              )}
            >
              <MapPin
                className="w-3.5 h-3.5 shrink-0"
                strokeWidth={1.8}
                aria-hidden="true"
              />
              <span>{activeCity || "Oraș"}</span>
              <ChevronDown
                className={`w-3.5 h-3.5 shrink-0 transition-transform ${
                  openDropdown === "city" ? "rotate-180" : ""
                }`}
                strokeWidth={1.8}
                aria-hidden="true"
              />
            </button>

            {openDropdown === "city" && (
              <div
                role="listbox"
                aria-label="Selectează orașul"
                className="absolute left-0 top-full mt-2 w-64 max-h-80 overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-xl p-2 z-40 space-y-0.5"
              >
                <button
                  type="button"
                  role="option"
                  aria-selected={!activeCity}
                  onClick={() => applyFilter({ city: "" })}
                  className={optionItemClass(!activeCity)}
                >
                  <span>Toate orașele</span>
                  {!activeCity && (
                    <Check
                      className="w-3.5 h-3.5 shrink-0"
                      strokeWidth={1.8}
                      aria-hidden="true"
                    />
                  )}
                </button>

                {RENTA_CITIES.map((cityName) => {
                  const isSelected = activeCity === cityName;
                  return (
                    <button
                      key={cityName}
                      type="button"
                      role="option"
                      aria-selected={isSelected}
                      onClick={() =>
                        applyFilter({ city: isSelected ? "" : cityName })
                      }
                      className={optionItemClass(isSelected)}
                    >
                      <span>{cityName}</span>
                      {isSelected && (
                        <Check
                          className="w-3.5 h-3.5 shrink-0"
                          strokeWidth={1.8}
                          aria-hidden="true"
                        />
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* 3. Pill Preț / zi */}
          <div className="relative">
            <button
              type="button"
              onClick={() => toggleDropdown("price")}
              aria-expanded={openDropdown === "price"}
              aria-haspopup="dialog"
              className={pillClass(hasPriceFilter, openDropdown === "price")}
            >
              <Banknote
                className="w-3.5 h-3.5 shrink-0"
                strokeWidth={1.8}
                aria-hidden="true"
              />
              <span>{pricePillLabel}</span>
              <ChevronDown
                className={`w-3.5 h-3.5 shrink-0 transition-transform ${
                  openDropdown === "price" ? "rotate-180" : ""
                }`}
                strokeWidth={1.8}
                aria-hidden="true"
              />
            </button>

            {openDropdown === "price" && (
              <div
                role="dialog"
                aria-label="Filtrează după preț pe zi"
                className="absolute left-0 top-full mt-2 w-72 rounded-2xl border border-slate-200 bg-white shadow-xl p-3 z-40 space-y-3"
              >
                <div className="space-y-0.5">
                  <button
                    type="button"
                    onClick={() => applyFilter({ minPrice: "", maxPrice: "" })}
                    className={optionItemClass(!hasPriceFilter)}
                  >
                    <span>Orice preț</span>
                    {!hasPriceFilter && (
                      <Check
                        className="w-3.5 h-3.5 shrink-0"
                        strokeWidth={1.8}
                        aria-hidden="true"
                      />
                    )}
                  </button>

                  {PRICE_RANGES.map((range) => {
                    const isSelected =
                      activeMinPrice === range.min &&
                      activeMaxPrice === range.max;
                    return (
                      <button
                        key={range.label}
                        type="button"
                        onClick={() =>
                          applyFilter(
                            isSelected
                              ? { minPrice: "", maxPrice: "" }
                              : { minPrice: range.min, maxPrice: range.max }
                          )
                        }
                        className={optionItemClass(isSelected)}
                      >
                        <span>{range.label}</span>
                        {isSelected && (
                          <Check
                            className="w-3.5 h-3.5 shrink-0"
                            strokeWidth={1.8}
                            aria-hidden="true"
                          />
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* Interval personalizat Min - Max */}
                <form
                  onSubmit={handleCustomPriceSubmit}
                  className="pt-2.5 border-t border-slate-100 space-y-2"
                >
                  <p className="text-[11px] font-semibold text-ink-muted px-1">
                    Interval personalizat (RON / zi)
                  </p>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="number"
                      min={0}
                      inputMode="numeric"
                      value={minPriceInput}
                      onChange={(e) => setMinPriceInput(e.target.value)}
                      placeholder="Min"
                      aria-label="Preț minim RON pe zi"
                      className="w-full rounded-xl border border-slate-200 bg-slate-50/70 px-2.5 py-1.5 text-xs text-ink placeholder:text-ink-muted focus:border-ochre focus:bg-white focus:outline-none"
                    />
                    <span className="text-xs text-ink-muted">–</span>
                    <input
                      type="number"
                      min={0}
                      inputMode="numeric"
                      value={maxPriceInput}
                      onChange={(e) => setMaxPriceInput(e.target.value)}
                      placeholder="Max"
                      aria-label="Preț maxim RON pe zi"
                      className="w-full rounded-xl border border-slate-200 bg-slate-50/70 px-2.5 py-1.5 text-xs text-ink placeholder:text-ink-muted focus:border-ochre focus:bg-white focus:outline-none"
                    />
                    <button
                      type="submit"
                      className="shrink-0 rounded-xl bg-ochre hover:bg-ochre-hover text-white px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer"
                    >
                      Aplică
                    </button>
                  </div>
                </form>
              </div>
            )}
          </div>

          {/* 4. Pill Personal / Business */}
          <div className="relative">
            <button
              type="button"
              onClick={() => toggleDropdown("segment")}
              aria-expanded={openDropdown === "segment"}
              aria-haspopup="listbox"
              className={pillClass(
                activeSegment !== "all",
                openDropdown === "segment"
              )}
            >
              <ActiveSegmentIcon
                className="w-3.5 h-3.5 shrink-0"
                strokeWidth={1.8}
                aria-hidden="true"
              />
              <span>{activeSegmentOption.pillLabel}</span>
              <ChevronDown
                className={`w-3.5 h-3.5 shrink-0 transition-transform ${
                  openDropdown === "segment" ? "rotate-180" : ""
                }`}
                strokeWidth={1.8}
                aria-hidden="true"
              />
            </button>

            {openDropdown === "segment" && (
              <div
                role="listbox"
                aria-label="Selectează segmentul proprietarului"
                className="absolute left-0 top-full mt-2 w-56 rounded-2xl border border-slate-200 bg-white shadow-xl p-2 z-40 space-y-0.5"
              >
                {SEGMENT_OPTIONS.map((opt) => {
                  const isSelected = activeSegment === opt.key;
                  const OptionIcon = opt.icon;
                  return (
                    <button
                      key={opt.key}
                      type="button"
                      role="option"
                      aria-selected={isSelected}
                      onClick={() => applyFilter({ segment: opt.key })}
                      className={optionItemClass(isSelected)}
                    >
                      <span className="inline-flex items-center gap-2">
                        <OptionIcon
                          className="w-3.5 h-3.5 shrink-0"
                          strokeWidth={1.8}
                          aria-hidden="true"
                        />
                        <span>{opt.label}</span>
                      </span>
                      {isSelected && (
                        <Check
                          className="w-3.5 h-3.5 shrink-0"
                          strokeWidth={1.8}
                          aria-hidden="true"
                        />
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Dreapta — Pill de Ordonare */}
        <div className="relative">
          <button
            type="button"
            onClick={() => toggleDropdown("sort")}
            aria-expanded={openDropdown === "sort"}
            aria-haspopup="listbox"
            className={pillClass(
              activeSort !== "newest",
              openDropdown === "sort"
            )}
          >
            <ArrowUpDown
              className="w-3.5 h-3.5 shrink-0"
              strokeWidth={1.8}
              aria-hidden="true"
            />
            <span className="text-ink-muted font-normal">Ordonează:</span>
            <span className="font-semibold inline-flex items-center gap-1">
              <span>{activeSortOption.label}</span>
              {activeSortOption.showStar && (
                <Star
                  className="w-3 h-3 fill-amber-400 text-amber-400 shrink-0"
                  strokeWidth={1.8}
                  aria-hidden="true"
                />
              )}
            </span>
            <ChevronDown
              className={`w-3.5 h-3.5 shrink-0 transition-transform ${
                openDropdown === "sort" ? "rotate-180" : ""
              }`}
              strokeWidth={1.8}
              aria-hidden="true"
            />
          </button>

          {openDropdown === "sort" && (
            <div
              role="listbox"
              aria-label="Ordonează anunțurile"
              className="absolute right-0 top-full mt-2 w-56 rounded-2xl border border-slate-200 bg-white shadow-xl p-2 z-40 space-y-0.5"
            >
              {SORT_OPTIONS.map((opt) => {
                const isSelected = activeSort === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => applyFilter({ sort: opt.value })}
                    className={optionItemClass(isSelected)}
                  >
                    <span className="inline-flex items-center gap-1.5">
                      <span>{opt.label}</span>
                      {opt.showStar && (
                        <Star
                          className="w-3.5 h-3.5 fill-amber-400 text-amber-400 shrink-0"
                          strokeWidth={1.8}
                          aria-hidden="true"
                        />
                      )}
                    </span>
                    {isSelected && (
                      <Check
                        className="w-3.5 h-3.5 shrink-0"
                        strokeWidth={1.8}
                        aria-hidden="true"
                      />
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Rând discret de chip-uri active — randat DOAR când există cel puțin un filtru activ */}
      {hasActiveFilters && (
        <div className="flex flex-wrap items-center gap-2 px-1">
          {activeQ && (
            <Link
              href={buildFilterHref({ q: "" })}
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white border border-slate-200 hover:border-ochre/40 hover:bg-ochre-light/50 text-xs text-ink transition-colors"
              title="Elimină căutarea"
            >
              <span className="truncate max-w-[180px]">
                Căutare: &ldquo;{activeQ}&rdquo;
              </span>
              <X
                className="w-3 h-3 text-ink-muted shrink-0"
                strokeWidth={1.8}
                aria-hidden="true"
              />
            </Link>
          )}

          {activeCategory && (
            <Link
              href={buildFilterHref({ category: "" })}
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-ochre-light border border-ochre/30 text-xs font-medium text-ochre transition-colors hover:bg-ochre/15"
              title="Elimină filtrul de categorie"
            >
              <Layers
                className="w-3 h-3 shrink-0"
                strokeWidth={1.8}
                aria-hidden="true"
              />
              <span>{getCategoryLabel(activeCategory)}</span>
              <X
                className="w-3 h-3 shrink-0"
                strokeWidth={1.8}
                aria-hidden="true"
              />
            </Link>
          )}

          {activeCity && (
            <Link
              href={buildFilterHref({ city: "" })}
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-ochre-light border border-ochre/30 text-xs font-medium text-ochre transition-colors hover:bg-ochre/15"
              title="Elimină filtrul de oraș"
            >
              <MapPin
                className="w-3 h-3 shrink-0"
                strokeWidth={1.8}
                aria-hidden="true"
              />
              <span>{activeCity}</span>
              <X
                className="w-3 h-3 shrink-0"
                strokeWidth={1.8}
                aria-hidden="true"
              />
            </Link>
          )}

          {hasPriceFilter && (
            <Link
              href={buildFilterHref({ minPrice: "", maxPrice: "" })}
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-ochre-light border border-ochre/30 text-xs font-medium text-ochre transition-colors hover:bg-ochre/15"
              title="Elimină filtrul de preț"
            >
              <Banknote
                className="w-3 h-3 shrink-0"
                strokeWidth={1.8}
                aria-hidden="true"
              />
              <span>{pricePillLabel}</span>
              <X
                className="w-3 h-3 shrink-0"
                strokeWidth={1.8}
                aria-hidden="true"
              />
            </Link>
          )}

          {activeSegment !== "all" && (
            <Link
              href={buildFilterHref({ segment: "all" })}
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-ochre-light border border-ochre/30 text-xs font-medium text-ochre transition-colors hover:bg-ochre/15"
              title="Elimină filtrul de segment"
            >
              <ActiveSegmentIcon
                className="w-3 h-3 shrink-0"
                strokeWidth={1.8}
                aria-hidden="true"
              />
              <span>{activeSegmentOption.label}</span>
              <X
                className="w-3 h-3 shrink-0"
                strokeWidth={1.8}
                aria-hidden="true"
              />
            </Link>
          )}

          <Link
            href="/catalog"
            className="text-xs font-semibold text-ochre hover:underline px-1.5 py-1"
          >
            Șterge tot
          </Link>
        </div>
      )}
    </div>
  );
}
