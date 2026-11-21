import Stripe from "stripe";

/**
 * ============================================================================
 * RentA (Faza 11) — Configurare Stripe Connect & Mod Dual (`lib/stripe/config.ts`)
 * ============================================================================
 *
 * Explicație pentru dezvoltatori C / Java:
 * - Această clasă/modul funcționează ca un Singleton Lazy (exact ca pattern-ul
 *   `private static StripeClient instance;` în Java).
 * - Dacă variabila de mediu `STRIPE_SECRET_KEY` lipsește sau este un placeholder,
 *   aplicația comută automat și sigur în modul `"sandbox"` (Simulator Escrow
 *   Gratuit), astfel încât fondatorul să poată testa întregul flux financiar
 *   fără costuri și fără să blocheze mediul local.
 */

export const STRIPE_PLATFORM_FEE_PERCENT = 10;

let stripeSingleton: Stripe | null = null;
let cachedSecretKey: string | null = null;

/**
 * Verifică dacă există o cheie Stripe reală (Test `sk_test_...` sau Live `sk_live_...`).
 */
export function isStripeConfigured(): boolean {
  const key = process.env.STRIPE_SECRET_KEY?.trim() ?? "";
  return key.startsWith("sk_test_") || key.startsWith("sk_live_");
}

/**
 * Returnează modul activ de procesare a plăților:
 * - `"stripe"` când `STRIPE_SECRET_KEY` este validă
 * - `"sandbox"` când aplicația rulează cu Simulatorul Escrow Gratuit
 */
export function getStripeMode(): "stripe" | "sandbox" {
  return isStripeConfigured() ? "stripe" : "sandbox";
}

/**
 * Returnează instanța singleton a clientului Stripe sau `null` în modul Sandbox.
 */
export function getStripeClient(): Stripe | null {
  if (!isStripeConfigured()) {
    return null;
  }

  const secretKey = process.env.STRIPE_SECRET_KEY!.trim();

  if (!stripeSingleton || cachedSecretKey !== secretKey) {
    stripeSingleton = new Stripe(secretKey);
    cachedSecretKey = secretKey;
  }

  return stripeSingleton;
}
