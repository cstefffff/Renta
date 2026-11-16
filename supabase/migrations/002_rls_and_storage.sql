-- ============================================================================
-- RentA (MVP) — Migrația 002: Row Level Security (RLS) și Supabase Storage
-- ============================================================================
-- Analogie pentru dezvoltatori C / Java:
--   - În Spring Security (Java), securizezi metodele cu `@PreAuthorize("...")`
--     în stratul de aplicație. Dacă un dezvoltator uită adnotarea pe un endpoint
--     nou, datele rămân expuse.
--   - În Supabase / PostgreSQL, Row Level Security (RLS) mută această verificare
--     chiar în motorul bazei de date: fiecare interogare (`SELECT`, `INSERT`,
--     `UPDATE`, `DELETE`) primește automat o clauză `WHERE` invizibilă bazată pe
--     `auth.uid()` (ID-ul utilizatorului extras criptografic din token-ul JWT).
-- ============================================================================

-- ============================================================================
-- 1. ACTIVARE ROW LEVEL SECURITY PE TOATE CELE 5 TABELE
-- ============================================================================
-- Odată ce RLS este activat pe un tabel, IMPLICIT nimeni nu mai poate citi sau
-- scrie niciun rând (Politica "Deny All by Default") până nu definim explicit
-- politicile de mai jos.
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.listings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.listing_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 2. POLITICI RLS PENTRU: public.profiles
-- ============================================================================

-- SELECT: Profilurile sunt publice (vizitatorii pot vedea cine închiriază un obiect)
DROP POLICY IF EXISTS "profiles_select_public" ON public.profiles;
CREATE POLICY "profiles_select_public"
  ON public.profiles
  FOR SELECT
  USING (true);

-- INSERT: Utilizatorul își poate insera doar propriul profil (în completarea trigger-ului)
DROP POLICY IF EXISTS "profiles_insert_own" ON public.profiles;
CREATE POLICY "profiles_insert_own"
  ON public.profiles
  FOR INSERT
  WITH CHECK (auth.uid() = id);

-- UPDATE: Doar proprietarul contului își poate edita propriul profil
DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
CREATE POLICY "profiles_update_own"
  ON public.profiles
  FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- DELETE: Doar proprietarul contului își poate șterge profilul
DROP POLICY IF EXISTS "profiles_delete_own" ON public.profiles;
CREATE POLICY "profiles_delete_own"
  ON public.profiles
  FOR DELETE
  USING (auth.uid() = id);

-- ============================================================================
-- 3. POLITICI RLS PENTRU: public.listings
-- ============================================================================

-- SELECT: Oricine vede anunțurile ne-arhivate; proprietarul își vede și anunțurile arhivate
DROP POLICY IF EXISTS "listings_select_public_or_owner" ON public.listings;
CREATE POLICY "listings_select_public_or_owner"
  ON public.listings
  FOR SELECT
  USING (status <> 'archived' OR auth.uid() = owner_id);

-- INSERT: Orice utilizator autentificat poate publica un anunț în nume propriu
DROP POLICY IF EXISTS "listings_insert_owner" ON public.listings;
CREATE POLICY "listings_insert_owner"
  ON public.listings
  FOR INSERT
  WITH CHECK (auth.uid() = owner_id);

-- UPDATE: Doar proprietarul obiectului poate modifica detaliile sau statusul anunțului
DROP POLICY IF EXISTS "listings_update_owner" ON public.listings;
CREATE POLICY "listings_update_owner"
  ON public.listings
  FOR UPDATE
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);

-- DELETE: Doar proprietarul obiectului poate șterge anunțul
DROP POLICY IF EXISTS "listings_delete_owner" ON public.listings;
CREATE POLICY "listings_delete_owner"
  ON public.listings
  FOR DELETE
  USING (auth.uid() = owner_id);

-- ============================================================================
-- 4. POLITICI RLS PENTRU: public.listing_images
-- ============================================================================

-- SELECT: Imaginile obiectelor sunt vizibile public pentru toți vizitatorii catalogului
DROP POLICY IF EXISTS "listing_images_select_public" ON public.listing_images;
CREATE POLICY "listing_images_select_public"
  ON public.listing_images
  FOR SELECT
  USING (true);

-- INSERT: Doar proprietarul anunțului părinte poate atașa imagini
DROP POLICY IF EXISTS "listing_images_insert_owner" ON public.listing_images;
CREATE POLICY "listing_images_insert_owner"
  ON public.listing_images
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.listings l
      WHERE l.id = listing_id AND l.owner_id = auth.uid()
    )
  );

-- UPDATE: Doar proprietarul anunțului părinte poate reordona/actualiza imaginile
DROP POLICY IF EXISTS "listing_images_update_owner" ON public.listing_images;
CREATE POLICY "listing_images_update_owner"
  ON public.listing_images
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.listings l
      WHERE l.id = listing_id AND l.owner_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.listings l
      WHERE l.id = listing_id AND l.owner_id = auth.uid()
    )
  );

-- DELETE: Doar proprietarul anunțului părinte poate șterge imagini din galerie
DROP POLICY IF EXISTS "listing_images_delete_owner" ON public.listing_images;
CREATE POLICY "listing_images_delete_owner"
  ON public.listing_images
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.listings l
      WHERE l.id = listing_id AND l.owner_id = auth.uid()
    )
  );

-- ============================================================================
-- 5. POLITICI RLS PENTRU: public.bookings
-- ============================================================================

-- SELECT: Confidențialitate strictă — doar Chiriașul (renter) și Proprietarul (owner)
-- pot vedea rezervarea
DROP POLICY IF EXISTS "bookings_select_participants" ON public.bookings;
CREATE POLICY "bookings_select_participants"
  ON public.bookings
  FOR SELECT
  USING (auth.uid() = renter_id OR auth.uid() = owner_id);

-- INSERT: Un utilizator autentificat poate crea o cerere doar ca renter și nu pt. propriul obiect
DROP POLICY IF EXISTS "bookings_insert_renter" ON public.bookings;
CREATE POLICY "bookings_insert_renter"
  ON public.bookings
  FOR INSERT
  WITH CHECK (auth.uid() = renter_id AND renter_id <> owner_id);

-- UPDATE: Chiriașul (pt. anulare) sau Proprietarul (pt. confirmare/respingere/finalizare)
DROP POLICY IF EXISTS "bookings_update_participants" ON public.bookings;
CREATE POLICY "bookings_update_participants"
  ON public.bookings
  FOR UPDATE
  USING (auth.uid() = renter_id OR auth.uid() = owner_id)
  WITH CHECK (auth.uid() = renter_id OR auth.uid() = owner_id);

-- DELETE: Chiriașul își poate șterge o cerere doar dacă este încă în starea 'pending'
DROP POLICY IF EXISTS "bookings_delete_pending_renter" ON public.bookings;
CREATE POLICY "bookings_delete_pending_renter"
  ON public.bookings
  FOR DELETE
  USING (auth.uid() = renter_id AND status = 'pending');

-- ============================================================================
-- 6. POLITICI RLS PENTRU: public.reviews
-- ============================================================================

-- SELECT: Recenziile sunt publice pe pagina obiectului și pe profilul utilizatorilor
DROP POLICY IF EXISTS "reviews_select_public" ON public.reviews;
CREATE POLICY "reviews_select_public"
  ON public.reviews
  FOR SELECT
  USING (true);

-- INSERT: Doar un participant (renter sau owner) la o rezervare finalizată ('completed')
-- poate lăsa o recenzie
DROP POLICY IF EXISTS "reviews_insert_completed_booking_participant" ON public.reviews;
CREATE POLICY "reviews_insert_completed_booking_participant"
  ON public.reviews
  FOR INSERT
  WITH CHECK (
    auth.uid() = author_id
    AND EXISTS (
      SELECT 1 FROM public.bookings b
      WHERE b.id = booking_id
        AND b.status = 'completed'
        AND (b.renter_id = auth.uid() OR b.owner_id = auth.uid())
    )
  );

-- UPDATE: Autorul își poate edita propria recenzie
DROP POLICY IF EXISTS "reviews_update_author" ON public.reviews;
CREATE POLICY "reviews_update_author"
  ON public.reviews
  FOR UPDATE
  USING (auth.uid() = author_id)
  WITH CHECK (auth.uid() = author_id);

-- DELETE: Autorul își poate șterge propria recenzie
DROP POLICY IF EXISTS "reviews_delete_author" ON public.reviews;
CREATE POLICY "reviews_delete_author"
  ON public.reviews
  FOR DELETE
  USING (auth.uid() = author_id);

-- ============================================================================
-- 7. SUPABASE STORAGE: Bucket-urile `listing-images` și `avatars` + Politici RLS
-- ============================================================================
-- Creăm cele două bucket-uri cu citire publică (public = true), dar scriere
-- protejată prin RLS în funcție de primul folder din cale: `{user_id}/...`

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  (
    'listing-images',
    'listing-images',
    true,
    5242880, -- 5 MB limită per imagine
    ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/avif']
  ),
  (
    'avatars',
    'avatars',
    true,
    2097152, -- 2 MB limită per avatar
    ARRAY['image/jpeg', 'image/png', 'image/webp']
  )
ON CONFLICT (id) DO NOTHING;

-- Politici pentru bucket-ul `listing-images`
DROP POLICY IF EXISTS "storage_listing_images_select_public" ON storage.objects;
CREATE POLICY "storage_listing_images_select_public"
  ON storage.objects
  FOR SELECT
  USING (bucket_id = 'listing-images');

DROP POLICY IF EXISTS "storage_listing_images_insert_own_folder" ON storage.objects;
CREATE POLICY "storage_listing_images_insert_own_folder"
  ON storage.objects
  FOR INSERT
  WITH CHECK (
    bucket_id = 'listing-images'
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "storage_listing_images_update_own_folder" ON storage.objects;
CREATE POLICY "storage_listing_images_update_own_folder"
  ON storage.objects
  FOR UPDATE
  USING (
    bucket_id = 'listing-images'
    AND (storage.foldername(name))[1] = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = 'listing-images'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "storage_listing_images_delete_own_folder" ON storage.objects;
CREATE POLICY "storage_listing_images_delete_own_folder"
  ON storage.objects
  FOR DELETE
  USING (
    bucket_id = 'listing-images'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Politici pentru bucket-ul `avatars`
DROP POLICY IF EXISTS "storage_avatars_select_public" ON storage.objects;
CREATE POLICY "storage_avatars_select_public"
  ON storage.objects
  FOR SELECT
  USING (bucket_id = 'avatars');

DROP POLICY IF EXISTS "storage_avatars_insert_own_folder" ON storage.objects;
CREATE POLICY "storage_avatars_insert_own_folder"
  ON storage.objects
  FOR INSERT
  WITH CHECK (
    bucket_id = 'avatars'
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "storage_avatars_update_own_folder" ON storage.objects;
CREATE POLICY "storage_avatars_update_own_folder"
  ON storage.objects
  FOR UPDATE
  USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "storage_avatars_delete_own_folder" ON storage.objects;
CREATE POLICY "storage_avatars_delete_own_folder"
  ON storage.objects
  FOR DELETE
  USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
