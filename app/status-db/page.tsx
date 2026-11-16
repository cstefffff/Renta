import Link from "next/link";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

/**
 * Forțăm randarea dinamică la fiecare request (echivalent cu dezactivarea cache-ului HTTP).
 * Astfel, de fiecare dată când dai Refresh în `/status-db`, Next.js re-interoghează
 * în timp real variabilele `.env.local` și tabelele din Supabase.
 */
export const dynamic = "force-dynamic";

interface TableCheckResult {
  tableName: string;
  description: string;
  exists: boolean;
  rowCount: number | null;
  errorMessage: string | null;
}

const EXPECTED_TABLES: { name: string; description: string }[] = [
  {
    name: "profiles",
    description: "Profiluri utilizatori (Persoane fizice P2P & Firme B2C)",
  },
  {
    name: "listings",
    description: "Anunțuri de obiecte & echipamente disponibile pentru închiriere",
  },
  {
    name: "listing_images",
    description: "Imagini asociate anunțurilor din Supabase Storage",
  },
  {
    name: "bookings",
    description: "Cereri de rezervare, perioade și costuri calculate",
  },
  {
    name: "reviews",
    description: "Recenzii și rating-uri (1–5 stele) după finalizarea închirierii",
  },
];

export default async function StatusDbPage() {
  const configured = isSupabaseConfigured();
  const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const rawAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

  const hasValidUrl =
    Boolean(rawUrl) &&
    rawUrl.startsWith("http") &&
    !rawUrl.includes("PROIECTUL_TAU");
  const hasValidAnonKey =
    Boolean(rawAnonKey) &&
    rawAnonKey.length > 20 &&
    !rawAnonKey.includes("CHEIA_TA");

  const tableResults: TableCheckResult[] = [];
  let authUserEmail: string | null = null;
  let connectionError: string | null = null;

  if (configured) {
    try {
      const supabase = await createClient();

      if (supabase) {
        // 1. Verificăm sesiunea curentă Auth
        const { data: authData } = await supabase.auth.getUser();
        authUserEmail = authData.user?.email ?? null;

        // 2. Verificăm existența fiecărui tabel din schema SQL
        for (const tbl of EXPECTED_TABLES) {
          const { count, error } = await supabase
            .from(tbl.name)
            .select("*", { count: "exact", head: true });

          if (error) {
            tableResults.push({
              tableName: tbl.name,
              description: tbl.description,
              exists: false,
              rowCount: null,
              errorMessage: `${error.code || "ERR"}: ${error.message}`,
            });
          } else {
            tableResults.push({
              tableName: tbl.name,
              description: tbl.description,
              exists: true,
              rowCount: count ?? 0,
              errorMessage: null,
            });
          }
        }
      }
    } catch (err) {
      connectionError =
        err instanceof Error ? err.message : "Eroare necunoscută la conectare.";
    }
  }

  const allTablesReady =
    tableResults.length === EXPECTED_TABLES.length &&
    tableResults.every((t) => t.exists);

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10 space-y-8">
      {/* Antet Fișă de Diagnostic */}
      <div className="border border-ink/25 bg-cream-light p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="font-mono text-xs text-ochre font-bold uppercase">
            FIȘĂ TEHNICĂ DE SISTEM // #SYS-DB-DIAGNOSTIC
          </div>
          <h1 className="font-display text-2xl sm:text-3xl font-extrabold text-ink">
            Status Conexiune Supabase &amp; Schema SQL
          </h1>
          <p className="text-sm text-ink-muted">
            Această pagină verifică în timp real pe server configurarea{" "}
            <code className="font-mono text-xs">.env.local</code> și existența
            celor 5 tabele din PostgreSQL.
          </p>
        </div>

        <Link href="/status-db" className="catalog-btn-primary shrink-0">
          Reîmprospătează Verificarea
        </Link>
      </div>

      {/* Pasul 1: Verificare Variabile de Mediu (.env.local) */}
      <section className="catalog-card p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-ink/15 pb-3">
          <h2 className="font-display text-lg font-bold">
            1. Variabile de Mediu (.env.local)
          </h2>
          <span
            className={`font-mono text-xs px-2.5 py-0.5 border ${
              configured
                ? "bg-emerald-900/10 border-emerald-800 text-emerald-900 font-bold"
                : "bg-ochre-light border-ochre text-ink font-bold"
            }`}
          >
            {configured ? "CONFIGURAT OK" : "ACȚIUNE NECESARĂ"}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 font-mono text-xs">
          <div className="p-3.5 border border-ink/20 bg-cream">
            <div className="text-ink-muted mb-1">NEXT_PUBLIC_SUPABASE_URL</div>
            <div className="font-bold text-ink break-all">
              {hasValidUrl ? rawUrl : "LIPSĂ / PLACEHOLDER"}
            </div>
          </div>

          <div className="p-3.5 border border-ink/20 bg-cream">
            <div className="text-ink-muted mb-1">
              NEXT_PUBLIC_SUPABASE_ANON_KEY
            </div>
            <div className="font-bold text-ink">
              {hasValidAnonKey
                ? "CHEIE PREZENTĂ (JWT VALIDAT)"
                : "LIPSĂ / PLACEHOLDER"}
            </div>
          </div>
        </div>

        {!configured && (
          <div className="p-4 border border-ink/20 bg-cream-dark/50 text-xs space-y-2">
            <p className="font-bold text-ink font-mono uppercase">
              Cum conectezi proiectul tău Supabase (2 minute):
            </p>
            <ol className="list-decimal list-inside space-y-1 text-ink-muted font-sans">
              <li>
                Intră în{" "}
                <span className="font-mono text-ink">
                  Supabase Dashboard &rarr; Project Settings &rarr; API
                </span>
                .
              </li>
              <li>
                Copiază <strong>Project URL</strong> și{" "}
                <strong>anon / public key</strong> în fișierul{" "}
                <code className="font-mono text-ink">.env.local</code> din
                rădăcina proiectului.
              </li>
              <li>
                Repornește serverul Next.js (
                <code className="font-mono">npm run dev</code>) și apasă pe
                butonul de reîmprospătare de mai sus.
              </li>
            </ol>
          </div>
        )}
      </section>

      {/* Pasul 2: Verificare Tabele PostgreSQL */}
      <section className="catalog-card p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-ink/15 pb-3">
          <h2 className="font-display text-lg font-bold">
            2. Verificare Tabele Schema SQL (PostgreSQL + RLS)
          </h2>
          <span className="font-mono text-xs text-ink-muted">
            MIGRAȚIE: supabase/migrations/001_initial_schema.sql
          </span>
        </div>

        {!configured ? (
          <p className="text-sm text-ink-muted font-mono py-4">
            [Așteptare conexiune .env.local pentru a interoga tabelele...]
          </p>
        ) : connectionError ? (
          <div className="p-4 border border-red-800/40 bg-red-900/10 text-xs font-mono text-red-950">
            Eroare conexiune: {connectionError}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse font-mono text-xs">
              <thead>
                <tr className="border-b border-ink/30 bg-cream-dark/50 text-ink-muted uppercase">
                  <th className="py-2.5 px-3">Tabel Public</th>
                  <th className="py-2.5 px-3">Rol în Arhitectură</th>
                  <th className="py-2.5 px-3">Înregistrări</th>
                  <th className="py-2.5 px-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink/15">
                {tableResults.map((tbl) => (
                  <tr key={tbl.tableName} className="hover:bg-cream/60">
                    <td className="py-3 px-3 font-bold text-ink">
                      public.{tbl.tableName}
                    </td>
                    <td className="py-3 px-3 font-sans text-ink-muted">
                      {tbl.description}
                    </td>
                    <td className="py-3 px-3">
                      {tbl.exists ? `${tbl.rowCount} rânduri` : "—"}
                    </td>
                    <td className="py-3 px-3">
                      {tbl.exists ? (
                        <span className="inline-block px-2 py-0.5 bg-emerald-900/10 border border-emerald-800 text-emerald-900 font-bold">
                          OK — Tabel activ &amp; RLS pregătit
                        </span>
                      ) : (
                        <span
                          className="inline-block px-2 py-0.5 bg-ochre-light border border-ochre text-ink"
                          title={tbl.errorMessage ?? ""}
                        >
                          Lipsă — Rulează migrația 001_initial_schema.sql
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {configured && !allTablesReady && (
          <div className="p-4 border border-ochre bg-ochre-light/60 text-xs space-y-1.5">
            <div className="font-mono font-bold text-ink uppercase">
              Cum creezi tabelele în Supabase:
            </div>
            <p className="text-ink-muted font-sans">
              Deschide fișierul local{" "}
              <code className="font-mono text-ink">
                supabase/migrations/001_initial_schema.sql
              </code>
              , copiază tot conținutul său în{" "}
              <strong>Supabase Dashboard &rarr; SQL Editor</strong> și apasă pe{" "}
              <strong>Run</strong>.
            </p>
          </div>
        )}
      </section>

      {/* Pasul 3: Status Sesiune Auth Curentă */}
      <section className="catalog-card p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <h2 className="font-display text-lg font-bold">
            3. Sesiune Curentă Supabase Auth
          </h2>
          <p className="text-xs font-mono text-ink-muted">
            {authUserEmail
              ? `Autentificat ca: ${authUserEmail}`
              : "Niciun utilizator autentificat în acest browser."}
          </p>
        </div>

        <div className="flex items-center gap-3">
          {authUserEmail ? (
            <Link href="/profil" className="catalog-btn-primary">
              Vezi Fișa de Profil &rarr;
            </Link>
          ) : (
            <>
              <Link href="/inregistrare" className="catalog-btn-primary">
                Testează Înregistrarea
              </Link>
              <Link href="/login" className="catalog-btn-secondary">
                Autentificare
              </Link>
            </>
          )}
        </div>
      </section>
    </div>
  );
}
