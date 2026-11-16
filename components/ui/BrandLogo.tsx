import Link from "next/link";

/**
 * Componenta BrandLogo — Identitatea vizuală modernă RentA Store.
 *
 * Explicație pentru C/Java:
 * În React, o componentă primește un obiect de configurare `props`
 * (similar cu un DTO în Java) și returnează marcaj declarativ JSX.
 * Poate fi afișată atât în modul complet (cu nume și breadcrumb/tag),
 * cât și compact (doar pictograma circulară în bara laterală).
 */
interface BrandLogoProps {
  showTag?: boolean;
  iconOnly?: boolean;
}

export function BrandLogo({ showTag = true, iconOnly = false }: BrandLogoProps) {
  return (
    <Link
      href="/"
      className="group inline-flex items-center gap-2.5 focus:outline-none"
      aria-label="RentA Store — Pagina principală"
    >
      {/* Pictograma circulară verde-smarald (#109E82) inspirată din designul de referință */}
      <span className="w-9 h-9 rounded-full bg-ochre text-white inline-flex items-center justify-center shadow-sm group-hover:bg-ochre-hover transition-colors shrink-0">
        <svg
          className="w-5 h-5"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M12 3l8 4.5v9L12 21l-8-4.5v-9L12 3z" />
          <path d="M12 12l8-4.5" />
          <path d="M12 12v9" />
          <path d="M12 12L4 7.5" />
        </svg>
      </span>

      {!iconOnly && (
        <div className="flex items-center gap-2">
          {/* Numele brandului într-un stil modern curat */}
          <span className="font-display text-lg font-bold tracking-tight text-ink">
            Rent<span className="text-ochre">A</span>{" "}
            <span className="font-semibold text-ink">Store</span>
          </span>

          {/* Etichetă opțională discretă */}
          {showTag && (
            <span className="hidden lg:inline-flex items-center rounded-md bg-ochre-light px-2 py-0.5 text-[11px] font-medium text-ochre">
              RO Marketplace
            </span>
          )}
        </div>
      )}
    </Link>
  );
}
