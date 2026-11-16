"use client";

import Link from "next/link";

/**
 * Boundary Global de Eroare (`app/error.tsx`) — Client Component obligatoriu în Next.js.
 *
 * Explicație pentru C/Java:
 * Echivalentul unui bloc global `try / catch (Exception e)` sau `@ControllerAdvice`
 * în Spring Boot care prinde orice excepție neașteptată în timpul randării unei
 * pagini și oferă utilizatorului un buton de recuperare (`reset()`).
 */
export default function GlobalErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-16">
      <div className="catalog-card p-8 sm:p-10 text-center space-y-5">
        <div className="inline-block font-mono text-xs px-3 py-1 bg-red-900/10 border border-red-800/40 text-red-950 font-bold uppercase">
          [EXCEPȚIE RUNTIME // #SYS-ERR]
        </div>

        <h1 className="font-display text-2xl sm:text-3xl font-extrabold text-ink">
          A apărut o eroare tehnică la încărcarea acestei secțiuni
        </h1>

        <p className="text-xs font-mono text-ink-muted max-w-md mx-auto">
          {error?.message || "Eroare neașteptată în comunicația cu serverul."}
        </p>

        <div className="pt-2 flex flex-wrap items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => reset()}
            className="catalog-btn-primary"
          >
            Încearcă din nou
          </button>
          <Link href="/" className="catalog-btn-secondary">
            Mergi la Pagina Principală
          </Link>
        </div>
      </div>
    </div>
  );
}
