import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Politica de Confidențialitate (GDPR) — RentA Store",
  description:
    "Informare privind prelucrarea datelor cu caracter personal în platforma RentA conform Regulamentului (UE) 2016/679 (GDPR).",
};

/**
 * Pagina Politica de Confidențialitate (`/confidentialitate`) — Server Component.
 * Detaliază conformitatea GDPR, izolarea PII în `public.profile_private` și
 * oferă acces direct către controalele de export și anonimizare din `/profil`.
 */
export default function ConfidentialitatePage() {
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
          <span className="text-ink font-semibold">
            Politica de Confidențialitate (GDPR)
          </span>
        </nav>

        <div className="flex flex-wrap items-center gap-2 text-xs">
          <Link href="/termeni-si-conditii" className="catalog-btn-secondary">
            Termeni și Condiții
          </Link>
          <Link href="/politica-cookie" className="catalog-btn-secondary">
            Politica Cookie
          </Link>
        </div>
      </div>

      {/* Card principal */}
      <article className="bg-white border border-slate-200/90 rounded-2xl p-6 sm:p-10 shadow-sm space-y-8">
        <header className="border-b border-slate-200/80 pb-6 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center rounded-full bg-ochre-light px-3 py-1 font-mono text-[11px] font-bold uppercase tracking-wider text-ochre">
              GDPR // REGULAMENTUL (UE) 2016/679
            </span>
            <span className="font-mono text-xs text-ink-muted">
              Ultima actualizare: Noiembrie 2026
            </span>
          </div>
          <h1 className="font-display text-2xl sm:text-3xl font-extrabold text-ink tracking-tight">
            Politica de Confidențialitate și Protecția Datelor
          </h1>
          <p className="text-sm text-ink-muted leading-relaxed">
            Protecția vieții private este integrată din design în arhitectura{" "}
            <strong>RentA</strong> (<em>Privacy by Design</em>). Acest document
            explică ce date colectăm, cum le izolăm tehnic în baza de date și
            cum îți poți exercita oricând drepturile prevăzute de GDPR.
          </p>
        </header>

        {/* 1. Categorii de date colectate */}
        <section className="space-y-2.5">
          <h2 className="font-display text-lg font-bold text-ink">
            1. Ce Categorii de Date Prelucrăm
          </h2>
          <ul className="list-disc list-inside space-y-1.5 text-sm text-ink-muted pl-1">
            <li>
              <strong>Date de profil public:</strong> nume afișat, oraș, tip
              cont (Persoană Fizică / Firmă), fotografie de avatar, descriere
              scurtă (bio), rating și recenzii primite.
            </li>
            <li>
              <strong>Date cu caracter personal sensibile (PII):</strong> adresă
              de email, număr de telefon mobil, Cod Unic de Înregistrare (CUI),
              denumire legală și adresă sediu firmă (pentru Segment B).
            </li>
            <li>
              <strong>Date tranzacționale și financiare:</strong> rezervări,
              istoric plăți Escrow, ultimele 4 cifre IBAN (nu stocăm niciodată
              numărul complet al cardului), facturi fiscale de comision și
              dovezi foto check-in / check-out.
            </li>
            <li>
              <strong>Date tehnice minime:</strong> token-uri criptate de
              sesiune necesare autentificării și preferințe locale de interfață.
              Fonturile aplicației sunt găzduite local (<em>self-hosted</em>),
              fără transferuri către Google Fonts.
            </li>
          </ul>
        </section>

        {/* 2. Arhitectura de securitate și izolarea PII */}
        <section className="space-y-2.5">
          <h2 className="font-display text-lg font-bold text-ink">
            2. Izolarea Datelor PII în{" "}
            <code className="font-mono text-sm bg-slate-100 px-1.5 py-0.5 rounded">
              profile_private
            </code>{" "}
            și Row Level Security (RLS)
          </h2>
          <p className="text-sm text-ink-muted leading-relaxed">
            Spre deosebire de platformele clasice, RentA separă strict datele
            publice de datele confidențiale la nivel de bază de date PostgreSQL:
          </p>
          <div className="rounded-xl border border-emerald-200/80 bg-emerald-50/50 p-4 text-sm text-emerald-950 space-y-1.5">
            <p className="font-semibold">
              Protecție nativă prin politici RLS (Row Level Security):
            </p>
            <p className="text-xs leading-relaxed text-emerald-900/90">
              Numărul tău de telefon, CUI-ul și metadatele private sunt stocate
              exclusiv în tabelul izolat{" "}
              <code className="font-mono bg-emerald-100 px-1 py-0.5 rounded">
                public.profile_private
              </code>
              , accesibil doar propriului tău cont autentificat (
              <code className="font-mono">auth.uid() = id</code>). Niciun
              vizitator neautentificat sau alt utilizator nu poate citi datele
              tale de contact direct din API.
            </p>
          </div>
        </section>

        {/* 3. Scopul și temeiul legal */}
        <section className="space-y-2.5">
          <h2 className="font-display text-lg font-bold text-ink">
            3. Scopurile și Temeiurile Legale ale Prelucrării
          </h2>
          <ul className="list-disc list-inside space-y-1.5 text-sm text-ink-muted pl-1">
            <li>
              <strong>Executarea contractului (Art. 6(1)(b) GDPR):</strong>{" "}
              gestionarea contului, procesarea rezervărilor, plăților Escrow și
              notificărilor tranzacționale.
            </li>
            <li>
              <strong>Obligație legală (Art. 6(1)(c) GDPR):</strong> emiterea
              facturilor fiscale pentru comisionul de intermediere, arhivarea
              financiar-contabilă (10 ani conform legislației fiscale din
              România) și transmiterea în sistemul RO e-Factura.
            </li>
            <li>
              <strong>Interes legitim (Art. 6(1)(f) GDPR):</strong> prevenirea
              fraudelor, verificarea identității (OTP / ANAF KYB) și soluționarea
              echitabilă a disputelor.
            </li>
            <li>
              <strong>Consimțământ (Art. 6(1)(a) GDPR):</strong> utilizarea
              modulelor cookie opționale de preferințe sau analiză.
            </li>
          </ul>
        </section>

        {/* 4. Drepturile utilizatorului + CTA direct către /profil */}
        <section className="space-y-3">
          <h2 className="font-display text-lg font-bold text-ink">
            4. Drepturile Tale Conform GDPR
          </h2>
          <p className="text-sm text-ink-muted leading-relaxed">
            În orice moment, beneficiezi de următoarele drepturi garantate de
            Regulamentul (UE) 2016/679:
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 space-y-1">
              <div className="font-display font-bold text-sm text-ink">
                Dreptul de Acces și Portabilitate (Art. 15 &amp; 20)
              </div>
              <p className="text-ink-muted leading-relaxed">
                Poți descărca instantaneu, într-un format structurat JSON, toate
                datele asociate contului tău (profil, listări, rezervări, plăți,
                facturi și recenzii).
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 space-y-1">
              <div className="font-display font-bold text-sm text-ink">
                Dreptul la Rectificare (Art. 16)
              </div>
              <p className="text-ink-muted leading-relaxed">
                Poți actualiza oricând numele, orașul, numărul de telefon,
                descrierea sau datele firmei direct din fișa ta de profil.
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 space-y-1">
              <div className="font-display font-bold text-sm text-ink">
                Dreptul la Ștergere / Anonimizare (Art. 17)
              </div>
              <p className="text-ink-muted leading-relaxed">
                Poți solicita anonimizarea completă și închiderea contului.
                Datele tale PII sunt șterse ireversibil, păstrându-se doar
                evidențele fiscale impuse de lege fără identificatori personali.
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 space-y-1">
              <div className="font-display font-bold text-sm text-ink">
                Dreptul de a Depune o Plângere (ANSPDCP)
              </div>
              <p className="text-ink-muted leading-relaxed">
                Ai dreptul de a te adresa Autorității Naționale de Supraveghere
                a Prelucrării Datelor cu Caracter Personal (
                <a
                  href="https://www.dataprotection.ro/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-ochre font-semibold hover:underline"
                >
                  dataprotection.ro
                </a>
                ).
              </p>
            </div>
          </div>

          {/* Card CTA către controalele GDPR din /profil */}
          <div className="rounded-xl border border-ochre/30 bg-ochre-light/50 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <h3 className="font-display text-sm font-bold text-ink">
                Exercită-ți drepturile GDPR direct din contul tău
              </h3>
              <p className="text-xs text-ink-muted">
                Descarcă arhiva datelor personale (JSON) sau solicită
                anonimizarea contului în secțiunea dedicată din Profil.
              </p>
            </div>
            <Link
              href="/profil#gdpr-privacy"
              className="catalog-btn-primary shrink-0 whitespace-nowrap"
            >
              Deschide Controale GDPR &rarr;
            </Link>
          </div>
        </section>
      </article>
    </div>
  );
}
