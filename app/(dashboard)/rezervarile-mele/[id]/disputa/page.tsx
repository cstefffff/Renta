import Link from "next/link";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import {
  getBookingDetailForParticipantAction,
  getDisputeForBookingAction,
  getHandoverProofsAction,
} from "@/app/actions/trust";
import { DisputeFormClient } from "@/components/bookings/DisputeFormClient";

export const dynamic = "force-dynamic";

/**
 * Pagina Flux Dispute (`/rezervarile-mele/[id]/disputa`) — Async Server Component.
 *
 * Explicație pentru C/Java:
 * Încarcă în paralel detaliile rezervării, eventuala dispută existentă și
 * dovezile foto de Check-in/Check-out folosind `Promise.all(...)`, apoi pasează
 * datele ca `props` către componenta interactivă `DisputeFormClient`.
 */
export default async function DisputaPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  if (!isSupabaseConfigured()) {
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12">
        <div className="catalog-card p-6 space-y-3">
          <h1 className="font-display text-xl font-bold text-ink">
            Conexiunea Supabase nu este configurată
          </h1>
          <Link href="/status-db" className="catalog-btn-primary">
            Verifică Diagnostic DB &rarr;
          </Link>
        </div>
      </div>
    );
  }

  const [booking, disputeRes, proofsRes] = await Promise.all([
    getBookingDetailForParticipantAction(id),
    getDisputeForBookingAction(id),
    getHandoverProofsAction(id),
  ]);

  if (!booking) {
    return (
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-14">
        <div className="catalog-card p-6 sm:p-8 space-y-4">
          <div className="font-mono text-xs text-ochre font-bold">
            [ACCES RESTRICȚIONAT // #DSP-404]
          </div>
          <h1 className="font-display text-2xl font-bold text-ink">
            Rezervarea nu a fost găsită sau nu ai acces la ea
          </h1>
          <p className="text-sm text-ink-muted">
            Centrul de Dispute este accesibil exclusiv ofertantului și chiriașului
            implicați în această rezervare.
          </p>
          <div className="pt-2">
            <Link href="/rezervarile-mele" className="catalog-btn-primary">
              &larr; Înapoi la Rezervările Mele
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 sm:py-10">
      <DisputeFormClient
        booking={booking}
        initialDispute={disputeRes.dispute}
        proofs={proofsRes.proofs}
        migrationMissing={
          Boolean(disputeRes.migrationMissing) ||
          Boolean(proofsRes.migrationMissing)
        }
      />
    </div>
  );
}
