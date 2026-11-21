import Link from "next/link";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import {
  getBookingDetailForParticipantAction,
  getHandoverProofsAction,
} from "@/app/actions/trust";
import { HandoverProtocolClient } from "@/components/bookings/HandoverProtocolClient";

export const dynamic = "force-dynamic";

/**
 * Pagina Proces-Verbal Digital PDF & Protocol Foto (`/rezervarile-mele/[id]/proces-verbal`).
 *
 * Explicație pentru C/Java:
 * Server Component asincron care încarcă în paralel detaliile rezervării
 * (`getBookingDetailForParticipantAction`) și dovezile foto (`getHandoverProofsAction`),
 * verificând pe server că utilizatorul logat este fie ofertantul, fie chiriașul.
 */
export default async function ProcesVerbalPage({
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

  const [booking, proofsRes] = await Promise.all([
    getBookingDetailForParticipantAction(id),
    getHandoverProofsAction(id),
  ]);

  if (!booking) {
    return (
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-14">
        <div className="catalog-card p-6 sm:p-8 space-y-4">
          <div className="font-mono text-xs text-ochre font-bold">
            [ACCES RESTRICȚIONAT // #PV-404]
          </div>
          <h1 className="font-display text-2xl font-bold text-ink">
            Rezervarea nu a fost găsită sau nu ai acces la ea
          </h1>
          <p className="text-sm text-ink-muted">
            Procesul-Verbal de Predare-Primire și dovezile foto sunt vizibile
            exclusiv participanților implicați în rezervare (ofertant și chiriaș).
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
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 sm:py-10">
      <HandoverProtocolClient
        booking={booking}
        initialProofs={proofsRes.proofs}
        migrationMissing={proofsRes.migrationMissing}
      />
    </div>
  );
}
