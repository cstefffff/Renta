import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseEnv } from "./config";

/**
 * Rutele protejate ale aplicației RentA care necesită un utilizator autentificat
 * atunci când conexiunea Supabase este activă.
 */
const PROTECTED_ROUTES = [
  "/profil",
  "/listarile-mele",
  "/rezervarile-mele",
  "/dashboard",
];

/**
 * ============================================================================
 * RentA (MVP) — Middleware pentru Sesiune și Protecție Rute
 * ============================================================================
 *
 * Analogie pentru dezvoltatori C / Java:
 * - Acest fișier este echivalentul unui `OncePerRequestFilter` sau `HandlerInterceptor`
 *   din Java Spring Security.
 * - Se execută automat pe Edge/Server ÎNAINTE ca cererea HTTP să ajungă în
 *   paginile din `app/`.
 * - Are două responsabilități critice:
 *   1. Reîmprospătează automat token-ul JWT expirat (prin `supabase.auth.getUser()`)
 *      și scrie noile cookie-uri atât pe obiectul `request`, cât și pe `response`.
 *   2. Redirecționează vizitatorii neautentificați către `/login` dacă încearcă
 *      să acceseze rute private (`/profil`, `/listarile-mele`, `/rezervarile-mele`).
 */
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const { url, anonKey, isConfigured } = getSupabaseEnv();

  // Dacă .env.local nu este încă completat, lăsăm cererea să treacă mai departe
  // pentru ca utilizatorul să poată vedea interfața și pagina /status-db.
  if (!isConfigured) {
    return supabaseResponse;
  }

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value)
        );
        supabaseResponse = NextResponse.next({
          request,
        });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options)
        );
      },
    },
  });

  // IMPORTANT: Apelăm `supabase.auth.getUser()` (și NU `getSession()`), deoarece
  // `getUser()` revalidează criptografic token-ul JWT direct cu serverul Supabase Auth.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;
  const isProtectedRoute = PROTECTED_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`)
  );

  // Dacă utilizatorul nu este autentificat și încearcă să acceseze o rută protejată:
  if (!user && isProtectedRoute) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.searchParams.set("redirectTo", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return supabaseResponse;
}
