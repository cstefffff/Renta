"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Building2,
  Camera,
  CheckCircle2,
  AlertCircle,
  Lock,
  MapPin,
  Phone,
  Save,
  User,
} from "lucide-react";
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
            "Datele profilului tău au fost salvate cu succes.",
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
          className={`p-4 rounded-xl border text-xs font-medium flex items-start gap-2.5 ${
            statusMessage.type === "success"
              ? "border-emerald-200 bg-emerald-50/90 text-emerald-900"
              : "border-red-200 bg-red-50/90 text-red-900"
          }`}
        >
          {statusMessage.type === "success" ? (
            <CheckCircle2
              className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5"
              strokeWidth={1.8}
              aria-hidden="true"
            />
          ) : (
            <AlertCircle
              className="w-4 h-4 text-red-600 shrink-0 mt-0.5"
              strokeWidth={1.8}
              aria-hidden="true"
            />
          )}
          <span>{statusMessage.text}</span>
        </div>
      )}

      {/* 1. Fotografie de Profil / Siglă Business */}
      <div className="p-4 sm:p-5 rounded-xl border border-slate-200/80 bg-slate-50/70 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl border border-slate-200 bg-white shadow-2xs overflow-hidden flex items-center justify-center shrink-0 font-display text-xl font-extrabold text-ochre">
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
            <div className="text-sm font-bold text-ink font-display">
              {accountType === "company"
                ? "Siglă Business / Fotografie Profil"
                : "Fotografie de Profil"}
            </div>
            <p className="text-xs text-ink-muted">
              Format JPG, PNG sau WEBP (maxim 2 MB). O imagine clară crește
              încrederea la rezervare.
            </p>
            {selectedAvatarName && (
              <div className="text-xs text-ochre font-semibold">
                Fișier pregătit: {selectedAvatarName}
              </div>
            )}
          </div>
        </div>

        <label className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-white hover:bg-slate-100 text-ink border border-slate-200/90 text-xs font-semibold shadow-2xs transition-all cursor-pointer shrink-0">
          <Camera
            className="w-4 h-4 text-ochre shrink-0"
            strokeWidth={1.8}
            aria-hidden="true"
          />
          <span>Schimbă fotografia</span>
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

      {/* 2. Selector Vizual Tip Cont: Personal vs Business */}
      <div className="space-y-2">
        <label className="block text-xs font-semibold text-ink">
          Tipul contului în platformă
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => setAccountType("individual")}
            className={`p-4 rounded-xl border text-left transition-all cursor-pointer flex items-start gap-3 ${
              accountType === "individual"
                ? "border-ochre bg-ochre-light/50 ring-2 ring-ochre/15 shadow-2xs"
                : "border-slate-200/90 bg-white hover:border-slate-300"
            }`}
          >
            <div
              className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                accountType === "individual"
                  ? "bg-ochre text-white"
                  : "bg-slate-100 text-ink-muted"
              }`}
            >
              <User className="w-4 h-4" strokeWidth={1.8} aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <div className="text-sm font-bold text-ink font-display">
                Personal
              </div>
              <p className="text-[11px] text-ink-muted leading-snug mt-0.5">
                Persoană fizică — închiriezi ocazional echipamente din
                patrimoniul propriu.
              </p>
            </div>
          </button>

          <button
            type="button"
            onClick={() => setAccountType("company")}
            className={`p-4 rounded-xl border text-left transition-all cursor-pointer flex items-start gap-3 ${
              accountType === "company"
                ? "border-ochre bg-ochre-light/50 ring-2 ring-ochre/15 shadow-2xs"
                : "border-slate-200/90 bg-white hover:border-slate-300"
            }`}
          >
            <div
              className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                accountType === "company"
                  ? "bg-ochre text-white"
                  : "bg-slate-100 text-ink-muted"
              }`}
            >
              <Building2
                className="w-4 h-4"
                strokeWidth={1.8}
                aria-hidden="true"
              />
            </div>
            <div className="min-w-0">
              <div className="text-sm font-bold text-ink font-display">
                Business
              </div>
              <p className="text-[11px] text-ink-muted leading-snug mt-0.5">
                Firmă / PFA — centru de închirieri cu verificare CUI ANAF și
                facturare.
              </p>
            </div>
          </button>
        </div>
        <input type="hidden" name="account_type" value={accountType} />
      </div>

      {/* 3. Nume / Denumire & Oraș */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <label
            htmlFor="display_name"
            className="block text-xs font-semibold text-ink"
          >
            {accountType === "company"
              ? "Denumire Business / Firmă *"
              : "Nume și Prenume *"}
          </label>
          <input
            id="display_name"
            name="display_name"
            type="text"
            required
            minLength={2}
            defaultValue={profile.full_name}
            placeholder={
              accountType === "company"
                ? "Ex: ProRent Utilaje SRL"
                : "Ex: Andrei Popescu"
            }
            className="catalog-input"
          />
        </div>

        <div className="space-y-1.5">
          <label
            htmlFor="city"
            className="block text-xs font-semibold text-ink"
          >
            <span className="inline-flex items-center gap-1">
              <MapPin
                className="w-3.5 h-3.5 text-ochre shrink-0"
                strokeWidth={1.8}
                aria-hidden="true"
              />
              <span>Oraș principal *</span>
            </span>
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

      {/* 4. Date de Contact Protejate (Telefon + CUI Business) */}
      <div className="p-4 sm:p-5 rounded-xl border border-slate-200/80 bg-slate-50/70 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200/80 pb-3">
          <div className="flex items-center gap-2">
            <Lock
              className="w-4 h-4 text-ochre shrink-0"
              strokeWidth={1.8}
              aria-hidden="true"
            />
            <span className="text-xs font-bold text-ink">
              Date de contact protejate
            </span>
          </div>
          <span className="text-[11px] text-ink-muted bg-white px-2.5 py-0.5 rounded-full border border-slate-200/80">
            Vizibile doar la rezervări confirmate
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label
              htmlFor="phone"
              className="block text-xs font-semibold text-ink"
            >
              <span className="inline-flex items-center gap-1">
                <Phone
                  className="w-3.5 h-3.5 text-ink-muted shrink-0"
                  strokeWidth={1.8}
                  aria-hidden="true"
                />
                <span>Telefon de contact (România)</span>
              </span>
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
                className="block text-xs font-semibold text-ink"
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

      {/* 5. Bio / Descriere & Program Predare */}
      <div className="space-y-1.5">
        <label htmlFor="bio" className="block text-xs font-semibold text-ink">
          Descriere scurtă &amp; detalii de predare
        </label>
        <textarea
          id="bio"
          name="bio"
          rows={3}
          defaultValue={profile.bio ?? ""}
          placeholder="Ex: Predare rapidă în zona Piața Victoriei sau la sediul nostru Luni–Vineri 09:00–18:00. Toate echipamentele sunt verificate înainte de predare."
          className="catalog-input"
        />
        <p className="text-[11px] text-ink-muted">
          Acest text apare pe pagina anunțurilor tale pentru a ajuta chiriașii
          să știe cum și unde pot prelua echipamentele.
        </p>
      </div>

      <div className="pt-1 flex items-center justify-end">
        <button
          type="submit"
          disabled={loading}
          className="catalog-btn-primary inline-flex items-center gap-2"
        >
          <Save className="w-4 h-4 shrink-0" strokeWidth={1.8} aria-hidden="true" />
          <span>
            {loading ? "Se salvează modificările..." : "Salvează modificările"}
          </span>
        </button>
      </div>
    </form>
  );
}
export const ProfileEditForm = ProfileForm;
