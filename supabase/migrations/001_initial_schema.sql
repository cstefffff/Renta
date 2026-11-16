-- ============================================================================
-- RentA (MVP) — Migrația 001: Schema Inițială, Secvențe, Indecși și Trigger-e
-- ============================================================================
-- Analogie pentru dezvoltatori C / Java:
--   - Tabelele PostgreSQL sunt echivalentul structurilor (struct în C) sau al
--     entităților JPA / claselor POJO (@Entity în Java Spring/Hibernate), dar
--     persistate pe disc cu garanții ACID.
--   - Constrângerile CHECK și UNIQUE sunt invariante de domeniu verificate direct
--     de motorul bazei de date (ca niște aserțiuni / validări în constructorul
--     clasei care nu pot fi ocolite nici măcar dacă apelezi DB-ul direct).
--   - Trigger-ele PL/pgSQL sunt echivalentul unor Event Listeners / Hooks
--     (@PrePersist / @PreUpdate în JPA) care rulează automat în interiorul
--     aceleiași tranzacții SQL.
-- ============================================================================

-- Activăm extensia pgcrypto pentru generarea de UUID-uri (gen_random_uuid())
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- 1. SECVENȚE PENTRU CODURI DE CATALOG (#OBJ-0001, #REZ-0001)
-- ============================================================================
-- Analogie C/Java: Gândește-te la o secvență PostgreSQL ca la un `AtomicLong`
-- din Java (`java.util.concurrent.atomic.AtomicLong`). Este garantat thread-safe:
-- chiar dacă 100 de utilizatori publică un anunț în aceeași milisecundă,
-- `nextval()` va returna numere strict crescătoare fără race conditions.
CREATE SEQUENCE IF NOT EXISTS public.listing_catalog_seq START WITH 1 INCREMENT BY 1;
CREATE SEQUENCE IF NOT EXISTS public.booking_code_seq START WITH 1 INCREMENT BY 1;

-- Funcție utilitară de tip Trigger pentru actualizarea automată a coloanei `updated_at`
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 2. TABELUL: public.profiles
-- Extensie 1:1 a tabelului intern de autentificare `auth.users` din Supabase
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  account_type TEXT NOT NULL DEFAULT 'individual'
    CHECK (account_type IN ('individual', 'company')),
  company_cui TEXT NULL, -- Opțional, relevant pentru firme / centre de închiriere (B2C)
  city TEXT NOT NULL DEFAULT 'București',
  phone TEXT NULL,
  avatar_url TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS trg_profiles_updated_at ON public.profiles;
CREATE TRIGGER trg_profiles_updated_at
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================================
-- Trigger automat: Creare profil la înregistrarea unui utilizator în auth.users
-- ============================================================================
-- Notă tehnică importantă:
-- `SECURITY DEFINER SET search_path = public` înseamnă că funcția se execută cu
-- privilegiile creatorului ei (postgres), având permisiunea de a insera în
-- `public.profiles` în momentul în care Supabase Auth creează rândul în `auth.users`.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (
    id,
    display_name,
    account_type,
    company_cui,
    city,
    phone,
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
    NULLIF(TRIM(NEW.raw_user_meta_data->>'company_cui'), ''),
    COALESCE(
      NULLIF(TRIM(NEW.raw_user_meta_data->>'city'), ''),
      'București'
    ),
    NULLIF(TRIM(NEW.raw_user_meta_data->>'phone'), ''),
    NULLIF(TRIM(NEW.raw_user_meta_data->>'avatar_url'), '')
  )
  ON CONFLICT (id) DO UPDATE SET
    display_name = EXCLUDED.display_name,
    account_type = EXCLUDED.account_type,
    company_cui = COALESCE(EXCLUDED.company_cui, public.profiles.company_cui),
    city = EXCLUDED.city,
    phone = COALESCE(EXCLUDED.phone, public.profiles.phone),
    updated_at = NOW();

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================================
-- 3. TABELUL: public.listings (Obiectele listate spre închiriere)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.listings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  catalog_code TEXT UNIQUE NOT NULL DEFAULT (
    '#OBJ-' || LPAD(nextval('public.listing_catalog_seq')::TEXT, 4, '0')
  ),
  owner_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL CHECK (char_length(title) BETWEEN 3 AND 120),
  description TEXT NOT NULL,
  category TEXT NOT NULL, -- ex: 'scule-bricolaj', 'foto-video', 'camping-outdoor', etc.
  price_per_day NUMERIC(10, 2) NOT NULL CHECK (price_per_day > 0), -- exprimat în RON
  price_per_hour NUMERIC(10, 2) NULL CHECK (price_per_hour IS NULL OR price_per_hour > 0),
  city TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'available'
    CHECK (status IN ('available', 'unavailable', 'archived')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_listings_owner_id ON public.listings(owner_id);
CREATE INDEX IF NOT EXISTS idx_listings_category_city_status ON public.listings(category, city, status);
CREATE INDEX IF NOT EXISTS idx_listings_created_at ON public.listings(created_at DESC);

DROP TRIGGER IF EXISTS trg_listings_updated_at ON public.listings;
CREATE TRIGGER trg_listings_updated_at
BEFORE UPDATE ON public.listings
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================================
-- 4. TABELUL: public.listing_images (Galeria foto a fiecărui obiect)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.listing_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id UUID NOT NULL REFERENCES public.listings(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL, -- Calea internă din bucket-ul Supabase Storage ('listing-images')
  url TEXT NOT NULL,          -- URL-ul public de afișare
  display_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_listing_images_listing_order ON public.listing_images(listing_id, display_order);

-- ============================================================================
-- 5. TABELUL: public.bookings (Cereri de închiriere și rezervări)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_code TEXT UNIQUE NOT NULL DEFAULT (
    '#REZ-' || LPAD(nextval('public.booking_code_seq')::TEXT, 4, '0')
  ),
  listing_id UUID NOT NULL REFERENCES public.listings(id) ON DELETE RESTRICT,
  renter_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE, -- Denormalizat pt. interogări și RLS rapid
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  total_days INT NOT NULL CHECK (total_days >= 1),
  total_price_ron NUMERIC(10, 2) NOT NULL CHECK (total_price_ron >= 0),
  platform_fee_ron NUMERIC(10, 2) NOT NULL DEFAULT 0 CHECK (platform_fee_ron >= 0),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'confirmed', 'rejected', 'completed', 'cancelled')),
  notes TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Constrângeri de integritate a domeniului (Business Rules la nivel de DB)
  CONSTRAINT chk_booking_dates CHECK (end_date >= start_date),
  CONSTRAINT chk_renter_not_owner CHECK (renter_id <> owner_id)
);

CREATE INDEX IF NOT EXISTS idx_bookings_listing_id ON public.bookings(listing_id);
CREATE INDEX IF NOT EXISTS idx_bookings_renter_id ON public.bookings(renter_id);
CREATE INDEX IF NOT EXISTS idx_bookings_owner_id ON public.bookings(owner_id);
CREATE INDEX IF NOT EXISTS idx_bookings_status_dates ON public.bookings(listing_id, status, start_date, end_date);

-- ============================================================================
-- 6. TABELUL: public.reviews (Recenzii reciproce după finalizarea închirierii)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  target_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  listing_id UUID NOT NULL REFERENCES public.listings(id) ON DELETE CASCADE,
  rating INT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Un utilizator poate lăsa o singură recenzie per rezervare și nu își poate da singur review
  CONSTRAINT uq_review_booking_author UNIQUE (booking_id, author_id),
  CONSTRAINT chk_review_not_self CHECK (author_id <> target_user_id)
);

CREATE INDEX IF NOT EXISTS idx_reviews_listing_id ON public.reviews(listing_id);
CREATE INDEX IF NOT EXISTS idx_reviews_target_user_id ON public.reviews(target_user_id);
