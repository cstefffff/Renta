import Link from "next/link";
import Image from "next/image";
import {
  BadgeCheck,
  Building2,
  Camera,
  Image as ImageIcon,
  MapPin,
  Star,
} from "lucide-react";
import { getCategoryLabel } from "@/lib/constants/categories";
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

/**
 * Redimensionează automat imaginile Unsplash la `w=600&q=75` pentru thumbnail-urile
 * din grila de catalog (~70% mai puțini KB descărcați la scroll, păstrând rezoluția
 * completă `w=1200` pe pagina de detaliu `/obiect/[id]`).
 */
function toCardThumbnailUrl(url: string): string {
  if (!url.includes("images.unsplash.com")) {
    return url;
  }
  return url.replace("w=1200", "w=600").replace("q=80", "q=75");
}

export function ObjectCard({ listing }: { listing: ListingWithDetails }) {
  const isCompany = listing.owner?.account_type === "company";
  const catalogCode =
    listing.catalog_code || `#OBJ-${listing.id.slice(0, 4).toUpperCase()}`;

  const sortedImages = [...(listing.images || [])].sort(
    (a, b) => (a.display_order ?? 0) - (b.display_order ?? 0)
  );
  const rawCoverImage = sortedImages[0]?.url || null;
  const coverImage = rawCoverImage ? toCardThumbnailUrl(rawCoverImage) : null;
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
                unoptimized={coverImage.includes("unsplash.com")}
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
              <ImageIcon
                className="w-10 h-10 text-slate-300 mb-2"
                strokeWidth={1.8}
                aria-hidden="true"
              />
              <span className="font-mono text-[11px] font-medium text-slate-500">
                {catalogCode}
              </span>
              <span className="text-[10px] text-slate-400 mt-0.5">
                {getCategoryLabel(listing.category)}
              </span>
            </div>
          )}

          {/* Colțul stânga-sus: Badge discret DOAR pentru firme (pentru P2P lăsăm fotografia curată) */}
          {isCompany && (
            <span
              className={`absolute top-2.5 left-2.5 backdrop-blur-sm text-[11px] font-semibold px-2.5 py-1 rounded-full shadow-sm inline-flex items-center gap-1 ${
                listing.owner?.kyb_verified
                  ? "bg-white/95 text-ochre ring-1 ring-ochre/20"
                  : "bg-white/95 text-ink"
              }`}
            >
              <Building2
                className="w-3 h-3 shrink-0"
                strokeWidth={1.8}
                aria-hidden="true"
              />
              <span>
                {listing.owner?.kyb_verified
                  ? "Business verificat"
                  : "Business"}
              </span>
              {listing.owner?.kyb_verified && (
                <BadgeCheck
                  className="w-3.5 h-3.5 shrink-0"
                  strokeWidth={1.8}
                  aria-hidden="true"
                />
              )}
            </span>
          )}

          {/* Colțul dreapta-jos: Indicator număr fotografii dacă anunțul are galerie (> 1 poză) */}
          {sortedImages.length > 1 && (
            <span className="absolute bottom-2.5 right-2.5 bg-slate-900/75 backdrop-blur-sm text-white text-[10px] font-medium px-2 py-0.5 rounded-md inline-flex items-center gap-1">
              <Camera
                className="w-3 h-3 shrink-0"
                strokeWidth={1.8}
                aria-hidden="true"
              />
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

        {/* 3. Rândul de Rating Onest (Scor real când există recenzii, altfel etichetă „Nou” + Categorie) */}
        <div className="flex items-center gap-1.5 min-h-[20px]">
          {hasRating ? (
            <>
              <Star
                className="w-3.5 h-3.5 fill-amber-400 text-amber-400 shrink-0"
                strokeWidth={1.8}
                aria-hidden="true"
              />
              <span className="text-[11px] font-semibold text-ink">
                {Number(listing.rating_avg).toFixed(1)}{" "}
                <span className="text-ink-muted font-normal">
                  ({listing.rating_count}{" "}
                  {listing.rating_count === 1 ? "recenzie" : "recenzii"})
                </span>
              </span>
            </>
          ) : (
            <>
              <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-ochre-light/70 text-ochre text-[10px] font-semibold">
                Nou
              </span>
              <span className="text-[11px] text-ink-muted truncate">
                {getCategoryLabel(listing.category)}
              </span>
            </>
          )}
        </div>

        {/* 4. Rândul de Locație + Proprietar */}
        <div className="text-xs text-ink-muted flex items-center gap-1.5 mt-1 mb-3">
          <MapPin
            className="w-3.5 h-3.5 text-ochre shrink-0"
            strokeWidth={1.8}
            aria-hidden="true"
          />
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

      {/* 6. Footer Card — Buton rafinat care se aprinde în verde-smarald la hover pe card */}
      <footer className="pt-3">
        <Link
          href={`/obiect/${listing.id}`}
          className="w-full inline-flex items-center justify-center gap-2 bg-ochre-light/70 text-ochre border border-ochre/20 group-hover:bg-ochre group-hover:text-white group-hover:border-ochre text-xs font-semibold py-2.5 px-4 rounded-xl transition-all"
        >
          <span>Vezi detalii &amp; rezervă</span>
        </Link>
      </footer>
    </article>
  );
}
