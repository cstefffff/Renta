import Link from "next/link";

/**
 * Subsolul modern al aplicației (`Footer.tsx` — Server Component).
 * Afișează metadatele platformei, orașele active și linkul de diagnostic `/status-db` în development.
 */
export function Footer() {
  const isDev = process.env.NODE_ENV !== "production";

  return (
    <footer className="border-t border-slate-200 bg-white mt-16">
      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
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
            <span className="text-slate-300">•</span>
            <Link
              href="/listarile-mele/nou"
              className="text-ink-muted hover:text-ochre transition-colors"
            >
              Adaugă Obiect
            </Link>
            <span className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1 text-ink-muted">
              București • Cluj • Timișoara • Iași • Brașov
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
      </div>
    </footer>
  );
}
