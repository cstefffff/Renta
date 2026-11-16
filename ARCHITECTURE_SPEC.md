# Specificație de Arhitectură — RentA (MVP)

Acest document definește arhitectura tehnică, schema bazei de date PostgreSQL (Supabase), politicile de securitate (RLS) și contractele TypeScript dintre **Backend** și **Frontend** pentru platforma **RentA** (marketplace românesc P2P & B2C pentru închirierea de obiecte fizice).

Documentul este redactat cu analogii directe din **C / Java** pentru a facilita tranziția către ecosistemul **TypeScript + Next.js (App Router) + Supabase**.

---

## 1. Analogie Arhitecturală (C / Java $\rightarrow$ Next.js + Supabase)

Dacă vii din zona de C sau Java (Spring Boot / aplicații desktop sau consolă), arhitectura modernă full-stack din Next.js poate părea inițial că „amestecă" frontend-ul cu backend-ul. În realitate, există o separare foarte strictă a execuției:

### 1.1 Structuri de Date: `struct` / `class` $\rightarrow$ `interface` / `type` (TypeScript)
- În **C** folosești `struct Listing { ... };`, iar în **Java** folosești clase POJO / `record` / `interface`.
- În **TypeScript**, definim contractele de date prin `interface` sau `type`. Acestea există **doar la compilare** (type-checking static, exact ca în Java) și dispar la runtime în JavaScript, oferind zero overhead de memorie.

### 1.2 App Router: Ierarhie de Pachete bazată pe Sistemul de Fișiere
- În **Java (Spring)**, configurezi rutele cu adnotări precum `@RequestMapping("/listings/{id}")` pe o clasă Controller.
- În **Next.js App Router**, structura directoarelor din `src/app/` **este** tabela de rutare:
  - `src/app/page.tsx` $\rightarrow$ ruta `/` (Home)
  - `src/app/listings/[id]/page.tsx` $\rightarrow$ ruta `/listings/:id` (Detaliu obiect)
  - `src/app/dashboard/page.tsx` $\rightarrow$ ruta `/dashboard` (Panou utilizator)

### 1.3 Server Components (RSC) vs. Client Components
| Concept | Analogie Java / C | Unde rulează? | Rol în RentA |
| :--- | :--- | :--- | :--- |
| **Server Component** *(implicit în Next.js)* | Metodă de Controller + View Template (ex. Thymeleaf/JSP) care face query direct în DB și returnează HTML gata randat. | **Exclusiv pe Server (Node.js)**. Codul nu ajunge niciodată în browser. | Citirea datelor din Supabase (`SELECT`), verificarea sesiunii, afișarea paginilor de catalog și detalii. |
| **Client Component** *(marcat cu `'use client'` în capul fișierului)* | Aplicație GUI (JavaFX / Swing) care rulează pe mașina clientului și reacționează la click-uri, input-uri și stare locală. | **În Browser** (pre-randat și pe server pentru SEO). | Formulare interactive, filtre dinamice, selectoare de dată (calendar), butoane cu stare (`useState`). |

### 1.4 Server Actions (`'use server'`) $\rightarrow$ Metode RPC / Service Layer
- În loc să scrii manual câte un endpoint REST (`POST /api/bookings`), un DTO parser și un apel `fetch()` cu serializare JSON în frontend, Next.js oferă **Server Actions**.
- **Analogia Java:** Gândește-te la o funcție marcată cu `'use server'` ca la o metodă publică dintr-un `@Service` / `@RestController` expusă prin **RPC (Remote Procedure Call)**.
- Din Client Component apelezi direct `await createBooking(formData)` ca pe o funcție normală. În spate, Next.js face automat o cerere HTTP `POST` securizată către server, execută codul pe backend (conectându-se la Supabase) și întoarce rezultatul tipizat.

### 1.5 Supabase (PostgreSQL + Auth + Storage + RLS)
- **PostgreSQL** este motorul relațional complet (tabele, Foreign Keys, constrângeri `CHECK`, trigger-e PL/pgSQL).
- **Row Level Security (RLS)** funcționează ca un **Firewall la nivel de rând în baza de date**. Chiar dacă cineva încearcă să apeleze baza de date direct, motorul Postgres verifică automat `auth.uid()` (ID-ul utilizatorului extras din token-ul JWT) înainte de orice `SELECT`, `INSERT`, `UPDATE` sau `DELETE`.

---

## 2. Schema Bazei de Date Rafinată (PostgreSQL / Supabase)

Mai jos este schema DDL completă, proiectată pentru estetica de **catalog de inventar** a platformei RentA (cu coduri unice de catalog `#OBJ-0001` și de rezervare `#REZ-0001`).

```sql
-- Activare extensie pentru generare UUID
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- 1. SECVENȚE PENTRU CODURI DE CATALOG (#OBJ-0001, #REZ-0001)
-- ============================================================================
CREATE SEQUENCE IF NOT EXISTS public.listing_catalog_seq START WITH 1 INCREMENT BY 1;
CREATE SEQUENCE IF NOT EXISTS public.booking_code_seq START WITH 1 INCREMENT BY 1;

-- Funcție utilitară pentru actualizarea automată a coloanei updated_at
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 2. TABELUL: profiles (Extensie 1:1 a tabelului intern Supabase auth.users)
-- ============================================================================
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  account_type TEXT NOT NULL DEFAULT 'individual'
    CHECK (account_type IN ('individual', 'company')),
  company_cui TEXT NULL, -- Opțional, relevant doar pentru account_type = 'company'
  city TEXT NOT NULL DEFAULT 'București', -- ex. 'București', 'Cluj-Napoca', 'Timișoara', 'Iași', 'Brașov'
  phone TEXT NULL,
  avatar_url TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_profiles_updated_at
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Trigger automat: Creare profil la înregistrarea unui utilizator nou în auth.users
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
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'account_type', 'individual'),
    NEW.raw_user_meta_data->>'company_cui',
    COALESCE(NEW.raw_user_meta_data->>'city', 'București'),
    NEW.raw_user_meta_data->>'phone',
    NEW.raw_user_meta_data->>'avatar_url'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================================
-- 3. TABELUL: listings (Obiectele listate spre închiriere)
-- ============================================================================
CREATE TABLE public.listings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  catalog_code TEXT UNIQUE NOT NULL DEFAULT (
    '#OBJ-' || LPAD(nextval('public.listing_catalog_seq')::TEXT, 4, '0')
  ),
  owner_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL CHECK (char_length(title) BETWEEN 3 AND 120),
  description TEXT NOT NULL,
  category TEXT NOT NULL, -- slug: 'scule-bricolaj', 'foto-video', 'camping-outdoor', 'evenimente', ' gaming-tech', 'sport-auto'
  price_per_day NUMERIC(10, 2) NOT NULL CHECK (price_per_day > 0), -- în RON
  price_per_hour NUMERIC(10, 2) NULL CHECK (price_per_hour IS NULL OR price_per_hour > 0),
  city TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'available'
    CHECK (status IN ('available', 'unavailable', 'archived')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_listings_owner_id ON public.listings(owner_id);
CREATE INDEX idx_listings_category_city_status ON public.listings(category, city, status);
CREATE INDEX idx_listings_created_at ON public.listings(created_at DESC);

CREATE TRIGGER trg_listings_updated_at
BEFORE UPDATE ON public.listings
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================================
-- 4. TABELUL: listing_images (Galeria foto a fiecărui obiect)
-- ============================================================================
CREATE TABLE public.listing_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id UUID NOT NULL REFERENCES public.listings(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL, -- Calea internă în bucket-ul Supabase Storage
  url TEXT NOT NULL,          -- URL-ul public al imaginii
  display_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_listing_images_listing_order ON public.listing_images(listing_id, display_order);

-- ============================================================================
-- 5. TABELUL: bookings (Cereri de închiriere și rezervări)
-- ============================================================================
CREATE TABLE public.bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_code TEXT UNIQUE NOT NULL DEFAULT (
    '#REZ-' || LPAD(nextval('public.booking_code_seq')::TEXT, 4, '0')
  ),
  listing_id UUID NOT NULL REFERENCES public.listings(id) ON DELETE RESTRICT,
  renter_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE, -- Denormalizat pt. interogări și RLS ultra-rapid
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

CREATE INDEX idx_bookings_listing_id ON public.bookings(listing_id);
CREATE INDEX idx_bookings_renter_id ON public.bookings(renter_id);
CREATE INDEX idx_bookings_owner_id ON public.bookings(owner_id);
CREATE INDEX idx_bookings_status_dates ON public.bookings(listing_id, status, start_date, end_date);

-- ============================================================================
-- 6. TABELUL: reviews (Recenzii reciproce după finalizarea închirierii)
-- ============================================================================
CREATE TABLE public.reviews (
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

CREATE INDEX idx_reviews_listing_id ON public.reviews(listing_id);
CREATE INDEX idx_reviews_target_user_id ON public.reviews(target_user_id);
```

### Explicații Cheie pentru Arhitectura DB:
1. **Generarea Codurilor (`#OBJ-0001`, `#REZ-0001`):** Folosim `SEQUENCE` nativ din PostgreSQL combinat cu `LPAD(..., 4, '0')`. Este atomic, thread-safe (fără race conditions la inserări simultane) și nu necesită logică suplimentară în codul TypeScript.
2. **Denormalizarea `owner_id` în `bookings`:** În mod strict academic (Forma Normală 3), `owner_id` s-ar afla doar în `listings`. Îl stocăm explicit și în `bookings` pentru ca interogările din Dashboard („Arată-mi toate cererile primite pentru obiectele mele”) și verificarea RLS să nu facă `JOIN` pe fiecare rând.
3. **Calculul `total_days`:** Convenția în închirieri de echipamente este **inclusivă** (`(end_date - start_date) + 1` zile). Dacă închiriezi de azi până azi, este `1 zi`.

---

## 3. Matricea Row Level Security (RLS) & Storage

Toate tabelele au RLS activat (`ALTER TABLE ... ENABLE ROW LEVEL SECURITY;`).

### 3.1 Matricea Politicilor pe Tabele

| Tabel | Operație | Cine are acces? | Condiție SQL (`USING` / `WITH CHECK`) |
| :--- | :--- | :--- | :--- |
| **`profiles`** | `SELECT` | Public (oricine) | `true` (profilurile proprietarilor și chiriașilor sunt vizibile pe platformă) |
| **`profiles`** | `UPDATE` | Doar proprietarul profilului | `auth.uid() = id` |
| **`profiles`** | `INSERT` | Sistemul (Trigger) / Utilizatorul | `auth.uid() = id` (executat automat prin trigger `SECURITY DEFINER`) |
| **`listings`** | `SELECT` | Public (pt. active) sau Proprietarul | `status <> 'archived' OR auth.uid() = owner_id` |
| **`listings`** | `INSERT` | Utilizatori autentificați | `auth.uid() = owner_id` |
| **`listings`** | `UPDATE` | Doar proprietarul obiectului | `auth.uid() = owner_id` |
| **`listings`** | `DELETE` | Doar proprietarul obiectului | `auth.uid() = owner_id` |
| **`listing_images`** | `SELECT` | Public (oricine) | `true` |
| **`listing_images`** | `INSERT / UPDATE / DELETE` | Proprietarul anunțului părinte | `EXISTS (SELECT 1 FROM public.listings l WHERE l.id = listing_id AND l.owner_id = auth.uid())` |
| **`bookings`** | `SELECT` | Doar Chiriașul sau Proprietarul | `auth.uid() = renter_id OR auth.uid() = owner_id` |
| **`bookings`** | `INSERT` | Chiriașul autentificat | `auth.uid() = renter_id AND renter_id <> owner_id` |
| **`bookings`** | `UPDATE` | Chiriașul sau Proprietarul | `auth.uid() = renter_id OR auth.uid() = owner_id` *(tranzițiile de status sunt validate strict și în Server Action)* |
| **`reviews`** | `SELECT` | Public (oricine) | `true` |
| **`reviews`** | `INSERT` | Participant la o rezervare finalizată | `auth.uid() = author_id AND EXISTS (SELECT 1 FROM public.bookings b WHERE b.id = booking_id AND b.status = 'completed' AND (b.renter_id = auth.uid() OR b.owner_id = auth.uid()))` |

### 3.2 Politici Supabase Storage (Buckets)

Vom configura două bucket-uri publice pentru citire, dar restricționate la scriere prin structura de foldere `{user_id}/...`:

1. **Bucket `listing-images` (Public Read):**
   - **Cale standard:** `{user_id}/{listing_id}/{filename}`
   - **`SELECT`:** Public (`bucket_id = 'listing-images'`).
   - **`INSERT` / `UPDATE` / `DELETE`:** Doar utilizatorii autentificați în propriul lor folder:
     `bucket_id = 'listing-images' AND (storage.foldername(name))[1] = auth.uid()::text`
2. **Bucket `avatars` (Public Read):**
   - **Cale standard:** `{user_id}/avatar.{ext}`
   - **`SELECT`:** Public (`bucket_id = 'avatars'`).
   - **`INSERT` / `UPDATE` / `DELETE`:** Doar proprietarul contului:
     `bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text`

---

## 4. Contractul Server Actions & Data Fetching (TypeScript)

Acesta este contractul oficial (echivalentul fișierelor header `.h` din C sau al interfețelor de Service din Java) pe care **`renta-backend`** îl implementează în `src/types/` și `src/actions/`, iar **`renta-frontend`** îl consumă în pagini și componente.

### 4.1 Tipuri de Bază și DTO-uri (`src/types/database.ts`)

```typescript
export type AccountType = 'individual' | 'company';
export type ListingStatus = 'available' | 'unavailable' | 'archived';
export type BookingStatus = 'pending' | 'confirmed' | 'rejected' | 'completed' | 'cancelled';

export type CategorySlug =
  | 'scule-bricolaj'
  | 'foto-video'
  | 'camping-outdoor'
  | 'evenimente-party'
  | 'gaming-tech'
  | 'sport-mobilitate';

// Răspuns standardizat pentru orice Server Action (echivalent cu Result<T> în Rust/Java)
export type ActionResponse<T = void> =
  | { success: true; data: T; error?: never }
  | { success: false; error: string; fieldErrors?: Record<string, string[]>; data?: never };

export interface Profile {
  id: string;
  display_name: string;
  account_type: AccountType;
  company_cui: string | null;
  city: string;
  phone: string | null;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface ListingImage {
  id: string;
  listing_id: string;
  storage_path: string;
  url: string;
  display_order: number;
  created_at: string;
}

export interface Listing {
  id: string;
  catalog_code: string; // ex. "#OBJ-0001"
  owner_id: string;
  title: string;
  description: string;
  category: CategorySlug;
  price_per_day: number; // RON
  price_per_hour: number | null;
  city: string;
  status: ListingStatus;
  created_at: string;
  updated_at: string;
}

// DTO îmbogățit pentru afișarea în UI (include relațiile JOIN cu owner și imagini)
export interface ListingWithDetails extends Listing {
  owner: Pick<Profile, 'id' | 'display_name' | 'account_type' | 'city' | 'avatar_url' | 'phone'>;
  images: ListingImage[];
  average_rating?: number | null;
  reviews_count?: number;
}

export interface Booking {
  id: string;
  booking_code: string; // ex. "#REZ-0001"
  listing_id: string;
  renter_id: string;
  owner_id: string;
  start_date: string; // YYYY-MM-DD
  end_date: string;   // YYYY-MM-DD
  total_days: number;
  total_price_ron: number;
  platform_fee_ron: number;
  status: BookingStatus;
  notes: string | null;
  created_at: string;
}

export interface BookingWithDetails extends Booking {
  listing: Pick<Listing, 'id' | 'catalog_code' | 'title' | 'price_per_day' | 'city'> & {
    primary_image_url?: string | null;
  };
  renter: Pick<Profile, 'id' | 'display_name' | 'phone' | 'city' | 'avatar_url'>;
  owner: Pick<Profile, 'id' | 'display_name' | 'phone' | 'city' | 'avatar_url'>;
}

export interface Review {
  id: string;
  booking_id: string;
  author_id: string;
  target_user_id: string;
  listing_id: string;
  rating: number; // 1..5
  comment: string | null;
  created_at: string;
  author?: Pick<Profile, 'id' | 'display_name' | 'avatar_url'>;
}
```

### 4.2 Semnăturile Funcțiilor de Data Fetching & Server Actions

#### A. Autentificare & Profil (`src/actions/auth.ts` & `src/actions/profile.ts`)
```typescript
// Autentificare cu email & parolă
export async function signInAction(formData: FormData): Promise<ActionResponse<{ redirectTo: string }>>;

// Înregistrare cont nou (trimite metadata pt. trigger-ul handle_new_user)
export async function signUpAction(input: {
  email: string;
  password: string;
  display_name: string;
  account_type: AccountType;
  company_cui?: string;
  city: string;
  phone?: string;
}): Promise<ActionResponse<{ userId: string }>>;

// Deconectare sesiune curentă
export async function signOutAction(): Promise<ActionResponse>;

// Obținere profil utilizator autentificat (pentru Navbar / Dashboard)
export async function getCurrentProfile(): Promise<Profile | null>;

// Actualizare date profil
export async function updateProfileAction(input: {
  display_name: string;
  account_type: AccountType;
  company_cui?: string | null;
  city: string;
  phone?: string | null;
  avatar_url?: string | null;
}): Promise<ActionResponse<Profile>>;
```

#### B. Catalog & Anunțuri (`src/actions/listings.ts`)
```typescript
export interface ListingFilters {
  query?: string;          // Căutare în titlu / descriere / catalog_code
  category?: CategorySlug;
  city?: string;
  minPrice?: number;
  maxPrice?: number;
  accountType?: AccountType; // Filtrare P2P ('individual') vs B2C ('company')
  sortBy?: 'newest' | 'price_asc' | 'price_desc';
}

// [Query - Server Component] Listare anunțuri în pagina de catalog
export async function getListings(filters?: ListingFilters): Promise<ListingWithDetails[]>;

// [Query - Server Component] Detaliile unui anunț după ID sau catalog_code
export async function getListingById(id: string): Promise<ListingWithDetails | null>;

// [Query - Server Component] Anunțurile proprietarului curent în Dashboard
export async function getMyListings(): Promise<ListingWithDetails[]>;

// [Mutation - Server Action] Publicare obiect nou
export async function createListingAction(input: {
  title: string;
  description: string;
  category: CategorySlug;
  price_per_day: number;
  price_per_hour?: number | null;
  city: string;
  images?: { storage_path: string; url: string; display_order: number }[];
}): Promise<ActionResponse<Listing>>;

// [Mutation - Server Action] Actualizare anunț sau schimbare status ('available' | 'unavailable' | 'archived')
export async function updateListingAction(
  listingId: string,
  input: Partial<{
    title: string;
    description: string;
    category: CategorySlug;
    price_per_day: number;
    price_per_hour: number | null;
    city: string;
    status: ListingStatus;
  }>
): Promise<ActionResponse<Listing>>;
```

#### C. Rezervări / Închirieri (`src/actions/bookings.ts`)
```typescript
// [Mutation - Server Action] Trimitere cerere de închiriere
// Calculează automat pe server: total_days, total_price_ron și platform_fee_ron (ex. 10%)
export async function createBookingAction(input: {
  listing_id: string;
  start_date: string; // YYYY-MM-DD
  end_date: string;   // YYYY-MM-DD
  notes?: string;
}): Promise<ActionResponse<Booking>>;

// [Query - Server Component] Rezervările în care utilizatorul curent este Chiriaș (Renter)
export async function getMyRentals(): Promise<BookingWithDetails[]>;

// [Query - Server Component] Cererile de rezervare primite pentru obiectele utilizatorului curent (Owner)
export async function getIncomingBookings(): Promise<BookingWithDetails[]>;

// [Mutation - Server Action] Tranziție de status cu verificare de rol:
// - Owner poate trece din 'pending' -> 'confirmed' sau 'rejected', și din 'confirmed' -> 'completed'
// - Renter poate trece din 'pending' sau 'confirmed' -> 'cancelled'
export async function updateBookingStatusAction(
  bookingId: string,
  newStatus: BookingStatus
): Promise<ActionResponse<Booking>>;
```

#### D. Recenzii (`src/actions/reviews.ts`)
```typescript
// [Query - Server Component] Lista de recenzii pentru un obiect
export async function getListingReviews(listingId: string): Promise<Review[]>;

// [Mutation - Server Action] Adăugare recenzie (permisă doar dacă booking.status === 'completed')
export async function createReviewAction(input: {
  booking_id: string;
  rating: number;
  comment?: string;
}): Promise<ActionResponse<Review>>;
```

---

## 5. Structura Directoarelor Proiectului (`c:\Users\User\Desktop\Renta`)

```text
c:\Users\User\Desktop\Renta\
├── ARCHITECTURE_SPEC.md          # Acest document de arhitectură
├── supabase/
│   ├── migrations/
│   │   └── 0001_initial_schema.sql  # Scriptul DDL + Trigger-e + RLS
│   └── seed.sql                     # Date demo românești (București, Cluj etc.)
└── src/
    ├── types/
    │   └── database.ts              # Interfețele și DTO-urile din Secțiunea 4.1
    ├── lib/
    │   └── supabase/
    │       ├── client.ts            # Client Supabase pt. Browser (Client Components)
    │       ├── server.ts            # Client Supabase pt. Server (RSC & Server Actions)
    │       └── middleware.ts        # Refresh automat de sesiune JWT
    ├── actions/                     # Server Actions ('use server' - Controller/Service layer)
    │   ├── auth.ts
    │   ├── profile.ts
    │   ├── listings.ts
    │   ├── bookings.ts
    │   └── reviews.ts
    ├── components/                  # Componente UI reutilizabile (stil Catalog Neo-Brutalist/Editorial)
    └── app/                         # Rutele aplicației Next.js App Router
        ├── layout.tsx
        ├── page.tsx                 # Home + Catalog principal
        ├── listings/
        │   ├── new/page.tsx         # Formular adăugare obiect
        │   └── [id]/page.tsx        # Fișa tehnică de inventar a obiectului + Rezervare
        ├── dashboard/
        │   └── page.tsx             # Panou: Obiectele mele, Cereri primite, Închirierile mele
        └── auth/
            ├── login/page.tsx
            └── register/page.tsx
```


---

# Partea II — Arhitectura Comercială (Valul 1, Fazele 10–16)

Această secțiune extinde arhitectura MVP v0 pentru **Lansarea Comercială Pilot (Valul 1)** a platformei **RentA**, fără a introduce microservicii sau complexitate inutilă.

## 6. Foaia de Parcurs Arhitecturală — Valul 1 (Fazele 10–16)

| Fază | Obiectiv Comercial | Componente Tehnice Principale |
| :--- | :--- | :--- |
| **Faza 10** | **Hardening DB, Securitate PII & CRUD Complet** | Migrația `003_commercial_hardening.sql` (`profile_private`, `btree_gist` anti double-booking, State Machine rezervări, trigger rating-uri), validări `zod`, editare/arhivare anunț, galerie multi-foto, paginare și sortare catalog. |
| **Faza 11** | **Plăți, Escrow & Garanții (Stripe Connect Express)** | Onboarding Stripe Connect pentru proprietari, Checkout Session cu `transfer_data` + `application_fee_amount` (comision RentA), pre-autorizare garanție (`deposit_ron` cu `capture_method: 'manual'`), webhook-uri idempotente. |
| **Faza 12** | **Încredere, Verificare Telefon (P2P) & ANAF (B2C)** | Verificare telefon prin SMS OTP (cost-efficient pentru P2P), interogare automată CUI la ANAF (KYB pentru firme B2C), protocol foto obligatoriu la predare/primire (*Check-in / Check-out Evidence*). |
| **Faza 13.2** | **Notificări Tranzacționale (Resend)** | Email-uri automate la cerere nouă, confirmare/respingere rezervare, plată confirmată și reminder predare/returnare. |
| **Faza 14** | **Conformitate Legală RO/GDPR & Facturare SRL** | Contract digital de închiriere + Proces-Verbal de predare-primire generat PDF per rezervare, consimțământ GDPR, integrare SmartBill/Oblio pentru facturarea comisionului platformei. |
| **Faza 15.1** | **Panou Admin & Moderare Minimă** | Rută protejată `/admin` (verificată prin `profile_private.role = 'admin'`), moderare anunțuri raportate, gestionare dispute și deblocare/capturare garanții. |
| **Faza 16** | **CI/CD, Observabilitate & Producție** | Sentry error tracking, rate-limiting pe Server Actions critice, backup-uri automate DB, pipeline GitHub Actions (`tsc`, `eslint`, build). |

---

## 7. Analogii C / Java pentru Faza 10 (Hardening Comercial)

### 7.1 Separarea `profiles` (Public) vs. `profile_private` (Privat) $\rightarrow$ Încapsulare `public` vs. `private`
- **Problema din MVP v0:** În PostgreSQL, politica RLS `SELECT USING (true)` se aplică pe **întregul rând** (toate coloanele). Dacă `phone` și `company_cui` stau în `public.profiles`, orice vizitator care apelează API-ul Supabase PostgREST cu cheia publică `ANON_KEY` poate descărca toate numerele de telefon din baza de date (`SELECT phone FROM profiles`), chiar dacă în codul Next.js nu le afișăm în UI!
- **Analogia Java / C:**
  - În **Java**, nu declari niciodată câmpurile sensibile `public String phone;` într-o clasă expusă tuturor; le declari `private` și oferi un getter controlat (`getPhoneForConfirmedPartner(Caller caller)`).
  - În **C**, folosești pattern-ul *Opaque Pointer* (`struct ProfilePrivate;` în `.c`, în timp ce în header-ul `.h` public expui doar `struct PublicProfile`).
- **Soluția în PostgreSQL:** Despărțim datele în două tabele legate 1:1 prin același UUID:
  1. `public.profiles` — conține **exclusiv date publice** (`display_name`, `city`, `bio`, `avatar_url`, `phone_verified`, `kyb_verified`, `rating_avg`, `rating_count`). Poate avea `SELECT USING (true)` fără niciun risc GDPR.
  2. `public.profile_private` — conține **PII și roluri** (`phone`, `company_cui`, `role`). Are RLS strict `auth.uid() = id`. Partenerul dintr-o rezervare confirmată accesează numărul de telefon **exclusiv** printr-o funcție RPC `SECURITY DEFINER` (`get_booking_partner_phone`), exact ca un getter securizat din Java.

### 7.2 Constrângerea `EXCLUDE USING gist` $\rightarrow$ Mutex / Semafor Atomic pe Intervale de Timp
- **Problema de concurență (Race Condition):** Dacă doi chiriași apasă pe rezervare pentru același obiect în aceeași secundă, sau dacă proprietarul confirmă din greșeală două cereri care se suprapun parțial (ex. `10-14 Mai` și `12-16 Mai`), o verificare simplă în TypeScript (`if (hasOverlap) return error`) poate fi păcălită de execuția paralelă a două request-uri (Time-Of-Check to Time-Of-Use / TOCTOU).
- **Analogia C / Java:** Echivalentul unui `synchronized` block sau `ReentrantLock` / `pthread_mutex_t` gestionat direct de kernel-ul bazei de date pe axa timpului.
- **Soluția în PostgreSQL:** Extensia `btree_gist` ne permite să definim o constrângere matematică pe intervale închise `daterange(start_date, end_date, '[]')` cu operatorul de suprapunere `&&`. Motorul Postgres garantează la nivel de index că **nu pot exista niciodată două rezervări cu `status = 'confirmed'` pe același `listing_id` ale căror intervale de zile se intersectează**.

### 7.3 Trigger-ul State Machine pe `bookings` $\rightarrow$ Câmpuri `final` + Automat Finit de Stări
- **Analogia Java:** Într-o clasă `Booking` de producție, câmpurile financiare calculabile la creare (`totalPriceRon`, `platformFeeRon`, `listingId`, `renterId`, `ownerId`) sunt declarate `private final` — nu mai pot fi modificate ulterior prin `setTotalPriceRon(1)`. În plus, metoda `transitionTo(BookingStatus next)` aruncă `IllegalStateException` dacă cineva încearcă să treacă o rezervare din `completed` înapoi în `pending`.
- **Soluția în PostgreSQL:** Un trigger `BEFORE UPDATE ON public.bookings` verifică invariantele: blochează orice modificare a coloanelor financiare/participanți și validează graful de tranziție al stărilor (`pending -> confirmed | rejected | cancelled`, `confirmed -> completed | cancelled`).

---

## 8. Specificația SQL Completă — Migrația `003_commercial_hardening.sql` (Faza 10)

Acest fișier SQL (`supabase/migrations/003_commercial_hardening.sql`) este idempotent și migrează în siguranță datele existente din schema MVP (001 & 002) la arhitectura comercială din Faza 10.

```sql
-- ============================================================================
-- RentA (Valul 1 Comercial) — Migrația 003: Hardening DB, Separare PII,
-- Anti Double-Booking (GiST), State Machine Rezervări și Agregare Rating-uri
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

-- 2.3 Migrăm datele existente din public.profiles în public.profile_private (dacă coloanele mai există)
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
  -- Dacă apelul vine de la un utilizator autentificat obișnuit prin PostgREST (nu service_role / superuser)
  IF current_setting('request.jwt.claim.role', true) = 'authenticated' THEN
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
  IF current_setting('request.jwt.claim.role', true) = 'authenticated' THEN
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
  v_jwt_role TEXT := current_setting('request.jwt.claim.role', true);
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
    IF v_jwt_role = 'authenticated' THEN
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
```

---

## 9. Contractele TypeScript Noi & Validări `zod` (Faza 10)

### 9.1 Actualizarea `lib/types/database.ts`

Pentru a păstra compatibilitatea cu componentele UI deja construite și a introduce separarea strictă Public/Privat:

```typescript
export type UserRole = "user" | "moderator" | "admin";
export type CancellationPolicy = "flexible" | "moderate" | "strict";

export type CatalogSortOption =
  | "newest"
  | "price_asc"
  | "price_desc"
  | "rating_desc";

/**
 * Rândul public din `public.profiles` (100% sigur pentru expunere publică).
 * Câmpurile `phone` și `company_cui` sunt opționale în interfața TypeScript
 * doar pentru atunci când sunt atașate explicit pe server din `profile_private`
 * pentru utilizatorul propriu.
 */
export interface Profile {
  id: string;
  display_name: string;
  account_type: AccountType;
  city: string;
  bio: string | null;
  avatar_url: string | null;
  phone_verified: boolean;
  kyb_verified: boolean;
  rating_avg: number | null;
  rating_count: number;
  created_at: string;
  updated_at: string;
  // Câmpuri din profile_private (populate DOAR pentru propriul profil în Dashboard
  // sau prin RPC-ul get_booking_partner_phone în rezervările confirmate):
  phone?: string | null;
  company_cui?: string | null;
}

/**
 * Rândul din `public.profile_private` (accesibil doar proprietarului contului / admin).
 */
export interface ProfilePrivate {
  id: string;
  phone: string | null;
  company_cui: string | null;
  phone_verified: boolean;
  role: UserRole;
  updated_at: string;
}

/**
 * Rândul extins din `public.listings` (include garanția, durata minimă, politica de anulare și rating-ul).
 */
export interface Listing {
  id: string;
  catalog_code: string;
  owner_id: string;
  title: string;
  description: string;
  category: CategorySlug;
  price_per_day: number;
  price_per_hour: number | null;
  deposit_ron: number; // Garanție returnabilă în RON (0 = fără garanție)
  min_rental_days: number; // Durata minimă de închiriere (implicit 1 zi)
  cancellation_policy: CancellationPolicy; // 'flexible' | 'moderate' | 'strict'
  rating_avg: number | null;
  rating_count: number;
  city: string;
  status: ListingStatus;
  created_at: string;
  updated_at: string;
}

/**
 * Interval ocupat returnat de RPC-ul `get_listing_unavailable_ranges`.
 */
export interface UnavailableDateRange {
  start_date: string; // YYYY-MM-DD
  end_date: string;   // YYYY-MM-DD
}

/**
 * Parametrii extinși pentru filtrarea, sortarea și paginarea catalogului (`/catalog`).
 */
export interface CatalogFilters {
  segment?: "all" | "individual" | "company";
  q?: string;
  category?: string;
  city?: string;
  minPrice?: number;
  maxPrice?: number;
  sort?: CatalogSortOption;
  page?: number;
  pageSize?: number;
}

export interface PaginatedCatalogResult {
  items: ListingWithDetails[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
}
```

### 9.2 Schemele de Validare `zod` (`lib/validations/`)

**Analogie Java:** În Spring Boot folosești Jakarta Bean Validation (`@NotBlank`, `@Min(1)`, `@Size(min = 3, max = 120)`) pe clasele de Request DTO. În TypeScript/Next.js folosim biblioteca **`zod`**, care validează datele la runtime în Server Actions și generează automat `fieldErrors` pentru formulare.

Vom organiza validările în 3 module sub `lib/validations/`:
1. `lib/validations/listings.ts`:
   - `createListingSchema` & `updateListingSchema`: validează `title` (3..120 caractere), `description` (20..4000 caractere), `category`, `city`, `price_per_day` ($> 0$, max $50\,000$ RON), `price_per_hour` (opțional), `deposit_ron` ($\ge 0$, max $100\,000$ RON), `min_rental_days` ($1..365$), `cancellation_policy` (`'flexible' | 'moderate' | 'strict'`).
2. `lib/validations/bookings.ts`:
   - `createBookingSchema`: validează `listing_id` (UUID), `start_date` și `end_date` (format `YYYY-MM-DD`, `end_date >= start_date`, `start_date >= azi`), `notes` (max 1000 caractere).
   - `createReviewSchema`: validează `booking_id` (UUID), `rating` (întreg $1..5$), `comment` ($5..1000$ caractere).
3. `lib/validations/profile.ts`:
   - `updateProfileSchema`: validează `display_name` ($2..80$ caractere), `account_type`, `city`, `bio` (max 500 caractere), `phone` (format telefon RO `^(\+?40|0)\s?7\d{2}[\s.-]?\d{3}[\s.-]?\d{3}$` sau gol), `company_cui` (format CUI RO `^(RO)?\s?\d{2,10}$`, obligatoriu când `account_type === 'company'`).

### 9.3 Noi Server Actions în Faza 10 (`M10.2` – `M10.4`)

- **`actions/listings.ts`**:
  - `updateListingAction(listingId: string, formData: FormData | Record<string, unknown>): Promise<ActionResponse<Listing>>` — editează titlul, descrierea, prețurile, garanția, zilele minime, politica de anulare, orașul și imaginile.
  - `deleteOrArchiveListingAction(listingId: string): Promise<ActionResponse<{ mode: 'deleted' | 'archived' }>>` — dacă obiectul nu are nicio rezervare în istoric, îl șterge definitiv (`DELETE`); dacă are rezervări existente (`ON DELETE RESTRICT`), îl trece automat în `status = 'archived'` (Soft Delete) și curăță cache-ul.
  - `getUnavailableDateRanges(listingId: string): Promise<UnavailableDateRange[]>` — apelează RPC-ul `get_listing_unavailable_ranges` pentru a afișa zilele blocate în pagina obiectului.
- **`actions/profile.ts`**:
  - `getMyFullProfile(): Promise<(Profile & { privateData: ProfilePrivate | null }) | null>` — citește `public.profiles` + `public.profile_private` pentru utilizatorul autentificat.
  - `updateProfileAction(formData: FormData | Record<string, unknown>): Promise<ActionResponse<Profile>>` — actualizează atomic datele publice în `public.profiles`, datele PII (`phone`, `company_cui`) în `public.profile_private` și opțional încarcă noul avatar în bucket-ul `avatars`.
- **`actions/bookings.ts`**:
  - `getBookingPartnerPhoneAction(bookingId: string): Promise<ActionResponse<{ phone: string | null }>>` — apelează RPC-ul `get_booking_partner_phone(bookingId)`. De asemenea, `getMyRentals()` și `getIncomingBookings()` vor atașa telefonul partenerului doar pentru rezervările în starea `confirmed` sau `completed`.
