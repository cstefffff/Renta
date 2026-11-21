"use client";

import { useState, useEffect, useCallback } from "react";
import {
  getUserFavoriteIdsAction,
  syncUserFavoriteIdsAction,
} from "@/app/actions/listings";

/**
 * ============================================================================
 * RentA — Manager Client-Side & Hook React pentru Anunțuri Favorite
 * (`lib/favorites/useFavorites.ts`)
 * ============================================================================
 *
 * Explicație pentru dezvoltatori C / Java:
 * - Gândește-te la acest modul ca la un `FavoritesService` (Singleton în browser)
 *   combinat cu un `Observer` (`CustomEvent("renta:favorites-changed")`).
 * - Când utilizatorul apasă pe inimioară pe oricare card (`ObjectCard`) sau
 *   în pagina de detaliu (`/obiect/[id]`):
 *   1. Lista de ID-uri este actualizată sincron în `localStorage` (`renta_favorites_v1`).
 *   2. Este emis evenimentul `"renta:favorites-changed"` pe `window`, astfel încât
 *      toate componentele abonate (carduri, badge-ul din `Header`, `SidebarRail`,
 *      `MobileNav` și pagina `/favorite`) se re-randează instantaneu (0ms latență).
 *   3. În fundal (asincron, non-blocking), lista este sincronizată și în
 *      `auth.users.user_metadata.favorite_listing_ids` prin `syncUserFavoriteIdsAction`
 *      dacă utilizatorul este autentificat.
 */

export const FAVORITES_STORAGE_KEY = "renta_favorites_v1";
export const FAVORITES_CHANGED_EVENT = "renta:favorites-changed";

// Flag la nivel de modul (static în Java/C) ca să sincronizăm cu serverul o singură dată pe sesiune
let hasSyncedWithServer = false;

function sanitizeIds(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const unique = new Set<string>();
  for (const item of raw) {
    if (typeof item === "string") {
      const trimmed = item.trim();
      if (trimmed.length > 0) {
        unique.add(trimmed);
      }
    }
  }
  return Array.from(unique);
}

/**
 * Citește lista de ID-uri favorite din `localStorage` (sigur pentru SSR).
 */
export function readFavoriteIdsFromStorage(): string[] {
  if (typeof window === "undefined") {
    return [];
  }
  try {
    const raw = window.localStorage.getItem(FAVORITES_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return sanitizeIds(parsed);
  } catch {
    return [];
  }
}

/**
 * Salvează lista de ID-uri în `localStorage` și notifică toate componentele din pagină.
 */
export function writeFavoriteIdsToStorage(ids: string[]): string[] {
  const cleanIds = sanitizeIds(ids);
  if (typeof window === "undefined") {
    return cleanIds;
  }
  try {
    window.localStorage.setItem(
      FAVORITES_STORAGE_KEY,
      JSON.stringify(cleanIds)
    );
  } catch {
    // Ignorăm eventuale erori de cotă localStorage în mod privat
  }

  window.dispatchEvent(
    new CustomEvent<string[]>(FAVORITES_CHANGED_EVENT, { detail: cleanIds })
  );
  return cleanIds;
}

/**
 * Hook React `useFavorites()` — oferă acces reactiv la colecția de anunțuri apreciate.
 */
export function useFavorites() {
  const [favoriteIds, setFavoriteIds] = useState<string[]>([]);
  const [hydrated, setHydrated] = useState<boolean>(false);

  useEffect(() => {
    // 1. Citire inițială din localStorage la hidratarea în browser
    const localIds = readFavoriteIdsFromStorage();
    setFavoriteIds(localIds);
    setHydrated(true);

    // 2. Abonare la evenimentul global din fereastră + schimbări din alte tab-uri
    const handleCustomChange = () => {
      setFavoriteIds(readFavoriteIdsFromStorage());
    };

    const handleStorageEvent = (e: StorageEvent) => {
      if (e.key === FAVORITES_STORAGE_KEY) {
        setFavoriteIds(readFavoriteIdsFromStorage());
      }
    };

    window.addEventListener(FAVORITES_CHANGED_EVENT, handleCustomChange);
    window.addEventListener("storage", handleStorageEvent);

    // 3. Sincronizare inițială cu contul Supabase (o singură dată pe sesiune)
    if (!hasSyncedWithServer) {
      hasSyncedWithServer = true;
      getUserFavoriteIdsAction()
        .then((serverIds) => {
          if (!Array.isArray(serverIds) || serverIds.length === 0) {
            // Dacă avem favorite locale dar nimic pe server, încercăm să le urcăm în cont
            const currentLocal = readFavoriteIdsFromStorage();
            if (currentLocal.length > 0) {
              syncUserFavoriteIdsAction(currentLocal).catch(() => {});
            }
            return;
          }

          const currentLocal = readFavoriteIdsFromStorage();
          const merged = Array.from(new Set([...currentLocal, ...serverIds]));

          // Dacă reuniunea aduce ID-uri noi de pe server, actualizăm localStorage și UI-ul
          if (merged.length !== currentLocal.length) {
            writeFavoriteIdsToStorage(merged);
            syncUserFavoriteIdsAction(merged).catch(() => {});
          }
        })
        .catch(() => {
          // Utilizator neautentificat sau offline — continuăm cu localStorage
        });
    }

    return () => {
      window.removeEventListener(FAVORITES_CHANGED_EVENT, handleCustomChange);
      window.removeEventListener("storage", handleStorageEvent);
    };
  }, []);

  const isFavorite = useCallback(
    (id: string): boolean => {
      if (!id) return false;
      return favoriteIds.includes(id);
    },
    [favoriteIds]
  );

  const toggleFavorite = useCallback((id: string): void => {
    const cleanId = id?.trim();
    if (!cleanId) return;

    const current = readFavoriteIdsFromStorage();
    const exists = current.includes(cleanId);
    const nextIds = exists
      ? current.filter((item) => item !== cleanId)
      : [cleanId, ...current];

    const saved = writeFavoriteIdsToStorage(nextIds);
    setFavoriteIds(saved);

    // Sincronizăm asincron în fundal cu user_metadata din Supabase
    syncUserFavoriteIdsAction(saved).catch(() => {});
  }, []);

  const clearFavorites = useCallback((): void => {
    const saved = writeFavoriteIdsToStorage([]);
    setFavoriteIds(saved);
    syncUserFavoriteIdsAction([]).catch(() => {});
  }, []);

  return {
    favoriteIds,
    isFavorite,
    toggleFavorite,
    clearFavorites,
    count: favoriteIds.length,
    hydrated,
  };
}
