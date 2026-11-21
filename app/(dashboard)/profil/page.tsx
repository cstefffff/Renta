import Link from "next/link";
import { CreditCard, Star } from "lucide-react";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { getMyFullProfile, signOutAction } from "@/app/actions/auth";
import { ProfileForm, type ProfileData } from "@/components/profile/ProfileForm";
import { TrustVerificationCard } from "@/components/profile/TrustVerificationCard";
import { GdprPrivacyPanel } from "@/components/profile/GdprPrivacyPanel";

export const dynamic = "force-dynamic";

/**
 * Pagina de Profil (`/profil`) — Async Server Component.
 *
 * Explicație pentru C/Java:
 * Folosește `getMyFullProfile()` care interoghează în paralel atât tabelul public
 * `public.profiles` (nume, bio, avatar, reputație), cât și tabelul izolat
 * `public.profile_private` (telefon, CUI, rol de sistem), îmbinându-le într-un
 * singur DTO pentru utilizatorul autentificat.
 */
export default async function ProfilPage() {
  if (!isSupabaseConfigured()) {
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12">
        <div className="catalog-card p-6 space-y-4">
          <div className="font-mono text-xs text-ochre font-bold">
            [CONFIGURARE NECESARĂ // #PRF-00]
          </div>
          <h1 className="font-display text-2xl font-bold">
            Conexiunea Supabase nu este activă
          </h1>
          <p className="text-sm text-ink-muted">
            Pentru a vizualiza și edita fișa de profil, configurează mai întâi
            cheile în <code className="font-mono">.env.local</code>.
          </p>
          <Link href="/status-db" className="catalog-btn-primary">
            Mergi la Diagnostic DB &rarr;
          </Link>
        </div>
      </div>
    );
  }

  const fullProfile = await getMyFullProfile();

  if (!fullProfile) {
    return (
      <div className="max-w-xl mx-auto px-4 sm:px-6 py-14">
        <div className="catalog-card p-6 sm:p-8 space-y-4">
          <div className="font-mono text-xs text-ochre font-bold">
            [ACCES RESTRICȚIONAT // #PRF-401]
          </div>
          <h1 className="font-display text-2xl font-bold text-ink">
            Nu ești autentificat în sistem
          </h1>
          <p className="text-sm text-ink-muted">
            Pentru a accesa fișa ta de membru din catalogul RentA, autentifică-te
            sau creează un cont nou.
          </p>
          <div className="flex items-center gap-3 pt-2">
            <Link href="/login" className="catalog-btn-primary">
              Autentificare
            </Link>
            <Link href="/inregistrare" className="catalog-btn-secondary">
              Creează Cont Nou
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

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10 space-y-8">
      {/* Antet Fișă de Membru */}
      <div className="catalog-card p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start sm:items-center gap-4">
          {/* Avatar / Monogramă */}
          <div className="w-16 h-16 border border-ink bg-cream overflow-hidden flex items-center justify-center shrink-0 font-display text-xl font-extrabold text-ink">
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

          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2 font-mono text-xs">
              <span className="text-ochre font-bold">
                FIȘĂ MEMBRU // #{profile.id.slice(0, 8).toUpperCase()}
              </span>
              <span className="px-2 py-0.5 bg-cream-dark border border-ink/20 text-ink">
                {profileData.account_type === "company"
                  ? "SEGMENT B: FIRMĂ ÎNCHIRIERI"
                  : "SEGMENT A: PERSOANĂ FIZICĂ (P2P)"}
              </span>
              {profileData.rating_count && profileData.rating_count > 0 ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-ochre-light border border-ochre text-ink font-bold">
                  <Star
                    className="w-3.5 h-3.5 fill-amber-400 text-amber-400 shrink-0"
                    strokeWidth={1.8}
                    aria-hidden="true"
                  />
                  <span>
                    {Number(profileData.rating_avg ?? 0).toFixed(1)} (
                    {profileData.rating_count} evaluări)
                  </span>
                </span>
              ) : null}
            </div>

            <h1 className="font-display text-2xl sm:text-3xl font-extrabold text-ink">
              {profileData.full_name}
            </h1>

            <p className="font-mono text-xs text-ink-muted">
              EMAIL: {profileData.email} &bull; ORAȘ: {profileData.city}
              {privateData?.role && privateData.role !== "user"
                ? ` • ROL: ${privateData.role.toUpperCase()}`
                : ""}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <Link href="/listarile-mele" className="catalog-btn-secondary">
            Inventarul Meu
          </Link>
          <Link href="/listarile-mele/nou" className="catalog-btn-primary">
            + Adaugă Obiect
          </Link>
          <form action={signOutAction}>
            <button type="submit" className="catalog-btn-secondary">
              Delogare
            </button>
          </form>
        </div>
      </div>

      {/* Card Plăți, Încasări & Stripe Connect */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl bg-ochre-light text-ochre flex items-center justify-center shrink-0">
            <CreditCard className="w-6 h-6" strokeWidth={1.8} aria-hidden="true" />
          </div>
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-display text-lg font-bold text-ink">
                Plăți, Încasări &amp; Stripe Connect
              </h2>
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-ochre-light text-ochre">
                Escrow &amp; Garanții
              </span>
            </div>
            <p className="text-sm text-ink-muted">
              Configurează contul bancar pentru încasarea chiriilor (90% net, 10%
              comision platformă) și monitorizează garanțiile blocate în Escrow.
            </p>
          </div>
        </div>

        <Link
          href="/profil/plati"
          className="catalog-btn-primary shrink-0 whitespace-nowrap"
        >
          Gestionează Plățile &rarr;
        </Link>
      </div>

      {/* Card Verificare Identitate (M12.1 Telefon OTP & M12.2 Firmă ANAF KYB) */}
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
      />

      {/* Formular de editare a datelor din public.profiles + public.profile_private */}
      <div className="catalog-card p-6 sm:p-8 space-y-6">
        <div className="border-b border-ink/15 pb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-display text-lg font-bold">
            Actualizare Date Profil &amp; Contact Protejat GDPR
          </h2>
          <span className="font-mono text-xs text-ink-muted">
            RLS: auth.uid() = id
          </span>
        </div>

        <ProfileForm profile={profileData} />
      </div>

      {/* Panou Controale GDPR (Art. 20 Export JSON & Art. 17 Anonimizare Cont) */}
      <GdprPrivacyPanel />
    </div>
  );
}
