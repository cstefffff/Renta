-- ============================================================================
-- RentA (Faza 12) — Migrația 005: Încredere & Siguranță Comercială
-- (M12.1 Verificare Telefon OTP, M12.2 Verificare Firme ANAF CUI / KYB,
--  M12.3 Protocol Foto Check-in/Check-out & Bucket Privat, M12.4 Flux Dispute)
-- ============================================================================
-- Analogie pentru dezvoltatori C / Java:
--   1. `public.phone_otp_codes` funcționează ca un cache de token-uri temporare
--      (stocăm exclusiv hash-ul SHA-256, niciodată codul în clar, exact ca la
--      parole în Java `MessageDigest.getInstance("SHA-256")`).
--   2. `public.handover_proofs` + bucket-ul privat `handover-proofs` formează
--      un jurnal imutabil de probe foto (Audit Trail) la predare și returnare,
--      accesibil prin Signed URLs temporare strict participanților rezervării.
--   3. `public.disputes` este un registru formal de litigii (1:1 cu `bookings`),
--      care îngheață eliberarea garanției din `public.payments` (`disputed`).
--   4. Funcțiile RPC `SECURITY DEFINER` (`complete_phone_otp_verification` și
--      `complete_company_kyb_verification`) acționează ca metode `privileged`
--      în Java care trec controlat de trigger-ele anti-falsificare din Migrația 003
--      folosind un flag local pe tranzacție (`renta.trusted_verification = 'on'`).
-- ============================================================================

-- ============================================================================
-- 1. EXTINDERE `public.profiles` PENTRU DATE PUBLICE KYB (M12.2)
-- ============================================================================
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS company_name TEXT NULL,
  ADD COLUMN IF NOT EXISTS company_address TEXT NULL,
  ADD COLUMN IF NOT EXISTS kyb_verified_at TIMESTAMPTZ NULL;

-- ============================================================================
-- 2. TABELUL `public.phone_otp_codes` (M12.1 Verificare Telefon OTP)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.phone_otp_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  phone TEXT NOT NULL,
  code_hash TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  attempts INT NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  consumed_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_phone_otp_codes_user_created
  ON public.phone_otp_codes (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_phone_otp_codes_active_lookup
  ON public.phone_otp_codes (user_id, phone)
  WHERE consumed_at IS NULL;

ALTER TABLE public.phone_otp_codes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "phone_otp_codes_select_own" ON public.phone_otp_codes;
CREATE POLICY "phone_otp_codes_select_own"
  ON public.phone_otp_codes
  FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "phone_otp_codes_insert_own" ON public.phone_otp_codes;
CREATE POLICY "phone_otp_codes_insert_own"
  ON public.phone_otp_codes
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "phone_otp_codes_update_own" ON public.phone_otp_codes;
CREATE POLICY "phone_otp_codes_update_own"
  ON public.phone_otp_codes
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ============================================================================
-- 3. TABELUL `public.handover_proofs` (M12.3 Protocol Foto Check-in / Check-out)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.handover_proofs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  uploaded_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  phase TEXT NOT NULL CHECK (phase IN ('checkin', 'checkout')),
  storage_path TEXT NOT NULL,
  notes TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_handover_proofs_booking_phase
  ON public.handover_proofs (booking_id, phase, created_at ASC);

CREATE INDEX IF NOT EXISTS idx_handover_proofs_uploaded_by
  ON public.handover_proofs (uploaded_by);

ALTER TABLE public.handover_proofs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "handover_proofs_select_participants" ON public.handover_proofs;
CREATE POLICY "handover_proofs_select_participants"
  ON public.handover_proofs
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.bookings b
      WHERE b.id = booking_id
        AND (b.renter_id = auth.uid() OR b.owner_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "handover_proofs_insert_participants" ON public.handover_proofs;
CREATE POLICY "handover_proofs_insert_participants"
  ON public.handover_proofs
  FOR INSERT
  WITH CHECK (
    uploaded_by = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.bookings b
      WHERE b.id = booking_id
        AND (b.renter_id = auth.uid() OR b.owner_id = auth.uid())
    )
  );

-- ============================================================================
-- 4. TABELUL `public.disputes` (M12.4 Flux Dispute & Blocare Garanție)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.disputes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL UNIQUE REFERENCES public.bookings(id) ON DELETE CASCADE,
  opened_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  reason TEXT NOT NULL
    CHECK (reason IN ('damage', 'missing_accessories', 'late_return', 'not_as_described', 'other')),
  description TEXT NOT NULL,
  claimed_amount_ron NUMERIC(10, 2) NOT NULL DEFAULT 0
    CHECK (claimed_amount_ron >= 0),
  status TEXT NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'under_review', 'resolved_renter', 'resolved_owner', 'closed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_disputes_status
  ON public.disputes (status);

CREATE INDEX IF NOT EXISTS idx_disputes_opened_by
  ON public.disputes (opened_by);

DROP TRIGGER IF EXISTS trg_disputes_updated_at ON public.disputes;
CREATE TRIGGER trg_disputes_updated_at
BEFORE UPDATE ON public.disputes
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.disputes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "disputes_select_participants" ON public.disputes;
CREATE POLICY "disputes_select_participants"
  ON public.disputes
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.bookings b
      WHERE b.id = booking_id
        AND (b.renter_id = auth.uid() OR b.owner_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "disputes_insert_participants" ON public.disputes;
CREATE POLICY "disputes_insert_participants"
  ON public.disputes
  FOR INSERT
  WITH CHECK (
    opened_by = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.bookings b
      WHERE b.id = booking_id
        AND (b.renter_id = auth.uid() OR b.owner_id = auth.uid())
    )
  );

-- ============================================================================
-- 5. BUCKET PRIVAT SUPABASE STORAGE: `handover-proofs` (M12.3)
-- ============================================================================
-- Structura căii de fișiere: `{booking_id}/{user_id}/{phase}-{timestamp}-{idx}.{ext}`
-- `(storage.foldername(name))[1]` = booking_id
-- `(storage.foldername(name))[2]` = user_id (cel care încarcă proba)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'handover-proofs',
  'handover-proofs',
  false,
  5242880, -- 5 MB limită per imagine de probă
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "storage_handover_proofs_select_participants" ON storage.objects;
CREATE POLICY "storage_handover_proofs_select_participants"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'handover-proofs'
    AND EXISTS (
      SELECT 1
      FROM public.bookings b
      WHERE b.id::text = (storage.foldername(name))[1]
        AND (b.renter_id = auth.uid() OR b.owner_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "storage_handover_proofs_insert_participants" ON storage.objects;
CREATE POLICY "storage_handover_proofs_insert_participants"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'handover-proofs'
    AND (storage.foldername(name))[2] = auth.uid()::text
    AND EXISTS (
      SELECT 1
      FROM public.bookings b
      WHERE b.id::text = (storage.foldername(name))[1]
        AND (b.renter_id = auth.uid() OR b.owner_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "storage_handover_proofs_delete_own" ON storage.objects;
CREATE POLICY "storage_handover_proofs_delete_own"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'handover-proofs'
    AND (storage.foldername(name))[2] = auth.uid()::text
    AND EXISTS (
      SELECT 1
      FROM public.bookings b
      WHERE b.id::text = (storage.foldername(name))[1]
        AND (b.renter_id = auth.uid() OR b.owner_id = auth.uid())
    )
  );

-- ============================================================================
-- 6. ACTUALIZARE TRIGGER-E ANTI-FALSIFICARE & RPC-URI DE VERIFICARE (M12.1 & M12.2)
-- ============================================================================
-- Păstrăm 100% protecția din Migrația 003 împotriva modificării directe din client
-- a coloanelor `phone_verified` și `kyb_verified`, dar permitem actualizarea
-- atomică exclusiv din funcțiile RPC `SECURITY DEFINER` de mai jos prin flag-ul
-- local pe tranzacție `renta.trusted_verification = 'on'`.

CREATE OR REPLACE FUNCTION public.protect_profile_private_columns()
RETURNS TRIGGER AS $$
BEGIN
  IF (auth.role() = 'authenticated' OR current_setting('request.jwt.claim.role', true) = 'authenticated')
     AND COALESCE(current_setting('renta.trusted_verification', true), '') <> 'on' THEN
    IF NEW.role IS DISTINCT FROM OLD.role THEN
      RAISE EXCEPTION 'Operatie interzisa: Nu aveti permisiunea de a modifica rolul contului.';
    END IF;
    IF NEW.phone_verified IS DISTINCT FROM OLD.phone_verified THEN
      RAISE EXCEPTION 'Operatie interzisa: Statutul phone_verified poate fi actualizat doar de serviciul OTP.';
    END IF;
  END IF;

  -- Sincronizăm flag-ul public phone_verified în public.profiles când este modificat
  IF NEW.phone_verified IS DISTINCT FROM OLD.phone_verified THEN
    UPDATE public.profiles
    SET phone_verified = NEW.phone_verified, updated_at = NOW()
    WHERE id = NEW.id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.protect_public_profile_badges()
RETURNS TRIGGER AS $$
BEGIN
  IF (auth.role() = 'authenticated' OR current_setting('request.jwt.claim.role', true) = 'authenticated')
     AND COALESCE(current_setting('renta.trusted_verification', true), '') <> 'on' THEN
    NEW.phone_verified := OLD.phone_verified;
    NEW.kyb_verified := OLD.kyb_verified;
    NEW.kyb_verified_at := OLD.kyb_verified_at;
    NEW.rating_avg := OLD.rating_avg;
    NEW.rating_count := OLD.rating_count;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- RPC 6.1: Finalizează verificarea OTP pentru utilizatorul autentificat (`auth.uid()`)
CREATE OR REPLACE FUNCTION public.complete_phone_otp_verification(
  p_phone TEXT,
  p_code_hash TEXT
)
RETURNS BOOLEAN AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_otp_id UUID;
BEGIN
  IF v_uid IS NULL THEN
    RETURN FALSE;
  END IF;

  SELECT id INTO v_otp_id
  FROM public.phone_otp_codes
  WHERE user_id = v_uid
    AND phone = p_phone
    AND code_hash = p_code_hash
    AND consumed_at IS NULL
    AND expires_at > NOW()
    AND attempts < 5
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_otp_id IS NULL THEN
    -- Incrementăm contorul de încercări pe cel mai recent cod neconsumat pentru acest telefon
    UPDATE public.phone_otp_codes
    SET attempts = attempts + 1
    WHERE id = (
      SELECT id
      FROM public.phone_otp_codes
      WHERE user_id = v_uid
        AND phone = p_phone
        AND consumed_at IS NULL
        AND expires_at > NOW()
      ORDER BY created_at DESC
      LIMIT 1
    );
    RETURN FALSE;
  END IF;

  -- Marcăm codul ca folosit
  UPDATE public.phone_otp_codes
  SET consumed_at = NOW()
  WHERE id = v_otp_id;

  -- Activăm flag-ul local tranzacției curente (`is_local = true`)
  PERFORM set_config('renta.trusted_verification', 'on', true);

  -- Upsert în `public.profile_private`
  INSERT INTO public.profile_private (id, phone, phone_verified, updated_at)
  VALUES (v_uid, p_phone, TRUE, NOW())
  ON CONFLICT (id) DO UPDATE SET
    phone = EXCLUDED.phone,
    phone_verified = TRUE,
    updated_at = NOW();

  -- Actualizăm și badge-ul public din `public.profiles`
  UPDATE public.profiles
  SET phone_verified = TRUE, updated_at = NOW()
  WHERE id = v_uid;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION public.complete_phone_otp_verification(TEXT, TEXT) TO authenticated;

-- RPC 6.2: Finalizează verificarea KYB (ANAF CUI) pentru utilizatorul autentificat
CREATE OR REPLACE FUNCTION public.complete_company_kyb_verification(
  p_cui TEXT,
  p_company_name TEXT,
  p_company_address TEXT
)
RETURNS BOOLEAN AS $$
DECLARE
  v_uid UUID := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RETURN FALSE;
  END IF;

  PERFORM set_config('renta.trusted_verification', 'on', true);

  INSERT INTO public.profile_private (id, company_cui, updated_at)
  VALUES (v_uid, p_cui, NOW())
  ON CONFLICT (id) DO UPDATE SET
    company_cui = EXCLUDED.company_cui,
    updated_at = NOW();

  UPDATE public.profiles
  SET
    account_type = 'company',
    kyb_verified = TRUE,
    company_name = NULLIF(TRIM(p_company_name), ''),
    company_address = NULLIF(TRIM(p_company_address), ''),
    kyb_verified_at = NOW(),
    updated_at = NOW()
  WHERE id = v_uid;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION public.complete_company_kyb_verification(TEXT, TEXT, TEXT) TO authenticated;
