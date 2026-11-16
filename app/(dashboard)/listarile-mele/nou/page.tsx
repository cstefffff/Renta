import Link from "next/link";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";
import { ListingForm } from "@/components/listings/ListingForm";

export const dynamic = "force-dynamic";

/**
 * Pagina de Adăugare Obiect Nou (`/listarile-mele/nou`) — Async Server Component.
 *
 * Verifică pe server dacă utilizatorul este autentificat, preia orașul său
 * implicit din tabela `public.profiles` și randează formularul de recepție
 * în inventar (`<ListingForm />`).
 */
export default async function AdaugaObiectPage() {
  if (!isSupabaseConfigured()) {
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12">
        <div className="catalog-card p-6 space-y-4">
          <div className="font-mono text-xs text-ochre font-bold">
            [CONFIGURARE NECESARĂ // #INV-CFG]
          </div>
          <h1 className="font-display text-2xl font-bold">
            Conexiunea Supabase nu este configurată
          </h1>
          <p className="text-sm text-ink-muted">
            Pentru a publica obiecte în catalog, configurează mai întâi cheile
            în <code className="font-mono">.env.local</code>.
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

  const user = authData?.user;

  if (!user) {
    return (
      <div className="max-w-xl mx-auto px-4 sm:px-6 py-14">
        <div className="catalog-card p-6 sm:p-8 space-y-4">
          <div className="font-mono text-xs text-ochre font-bold">
            [ACCES RESTRICȚIONAT // #INV-401]
          </div>
          <h1 className="font-display text-2xl font-bold text-ink">
            Autentificare necesară pentru listare
          </h1>
          <p className="text-sm text-ink-muted">
            Trebuie să fii autentificat în contul tău (Persoană Fizică sau Firmă
            de Închirieri) pentru a adăuga un obiect în inventar.
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

  const { data: profile } = supabase
    ? await supabase
        .from("profiles")
        .select("city, account_type, full_name")
        .eq("id", user.id)
        .maybeSingle()
    : { data: null };

  const defaultCity =
    profile?.city || (user.user_metadata?.city as string) || "București";

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
        <span className="text-ink-muted">FORMULAR RECEPȚIE // #INV-NEW</span>
      </div>

      {/* Cardul Formularului */}
      <div className="catalog-card p-6 sm:p-8 space-y-6">
        <div className="border-b border-ink/20 pb-4 space-y-1">
          <div className="flex items-center justify-between font-mono text-xs text-ochre font-bold">
            <span>FIȘĂ NOUĂ DE CATALOG // PUBLIC.LISTINGS</span>
            <span>
              {profile?.account_type === "company"
                ? "CONT FIRMĂ (B2C)"
                : "CONT P2P"}
            </span>
          </div>
          <h1 className="font-display text-2xl sm:text-3xl font-extrabold text-ink">
            Adaugă Obiect în Inventar
          </h1>
          <p className="text-xs text-ink-muted">
            Completează specificațiile tehnice, tariful pe zi și încarcă până la
            4 fotografii clare ale obiectului.
          </p>
        </div>

        <ListingForm defaultCity={defaultCity} />
      </div>
    </div>
  );
}
