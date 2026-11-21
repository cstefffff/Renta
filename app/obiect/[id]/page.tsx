import Link from "next/link";
import {
  getListingByIdAction,
  getUnavailableDateRangesAction,
} from "@/app/actions/listings";
import { getListingReviewsAction } from "@/app/actions/reviews";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";
import { getCategoryLabel, getCategoryCode } from "@/lib/constants/categories";
import { BookingWidget } from "@/components/bookings/BookingWidget";
import { FavoriteButton } from "@/components/catalog/FavoriteButton";
import { ProductGallery } from "@/components/listings/ProductGallery";

export const dynamic = "force-dynamic";

/**
 * Pagina de Detaliu Obiect (`/obiect/[id]`) — Async Server Component.
 *
 * Explicație pentru C/Java:
 * - Încarcă în paralel prin `Promise.all` recenziile (`getListingReviewsAction`),
 *   intervalele deja ocupate (`getUnavailableDateRangesAction`) și sesiunea curentă.
 * - Respectă cu strictețe separarea GDPR: datele de contact private (telefon, CUI)
 *   nu sunt expuse public în HTML-ul paginii, ci doar prin RPC după confirmarea rezervării.
 */
interface ObjectDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function ObjectDetailPage({
  params,
}: ObjectDetailPageProps) {
  const { id } = await params;
  const decodedId = decodeURIComponent(id);

  const listing = await getListingByIdAction(decodedId);

  if (!listing) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-14">
        <div className="bg-white border border-slate-200/90 rounded-2xl p-8 text-center space-y-4 shadow-sm">
          <div className="inline-block font-mono text-xs px-3 py-1 rounded-full bg-ochre-light text-ochre font-semibold">
            EROARE 404 &bull; PRODUS INEXISTENT ÎN CATALOG
          </div>
          <h1 className="font-display text-2xl font-extrabold text-ink">
            Obiectul căutat nu a fost găsit în registrul RentA
          </h1>
          <p className="text-sm text-ink-muted max-w-md mx-auto">
            ID-ul <code className="font-mono text-xs">{decodedId}</code> nu
            corespunde unei fișe active sau anunțul a fost arhivat de proprietar.
          </p>
          <div className="pt-2 flex items-center justify-center gap-3">
            <Link
              href="/catalog"
              className="bg-ochre hover:bg-ochre-hover text-white font-semibold text-sm px-5 py-2.5 rounded-xl shadow-sm transition-all"
            >
              &larr; Înapoi la Catalogul Public
            </Link>
            <Link
              href="/"
              className="bg-white hover:bg-slate-50 text-ink border border-slate-200 font-semibold text-sm px-5 py-2.5 rounded-xl transition-all"
            >
              Acasă
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Încărcăm în paralel recenziile, intervalele indisponibile și sesiunea utilizatorului curent
  const [reviewsData, unavailableRanges, supabase] = await Promise.all([
    getListingReviewsAction(listing.id),
    getUnavailableDateRangesAction(listing.id),
    isSupabaseConfigured() ? createClient() : Promise.resolve(null),
  ]);

  let currentUserId: string | null = null;
  if (supabase) {
    const { data } = await supabase.auth.getUser();
    currentUserId = data.user?.id ?? null;
  }

  const reviews = reviewsData?.reviews ?? [];
  const averageRating = reviewsData?.averageRating ?? listing.rating_avg ?? null;
  const totalReviewsCount =
    reviewsData?.totalCount ?? listing.rating_count ?? reviews.length;

  const isOwner = Boolean(currentUserId && currentUserId === listing.owner_id);
  const isLoggedIn = Boolean(currentUserId);
  const isAvailable = listing.status === "available";
  const isCompany = listing.owner?.account_type === "company";
  const catalogCode =
    listing.catalog_code || `#OBJ-${listing.id.slice(0, 4).toUpperCase()}`;

  const sortedImages = [...(listing.images || [])].sort(
    (a, b) => (a.display_order ?? 0) - (b.display_order ?? 0)
  );

  return (
    <div className="max-w-[1400px] mx-auto px-4 sm:px-6 py-6 space-y-6">
      {/* Bară superioară Breadcrumb Modern Storefront */}
      <div className="bg-white border border-slate-200/90 rounded-2xl px-4 py-3 shadow-sm flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex flex-wrap items-center gap-2 text-ink-muted">
          <Link
            href="/catalog"
            className="hover:text-ochre font-medium transition-colors"
          >
            Catalog Produse
          </Link>
          <span className="text-slate-300">&rsaquo;</span>
          <Link
            href={`/catalog?category=${listing.category}`}
            className="hover:text-ochre font-medium transition-colors"
          >
            {getCategoryLabel(listing.category)}{" "}
            <span className="font-mono text-[11px] text-ink-muted">
              ({getCategoryCode(listing.category)})
            </span>
          </Link>
          <span className="text-slate-300">&rsaquo;</span>
          <span className="text-ink font-semibold truncate max-w-[260px] sm:max-w-md">
            {listing.title}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <FavoriteButton
            listingId={listing.id}
            listingTitle={listing.title}
            variant="pill"
          />
          <Link
            href="/catalog"
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-slate-100 hover:bg-ochre-light text-ink hover:text-ochre font-semibold transition-all"
          >
            &larr; Înapoi la Catalog
          </Link>
        </div>
      </div>

      {/* Layout în 2 coloane pe desktop: Stânga (Detalii Produs & Galerie) + Dreapta (Calculator Rezervare) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Coloana Stângă (8/12) */}
        <div className="lg:col-span-8 space-y-6">
          {/* Antetul Produsului */}
          <div className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-sm space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="flex flex-wrap items-center gap-2">
                <span className="px-3 py-1 rounded-lg bg-slate-100 text-ink font-mono font-semibold">
                  {catalogCode}
                </span>

                {isCompany ? (
                  <span className="px-3 py-1 rounded-full bg-ochre-light text-ochre font-semibold">
                    🏢 Firmă de Închirieri (B2C)
                  </span>
                ) : (
                  <span className="px-3 py-1 rounded-full bg-slate-100 text-ink font-semibold">
                    🤝 Peer-to-Peer (P2P)
                  </span>
                )}

                {totalReviewsCount > 0 && averageRating !== null && (
                  <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-amber-50 border border-amber-200/80 text-ink font-semibold">
                    <span className="text-amber-400">★</span>
                    <span>{Number(averageRating).toFixed(1)}</span>
                    <span className="text-ink-muted font-normal">
                      ({totalReviewsCount} recenzii)
                    </span>
                  </span>
                )}
              </div>

              <span
                className={`px-3 py-1 rounded-full font-semibold text-xs ${
                  isAvailable
                    ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                    : "bg-slate-100 text-ink-muted border border-slate-200"
                }`}
              >
                {isAvailable ? "● Disponibil acum" : "○ Indisponibil temporar"}
              </span>
            </div>

            <h1 className="font-display text-2xl sm:text-3xl lg:text-4xl font-extrabold text-ink leading-tight">
              {listing.title}
            </h1>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 border-t border-slate-100 text-xs">
              <div className="bg-slate-50 rounded-xl p-3">
                <span className="text-ink-muted block text-[11px]">
                  Locație ridicare
                </span>
                <strong className="text-ink font-semibold mt-0.5 block">
                  📍 {listing.city}
                </strong>
              </div>
              <div className="bg-slate-50 rounded-xl p-3">
                <span className="text-ink-muted block text-[11px]">
                  Categorie
                </span>
                <strong className="text-ink font-semibold mt-0.5 block truncate">
                  {getCategoryLabel(listing.category)}
                </strong>
              </div>
              <div className="bg-slate-50 rounded-xl p-3">
                <span className="text-ink-muted block text-[11px]">
                  Garanție returnabilă
                </span>
                <strong className="text-ink font-semibold mt-0.5 block">
                  {listing.deposit_ron > 0
                    ? `${Number(listing.deposit_ron).toFixed(0)} RON`
                    : "0 RON (Fără garanție)"}
                </strong>
              </div>
              <div className="bg-slate-50 rounded-xl p-3">
                <span className="text-ink-muted block text-[11px]">
                  Durată minimă
                </span>
                <strong className="text-ink font-semibold mt-0.5 block">
                  {listing.min_rental_days || 1} zile
                </strong>
              </div>
            </div>
          </div>

          {/* Galeria Foto Interactivă a Obiectului */}
          <ProductGallery
            images={sortedImages}
            title={listing.title}
            catalogCode={catalogCode}
            categoryLabel={getCategoryLabel(listing.category)}
          />

          {/* Specificații Tehnice & Condiții de Predare */}
          <div className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-sm space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h2 className="font-display text-lg font-bold text-ink">
                Specificații Tehnice &amp; Condiții de Închiriere
              </h2>
              <span className="font-mono text-xs text-ink-muted bg-slate-100 px-2.5 py-1 rounded-lg">
                DETALII PRODUS
              </span>
            </div>

            <div className="text-sm text-ink leading-relaxed whitespace-pre-line font-sans">
              {listing.description}
            </div>
          </div>

          {/* Fișa Proprietarului / Ofertantului (100% GDPR Safe) */}
          <div className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h2 className="font-display text-lg font-bold text-ink">
                Informații Ofertant (Proprietar Verificat)
              </h2>
              <span className="font-mono text-xs text-ink-muted bg-slate-100 px-2.5 py-1 rounded-lg">
                VERIFICAT GDPR
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div className="p-4 rounded-xl border border-slate-200/80 bg-slate-50/70 space-y-2">
                <div className="text-ink-muted font-medium">
                  Denumire ofertant:
                </div>
                <div className="text-base font-bold text-ink font-display">
                  {listing.owner?.display_name || "Membru Catalog RentA"}
                </div>
                <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                  <span className="px-2.5 py-0.5 rounded-full bg-ochre-light text-ochre font-semibold">
                    {isCompany
                      ? "Firmă de Închirieri (B2C)"
                      : "Proprietar Individual (P2P)"}
                  </span>
                  {listing.owner?.kyb_verified && (
                    <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 font-semibold">
                      ✓ KYB Verificat
                    </span>
                  )}
                  {listing.owner?.phone_verified && (
                    <span className="px-2.5 py-0.5 rounded-full bg-white border border-slate-200 text-ink font-medium">
                      ✓ Telefon Verificat
                    </span>
                  )}
                </div>
                {listing.owner?.bio && (
                  <p className="text-xs text-ink-muted font-sans pt-1">
                    {listing.owner.bio}
                  </p>
                )}
              </div>

              <div className="p-4 rounded-xl border border-slate-200/80 bg-slate-50/70 space-y-2">
                <div className="text-ink-muted font-medium">
                  Locație &amp; Protocol de Contact:
                </div>
                <div className="text-ink font-semibold">
                  📍 Oraș: {listing.owner?.city || listing.city}
                </div>
                {listing.owner?.rating_count &&
                listing.owner.rating_count > 0 ? (
                  <div className="inline-flex items-center gap-1 text-ink font-semibold">
                    <span className="text-amber-400">★</span>
                    <span>
                      {Number(listing.owner.rating_avg ?? 0).toFixed(1)} / 5
                    </span>
                    <span className="text-ink-muted font-normal">
                      ({listing.owner.rating_count} evaluări)
                    </span>
                  </div>
                ) : null}
                <div className="text-ink-muted text-[11px] leading-relaxed">
                  Pentru protecția datelor personale (GDPR), numărul de telefon
                  este dezvăluit automat în{" "}
                  <Link
                    href="/rezervarile-mele"
                    className="underline text-ochre font-semibold hover:text-ochre-hover"
                  >
                    Rezervările Mele
                  </Link>{" "}
                  imediat după confirmarea cererii.
                </div>
              </div>
            </div>
          </div>

          {/* Secțiunea #03: Recenzii & Istoric Închirieri (#REV-LOG) */}
          <div className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-sm space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <h2 className="font-display text-lg font-bold text-ink">
                  Recenzii Clienți &amp; Istoric Închirieri
                </h2>
                <span className="px-2.5 py-0.5 rounded-full bg-ochre-light text-ochre font-semibold text-xs">
                  {totalReviewsCount}
                </span>
              </div>
              <span className="font-mono text-xs text-ink-muted">
                #REV-LOG
              </span>
            </div>

            {totalReviewsCount === 0 ? (
              <div className="p-5 rounded-xl border border-dashed border-slate-200 bg-slate-50/60 text-xs text-ink-muted">
                Nicio recenzie înregistrată încă pentru acest obiect. Recenziile
                pot fi adăugate doar după finalizarea unei rezervări verificate
                în pagina{" "}
                <Link
                  href="/rezervarile-mele"
                  className="text-ochre font-semibold underline hover:text-ochre-hover"
                >
                  Rezervările Mele
                </Link>
                .
              </div>
            ) : (
              <div className="space-y-3">
                {reviews.map((rev) => (
                  <div
                    key={rev.id}
                    className="p-4 rounded-xl border border-slate-200/80 bg-slate-50/60 space-y-2"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                      <div className="flex items-center gap-2">
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-white border border-slate-200 font-semibold text-ink">
                          <span className="text-amber-400">
                            {"★".repeat(rev.rating)}
                          </span>
                          <span className="text-slate-300">
                            {"★".repeat(Math.max(0, 5 - rev.rating))}
                          </span>
                          <span className="ml-1 text-[11px]">
                            ({rev.rating}/5)
                          </span>
                        </span>
                        <span className="font-bold text-ink">
                          {rev.author?.display_name || "Membru Verificat"}
                        </span>
                      </div>

                      <span className="text-ink-muted text-[11px] font-mono">
                        {new Date(rev.created_at).toLocaleDateString("ro-RO")}
                      </span>
                    </div>

                    {rev.comment && (
                      <p className="text-xs text-ink font-sans leading-relaxed">
                        {rev.comment}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Coloana Dreaptă (4/12): Calculatorul & Formularul de Rezervare */}
        <div className="lg:col-span-4">
          <BookingWidget
            listingId={listing.id}
            catalogCode={catalogCode}
            pricePerDay={Number(listing.price_per_day)}
            pricePerHour={
              listing.price_per_hour ? Number(listing.price_per_hour) : null
            }
            depositRon={Number(listing.deposit_ron ?? 0)}
            minRentalDays={Number(listing.min_rental_days ?? 1)}
            cancellationPolicy={listing.cancellation_policy ?? "flexible"}
            unavailableRanges={unavailableRanges}
            isOwner={isOwner}
            isLoggedIn={isLoggedIn}
            isAvailable={isAvailable}
          />
        </div>
      </div>
    </div>
  );
}
