import Link from "next/link";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";
import {
  getMyPayoutAccountAction,
  getPaymentsForMyBookingsAction,
} from "@/app/actions/payments";
import { getMyInvoicesAction } from "@/app/actions/legal";
import { PayoutOnboardingPanel } from "@/components/payments/PayoutOnboardingPanel";

export const dynamic = "force-dynamic";

/**
 * Pagina de Plăți, Încasări & Stripe Connect (`/profil/plati`) — Async Server Component.
 *
 * Explicație pentru dezvoltatori C / Java:
 * - Această pagină rulează exclusiv pe server (ca un Controller Spring Boot / SSR).
 * - Încarcă în paralel (`Promise.all`) contul de încasări al utilizatorului și
 *   istoricul tranzacțiilor Escrow, apoi pasează datele pre-încărcate către
 *   componenta interactivă `<PayoutOnboardingPanel />`.
 */
export default async function ProfilPlatiPage() {
  if (!isSupabaseConfigured()) {
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12">
        <div className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-sm space-y-4">
          <div className="font-mono text-xs text-ochre font-bold">
            [CONFIGURARE NECESARĂ // #PAY-00]
          </div>
          <h1 className="font-display text-2xl font-bold text-ink">
            Conexiunea Supabase nu este activă
          </h1>
          <p className="text-sm text-ink-muted">
            Configurează cheile Supabase în{" "}
            <code className="font-mono">.env.local</code> pentru a accesa
            panoul de Plăți &amp; Încasări.
          </p>
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
        <div className="bg-white border border-slate-200/90 rounded-2xl p-6 sm:p-8 shadow-sm space-y-4">
          <div className="font-mono text-xs text-ochre font-bold">
            [ACCES RESTRICȚIONAT // #PAY-401]
          </div>
          <h1 className="font-display text-2xl font-bold text-ink">
            Autentifică-te pentru a gestiona plățile
          </h1>
          <p className="text-sm text-ink-muted">
            Pentru a configura contul de încasări și a consulta istoricul
            garanțiilor Escrow, autentifică-te în contul tău RentA.
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

  // Încărcăm în paralel contul de încasări, tranzacțiile și facturile de comision SRL
  const [payoutResult, paymentsResult, invoicesResult] = await Promise.all([
    getMyPayoutAccountAction(),
    getPaymentsForMyBookingsAction(),
    getMyInvoicesAction(),
  ]);

  const migrationMissing = Boolean(
    payoutResult.migrationMissing || paymentsResult.migrationMissing
  );
  const invoicesMigrationMissing = Boolean(invoicesResult.migrationMissing);

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10 space-y-6">
      {/* Breadcrumb & Buton Înapoi */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <nav
          aria-label="Breadcrumb"
          className="flex items-center gap-2 text-xs font-medium text-ink-muted"
        >
          <Link href="/profil" className="hover:text-ochre transition-colors">
            Profil
          </Link>
          <span aria-hidden="true" className="text-slate-400">
            &rsaquo;
          </span>
          <span className="text-ink font-semibold">
            Plăți &amp; Încasări (Stripe Connect)
          </span>
        </nav>

        <Link href="/profil" className="catalog-btn-secondary text-xs">
          &larr; Înapoi la Profil
        </Link>
      </div>

      {/* Antet Pagină */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <span className="font-mono text-xs font-bold uppercase text-ochre">
            PLĂȚI, ÎNCASĂRI &amp; ESCROW // #PAY-CONNECT
          </span>
          <h1 className="font-display text-2xl sm:text-3xl font-extrabold text-ink">
            Plăți &amp; Încasări (Stripe Connect)
          </h1>
          <p className="text-sm text-ink-muted">
            Administrează contul bancar pentru încasările de proprietar și
            urmărește garanțiile protejate în sistemul Escrow RentA.
          </p>
        </div>

        <Link
          href="/rezervarile-mele"
          className="catalog-btn-secondary shrink-0 whitespace-nowrap"
        >
          Vezi Rezervările Mele &rarr;
        </Link>
      </div>

      {/* Panou Interactiv Onboarding, Registru Escrow & Facturi Comision SRL */}
      <PayoutOnboardingPanel
        mode={payoutResult.mode}
        initialAccount={payoutResult.account}
        payments={paymentsResult.payments}
        invoices={invoicesResult.invoices}
        invoicesMigrationMissing={invoicesMigrationMissing}
        migrationMissing={migrationMissing}
        currentUserId={authData.user.id}
      />
    </div>
  );
}
