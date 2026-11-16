import Link from "next/link";

/**
 * Pagina Globală 404 (`app/not-found.tsx`) — Server Component.
 */
export default function NotFoundPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-16">
      <div className="catalog-card p-8 sm:p-10 text-center space-y-5">
        <div className="inline-block font-mono text-xs px-3 py-1 bg-cream-dark border border-ink/30 text-ochre font-bold uppercase">
          [EROARE 404 // FIȘĂ SAU RUTĂ INEXISTENTĂ]
        </div>

        <h1 className="font-display text-3xl sm:text-4xl font-extrabold text-ink">
          Pagina solicitată nu există în catalogul RentA
        </h1>

        <p className="text-sm text-ink-muted max-w-md mx-auto leading-relaxed">
          Adresa URL pe care ai accesat-o nu corespunde niciunei secțiuni active
          sau anunțul a fost retras din inventar.
        </p>

        <div className="pt-2 flex flex-wrap items-center justify-center gap-3">
          <Link href="/catalog" className="catalog-btn-primary">
            Explorează Catalogul Public
          </Link>
          <Link href="/" className="catalog-btn-secondary">
            &larr; Înapoi la Pagina Principală
          </Link>
        </div>
      </div>
    </div>
  );
}
