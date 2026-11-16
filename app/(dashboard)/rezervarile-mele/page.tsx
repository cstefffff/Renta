import Link from "next/link";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";
import { getMyBookingsAction } from "@/app/actions/bookings";
import { BookingCard } from "@/components/bookings/BookingCard";
import type { BookingWithDetails } from "@/lib/types/database";

export const dynamic = "force-dynamic";

/**
 * Pagina de Gestionare a Rezervărilor (`/rezervarile-mele`) — Async Server Component.
 *
 * Afișează două registre:
 * 1. Cereri Primite pentru Obiectele Mele (unde utilizatorul curent este `owner_id`)
 * 2. Cereri Trimise de Mine (unde utilizatorul curent este `renter_id`)
 */
export default async function RezervarileMelePage() {
  if (!isSupabaseConfigured()) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-12">
        <div className="catalog-card p-6 space-y-4">
          <div className="font-mono text-xs text-ochre font-bold">
            [CONFIGURARE NECESARĂ // #REZ-CFG]
          </div>
          <h1 className="font-display text-2xl font-bold">
            Conexiunea Supabase nu este configurată
          </h1>
          <Link href="/status-db" className="catalog-btn-primary">
            Mergi la Diagnostic DB &rarr;
          </Link>
        </div>
      </div>
    );
  }

  const supabase = await createClient();
  const { data: authData } = supabase
    ? await supabase.auth.getUser()
    : { data: { user: null } };

  if (!authData?.user) {
    return (
      <div className="max-w-xl mx-auto px-4 sm:px-6 py-14">
        <div className="catalog-card p-6 sm:p-8 space-y-4">
          <div className="font-mono text-xs text-ochre font-bold">
            [ACCES RESTRICȚIONAT // #REZ-401]
          </div>
          <h1 className="font-display text-2xl font-bold text-ink">
            Autentifică-te pentru a vedea rezervările tale
          </h1>
          <p className="text-sm text-ink-muted">
            În acest panou poți aproba cererile primite pentru obiectele tale și
            poți urmări statusul cererilor trimise către alți proprietari.
          </p>
          <div className="flex items-center gap-3 pt-2">
            <Link href="/login" className="catalog-btn-primary">
              Autentificare
            </Link>
            <Link href="/inregistrare" className="catalog-btn-secondary">
              Creează Cont Nou
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const rawResult = await getMyBookingsAction();
  const incoming: BookingWithDetails[] =
    rawResult && "incoming" in rawResult && Array.isArray(rawResult.incoming)
      ? rawResult.incoming
      : [];
  const outgoing: BookingWithDetails[] =
    rawResult && "outgoing" in rawResult && Array.isArray(rawResult.outgoing)
      ? rawResult.outgoing
      : [];

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10 space-y-10">
      {/* Antet Registru Rezervări */}
      <div className="catalog-card p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 font-mono text-xs">
            <span className="text-ochre font-bold uppercase">
              REGISTRU OPERAȚIUNI &amp; REZERVĂRI // #REZ-DASHBOARD
            </span>
          </div>
          <h1 className="font-display text-2xl sm:text-3xl font-extrabold text-ink">
            Rezervările Mele (Primite &amp; Trimise)
          </h1>
          <p className="text-xs text-ink-muted">
            Gestionează aprobarea cererilor pentru echipamentele tale și
            urmărește starea închirierilor solicitate.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <Link href="/catalog" className="catalog-btn-secondary">
            Explorează Catalogul
          </Link>
          <Link href="/listarile-mele" className="catalog-btn-primary">
            Inventarul Meu
          </Link>
        </div>
      </div>

      {/* Secțiunea 1: Cereri Primite (Rol: Proprietar / Ofertant) */}
      <section className="space-y-4">
        <div className="flex items-center justify-between border-b border-ink/20 pb-2">
          <h2 className="font-display text-xl font-bold text-ink">
            1. Cereri Primite pentru Obiectele Mele ({incoming.length})
          </h2>
          <span className="font-mono text-xs text-ochre font-bold">
            ROL: OFERTANT (OWNER)
          </span>
        </div>

        {incoming.length === 0 ? (
          <div className="catalog-card p-6 text-center space-y-2">
            <div className="font-mono text-xs text-ink-muted">
              [NICIO CERERE PRIMITĂ ÎNCĂ]
            </div>
            <p className="text-xs text-ink-muted">
              Când un chiriaș solicită unul dintre obiectele tale din catalog,
              cererea va apărea aici pentru aprobare.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {incoming.map((booking) => (
              <BookingCard key={booking.id} booking={booking} role="owner" />
            ))}
          </div>
        )}
      </section>

      {/* Secțiunea 2: Cereri Trimise de Mine (Rol: Chiriaș) */}
      <section className="space-y-4">
        <div className="flex items-center justify-between border-b border-ink/20 pb-2">
          <h2 className="font-display text-xl font-bold text-ink">
            2. Cereri de Închiriere Trimise de Mine ({outgoing.length})
          </h2>
          <span className="font-mono text-xs text-ink-muted">
            ROL: CHIRIAȘ (RENTER)
          </span>
        </div>

        {outgoing.length === 0 ? (
          <div className="catalog-card p-6 text-center space-y-3">
            <div className="font-mono text-xs text-ink-muted">
              [NICIO CERERE TRIMISĂ ÎNCĂ]
            </div>
            <p className="text-xs text-ink-muted">
              Alege un obiect din catalogul public și selectează perioada dorită
              pentru a trimite o cerere de rezervare.
            </p>
            <div>
              <Link href="/catalog" className="catalog-btn-secondary">
                Caută un Obiect în Catalog &rarr;
              </Link>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {outgoing.map((booking) => (
              <BookingCard key={booking.id} booking={booking} role="renter" />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
