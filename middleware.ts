import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

/**
 * Punctul de intrare pentru Middleware-ul Next.js (`middleware.ts`).
 *
 * Analogie pentru dezvoltatori Java:
 * Înregistrarea filtrului în lanțul de securitate HTTP (`SecurityFilterChain`).
 * Expresia regulată din `config.matcher` exclude fișierele statice (imagini,
 * fonturi, CSS) pentru a nu executa verificări de sesiune inutile pe resurse statice.
 */
export async function middleware(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
