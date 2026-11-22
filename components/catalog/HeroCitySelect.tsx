"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { RENTA_CITIES } from "@/lib/types/database";

interface CityItem {
  value: string;
  label: string;
}

const ALL_CITY_ITEMS: readonly CityItem[] = [
  {
    value: "",
    label: "Toate orașele",
  },
  ...RENTA_CITIES.map((city) => ({
    value: city,
    label: city,
  })),
];

/**
 * Dropdown custom pentru selecția orașului în bara de căutare din Hero
 * (`components/catalog/HeroCitySelect.tsx`).
 *
 * Design:
 * - Același stil vizual ca `HeroCategorySelect`, dar fără iconițe în dreptul opțiunilor.
 * - Aliniat 100% la lățimea butonului declanșator (`left-0 right-0 w-full`).
 * - Fără scrollbar vertical (`overflow-hidden rounded-2xl`), afișând toate cele
 *   8 orașe + opțiunea "Toate orașele" cu colțuri perfect rotunjite.
 */
export function HeroCitySelect() {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedCity, setSelectedCity] = useState<string>("");
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedItem =
    ALL_CITY_ITEMS.find((item) => item.value === selectedCity) ??
    ALL_CITY_ITEMS[0];

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
      <input type="hidden" name="city" value={selectedCity} />

      <button
        type="button"
        aria-label="Oraș"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        onClick={() => setIsOpen((prev) => !prev)}
        className={`w-full bg-white border rounded-xl px-3.5 py-2.5 text-sm text-ink flex items-center justify-between gap-2 transition-all cursor-pointer ${
          isOpen
            ? "border-ochre ring-2 ring-ochre/15"
            : "border-slate-200/90 hover:border-slate-300"
        }`}
      >
        <span className="truncate font-medium">{selectedItem.label}</span>
        <ChevronDown
          className={`w-4 h-4 text-ink-muted shrink-0 transition-transform duration-200 ${
            isOpen ? "rotate-180 text-ochre" : ""
          }`}
          strokeWidth={1.8}
          aria-hidden="true"
        />
      </button>

      {isOpen && (
        <div className="absolute left-0 right-0 w-full min-w-[190px] top-full mt-2 z-40 bg-white border border-slate-200/90 rounded-2xl shadow-xl ring-1 ring-slate-900/5 overflow-hidden">
          <div
            role="listbox"
            aria-label="Selectează orașul"
            className="max-h-64 overflow-y-auto p-1.5 space-y-0.5 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-slate-200 hover:[&::-webkit-scrollbar-thumb]:bg-slate-300"
          >
            {ALL_CITY_ITEMS.map((item, index) => {
              const isSelected = item.value === selectedCity;
              const isAllOption = index === 0;

              return (
                <div
                  key={item.value || "all"}
                  className={
                    isAllOption ? "pb-1 mb-1 border-b border-slate-100" : ""
                  }
                >
                  <button
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => {
                      setSelectedCity(item.value);
                      setIsOpen(false);
                    }}
                    className={`group w-full flex items-center justify-between gap-2 px-3 py-2 rounded-xl text-left text-[13px] transition-all cursor-pointer ${
                      isSelected
                        ? "bg-ochre-light/80 text-ochre font-semibold"
                        : "text-ink hover:bg-slate-50 font-medium"
                    }`}
                  >
                    <span className="truncate">{item.label}</span>

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
