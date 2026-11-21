"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { useFavorites } from "@/lib/favorites/useFavorites";
import { getListingsByIdsAction } from "@/app/actions/listings";
import { ObjectCard } from "@/components/catalog/ObjectCard";
import type { ListingWithDetails } from "@/lib/types/database";

/**
 * Pagina `Anunțuri Apreciate & Salvate` (`app/favorite/page.tsx` — Client Component).
 *
 * Explicație pentru dezvoltatori C / Java:
 * - Această pagină se abonează la colecția de ID-uri apreciate prin `useFavorites()`.
 * - Ori de câte ori utilizatorul adaugă sau scoate un anunț din favorite,
 *   încarcă detaliile live ale anunțurilor din baza de date Supabase prin
 *   Server Action-ul `getListingsByIdsAction(favoriteIds)` și le afișează în grilă
 *   folosind componenta standard `<ObjectCard />`.
 * - Dacă utilizatorul apasă din nou pe inimioara roșie a unui card direct din `/favorite`,
 *   anunțul este scos instantaneu din listă (optimistic UI filtering pe `favoriteIds`).
 */
type SegmentFilter = "all" | "individual" | "company";

export default function FavoritesPage() {
  const { favoriteIds, clearFavorites, count, hydrated } = useFavorites();
  const [listings, setListings] = useState<ListingWithDetails[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [segmentFilter, setSegmentFilter] = useState<SegmentFilter>("all");

  // Cheie stabilă bazată pe lista de ID-uri pentru a reîncărca din DB doar când se schimbă colecția
  const favoriteIdsKey = favoriteIds.join(",");

  useEffect(() => {
    if (!hydrated) return;

    if (favoriteIds.length === 0) {
      setListings([]);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    getListingsByIdsAction(favoriteIds)
      .then((items) => {
        if (!cancelled) {
          setListings(Array.isArray(items) ? items : []);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setListings([]);
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, favoriteIdsKey]);

  // Păstrăm doar anunțurile al căror ID se află încă în `favoriteIds` (scoatere în 0ms la click pe inimioară)
  const activeFavoriteListings = useMemo(() => {
    const idSet = new Set(favoriteIds);
    return listings.filter((item) => idSet.has(item.id));
  }, [listings, favoriteIds]);

  const filteredListings = useMemo(() => {
    if (segmentFilter === "all") return activeFavoriteListings;
    return activeFavoriteListings.filter((item) => {
      const accountType = item.owner?.account_type ?? "individual";
      return accountType === segmentFilter;
    });
  }, [activeFavoriteListings, segmentFilter]);

  const p2pCount = useMemo(
    () =>
      activeFavoriteListings.filter(
        (item) => (item.owner?.account_type ?? "individual") === "individual"
      ).length,
    [activeFavoriteListings]
  );

  const companyCount = useMemo(
    () =>
      activeFavoriteListings.filter(
        (item) => item.owner?.account_type === "company"
      ).length,
    [activeFavoriteListings]
  );

  return (
    <div className="max-w-[1400px] mx-auto px-4 sm:px-6 py-8 space-y-6">
      {/* 1. Antetul Paginii de Favorite */}
      <section className="bg-white border border-slate-200/90 rounded-2xl p-6 sm:p-8 shadow-sm space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-rose-50 border border-rose-200/80 text-rose-600 font-mono text-xs font-semibold">
              <span aria-hidden="true">♥</span>
              <span>COLECȚIA TA // FAVORITE</span>
            </div>

            <h1 className="font-display text-2xl sm:text-3xl font-extrabold text-ink tracking-tight">
              Anunțuri Apreciate &amp; Salvate
            </h1>

            <p className="text-sm text-ink-muted max-w-2xl">
              Toate echipamentele și uneltele pe care le-ai salvat cu inimioară
              din catalogul RentA. Compară rapid prețurile pe zi, garanțiile și
              disponibilitatea înainte de a trimite cererea de rezervare.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <div className="px-3.5 py-2 rounded-xl bg-slate-100 text-xs font-semibold text-ink">
              Obiecte salvate:{" "}
              <span className="font-mono font-bold text-rose-600">
                {hydrated ? count : 0}
              </span>
            </div>

            {hydrated && count > 0 && (
              <button
                type="button"
                onClick={clearFavorites}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-rose-200 bg-white hover:bg-rose-50 text-xs font-semibold text-rose-600 transition-colors cursor-pointer"
              >
                <span aria-hidden="true">✕</span>
                <span>Golire listă</span>
              </button>
            )}

            <Link
              href="/catalog"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-ochre hover:bg-ochre-hover text-white text-xs font-semibold shadow-xs transition-colors"
            >
              <span>+ Explorează Catalogul</span>
            </Link>
          </div>
        </div>

        {/* Bara de filtrare rapidă pe segmente (Toate / P2P / Firme) */}
        {hydrated && count > 0 && (
          <div className="pt-4 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setSegmentFilter("all")}
                className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-colors cursor-pointer ${
                  segmentFilter === "all"
                    ? "bg-ochre text-white shadow-2xs"
                    : "bg-slate-100 hover:bg-slate-200/80 text-ink"
                }`}
              >
                Toate ({activeFavoriteListings.length})
              </button>

              <button
                type="button"
                onClick={() => setSegmentFilter("individual")}
                className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-colors cursor-pointer ${
                  segmentFilter === "individual"
                    ? "bg-ochre text-white shadow-2xs"
                    : "bg-slate-100 hover:bg-slate-200/80 text-ink"
                }`}
              >
                🤝 Peer-to-Peer (P2P) ({p2pCount})
              </button>

              <button
                type="button"
                onClick={() => setSegmentFilter("company")}
                className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-colors cursor-pointer ${
                  segmentFilter === "company"
                    ? "bg-ochre text-white shadow-2xs"
                    : "bg-slate-100 hover:bg-slate-200/80 text-ink"
                }`}
              >
                🏢 Firme de Închirieri ({companyCount})
              </button>
            </div>

            <span className="text-xs text-ink-muted">
              Apasă pe inimioara roșie a unui card pentru a-l elimina din
              colecție.
            </span>
          </div>
        )}
      </section>

      {/* 2. Starea de încărcare / Grila de Carduri / Empty State */}
      {!hydrated || (loading && count > 0 && activeFavoriteListings.length === 0) ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {[1, 2, 3, 4].map((skeleton) => (
            <div
              key={skeleton}
              className="bg-white border border-slate-200/80 rounded-2xl p-4 h-96 animate-pulse flex flex-col justify-between"
            >
              <div className="space-y-3">
                <div className="aspect-[4/3] w-full rounded-xl bg-slate-100" />
                <div className="h-4 bg-slate-100 rounded w-3/4" />
                <div className="h-3 bg-slate-100 rounded w-1/2" />
              </div>
              <div className="h-9 bg-slate-100 rounded-lg w-full" />
            </div>
          ))}
        </div>
      ) : count === 0 || activeFavoriteListings.length === 0 ? (
        <section className="bg-white border border-slate-200/90 rounded-2xl p-10 sm:p-14 text-center shadow-sm max-w-2xl mx-auto space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-rose-50 border border-rose-200/70 text-rose-500 mx-auto flex items-center justify-center">
            <svg
              className="w-7 h-7"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.8}
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z"
              />
            </svg>
          </div>

          <h2 className="font-display text-xl sm:text-2xl font-bold text-ink">
            Nu ai salvat încă niciun anunț la favorite
          </h2>

          <p className="text-sm text-ink-muted max-w-md mx-auto leading-relaxed">
            Când navighezi prin catalog sau pe pagina unui produs, apasă pe
            butonul cu inimioară <span className="text-rose-500 font-bold">♥</span>{" "}
            pentru a salva anunțurile preferate aici și a le regăsi oricând.
          </p>

          <div className="pt-2 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/catalog"
              className="inline-flex items-center gap-2 bg-ochre hover:bg-ochre-hover text-white text-xs font-semibold px-5 py-2.5 rounded-xl shadow-sm transition-colors"
            >
              <span>Explorează Catalogul RentA</span>
              <span aria-hidden="true">&rarr;</span>
            </Link>
            <Link
              href="/catalog?segment=company"
              className="inline-flex items-center gap-2 bg-slate-100 hover:bg-slate-200/80 text-ink text-xs font-semibold px-4 py-2.5 rounded-xl transition-colors"
            >
              <span>🏢 Vezi Firme de Închirieri</span>
            </Link>
          </div>
        </section>
      ) : filteredListings.length === 0 ? (
        <section className="bg-white border border-slate-200/90 rounded-2xl p-8 text-center shadow-sm space-y-3">
          <p className="text-sm font-semibold text-ink">
            Niciun anunț favorit nu corespunde filtrului de segment selectat.
          </p>
          <button
            type="button"
            onClick={() => setSegmentFilter("all")}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-ochre text-white text-xs font-semibold cursor-pointer"
          >
            Afișează toate favoritele ({activeFavoriteListings.length})
          </button>
        </section>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {filteredListings.map((item) => (
            <ObjectCard key={item.id} listing={item} />
          ))}
        </div>
      )}
    </div>
  );
}
