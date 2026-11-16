import Link from "next/link";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";
import { getMyListingsAction } from "@/app/actions/listings";
import {
  MyListingCard,
  type MyListingItem,
} from "@/components/listings/MyListingCard";

export const dynamic = "force-dynamic";

/**
 * Pagina „Inventarul Meu” (`/listarile-mele`) — Async Server Component.
 *
 * Explicație pentru C/Java:
 * Această pagină se execută integral pe server la fiecare accesare (`force-dynamic`),
 * interoghează obiectele proprietarului curent prin `getMyListingsAction()` și
 * trimite fiecare obiect către componenta interactivă `<MyListingCard />`.
 */
export default async function ListarileMelePage() {
  if (!isSupabaseConfigured()) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-12">
        <div className="catalog-card p-6 space-y-4">
          <div className="font-mono text-xs text-ochre font-bold">
            [CONFIGURARE NECESARĂ // #INV-00]
          </div>
          <h1 className="font-display text-2xl font-bold">
            Conexiunea Supabase nu este activă
          </h1>
          <p className="text-sm text-ink-muted">
            Configurează cheile Supabase în{" "}
            <code className="font-mono">.env.local</code> pentru a gestiona
            inventarul de obiecte.
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
        <div className="catalog-card p-6 sm:p-8 space-y-4">
          <div className="font-mono text-xs text-ochre font-bold">
            [ACCES RESTRICȚIONAT // #INV-401]
          </div>
          <h1 className="font-display text-2xl font-bold text-ink">
            Autentifică-te pentru a vedea inventarul tău
          </h1>
          <p className="text-sm text-ink-muted">
            Această secțiune afișează fișele de obiecte pe care le-ai publicat
            spre închiriere.
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

  const rawResult = await getMyListingsAction();
  const listings: MyListingItem[] = Array.isArray(rawResult)
    ? (rawResult as unknown as MyListingItem[])
    : [];

  const availableCount = listings.filter(
    (item) => item.status === "available"
  ).length;

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10 space-y-8">
      {/* Antetul Inventarului Propriu */}
      <div className="catalog-card p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 font-mono text-xs">
            <span className="text-ochre font-bold">
              REGISTRU PROPRIETAR // #INV-OWN
            </span>
            <span className="text-ink-muted">|</span>
            <span className="text-ink">
              TOTAL FIȘE: <strong>{listings.length}</strong> (DISPONIBILE:{" "}
              <strong>{availableCount}</strong>)
            </span>
          </div>
          <h1 className="font-display text-2xl sm:text-3xl font-extrabold text-ink">
            Inventarul Meu de Obiecte
          </h1>
          <p className="text-xs text-ink-muted">
            Gestionează disponibilitatea echipamentelor tale sau adaugă fișe noi
            în catalogul public.
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <Link href="/listarile-mele/nou" className="catalog-btn-primary">
            + Adaugă Obiect în Inventar
          </Link>
        </div>
      </div>

      {/* Lista de obiecte sau Empty State */}
      {listings.length === 0 ? (
        <div className="catalog-card p-10 text-center space-y-4">
          <div className="inline-block font-mono text-xs px-3 py-1 bg-cream-dark border border-ink/20 text-ink-muted">
            [INVENTAR GOL // 0 OBIECTE ÎNREGISTRATE]
          </div>
          <h2 className="font-display text-xl font-bold text-ink">
            Nu ai adăugat încă niciun obiect spre închiriere
          </h2>
          <p className="text-sm text-ink-muted max-w-md mx-auto">
            Publică prima ta fișă de echipament (unealtă, aparat foto, cort,
            echipament audio etc.) pentru a o face vizibilă în catalogul RentA.
          </p>
          <div className="pt-2">
            <Link href="/listarile-mele/nou" className="catalog-btn-primary">
              + Creează Prima Fișă de Obiect
            </Link>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {listings.map((item) => (
            <MyListingCard key={item.id} item={item} />
          ))}
        </div>
      )}
    </div>
  );
}
