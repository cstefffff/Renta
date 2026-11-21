-- ============================================================================
-- RentA (Faza 11) — Migrația 004: Plăți Stripe Connect, Conturi Payout,
-- Escrow & Garanții (Mod Dual: Stripe Connect API + Simulator Sandbox Gratuit)
-- ============================================================================
-- Analogie pentru dezvoltatori C / Java:
--   1. `public.payout_accounts` este profilul bancar/Stripe Connect al unui
--      proprietar (1:1 cu `public.profiles`), echivalent cu un DTO privat
--      `PayoutAccountEntity` protejat prin RLS strict `auth.uid() = user_id`.
--   2. `public.payments` este registrul financiar Escrow (1:1 cu `public.bookings`),
--      care separă chiria netă (`owner_payout_ron`), comisionul platformei
--      (`platform_fee_ron`) și garanția returnabilă (`deposit_amount_ron`).
--   3. `public.stripe_webhook_events` este o tabelă de idempotență (exact ca un
--      `ConcurrentHashMap<String, ProcessedEvent>` persistent în PostgreSQL),
--      care garantează că același webhook Stripe (`event_id`) nu este procesat
--      niciodată de două ori chiar dacă Stripe face retry la timeout.
-- ============================================================================

-- ============================================================================
-- 1. TABELUL `public.payout_accounts` (Conturi de încasare Proprietari)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.payout_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
  stripe_account_id TEXT UNIQUE NULL,
  mode TEXT NOT NULL DEFAULT 'sandbox'
    CHECK (mode IN ('stripe', 'sandbox')),
  onboarding_status TEXT NOT NULL DEFAULT 'not_started'
    CHECK (onboarding_status IN ('not_started', 'pending', 'active', 'restricted')),
  charges_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  payouts_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  details_submitted BOOLEAN NOT NULL DEFAULT FALSE,
  iban_last4 TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payout_accounts_status
  ON public.payout_accounts (onboarding_status);

DROP TRIGGER IF EXISTS trg_payout_accounts_updated_at ON public.payout_accounts;
CREATE TRIGGER trg_payout_accounts_updated_at
BEFORE UPDATE ON public.payout_accounts
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.payout_accounts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "payout_accounts_select_own" ON public.payout_accounts;
CREATE POLICY "payout_accounts_select_own"
  ON public.payout_accounts
  FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "payout_accounts_insert_own" ON public.payout_accounts;
CREATE POLICY "payout_accounts_insert_own"
  ON public.payout_accounts
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "payout_accounts_update_own" ON public.payout_accounts;
CREATE POLICY "payout_accounts_update_own"
  ON public.payout_accounts
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ============================================================================
-- 2. TABELUL `public.payments` (Plăți Rezervări, Comision & Escrow Garanție)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL UNIQUE REFERENCES public.bookings(id) ON DELETE CASCADE,
  renter_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  mode TEXT NOT NULL DEFAULT 'sandbox'
    CHECK (mode IN ('stripe', 'sandbox')),
  currency TEXT NOT NULL DEFAULT 'RON',
  rental_amount_ron NUMERIC(10, 2) NOT NULL CHECK (rental_amount_ron >= 0),
  platform_fee_ron NUMERIC(10, 2) NOT NULL CHECK (platform_fee_ron >= 0),
  owner_payout_ron NUMERIC(10, 2) NOT NULL CHECK (owner_payout_ron >= 0),
  deposit_amount_ron NUMERIC(10, 2) NOT NULL DEFAULT 0 CHECK (deposit_amount_ron >= 0),
  total_charged_ron NUMERIC(10, 2) NOT NULL CHECK (total_charged_ron >= 0),
  stripe_checkout_session_id TEXT NULL,
  stripe_payment_intent_id TEXT NULL,
  stripe_deposit_intent_id TEXT NULL,
  payment_status TEXT NOT NULL DEFAULT 'unpaid'
    CHECK (payment_status IN ('unpaid', 'authorized', 'paid', 'released', 'refunded', 'disputed')),
  deposit_status TEXT NOT NULL DEFAULT 'none'
    CHECK (deposit_status IN ('none', 'held', 'released', 'captured')),
  paid_at TIMESTAMPTZ NULL,
  released_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payments_renter_id
  ON public.payments (renter_id);

CREATE INDEX IF NOT EXISTS idx_payments_owner_id
  ON public.payments (owner_id);

CREATE INDEX IF NOT EXISTS idx_payments_status
  ON public.payments (payment_status);

CREATE INDEX IF NOT EXISTS idx_payments_checkout_session
  ON public.payments (stripe_checkout_session_id)
  WHERE stripe_checkout_session_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_payments_payment_intent
  ON public.payments (stripe_payment_intent_id)
  WHERE stripe_payment_intent_id IS NOT NULL;

DROP TRIGGER IF EXISTS trg_payments_updated_at ON public.payments;
CREATE TRIGGER trg_payments_updated_at
BEFORE UPDATE ON public.payments
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "payments_select_participants" ON public.payments;
CREATE POLICY "payments_select_participants"
  ON public.payments
  FOR SELECT
  USING (auth.uid() = renter_id OR auth.uid() = owner_id);

DROP POLICY IF EXISTS "payments_insert_renter" ON public.payments;
CREATE POLICY "payments_insert_renter"
  ON public.payments
  FOR INSERT
  WITH CHECK (auth.uid() = renter_id);

DROP POLICY IF EXISTS "payments_update_participants" ON public.payments;
CREATE POLICY "payments_update_participants"
  ON public.payments
  FOR UPDATE
  USING (auth.uid() = renter_id OR auth.uid() = owner_id)
  WITH CHECK (auth.uid() = renter_id OR auth.uid() = owner_id);

-- ============================================================================
-- 3. TABELUL `public.stripe_webhook_events` (Idempotență Webhook-uri Stripe)
-- ============================================================================
-- Nu definim nicio politică RLS pentru `anon` sau `authenticated`:
-- în PostgreSQL, când RLS este activat fără politici permisive, accesul este
-- complet blocat pentru toți clienții API și permis exclusiv pentru `service_role`.
CREATE TABLE IF NOT EXISTS public.stripe_webhook_events (
  event_id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_stripe_webhook_events_type
  ON public.stripe_webhook_events (event_type);

CREATE INDEX IF NOT EXISTS idx_stripe_webhook_events_processed_at
  ON public.stripe_webhook_events (processed_at DESC);

ALTER TABLE public.stripe_webhook_events ENABLE ROW LEVEL SECURITY;
