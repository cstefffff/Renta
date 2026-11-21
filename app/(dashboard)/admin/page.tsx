import Link from "next/link";
import { getAdminDashboardDataAction } from "@/app/actions/admin";
import { AdminDashboardClient } from "@/components/admin/AdminDashboardClient";

export const dynamic = "force-dynamic";

/**
 * Pagina Panoului de Administrare (`/admin`) — Async Server Component.
 *
 * Explicație pentru dezvoltatori C / Java:
 * - Verificarea autorizării (`role === 'admin'` în `public.profile_private`) are loc
 *   exclusiv pe server în `getAdminDashboardDataAction()`.
 * - Dacă utilizatorul nu este admin (`!data.authorized`), nu expunem niciun fel de
 *   date operaționale către browser, ci randăm un ecran clar de tip 403 cu comanda SQL
 *   exactă prin care fondatorul își poate promova propriul cont în Supabase SQL Editor.
 */
export default async function AdminPage() {
  const data = await getAdminDashboardDataAction();

  if (!data.authorized) {
    const promoteSql = data.currentUserId
      ? `UPDATE public.profile_private SET role = 'admin' WHERE id = '${data.currentUserId}';`
      : null;

    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12">
        <div className="bg-white border border-slate-200/90 rounded-2xl p-6 sm:p-8 shadow-sm space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-50 border border-rose-200 text-rose-700 font-mono text-xs font-semibold">
              403 &bull; ACCES RESTRICȚIONAT
            </span>
            <span className="font-mono text-xs text-ink-muted">
              NECESITĂ ROL: admin
            </span>
          </div>

          <div className="space-y-2">
            <h1 className="font-display text-2xl sm:text-3xl font-extrabold text-ink">
              Acces Restricționat (403 — Necesită rol{" "}
              <code className="font-mono text-ochre">admin</code>)
            </h1>
            <p className="text-sm text-ink-muted leading-relaxed">
              Această zonă este rezervată exclusiv administratorilor platformei
              RentA pentru moderarea anunțurilor, aprobarea firmelor B2C (KYB)
              și soluționarea disputelor.
            </p>
          </div>

          {promoteSql ? (
            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-2.5">
              <p className="text-xs font-semibold text-ink">
                Ești fondatorul aplicației? Rulează comanda SQL de mai jos în{" "}
                <span className="text-ochre">Supabase SQL Editor</span> pentru a
                promova contul curent la rolul de administrator:
              </p>
              <pre className="p-3.5 rounded-xl bg-ink text-cream font-mono text-xs overflow-x-auto select-all">
                {promoteSql}
              </pre>
              <p className="text-[11px] text-ink-muted">
                După rularea comenzii SQL, reîncarcă această pagină (F5).
              </p>
            </div>
          ) : (
            <div className="p-4 rounded-xl border border-amber-200 bg-amber-50/70 text-xs text-amber-900">
              Nu ești autentificat în acest moment. Autentifică-te mai întâi cu
              contul tău de administrator.
            </div>
          )}

          <div className="pt-2 flex flex-wrap items-center gap-3">
            {!promoteSql && (
              <Link
                href="/login"
                className="px-5 py-2.5 rounded-xl bg-ochre hover:bg-ochre-hover text-white text-xs font-semibold shadow-xs transition-colors"
              >
                Autentificare în cont
              </Link>
            )}
            <Link
              href="/catalog"
              className="px-5 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-ink text-xs font-semibold transition-colors"
            >
              &larr; Înapoi la Catalogul Public
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return <AdminDashboardClient initialData={data} />;
}
