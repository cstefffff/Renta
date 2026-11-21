import Link from "next/link";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";
import { getInvoiceByIdAction } from "@/app/actions/legal";
import { generateEFacturaXmlPreview } from "@/lib/invoicing/provider";
import { InvoicePrintClient } from "@/components/payments/InvoicePrintClient";

export const dynamic = "force-dynamic";

interface InvoiceDetailPageProps {
  params: Promise<{ id: string }>;
}

/**
 * Pagina de Vizualizare & Imprimare Factură Fiscală (`/profil/facturi/[id]`) — Async Server Component.
 *
 * Explicație pentru dezvoltatori C / Java:
 * - Verifică sesiunea autentificată pe server și încarcă factura prin `getInvoiceByIdAction(id)`
 *   (protejată de RLS: doar ofertantul sau chiriașul asociat o poate citi).
 * - Generează pe server preview-ul XML UBL 2.1 (RO e-Factura) și pasează datele
 *   către componenta interactivă `<InvoicePrintClient />`.
 */
export default async function InvoiceDetailPage({
  params,
}: InvoiceDetailPageProps) {
  if (!isSupabaseConfigured()) {
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12">
        <div className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-sm space-y-4">
          <div className="font-mono text-xs text-ochre font-bold">
            [CONFIGURARE NECESARĂ // #INV-00]
          </div>
          <h1 className="font-display text-2xl font-bold text-ink">
            Conexiunea Supabase nu este activă
          </h1>
          <p className="text-sm text-ink-muted">
            Configurează cheile Supabase în{" "}
            <code className="font-mono">.env.local</code> pentru a vizualiza
            facturile fiscale.
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
            [ACCES RESTRICȚIONAT // #INV-401]
          </div>
          <h1 className="font-display text-2xl font-bold text-ink">
            Autentifică-te pentru a vizualiza factura
          </h1>
          <p className="text-sm text-ink-muted">
            Documentele fiscale sunt protejate prin Row Level Security (RLS) și
            sunt accesibile doar părților implicate în tranzacție.
          </p>
          <div className="flex items-center gap-3 pt-2">
            <Link href="/login" className="catalog-btn-primary">
              Autentificare
            </Link>
            <Link href="/profil/plati" className="catalog-btn-secondary">
              Înapoi la Plăți
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const { id } = await params;
  const decodedId = decodeURIComponent(id);
  const invoice = await getInvoiceByIdAction(decodedId);

  if (!invoice) {
    return (
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-14">
        <div className="bg-white border border-slate-200/90 rounded-2xl p-6 sm:p-8 shadow-sm space-y-4 text-center">
          <div className="font-mono text-xs text-ochre font-bold">
            [FACTURĂ INEXISTENTĂ SAU ACCES REFUZAT // #INV-404]
          </div>
          <h1 className="font-display text-2xl font-bold text-ink">
            Nu am găsit factura solicitată
          </h1>
          <p className="text-sm text-ink-muted">
            Factura nu există sau nu aparține contului tău autentificat.
          </p>
          <div className="pt-2">
            <Link href="/profil/plati" className="catalog-btn-primary">
              &larr; Înapoi la Plăți &amp; Facturi
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const xmlPreview = generateEFacturaXmlPreview(invoice);

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 sm:py-10 print:p-0 print:max-w-none">
      <InvoicePrintClient invoice={invoice} xmlPreview={xmlPreview} />
    </div>
  );
}
