import { createBrowserClient } from "@supabase/ssr";
import { getSupabaseEnv } from "./config";

/**
 * ============================================================================
 * RentA (MVP) — Client Supabase pentru Browser (`lib/supabase/client.ts`)
 * ============================================================================
 *
 * Analogie pentru dezvoltatori C / Java:
 * - Gândește-te la acest client ca la o instanță de client HTTP folosită în
 *   interfața grafică (ex. într-o aplicație desktop JavaFX/Swing) care comunică
 *   direct cu serverul Supabase din browserul utilizatorului.
 * - Folosește `document.cookie` automat în spate pentru a atașa JWT-ul sesiunii
 *   curente la fiecare cerere (de ex. la încărcarea unei imagini în Supabase Storage).
 *
 * Notă: Returnează `null` dacă `.env.local` nu este încă configurat, prevenind
 * prăbușirea aplicației la pornire.
 */
export function createClient() {
  const { url, anonKey, isConfigured } = getSupabaseEnv();

  if (!isConfigured) {
    return null;
  }

  return createBrowserClient(url, anonKey);
}

export const createBrowserSupabaseClient = createClient;
