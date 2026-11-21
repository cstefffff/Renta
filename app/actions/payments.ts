"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getSupabaseEnv } from "@/lib/supabase/config";
import {
  getStripeClient,
  getStripeMode,
  isStripeConfigured,
  STRIPE_PLATFORM_FEE_PERCENT,
} from "@/lib/stripe/config";
import { dispatchNotification } from "@/app/actions/notifications";
import { issueCommissionInvoiceAction } from "@/app/actions/legal";
import type {
  ActionResponse,
  DepositStatus,
  PaymentMode,
  PaymentRecord,
  PayoutAccount,
} from "@/lib/types/database";

/**
 * ============================================================================
 * RentA (Faza 11) — Server Actions pentru Plăți, Payout & Escrow
 * (`app/actions/payments.ts`)
 * ============================================================================
 *
 * Explicație pentru dezvoltatori C / Java:
 * - Acest fișier joacă rolul unui `PaymentService` din Spring Boot (cu metode
 *   executate exclusiv pe server prin directiva `"use server"`).
 * - Toate calculele financiare (chiria, comisionul de 10%, payout-ul net al
 *   proprietarului și garanția/deposit-ul) se fac EXCLUSIV pe server din datele
 *   bazei de date — niciodată nu avem încredere în sume trimise din browser!
 * - Arhitectură Mod Dual (Strategy Pattern în Java):
 *     1. Modul `"stripe"`: când `STRIPE_SECRET_KEY` este configurată (`sk_test_...`
 *        sau `sk_live_...`), comunică direct cu API-ul Stripe Connect Express și
 *        Stripe Checkout.
 *     2. Modul `"sandbox"`: când cheile Stripe lipsesc, rulează Simulatorul
 *        Escrow Gratuit direct în PostgreSQL/Supabase, păstrând exact aceleași
 *        stări (`unpaid -> paid -> released`) și garanții (`held -> released/captured`).
 */

const MIGRATION_MISSING_MESSAGE =
  "Tabelele de plăți nu au fost create încă în Supabase. Rulează fișierul supabase/migrations/004_payments_and_escrow.sql în Supabase SQL Editor și reîncearcă.";

function errorResponse<T = unknown>(message: string): ActionResponse<T> {
  return {
    success: false,
    ok: false,
    error: message,
    message,
  };
}

function successResponse<T = unknown>(
  message: string,
  data?: T
): ActionResponse<T> {
  return {
    success: true,
    ok: true,
    message,
    data,
  };
}

/**
 * Detectează dacă eroarea venită de la Supabase/PostgREST indică lipsa tabelelor
 * din migrația `004_payments_and_escrow.sql` (cod SQLSTATE `42P01` sau `PGRST205`).
 */
function isMissingTableError(
  error: { code?: string; message?: string } | null | undefined
): boolean {
  if (!error) return false;
  const code = error.code ?? "";
  const msg = (error.message ?? "").toLowerCase();
  return (
    code === "42P01" ||
    code === "PGRST205" ||
    msg.includes("could not find the table") ||
    msg.includes("does not exist") ||
    msg.includes("relation") && msg.includes("payout_accounts") ||
    msg.includes("relation") && msg.includes("payments")
  );
}

/**
 * Returnează URL-ul de bază al site-ului (fără slash final) pentru redirect-urile Stripe.
 */
function getSiteUrl(): string {
  const raw =
    process.env.NEXT_PUBLIC_SITE_URL?.trim() || "http://localhost:3000";
  return raw.replace(/\/+$/, "");
}

/**
 * Normalizează un rând brut din `public.payments` astfel încât valorile `NUMERIC`
 * venite din PostgreSQL să fie întotdeauna de tip `number` în TypeScript.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normalizePaymentRow(row: any): PaymentRecord {
  return {
    id: String(row.id),
    booking_id: String(row.booking_id),
    renter_id: String(row.renter_id),
    owner_id: String(row.owner_id),
    mode: row.mode === "stripe" ? "stripe" : "sandbox",
    currency: String(row.currency ?? "RON"),
    rental_amount_ron: Number(row.rental_amount_ron ?? 0),
    platform_fee_ron: Number(row.platform_fee_ron ?? 0),
    owner_payout_ron: Number(row.owner_payout_ron ?? 0),
    deposit_amount_ron: Number(row.deposit_amount_ron ?? 0),
    total_charged_ron: Number(row.total_charged_ron ?? 0),
    stripe_checkout_session_id: row.stripe_checkout_session_id ?? null,
    stripe_payment_intent_id: row.stripe_payment_intent_id ?? null,
    stripe_deposit_intent_id: row.stripe_deposit_intent_id ?? null,
    payment_status: row.payment_status ?? "unpaid",
    deposit_status: row.deposit_status ?? "none",
    paid_at: row.paid_at ?? null,
    released_at: row.released_at ?? null,
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  };
}

/**
 * Normalizează un rând brut din `public.payout_accounts`.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normalizePayoutAccountRow(row: any): PayoutAccount {
  return {
    id: String(row.id),
    user_id: String(row.user_id),
    stripe_account_id: row.stripe_account_id ?? null,
    mode: row.mode === "stripe" ? "stripe" : "sandbox",
    onboarding_status: row.onboarding_status ?? "not_started",
    charges_enabled: Boolean(row.charges_enabled),
    payouts_enabled: Boolean(row.payouts_enabled),
    details_submitted: Boolean(row.details_submitted),
    iban_last4: row.iban_last4 ?? null,
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  };
}

/**
 * 1. CITIRE CONT PAYOUT PROPRIU (`getMyPayoutAccountAction`)
 *
 * Întoarce modul activ (`stripe` | `sandbox`), contul de încasare al utilizatorului
 * curent (sau `null` dacă nu a început onboarding-ul) și un flag `migrationMissing`
 * dacă migrația 004 nu a fost rulată încă în Supabase.
 */
export async function getMyPayoutAccountAction(): Promise<{
  mode: PaymentMode;
  account: PayoutAccount | null;
  migrationMissing?: boolean;
}> {
  const mode = getStripeMode();
  const { isConfigured } = getSupabaseEnv();
  if (!isConfigured) {
    return { mode, account: null };
  }

  const supabase = await createClient();
  if (!supabase) {
    return { mode, account: null };
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { mode, account: null };
  }

  const { data, error } = await supabase
    .from("payout_accounts")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) {
    if (isMissingTableError(error)) {
      return { mode, account: null, migrationMissing: true };
    }
    return { mode, account: null };
  }

  return {
    mode,
    account: data ? normalizePayoutAccountRow(data) : null,
  };
}

/**
 * 2. ONBOARDING CONT PAYOUT PROPRIETAR (`startPayoutOnboardingAction`)
 *
 * - În modul **Stripe**: creează (sau reutilizează) un cont Stripe Connect Express,
 *   îl salvează în `public.payout_accounts` și generează un `AccountLink` oficial
 *   pentru verificarea KYC/IBAN pe platforma Stripe.
 * - În modul **Sandbox Gratuit**: activează instantaneu un cont simulat
 *   (`acct_sandbox_...`) cu ultimele 4 cifre IBAN introduse de utilizator.
 */
export async function startPayoutOnboardingAction(
  ibanLast4?: string
): Promise<
  ActionResponse<{
    onboardingUrl?: string;
    account?: PayoutAccount;
    mode: PaymentMode;
  }>
> {
  const { isConfigured } = getSupabaseEnv();
  if (!isConfigured) {
    return errorResponse(
      "Conexiunea Supabase nu este configurată în .env.local."
    );
  }

  const supabase = await createClient();
  if (!supabase) {
    return errorResponse("Clientul Supabase nu a putut fi inițializat pe server.");
  }

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return errorResponse(
      "Trebuie să fii autentificat pentru a configura contul de încasări."
    );
  }

  // Verificăm dacă există deja un cont payout în DB (și dacă tabelul există)
  const { data: existingRow, error: fetchError } = await supabase
    .from("payout_accounts")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  if (fetchError) {
    if (isMissingTableError(fetchError)) {
      return errorResponse(MIGRATION_MISSING_MESSAGE);
    }
    return errorResponse(
      `Eroare la verificarea contului de încasări: ${fetchError.message}`
    );
  }

  const cleanIban4 = (ibanLast4 ?? "")
    .replace(/[^a-zA-Z0-9]/g, "")
    .slice(-4)
    .toUpperCase();

  const stripe = getStripeClient();

  // === CAZUL A: MOD STRIPE CONNECT REAL ===
  if (isStripeConfigured() && stripe) {
    try {
      let stripeAccountId: string | null =
        existingRow?.stripe_account_id &&
        !String(existingRow.stripe_account_id).startsWith("acct_sandbox_")
          ? String(existingRow.stripe_account_id)
          : null;

      if (!stripeAccountId) {
        const createdAccount = await stripe.accounts.create({
          type: "express",
          country: "RO",
          email: user.email ?? undefined,
          capabilities: {
            card_payments: { requested: true },
            transfers: { requested: true },
          },
          metadata: {
            renta_user_id: user.id,
          },
        });
        stripeAccountId = createdAccount.id;
      }

      const { data: savedRow, error: upsertError } = await supabase
        .from("payout_accounts")
        .upsert(
          {
            user_id: user.id,
            stripe_account_id: stripeAccountId,
            mode: "stripe",
            onboarding_status:
              existingRow?.onboarding_status === "active"
                ? "active"
                : "pending",
            charges_enabled: Boolean(existingRow?.charges_enabled ?? false),
            payouts_enabled: Boolean(existingRow?.payouts_enabled ?? false),
            details_submitted: Boolean(existingRow?.details_submitted ?? false),
            iban_last4: cleanIban4 || existingRow?.iban_last4 || null,
          },
          { onConflict: "user_id" }
        )
        .select("*")
        .single();

      if (upsertError) {
        if (isMissingTableError(upsertError)) {
          return errorResponse(MIGRATION_MISSING_MESSAGE);
        }
        return errorResponse(
          `Nu am putut salva contul Stripe în baza de date: ${upsertError.message}`
        );
      }

      const siteUrl = getSiteUrl();
      const accountLink = await stripe.accountLinks.create({
        account: stripeAccountId,
        return_url: `${siteUrl}/profil/plati?onboarding=return`,
        refresh_url: `${siteUrl}/profil/plati?onboarding=refresh`,
        type: "account_onboarding",
      });

      revalidatePath("/profil/plati");

      return successResponse(
        "Link-ul de verificare Stripe Connect Express a fost generat.",
        {
          onboardingUrl: accountLink.url,
          account: normalizePayoutAccountRow(savedRow),
          mode: "stripe",
        }
      );
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "Eroare necunoscută la Stripe API.";
      return errorResponse(
        `Nu am putut inițializa contul Stripe Connect: ${msg}`
      );
    }
  }

  // === CAZUL B: MOD SANDBOX GRATUIT (FĂRĂ CHEI STRIPE) ===
  const sandboxAccountId = `acct_sandbox_${user.id.slice(0, 8)}`;
  const { data: sandboxRow, error: sandboxError } = await supabase
    .from("payout_accounts")
    .upsert(
      {
        user_id: user.id,
        stripe_account_id: sandboxAccountId,
        mode: "sandbox",
        onboarding_status: "active",
        charges_enabled: true,
        payouts_enabled: true,
        details_submitted: true,
        iban_last4: cleanIban4 || "4242",
      },
      { onConflict: "user_id" }
    )
    .select("*")
    .single();

  if (sandboxError || !sandboxRow) {
    if (isMissingTableError(sandboxError)) {
      return errorResponse(MIGRATION_MISSING_MESSAGE);
    }
    return errorResponse(
      `Eroare la activarea contului Sandbox: ${
        sandboxError?.message ?? "Răspuns gol de la baza de date"
      }`
    );
  }

  revalidatePath("/profil/plati");
  revalidatePath("/rezervarile-mele");

  return successResponse(
    "Contul de încasări (Mod Sandbox Gratuit) a fost activat instantaneu!",
    {
      account: normalizePayoutAccountRow(sandboxRow),
      mode: "sandbox",
    }
  );
}

/**
 * 3. LISTARE PLĂȚI PENTRU REZERVĂRILE UTILIZATORULUI (`getPaymentsForMyBookingsAction`)
 *
 * Returnează toate înregistrările din `public.payments` unde utilizatorul este
 * fie chiriaș (`renter_id`), fie proprietar (`owner_id`), ordonate descrescător.
 */
export async function getPaymentsForMyBookingsAction(): Promise<{
  payments: PaymentRecord[];
  migrationMissing?: boolean;
}> {
  const { isConfigured } = getSupabaseEnv();
  if (!isConfigured) {
    return { payments: [] };
  }

  const supabase = await createClient();
  if (!supabase) {
    return { payments: [] };
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { payments: [] };
  }

  const { data, error } = await supabase
    .from("payments")
    .select("*")
    .or(`renter_id.eq.${user.id},owner_id.eq.${user.id}`)
    .order("created_at", { ascending: false });

  if (error) {
    if (isMissingTableError(error)) {
      return { payments: [], migrationMissing: true };
    }
    return { payments: [] };
  }

  const payments = Array.isArray(data) ? data.map(normalizePaymentRow) : [];
  return { payments };
}

/**
 * 4. INIȚIERE PLATĂ ESCROW PENTRU O REZERVARE CONFIRMATĂ (`initiateBookingCheckoutAction`)
 *
 * Securitate & Reguli de Business (evaluate strict pe server):
 * - Doar chiriașul (`booking.renter_id === user.id`) poate plăti rezervarea.
 * - Rezervarea trebuie să fie în starea `"confirmed"`.
 * - Sumele (`rentalAmount`, `platformFee`, `ownerPayout`, `depositAmount`, `totalCharged`)
 *   sunt recalculate integral pe server din `bookings` + `listings.deposit_ron`.
 */
export async function initiateBookingCheckoutAction(
  bookingId: string
): Promise<
  ActionResponse<{
    checkoutUrl?: string;
    payment?: PaymentRecord;
    simulated?: boolean;
  }>
> {
  const { isConfigured } = getSupabaseEnv();
  if (!isConfigured) {
    return errorResponse("Conexiunea Supabase nu este configurată.");
  }

  const supabase = await createClient();
  if (!supabase) {
    return errorResponse("Clientul Supabase nu este disponibil pe server.");
  }

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return errorResponse(
      "Trebuie să fii autentificat pentru a iniția plata rezervării."
    );
  }

  if (!bookingId || !bookingId.trim()) {
    return errorResponse("ID-ul rezervării lipsește.");
  }

  // 1. Încărcăm rezervarea și validăm rolul + starea
  const { data: booking, error: bookingError } = await supabase
    .from("bookings")
    .select(
      "id, booking_code, listing_id, renter_id, owner_id, total_price_ron, total_days, status"
    )
    .eq("id", bookingId)
    .maybeSingle();

  if (bookingError || !booking) {
    return errorResponse("Rezervarea nu a fost găsită în baza de date.");
  }

  if (booking.renter_id !== user.id) {
    return errorResponse(
      "Doar chiriașul care a creat rezervarea poate efectua plata."
    );
  }

  if (booking.status !== "confirmed") {
    return errorResponse(
      "Plata poate fi inițiată doar după ce proprietarul a confirmat rezervarea."
    );
  }

  // 2. Verificăm să nu fie deja plătită (prevenire double-charge)
  const { data: existingPayment, error: existingPaymentError } = await supabase
    .from("payments")
    .select("*")
    .eq("booking_id", booking.id)
    .maybeSingle();

  if (existingPaymentError) {
    if (isMissingTableError(existingPaymentError)) {
      return errorResponse(MIGRATION_MISSING_MESSAGE);
    }
    return errorResponse(
      `Eroare la verificarea plății existente: ${existingPaymentError.message}`
    );
  }

  if (
    existingPayment &&
    (existingPayment.payment_status === "paid" ||
      existingPayment.payment_status === "released")
  ) {
    return errorResponse(
      "Această rezervare a fost deja achitată și este protejată în Escrow."
    );
  }

  // 3. Citim garanția (`deposit_ron`) și titlul din `public.listings`
  const { data: listing } = await supabase
    .from("listings")
    .select("id, title, catalog_code, deposit_ron")
    .eq("id", booking.listing_id)
    .maybeSingle();

  // 4. Calcule financiare exacte pe server (rotunjite la 2 zecimale)
  const rentalAmount = Math.round(Number(booking.total_price_ron) * 100) / 100;
  const platformFee =
    Math.round(rentalAmount * (STRIPE_PLATFORM_FEE_PERCENT / 100) * 100) / 100;
  const ownerPayout = Math.round((rentalAmount - platformFee) * 100) / 100;
  const depositAmount =
    Math.round(Number(listing?.deposit_ron ?? 0) * 100) / 100;
  const totalCharged = Math.round((rentalAmount + depositAmount) * 100) / 100;

  const listingTitle = listing?.title ?? "Obiect închiriat RentA";
  const stripe = getStripeClient();

  // === CAZUL A: MOD STRIPE CHECKOUT REAL ===
  if (isStripeConfigured() && stripe) {
    try {
      const siteUrl = getSiteUrl();
      const lineItems: Array<{
        price_data: {
          currency: string;
          product_data: { name: string; description?: string };
          unit_amount: number;
        };
        quantity: number;
      }> = [
        {
          price_data: {
            currency: "ron",
            product_data: {
              name: `Închiriere: ${listingTitle}`,
              description: `Rezervare ${booking.booking_code} (${booking.total_days} zile) — include protecție Escrow RentA`,
            },
            unit_amount: Math.round(rentalAmount * 100),
          },
          quantity: 1,
        },
      ];

      if (depositAmount > 0) {
        lineItems.push({
          price_data: {
            currency: "ron",
            product_data: {
              name: `Garanție returnabilă (Escrow): ${listingTitle}`,
              description:
                "Blocat în Escrow pe durata închirierii și eliberat la returnarea obiectului.",
            },
            unit_amount: Math.round(depositAmount * 100),
          },
          quantity: 1,
        });
      }

      const session = await stripe.checkout.sessions.create({
        mode: "payment",
        currency: "ron",
        customer_email: user.email ?? undefined,
        line_items: lineItems,
        success_url: `${siteUrl}/rezervarile-mele?payment=success&booking=${booking.id}`,
        cancel_url: `${siteUrl}/rezervarile-mele?payment=cancelled&booking=${booking.id}`,
        metadata: {
          booking_id: booking.id,
          booking_code: String(booking.booking_code),
          renter_id: user.id,
          owner_id: String(booking.owner_id),
          deposit_amount_ron: String(depositAmount),
        },
      });

      const { data: savedPayment, error: upsertError } = await supabase
        .from("payments")
        .upsert(
          {
            booking_id: booking.id,
            renter_id: user.id,
            owner_id: booking.owner_id,
            mode: "stripe",
            currency: "RON",
            rental_amount_ron: rentalAmount,
            platform_fee_ron: platformFee,
            owner_payout_ron: ownerPayout,
            deposit_amount_ron: depositAmount,
            total_charged_ron: totalCharged,
            stripe_checkout_session_id: session.id,
            payment_status: "unpaid",
            deposit_status: "none",
          },
          { onConflict: "booking_id" }
        )
        .select("*")
        .single();

      if (upsertError || !savedPayment) {
        if (isMissingTableError(upsertError)) {
          return errorResponse(MIGRATION_MISSING_MESSAGE);
        }
        return errorResponse(
          `Eroare la înregistrarea sesiunii de plată: ${
            upsertError?.message ?? "Răspuns gol"
          }`
        );
      }

      revalidatePath("/rezervarile-mele");
      revalidatePath("/profil/plati");

      return successResponse(
        "Sesiunea Stripe Checkout a fost creată. Te redirecționăm către pagina de plată securizată.",
        {
          checkoutUrl: session.url ?? undefined,
          payment: normalizePaymentRow(savedPayment),
          simulated: false,
        }
      );
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "Eroare necunoscută la Stripe API.";
      return errorResponse(`Nu am putut iniția sesiunea Stripe Checkout: ${msg}`);
    }
  }

  // === CAZUL B: MOD SANDBOX GRATUIT (SIMULATOR ESCROW) ===
  const nowIso = new Date().toISOString();
  const initialDepositStatus: DepositStatus =
    depositAmount > 0 ? "held" : "none";

  const { data: sandboxPayment, error: sandboxError } = await supabase
    .from("payments")
    .upsert(
      {
        booking_id: booking.id,
        renter_id: user.id,
        owner_id: booking.owner_id,
        mode: "sandbox",
        currency: "RON",
        rental_amount_ron: rentalAmount,
        platform_fee_ron: platformFee,
        owner_payout_ron: ownerPayout,
        deposit_amount_ron: depositAmount,
        total_charged_ron: totalCharged,
        stripe_checkout_session_id: `cs_sandbox_${booking.id.slice(0, 8)}`,
        stripe_payment_intent_id: `pi_sandbox_${booking.id.slice(0, 8)}`,
        payment_status: "paid",
        deposit_status: initialDepositStatus,
        paid_at: nowIso,
      },
      { onConflict: "booking_id" }
    )
    .select("*")
    .single();

  if (sandboxError || !sandboxPayment) {
    if (isMissingTableError(sandboxError)) {
      return errorResponse(MIGRATION_MISSING_MESSAGE);
    }
    return errorResponse(
      `Eroare la simularea plății Escrow: ${
        sandboxError?.message ?? "Răspuns gol de la baza de date"
      }`
    );
  }

  // Notificăm non-blocant proprietarul despre confirmarea plății Escrow (Faza 13 / M13.2)
  await dispatchNotification({
    userId: String(booking.owner_id),
    type: "payment_paid",
    title: `Plată Escrow confirmată (${booking.booking_code})`,
    body: `Chiriașul a achitat ${totalCharged.toFixed(2)} RON pentru „${listingTitle}” (payout net proprietar: ${ownerPayout.toFixed(2)} RON${
      depositAmount > 0
        ? `, garanție blocată: ${depositAmount.toFixed(2)} RON`
        : ""
    }).`,
    actionUrl: "/profil/plati",
    bookingId: String(booking.id),
  });

  revalidatePath("/rezervarile-mele");
  revalidatePath("/profil/plati");

  return successResponse(
    `Plata Escrow (Mod Sandbox) de ${totalCharged.toFixed(2)} RON a fost confirmată!${
      depositAmount > 0
        ? ` Garanția de ${depositAmount.toFixed(2)} RON este blocată în siguranță în Escrow.`
        : ""
    }`,
    {
      payment: normalizePaymentRow(sandboxPayment),
      simulated: true,
    }
  );
}

/**
 * 5. ELIBERARE FONDURI ESCROW & DECIZIE GARANȚIE (`releaseEscrowAndDepositAction`)
 *
 * Apelată de proprietar după ce rezervarea a fost marcată ca `"completed"`:
 * - `"release_all"`: eliberează payout-ul net către proprietar și returnează garanția chiriașului.
 * - `"retain_deposit"`: eliberează payout-ul net și reține (`captured`) garanția în caz de daune.
 */
export async function releaseEscrowAndDepositAction(
  bookingId: string,
  decision: "release_all" | "retain_deposit"
): Promise<ActionResponse<PaymentRecord>> {
  const { isConfigured } = getSupabaseEnv();
  if (!isConfigured) {
    return errorResponse("Conexiunea Supabase nu este configurată.");
  }

  const supabase = await createClient();
  if (!supabase) {
    return errorResponse("Clientul Supabase nu este disponibil pe server.");
  }

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return errorResponse(
      "Trebuie să fii autentificat pentru a elibera fondurile Escrow."
    );
  }

  if (!bookingId || !bookingId.trim()) {
    return errorResponse("ID-ul rezervării lipsește.");
  }

  if (decision !== "release_all" && decision !== "retain_deposit") {
    return errorResponse("Decizia de eliberare Escrow este invalidă.");
  }

  // 1. Verificăm rezervarea (doar proprietarul, doar în starea `completed`)
  const { data: booking, error: bookingError } = await supabase
    .from("bookings")
    .select("id, booking_code, renter_id, owner_id, status")
    .eq("id", bookingId)
    .maybeSingle();

  if (bookingError || !booking) {
    return errorResponse("Rezervarea nu a fost găsită.");
  }

  if (booking.owner_id !== user.id) {
    return errorResponse(
      "Doar proprietarul obiectului poate elibera fondurile Escrow și decide asupra garanției."
    );
  }

  if (booking.status !== "completed") {
    return errorResponse(
      "Fondurile Escrow pot fi eliberate doar după ce închirierea este marcată ca FINALIZATĂ (completed)."
    );
  }

  // 2. Încărcăm plata aferentă
  const { data: paymentRow, error: paymentError } = await supabase
    .from("payments")
    .select("*")
    .eq("booking_id", booking.id)
    .maybeSingle();

  if (paymentError) {
    if (isMissingTableError(paymentError)) {
      return errorResponse(MIGRATION_MISSING_MESSAGE);
    }
    return errorResponse(
      `Eroare la citirea plății Escrow: ${paymentError.message}`
    );
  }

  if (!paymentRow) {
    return errorResponse(
      "Nu există nicio plată Escrow înregistrată pentru această rezervare."
    );
  }

  if (paymentRow.payment_status === "released") {
    return errorResponse("Fondurile Escrow au fost deja eliberate.");
  }

  if (
    paymentRow.payment_status !== "paid" &&
    paymentRow.payment_status !== "authorized"
  ) {
    return errorResponse(
      `Nu se pot elibera fondurile dintr-o plată aflată în starea '${paymentRow.payment_status}'.`
    );
  }

  const depositAmount = Number(paymentRow.deposit_amount_ron ?? 0);
  const nextDepositStatus: DepositStatus =
    decision === "retain_deposit"
      ? depositAmount > 0
        ? "captured"
        : "none"
      : depositAmount > 0
      ? "released"
      : "none";

  const { data: updatedRow, error: updateError } = await supabase
    .from("payments")
    .update({
      payment_status: "released",
      deposit_status: nextDepositStatus,
      released_at: new Date().toISOString(),
    })
    .eq("id", paymentRow.id)
    .select("*")
    .single();

  if (updateError || !updatedRow) {
    return errorResponse(
      `Eroare la actualizarea stării Escrow: ${
        updateError?.message ?? "Răspuns gol"
      }`
    );
  }

  const normalized = normalizePaymentRow(updatedRow);

  // Notificăm non-blocant chiriașul despre eliberarea Escrow / decizia garanției (Faza 13 / M13.2)
  await dispatchNotification({
    userId: String(booking.renter_id),
    type: "payment_released",
    title: `Escrow eliberat (${booking.booking_code})`,
    body:
      decision === "retain_deposit" && depositAmount > 0
        ? `Fondurile Escrow pentru rezervarea ${booking.booking_code} au fost închise, iar garanția de ${depositAmount.toFixed(2)} RON a fost reținută de proprietar.`
        : `Fondurile Escrow pentru rezervarea ${booking.booking_code} au fost eliberate${
            depositAmount > 0
              ? `, iar garanția ta de ${depositAmount.toFixed(2)} RON a fost returnată.`
              : "."
          }`,
    actionUrl: "/rezervarile-mele",
    bookingId: String(booking.id),
  });

  // Emitem automat și non-blocant factura de comision SRL (Faza 14 / M14.2)
  try {
    await issueCommissionInvoiceAction(String(booking.id));
  } catch (invoiceErr) {
    console.error(
      "[RentA Invoicing] Emiterea automată a facturii de comision a eșuat non-blocant:",
      invoiceErr
    );
  }

  revalidatePath("/rezervarile-mele");
  revalidatePath("/profil/plati");
  revalidatePath("/profil/facturi");

  const msg =
    decision === "retain_deposit" && depositAmount > 0
      ? `Payout-ul de ${normalized.owner_payout_ron.toFixed(2)} RON a fost eliberat și garanția de ${depositAmount.toFixed(2)} RON a fost marcată ca REȚINUTĂ (captured).`
      : `Fondurile Escrow au fost eliberate! Încasezi ${normalized.owner_payout_ron.toFixed(2)} RON${
          depositAmount > 0
            ? `, iar garanția de ${depositAmount.toFixed(2)} RON a fost returnată chiriașului.`
            : "."
        }`;

  return successResponse(msg, normalized);
}
