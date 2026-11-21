import { NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { getStripeMode } from "@/lib/stripe/config";
import { getEmailMode } from "@/lib/email/resend";

/**
 * ============================================================================
 * RentA (Faza 16 / M16.2) — Endpoint Public de Healthcheck (`GET /api/health`)
 * ============================================================================
 *
 * Explicație pentru dezvoltatori C / Java:
 * - Echivalentul endpoint-ului Spring Boot Actuator `/actuator/health`.
 * - Este apelat de platformele de uptime monitoring (Vercel, UptimeRobot,
 *   Better Stack) pentru a verifica rapid dacă aplicația răspunde HTTP 200
 *   și în ce mod rulează integrările externe.
 * - Regulă de securitate: NU expune NICIODATĂ chei API, DSN-uri, token-uri
 *   sau date personale (PII) — doar flag-uri booleene și moduri publice.
 */

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(
    {
      status: "ok",
      app: "renta",
      version: "1.0.0",
      timestamp: new Date().toISOString(),
      checks: {
        supabase: isSupabaseConfigured(),
        paymentsMode: getStripeMode(),
        emailMode: getEmailMode(),
        sentryConfigured: Boolean(process.env.NEXT_PUBLIC_SENTRY_DSN?.trim()),
      },
    },
    {
      status: 200,
      headers: {
        "Cache-Control": "no-store",
      },
    }
  );
}
