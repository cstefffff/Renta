import Link from "next/link";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";
import { getListingByIdAction } from "@/app/actions/listings";
import { ListingForm } from "@/components/listings/ListingForm";

export const dynamic = "force-dynamic";

/**
 * Pagina de Editare Obiect (`/listarile-mele/[id]/editeaza`) — Async Server Component.
 *
 * Verifică pe server că utilizatorul este autentificat și că este proprietarul
 * de drept al anunțului (`listing.owner_id === user.id`), apoi randează
 * `<ListingForm mode="edit" initialListing={listing} />`.
 */
interface EditListingPageProps {
  params: Promise<{ id: string }>;
}

export default async function EditListingPage({ params }: EditListingPageProps) {
  const { id } = await params;

  if (!isSupabaseConfigured()) {
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12">
        <div className="catalog-card p-6 space-y-4">
          <div className="font-mono text-xs text-ochre font-bold">
            [CONFIGURARE NECESARĂ]
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

  const user = authData?.user;

  if (!user) {
    return (
      <div className="max-w-xl mx-auto px-4 sm:px-6 py-14">
        <div className="catalog-card p-6 sm:p-8 space-y-4">
          <div className="font-mono text-xs text-ochre font-bold">
            [ACCES RESTRICȚIONAT // #EDT-401]
          </div>
          <h1 className="font-display text-2xl font-bold text-ink">
            Autentificare necesară pentru editare
          </h1>
          <Link href="/login" className="catalog-btn-primary">
            Autentificare &rarr;
          </Link>
        </div>
      </div>
    );
  }

  const listing = await getListingByIdAction(decodeURIComponent(id));

  if (!listing || listing.owner_id !== user.id) {
    return (
      <div className="max-w-xl mx-auto px-4 sm:px-6 py-14">
        <div className="catalog-card p-6 sm:p-8 space-y-4">
          <div className="font-mono text-xs text-ochre font-bold">
            [FIȘĂ INACCESIBILĂ // #EDT-403]
          </div>
          <h1 className="font-display text-2xl font-bold text-ink">
            Obiectul nu a fost găsit sau nu îți aparține
          </h1>
          <p className="text-xs text-ink-muted">
            Poți edita doar obiectele pe care le-ai înregistrat din propriul tău
            cont în catalogul RentA.
          </p>
          <Link href="/listarile-mele" className="catalog-btn-secondary">
            &larr; Înapoi la Inventarul Meu
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10 space-y-6">
      {/* Bară de navigare înapoi */}
      <div className="flex items-center justify-between font-mono text-xs">
        <Link
          href="/listarile-mele"
          className="text-ink-muted hover:text-ink underline underline-offset-4"
        >
          &larr; Înapoi la Inventarul Meu
        </Link>
        <span className="text-ink-muted">
          EDITARE FIȘĂ // {listing.catalog_code}
        </span>
      </div>

      <div className="catalog-card p-6 sm:p-8 space-y-6">
        <div className="border-b border-ink/20 pb-4 space-y-1">
          <div className="flex items-center justify-between font-mono text-xs text-ochre font-bold">
            <span>ACTUALIZARE FIȘĂ DE INVENTAR // {listing.catalog_code}</span>
            <Link
              href={`/obiect/${listing.id}`}
              className="underline hover:text-ink"
            >
              Vezi Pagina Publică &rarr;
            </Link>
          </div>
          <h1 className="font-display text-2xl sm:text-3xl font-extrabold text-ink">
            Editează: {listing.title}
          </h1>
          <p className="text-xs text-ink-muted">
            Modifică tarifele, garanția, condițiile de anulare sau actualizează
            fotografiile atașate.
          </p>
        </div>

        <ListingForm
          mode="edit"
          initialListing={listing}
          defaultCity={listing.city}
        />
      </div>
    </div>
  );
}
