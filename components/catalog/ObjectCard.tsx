import Link from "next/link";
import Image from "next/image";
import { getCategoryLabel, getCategoryCode } from "@/lib/constants/categories";
import { FavoriteButton } from "@/components/catalog/FavoriteButton";
import type { ListingWithDetails } from "@/lib/types/database";

/**
 * Componenta `ObjectCard` — Card Modern de Produs în Catalog (`components/catalog/ObjectCard.tsx`).
 *
 * Analogie pentru C/Java:
 * - Gândește-te la `ObjectCard` ca la o metodă de randare (`renderCard(ListingWithDetails listing)`)
 *   care primește un DTO imutabil (`props.listing`) și returnează un arbore DOM semantic (`<article>`).
 * - Respectă ghidul Modern Web Guidance:
 *   1. Rădăcină semantică `<article>` cu ordinea naturală: Media -> Titlu -> Rating & Meta -> Preț -> Footer CTA.
 *   2. Container imagine cu `aspect-[4/3]` și `object-cover` pentru a preveni Cumulative Layout Shift (CLS).
 */
function isOptimizableHost(url: string): boolean {
  try {
    const parsed = new URL(url);
    return (
      parsed.hostname.endsWith(".supabase.co") ||
      parsed.hostname === "images.unsplash.com" ||
      parsed.hostname === "plus.unsplash.com"
    );
  } catch {
    return false;
  }
}

export function ObjectCard({ listing }: { listing: ListingWithDetails }) {
  const isCompany = listing.owner?.account_type === "company";
  const catalogCode =
    listing.catalog_code || `#OBJ-${listing.id.slice(0, 4).toUpperCase()}`;

  const sortedImages = [...(listing.images || [])].sort(
    (a, b) => (a.display_order ?? 0) - (b.display_order ?? 0)
  );
  const coverImage = sortedImages[0]?.url || null;
  const ownerName =
    listing.owner?.display_name ||
    (isCompany ? "Firmă Parteneră" : "Proprietar P2P");

  const hasRating =
    typeof listing.rating_count === "number" &&
    listing.rating_count > 0 &&
    listing.rating_avg !== null;

  return (
    <article className="bg-white border border-slate-200/90 rounded-2xl p-3.5 flex flex-col justify-between shadow-sm hover:shadow-md hover:border-slate-300 transition-all duration-200 group">
      <div>
        {/* 1. Zona de Imagine (Sus) cu raport de aspect 4:3 */}
        <Link
          href={`/obiect/${listing.id}`}
          className="block relative aspect-[4/3] w-full rounded-xl bg-slate-100 overflow-hidden mb-3.5"
        >
          {coverImage ? (
            isOptimizableHost(coverImage) ? (
              <Image
                src={coverImage}
                alt={listing.title}
                fill
                sizes="(max-width: 640px) 100vw, (max-width: 1280px) 50vw, 33vw"
                className="object-cover group-hover:scale-105 transition-transform duration-300"
              />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={coverImage}
                alt={listing.title}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              />
            )
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center p-4 text-center text-ink-muted bg-slate-100">
              <svg
                className="w-10 h-10 text-slate-300 mb-2"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.5}
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z"
                />
              </svg>
              <span className="font-mono text-[11px] font-medium text-slate-500">
                {catalogCode}
              </span>
              <span className="text-[10px] text-slate-400 mt-0.5">
                {getCategoryLabel(listing.category)}
              </span>
            </div>
          )}

          {/* Colțul stânga-sus: Pill discret cu segmentul (Firmă Verificată / Firmă B2C / P2P) + codul de catalog */}
          <span
            className={`absolute top-2.5 left-2.5 backdrop-blur-sm text-[11px] font-medium px-2.5 py-1 rounded-full shadow-sm inline-flex items-center gap-1.5 ${
              isCompany && listing.owner?.kyb_verified
                ? "bg-emerald-50/95 text-emerald-900 ring-1 ring-emerald-200/80"
                : "bg-white/90 text-ink"
            }`}
          >
            <span
              className={
                isCompany && listing.owner?.kyb_verified
                  ? "font-semibold text-emerald-800"
                  : ""
              }
            >
              {isCompany
                ? listing.owner?.kyb_verified
                  ? "🏢 Firmă Verificată ✓"
                  : "🏢 Firmă B2C"
                : "🤝 P2P"}
            </span>
            <span className="text-slate-300">&bull;</span>
            <span className="font-mono text-[10px] text-ink-muted">
              {catalogCode}
            </span>
          </span>

          {/* Colțul stânga-jos: Etichetă categorie discretă */}
          <span className="absolute bottom-2.5 left-2.5 bg-slate-900/75 backdrop-blur-sm text-white text-[10px] font-medium px-2.5 py-0.5 rounded-md">
            {getCategoryCode(listing.category)} &bull;{" "}
            {getCategoryLabel(listing.category)}
          </span>

          {/* Colțul dreapta-jos: Indicator număr fotografii dacă anunțul are galerie (> 1 poză) */}
          {sortedImages.length > 1 && (
            <span className="absolute bottom-2.5 right-2.5 bg-slate-900/75 backdrop-blur-sm text-white text-[10px] font-medium px-2 py-0.5 rounded-md inline-flex items-center gap-1">
              <svg
                className="w-3 h-3 shrink-0"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                <circle cx="12" cy="13" r="4" />
              </svg>
              <span>{sortedImages.length}</span>
            </span>
          )}
        </Link>

        {/* 2. Titlu + Inimioară Favorite */}
        <div className="flex items-start justify-between gap-2 mb-1.5">
          <Link href={`/obiect/${listing.id}`} className="min-w-0 flex-1">
            <h3
              className="font-display text-base font-bold text-ink group-hover:text-ochre transition-colors line-clamp-1"
              title={listing.title}
            >
              {listing.title}
            </h3>
          </Link>

          <FavoriteButton
            listingId={listing.id}
            listingTitle={listing.title}
            variant="icon"
          />
        </div>

        {/* 3. Rândul de Rating (Stele Galbene + Recenzii) */}
        <div className="flex items-center gap-1.5">
          <span className="text-amber-400 text-xs tracking-tight" aria-hidden="true">
            ★★★★★
          </span>
          {hasRating ? (
            <span className="text-[11px] font-medium text-ink">
              {Number(listing.rating_avg).toFixed(1)}{" "}
              <span className="text-ink-muted font-normal">
                ({listing.rating_count} recenzii)
              </span>
            </span>
          ) : (
            <span className="text-[11px] text-ink-muted truncate">
              Verificat &middot; {getCategoryLabel(listing.category)}
            </span>
          )}
        </div>

        {/* 4. Rândul de Locație + Proprietar */}
        <div className="text-xs text-ink-muted flex items-center gap-1.5 mt-1 mb-3">
          <svg
            className="w-3.5 h-3.5 text-ochre shrink-0"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z"
            />
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z"
            />
          </svg>
          <span className="font-medium text-ink">{listing.city}</span>
          <span className="text-slate-300">&bull;</span>
          <span className="truncate" title={ownerName}>
            {ownerName}
          </span>
        </div>

        {/* 5. Rândul de Preț */}
        <div className="pt-1 border-t border-slate-100">
          <div className="text-lg font-extrabold text-ink leading-tight">
            {Number(listing.price_per_day).toFixed(0)} RON
            <span className="text-xs font-normal text-ink-muted"> / zi</span>
          </div>
          <div className="text-[11px] text-ink-muted mt-0.5 flex flex-wrap items-center gap-2">
            {listing.price_per_hour ? (
              <span className="text-ochre font-semibold">
                {Number(listing.price_per_hour).toFixed(0)} RON / oră
              </span>
            ) : null}
            {listing.deposit_ron && Number(listing.deposit_ron) > 0 ? (
              <span>
                Garanție: {Number(listing.deposit_ron).toFixed(0)} RON
              </span>
            ) : (
              <span>Disponibil imediat</span>
            )}
          </div>
        </div>
      </div>

      {/* 6. Footer Card — Butonul Verde-Teal pe toată lățimea */}
      <footer className="pt-3">
        <Link
          href={`/obiect/${listing.id}`}
          className="w-full inline-flex items-center justify-center gap-2 bg-ochre hover:bg-ochre-hover text-white text-xs font-semibold py-2.5 px-4 rounded-lg transition-colors shadow-sm"
        >
          <svg
            className="w-4 h-4 shrink-0"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M15.75 10.5V6a3.75 3.75 0 10-7.5 0v4.5m11.356-1.993l1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 01-1.12-1.243l1.264-12A1.125 1.125 0 015.513 7.5h12.974c.576 0 1.059.435 1.119 1.007zM8.625 10.5a.375.375 0 11-.75 0 .375.375 0 01.75 0zm7.5 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z"
            />
          </svg>
          <span>Închiriază acum</span>
        </Link>
      </footer>
    </article>
  );
}
