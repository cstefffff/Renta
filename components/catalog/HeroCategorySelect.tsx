"use client";

import { useEffect, useRef, useState } from "react";
import {
  Bike,
  Camera,
  Check,
  ChevronDown,
  Gamepad2,
  LayoutGrid,
  Package,
  PartyPopper,
  Shirt,
  Tent,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import { LISTING_CATEGORIES } from "@/lib/constants/categories";
import type { CategorySlug } from "@/lib/types/database";

/**
 * Mapare iconițe vectoriale (`lucide-react`) pentru categoriile din Hero-ul Homepage.
 *
 * Analogie C / Java:
 * Un `Map<CategorySlug, LucideIcon>` (HashMap imutabil) care asociază fiecărui
 * slug de categorie o componentă SVG curată și uniformă.
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

interface CategoryItem {
  slug: string;
  label: string;
  Icon: LucideIcon;
}

const ALL_CATEGORY_ITEMS: readonly CategoryItem[] = [
  {
    slug: "",
    label: "Toate categoriile",
    Icon: LayoutGrid,
  },
  ...LISTING_CATEGORIES.map((cat) => ({
    slug: cat.slug,
    label: cat.label,
    Icon: CATEGORY_ICONS[cat.slug] ?? Package,
  })),
];

/**
 * Dropdown custom cu iconițe `lucide-react` pentru selecția categoriei
 * în bara de căutare din Hero (`components/catalog/HeroCategorySelect.tsx`).
 *
 * Design:
 * - Aliniat 100% la lățimea butonului declanșator (`left-0 right-0 w-full`).
 * - Fără scrollbar vertical (`overflow-hidden rounded-2xl`), afișând toate cele
 *   8 categorii + opțiunea "Toate categoriile" cu colțuri perfect rotunjite.
 */
export function HeroCategorySelect() {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedSlug, setSelectedSlug] = useState<string>("");
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedItem =
    ALL_CATEGORY_ITEMS.find((item) => item.slug === selectedSlug) ??
    ALL_CATEGORY_ITEMS[0];
  const SelectedIcon = selectedItem.Icon;

  useEffect(() => {
    if (!isOpen) return;

    function handleClickOutside(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  return (
    <div ref={containerRef} className="relative">
      {/* Câmp ascuns trimis automat la submit-ul formularului GET către /catalog */}
      <input type="hidden" name="category" value={selectedSlug} />

      <button
        type="button"
        aria-label="Categorie"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        onClick={() => setIsOpen((prev) => !prev)}
        className={`w-full bg-white border rounded-xl px-3.5 py-2.5 text-sm text-ink flex items-center justify-between gap-2 transition-all cursor-pointer ${
          isOpen
            ? "border-ochre ring-2 ring-ochre/15"
            : "border-slate-200/90 hover:border-slate-300"
        }`}
      >
        <span className="flex items-center gap-2 min-w-0">
          <SelectedIcon
            className="w-4 h-4 text-ochre shrink-0"
            strokeWidth={1.8}
            aria-hidden="true"
          />
          <span className="truncate font-medium">{selectedItem.label}</span>
        </span>
        <ChevronDown
          className={`w-4 h-4 text-ink-muted shrink-0 transition-transform duration-200 ${
            isOpen ? "rotate-180 text-ochre" : ""
          }`}
          strokeWidth={1.8}
          aria-hidden="true"
        />
      </button>

      {isOpen && (
        <div className="absolute left-0 right-0 w-full min-w-[250px] top-full mt-2 z-40 bg-white border border-slate-200/90 rounded-2xl shadow-xl ring-1 ring-slate-900/5 overflow-hidden">
          <div
            role="listbox"
            aria-label="Selectează categoria"
            className="max-h-64 overflow-y-auto p-1.5 space-y-0.5 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-slate-200 hover:[&::-webkit-scrollbar-thumb]:bg-slate-300"
          >
            {ALL_CATEGORY_ITEMS.map((item, index) => {
              const ItemIcon = item.Icon;
              const isSelected = item.slug === selectedSlug;
              const isAllOption = index === 0;

              return (
                <div
                  key={item.slug || "all"}
                  className={
                    isAllOption ? "pb-1 mb-1 border-b border-slate-100" : ""
                  }
                >
                  <button
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => {
                      setSelectedSlug(item.slug);
                      setIsOpen(false);
                    }}
                    className={`group w-full flex items-center justify-between gap-2.5 px-2.5 py-1.5 rounded-xl text-left text-[13px] transition-all cursor-pointer ${
                      isSelected
                        ? "bg-ochre-light/80 text-ochre font-semibold"
                        : "text-ink hover:bg-slate-50 font-medium"
                    }`}
                  >
                    <span className="flex items-center gap-2.5 min-w-0">
                      <span
                        className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
                          isSelected
                            ? "bg-ochre text-white shadow-2xs"
                            : "bg-slate-100 text-slate-600 group-hover:bg-ochre-light group-hover:text-ochre"
                        }`}
                      >
                        <ItemIcon
                          className="w-3.5 h-3.5"
                          strokeWidth={1.8}
                          aria-hidden="true"
                        />
                      </span>
                      <span className="truncate">{item.label}</span>
                    </span>

                    {isSelected && (
                      <Check
                        className="w-4 h-4 text-ochre shrink-0"
                        strokeWidth={2}
                        aria-hidden="true"
                      />
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
