-- ============================================================================
-- RentA (Faza 15) — Migrația 008: Panou Administrare (/admin), Raportări
-- Anunțuri & Jurnal Imutabil de Audit (M15.1)
-- ============================================================================
-- Analogie pentru dezvoltatori C / Java:
--   1. `public.is_current_user_admin()` este o metodă helper `boolean isAdmin()`
--      care rulează cu privilegii ridicate (`SECURITY DEFINER`) pentru a citi
--      sigur coloana `role` din `public.profile_private` fără a expune
--      întregul tabel `profile_private` prin RLS.
--   2. `public.admin_audit_logs` este un jurnal imutabil (append-only log),
--      similar unui `AuditInterceptor` din Spring Boot: fiecare decizie de
--      moderare, verificare KYB sau soluționare dispută lasă o urmă clară.
--   3. `public.listing_reports` stochează sesizările trimise de utilizatori
--      pentru anunțurile suspecte, urmând ciclul `open -> dismissed | action_taken`.
--   4. Cele 3 funcții RPC `SECURITY DEFINER` execută tranzacții atomice
--      (echivalent `@Transactional` în Java) și verifică strict rolul `admin`.
-- ============================================================================

-- ============================================================================
-- 1. FUNCȚIA HELPER `public.is_current_user_admin()`
-- ============================================================================
CREATE OR REPLACE FUNCTION public.is_current_user_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profile_private
    WHERE id = auth.uid()
      AND role = 'admin'
  );
$$;

-- ============================================================================
-- 2. TABELUL `public.admin_audit_logs` (Jurnal Audit Administrativ)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.admin_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id TEXT NOT NULL,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_created_at
  ON public.admin_audit_logs (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_admin_id
  ON public.admin_audit_logs (admin_id);

CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_target
  ON public.admin_audit_logs (target_type, target_id);

ALTER TABLE public.admin_audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_audit_logs_select_admin" ON public.admin_audit_logs;
CREATE POLICY "admin_audit_logs_select_admin"
  ON public.admin_audit_logs
  FOR SELECT
  USING (public.is_current_user_admin());

-- ============================================================================
-- 3. TABELUL `public.listing_reports` (Raportări Anunțuri Suspecte)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.listing_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id UUID NOT NULL REFERENCES public.listings(id) ON DELETE CASCADE,
  reporter_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  reason TEXT NOT NULL,
  details TEXT NULL,
  status TEXT NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'dismissed', 'action_taken')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_listing_reports_status_created
  ON public.listing_reports (status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_listing_reports_listing_id
  ON public.listing_reports (listing_id);

CREATE INDEX IF NOT EXISTS idx_listing_reports_reporter_id
  ON public.listing_reports (reporter_id);

ALTER TABLE public.listing_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "listing_reports_insert_own" ON public.listing_reports;
CREATE POLICY "listing_reports_insert_own"
  ON public.listing_reports
  FOR INSERT
  WITH CHECK (auth.uid() = reporter_id);

DROP POLICY IF EXISTS "listing_reports_select_admin_or_own" ON public.listing_reports;
CREATE POLICY "listing_reports_select_admin_or_own"
  ON public.listing_reports
  FOR SELECT
  USING (public.is_current_user_admin() OR auth.uid() = reporter_id);

DROP POLICY IF EXISTS "listing_reports_update_admin" ON public.listing_reports;
CREATE POLICY "listing_reports_update_admin"
  ON public.listing_reports
  FOR UPDATE
  USING (public.is_current_user_admin())
  WITH CHECK (public.is_current_user_admin());

-- ============================================================================
-- 4. POLITICI RLS SUPLIMENTARE DE CITIRE PENTRU ADMIN (`/admin`)
-- ============================================================================
-- Permite administratorului să citească toate statisticile și listele
-- direct prin RLS, fără a ocoli securitatea sau a expune date utilizatorilor.

DROP POLICY IF EXISTS "disputes_select_admin" ON public.disputes;
CREATE POLICY "disputes_select_admin"
  ON public.disputes
  FOR SELECT
  USING (public.is_current_user_admin());

DROP POLICY IF EXISTS "payments_select_admin" ON public.payments;
CREATE POLICY "payments_select_admin"
  ON public.payments
  FOR SELECT
  USING (public.is_current_user_admin());

DROP POLICY IF EXISTS "invoices_select_admin" ON public.invoices;
CREATE POLICY "invoices_select_admin"
  ON public.invoices
  FOR SELECT
  USING (public.is_current_user_admin());

DROP POLICY IF EXISTS "listings_select_admin" ON public.listings;
CREATE POLICY "listings_select_admin"
  ON public.listings
  FOR SELECT
  USING (public.is_current_user_admin());

DROP POLICY IF EXISTS "profiles_select_admin" ON public.profiles;
CREATE POLICY "profiles_select_admin"
  ON public.profiles
  FOR SELECT
  USING (public.is_current_user_admin());

DROP POLICY IF EXISTS "bookings_select_admin" ON public.bookings;
CREATE POLICY "bookings_select_admin"
  ON public.bookings
  FOR SELECT
  USING (public.is_current_user_admin());

-- ============================================================================
-- 5. RPC-URI `SECURITY DEFINER` PENTRU ACȚIUNILE DE ADMINISTRARE
-- ============================================================================

-- 5.1 Moderare anunț (+ rezolvare raport asociat dacă există)
CREATE OR REPLACE FUNCTION public.admin_moderate_listing(
  p_listing_id UUID,
  p_new_status TEXT,
  p_report_id UUID DEFAULT NULL,
  p_notes TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin_id UUID := auth.uid();
  v_report_status TEXT;
BEGIN
  IF v_admin_id IS NULL OR NOT public.is_current_user_admin() THEN
    RAISE EXCEPTION 'Acces interzis: necesită rol admin';
  END IF;

  IF p_new_status NOT IN ('available', 'unavailable', 'archived') THEN
    RAISE EXCEPTION 'Status anunț invalid: %', p_new_status;
  END IF;

  UPDATE public.listings
  SET status = p_new_status
  WHERE id = p_listing_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Anunțul (%) nu a fost găsit.', p_listing_id;
  END IF;

  IF p_report_id IS NOT NULL THEN
    v_report_status := CASE
      WHEN p_new_status = 'available' THEN 'dismissed'
      ELSE 'action_taken'
    END;

    UPDATE public.listing_reports
    SET status = v_report_status
    WHERE id = p_report_id;
  END IF;

  INSERT INTO public.admin_audit_logs (
    admin_id,
    action,
    target_type,
    target_id,
    details
  )
  VALUES (
    v_admin_id,
    'moderate_listing',
    'listing',
    p_listing_id::TEXT,
    jsonb_build_object(
      'new_status', p_new_status,
      'report_id', p_report_id,
      'report_status', v_report_status,
      'notes', NULLIF(BTRIM(COALESCE(p_notes, '')), '')
    )
  );
END;
$$;

-- 5.2 Aprobare / revocare verificare KYB pentru o firmă
CREATE OR REPLACE FUNCTION public.admin_verify_company(
  p_user_id UUID,
  p_approve BOOLEAN
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin_id UUID := auth.uid();
BEGIN
  IF v_admin_id IS NULL OR NOT public.is_current_user_admin() THEN
    RAISE EXCEPTION 'Acces interzis: necesită rol admin';
  END IF;

  -- Flag local pe tranzacție pentru a trece controlat de trigger-ul
  -- `protect_public_profile_badges` din Migrația 003/005.
  PERFORM set_config('renta.trusted_verification', 'on', true);

  UPDATE public.profiles
  SET
    kyb_verified = p_approve,
    kyb_verified_at = CASE WHEN p_approve THEN NOW() ELSE NULL END
  WHERE id = p_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Profilul (%) nu a fost găsit.', p_user_id;
  END IF;

  INSERT INTO public.admin_audit_logs (
    admin_id,
    action,
    target_type,
    target_id,
    details
  )
  VALUES (
    v_admin_id,
    CASE WHEN p_approve THEN 'verify_company_approve' ELSE 'verify_company_revoke' END,
    'profile',
    p_user_id::TEXT,
    jsonb_build_object('approve', p_approve)
  );
END;
$$;

-- 5.3 Soluționare dispută comercială + actualizare stare escrow în `payments`
CREATE OR REPLACE FUNCTION public.admin_resolve_dispute(
  p_dispute_id UUID,
  p_resolution TEXT,
  p_notes TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin_id UUID := auth.uid();
  v_booking_id UUID;
BEGIN
  IF v_admin_id IS NULL OR NOT public.is_current_user_admin() THEN
    RAISE EXCEPTION 'Acces interzis: necesită rol admin';
  END IF;

  IF p_resolution NOT IN ('resolved_owner', 'resolved_renter', 'closed') THEN
    RAISE EXCEPTION 'Rezoluție dispută invalidă: %', p_resolution;
  END IF;

  UPDATE public.disputes
  SET status = p_resolution
  WHERE id = p_dispute_id
  RETURNING booking_id INTO v_booking_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Disputa (%) nu a fost găsită.', p_dispute_id;
  END IF;

  IF p_resolution = 'resolved_owner' THEN
    UPDATE public.payments
    SET
      payment_status = 'released',
      deposit_status = 'captured',
      released_at = COALESCE(released_at, NOW())
    WHERE booking_id = v_booking_id;
  ELSIF p_resolution = 'resolved_renter' THEN
    UPDATE public.payments
    SET
      payment_status = 'refunded',
      deposit_status = 'released',
      released_at = COALESCE(released_at, NOW())
    WHERE booking_id = v_booking_id;
  END IF;

  INSERT INTO public.admin_audit_logs (
    admin_id,
    action,
    target_type,
    target_id,
    details
  )
  VALUES (
    v_admin_id,
    'resolve_dispute',
    'dispute',
    p_dispute_id::TEXT,
    jsonb_build_object(
      'booking_id', v_booking_id,
      'resolution', p_resolution,
      'notes', NULLIF(BTRIM(COALESCE(p_notes, '')), '')
    )
  );
END;
$$;

-- ============================================================================
-- 6. PERMISIUNI DE EXECUȚIE (Principle of Least Privilege)
-- ============================================================================
REVOKE ALL ON FUNCTION public.is_current_user_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_current_user_admin() TO authenticated;

REVOKE ALL ON FUNCTION public.admin_moderate_listing(UUID, TEXT, UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_moderate_listing(UUID, TEXT, UUID, TEXT) TO authenticated;

REVOKE ALL ON FUNCTION public.admin_verify_company(UUID, BOOLEAN) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_verify_company(UUID, BOOLEAN) TO authenticated;

REVOKE ALL ON FUNCTION public.admin_resolve_dispute(UUID, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_resolve_dispute(UUID, TEXT, TEXT) TO authenticated;
