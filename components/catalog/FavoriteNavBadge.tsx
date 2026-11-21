"use client";

import { useFavorites } from "@/lib/favorites/useFavorites";

/**
 * Componenta `FavoriteNavBadge` — Contor Numeric Live în Navigație
 * (`components/catalog/FavoriteNavBadge.tsx`).
 *
 * Explicație pentru dezvoltatori C / Java:
 * - Se abonează la `useFavorites()` și afișează un badge discret cu numărul
 *   de anunțuri apreciate (`count`) de îndată ce browserul s-a hidratat
 *   și `count > 0`.
 */
interface FavoriteNavBadgeProps {
  className?: string;
}

export function FavoriteNavBadge({ className = "" }: FavoriteNavBadgeProps) {
  const { count, hydrated } = useFavorites();

  if (!hydrated || count <= 0) {
    return null;
  }

  return (
    <span
      className={`inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-rose-500 text-white text-[10px] font-bold leading-none ${className}`}
    >
      {count > 99 ? "99+" : count}
    </span>
  );
}
