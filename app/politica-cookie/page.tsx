import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Politica privind fișierele Cookie — RentA Store",
  description:
    "Informații detaliate despre modulele cookie și stocarea locală utilizate în platforma RentA.",
};

/**
 * Pagina Politica Cookie (`/politica-cookie`) — Server Component.
 * Explică transparent categoriile de cookie-uri: strict necesare (Supabase Auth),
 * preferințe locale UI și opționale analitice.
 */
export default function PoliticaCookiePage() {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10 space-y-6">
      {/* Breadcrumb & Navigare rapidă */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <nav
          aria-label="Breadcrumb"
          className="flex items-center gap-2 text-xs font-medium text-ink-muted"
        >
          <Link href="/" className="hover:text-ochre transition-colors">
            Acasă
          </Link>
          <span aria-hidden="true" className="text-slate-400">
            &rsaquo;
          </span>
          <span className="text-ink font-semibold">Politica Cookie</span>
        </nav>

        <div className="flex flex-wrap items-center gap-2 text-xs">
          <Link href="/termeni-si-conditii" className="catalog-btn-secondary">
            Termeni și Condiții
          </Link>
          <Link href="/confidentialitate" className="catalog-btn-secondary">
            Confidențialitate (GDPR)
          </Link>
        </div>
      </div>

      {/* Card principal */}
      <article className="bg-white border border-slate-200/90 rounded-2xl p-6 sm:p-10 shadow-sm space-y-8">
        <header className="border-b border-slate-200/80 pb-6 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center rounded-full bg-ochre-light px-3 py-1 font-mono text-[11px] font-bold uppercase tracking-wider text-ochre">
              ePRIVACY &amp; GDPR // COOKIES
            </span>
            <span className="font-mono text-xs text-ink-muted">
              Ultima actualizare: Noiembrie 2026
            </span>
          </div>
          <h1 className="font-display text-2xl sm:text-3xl font-extrabold text-ink tracking-tight">
            Politica privind Fișierele Cookie și Stocarea Locală
          </h1>
          <p className="text-sm text-ink-muted leading-relaxed">
            Platforma <strong>RentA</strong> folosește un set minimal și
            transparent de fișiere cookie și chei{" "}
            <code className="font-mono text-xs bg-slate-100 px-1.5 py-0.5 rounded">
              localStorage
            </code>{" "}
            pentru a asigura securitatea autentificării și o experiență fluentă
            de navigare. Nu vindem datele tale și nu folosim trackere
            publicitare invazive.
          </p>
        </header>

        {/* Tabel categorii de cookie-uri */}
        <section className="space-y-4">
          <h2 className="font-display text-lg font-bold text-ink">
            1. Categorii de Cookie-uri Utilizate
          </h2>

          <div className="space-y-3">
            {/* Categoria 1: Strict Necesare */}
            <div className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-5 space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="font-display text-base font-bold text-ink">
                  A. Cookie-uri Strict Necesare (Întotdeauna Active)
                </h3>
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-mono font-bold bg-emerald-100 text-emerald-800">
                  ESENȚIALE
                </span>
              </div>
              <p className="text-sm text-ink-muted leading-relaxed">
                Indispensabile pentru funcționarea platformei, autentificarea
                securizată și prevenirea atacurilor CSRF. Nu pot fi dezactivate.
              </p>
              <div className="text-xs font-mono text-ink-muted bg-white/80 rounded-lg border border-emerald-200/70 p-3 space-y-1">
                <div>
                  • <strong>sb-*-auth-token</strong> (Supabase Auth): menține
                  sesiunea criptată a utilizatorului autentificat.
                </div>
                <div>
                  • <strong>renta_cookie_consent_v1</strong> (localStorage):
                  reține alegerea ta privind consimțământul cookie.
                </div>
              </div>
            </div>

            {/* Categoria 2: Preferințe UI */}
            <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-5 space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="font-display text-base font-bold text-ink">
                  B. Preferințe Locale &amp; Interfață (Opționale)
                </h3>
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-mono font-semibold bg-slate-200/80 text-slate-700">
                  PREFERINȚE UI
                </span>
              </div>
              <p className="text-sm text-ink-muted leading-relaxed">
                Permit salvarea locală în browser a obiectelor marcate ca
                favorite (înainte de autentificare), a ultimului oraș filtrat și
                a preferințelor de afișare din catalog.
              </p>
              <div className="text-xs font-mono text-ink-muted bg-white rounded-lg border border-slate-200 p-3">
                • <strong>renta_favorites / UI state</strong> (localStorage):
                stocate exclusiv pe dispozitivul tău, fără a fi trimise către
                terți.
              </div>
            </div>

            {/* Categoria 3: Analitice */}
            <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-5 space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="font-display text-base font-bold text-ink">
                  C. Analitice și Performanță (Opționale)
                </h3>
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-mono font-semibold bg-slate-200/80 text-slate-700">
                  ANALITICE
                </span>
              </div>
              <p className="text-sm text-ink-muted leading-relaxed">
                Ne ajută să înțelegem agregat și anonimizat ce categorii de
                echipamente sunt cele mai căutate și să îmbunătățim viteza
                aplicației. Sunt activate exclusiv cu acordul tău explicit din
                bannerul de consimțământ.
              </p>
            </div>
          </div>
        </section>

        {/* 2. Cum poți gestiona cookie-urile */}
        <section className="space-y-2.5">
          <h2 className="font-display text-lg font-bold text-ink">
            2. Gestionarea și Retragerea Consimțământului
          </h2>
          <p className="text-sm text-ink-muted leading-relaxed">
            Îți poți modifica oricând opțiunile ștergând datele site-ului din
            setările browserului tău (Chrome, Firefox, Edge, Safari) — la
            următoarea vizită va reapărea bannerul de preferințe cookie — sau
            dezactivând cookie-urile neesențiale din browser. Dezactivarea
            cookie-urilor strict necesare poate împiedica autentificarea în
            contul RentA.
          </p>
        </section>
      </article>
    </div>
  );
}
