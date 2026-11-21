import { NextRequest, NextResponse } from "next/server";
import { createClient as createSupabaseAdminClient } from "@supabase/supabase-js";
import type Stripe from "stripe";
import { getStripeClient } from "@/lib/stripe/config";

/**
 * ============================================================================
 * RentA (Faza 11) — Stripe Webhook Handler (`app/api/webhooks/stripe/route.ts`)
 * ============================================================================
 *
 * Explicație pentru dezvoltatori C / Java:
 * - Un Webhook este un apel HTTP `POST` inițiat de serverele Stripe către
 *   serverul nostru (exact ca un callback asincron server-to-server).
 * - Pentru a verifica autenticitatea mesajului, citim corpul RAW (`request.text()`)
 *   fără a-l parsa înainte ca JSON și verificăm semnătura HMAC-SHA256 din header-ul
 *   `stripe-signature` folosind `stripe.webhooks.constructEvent(...)`.
 * - Idempotența este asigurată prin inserarea `event.id` (cheie primară) în
 *   `public.stripe_webhook_events`: dacă Stripe trimite același eveniment de 2 ori,
 *   PostgreSQL returnează codul `23505` (unique_violation), iar noi răspundem `200 OK`
 *   fără să dublăm actualizările financiare.
 */

export async function POST(request: NextRequest) {
  const stripe = getStripeClient();
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET?.trim() ?? "";

  if (!stripe || !webhookSecret) {
    return NextResponse.json(
      {
        error:
          "Stripe Webhook nu este configurat pe acest server (lipsește STRIPE_SECRET_KEY sau STRIPE_WEBHOOK_SECRET).",
      },
      { status: 400 }
    );
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json(
      { error: "Lipsește header-ul stripe-signature." },
      { status: 400 }
    );
  }

  const rawBody = await request.text();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Semnătură Stripe invalidă.";
    return NextResponse.json(
      { error: `Verificarea semnăturii Stripe a eșuat: ${message}` },
      { status: 400 }
    );
  }

  // Client admin Supabase (folosește service_role pentru a trece de RLS pe tabela de webhooks)
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? "";
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? "";

  if (!supabaseUrl || !serviceRoleKey) {
    // Semnătura a fost verificată criptografic cu succes; fără service_role nu putem scrie în DB
    return NextResponse.json({
      received: true,
      mode: "verified",
      eventId: event.id,
      eventType: event.type,
    });
  }

  const admin = createSupabaseAdminClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  // 1. Verificare strictă de idempotență pe `event.id`
  const { error: idempotencyError } = await admin
    .from("stripe_webhook_events")
    .insert({
      event_id: event.id,
      event_type: event.type,
      payload: event as unknown as Record<string, unknown>,
    });

  if (idempotencyError) {
    if (idempotencyError.code === "23505") {
      // Eveniment deja procesat anterior -> răspundem 200 OK pentru a opri retry-urile Stripe
      return NextResponse.json({
        received: true,
        duplicate: true,
        eventId: event.id,
      });
    }
    // Dacă tabela de webhook-uri nu există încă (migrația 004 nerulată), logăm și continuăm grațios
    console.error(
      "[Stripe Webhook] Eroare la logarea idempotenței:",
      idempotencyError.message
    );
  }

  // 2. Procesare evenimente relevante
  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const bookingId = session.metadata?.booking_id;
        const depositAmount = Number(session.metadata?.deposit_amount_ron ?? 0);
        const paymentIntentId =
          typeof session.payment_intent === "string"
            ? session.payment_intent
            : session.payment_intent?.id ?? null;

        const updatePayload = {
          payment_status: "paid",
          deposit_status: depositAmount > 0 ? "held" : "none",
          stripe_payment_intent_id: paymentIntentId,
          paid_at: new Date().toISOString(),
        };

        if (bookingId) {
          await admin
            .from("payments")
            .update(updatePayload)
            .eq("booking_id", bookingId);
        } else {
          await admin
            .from("payments")
            .update(updatePayload)
            .eq("stripe_checkout_session_id", session.id);
        }
        break;
      }

      case "account.updated": {
        const account = event.data.object as Stripe.Account;
        const chargesEnabled = Boolean(account.charges_enabled);
        const payoutsEnabled = Boolean(account.payouts_enabled);
        const detailsSubmitted = Boolean(account.details_submitted);
        const disabledReason = account.requirements?.disabled_reason ?? null;

        const onboardingStatus =
          chargesEnabled && payoutsEnabled
            ? "active"
            : disabledReason
            ? "restricted"
            : detailsSubmitted
            ? "pending"
            : "not_started";

        await admin
          .from("payout_accounts")
          .update({
            charges_enabled: chargesEnabled,
            payouts_enabled: payoutsEnabled,
            details_submitted: detailsSubmitted,
            onboarding_status: onboardingStatus,
          })
          .eq("stripe_account_id", account.id);
        break;
      }

      case "payment_intent.succeeded": {
        const pi = event.data.object as Stripe.PaymentIntent;
        await admin
          .from("payments")
          .update({
            payment_status: "paid",
            paid_at: new Date().toISOString(),
          })
          .eq("stripe_payment_intent_id", pi.id);
        break;
      }

      case "payment_intent.canceled": {
        const pi = event.data.object as Stripe.PaymentIntent;
        await admin
          .from("payments")
          .update({
            payment_status: "refunded",
            deposit_status: "released",
          })
          .eq("stripe_payment_intent_id", pi.id);
        break;
      }

      default:
        // Alte evenimente Stripe sunt confirmate fără acțiune suplimentară
        break;
    }
  } catch (err) {
    console.error("[Stripe Webhook] Eroare la procesarea evenimentului:", err);
    return NextResponse.json(
      { error: "Eroare internă la procesarea evenimentului Stripe." },
      { status: 500 }
    );
  }

  return NextResponse.json({
    received: true,
    eventId: event.id,
    eventType: event.type,
  });
}
