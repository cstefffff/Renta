-- ============================================================================
-- RentA (Faza 14) — Migrația 007: Conformitate Legală, GDPR & Facturare SRL
-- (M14.1 GDPR Dreptul la Export & Dreptul de a fi Uitat / Anonimizare Cont,
--  M14.2 Registru Facturi Comision SRL & Pregătire RO e-Factura UBL 2.1)
-- ============================================================================
-- Analogie pentru dezvoltatori C / Java:
--   1. `public.invoice_number_seq` este un generator atomic thread-safe de
--      numere de serie fiscale (echivalentul unui `AtomicLong` persistent în
--      PostgreSQL), garantând unicitatea `RNT-YYYY-0001`, `RNT-YYYY-0002` etc.
--   2. `public.invoices` este tabelul fiscal imutabil (Audit Log contabil) care
--      stochează facturile de comision emise de platforma SRL către proprietari
--      la finalizarea tranzacțiilor, împreună cu starea de raportare RO e-Factura.
--   3. Funcția RPC `SECURITY DEFINER` `public.anonymize_my_account_gdpr()`
--      implementează Art. 17 GDPR („Dreptul la ștergerea datelor”) păstrând
--      integritatea referențială a facturilor și rezervărilor istorice (obligatoriu
--      fiscal 5–10 ani conform legislației din România): în loc de `DELETE`
--      brutal care ar rupe cheile străine, anonimizăm toate datele PII și
--      arhivăm anunțurile active.
--
-- Această migrație este 100% IDEMPOTENTĂ (poate fi rulată de mai multe ori în
-- Supabase SQL Editor fără erori).
-- ============================================================================

-- ============================================================================
-- 1. SECVENȚA PENTRU NUMEROTAREA FACTURILOR FISCALE (`RNT-YYYY-XXXX`)
-- ============================================================================
CREATE SEQUENCE IF NOT EXISTS public.invoice_number_seq START 1;

-- ============================================================================
-- 2. TABELUL `public.invoices` (Registru Facturi Comision SRL & RO e-Factura)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number TEXT UNIQUE NOT NULL
    DEFAULT ('RNT-' || TO_CHAR(NOW(), 'YYYY') || '-' || LPAD(nextval('public.invoice_number_seq')::TEXT, 4, '0')),
  booking_id UUID NOT NULL UNIQUE REFERENCES public.bookings(id) ON DELETE RESTRICT,
  payment_id UUID NULL REFERENCES public.payments(id) ON DELETE SET NULL,
  owner_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  renter_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  issuer_name TEXT NOT NULL DEFAULT 'RENTA MARKETPLACE SRL',
  issuer_cui TEXT NOT NULL DEFAULT 'RO00000000',
  client_name TEXT NOT NULL,
  client_cui TEXT NULL,
  client_address TEXT NULL,
  subtotal_ron NUMERIC(10, 2) NOT NULL CHECK (subtotal_ron >= 0),
  vat_rate NUMERIC(5, 2) NOT NULL DEFAULT 19.00,
  vat_amount_ron NUMERIC(10, 2) NOT NULL CHECK (vat_amount_ron >= 0),
  total_ron NUMERIC(10, 2) NOT NULL CHECK (total_ron >= 0),
  currency TEXT NOT NULL DEFAULT 'RON',
  provider TEXT NOT NULL DEFAULT 'internal'
    CHECK (provider IN ('internal', 'oblio', 'smartbill')),
  external_invoice_id TEXT NULL,
  efactura_status TEXT NOT NULL DEFAULT 'pending_anaf'
    CHECK (efactura_status IN ('not_applicable', 'pending_anaf', 'submitted', 'accepted', 'rejected')),
  issued_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexuri pentru listare rapidă în panoul de facturi și căutare după rezervare
CREATE INDEX IF NOT EXISTS idx_invoices_owner_issued
  ON public.invoices (owner_id, issued_at DESC);

CREATE INDEX IF NOT EXISTS idx_invoices_renter_issued
  ON public.invoices (renter_id, issued_at DESC);

CREATE INDEX IF NOT EXISTS idx_invoices_booking_id
  ON public.invoices (booking_id);

-- ============================================================================
-- 3. POLITICI ROW LEVEL SECURITY (RLS) PE `public.invoices`
-- ============================================================================
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "invoices_select_participants" ON public.invoices;
CREATE POLICY "invoices_select_participants"
  ON public.invoices
  FOR SELECT
  USING (auth.uid() = owner_id OR auth.uid() = renter_id);

DROP POLICY IF EXISTS "invoices_insert_owner" ON public.invoices;
CREATE POLICY "invoices_insert_owner"
  ON public.invoices
  FOR INSERT
  WITH CHECK (auth.uid() = owner_id);

-- ============================================================================
-- 4. FUNCȚIA RPC `SECURITY DEFINER`: ANONIMIZARE CONT GDPR (Art. 17 GDPR)
-- ============================================================================
-- De ce `SECURITY DEFINER` + `set_config('renta.trusted_verification', 'on', true)`?
--   Trigger-ul anti-falsificare din Migrația 003/005 blochează modificarea
--   directă a coloanelor `phone_verified` și `kyb_verified` de către utilizatori.
--   Această funcție privilegiată rulează atomic:
--     1. Verifică autentificarea (`auth.uid()`).
--     2. Blochează anonimizarea dacă există rezervări active (`pending`/`confirmed`).
--     3. Arhivează toate anunțurile proprietarului (dispar instant din catalog).
--     4. Anonimizează PII-ul din `public.profiles` și `public.profile_private`.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.anonymize_my_account_gdpr()
RETURNS BOOLEAN AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_active_bookings INT := 0;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Trebuie să fii autentificat pentru a șterge și anonimiza contul.';
  END IF;

  -- Verificăm să nu existe rezervări active (în curs de aprobare sau confirmate)
  SELECT COUNT(*)
  INTO v_active_bookings
  FROM public.bookings
  WHERE (renter_id = v_uid OR owner_id = v_uid)
    AND status IN ('pending', 'confirmed');

  IF v_active_bookings > 0 THEN
    RAISE EXCEPTION 'Nu poți șterge contul cât timp ai rezervări active.';
  END IF;

  -- Activăm flag-ul local tranzacției curente pentru a reseta badge-urile protejate
  PERFORM set_config('renta.trusted_verification', 'on', true);

  -- 1. Arhivăm toate listările utilizatorului ca să nu mai apară în catalogul public
  UPDATE public.listings
  SET
    status = 'archived',
    updated_at = NOW()
  WHERE owner_id = v_uid
    AND status <> 'archived';

  -- 2. Anonimizăm datele publice din `public.profiles`
  UPDATE public.profiles
  SET
    display_name = 'Utilizator Șters (GDPR)',
    bio = NULL,
    avatar_url = NULL,
    company_name = NULL,
    company_address = NULL,
    phone_verified = FALSE,
    kyb_verified = FALSE,
    kyb_verified_at = NULL,
    updated_at = NOW()
  WHERE id = v_uid;

  -- 3. Ștergem datele PII izolate din `public.profile_private`
  UPDATE public.profile_private
  SET
    phone = NULL,
    company_cui = NULL,
    phone_verified = FALSE,
    updated_at = NOW()
  WHERE id = v_uid;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION public.anonymize_my_account_gdpr() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.anonymize_my_account_gdpr() TO authenticated;
