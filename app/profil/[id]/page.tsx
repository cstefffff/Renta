import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  BadgeCheck,
  Building2,
  Calendar,
  MapPin,
  MessageSquare,
  Package,
  ShieldCheck,
  Star,
  User,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { ObjectCard } from "@/components/catalog/ObjectCard";
import type {
  ListingImage,
  ListingWithDetails,
  Profile,
} from "@/lib/types/database";

export const dynamic = "force-dynamic";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface PublicProfilePageProps {
  params: Promise<{ id: string }>;
}

/**
 * Pagina Publică de Profil a unui Utilizator (`/profil/[id]`) — Modern Storefront.
 *
 * Explicație pentru C/Java:
 * - Interoghează exclusiv tabelele publice (`public.profiles`, `public.listings`,
 *   `public.reviews`), fără a accesa vreodată `public.profile_private` (100% GDPR-safe).
 * - Afișează vitrina utilizatorului (`Personal` sau `Business`), insignele de
 *   încredere, toate echipamentele sale disponibile și recenziile verificate.
 */
export default async function PublicUserProfilePage({
  params,
}: PublicProfilePageProps) {
  const { id } = await params;
  const cleanId = (id ?? "").trim();

  if (!UUID_REGEX.test(cleanId) || !isSupabaseConfigured()) {
    notFound();
  }

  const supabase = await createClient();
  if (!supabase) {
    notFound();
  }

  // 1. Citim profilul public + utilizatorul curent + listările active + recenziile în paralel
  const [
    { data: profileRow, error: profileErr },
    {
      data: { user: currentUser },
    },
    { data: listingsRows },
    { data: reviewsRows },
  ] = await Promise.all([
    supabase
      .from("profiles")
      .select(
        "id, display_name, account_type, city, bio, avatar_url, phone_verified, kyb_verified, rating_avg, rating_count, created_at, updated_at"
      )
      .eq("id", cleanId)
      .maybeSingle(),
    supabase.auth.getUser(),
    supabase
      .from("listings")
      .select(
        `
        *,
        images:listing_images(id, listing_id, storage_path, url, display_order, created_at)
      `
      )
      .eq("owner_id", cleanId)
      .eq("status", "available")
      .order("created_at", { ascending: false }),
    supabase
      .from("reviews")
      .select(
        `
        id,
        rating,
        comment,
        created_at,
        author:profiles!reviews_author_id_fkey(id, display_name, account_type, city, avatar_url)
      `
      )
      .eq("target_user_id", cleanId)
      .order("created_at", { ascending: false })
      .limit(12),
  ]);

  if (profileErr || !profileRow) {
    notFound();
  }

  const profile = profileRow as Profile;
  const isCompany = profile.account_type === "company";
  const isOwnProfile = currentUser?.id === profile.id;

  const ownerInfo: ListingWithDetails["owner"] = {
    id: profile.id,
    display_name: profile.display_name,
    account_type: profile.account_type,
    city: profile.city,
    bio: profile.bio ?? null,
    avatar_url: profile.avatar_url ?? null,
    phone_verified: Boolean(profile.phone_verified),
    kyb_verified: Boolean(profile.kyb_verified),
    rating_avg: profile.rating_avg ?? null,
    rating_count: profile.rating_count ?? 0,
  };

  const activeListings: ListingWithDetails[] = (listingsRows ?? []).map(
    (row: Record<string, unknown>) => ({
      id: String(row.id),
      catalog_code: String(row.catalog_code ?? ""),
      owner_id: String(row.owner_id),
      title: String(row.title ?? ""),
      description: String(row.description ?? ""),
      category: (row.category as ListingWithDetails["category"]) ?? "altele",
      price_per_day: Number(row.price_per_day ?? 0),
      price_per_hour:
        row.price_per_hour !== null && row.price_per_hour !== undefined
          ? Number(row.price_per_hour)
          : null,
      deposit_ron: Number(row.deposit_ron ?? 0),
      min_rental_days: Number(row.min_rental_days ?? 1),
      cancellation_policy:
        (row.cancellation_policy as ListingWithDetails["cancellation_policy"]) ??
        "moderate",
      rating_avg:
        row.rating_avg !== null && row.rating_avg !== undefined
          ? Number(row.rating_avg)
          : null,
      rating_count: Number(row.rating_count ?? 0),
      city: String(row.city ?? profile.city ?? "București"),
      status: (row.status as ListingWithDetails["status"]) ?? "available",
      created_at: String(row.created_at ?? ""),
      updated_at: String(row.updated_at ?? ""),
      owner: ownerInfo,
      images: Array.isArray(row.images) ? (row.images as ListingImage[]) : [],
    })
  );

  const memberSinceYear = profile.created_at
    ? new Date(profile.created_at).getFullYear()
    : new Date().getFullYear();

  return (
    <div className="max-w-[1400px] mx-auto px-4 sm:px-6 py-6 space-y-6">
      {/* Navigare înapoi */}
      <div className="flex items-center justify-between gap-3">
        <Link
          href="/catalog"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-ink-muted hover:text-ink transition-colors"
        >
          <ArrowLeft className="w-4 h-4 shrink-0" strokeWidth={1.8} aria-hidden="true" />
          <span>Înapoi la catalog</span>
        </Link>

        {isOwnProfile && (
          <Link
            href="/profil"
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-ochre-light text-ochre text-xs font-semibold hover:bg-ochre hover:text-white transition-all"
          >
            <span>Editează profilul meu</span>
          </Link>
        )}
      </div>

      {/* 1. HERO VITRINĂ UTILIZATOR / BUSINESS */}
      <section className="relative overflow-hidden rounded-2xl bg-white border border-slate-200/90 p-5 sm:p-7 shadow-sm">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-20 -right-20 w-72 h-72 rounded-full bg-ochre-light/50 blur-3xl"
        />

        <div className="relative flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="flex flex-col sm:flex-row sm:items-start gap-4 sm:gap-5">
            {/* Avatar / Siglă */}
            <div className="w-20 h-20 rounded-2xl border border-slate-200 bg-ochre-light/70 text-ochre ring-4 ring-slate-100 overflow-hidden flex items-center justify-center shrink-0 font-display text-2xl font-extrabold shadow-xs">
              {profile.avatar_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={profile.avatar_url}
                  alt={profile.display_name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <span>
                  {(profile.display_name || "R").slice(0, 2).toUpperCase()}
                </span>
              )}
            </div>

            <div className="space-y-2.5 max-w-2xl">
              {/* Insigne Segment & Verificări */}
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-ochre-light text-ochre font-semibold">
                  {isCompany ? (
                    <Building2
                      className="w-3.5 h-3.5 shrink-0"
                      strokeWidth={1.8}
                      aria-hidden="true"
                    />
                  ) : (
                    <User
                      className="w-3.5 h-3.5 shrink-0"
                      strokeWidth={1.8}
                      aria-hidden="true"
                    />
                  )}
                  <span>{isCompany ? "Business" : "Personal"}</span>
                </span>

                {profile.phone_verified && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 font-semibold">
                    <BadgeCheck
                      className="w-3.5 h-3.5 shrink-0"
                      strokeWidth={1.8}
                      aria-hidden="true"
                    />
                    <span>Telefon verificat</span>
                  </span>
                )}

                {isCompany && profile.kyb_verified && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 font-semibold">
                    <BadgeCheck
                      className="w-3.5 h-3.5 shrink-0"
                      strokeWidth={1.8}
                      aria-hidden="true"
                    />
                    <span>Business verificat ANAF</span>
                  </span>
                )}
              </div>

              <h1 className="font-display text-2xl sm:text-3xl font-extrabold text-ink tracking-tight">
                {profile.display_name}
              </h1>

              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-muted">
                <span className="inline-flex items-center gap-1.5">
                  <MapPin
                    className="w-3.5 h-3.5 text-ochre shrink-0"
                    strokeWidth={1.8}
                    aria-hidden="true"
                  />
                  <strong className="text-ink font-medium">
                    {profile.city}
                  </strong>
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Calendar
                    className="w-3.5 h-3.5 text-ink-muted shrink-0"
                    strokeWidth={1.8}
                    aria-hidden="true"
                  />
                  <span>Membru din {memberSinceYear}</span>
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <ShieldCheck
                    className="w-3.5 h-3.5 text-ochre shrink-0"
                    strokeWidth={1.8}
                    aria-hidden="true"
                  />
                  <span>Închirieri protejate prin Proces-Verbal &amp; Escrow</span>
                </span>
              </div>

              {profile.bio && (
                <p className="text-xs sm:text-sm text-ink-muted leading-relaxed pt-1">
                  {profile.bio}
                </p>
              )}
            </div>
          </div>

          {/* Sumar Metrici Ofertant */}
          <div className="grid grid-cols-3 gap-3 shrink-0">
            <div className="rounded-xl bg-slate-50 border border-slate-200/80 px-4 py-3 text-center">
              <div className="font-display text-xl font-extrabold text-ink">
                {activeListings.length}
              </div>
              <div className="text-[11px] text-ink-muted mt-0.5">
                Anunțuri active
              </div>
            </div>

            <div className="rounded-xl bg-slate-50 border border-slate-200/80 px-4 py-3 text-center">
              <div className="font-display text-xl font-extrabold text-ink inline-flex items-center justify-center gap-1">
                <Star
                  className="w-4 h-4 fill-amber-400 text-amber-400 shrink-0"
                  strokeWidth={1.8}
                  aria-hidden="true"
                />
                <span>
                  {profile.rating_count && profile.rating_count > 0
                    ? Number(profile.rating_avg ?? 0).toFixed(1)
                    : "Nou"}
                </span>
              </div>
              <div className="text-[11px] text-ink-muted mt-0.5">
                {profile.rating_count ?? 0} recenzii
              </div>
            </div>

            <div className="rounded-xl bg-slate-50 border border-slate-200/80 px-4 py-3 text-center">
              <div className="font-display text-xl font-extrabold text-ochre">
                100%
              </div>
              <div className="text-[11px] text-ink-muted mt-0.5">
                Escrow activ
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 2. GRILA DE ECHIPAMENTE DISPONIBILE ALE UTILIZATORULUI */}
      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Package
              className="w-5 h-5 text-ochre shrink-0"
              strokeWidth={1.8}
              aria-hidden="true"
            />
            <h2 className="font-display text-lg sm:text-xl font-extrabold text-ink">
              Echipamente disponibile de la {profile.display_name} (
              {activeListings.length})
            </h2>
          </div>
        </div>

        {activeListings.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {activeListings.map((listing) => (
              <ObjectCard key={listing.id} listing={listing} />
            ))}
          </div>
        ) : (
          <div className="bg-white border border-slate-200/90 rounded-2xl p-8 text-center space-y-2">
            <p className="text-sm font-semibold text-ink">
              Acest utilizator nu are anunțuri active în acest moment.
            </p>
            <Link
              href="/catalog"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-ochre hover:underline"
            >
              <span>Explorează toate obiectele din catalog &rarr;</span>
            </Link>
          </div>
        )}
      </section>

      {/* 3. RECENZII VERIFICATE PRIMITE DE UTILIZATOR */}
      {Array.isArray(reviewsRows) && reviewsRows.length > 0 && (
        <section className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-sm space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3.5">
            <MessageSquare
              className="w-5 h-5 text-ochre shrink-0"
              strokeWidth={1.8}
              aria-hidden="true"
            />
            <h2 className="font-display text-lg font-bold text-ink">
              Recenzii verificate de la chiriași ({reviewsRows.length})
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {reviewsRows.map((rev: Record<string, unknown>) => {
              const rawAuthor = Array.isArray(rev.author)
                ? rev.author[0]
                : rev.author;
              const authorObj = (rawAuthor ?? {}) as {
                display_name?: string;
                city?: string;
              };
              const rating = Number(rev.rating ?? 5);
              return (
                <div
                  key={String(rev.id)}
                  className="rounded-xl border border-slate-200/80 bg-slate-50/70 p-4 space-y-2"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="font-display text-sm font-bold text-ink">
                      {authorObj.display_name || "Membru RentA"}
                      {authorObj.city && (
                        <span className="text-xs font-normal text-ink-muted ml-1.5">
                          ({authorObj.city})
                        </span>
                      )}
                    </div>
                    <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-50 border border-amber-200 text-xs font-bold text-ink">
                      <Star
                        className="w-3.5 h-3.5 fill-amber-400 text-amber-400 shrink-0"
                        strokeWidth={1.8}
                        aria-hidden="true"
                      />
                      <span>{rating.toFixed(1)}</span>
                    </div>
                  </div>
                  {Boolean(rev.comment) && (
                    <p className="text-xs text-ink-muted leading-relaxed">
                      &ldquo;{String(rev.comment)}&rdquo;
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
