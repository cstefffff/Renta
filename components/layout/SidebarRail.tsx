"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Suspense } from "react";

/**
 * Bara laterală verticală cu iconițe (`SidebarRail.tsx`).
 *
 * Explicație pentru C/Java:
 * - Aceasta este o componentă Client (`"use client"`) deoarece folosește hook-ul
 *   `usePathname()` pentru a citi ruta activă din browser și a evidenția
 *   butonul corespunzător (similar cu un observer pe starea router-ului).
 * - Împachetăm lista de linkuri într-un `<Suspense>` intern ca să putem citi
 *   în siguranță și query string-ul (`?segment=individual` / `?segment=company`)
 *   fără a bloca prerandarea statică a paginilor din Next.js.
 */
function SidebarNavLinks() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentSegment = searchParams?.get("segment");

  const isHome = pathname === "/";
  const isCatalogAll = pathname === "/catalog" && !currentSegment;
  const isSegmentP2P =
    pathname === "/catalog" && currentSegment === "individual";
  const isSegmentCompany =
    pathname === "/catalog" && currentSegment === "company";
  const isMyListings = pathname?.startsWith("/listarile-mele") ?? false;
  const isMyBookings = pathname?.startsWith("/rezervarile-mele") ?? false;

  const navItemClass = (active: boolean) =>
    `w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${
      active
        ? "bg-ochre-light text-ochre shadow-xs"
        : "text-ink-muted hover:bg-slate-100 hover:text-ink"
    }`;

  return (
    <nav
      aria-label="Navigație principală laterală"
      className="flex flex-col items-center gap-2"
    >
      {/* 1. Acasă / Dashboard */}
      <Link
        href="/"
        title="Acasă — RentA Store"
        aria-label="Acasă — RentA Store"
        className={navItemClass(isHome)}
      >
        <svg
          className="w-5 h-5"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.9"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <rect x="3" y="3" width="7" height="9" rx="1.5" />
          <rect x="14" y="3" width="7" height="5" rx="1.5" />
          <rect x="14" y="12" width="7" height="9" rx="1.5" />
          <rect x="3" y="16" width="7" height="5" rx="1.5" />
        </svg>
      </Link>

      {/* 2. Catalog Produse */}
      <Link
        href="/catalog"
        title="Catalog Produse"
        aria-label="Catalog Produse"
        className={navItemClass(isCatalogAll)}
      >
        <svg
          className="w-5 h-5"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.9"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
          <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
          <line x1="12" y1="22.08" x2="12" y2="12" />
        </svg>
      </Link>

      {/* 3. Segment P2P (Comunitate) */}
      <Link
        href="/catalog?segment=individual"
        title="Segment P2P — Închirieri de la Comunitate"
        aria-label="Segment P2P — Închirieri de la Comunitate"
        className={navItemClass(isSegmentP2P)}
      >
        <svg
          className="w-5 h-5"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.9"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
      </Link>

      {/* 4. Segment Firme (B2C) */}
      <Link
        href="/catalog?segment=company"
        title="Segment Firme — Centre & Firme Verificate"
        aria-label="Segment Firme — Centre & Firme Verificate"
        className={navItemClass(isSegmentCompany)}
      >
        <svg
          className="w-5 h-5"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.9"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M3 9l1.5-5h15L21 9" />
          <path d="M3 9a3 3 0 0 0 6 0 3 3 0 0 0 6 0 3 3 0 0 0 6 0" />
          <path d="M5 12v8a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-8" />
          <path d="M9 21v-6h6v6" />
        </svg>
      </Link>

      {/* 5. Inventarul Meu */}
      <Link
        href="/listarile-mele"
        title="Inventarul Meu — Obiecte Listate"
        aria-label="Inventarul Meu — Obiecte Listate"
        className={navItemClass(isMyListings)}
      >
        <svg
          className="w-5 h-5"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.9"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
          <line x1="3" y1="6" x2="21" y2="6" />
          <path d="M16 10a4 4 0 0 1-8 0" />
        </svg>
      </Link>

      {/* 6. Rezervările Mele */}
      <Link
        href="/rezervarile-mele"
        title="Rezervările Mele — Cereri & Închirieri"
        aria-label="Rezervările Mele — Cereri & Închirieri"
        className={navItemClass(isMyBookings)}
      >
        <svg
          className="w-5 h-5"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.9"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
          <line x1="16" y1="2" x2="16" y2="6" />
          <line x1="8" y1="2" x2="8" y2="6" />
          <line x1="3" y1="10" x2="21" y2="10" />
          <path d="M9 16l2 2 4-4" />
        </svg>
      </Link>
    </nav>
  );
}

export function SidebarRail() {
  const pathname = usePathname();
  const isStatusDb = pathname?.startsWith("/status-db") ?? false;
  const isProfile = pathname?.startsWith("/profil") ?? false;

  return (
    <aside
      aria-label="Bară laterală aplicație"
      className="hidden md:flex w-16 flex-col items-center justify-between py-4 bg-white border-r border-slate-200 shrink-0 sticky top-0 h-dvh z-40"
    >
      {/* Partea de sus: Brand Icon + Buton Adaugă Obiect (+) */}
      <div className="flex flex-col items-center gap-4">
        <Link
          href="/"
          title="RentA Store — Acasă"
          aria-label="RentA Store — Acasă"
          className="w-10 h-10 rounded-full bg-ochre text-white flex items-center justify-center shadow-sm hover:bg-ochre-hover transition-colors"
        >
          <svg
            className="w-5 h-5"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M12 3l8 4.5v9L12 21l-8-4.5v-9L12 3z" />
            <path d="M12 12l8-4.5" />
            <path d="M12 12v9" />
            <path d="M12 12L4 7.5" />
          </svg>
        </Link>

        <Link
          href="/listarile-mele/nou"
          title="Adaugă un obiect nou la închiriat"
          aria-label="Adaugă un obiect nou la închiriat"
          className="w-10 h-10 rounded-xl bg-ochre text-white hover:bg-ochre-hover shadow-sm flex items-center justify-center transition-all"
        >
          <svg
            className="w-5 h-5"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        </Link>
      </div>

      {/* Mijloc: Navigația cu iconițe */}
      <Suspense fallback={<div className="flex-1" />}>
        <SidebarNavLinks />
      </Suspense>

      {/* Partea de jos: Diagnostic DB, Setări Profil & Avatar Utilizator */}
      <div className="flex flex-col items-center gap-2.5">
        <Link
          href="/status-db"
          title="Status & Diagnostic Bază de Date"
          aria-label="Status & Diagnostic Bază de Date"
          className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${
            isStatusDb
              ? "bg-ochre-light text-ochre"
              : "text-ink-muted hover:bg-slate-100 hover:text-ink"
          }`}
        >
          <svg
            className="w-5 h-5"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.9"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="16" x2="12" y2="12" />
            <line x1="12" y1="8" x2="12.01" y2="8" />
          </svg>
        </Link>

        <Link
          href="/profil"
          title="Setări Profil & Identitate"
          aria-label="Setări Profil & Identitate"
          className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${
            isProfile
              ? "bg-ochre-light text-ochre"
              : "text-ink-muted hover:bg-slate-100 hover:text-ink"
          }`}
        >
          <svg
            className="w-5 h-5"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.9"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
        </Link>

        {/* Avatar rotund utilizator jos de tot */}
        <Link
          href="/profil"
          title="Contul Meu RentA"
          aria-label="Contul Meu RentA"
          className="mt-1 w-9 h-9 rounded-full bg-ochre-light border-2 border-ochre/30 text-ochre font-display font-bold text-xs flex items-center justify-center hover:border-ochre transition-colors"
        >
          RO
        </Link>
      </div>
    </aside>
  );
}
