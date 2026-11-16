import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getSupabaseEnv } from "./config";

/**
 * ============================================================================
 * RentA (MVP) — Client Supabase pentru Server (`lib/supabase/server.ts`)
 * ============================================================================
 *
 * Explicație pentru dezvoltatori C / Java (Async / Await & Promises):
 * - În C sau Java clasic, apelurile de I/O (citire headere HTTP, interogare DB)
 *   sunt blocante pe firul de execuție curent (Thread-per-Request).
 * - În Node.js / TypeScript, execuția rulează pe un Event Loop single-threaded
 *   non-blocant. O funcție marcată cu `async` returnează întotdeauna un `Promise<T>`
 *   (echivalentul lui `CompletableFuture<T>` din Java 8+).
 * - Cuvântul cheie `await` suspendă doar funcția curentă până când operația I/O
 *   se termină, eliberând firul principal pentru a procesa alte cereri.
 * - În Next.js 15, funcția `cookies()` din `next/headers` este asincronă, motiv
 *   pentru care `createClient()` folosește `await cookies()`.
 */
export async function createClient() {
  const { url, anonKey, isConfigured } = getSupabaseEnv();

  // Dacă utilizatorul nu a completat încă .env.local, returnăm null grațios
  // fără să aruncăm o excepție care ar bloca randarea paginii.
  if (!isConfigured) {
    return null;
  }

  const cookieStore = await cookies();

  return createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        } catch {
          // Metoda `setAll` a fost apelată dintr-un Server Component.
          // În Next.js, Server Components pot doar CITI cookie-uri (deoarece
          // streaming-ul răspunsului HTTP a început deja). Scrierea efectivă a
          // cookie-urilor se face în Server Actions, Route Handlers și în Middleware!
        }
      },
    },
  });
}

export const createServerSupabaseClient = createClient;
