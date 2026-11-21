"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowUp, Check } from "lucide-react";
import { getPaginatedPublicListingsAction } from "@/app/actions/listings";
import { ObjectCard } from "@/components/catalog/ObjectCard";
import type { CatalogFilters, ListingWithDetails } from "@/lib/types/database";

/**
 * Props pentru grila continuă cu Infinite Scroll (`EndlessCatalogGrid`).
 *
 * Explicație pentru C / Java:
 * - `initialItems` și `totalCount` vin deja încărcate de pe server (SSR — pagina 1),
 *   deci utilizatorul vede imediat primele anunțuri fără ecran alb.
 * - `filters` reprezintă criteriile active (segment, căutare, categorie, oraș, preț, sortare),
 *   fără `page` și `pageSize` (`Omit<...>`), deoarece acestea sunt gestionate intern la scroll.
 */
export interface EndlessCatalogGridProps {
  initialItems: ListingWithDetails[];
  totalCount: number;
  pageSize?: number;
  filters: Omit<CatalogFilters, "page" | "pageSize">;
  gridClassName?: string;
}

/**
 * Grilă Endless / Infinite Scroll (stil OLX / Vinted) — Client Component.
 *
 * Cum funcționează sub capotă:
 * 1. Păstrează în state lista cumulativă de anunțuri (`items`), pagina curentă (`page`),
 *    starea de încărcare (`loading`) și dacă mai există pagini (`hasMore`).
 * 2. Plasează o „santinelă” invizibilă (`sentinelRef`) la finalul grilei și o monitorizează
 *    cu API-ul nativ al browserului `IntersectionObserver` (`rootMargin: "320px"`).
 * 3. Când utilizatorul se apropie de finalul listei, apelează automat Server Action-ul
 *    `getPaginatedPublicListingsAction` pentru pagina următoare, deduplică rezultatele după `id`
 *    și le adaugă fără întrerupere în grilă.
 */
export function EndlessCatalogGrid({
  initialItems,
  totalCount,
  pageSize = 12,
  filters,
  gridClassName,
}: EndlessCatalogGridProps) {
  const [items, setItems] = useState<ListingWithDetails[]>(initialItems);
  const [page, setPage] = useState<number>(1);
  const [total, setTotal] = useState<number>(totalCount);
  const [loading, setLoading] = useState<boolean>(false);
  const [hasMore, setHasMore] = useState<boolean>(
    initialItems.length < totalCount
  );
  const [error, setError] = useState<string | null>(null);

  // Referință DOM către santinela de la finalul grilei (analog unui pointer către un nod DOM)
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  // Lock atomic sincron pentru a preveni apeluri concurente duble la scroll rapid
  const isFetchingRef = useRef<boolean>(false);
  // Contor de generație (analog cu AtomicInteger în Java) pentru anularea răspunsurilor
  // vechi dacă utilizatorul schimbă filtrele în timp ce o cerere este pe rețea.
  const generationRef = useRef<number>(0);

  // Buffer Lookahead cu un singur slot (Single-Slot CompletableFuture pentru pagina N + 1):
  // Păstrează atât promisiunea în zbor (pentru a nu dubla cererea), cât și rezultatul
  // rezolvat în RAM (pentru lipire sincronă în 0 ms fără afișarea spinner-ului).
  const prefetchRef = useRef<{
    page: number;
    generation: number;
    resolvedItems: ListingWithDetails[] | null;
    promise: Promise<ListingWithDetails[] | null>;
  } | null>(null);

  // Sincronizează starea internă atunci când serverul trimite un set nou de rezultate
  // (de ex. la schimbarea segmentului sau a filtrelor din URL).
  useEffect(() => {
    generationRef.current += 1;
    prefetchRef.current = null;
    setItems(initialItems);
    setPage(1);
    setTotal(totalCount);
    setHasMore(initialItems.length < totalCount);
    setLoading(false);
    setError(null);
    isFetchingRef.current = false;
  }, [initialItems, totalCount]);

  // Extragem câmpurile primitive din `filters` pentru dependențe stabile în `useCallback`
  const { segment, q, category, city, minPrice, maxPrice, sort } = filters;

  // pornește sau returnează promisiunea de încărcare pentru `targetPage` (cu `skipCount: true`)
  const ensurePagePrefetched = useCallback(
    (targetPage: number) => {
      const currentGen = generationRef.current;
      const existing = prefetchRef.current;
      if (
        existing &&
        existing.page === targetPage &&
        existing.generation === currentGen
      ) {
        return existing;
      }

      const entry: {
        page: number;
        generation: number;
        resolvedItems: ListingWithDetails[] | null;
        promise: Promise<ListingWithDetails[] | null>;
      } = {
        page: targetPage,
        generation: currentGen,
        resolvedItems: null,
        promise: Promise.resolve(null),
      };

      entry.promise = getPaginatedPublicListingsAction({
        segment,
        q,
        category,
        city,
        minPrice,
        maxPrice,
        sort,
        page: targetPage,
        pageSize,
        skipCount: true,
      })
        .then((result) => {
          if (generationRef.current !== currentGen) {
            return null;
          }
          const incoming = Array.isArray(result.items) ? result.items : [];
          entry.resolvedItems = incoming;
          return incoming;
        })
        .catch(() => {
          if (prefetchRef.current === entry) {
            prefetchRef.current = null;
          }
          return null;
        });

      prefetchRef.current = entry;
      return entry;
    },
    [segment, q, category, city, minPrice, maxPrice, sort, pageSize]
  );

  // Pre-încărcăm silențios în fundal pagina următoare (`page + 1`) imediat ce pagina curentă e afișată
  useEffect(() => {
    if (!hasMore) {
      return;
    }
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const nextPage = page + 1;
    if (nextPage <= totalPages) {
      ensurePagePrefetched(nextPage);
    }
  }, [page, hasMore, total, pageSize, ensurePagePrefetched]);

  const appendBatch = useCallback(
    (incoming: ListingWithDetails[], nextPage: number) => {
      setItems((prev) => {
        // Deduplicare după `id` folosind un Set (O(1) lookup, similar cu HashSet<String> în Java)
        const existingIds = new Set(prev.map((item) => item.id));
        const uniqueIncoming = incoming.filter(
          (item) => !existingIds.has(item.id)
        );
        return uniqueIncoming.length > 0 ? [...prev, ...uniqueIncoming] : prev;
      });

      setPage(nextPage);
      const totalPages = Math.max(1, Math.ceil(total / pageSize));
      const morePagesAvailable =
        incoming.length >= pageSize && nextPage < totalPages;
      setHasMore(morePagesAvailable);
    },
    [total, pageSize]
  );

  const loadMore = useCallback(async () => {
    if (isFetchingRef.current || !hasMore) {
      return;
    }

    const currentGen = generationRef.current;
    const nextPage = page + 1;
    const prefetched = ensurePagePrefetched(nextPage);

    // FAST-PATH (0 ms): Dacă pagina N + 1 este deja descărcată în bufferul RAM,
    // o lipim sincron în DOM fără să mai afișăm spinner-ul!
    if (prefetched.resolvedItems !== null) {
      const readyItems = prefetched.resolvedItems;
      prefetchRef.current = null;
      appendBatch(readyItems, nextPage);
      return;
    }

    // FALLBACK (scroll foarte rapid): Așteptăm promisiunea deja aflată în zbor
    isFetchingRef.current = true;
    setLoading(true);
    setError(null);

    try {
      const incoming = await prefetched.promise;
      if (generationRef.current !== currentGen) {
        return;
      }

      if (incoming === null) {
        setError("Nu am putut încărca următoarele anunțuri. Încearcă din nou.");
        return;
      }

      prefetchRef.current = null;
      appendBatch(incoming, nextPage);
    } catch {
      if (generationRef.current === currentGen) {
        setError("Nu am putut încărca următoarele anunțuri. Încearcă din nou.");
      }
    } finally {
      if (generationRef.current === currentGen) {
        isFetchingRef.current = false;
        setLoading(false);
      }
    }
  }, [hasMore, page, ensurePagePrefetched, appendBatch]);

  // Observator nativ pentru Infinite Scroll — declanșează `loadMore()` cu 1200px (~3 rânduri) înainte de final
  useEffect(() => {
    if (!hasMore || loading) {
      return;
    }

    const sentinel = sentinelRef.current;
    if (!sentinel || typeof IntersectionObserver === "undefined") {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const firstEntry = entries[0];
        if (firstEntry?.isIntersecting) {
          void loadMore();
        }
      },
      {
        rootMargin: "1200px",
      }
    );

    observer.observe(sentinel);

    return () => {
      observer.disconnect();
    };
  }, [hasMore, loading, loadMore]);

  const effectiveTotal = Math.max(total, items.length);
  const progressPercent =
    effectiveTotal > 0
      ? Math.min(100, Math.round((items.length / effectiveTotal) * 100))
      : 0;

  const handleScrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div className="space-y-6">
      {/* Grila principală de carduri */}
      <div
        className={
          gridClassName ||
          "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5"
        }
      >
        {items.map((item) => (
          <ObjectCard key={item.id} listing={item} />
        ))}
      </div>

      {/* Zona de progres, santinelă Infinite Scroll & stare de final */}
      {items.length > 0 && (
        <div className="pt-2 pb-4 flex flex-col items-center gap-3.5 text-center">
          {/* Indicator discret de progres + bară emerald (`bg-ochre`) */}
          <div className="w-full max-w-xs space-y-1.5">
            <p className="text-xs text-ink-muted">
              Afișate{" "}
              <strong className="text-ink font-semibold">{items.length}</strong>{" "}
              din{" "}
              <strong className="text-ink font-semibold">
                {effectiveTotal}
              </strong>{" "}
              anunțuri
            </p>
            <div
              className="w-full h-1.5 bg-slate-200/90 rounded-full overflow-hidden"
              role="progressbar"
              aria-valuenow={items.length}
              aria-valuemin={0}
              aria-valuemax={effectiveTotal}
              aria-label="Progres încărcare anunțuri"
            >
              <div
                className="h-full bg-ochre rounded-full transition-all duration-300"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>

          {/* Mesaj de eroare cu opțiune rapidă de reîncercare */}
          {error && (
            <div className="flex flex-col sm:flex-row items-center gap-2 text-xs text-red-700 bg-red-50 border border-red-200 rounded-xl px-4 py-2.5">
              <span>{error}</span>
              <button
                type="button"
                onClick={() => void loadMore()}
                className="font-semibold underline hover:text-red-900 cursor-pointer"
              >
                Reîncearcă
              </button>
            </div>
          )}

          {/* Stare de încărcare (spinner discret) */}
          {loading && (
            <div
              className="inline-flex items-center gap-2.5 px-4 py-2 rounded-xl bg-white border border-slate-200/90 shadow-2xs text-xs font-medium text-ink-muted"
              role="status"
              aria-live="polite"
            >
              <span
                aria-hidden="true"
                className="w-4 h-4 rounded-full border-2 border-slate-200 border-t-ochre animate-spin"
              />
              <span>Se încarcă mai multe anunțuri...</span>
            </div>
          )}

          {/* Santinela invizibilă + buton discret fallback când mai sunt anunțuri */}
          {hasMore && !loading && (
            <>
              <div
                ref={sentinelRef}
                aria-hidden="true"
                className="h-1 w-full pointer-events-none"
              />
              <button
                type="button"
                onClick={() => void loadMore()}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white hover:bg-ochre-light text-ink hover:text-ochre border border-slate-200/90 hover:border-ochre/40 text-xs font-semibold shadow-2xs transition-all cursor-pointer"
              >
                <span>Încarcă mai multe anunțuri</span>
              </button>
            </>
          )}

          {/* Mesaj curat de final + buton Înapoi sus */}
          {!hasMore && !loading && (
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-1">
              <p className="text-xs sm:text-sm text-ink-muted font-medium inline-flex items-center gap-1.5">
                <Check
                  className="w-4 h-4 text-ochre shrink-0"
                  strokeWidth={1.8}
                  aria-hidden="true"
                />
                <span>
                  Ai ajuns la final — ai văzut toate cele{" "}
                  <strong className="text-ink">{effectiveTotal}</strong>{" "}
                  anunțuri disponibile
                </span>
              </p>
              <button
                type="button"
                onClick={handleScrollToTop}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-white hover:bg-slate-50 text-ink border border-slate-200/90 text-xs font-semibold shadow-2xs transition-all cursor-pointer"
              >
                <ArrowUp
                  className="w-3.5 h-3.5 shrink-0"
                  strokeWidth={1.8}
                  aria-hidden="true"
                />
                <span>Înapoi sus</span>
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
