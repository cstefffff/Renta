-- ============================================================================
-- RentA (Faza 15 / Extensie Super-Admin) — Migrația 009: Super-Admin Command Center
-- (Citire roluri `profile_private` pentru admin + 3 RPC-uri privilegiate cu Audit Log)
-- ============================================================================
-- Analogie pentru dezvoltatori C / Java:
--   1. Politica RLS `profile_private_select_admin` este echivalentul unei
--      permisiuni `@PreAuthorize("hasRole('ADMIN')")` pe tabelul privat:
--      administratorul poate vedea rolurile (`user | moderator | admin`) și
--      starea verificărilor tuturor conturilor, în timp ce utilizatorii
--      obișnuiți rămân izolați strict la propriul rând (`auth.uid() = id`).
--   2. Cele 3 funcții RPC `SECURITY DEFINER` rulează ca metode `@Transactional`
--      privilegiate: validează rolul admin, execută mutația atomică și scriu
--      obligatoriu o înregistrare imutabilă în `public.admin_audit_logs`.
--   3. Flag-urile locale pe tranzacție (`renta.trusted_verification` și
--      `renta.trusted_admin_override`) permit trecerea controlată de trigger-ele
--      de protecție din Migrația 003/005 exclusiv pe durata tranzacției RPC.
--
-- Această migrație este 100% IDEMPOTENTĂ (poate fi rulată de mai multe ori în
-- Supabase SQL Editor fără erori).
-- ============================================================================

-- ============================================================================
-- 1. POLITICĂ RLS SUPLIMENTARĂ PE `public.profile_private` PENTRU ADMIN
-- ============================================================================
DROP POLICY IF EXISTS "profile_private_select_admin" ON public.profile_private;
CREATE POLICY "profile_private_select_admin"
  ON public.profile_private
  FOR SELECT
  USING (public.is_current_user_admin());

-- ============================================================================
-- 2. COLOANA `updated_at` PE `public.bookings` & OVERRIDE CONTROLAT PENTRU ADMIN
-- ============================================================================
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- Actualizăm trigger-ul State Machine din Migrația 003:
--   - Păstrăm 100% imutabilitatea câmpurilor financiare și contractuale.
--   - Păstrăm State Machine-ul strict pentru utilizatorii normali.
--   - Permitem modificarea forțată de status EXCLUSIV când funcția privilegiată
--     `admin_force_booking_status` setează flag-ul local `renta.trusted_admin_override = 'on'`.
CREATE OR REPLACE FUNCTION public.enforce_booking_state_and_immutability()
RETURNS TRIGGER AS $$
DECLARE
  v_caller UUID := auth.uid();
  v_is_authenticated BOOLEAN := (
    auth.role() = 'authenticated'
    OR current_setting('request.jwt.claim.role', true) = 'authenticated'
  );
  v_admin_override BOOLEAN := (
    COALESCE(current_setting('renta.trusted_admin_override', true), '') = 'on'
  );
BEGIN
  -- 1. Imutabilitatea datelor contractuale și financiare (valabilă mereu)
  IF NEW.listing_id IS DISTINCT FROM OLD.listing_id
     OR NEW.renter_id IS DISTINCT FROM OLD.renter_id
     OR NEW.owner_id IS DISTINCT FROM OLD.owner_id
     OR NEW.start_date IS DISTINCT FROM OLD.start_date
     OR NEW.end_date IS DISTINCT FROM OLD.end_date
     OR NEW.total_days IS DISTINCT FROM OLD.total_days
     OR NEW.total_price_ron IS DISTINCT FROM OLD.total_price_ron
     OR NEW.platform_fee_ron IS DISTINCT FROM OLD.platform_fee_ron
     OR NEW.booking_code IS DISTINCT FROM OLD.booking_code
  THEN
    RAISE EXCEPTION 'Operatie interzisa: Parametrii financiari si contractuali ai unei rezervari sunt imutabili.';
  END IF;

  -- 2. Dacă statusul se schimbă și NU suntem în override administrativ auditat
  IF NEW.status IS DISTINCT FROM OLD.status AND NOT v_admin_override THEN
    -- Stările terminale nu mai pot fi modificate de utilizatori
    IF OLD.status IN ('rejected', 'completed', 'cancelled') THEN
      RAISE EXCEPTION 'Tranzitie invalida: Rezervarea se afla deja intr-o stare finala (%).', OLD.status;
    END IF;

    -- Din 'pending' -> doar 'confirmed', 'rejected' sau 'cancelled'
    IF OLD.status = 'pending' AND NEW.status NOT IN ('confirmed', 'rejected', 'cancelled') THEN
      RAISE EXCEPTION 'Tranzitie invalida din starea pending in %.', NEW.status;
    END IF;

    -- Din 'confirmed' -> doar 'completed' sau 'cancelled'
    IF OLD.status = 'confirmed' AND NEW.status NOT IN ('completed', 'cancelled') THEN
      RAISE EXCEPTION 'Tranzitie invalida din starea confirmed in %.', NEW.status;
    END IF;

    -- Verificare permisiuni per rol (când apelul vine de la un utilizator autentificat)
    IF v_is_authenticated THEN
      IF NEW.status IN ('confirmed', 'rejected', 'completed') AND v_caller <> OLD.owner_id THEN
        RAISE EXCEPTION 'Acces interzis: Doar proprietarul obiectului poate confirma, respinge sau finaliza rezervarea.';
      END IF;

      IF NEW.status = 'cancelled' AND v_caller NOT IN (OLD.renter_id, OLD.owner_id) THEN
        RAISE EXCEPTION 'Acces interzis: Doar participantii pot anula rezervarea.';
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 3. RPC-URI `SECURITY DEFINER` SUPER-ADMIN (CU AUDIT LOG ATOMIC)
-- ============================================================================

-- 3.1 Schimbare rol utilizator (`user` | `moderator` | `admin`)
CREATE OR REPLACE FUNCTION public.admin_set_user_role(
  p_target_user_id UUID,
  p_new_role TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin_id UUID := auth.uid();
  v_old_role TEXT;
BEGIN
  IF v_admin_id IS NULL OR NOT public.is_current_user_admin() THEN
    RAISE EXCEPTION 'Acces interzis';
  END IF;

  IF p_new_role NOT IN ('user', 'moderator', 'admin') THEN
    RAISE EXCEPTION 'Rol invalid: %. Rolurile permise sunt user, moderator, admin.', p_new_role;
  END IF;

  -- Protecție împotriva auto-blocării (un admin nu se poate retrograda singur)
  IF p_target_user_id = auth.uid() AND p_new_role <> 'admin' THEN
    RAISE EXCEPTION 'Nu îți poți revoca propriul rol de admin.';
  END IF;

  -- Verificăm existența profilului țintă
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = p_target_user_id) THEN
    RAISE EXCEPTION 'Utilizatorul (%) nu a fost găsit.', p_target_user_id;
  END IF;

  SELECT role INTO v_old_role
  FROM public.profile_private
  WHERE id = p_target_user_id;

  -- Flag local pe tranzacție pentru a trece controlat de trigger-ul `protect_profile_private_columns`
  PERFORM set_config('renta.trusted_verification', 'on', true);

  INSERT INTO public.profile_private (id, role)
  VALUES (p_target_user_id, p_new_role)
  ON CONFLICT (id) DO UPDATE SET
    role = EXCLUDED.role,
    updated_at = NOW();

  INSERT INTO public.admin_audit_logs (
    admin_id,
    action,
    target_type,
    target_id,
    details
  )
  VALUES (
    v_admin_id,
    'set_user_role',
    'profile',
    p_target_user_id::TEXT,
    jsonb_build_object(
      'previous_role', COALESCE(v_old_role, 'user'),
      'new_role', p_new_role
    )
  );
END;
$$;

-- 3.2 Forțare status rezervare (`pending` | `confirmed` | `completed` | `cancelled` | `rejected`)
CREATE OR REPLACE FUNCTION public.admin_force_booking_status(
  p_booking_id UUID,
  p_new_status TEXT,
  p_notes TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin_id UUID := auth.uid();
  v_old_status TEXT;
  v_booking_code TEXT;
BEGIN
  IF v_admin_id IS NULL OR NOT public.is_current_user_admin() THEN
    RAISE EXCEPTION 'Acces interzis';
  END IF;

  IF p_new_status NOT IN ('pending', 'confirmed', 'completed', 'cancelled', 'rejected') THEN
    RAISE EXCEPTION 'Status rezervare invalid: %', p_new_status;
  END IF;

  SELECT status, booking_code
  INTO v_old_status, v_booking_code
  FROM public.bookings
  WHERE id = p_booking_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Rezervarea (%) nu a fost găsită.', p_booking_id;
  END IF;

  -- Flag local pe tranzacție pentru override controlat al State Machine-ului
  PERFORM set_config('renta.trusted_admin_override', 'on', true);

  UPDATE public.bookings
  SET
    status = p_new_status,
    updated_at = NOW()
  WHERE id = p_booking_id;

  INSERT INTO public.admin_audit_logs (
    admin_id,
    action,
    target_type,
    target_id,
    details
  )
  VALUES (
    v_admin_id,
    'force_booking_status',
    'booking',
    p_booking_id::TEXT,
    jsonb_build_object(
      'booking_code', v_booking_code,
      'previous_status', v_old_status,
      'new_status', p_new_status,
      'notes', NULLIF(BTRIM(COALESCE(p_notes, '')), '')
    )
  );
END;
$$;

-- 3.3 Trimitere notificare de sistem către un utilizator
CREATE OR REPLACE FUNCTION public.admin_send_system_notification(
  p_target_user_id UUID,
  p_title TEXT,
  p_body TEXT,
  p_action_url TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin_id UUID := auth.uid();
  v_clean_title TEXT := BTRIM(COALESCE(p_title, ''));
  v_clean_body TEXT := BTRIM(COALESCE(p_body, ''));
  v_clean_url TEXT := NULLIF(BTRIM(COALESCE(p_action_url, '')), '');
  v_notification_id UUID;
BEGIN
  IF v_admin_id IS NULL OR NOT public.is_current_user_admin() THEN
    RAISE EXCEPTION 'Acces interzis';
  END IF;

  IF char_length(v_clean_title) < 2 OR char_length(v_clean_title) > 160 THEN
    RAISE EXCEPTION 'Titlul notificării trebuie să aibă între 2 și 160 de caractere.';
  END IF;

  IF char_length(v_clean_body) < 2 OR char_length(v_clean_body) > 2000 THEN
    RAISE EXCEPTION 'Mesajul notificării trebuie să aibă între 2 și 2000 de caractere.';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = p_target_user_id) THEN
    RAISE EXCEPTION 'Utilizatorul destinatar (%) nu a fost găsit.', p_target_user_id;
  END IF;

  INSERT INTO public.notifications (
    user_id,
    type,
    title,
    body,
    action_url
  )
  VALUES (
    p_target_user_id,
    'system',
    v_clean_title,
    v_clean_body,
    v_clean_url
  )
  RETURNING id INTO v_notification_id;

  INSERT INTO public.admin_audit_logs (
    admin_id,
    action,
    target_type,
    target_id,
    details
  )
  VALUES (
    v_admin_id,
    'send_system_notification',
    'profile',
    p_target_user_id::TEXT,
    jsonb_build_object(
      'notification_id', v_notification_id,
      'title', v_clean_title,
      'action_url', v_clean_url
    )
  );
END;
$$;

-- ============================================================================
-- 4. PERMISIUNI DE EXECUȚIE (Principle of Least Privilege)
-- ============================================================================
REVOKE ALL ON FUNCTION public.admin_set_user_role(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_set_user_role(UUID, TEXT) TO authenticated;

REVOKE ALL ON FUNCTION public.admin_force_booking_status(UUID, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_force_booking_status(UUID, TEXT, TEXT) TO authenticated;

REVOKE ALL ON FUNCTION public.admin_send_system_notification(UUID, TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_send_system_notification(UUID, TEXT, TEXT, TEXT) TO authenticated;
