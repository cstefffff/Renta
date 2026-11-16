/**
 * ============================================================================
 * RentA (MVP) — Configurare și Validare Variabile de Mediu Supabase
 * ============================================================================
 *
 * Analogie pentru dezvoltatori C / Java:
 * - În C, citești variabile de mediu prin `getenv("NEXT_PUBLIC_SUPABASE_URL")`.
 * - În Java (Spring Boot), le injectezi prin `@Value("${supabase.url}")` din
 *   `application.properties`.
 * - În Node.js / Next.js, le citim din obiectul global `process.env`. Prefixul
 *   `NEXT_PUBLIC_` îi spune compilatorului Next.js că aceste două variabile
 *   sunt sigure pentru a fi incluse și în bundle-ul care ajunge în browser
 *   (deoarece securitatea reală este asigurată de politicile RLS în PostgreSQL).
 */

export interface SupabaseEnvConfig {
  url: string;
  anonKey: string;
  siteUrl: string;
  isConfigured: boolean;
}

/**
 * Returnează variabilele de mediu Supabase împreună cu un flag boolean `isConfigured`.
 * Nu aruncă excepție dacă `.env.local` este încă gol, permițând aplicației să
 * pornească în modul de previzualizare / diagnostic (`/status-db`).
 */
export function getSupabaseEnv(): SupabaseEnvConfig {
  const rawUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").trim();
  // Normalizăm URL-ul: eliminăm eventualul sufix `/rest/v1` și slash-urile finale
  const url = rawUrl.replace(/\/rest\/v1\/?$/i, "").replace(/\/+$/, "");
  const anonKey = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "").trim();
  const siteUrl = (
    process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"
  )
    .trim()
    .replace(/\/+$/, "");

  const hasValidUrl =
    url.length > 0 &&
    (url.startsWith("https://") || url.startsWith("http://")) &&
    !url.includes("PROIECTUL_TAU") &&
    !url.includes("your-project");

  const hasValidAnonKey =
    anonKey.length > 20 &&
    !anonKey.includes("CHEIA_TA") &&
    !anonKey.includes("your-anon-key");

  return {
    url,
    anonKey,
    siteUrl,
    isConfigured: hasValidUrl && hasValidAnonKey,
  };
}

/**
 * Verifică dacă proiectul are cheile Supabase completate valid în `.env.local`.
 */
export function isSupabaseConfigured(): boolean {
  return getSupabaseEnv().isConfigured;
}
