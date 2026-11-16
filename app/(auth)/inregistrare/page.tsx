"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signUpAction } from "@/app/actions/auth";

/**
 * Pagina de Înregistrare (`/inregistrare`) — Client Component.
 *
 * Explicație pentru C/Java:
 * Directiva `"use client"` de pe prima linie îi spune lui Next.js că această
 * componentă are nevoie de interactivitate în browser (state local, evenimente
 * onClick/onChange).
 *
 * Hook-ul `useState` este echivalentul unei variabile membre private într-o clasă
 * UI (ex. JavaFX / Swing), dar când apelezi funcția `setAccountType(...)`, React
 * redesenează automat doar partea din ecran care depinde de acea variabilă.
 */
export default function InregistrarePage() {
  const router = useRouter();
  const [accountType, setAccountType] = useState<"individual" | "company">(
    "individual"
  );
  const [city, setCity] = useState<string>("București");
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    const formData = new FormData(event.currentTarget);
    formData.set("account_type", accountType);

    try {
      const result = await signUpAction(formData);

      if (result && !result.success && result.error) {
        setErrorMsg(result.error);
      } else if (result && result.success && result.data?.requiresEmailConfirmation === false) {
        // Contul a fost creat și autentificat automat -> mergem direct la profil
        router.push("/profil");
        router.refresh();
      } else if (result && "message" in result && result.message) {
        setSuccessMsg(result.message);
      } else {
        router.push("/profil");
        router.refresh();
      }
    } catch {
      // Dacă Server Action-ul a făcut redirect(), Next.js gestionează navigarea
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-xl mx-auto px-4 sm:px-6 py-12">
      <div className="catalog-card p-6 sm:p-8 space-y-6">
        {/* Antet fișă de înregistrare */}
        <div className="border-b border-ink/20 pb-4 space-y-1">
          <div className="flex items-center justify-between font-mono text-xs text-ochre font-bold">
            <span>FORMULAR ÎNREGISTRARE // #AUTH-01</span>
            <span>PUBLIC.PROFILES</span>
          </div>
          <h1 className="font-display text-2xl font-extrabold text-ink">
            Deschide Fișă de Membru în Catalog
          </h1>
          <p className="text-xs text-ink-muted">
            Alege tipul de cont potrivit: proprietar individual (Peer-to-Peer)
            sau firmă locală de închirieri.
          </p>
        </div>

        {errorMsg && (
          <div className="p-3.5 border border-red-800/50 bg-red-900/10 text-xs font-mono text-red-950">
            [EROARE]: {errorMsg}
          </div>
        )}

        {successMsg && (
          <div className="p-4 border border-emerald-800 bg-emerald-900/10 text-xs font-mono text-emerald-950 space-y-2">
            <div className="font-bold">[CONFIRMARE]: {successMsg}</div>
            <div>
              <Link
                href="/login"
                className="underline font-bold hover:text-ochre"
              >
                Mergi la pagina de Autentificare &rarr;
              </Link>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Selector Tip Cont: Persoană Fizică vs Firmă */}
          <div className="space-y-2">
            <label className="block font-mono text-xs uppercase text-ink font-semibold">
              1. Tipul Contului (Segment Catalog) *
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setAccountType("individual")}
                className={`p-3.5 text-left border transition-colors ${
                  accountType === "individual"
                    ? "border-ink bg-ochre-light"
                    : "border-ink/25 bg-cream hover:border-ink/60"
                }`}
              >
                <div className="font-mono text-[11px] uppercase font-bold text-ochre">
                  [SEGMENT A // P2P]
                </div>
                <div className="font-display text-sm font-bold text-ink mt-0.5">
                  Persoană Fizică
                </div>
                <p className="text-[11px] text-ink-muted mt-0.5">
                  Închiriez sau dau spre închiriere obiecte personale.
                </p>
              </button>

              <button
                type="button"
                onClick={() => setAccountType("company")}
                className={`p-3.5 text-left border transition-colors ${
                  accountType === "company"
                    ? "border-ink bg-ochre-light"
                    : "border-ink/25 bg-cream hover:border-ink/60"
                }`}
              >
                <div className="font-mono text-[11px] uppercase font-bold text-ochre">
                  [SEGMENT B // B2C]
                </div>
                <div className="font-display text-sm font-bold text-ink mt-0.5">
                  Firmă de Închirieri
                </div>
                <p className="text-[11px] text-ink-muted mt-0.5">
                  Centru de închirieri scule, echipamente sau evenimente.
                </p>
              </button>
            </div>
            <input type="hidden" name="account_type" value={accountType} />
          </div>

          {/* Nume Complet sau Denumire Firmă */}
          <div className="space-y-1.5">
            <label
              htmlFor="display_name"
              className="block font-mono text-xs uppercase text-ink font-semibold"
            >
              {accountType === "company"
                ? "2. Denumire Firmă / Atelier *"
                : "2. Nume și Prenume *"}
            </label>
            <input
              id="display_name"
              name="display_name"
              type="text"
              required
              placeholder={
                accountType === "company"
                  ? "Ex: Atelier Scule Pro SRL"
                  : "Ex: Andrei Popescu"
              }
              className="catalog-input"
            />
          </div>

          {/* Câmp CUI afișat condițional doar pentru Firme */}
          {accountType === "company" && (
            <div className="space-y-1.5 p-3.5 border border-ochre/50 bg-ochre-light/40">
              <label
                htmlFor="company_cui"
                className="block font-mono text-xs uppercase text-ink font-semibold"
              >
                CUI / CIF Firmă (pentru badge-ul de Firmă Verificată)
              </label>
              <input
                id="company_cui"
                name="company_cui"
                type="text"
                placeholder="Ex: RO12345678"
                className="catalog-input"
              />
            </div>
          )}

          {/* Oraș și Telefon */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label
                htmlFor="city"
                className="block font-mono text-xs uppercase text-ink font-semibold"
              >
                3. Oraș (Locație Pilot) *
              </label>
              <select
                id="city"
                name="city"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className="catalog-input"
              >
                <option value="București">București</option>
                <option value="Cluj-Napoca">Cluj-Napoca</option>
                <option value="Timișoara">Timișoara</option>
                <option value="Iași">Iași</option>
                <option value="Brașov">Brașov</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="phone"
                className="block font-mono text-xs uppercase text-ink font-semibold"
              >
                4. Telefon Contact
              </label>
              <input
                id="phone"
                name="phone"
                type="tel"
                placeholder="Ex: 0722 000 000"
                className="catalog-input"
              />
            </div>
          </div>

          {/* Email */}
          <div className="space-y-1.5">
            <label
              htmlFor="email"
              className="block font-mono text-xs uppercase text-ink font-semibold"
            >
              5. Adresă de Email *
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              placeholder="nume@exemplu.ro"
              className="catalog-input"
            />
          </div>

          {/* Parolă */}
          <div className="space-y-1.5">
            <label
              htmlFor="password"
              className="block font-mono text-xs uppercase text-ink font-semibold"
            >
              6. Parolă (minim 6 caractere) *
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              minLength={6}
              placeholder="••••••••"
              className="catalog-input"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="catalog-btn-primary w-full py-3"
          >
            {loading
              ? "Se înregistrează fișa în Supabase..."
              : "Înregistrează Cont în Catalog"}
          </button>
        </form>

        <div className="pt-4 border-t border-ink/15 flex items-center justify-between text-xs font-mono">
          <span className="text-ink-muted">Ai deja cont înregistrat?</span>
          <Link
            href="/login"
            className="text-ink font-bold underline underline-offset-4 hover:text-ochre"
          >
            Autentifică-te aici &rarr;
          </Link>
        </div>
      </div>
    </div>
  );
}
