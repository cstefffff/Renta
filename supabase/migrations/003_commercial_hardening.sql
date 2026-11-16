-- ============================================================================
-- RentA (Valul 1 Comercial) — Migrația 003: Hardening DB, Separare PII,
-- Anti Double-Booking (GiST), State Machine Rezervări și Agregare Rating-uri
-- ============================================================================
-- Analogie pentru dezvoltatori C / Java:
--   1. Separarea `public.profiles` (Public) vs. `public.profile_private` (Privat)
--      este echivalentă cu separarea modificatorilor de acces `public` vs. `private`
--      într-o clasă Java sau pattern-ul Opaque Pointer în C.
--   2. Constrângerea `EXCLUDE USING gist` pe `daterange(start_date, end_date, '[]')`
--      acționează ca un Mutex atomic (`ReentrantLock`) gestionat de motorul
--      PostgreSQL pe axa timpului, făcând imposibil Double-Booking-ul la concurență.
--   3. Trigger-ul `enforce_booking_state_and_immutability` transformă coloanele
--      financiare în câmpuri `final` și impune un Automat Finit de Stări strict.
-- ============================================================================

-- 1. Activăm extensia btree_gist necesară pentru constrângerea EXCLUDE pe UUID + daterange
CREATE EXTENSION IF NOT EXISTS "btree_gist";

-- ============================================================================
-- 2. SEPARAREA DATELOR PERSONALE (PII) DIN public.profiles ÎN public.profile_private
-- ============================================================================

-- 2.1 Extindem public.profiles cu noile coloane publice de încredere și reputație
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS bio TEXT NULL CHECK (bio IS NULL OR char_length(bio) <= 500),
  ADD COLUMN IF NOT EXISTS phone_verified BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS kyb_verified BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS rating_avg NUMERIC(3, 2) NULL CHECK (rating_avg IS NULL OR (rating_avg >= 1.00 AND rating_avg <= 5.00)),
  ADD COLUMN IF NOT EXISTS rating_count INT NOT NULL DEFAULT 0 CHECK (rating_count >= 0);

-- 2.2 Creăm tabelul privat 1:1 pentru PII și roluri de sistem
CREATE TABLE IF NOT EXISTS public.profile_private (
  id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  phone TEXT NULL,
  company_cui TEXT NULL,
  phone_verified BOOLEAN NOT NULL DEFAULT FALSE,
  role TEXT NOT NULL DEFAULT 'user'
    CHECK (role IN ('user', 'moderator', 'admin')),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS trg_profile_private_updated_at ON public.profile_private;
CREATE TRIGGER trg_profile_private_updated_at
BEFORE UPDATE ON public.profile_private
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 2.3 Migrăm idempotent datele existente din public.profiles în public.profile_private
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'phone'
  ) THEN
    INSERT INTO public.profile_private (id, phone, company_cui, updated_at)
    SELECT id, phone, company_cui, NOW()
    FROM public.profiles
    ON CONFLICT (id) DO UPDATE SET
      phone = COALESCE(EXCLUDED.phone, public.profile_private.phone),
      company_cui = COALESCE(EXCLUDED.company_cui, public.profile_private.company_cui),
      updated_at = NOW();

    -- Eliminăm definitiv coloanele PII din tabelul public!
    ALTER TABLE public.profiles
      DROP COLUMN IF EXISTS phone,
      DROP COLUMN IF EXISTS company_cui;
  ELSE
    -- Asigurăm că fiecare profil existent are rând corespondent în profile_private
    INSERT INTO public.profile_private (id)
    SELECT id FROM public.profiles
    ON CONFLICT (id) DO NOTHING;
  END IF;
END $$;

-- 2.4 Trigger pe profile_private: Împiedică escaladarea privilegiilor (role / phone_verified)
-- de către utilizatorul obișnuit din client/API. Doar service_role sau postgres le pot schimba!
CREATE OR REPLACE FUNCTION public.protect_profile_private_columns()
RETURNS TRIGGER AS $$
BEGIN
  IF (auth.role() = 'authenticated' OR current_setting('request.jwt.claim.role', true) = 'authenticated') THEN
    IF NEW.role IS DISTINCT FROM OLD.role THEN
      RAISE EXCEPTION 'Operatie interzisa: Nu aveti permisiunea de a modifica rolul contului.';
    END IF;
    IF NEW.phone_verified IS DISTINCT FROM OLD.phone_verified THEN
      RAISE EXCEPTION 'Operatie interzisa: Statutul phone_verified poate fi actualizat doar de serviciul OTP.';
    END IF;
  END IF;

  -- Sincronizăm flag-ul public phone_verified în public.profiles când este modificat de backend
  IF NEW.phone_verified IS DISTINCT FROM OLD.phone_verified THEN
    UPDATE public.profiles
    SET phone_verified = NEW.phone_verified, updated_at = NOW()
    WHERE id = NEW.id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_protect_profile_private_cols ON public.profile_private;
CREATE TRIGGER trg_protect_profile_private_cols
BEFORE UPDATE ON public.profile_private
FOR EACH ROW EXECUTE FUNCTION public.protect_profile_private_columns();

-- 2.5 Trigger pe public.profiles: Împiedică utilizatorul să își falsifice singur
-- badge-urile publice (phone_verified, kyb_verified, rating_avg, rating_count)
CREATE OR REPLACE FUNCTION public.protect_public_profile_badges()
RETURNS TRIGGER AS $$
BEGIN
  IF (auth.role() = 'authenticated' OR current_setting('request.jwt.claim.role', true) = 'authenticated') THEN
    NEW.phone_verified := OLD.phone_verified;
    NEW.kyb_verified := OLD.kyb_verified;
    NEW.rating_avg := OLD.rating_avg;
    NEW.rating_count := OLD.rating_count;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_protect_public_profile_badges ON public.profiles;
CREATE TRIGGER trg_protect_public_profile_badges
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.protect_public_profile_badges();

-- 2.6 Actualizăm trigger-ul handle_new_user() pentru a popula ambele tabele la Sign-Up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  -- 1. Inserăm datele publice în public.profiles
  INSERT INTO public.profiles (
    id,
    display_name,
    account_type,
    city,
    avatar_url
  )
  VALUES (
    NEW.id,
    COALESCE(
      NULLIF(TRIM(NEW.raw_user_meta_data->>'display_name'), ''),
      split_part(NEW.email, '@', 1),
      'Utilizator RentA'
    ),
    CASE
      WHEN NEW.raw_user_meta_data->>'account_type' IN ('individual', 'company')
        THEN NEW.raw_user_meta_data->>'account_type'
      ELSE 'individual'
    END,
    COALESCE(
      NULLIF(TRIM(NEW.raw_user_meta_data->>'city'), ''),
      'București'
    ),
    NULLIF(TRIM(NEW.raw_user_meta_data->>'avatar_url'), '')
  )
  ON CONFLICT (id) DO UPDATE SET
    display_name = EXCLUDED.display_name,
    account_type = EXCLUDED.account_type,
    city = EXCLUDED.city,
    updated_at = NOW();

  -- 2. Inserăm datele sensibile (PII) în public.profile_private
  INSERT INTO public.profile_private (
    id,
    phone,
    company_cui
  )
  VALUES (
    NEW.id,
    NULLIF(TRIM(NEW.raw_user_meta_data->>'phone'), ''),
    NULLIF(TRIM(NEW.raw_user_meta_data->>'company_cui'), '')
  )
  ON CONFLICT (id) DO UPDATE SET
    phone = COALESCE(EXCLUDED.phone, public.profile_private.phone),
    company_cui = COALESCE(EXCLUDED.company_cui, public.profile_private.company_cui),
    updated_at = NOW();

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 2.7 Politici RLS pentru public.profile_private
ALTER TABLE public.profile_private ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profile_private_select_own" ON public.profile_private;
CREATE POLICY "profile_private_select_own"
  ON public.profile_private
  FOR SELECT
  USING (auth.uid() = id);

DROP POLICY IF EXISTS "profile_private_insert_own" ON public.profile_private;
CREATE POLICY "profile_private_insert_own"
  ON public.profile_private
  FOR INSERT
  WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "profile_private_update_own" ON public.profile_private;
CREATE POLICY "profile_private_update_own"
  ON public.profile_private
  FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- 2.8 Funcție RPC securizată (Getter controlat) pentru obținerea telefonului partenerului
-- doar într-o rezervare 'confirmed' sau 'completed'
CREATE OR REPLACE FUNCTION public.get_booking_partner_phone(p_booking_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_booking RECORD;
  v_target_user_id UUID;
  v_phone TEXT;
BEGIN
  SELECT id, renter_id, owner_id, status
  INTO v_booking
  FROM public.bookings
  WHERE id = p_booking_id;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  -- Verificăm că apelantul este fie chiriașul, fie proprietarul acelei rezervări
  IF auth.uid() = v_booking.renter_id THEN
    v_target_user_id := v_booking.owner_id;
  ELSIF auth.uid() = v_booking.owner_id THEN
    v_target_user_id := v_booking.renter_id;
  ELSE
    RAISE EXCEPTION 'Acces interzis: Nu sunteti participant la aceasta rezervare.';
  END IF;

  -- Numărul de telefon se dezvăluie DOAR după confirmarea rezervării
  IF v_booking.status NOT IN ('confirmed', 'completed') THEN
    RETURN NULL;
  END IF;

  SELECT phone INTO v_phone
  FROM public.profile_private
  WHERE id = v_target_user_id;

  RETURN v_phone;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_booking_partner_phone(UUID) TO authenticated;

-- ============================================================================
-- 3. EXTINDEREA public.listings (Garanție, Zile Minime, Politică Anulare, Rating)
-- ============================================================================
ALTER TABLE public.listings
  ADD COLUMN IF NOT EXISTS deposit_ron NUMERIC(10, 2) NOT NULL DEFAULT 0
    CHECK (deposit_ron >= 0),
  ADD COLUMN IF NOT EXISTS min_rental_days INT NOT NULL DEFAULT 1
    CHECK (min_rental_days >= 1),
  ADD COLUMN IF NOT EXISTS cancellation_policy TEXT NOT NULL DEFAULT 'moderate'
    CHECK (cancellation_policy IN ('flexible', 'moderate', 'strict')),
  ADD COLUMN IF NOT EXISTS rating_avg NUMERIC(3, 2) NULL
    CHECK (rating_avg IS NULL OR (rating_avg >= 1.00 AND rating_avg <= 5.00)),
  ADD COLUMN IF NOT EXISTS rating_count INT NOT NULL DEFAULT 0
    CHECK (rating_count >= 0);

-- ============================================================================
-- 4. TRIGGER RECALCULARE ATOMICĂ A RATING-URILOR (listings + profiles)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.recalculate_ratings()
RETURNS TRIGGER
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_listing_id UUID;
  v_target_user_id UUID;
BEGIN
  v_listing_id := COALESCE(NEW.listing_id, OLD.listing_id);
  v_target_user_id := COALESCE(NEW.target_user_id, OLD.target_user_id);

  -- 1. Recalculăm media și numărul de recenzii pentru Obiect (public.listings)
  IF v_listing_id IS NOT NULL THEN
    UPDATE public.listings
    SET
      rating_avg = sub.avg_rating,
      rating_count = sub.cnt
    FROM (
      SELECT
        ROUND(AVG(rating)::NUMERIC, 2) AS avg_rating,
        COUNT(*)::INT AS cnt
      FROM public.reviews
      WHERE listing_id = v_listing_id
    ) sub
    WHERE id = v_listing_id;
  END IF;

  -- 2. Recalculăm media și numărul de recenzii pentru Utilizatorul vizat (public.profiles)
  IF v_target_user_id IS NOT NULL THEN
    UPDATE public.profiles
    SET
      rating_avg = sub.avg_rating,
      rating_count = sub.cnt
    FROM (
      SELECT
        ROUND(AVG(rating)::NUMERIC, 2) AS avg_rating,
        COUNT(*)::INT AS cnt
      FROM public.reviews
      WHERE target_user_id = v_target_user_id
    ) sub
    WHERE id = v_target_user_id;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_reviews_recalculate_ratings ON public.reviews;
CREATE TRIGGER trg_reviews_recalculate_ratings
AFTER INSERT OR UPDATE OR DELETE ON public.reviews
FOR EACH ROW EXECUTE FUNCTION public.recalculate_ratings();

-- Sincronizăm inițial mediile de rating pentru recenziile deja existente în DB
UPDATE public.listings l
SET
  rating_avg = sub.avg_rating,
  rating_count = sub.cnt
FROM (
  SELECT listing_id, ROUND(AVG(rating)::NUMERIC, 2) AS avg_rating, COUNT(*)::INT AS cnt
  FROM public.reviews
  GROUP BY listing_id
) sub
WHERE l.id = sub.listing_id;

UPDATE public.profiles p
SET
  rating_avg = sub.avg_rating,
  rating_count = sub.cnt
FROM (
  SELECT target_user_id, ROUND(AVG(rating)::NUMERIC, 2) AS avg_rating, COUNT(*)::INT AS cnt
  FROM public.reviews
  GROUP BY target_user_id
) sub
WHERE p.id = sub.target_user_id;

-- ============================================================================
-- 5. PROTECȚIE ANTI DOUBLE-BOOKING (GiST) & STATE MACHINE PE public.bookings
-- ============================================================================

-- 5.1 Curățăm eventuale rezervări duplicate de test înainte de adăugarea constrângerii GiST
-- și adăugăm constrângerea EXCLUDE pe intervalul închis [start_date, end_date]
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'bookings_no_overlapping_confirmed'
  ) THEN
    -- Dacă există rezervări 'confirmed' suprapuse din teste anterioare, le trecem pe cele mai noi în 'cancelled'
    UPDATE public.bookings b1
    SET status = 'cancelled'
    WHERE b1.status = 'confirmed'
      AND EXISTS (
        SELECT 1 FROM public.bookings b2
        WHERE b2.listing_id = b1.listing_id
          AND b2.status = 'confirmed'
          AND b2.id <> b1.id
          AND daterange(b2.start_date, b2.end_date, '[]') && daterange(b1.start_date, b1.end_date, '[]')
          AND (b2.created_at < b1.created_at OR (b2.created_at = b1.created_at AND b2.id < b1.id))
      );

    ALTER TABLE public.bookings
      ADD CONSTRAINT bookings_no_overlapping_confirmed
      EXCLUDE USING gist (
        listing_id WITH =,
        daterange(start_date, end_date, '[]') WITH &&
      )
      WHERE (status = 'confirmed');
  END IF;
END $$;

-- 5.2 Trigger BEFORE UPDATE pe public.bookings:
--   a) Blochează modificarea câmpurilor imutabile (sume financiare, zile, ID-uri participanți)
--   b) Impune graful de tranziție al stărilor (State Machine) și rolul apelantului
CREATE OR REPLACE FUNCTION public.enforce_booking_state_and_immutability()
RETURNS TRIGGER AS $$
DECLARE
  v_caller UUID := auth.uid();
  v_is_authenticated BOOLEAN := (
    auth.role() = 'authenticated'
    OR current_setting('request.jwt.claim.role', true) = 'authenticated'
  );
BEGIN
  -- 1. Imutabilitatea datelor contractuale și financiare
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

  -- 2. Dacă statusul se schimbă, verificăm automatul finit de stări (State Machine)
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    -- Stările terminale nu mai pot fi modificate niciodată
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

DROP TRIGGER IF EXISTS trg_bookings_state_machine ON public.bookings;
CREATE TRIGGER trg_bookings_state_machine
BEFORE UPDATE ON public.bookings
FOR EACH ROW EXECUTE FUNCTION public.enforce_booking_state_and_immutability();

-- 5.3 Funcție RPC publică pentru obținerea intervalelor deja rezervate ('confirmed')
-- ale unui anunț (pentru afișarea zilelor ocupate în calendarul din UI fără a expune chiriașii)
CREATE OR REPLACE FUNCTION public.get_listing_unavailable_ranges(p_listing_id UUID)
RETURNS TABLE (start_date DATE, end_date DATE)
LANGUAGE sql
SECURITY DEFINER SET search_path = public
STABLE
AS $$
  SELECT b.start_date, b.end_date
  FROM public.bookings b
  WHERE b.listing_id = p_listing_id
    AND b.status = 'confirmed'
    AND b.end_date >= CURRENT_DATE
  ORDER BY b.start_date ASC;
$$;

GRANT EXECUTE ON FUNCTION public.get_listing_unavailable_ranges(UUID) TO anon, authenticated;
