"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

/**
 * Cheia folosită în `localStorage` pentru a persista consimțământul GDPR al utilizatorului.
 */
const CONSENT_STORAGE_KEY = "renta_cookie_consent_v1";

interface CookieConsentPreferences {
  essential: true;
  preferences: boolean;
  analytics: boolean;
  updatedAt: string;
}

/**
 * Banner de Consimțământ Cookie GDPR (`components/layout/CookieConsentBanner.tsx` — Client Component).
 *
 * Explicație pentru dezvoltatori C / Java:
 * - Folosim `"use client"` deoarece citirea din `window.localStorage` și starea
 *   interactivă (`useState`) există doar în browser, nu pe server.
 * - `useEffect` rulează o singură dată după montarea componentei în browser (ca un
 *   hook `onMount`), verifică dacă utilizatorul a salvat deja preferințele în
 *   `localStorage` și afișează bannerul doar dacă lipsește consimțământul.
 */
export function CookieConsentBanner() {
  const [visible, setVisible] = useState(false);
  const [showGranular, setShowGranular] = useState(false);
  const [preferencesEnabled, setPreferencesEnabled] = useState(true);
  const [analyticsEnabled, setAnalyticsEnabled] = useState(false);

  useEffect(() => {
    try {
      const existing = window.localStorage.getItem(CONSENT_STORAGE_KEY);
      if (!existing) {
        setVisible(true);
      }
    } catch {
      // Dacă browserul blochează accesul la localStorage (mod incognito strict), afișăm bannerul
      setVisible(true);
    }
  }, []);

  function saveConsent(preferences: boolean, analytics: boolean) {
    const payload: CookieConsentPreferences = {
      essential: true,
      preferences,
      analytics,
      updatedAt: new Date().toISOString(),
    };

    try {
      window.localStorage.setItem(CONSENT_STORAGE_KEY, JSON.stringify(payload));
    } catch {
      // Ignorăm grațios eroarea dacă storage-ul este indisponibil
    }
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <aside
      role="dialog"
      aria-label="Preferințe fișiere cookie"
      className="fixed bottom-4 left-4 right-4 z-50 mx-auto max-w-3xl print:hidden"
    >
      <div className="bg-white border border-slate-200/90 rounded-2xl shadow-xl p-5 sm:p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center rounded-full bg-ochre-light px-2.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider text-ochre">
                GDPR &amp; COOKIES
              </span>
              <h2 className="font-display text-sm sm:text-base font-bold text-ink">
                Respectăm confidențialitatea datelor tale
              </h2>
            </div>
            <p className="text-xs sm:text-sm text-ink-muted leading-relaxed">
              Folosim cookie-uri strict necesare pentru sesiunea de
              autentificare (Supabase Auth) și, doar cu acordul tău, stocare
              locală pentru preferințe UI și analitice anonimizate. Citește{" "}
              <Link
                href="/politica-cookie"
                className="text-ochre font-semibold hover:underline"
              >
                Politica Cookie
              </Link>
              .
            </p>
          </div>
        </div>

        {/* Panou setări granulare (toggle-uri) */}
        {showGranular && (
          <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-4 space-y-3">
            {/* 1. Esențiale — mereu activ */}
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-0.5">
                <div className="text-xs font-bold text-ink">
                  Esențiale (Strict necesare)
                </div>
                <p className="text-[11px] text-ink-muted">
                  Autentificare, securitate sesiune și salvarea acordului
                  cookie. Mereu active.
                </p>
              </div>
              <input
                type="checkbox"
                checked
                disabled
                aria-label="Cookie-uri esențiale (mereu active)"
                className="mt-1 h-4 w-4 cursor-not-allowed opacity-70"
              />
            </div>

            <hr className="border-slate-200" />

            {/* 2. Preferințe UI */}
            <label className="flex items-start justify-between gap-4 cursor-pointer">
              <div className="space-y-0.5">
                <div className="text-xs font-bold text-ink">
                  Preferințe UI &amp; Favorite locale
                </div>
                <p className="text-[11px] text-ink-muted">
                  Salvează local în browser lista de favorite și filtrele
                  preferate de catalog.
                </p>
              </div>
              <input
                type="checkbox"
                checked={preferencesEnabled}
                onChange={(e) => setPreferencesEnabled(e.target.checked)}
                className="mt-1 h-4 w-4 cursor-pointer"
              />
            </label>

            <hr className="border-slate-200" />

            {/* 3. Analitice */}
            <label className="flex items-start justify-between gap-4 cursor-pointer">
              <div className="space-y-0.5">
                <div className="text-xs font-bold text-ink">
                  Analitice anonimizate
                </div>
                <p className="text-[11px] text-ink-muted">
                  Ne ajută să îmbunătățim performanța platformei fără profilare
                  publicitară.
                </p>
              </div>
              <input
                type="checkbox"
                checked={analyticsEnabled}
                onChange={(e) => setAnalyticsEnabled(e.target.checked)}
                className="mt-1 h-4 w-4 cursor-pointer"
              />
            </label>
          </div>
        )}

        {/* Butoane de acțiune */}
        <div className="flex flex-wrap items-center justify-end gap-2.5 pt-1">
          <button
            type="button"
            onClick={() => setShowGranular((prev) => !prev)}
            className="catalog-btn-secondary text-xs"
          >
            {showGranular ? "Ascunde setările" : "Setări granulare"}
          </button>

          <button
            type="button"
            onClick={() => saveConsent(false, false)}
            className="catalog-btn-secondary text-xs"
          >
            Doar esențiale
          </button>

          {showGranular ? (
            <button
              type="button"
              onClick={() => saveConsent(preferencesEnabled, analyticsEnabled)}
              className="catalog-btn-primary text-xs"
            >
              Salvează preferințele
            </button>
          ) : (
            <button
              type="button"
              onClick={() => saveConsent(true, true)}
              className="catalog-btn-primary text-xs"
            >
              Acceptă toate
            </button>
          )}
        </div>
      </div>
    </aside>
  );
}
