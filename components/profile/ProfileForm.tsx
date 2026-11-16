"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { updateProfileAction } from "@/app/actions/auth";
import { RENTA_CITIES } from "@/lib/types/database";

/**
 * Interfața Props pentru formularul de profil (`components/profile/ProfileForm.tsx`).
 *
 * Explicație pentru C/Java:
 * Această interfață combină câmpurile publice din `public.profiles` (`display_name`,
 * `bio`, `avatar_url`, `rating_avg`) cu câmpurile private din `public.profile_private`
 * (`phone`, `company_cui`) pe care doar proprietarul contului le poate vedea și edita.
 */
export interface ProfileData {
  id: string;
  email: string;
  full_name: string;
  account_type: "individual" | "company";
  company_cui: string | null;
  city: string;
  phone: string | null;
  bio: string | null;
  avatar_url?: string | null;
  phone_verified?: boolean;
  kyb_verified?: boolean;
  rating_avg?: number | null;
  rating_count?: number;
}

export function ProfileForm({ profile }: { profile: ProfileData }) {
  const router = useRouter();
  const [accountType, setAccountType] = useState<"individual" | "company">(
    profile.account_type || "individual"
  );
  const [selectedAvatarName, setSelectedAvatarName] = useState<string | null>(
    null
  );
  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setStatusMessage(null);

    const formData = new FormData(event.currentTarget);
    formData.set("account_type", accountType);
    // Sincronizăm atât `display_name` (folosit de schema Zod) cât și `full_name`
    const nameVal = String(
      formData.get("display_name") || formData.get("full_name") || ""
    ).trim();
    formData.set("display_name", nameVal);
    formData.set("full_name", nameVal);

    try {
      const result = await updateProfileAction(formData);
      if (result && !result.success) {
        setStatusMessage({
          type: "error",
          text: result.error || "Eroare la validarea datelor.",
        });
      } else {
        setStatusMessage({
          type: "success",
          text:
            result?.message ||
            "Fișa de profil și datele private au fost actualizate.",
        });
        setSelectedAvatarName(null);
        router.refresh();
      }
    } catch {
      setStatusMessage({
        type: "error",
        text: "A apărut o eroare la salvarea profilului.",
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {statusMessage && (
        <div
          className={`p-3.5 border text-xs font-mono ${
            statusMessage.type === "success"
              ? "border-emerald-800 bg-emerald-900/10 text-emerald-950"
              : "border-red-800/50 bg-red-900/10 text-red-950"
          }`}
        >
          [{statusMessage.type === "success" ? "SALVAT OK" : "EROARE"}]:{" "}
          {statusMessage.text}
        </div>
      )}

      {/* Upload Fotografie de Profil / Logo Atelier (Bucket `avatars`) */}
      <div className="p-4 border border-ink/20 bg-cream flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 border border-ink bg-cream-light overflow-hidden flex items-center justify-center shrink-0 font-display text-xl font-bold text-ink">
            {profile.avatar_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={profile.avatar_url}
                alt={profile.full_name}
                className="w-full h-full object-cover"
              />
            ) : (
              <span>
                {(profile.full_name || "R").slice(0, 2).toUpperCase()}
              </span>
            )}
          </div>
          <div className="space-y-1">
            <div className="font-mono text-xs uppercase font-bold text-ink">
              Fotografie Membru / Siglă Firmă (Opțional)
            </div>
            <p className="text-xs text-ink-muted">
              Format JPG, PNG sau WEBP (maxim 2 MB). Se salvează în bucket-ul{" "}
              <code className="font-mono">avatars</code>.
            </p>
            {selectedAvatarName && (
              <div className="font-mono text-[11px] text-ochre font-bold">
                Fișier selectat: {selectedAvatarName}
              </div>
            )}
          </div>
        </div>

        <label className="catalog-btn-secondary cursor-pointer shrink-0">
          Schimbă Fotografia
          <input
            type="file"
            name="avatar"
            accept="image/png,image/jpeg,image/webp"
            onChange={(e) =>
              setSelectedAvatarName(e.target.files?.[0]?.name ?? null)
            }
            className="hidden"
          />
        </label>
      </div>

      {/* Tipul Contului */}
      <div className="space-y-2">
        <label className="block font-mono text-xs uppercase text-ink font-semibold">
          Tip Cont în Catalog
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => setAccountType("individual")}
            className={`p-3 text-left border font-mono text-xs transition-colors ${
              accountType === "individual"
                ? "border-ink bg-ochre-light font-bold"
                : "border-ink/25 bg-cream"
            }`}
          >
            [P2P] Persoană Fizică (Individual)
          </button>
          <button
            type="button"
            onClick={() => setAccountType("company")}
            className={`p-3 text-left border font-mono text-xs transition-colors ${
              accountType === "company"
                ? "border-ink bg-ochre-light font-bold"
                : "border-ink/25 bg-cream"
            }`}
          >
            [B2C] Firmă de Închirieri (Company)
          </button>
        </div>
        <input type="hidden" name="account_type" value={accountType} />
      </div>

      {/* Nume / Denumire & Oraș */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <label
            htmlFor="display_name"
            className="block font-mono text-xs uppercase text-ink font-semibold"
          >
            {accountType === "company"
              ? "Denumire Firmă / Atelier *"
              : "Nume și Prenume *"}
          </label>
          <input
            id="display_name"
            name="display_name"
            type="text"
            required
            minLength={2}
            defaultValue={profile.full_name}
            className="catalog-input"
          />
        </div>

        <div className="space-y-1.5">
          <label
            htmlFor="city"
            className="block font-mono text-xs uppercase text-ink font-semibold"
          >
            Oraș *
          </label>
          <select
            id="city"
            name="city"
            defaultValue={profile.city || "București"}
            className="catalog-input"
          >
            {RENTA_CITIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Date Private Izolate GDPR (public.profile_private): Telefon + CUI */}
      <div className="p-4 border border-ink/20 bg-cream space-y-4">
        <div className="flex items-center justify-between border-b border-ink/15 pb-2 font-mono text-xs">
          <span className="font-bold text-ink uppercase">
            DATE DE CONTACT PROTEJATE GDPR (PUBLIC.PROFILE_PRIVATE)
          </span>
          <span className="text-[11px] text-ink-muted">
            Vizibile doar la rezervări confirmate
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label
              htmlFor="phone"
              className="block font-mono text-xs uppercase text-ink font-semibold"
            >
              Telefon Contact (România)
            </label>
            <input
              id="phone"
              name="phone"
              type="tel"
              defaultValue={profile.phone ?? ""}
              placeholder="0722 000 000"
              className="catalog-input"
            />
          </div>

          {accountType === "company" && (
            <div className="space-y-1.5">
              <label
                htmlFor="company_cui"
                className="block font-mono text-xs uppercase text-ink font-semibold"
              >
                CUI / CIF Firmă *
              </label>
              <input
                id="company_cui"
                name="company_cui"
                type="text"
                required={accountType === "company"}
                defaultValue={profile.company_cui ?? ""}
                placeholder="RO12345678"
                className="catalog-input"
              />
            </div>
          )}
        </div>
      </div>

      {/* Bio / Descriere Atelier */}
      <div className="space-y-1.5">
        <label
          htmlFor="bio"
          className="block font-mono text-xs uppercase text-ink font-semibold"
        >
          Descriere Scurtă / Program Ridicare (public.profiles.bio)
        </label>
        <textarea
          id="bio"
          name="bio"
          rows={3}
          defaultValue={profile.bio ?? ""}
          placeholder="Ex: Predare personală în zona Piața Victoriei sau la sediul atelierului nostru Luni–Vineri 09:00–18:00..."
          className="catalog-input"
        />
      </div>

      <div className="pt-2">
        <button
          type="submit"
          disabled={loading}
          className="catalog-btn-primary"
        >
          {loading
            ? "Se salvează modificările..."
            : "Salvează Fișa de Profil"}
        </button>
      </div>
    </form>
  );
}
