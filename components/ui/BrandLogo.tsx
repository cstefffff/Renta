import Link from "next/link";

/**
 * Componenta BrandLogo — Identitatea vizuală modernă RentA Store.
 *
 * Explicație pentru C/Java:
 * În React, o componentă primește un obiect de configurare `props`
 * (similar cu un DTO în Java) și returnează marcaj declarativ JSX.
 * Folosește simbolul SVG geometric oficial RentA (hexagon Emerald Teal `#109E82`
 * cu litera stilizată `R` în interior) + wordmark-ul `RentA`.
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
      aria-label="RentA — Pagina principală"
    >
      {/* Simbolul vector minimalist RentA (hexagon/cub geometric în Emerald Teal #109E82) */}
      <span className="w-9 h-9 inline-flex items-center justify-center shrink-0 transition-transform duration-200 group-hover:scale-105">
        <svg
          className="w-9 h-9 drop-shadow-xs"
          viewBox="0 0 40 40"
          fill="none"
          aria-hidden="true"
        >
          <polygon
            points="20,2 36,11 36,29 20,38 4,29 4,11"
            className="fill-ochre group-hover:fill-ochre-hover transition-colors"
          />
          <path
            d="M20 2l16 9-16 9-16-9 16-9z"
            fill="#FFFFFF"
            fillOpacity="0.12"
          />
          <path
            d="M14 29V11h7.2c3.2 0 5.3 1.8 5.3 4.8 0 2.3-1.4 4-3.6 4.5L26.8 29h-3.8l-3.4-8.1H17.4V29H14zm3.4-11h3.6c1.5 0 2.4-.8 2.4-2.1s-.9-2.1-2.4-2.1h-3.6V18z"
            fill="#FFFFFF"
          />
        </svg>
      </span>

      {!iconOnly && (
        <div className="flex items-center gap-2">
          {/* Wordmark-ul oficial RentA — dimensiune mărită și accente în culorile siglei */}
          <span className="font-display text-2xl font-black tracking-tight leading-none text-ink flex items-baseline">
            <span>Rent</span>
            <span className="text-ochre">A</span>
            <span
              className="ml-0.5 inline-block w-1.5 h-1.5 rounded-full bg-ochre"
              aria-hidden="true"
            />
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
