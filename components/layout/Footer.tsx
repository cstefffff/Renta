import Link from "next/link";

/**
 * Subsolul modern al aplicației (`Footer.tsx` — Server Component).
 * Afișează metadatele platformei, linkurile legale obligatorii (Termeni,
 * Confidențialitate GDPR, Politica Cookie), linkurile obligatorii ANPC — SAL
 * și SOL / ODR UE, orașele active și linkul de diagnostic `/status-db` în development.
 */
export function Footer() {
  const isDev = process.env.NODE_ENV !== "production";

  return (
    <footer className="border-t border-slate-200 bg-white mt-16 print:hidden">
      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          {/* Stânga: Brand & descriere */}
          <div className="space-y-1.5">
            <div className="flex items-center gap-2.5 text-sm">
              <span className="font-display font-bold text-ink">
                Rent<span className="text-ochre">A</span> Store
              </span>
              <span className="inline-flex items-center rounded-full bg-ochre-light px-2.5 py-0.5 text-[11px] font-semibold text-ochre">
                v2.0 Storefront Ready
              </span>
            </div>
            <p className="text-xs text-ink-muted font-sans">
              Marketplace hibrid de închirieri echipamente și obiecte:
              Peer-to-Peer &amp; Firme Locale Verificate (RLS &amp; GDPR
              Hardened).
            </p>
          </div>

          {/* Dreapta: orașe pilot și link-uri rapide */}
          <div className="flex flex-wrap items-center gap-3 text-xs font-medium">
            <Link
              href="/catalog"
              className="text-ink-muted hover:text-ochre transition-colors"
            >
              Catalog Produse
            </Link>
            <span className="text-slate-300">&bull;</span>
            <Link
              href="/listarile-mele/nou"
              className="text-ink-muted hover:text-ochre transition-colors"
            >
              Adaugă Obiect
            </Link>
            <span className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1 text-ink-muted">
              București &bull; Cluj &bull; Timișoara &bull; Iași &bull; Brașov
            </span>
            {isDev && (
              <Link
                href="/status-db"
                className="rounded-lg bg-ochre-light/60 px-2.5 py-1 font-mono text-[11px] text-ochre hover:bg-ochre-light transition-colors"
              >
                Diagnostic DB
              </Link>
            )}
          </div>
        </div>

        {/* Rândul 2: Linkuri Legale (GDPR) & Protecția Consumatorilor (ANPC / SOL UE) */}
        <div className="border-t border-slate-100 pt-5 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 text-xs">
          {/* Linkuri legale interne */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-ink-muted">
            <Link
              href="/termeni-si-conditii"
              className="hover:text-ochre transition-colors font-medium"
            >
              Termeni și Condiții
            </Link>
            <span className="text-slate-300">&bull;</span>
            <Link
              href="/confidentialitate"
              className="hover:text-ochre transition-colors font-medium"
            >
              Politica de Confidențialitate (GDPR)
            </Link>
            <span className="text-slate-300">&bull;</span>
            <Link
              href="/politica-cookie"
              className="hover:text-ochre transition-colors font-medium"
            >
              Politica Cookie
            </Link>
          </div>

          {/* Linkuri obligatorii România: ANPC — SAL și SOL / ODR UE */}
          <div className="flex flex-wrap items-center gap-2.5">
            <a
              href="https://anpc.ro/ce-este-sal/"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-[11px] font-semibold text-ink hover:border-ochre hover:text-ochre transition-colors"
            >
              <span>ANPC — SAL (Soluționare Alternativă Litigii)</span>
              <span aria-hidden="true">&nearr;</span>
            </a>
            <a
              href="https://ec.europa.eu/consumers/odr"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-[11px] font-semibold text-ink hover:border-ochre hover:text-ochre transition-colors"
            >
              <span>SOL / ODR UE (Soluționare Online Litigii)</span>
              <span aria-hidden="true">&nearr;</span>
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
