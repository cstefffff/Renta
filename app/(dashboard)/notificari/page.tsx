import Link from "next/link";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";
import { getMyNotificationsAction } from "@/app/actions/notifications";
import { NotificationsPageClient } from "@/components/notifications/NotificationsPageClient";

export const dynamic = "force-dynamic";

/**
 * Pagina Centru de Notificări (`/notificari`) — Async Server Component.
 *
 * Explicație pentru dezvoltatori C / Java:
 * - Rulează pe server la fiecare accesare (datorită `force-dynamic`), verifică
 *   sesiunea Supabase activă și încarcă ultimele 50 de notificări ale contului
 *   prin `getMyNotificationsAction(50)`.
 * - Pasează rezultatul către `<NotificationsPageClient />` pentru filtrare rapidă
 *   și marcarea notificărilor ca citite fără reîncărcarea paginii.
 */
export default async function NotificariPage() {
  if (!isSupabaseConfigured()) {
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12">
        <div className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-sm space-y-4">
          <div className="font-mono text-xs text-ochre font-bold">
            [CONFIGURARE NECESARĂ // #NOTIF-00]
          </div>
          <h1 className="font-display text-2xl font-bold text-ink">
            Conexiunea Supabase nu este activă
          </h1>
          <p className="text-sm text-ink-muted">
            Configurează cheile Supabase în{" "}
            <code className="font-mono">.env.local</code> pentru a accesa
            centrul de notificări.
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
            [ACCES RESTRICȚIONAT // #NOTIF-401]
          </div>
          <h1 className="font-display text-2xl font-bold text-ink">
            Autentifică-te pentru a vedea notificările tale
          </h1>
          <p className="text-sm text-ink-muted">
            Centrul de notificări afișează alertele despre rezervări, plăți
            Escrow, recenzii și dispute aferente contului tău RentA.
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

  const result = await getMyNotificationsAction(50);

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10 space-y-6">
      {/* Breadcrumb & Navigare Rapidă */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <nav
          aria-label="Breadcrumb"
          className="flex items-center gap-2 text-xs font-medium text-ink-muted"
        >
          <Link href="/" className="hover:text-ochre transition-colors">
            RentA Store
          </Link>
          <span aria-hidden="true" className="text-slate-400">
            &rsaquo;
          </span>
          <span className="text-ink font-semibold">Notificări</span>
        </nav>

        <Link href="/rezervarile-mele" className="catalog-btn-secondary text-xs">
          Mergi la Rezervări &rarr;
        </Link>
      </div>

      {/* Antet Pagină */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <span className="font-mono text-xs font-bold uppercase text-ochre">
            CENTRU DE NOTIFICĂRI &amp; ALERTE // #NOTIF-CENTER
          </span>
          <h1 className="font-display text-2xl sm:text-3xl font-extrabold text-ink">
            Notificările Mele
          </h1>
          <p className="text-sm text-ink-muted">
            Urmărește în timp real cererile de rezervare, confirmările de plată
            Escrow, recenziile primite și actualizările de dispute.
          </p>
        </div>

        <Link
          href="/profil"
          className="catalog-btn-secondary shrink-0 whitespace-nowrap"
        >
          Profil &amp; Setări
        </Link>
      </div>

      {/* Listă interactivă & Status livrare */}
      <NotificationsPageClient
        initialNotifications={result.notifications}
        initialUnreadCount={result.unreadCount}
        migrationMissing={result.migrationMissing}
        emailMode={result.emailMode}
      />
    </div>
  );
}
