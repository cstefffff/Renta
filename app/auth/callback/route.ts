import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * ============================================================================
 * RentA (MVP) — Route Handler pentru Confirmarea de Email (`/auth/callback`)
 * ============================================================================
 *
 * Analogie pentru dezvoltatori C / Java:
 * - În Next.js App Router, un fișier numit `route.ts` definește un endpoint HTTP
 *   clasic (echivalentul unei metode `@GetMapping("/auth/callback")` dintr-un
 *   `@RestController` în Spring Boot).
 * - Atunci când un utilizator dă click pe linkul de confirmare din emailul trimis
 *   de Supabase, browserul accesează `/auth/callback?code=...`.
 * - Acest handler schimbă (`exchangeCodeForSession`) codul temporar PKCE într-o
 *   sesiune autentificată salvată în cookie-uri HTTP-only și redirecționează
 *   utilizatorul către pagina `/profil`.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/profil";

  if (code) {
    const supabase = await createClient();
    if (supabase) {
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (!error) {
        return NextResponse.redirect(`${origin}${next}`);
      }
    }
  }

  // În caz de cod invalid sau expirat, redirecționăm către pagina de login
  return NextResponse.redirect(
    `${origin}/login?error=Linkul+de+confirmare+este+invalid+sau+a+expirat`
  );
}
