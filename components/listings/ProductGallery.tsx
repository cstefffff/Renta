"use client";

import { useState } from "react";

/**
 * Componenta `ProductGallery` — Galerie Foto Interactivă pentru Pagina de Detaliu Obiect.
 *
 * Explicație pentru dezvoltatori C / Java:
 * - Este un Client Component (`"use client"`) deoarece gestionează starea locală
 *   a indexului fotografiei active (`activeIndex` prin hook-ul `useState(0)`).
 * - Când un anunț are mai multe fotografii (`images.length > 1`), utilizatorul poate
 *   naviga între ele prin:
 *   1. Butoanele circulare Stânga (`‹`) / Dreapta (`›`) suprapuse pe imaginea principală.
 *   2. Rândul de miniaturi (thumbnails) interactive de sub fotografia principală.
 */
export interface ProductGalleryProps {
  images: { id?: string; url: string; display_order?: number | null }[];
  title: string;
  catalogCode: string;
  categoryLabel: string;
}

export function ProductGallery({
  images,
  title,
  catalogCode,
  categoryLabel,
}: ProductGalleryProps) {
  const [activeIndex, setActiveIndex] = useState(0);

  const totalImages = images.length;
  const safeIndex =
    totalImages > 0 ? Math.min(activeIndex, totalImages - 1) : 0;
  const currentImage = totalImages > 0 ? images[safeIndex] : null;

  function handlePrev() {
    if (totalImages <= 1) return;
    setActiveIndex((prev) => (prev - 1 + totalImages) % totalImages);
  }

  function handleNext() {
    if (totalImages <= 1) return;
    setActiveIndex((prev) => (prev + 1) % totalImages);
  }

  return (
    <div className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-sm space-y-4">
      <div className="flex items-center justify-between text-xs">
        <span className="font-semibold text-ink">
          Galerie Foto Produs ({totalImages}{" "}
          {totalImages === 1 ? "imagine" : "imagini"})
        </span>
        <span className="font-mono text-ink-muted">
          {catalogCode} &bull; {categoryLabel}
        </span>
      </div>

      {currentImage ? (
        <div className="space-y-3">
          {/* Fotografia activă mare */}
          <div className="relative h-80 sm:h-[440px] w-full bg-slate-100 rounded-xl overflow-hidden border border-slate-200/70 group">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={currentImage.url}
              alt={`${title} - fotografia ${safeIndex + 1} din ${totalImages}`}
              className="w-full h-full object-cover transition-all duration-200"
            />

            {/* Controale stânga/dreapta și badge contor dacă există mai multe poze */}
            {totalImages > 1 && (
              <>
                <button
                  type="button"
                  onClick={handlePrev}
                  aria-label="Fotografia anterioară"
                  className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/90 hover:bg-white text-ink shadow-md flex items-center justify-center transition-all cursor-pointer"
                >
                  <span className="text-xl font-bold leading-none select-none">
                    &lsaquo;
                  </span>
                </button>

                <button
                  type="button"
                  onClick={handleNext}
                  aria-label="Fotografia următoare"
                  className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/90 hover:bg-white text-ink shadow-md flex items-center justify-center transition-all cursor-pointer"
                >
                  <span className="text-xl font-bold leading-none select-none">
                    &rsaquo;
                  </span>
                </button>

                <span className="absolute bottom-3 right-3 bg-slate-900/75 backdrop-blur-sm text-white text-[11px] font-mono px-2.5 py-1 rounded-full">
                  {safeIndex + 1} / {totalImages} fotografii
                </span>
              </>
            )}
          </div>

          {/* Rând de miniaturi (thumbnails) interactive */}
          {totalImages > 1 && (
            <div className="grid grid-cols-4 sm:grid-cols-5 gap-2.5">
              {images.map((img, idx) => {
                const isSelected = idx === safeIndex;
                return (
                  <button
                    key={img.id || `${img.url}-${idx}`}
                    type="button"
                    onClick={() => setActiveIndex(idx)}
                    aria-label={`Selectează fotografia ${idx + 1}`}
                    aria-current={isSelected ? "true" : undefined}
                    className={`relative h-20 sm:h-24 bg-slate-100 rounded-xl overflow-hidden border transition-all cursor-pointer ${
                      isSelected
                        ? "ring-2 ring-ochre border-ochre opacity-100"
                        : "border-slate-200/70 opacity-75 hover:opacity-100"
                    }`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={img.url}
                      alt={`${title} - miniatură ${idx + 1}`}
                      className="w-full h-full object-cover"
                    />
                  </button>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        <div className="h-72 flex flex-col items-center justify-center p-6 text-center text-xs text-ink-muted bg-slate-100 rounded-xl">
          <div className="px-4 py-2 rounded-full bg-white border border-slate-200 font-semibold text-ink mb-2">
            Fără fotografie atașată
          </div>
          <p>
            Proprietarul nu a atașat încă o fotografie pentru fișa{" "}
            <span className="font-mono font-semibold">{catalogCode}</span>.
          </p>
        </div>
      )}
    </div>
  );
}
