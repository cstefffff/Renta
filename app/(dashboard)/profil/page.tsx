import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ArrowRight,
  BadgeCheck,
  Building2,
  CalendarDays,
  CheckCircle2,
  CreditCard,
  LogOut,
  Mail,
  MapPin,
  Package,
  Plus,
  ShieldCheck,
  Star,
  User,
} from "lucide-react";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { getMyFullProfile, signOutAction } from "@/app/actions/auth";
import { getMyListingsAction } from "@/app/actions/listings";
import {
  ProfileForm,
  type ProfileData,
} from "@/components/profile/ProfileForm";
import { TrustVerificationCard } from "@/components/profile/TrustVerificationCard";
import { GdprPrivacyPanel } from "@/components/profile/GdprPrivacyPanel";
import { getCategoryLabel } from "@/lib/constants/categories";

export const dynamic = "force-dynamic";

/**
 * Pagina de Profil (`/profil`) — Async Server Component cu Estetică Modern Storefront.
 *
 * Explicație pentru C/Java:
 * Folosește `Promise.all([getMyFullProfile(), getMyListingsAction()])` pentru a
 * interoga în paralel atât profilul complet (public + privat), cât și inventarul
 * utilizatorului, randând un dashboard structurat pe 2 coloane și 4 carduri KPI.
 */
export default async function ProfilPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  if (searchParams) {
    const resolvedParams = await searchParams;
    const rawViewAs = resolvedParams.viewAs;
    const viewAs = Array.isArray(rawViewAs) ? rawViewAs[0] : rawViewAs;
    if (viewAs && viewAs.trim()) {
      redirect(`/admin/utilizatori/${encodeURIComponent(viewAs.trim())}`);
    }
  }

  if (!isSupabaseConfigured()) {
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12">
        <div className="bg-white border border-slate-200/90 rounded-2xl p-6 sm:p-8 shadow-sm space-y-4">
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-ochre-light text-ochre text-xs font-semibold">
            Configurare necesară
          </span>
          <h1 className="font-display text-2xl font-bold text-ink">
            Conexiunea la baza de date nu este activă
          </h1>
          <p className="text-sm text-ink-muted">
            Pentru a vizualiza și edita profilul tău, configurează variabilele
            Supabase în <code className="font-mono">.env.local</code>.
          </p>
          <Link href="/status-db" className="catalog-btn-primary">
            Mergi la Status Bază de Date &rarr;
          </Link>
        </div>
      </div>
    );
  }

  const [fullProfile, myListings] = await Promise.all([
    getMyFullProfile(),
    getMyListingsAction(),
  ]);

  if (!fullProfile) {
    return (
      <div className="max-w-xl mx-auto px-4 sm:px-6 py-14">
        <div className="bg-white border border-slate-200/90 rounded-2xl p-6 sm:p-8 shadow-sm space-y-4 text-center">
          <div className="w-12 h-12 rounded-2xl bg-ochre-light text-ochre flex items-center justify-center mx-auto">
            <User className="w-6 h-6" strokeWidth={1.8} aria-hidden="true" />
          </div>
          <h1 className="font-display text-2xl font-bold text-ink">
            Autentifică-te pentru a-ți vedea profilul
          </h1>
          <p className="text-sm text-ink-muted">
            Accesează contul tău RentA pentru a-ți gestiona datele de profil,
            verificările de încredere, plățile și anunțurile.
          </p>
          <div className="flex items-center justify-center gap-3 pt-2">
            <Link href="/login" className="catalog-btn-primary">
              Autentificare
            </Link>
            <Link href="/inregistrare" className="catalog-btn-secondary">
              Creează cont nou
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const { profile, privateData, email } = fullProfile;

  const profileData: ProfileData = {
    id: profile.id,
    email,
    full_name: profile.display_name,
    account_type: profile.account_type,
    company_cui: profile.company_cui ?? privateData?.company_cui ?? null,
    city: profile.city || "București",
    phone: profile.phone ?? privateData?.phone ?? null,
    bio: profile.bio ?? null,
    avatar_url: profile.avatar_url ?? null,
    phone_verified: profile.phone_verified,
    kyb_verified: profile.kyb_verified,
    rating_avg: profile.rating_avg,
    rating_count: profile.rating_count,
  };

  const isCompany = profileData.account_type === "company";
  const isAdmin = privateData?.role === "admin";
  const activeListingsCount = myListings.filter(
    (item) => item.status === "available"
  ).length;
  const recentListings = myListings.slice(0, 3);

  // Calcul nivel de încredere (0%, 50%, 100%)
  const totalTrustSteps = isCompany ? 2 : 1;
  const completedTrustSteps =
    (profileData.phone_verified ? 1 : 0) +
    (isCompany && profileData.kyb_verified ? 1 : 0);
  const trustPercent = Math.round(
    (completedTrustSteps / totalTrustSteps) * 100
  );

  return (
    <div className="max-w-[1400px] mx-auto px-4 sm:px-6 py-6 space-y-6">
      {/* 1. HERO CARD PROFIL — Estetica Modern Storefront */}
      <section className="relative overflow-hidden rounded-2xl bg-white border border-slate-200/90 p-5 sm:p-7 shadow-sm">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-20 -right-20 w-72 h-72 rounded-full bg-ochre-light/50 blur-3xl"
        />

        <div className="relative flex flex-col lg:flex-row lg:items-center justify-between gap-5">
          {/* Stânga: Avatar rotunjit + Identitate + Insigne */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-5">
            <div className="relative w-20 h-20 rounded-2xl border border-slate-200 bg-ochre-light/70 text-ochre ring-4 ring-slate-100 overflow-hidden flex items-center justify-center shrink-0 font-display text-2xl font-extrabold shadow-xs">
              {profileData.avatar_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={profileData.avatar_url}
                  alt={profileData.full_name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <span>
                  {(profileData.full_name || "R").slice(0, 2).toUpperCase()}
                </span>
              )}
            </div>

            <div className="space-y-2">
              {/* Rândul de insigne (Pills) */}
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
                  <span>{isCompany ? "Cont Business" : "Cont Personal"}</span>
                </span>

                {profileData.phone_verified && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 font-semibold">
                    <BadgeCheck
                      className="w-3.5 h-3.5 shrink-0"
                      strokeWidth={1.8}
                      aria-hidden="true"
                    />
                    <span>Telefon verificat</span>
                  </span>
                )}

                {isCompany && profileData.kyb_verified && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 font-semibold">
                    <BadgeCheck
                      className="w-3.5 h-3.5 shrink-0"
                      strokeWidth={1.8}
                      aria-hidden="true"
                    />
                    <span>Business verificat ANAF</span>
                  </span>
                )}

                {isAdmin && (
                  <Link
                    href="/admin"
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-slate-900 text-white font-semibold hover:bg-slate-800 transition-colors"
                  >
                    <ShieldCheck
                      className="w-3.5 h-3.5 shrink-0"
                      strokeWidth={1.8}
                      aria-hidden="true"
                    />
                    <span>Super-Admin</span>
                  </Link>
                )}
              </div>

              {/* Numele utilizatorului / firmei */}
              <h1 className="font-display text-2xl sm:text-3xl font-extrabold text-ink tracking-tight">
                {profileData.full_name}
              </h1>

              {/* Meta informații: Email, Oraș, Bio scurt */}
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-muted">
                <span className="inline-flex items-center gap-1.5">
                  <MapPin
                    className="w-3.5 h-3.5 text-ochre shrink-0"
                    strokeWidth={1.8}
                    aria-hidden="true"
                  />
                  <strong className="text-ink font-medium">
                    {profileData.city}
                  </strong>
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Mail
                    className="w-3.5 h-3.5 text-ink-muted shrink-0"
                    strokeWidth={1.8}
                    aria-hidden="true"
                  />
                  <span>{profileData.email}</span>
                </span>
                {isCompany && profileData.company_cui && (
                  <span className="font-mono text-[11px] bg-slate-100 text-ink px-2 py-0.5 rounded-md">
                    CUI: {profileData.company_cui}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Dreapta: Acțiuni Rapide */}
          <div className="flex flex-wrap items-center gap-2.5">
            <Link
              href="/listarile-mele"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200/80 text-ink text-xs font-semibold transition-all"
            >
              <Package
                className="w-4 h-4 text-ochre shrink-0"
                strokeWidth={1.8}
                aria-hidden="true"
              />
              <span>Inventarul meu ({myListings.length})</span>
            </Link>

            <Link
              href="/rezervarile-mele"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200/80 text-ink text-xs font-semibold transition-all"
            >
              <CalendarDays
                className="w-4 h-4 text-ochre shrink-0"
                strokeWidth={1.8}
                aria-hidden="true"
              />
              <span>Rezervări</span>
            </Link>

            <Link
              href="/listarile-mele/nou"
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-ochre hover:bg-ochre/90 text-white text-xs font-semibold shadow-xs transition-all"
            >
              <Plus className="w-4 h-4 shrink-0" strokeWidth={2} aria-hidden="true" />
              <span>Listează obiect</span>
            </Link>

            <form action={signOutAction}>
              <button
                type="submit"
                className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-white hover:bg-rose-50 text-ink-muted hover:text-rose-700 border border-slate-200/90 hover:border-rose-200 text-xs font-semibold transition-all cursor-pointer"
                title="Deconectare din cont"
              >
                <LogOut className="w-4 h-4 shrink-0" strokeWidth={1.8} aria-hidden="true" />
                <span>Delogare</span>
              </button>
            </form>
          </div>
        </div>
      </section>

      {/* 2. BANDA DE SUMAR (4 CARDURI KPI — În stilul Homepage-ului) */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        {/* KPI 1: Inventar Activ */}
        <Link
          href="/listarile-mele"
          className="bg-white border border-slate-200/90 hover:border-ochre/40 rounded-2xl p-4 shadow-2xs flex items-center justify-between gap-3 group transition-all"
        >
          <div className="space-y-1">
            <span className="text-xs text-ink-muted font-medium">
              Obiecte în catalog
            </span>
            <div className="font-display text-2xl font-extrabold text-ink group-hover:text-ochre transition-colors">
              {activeListingsCount}{" "}
              <span className="text-xs font-normal text-ink-muted">
                active din {myListings.length}
              </span>
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-ochre-light text-ochre flex items-center justify-center shrink-0">
            <Package className="w-5 h-5" strokeWidth={1.8} aria-hidden="true" />
          </div>
        </Link>

        {/* KPI 2: Nivel de Încredere */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-2xs flex flex-col justify-between gap-2">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs text-ink-muted font-medium">
              Nivel de încredere
            </span>
            <span className="text-xs font-bold text-ochre">
              {trustPercent}% verificat
            </span>
          </div>
          <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-ochre rounded-full transition-all duration-300"
              style={{ width: `${Math.max(12, trustPercent)}%` }}
            />
          </div>
          <span className="text-[11px] text-ink-muted">
            {trustPercent === 100
              ? "Toate verificările sunt complete"
              : "Completează verificările din dreapta"}
          </span>
        </div>

        {/* KPI 3: Reputație & Recenzii */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-2xs flex items-center justify-between gap-3">
          <div className="space-y-1">
            <span className="text-xs text-ink-muted font-medium">
              Reputație &amp; Rating
            </span>
            {profileData.rating_count && profileData.rating_count > 0 ? (
              <div className="font-display text-2xl font-extrabold text-ink flex items-center gap-1.5">
                <span>{Number(profileData.rating_avg ?? 0).toFixed(1)}</span>
                <span className="text-xs font-normal text-ink-muted">
                  ({profileData.rating_count}{" "}
                  {profileData.rating_count === 1 ? "recenzie" : "recenzii"})
                </span>
              </div>
            ) : (
              <div className="font-display text-base font-bold text-ink">
                Membru nou
                <span className="block text-[11px] font-normal text-ink-muted">
                  Fără recenzii momentan
                </span>
              </div>
            )}
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-500 flex items-center justify-center shrink-0">
            <Star
              className="w-5 h-5 fill-amber-400 text-amber-400"
              strokeWidth={1.8}
              aria-hidden="true"
            />
          </div>
        </div>

        {/* KPI 4: Plăți & Escrow */}
        <Link
          href="/profil/plati"
          className="bg-white border border-slate-200/90 hover:border-ochre/40 rounded-2xl p-4 shadow-2xs flex items-center justify-between gap-3 group transition-all"
        >
          <div className="space-y-1">
            <span className="text-xs text-ink-muted font-medium">
              Plăți &amp; Facturi
            </span>
            <div className="font-display text-base font-bold text-ink group-hover:text-ochre transition-colors flex items-center gap-1">
              <span>Încasări 90% &amp; Escrow</span>
              <ArrowRight
                className="w-4 h-4 shrink-0"
                strokeWidth={1.8}
                aria-hidden="true"
              />
            </div>
            <span className="block text-[11px] text-ink-muted">
              Stripe Connect &amp; RO e-Factura
            </span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-ochre-light text-ochre flex items-center justify-center shrink-0">
            <CreditCard
              className="w-5 h-5"
              strokeWidth={1.8}
              aria-hidden="true"
            />
          </div>
        </Link>
      </section>

      {/* 3. LAYOUT PRINCIPAL PE 2 COLOANE (Stânga 7 col: Formular & Inventar | Dreapta 5 col: Plăți, Verificare & GDPR) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* COLOANA STÂNGA (7 / 12) — Editare Profil & Previzualizare Inventar */}
        <div className="lg:col-span-7 space-y-6">
          <section className="bg-white border border-slate-200/90 rounded-2xl p-6 sm:p-7 shadow-sm space-y-6">
            <div className="border-b border-slate-100 pb-4 flex flex-wrap items-center justify-between gap-2">
              <div>
                <span className="inline-flex items-center rounded-full bg-ochre-light px-2.5 py-0.5 text-[11px] font-semibold text-ochre">
                  Setări Cont
                </span>
                <h2 className="font-display text-lg sm:text-xl font-bold text-ink mt-1">
                  Datele Profilului &amp; Contact
                </h2>
              </div>
              <span className="text-xs text-ink-muted">
                Actualizare instantă în catalog
              </span>
            </div>

            <ProfileForm profile={profileData} />
          </section>

          {/* Previzualizare rapidă a obiectelor listate de utilizator */}
          <section className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-3.5">
              <div>
                <h2 className="font-display text-lg font-bold text-ink">
                  Obiectele tale listate recent
                </h2>
                <p className="text-xs text-ink-muted">
                  Administrare rapidă a echipamentelor publicate în catalog
                </p>
              </div>
              <Link
                href="/listarile-mele"
                className="text-xs font-semibold text-ochre hover:underline inline-flex items-center gap-1"
              >
                <span>Vezi tot inventarul ({myListings.length})</span>
                <ArrowRight
                  className="w-3.5 h-3.5"
                  strokeWidth={1.8}
                  aria-hidden="true"
                />
              </Link>
            </div>

            {recentListings.length > 0 ? (
              <div className="divide-y divide-slate-100">
                {recentListings.map((item) => {
                  const thumb = item.images?.[0]?.url || null;
                  return (
                    <div
                      key={item.id}
                      className="py-3 first:pt-0 last:pb-0 flex items-center justify-between gap-3"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-12 h-12 rounded-xl bg-slate-100 overflow-hidden shrink-0 border border-slate-200/80 flex items-center justify-center">
                          {thumb ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={thumb}
                              alt={item.title}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <Package
                              className="w-5 h-5 text-slate-400"
                              strokeWidth={1.8}
                              aria-hidden="true"
                            />
                          )}
                        </div>
                        <div className="min-w-0">
                          <Link
                            href={`/obiect/${item.id}`}
                            className="font-display text-sm font-bold text-ink hover:text-ochre truncate block"
                          >
                            {item.title}
                          </Link>
                          <div className="text-xs text-ink-muted flex flex-wrap items-center gap-2 mt-0.5">
                            <span>{getCategoryLabel(item.category)}</span>
                            <span>&bull;</span>
                            <strong className="text-ink">
                              {Number(item.price_per_day).toFixed(0)} RON / zi
                            </strong>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <Link
                          href={`/listarile-mele/${item.id}/editeaza`}
                          className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200/80 text-ink text-xs font-semibold transition-colors"
                        >
                          Editează
                        </Link>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="rounded-xl bg-slate-50/80 border border-slate-200/80 p-5 text-center space-y-2.5">
                <p className="text-xs text-ink-muted">
                  Nu ai listat încă niciun echipament spre închiriere.
                </p>
                <Link
                  href="/listarile-mele/nou"
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-ochre text-white text-xs font-semibold shadow-2xs hover:bg-ochre/90 transition-all"
                >
                  <Plus
                    className="w-3.5 h-3.5"
                    strokeWidth={2}
                    aria-hidden="true"
                  />
                  <span>Adaugă primul tău obiect</span>
                </Link>
              </div>
            )}
          </section>
        </div>

        {/* COLOANA DREAPTA (5 / 12) — Verificare Identitate, Plăți & GDPR */}
        <div className="lg:col-span-5 space-y-6">
          {/* Card Plăți, Încasări & Facturi */}
          <section className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-sm space-y-4">
            <div className="flex items-start gap-3.5">
              <div className="w-11 h-11 rounded-xl bg-ochre-light text-ochre flex items-center justify-center shrink-0">
                <CreditCard
                  className="w-5 h-5"
                  strokeWidth={1.8}
                  aria-hidden="true"
                />
              </div>
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="font-display text-lg font-bold text-ink">
                    Plăți, Încasări &amp; Facturi
                  </h2>
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-ochre-light text-ochre">
                    Escrow Activ
                  </span>
                </div>
                <p className="text-xs text-ink-muted leading-relaxed">
                  Configurează contul bancar pentru încasarea chiriilor și
                  descarcă facturile fiscale de comision.
                </p>
              </div>
            </div>

            <ul className="space-y-2 text-xs text-ink-muted bg-slate-50/80 rounded-xl p-3.5 border border-slate-200/70">
              <li className="flex items-center gap-2">
                <CheckCircle2
                  className="w-4 h-4 text-ochre shrink-0"
                  strokeWidth={1.8}
                  aria-hidden="true"
                />
                <span>
                  Primești <strong className="text-ink">90% din chirie</strong>{" "}
                  direct în cont (10% comision platformă)
                </span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2
                  className="w-4 h-4 text-ochre shrink-0"
                  strokeWidth={1.8}
                  aria-hidden="true"
                />
                <span>
                  Garanțiile sunt păstrate în siguranță în{" "}
                  <strong className="text-ink">Escrow</strong> pe durata
                  închirierii
                </span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2
                  className="w-4 h-4 text-ochre shrink-0"
                  strokeWidth={1.8}
                  aria-hidden="true"
                />
                <span>
                  Facturi PDF &amp; export XML{" "}
                  <strong className="text-ink">RO e-Factura</strong> incluse
                </span>
              </li>
            </ul>

            <Link
              href="/profil/plati"
              className="catalog-btn-primary w-full inline-flex items-center justify-center gap-2"
            >
              <span>Deschide Panoul de Plăți &amp; Facturi</span>
              <ArrowRight
                className="w-4 h-4 shrink-0"
                strokeWidth={1.8}
                aria-hidden="true"
              />
            </Link>
          </section>

          {/* Card Verificare Identitate (Telefon OTP & Business ANAF) */}
          <TrustVerificationCard
            initialPhone={profileData.phone}
            phoneVerified={Boolean(profileData.phone_verified)}
            accountType={profileData.account_type}
            initialCui={profileData.company_cui}
            kybVerified={Boolean(profileData.kyb_verified)}
            companyName={
              (privateData as { company_legal_name?: string | null } | null)
                ?.company_legal_name ?? null
            }
            companyAddress={
              (privateData as { company_address?: string | null } | null)
                ?.company_address ?? null
            }
            layout="stack"
          />

          {/* Panou Controale GDPR */}
          <GdprPrivacyPanel />
        </div>
      </div>
    </div>
  );
}
