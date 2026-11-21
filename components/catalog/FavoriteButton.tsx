"use client";

import { useFavorites } from "@/lib/favorites/useFavorites";

/**
 * Componenta `FavoriteButton` — Buton Interactiv de Apreciere / Salvare la Favorite
 * (`components/catalog/FavoriteButton.tsx`).
 *
 * Explicație pentru dezvoltatori C / Java:
 * - Este un Client Component (`"use client"`) care citește și comută starea
 *   unui anunț în colecția de favorite prin hook-ul `useFavorites()`.
 * - Respectă cu strictețe regulile Modern Web Guidance (`accessibility` & `icons`):
 *   1. Folosește `<button type="button" aria-pressed={active} aria-label={...}>`
 *      unde `aria-label` conține titlul anunțului (`Salvează la favorite: ${listingTitle}`)
 *      fără a repeta starea în text (deoarece `aria-pressed` comunică deja starea).
 *   2. Dimensiune țintă tactilă de `w-8 h-8` (32x32px >= 24x24px).
 *   3. Nu folosește `group-hover:text-rose-500`, astfel încât inimioara se
 *      colorează doar la hover direct pe buton sau când anunțul este apreciat!
 */
interface FavoriteButtonProps {
  listingId: string;
  listingTitle: string;
  variant?: "icon" | "pill";
}

export function FavoriteButton({
  listingId,
  listingTitle,
  variant = "icon",
}: FavoriteButtonProps) {
  const { isFavorite, toggleFavorite, hydrated } = useFavorites();
  const active = hydrated && isFavorite(listingId);

  if (variant === "pill") {
    return (
      <button
        type="button"
        onClick={() => toggleFavorite(listingId)}
        aria-pressed={active}
        aria-label={`Salvează la favorite: ${listingTitle}`}
        title={active ? "Elimină de la favorite" : "Salvează la favorite"}
        className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer select-none ${
          active
            ? "text-rose-600 bg-rose-50 border border-rose-200/80 shadow-2xs hover:bg-rose-100/80"
            : "text-ink bg-white hover:text-rose-600 hover:bg-rose-50 border border-slate-200 hover:border-rose-200/80"
        }`}
      >
        {active ? (
          <svg
            className="w-4 h-4 text-rose-500 shrink-0"
            viewBox="0 0 24 24"
            fill="currentColor"
            aria-hidden="true"
          >
            <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
          </svg>
        ) : (
          <svg
            className="w-4 h-4 shrink-0"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z"
            />
          </svg>
        )}
        <span>{active ? "Salvat la favorite" : "Salvează la favorite"}</span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        toggleFavorite(listingId);
      }}
      aria-pressed={active}
      aria-label={`Salvează la favorite: ${listingTitle}`}
      title={active ? "Elimină de la favorite" : "Salvează la favorite"}
      className={`w-8 h-8 rounded-full inline-flex items-center justify-center shrink-0 transition-all cursor-pointer select-none -mt-1 -mr-1 ${
        active
          ? "text-rose-500 bg-rose-50 border border-rose-200/80 shadow-2xs hover:bg-rose-100/80"
          : "text-slate-400 hover:text-rose-500 hover:bg-rose-50 border border-transparent hover:border-rose-200/70"
      }`}
    >
      {active ? (
        <svg
          className="w-4 h-4"
          viewBox="0 0 24 24"
          fill="currentColor"
          aria-hidden="true"
        >
          <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
        </svg>
      ) : (
        <svg
          className="w-4 h-4"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z"
          />
        </svg>
      )}
    </button>
  );
}
