# Changelog — Proiectul RentA

Toate modificările notabile, deciziile arhitecturale și validările QA ale platformei **RentA** sunt documentate cronologic în acest fișier.

---

## [v0.8.0-storefront-ui-redesign] — 2026-11-16
### Schimbat & Adăugat (Modern Storefront / E-Commerce Dashboard UI Redesign)
- **Design System Modular & Tokeni Semantici (`tailwind.config.ts` & `src/app/globals.css`)** (`renta-frontend`):
  - Trecerea la arhitectura vizuală **Modern Storefront / E-Commerce Dashboard** (inspirată din referința „Corelystics Store > Products”), construită pe variabile CSS semantice ușor de personalizat în viitor: fundaluri luminoase `#F8FAFC` / `#FFFFFF` / `#F1F5F9`, tipografie Slate `#0F172A` și accent principal **Emerald Teal (`#109E82`)** cu hover `#0D856D` și tint `#E6F6F3`.
  - Păstrarea mapărilor semantice în `tailwind.config.ts` astfel încât toate paginile existente și noile componente să împartă aceeași temă unitară, cu raze de curbură moderne (`rounded-xl`, `rounded-2xl`), umbre fine (`shadow-card`, `shadow-card-hover`) și suport `accent-color` cu fallback `@supports not (accent-color: #109E82)` conform best-practices din `modern-web-guidance`.
- **App Shell cu Sidebar Rail Vertical & Top Header Storefront (`src/components/layout/SidebarRail.tsx`, `Header.tsx`, `MobileNav.tsx`, `Footer.tsx`, `BrandLogo.tsx`, `src/app/layout.tsx`)** (`renta-frontend`):
  - **Componentă nouă `SidebarRail.tsx`**: bară laterală verticală fixă pe desktop (`w-16`) cu logo compact, buton circular verde-smarald `+` pentru adăugare rapidă obiect (`/listarile-mele/nou`), iconițe de navigație cu stare activă pentru Acasă, Catalog, Obiectele Mele, Rezervări, Profil și indicator de sesiune/avatar în partea inferioară.
  - **Top Header Storefront (`Header.tsx`)**: breadcrumb contextual `RentA Store › Catalog & Închirieri`, bară de căutare centrală rotunjită (`rounded-full`) cu scurtătură `⌘ + F` conectată la `/catalog`, badge de regiune `🇷🇴 RO` și acțiuni rapide de cont.
- **Catalog pe 2 Coloane cu Filter Sidebar & Carduri Storefront (`src/components/catalog/ObjectCard.tsx`, `FilterBar.tsx`, `src/app/catalog/page.tsx`)** (`renta-frontend`):
  - **Carduri de produs moderne (`ObjectCard.tsx`)**: container alb `rounded-2xl` cu casetă foto gri-deschis (`#F1F5F9`), badge discret P2P / Firmă + `#OBJ-XXXX`, rând cu titlu + buton inimioară (wishlist UI), 5 stele galbene (`#F59E0B`) + contor recenzii, pin de locație, preț/zi + garanție și buton verde-smarald pe toată lățimea **„Închiriază acum”**.
  - **Sidebar vertical de filtre (`FilterBar.tsx`) & Layout 2 coloane (`app/catalog/page.tsx`)**: panou lateral stânga (`280px` pe desktop) cu `Filter (`n`)` + `Clear all`, chip-uri active cu buton `×`, checkbox-uri verzi pentru **Categorie** și **Interval Preț / Zi**, pill-uri cu bulină colorată pentru **Oraș / Locație**, pill-uri de **Rating** (`5 ★`, `> 4 ★`, `Toate`) și **Segment Proprietar** (`Toate`, `P2P`, `Firme B2C`), sincronizate cu grila de produse și selectorul `Sort by:` din dreapta.
- **Aliniere Homepage, Detaliu Obiect & Booking Widget (`src/app/page.tsx`, `src/app/obiect/[id]/page.tsx`, `src/components/bookings/BookingWidget.tsx`)** (`renta-frontend`):
  - Toate secțiunile publice și widgetul de rezervare au fost aliniate la estetica luminoasă Storefront cu suprafețe albe rotunjite, ierarhie tipografică curată și butoane de acțiune Emerald Teal (`#109E82`).

### Verificare QA (`renta-qa-tracker`)
- **TypeScript Check (`npx.cmd tsc --noEmit`)**: **0 erori** (`exit code 0`).
- **Status Roadmap**: Faza 10 (`M10.1`–`M10.4`) și Redesign-ul Storefront (`v0.8.0`) sunt complete în cod; următorul pas din roadmap rămâne **Faza 11 (`M11.1`–`M11.3`): Plăți Reale, Split Comision & Garanție/Escrow (Stripe Connect)**.

---

## [v0.7.0-commercial-hardening] — 2026-11-16
### Adăugat & Întărit (Faza 10: Hardening Securitate, Remediere Bug-uri MVP & Finalizare CRUD — `M10.1`–`M10.4`)
- **Securitate Infrastructură, Validare & Rate Limiting (`M10.1`, `M10.4`)** (`renta-backend`):
  - **Upgrade Next.js la `15.5.29`** în `package.json` pentru remedierea vulnerabilității critice `CVE-2025-66478`.
  - **Migrare la fonturi locale self-hosted (`next/font/local` + `@fontsource-variable/archivo`, `@fontsource-variable/inter`, `@fontsource-variable/jetbrains-mono`)** în `app/layout.tsx`, eliminând dependența de rețea față de Google Fonts la build și îmbunătățind confidențialitatea GDPR și viteza de încărcare.
  - **Headere HTTP de Securitate** în `next.config.ts` (`X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy`, `X-DNS-Prefetch-Control`) și configurare `experimental.serverActions.bodySizeLimit: "20mb"` pentru upload-ul sigur de imagini.
  - **Protecție rută de diagnosticare `/status-db`** (`app/status-db/page.tsx`): restricționată automat în producție (`NODE_ENV === "production"`) doar pentru utilizatori autentificați cu rolul `admin` în `public.profile_private` (returnează `notFound()` pentru restul vizitatorilor).
  - **Scheme de validare centralizate cu `zod`** în `lib/validations/schemas.ts` (`signUpSchema`, `signInSchema`, `updateProfileSchema`, `listingSchema`, `bookingSchema`, `bookingStatusSchema`, `reviewSchema`, `catalogFilterSchema`) cu mesaje în limba română și validări pentru telefon RO și CUI.
  - **Rate Limiter Server-Side (`lib/security/rate-limit.ts`)**: algoritm Sliding Window / Token Bucket cu identificare IP din headerele proxy (`x-forwarded-for`, `x-real-ip`), integrat în toate Server Actions sensibile (`auth.ts`, `listings.ts`, `bookings.ts`, `reviews.ts`).
- **Hardening Bază de Date PostgreSQL & Separare PII (`M10.2` — `supabase/migrations/003_commercial_hardening.sql`)** (`renta-backend`):
  - **Separare GDPR / PII în `public.profile_private`**: mutarea idempotentă a coloanelor `phone` și `company_cui` (plus `role` și `phone_verified`) din tabelul public `public.profiles` în tabelul privat `public.profile_private`, protejat prin RLS strict (`auth.uid() = id`).
  - **Triggere anti-escaladare privilegii**: `protect_profile_private_columns()` (blochează modificarea `role` și `phone_verified` din client) și `protect_public_profile_badges()` (blochează falsificarea `phone_verified`, `kyb_verified`, `rating_avg`, `rating_count` pe `public.profiles`).
  - **Funcție RPC `get_booking_partner_phone(p_booking_id UUID)`**: dezvăluie numărul de telefon al celuilalt participant exclusiv părților implicate într-o rezervare și doar după ce aceasta a ajuns în starea `confirmed` sau `completed`.
  - **Protecție matematică Anti Double-Booking (`btree_gist`)**: constrângerea `EXCLUDE USING gist (listing_id WITH =, daterange(start_date, end_date, '[]') WITH &&) WHERE (status = 'confirmed')` pe `public.bookings` face imposibilă suprapunerea a două rezervări confirmate pe același obiect, chiar și la cereri concurente în aceeași milisecundă.
  - **State Machine & Imutabilitate în SQL (`enforce_booking_state_and_immutability`)**: trigger `BEFORE UPDATE` pe `public.bookings` care interzice modificarea ulterioară a prețului, zilelor sau participanților și validează graful de tranziții (`pending -> confirmed/rejected/cancelled -> completed`) în funcție de rolul apelantului (`owner_id` vs `renter_id`).
  - **Extindere `public.listings` & Trigger Rating Atomic (`recalculate_ratings`)**: adăugarea coloanelor `deposit_ron`, `min_rental_days`, `cancellation_policy`, `rating_avg`, `rating_count` și recalcularea automată a mediilor de rating pe obiect și profil la fiecare recenzie.
  - **Funcție RPC publică `get_listing_unavailable_ranges(p_listing_id UUID)`**: returnează doar perechile `(start_date, end_date)` ale rezervărilor confirmate viitoare pentru afișarea calendarului de disponibilitate, fără a expune identitatea chiriașilor.
- **Finalizare CRUD Listări, Profil, Catalog & UX Mobil (`M10.3`)** (`renta-frontend`):
  - **Editare completă anunțuri (`/listarile-mele/[id]/editeaza`)**: pagina `app/(dashboard)/listarile-mele/[id]/editeaza/page.tsx`, acțiunile `updateListingAction` și `getOwnedListingForEditAction` în `app/actions/listings.ts` și suport dual `create` / `edit` în `components/listings/ListingForm.tsx` (păstrarea/ștergerea selectivă a pozelor existente, adăugare poze noi, editare `deposit_ron`, `min_rental_days`, `cancellation_policy`).
  - **Upload Avatar & Persistare `bio` în Profil**: `app/profil/ProfileForm.tsx` și `updateProfileAction` în `app/actions/auth.ts` încarcă fotografia de profil în bucket-ul `avatars`, șterg vechiul avatar și salvează biografia publică în `public.profiles` + datele private (`phone`, `company_cui`) în `public.profile_private`.
  - **Navigație Mobilă Responsivă (`components/layout/MobileNav.tsx` & `Header.tsx`)**: sertar mobil (drawer) în stil „Fișă de Inventar" cu închidere automată la schimbarea rutei sau tasta `Escape`.
  - **Calendar Zile Ocupate & Validare Durată Minimă (`components/bookings/BookingWidget.tsx`)**: afișează intervalele deja rezervate (`unavailableRanges`), blochează selectarea unui interval care se intersectează cu zile ocupate și validează `min_rental_days`.
  - **Sortare, Paginare & Rating pe Carduri în Catalog (`app/catalog/page.tsx`, `components/catalog/FilterBar.tsx`, `components/catalog/ObjectCard.tsx`)**: suport pentru sortare (`newest`, `price_asc`, `price_desc`, `rating_desc`), paginare server-side cu păstrarea filtrelor în URL și afișarea mediei de rating `★` și a garanției pe fiecare card.
  - **Pagini Globale de Eroare și 404 (`app/error.tsx`, `app/not-found.tsx`)**: ecrane de diagnostic tehnic (`#ERR-500` și `#ERR-404`) cu acțiuni de reîncărcare și întoarcere în catalog.

### Verificare QA, Build & Audit Securitate (`renta-qa-tracker`)
- **TypeScript Check (`npx.cmd tsc --noEmit`)**: **0 erori**.
- **Production Build (`npm.cmd run build`)**: **0 erori** (`exit code 0`, 13 rute + Middleware compilate).
- **Audit PII & Chei Secrete**: Confirmat prin scanarea întregului cod sursă că nicio interogare pe `public.profiles` nu mai selectează `phone` sau `company_cui`, și nicio cheie privată (`SERVICE_ROLE`, `sb_secret`) nu este prezentă în codul de client.

---

## [v0.6.0-reviews-and-mvp-complete] — 2026-11-16
### Adăugat
- **Faza 9 — Sistemul de Recenzii (1–5 Stele) & Finalizare MVP v0 (`M9.1`, `M9.2`, `M9.3`, plus închiderea `M1.3` & `M2.3`)** (`renta-backend` + `renta-frontend` + `renta-qa-tracker`):
  - Server Actions pentru sistemul de recenzii în `src/app/actions/reviews.ts`:
    - `createReviewAction`: validează sesiunea utilizatorului, verifică existența rezervării și faptul că aceasta are statusul `completed`, garantează că utilizatorul logat este parte din rezervare (`renter_id` sau `owner_id`), previne recenziile duplicate pe aceeași rezervare și inserează recenzia (1–5 stele + comentariu) în `public.reviews`.
    - `getListingReviewsAction`: preia lista recenziilor unui obiect împreună cu datele autorului (`reviewer:profiles!reviews_reviewer_id_fkey`) pentru afișare pe fișa tehnică a echipamentului.
    - `getReviewedBookingIdsAction`: verifică ce rezervări au fost deja evaluate de utilizatorul curent pentru a afișa badge-ul `✓ RECENZIE TRANSMISĂ` în dashboard.
  - Formular interactiv de acordare recenzie (selector 1–5 stele `★` + câmp comentariu) integrat în `src/components/bookings/BookingCard.tsx` și `src/app/(dashboard)/rezervarile-mele/page.tsx`, vizibil exclusiv pentru rezervările cu statusul `completed`.
  - Secțiune completă de **Recenzii & Evaluări Verificate** pe pagina de detaliu a obiectului `src/app/obiect/[id]/page.tsx`, cu afișarea mediei de rating, a numărului total de recenzii, a stelelor acordate, a numelui/tipului autorului (P2P / Firmă) și a datei.
  - Configurare permanentă a spațiului de lucru și a echipei de agenți direct în `c:\Users\User\Desktop\Renta`:
    - `RentA.code-workspace` pentru deschiderea directă a proiectului în Antigravity / VS Code.
    - `AGENTS.md` și `.agents/agents/` (`renta-architect.md`, `renta-backend.md`, `renta-frontend.md`, `renta-qa-tracker.md`).

### Verificare QA & Audit Final Securitate (`renta-qa-tracker`)
- **Progres General MVP v0**: **30 / 30 micro-etape finalizate (100%)**.
- **TypeScript Check (`npx tsc --noEmit`)**: **0 erori** în întregul proiect.
- **Audit Securitate Recenzii & RLS**:
  - Atât Server Action-ul `createReviewAction`, cât și politica RLS din `002_rls_and_storage.sql` și constrângerea `UNIQUE (booking_id, reviewer_id)` din `001_initial_schema.sql` garantează că o recenzie poate fi lăsată doar o singură dată per rezervare și doar după finalizarea efectivă (`status = 'completed'`).
  - Trigger-ul PostgreSQL `update_ratings_after_review` (`SECURITY DEFINER`) recalculează automat și atomic `rating_avg` și `rating_count` în tabelele `public.listings` și `public.profiles` la fiecare recenzie nouă.

---

## [v0.5.0-object-detail-and-bookings] — 2026-11-15
### Adăugat
- **Faza 7 — Pagina de Detaliu Obiect (`/obiect/[id]`) & Widgetul de Rezervare (`M7.1`, `M7.2`, `M7.3`)** (`renta-frontend`):
  - Pagina dinamică `src/app/obiect/[id]/page.tsx` (`/obiect/[id]`):
    - Antet tehnic de catalog cu breadcrumb, codul `#OBJ-XXXX`, badge de disponibilitate (`DISPONIBIL ACUM` vs `ÎN PAUZĂ`), categorie și locație.
    - Galerie foto în stil fișă de inventar (imagine principală `aspect-[4/3]` + grilă pentru imaginile secundare).
    - Tabel monospațiat cu specificații tehnice (cod inventar, stare tehnică, tarif pe zi, tarif pe oră, garanție returnabilă, reguli de predare/returnare) și descrierea completă a echipamentului.
    - Card cu profilul ofertantului (**Persoană Fizică P2P** vs **Firmă Autorizată B2C**), oraș, statut verificare și rating mediu.
  - Componenta interactivă `src/components/bookings/BookingWidget.tsx`:
    - Selector de interval calendaristic (`start_date` – `end_date`) cu calcul automat în timp real pentru numărul de zile (`totalDays`), costul de închiriere (`totalDays * pricePerDay`) și garanția returnabilă (`depositAmount`).
    - Caseta tehnică **Protocol Garanție & Escrow (MVP v1)** care explică transparent fluxul de rezervare și pregătirea pentru Stripe Escrow.
    - Protecție UI dedicată: dacă vizitatorul nu este logat, afișează trimitere directă către `/login`; dacă utilizatorul logat este chiar proprietarul obiectului, afișează caseta de administrare proprie în locul formularului de rezervare.
- **Faza 8 — Fluxul de Rezervări & Dashboard (`/rezervarile-mele`) (`M8.1`, `M8.2`, `M8.3`)** (`renta-backend` + `renta-frontend`):
  - Server Actions pentru ciclul de viață al rezervărilor în `src/app/actions/bookings.ts`:
    - `createBookingAction`: validează autentificarea, existența și disponibilitatea obiectului, blochează auto-rezervarea (`listing.owner_id === user.id`), validează datele calendaristice, verifică suprapunerea cu alte rezervări deja `confirmed` pe același obiect, recalculează pe server numărul de zile și `total_price`, și inserează cererea în `public.bookings` (cu generarea automată a codului `#REZ-XXXX` din secvența PostgreSQL).
    - `updateBookingStatusAction`: implementează mașina de stări (State Machine) a rezervărilor cu verificare de rol (Ofertant vs Chiriaș) și verificare anti-suprapunere la confirmare.
    - `getMyBookingsAction`: returnează într-un singur apel atât cererile trimise ca chiriaș (`asRenter`), cât și cererile primite pentru propriile obiecte (`asOwner`), cu join pe `listings` și `profiles`.
  - Componenta `src/components/bookings/BookingCard.tsx` și pagina de dashboard `src/app/(dashboard)/rezervarile-mele/page.tsx` (`/rezervarile-mele`), împărțită în două secțiuni clare: **Cereri Primite pentru Obiectele Mele (Ofertant)** și **Obiecte Luate cu Împrumut (Chiriaș)**, cu dezvăluirea datelor de contact (telefon) pentru rezervările confirmate/finalizate.
  - Adăugarea linkului de navigație `[03. Rezervări]` (`/rezervarile-mele`) în `src/components/layout/Header.tsx`.

### Verificare QA & Audit Securitate (`renta-qa-tracker`)
- **Confirmare Live Faza 6**: Catalogul public (`/catalog`), comutatorul Peer-to-Peer vs Firme și filtrele SQL au fost testate și confirmate live în browser de către fondator (cu obiectul `#OBJ-0001`).
- **TypeScript Check (`npx tsc --noEmit`)**: **0 erori** de compilare sau tipizare în întregul proiect.
- **Audit Securitate Server-Side pe Rezervări**:
  - Prețul total (`total_price`) și garanția (`deposit_amount`) sunt **recalculate integral pe server** în `createBookingAction` pe baza `listing.price_per_day` citit din baza de date, eliminând orice risc de manipulare a prețului din client.
  - Verificare dublă împotriva auto-rezervării: atât în `createBookingAction` (`listing.owner_id === user.id`), cât și prin constrângerea SQL `CHECK (renter_id <> owner_id)` din `public.bookings`.

### Explicație Tehnică & Decizii de Arhitectură
- **Rute dinamice `[id]` cu `await params` în Next.js 15**: În Next.js 15 App Router, parametrul `params` al rutelor dinamice (`src/app/obiect/[id]/page.tsx`) este un `Promise<{ id: string }>`. Pagina rezolvă asincron `const { id } = await params` pe server, apelează `getListingByIdAction(id)` și declanșează `notFound()` dacă obiectul nu există sau dacă este în pauză (`!listing.is_available`) iar vizitatorul nu este proprietarul său.
- **State Machine-ul rezervărilor (`pending -> confirmed/rejected -> completed`) și separarea permisiunilor**: În `updateBookingStatusAction`, tranzițiile de stare sunt guvernate strict de rolul utilizatorului în tranzacție:
  - **Ofertantul (`isOwner`)** poate trece o cerere din `pending` în `confirmed` sau `rejected`, și din `confirmed` în `completed` (la returnarea echipamentului) sau `cancelled`.
  - **Chiriașul (`isRenter`)** poate doar să anuleze (`cancelled`) o cerere proprie aflată în `pending` sau `confirmed`, fără a putea niciodată să își auto-confirme sau auto-finalizeze rezervarea.
- **Verificarea suprapunerii de date (Overlap Prevention)**: Atât la crearea unei cereri (`createBookingAction`), cât și în momentul în care proprietarul apasă „Confirmă Rezervarea" (`updateBookingStatusAction`), serverul interoghează `public.bookings` cu condiția matematică de intersecție a două intervale închise: `.lte("start_date", endDateStr).gte("end_date", startDateStr)` pentru toate rezervările cu `status = "confirmed"`. Astfel, două cereri paralele în `pending` pot exista, dar în clipa în care prima este confirmată, a doua nu mai poate fi confirmată pe aceleași zile.

---

## [v0.4.0-public-catalog] — 2026-11-15
### Adăugat
- **Faza 6 — Homepage & Catalogul Public (Peer-to-Peer vs Firme de Închirieri) + Căutare și Filtre (`M6.1`, `M6.2`, `M6.3`)** (`renta-backend` + `renta-frontend`):
  - Interogări publice optimizate în `src/app/actions/listings.ts`:
    - `getPublicListingsAction`: preia listările active (`is_available = true`) împreună cu profilul proprietarului (`profiles!listings_owner_id_fkey`) și categoria (`categories!listings_category_id_fkey`), aplicând filtre după text (`q`), categorie (`category`), oraș (`city`), preț maxim pe zi (`maxPrice`), tip ofertant (`ownerType`: `individual` P2P vs `company` Firmă) și sortare (`newest`, `price_asc`, `price_desc`).
    - `getListingByIdAction`: preia detaliile complete ale unui obiect după UUID pentru viitoarea pagină de detaliu `/obiect/[id]`.
  - Componenta `src/components/catalog/ObjectCard.tsx` (`M6.2`): card în stil „Fișă de Inventar" cu număr de catalog `#OBJ-XXXX`, badge distinctiv **P2P • PERSOANĂ FIZICĂ** vs **FIRMĂ AUTORIZATĂ**, imagine `aspect-[4/3]`, condiție tehnică, oraș, tarif/zi, tarif/oră și garanție în font monospațiat `JetBrains Mono`.
  - Componenta `src/components/catalog/FilterBar.tsx` (`M6.2`): bară de filtrare tehnică cu tab-uri rapide pentru tipul de ofertant (Toate / Peer-to-Peer / Firme de Închirieri), căutare după cuvinte cheie, selector categorie, selector oraș, prag de preț maxim și ordonare.
  - Pagina `src/app/catalog/page.tsx` (`M6.3` — `/catalog`): catalogul public complet cu filtrare server-side prin URL `searchParams`, contor de rezultate în timp real, filtre rapide pe categorii și stare goală cu buton de resetare.
  - Actualizarea Homepage-ului `src/app/page.tsx` (`M6.1` — `/`): secțiune Hero în stil atelier contemporan, bară de căutare rapidă către `/catalog`, comutator principal între **Peer-to-Peer (De la Oameni)** și **Firme de Închirieri (B2C)**, grilă cu ultimele obiecte publicate live din Supabase și secțiune cu categoriile de inventar.

### Verificare QA & Audit Securitate (`renta-qa-tracker`)
- **Confirmare Live Faza 5**: Fluxul de creare și administrare listări (`/listarile-mele`, `/listarile-mele/nou`) a fost validat live în browser de către fondator.
- **TypeScript Check (`npx tsc --noEmit`)**: **0 erori** de compilare sau tipizare în întregul proiect.
- **Audit Securitate & Expunere Date**: `getPublicListingsAction` expune doar câmpurile publice ale profilului ofertantului (`id`, `display_name`, `user_type`, `company_name`, `city`, `is_verified`, `rating_avg`, `rating_count`) și filtrează strict după `.eq("is_available", true)`, astfel încât obiectele puse pe pauză nu apar în catalogul public.

### Explicație Tehnică & Decizii de Arhitectură
- **Cum funcționează filtrarea prin `searchParams` în URL pe Server Components în Next.js 15**: În Next.js 15 App Router, proprietatea `searchParams` primită de paginile Server Component (`app/page.tsx` și `app/catalog/page.tsx`) este un `Promise` asincron (`Promise<{ q?: string; category?: string; ... }>`). Pagina așteaptă (`await searchParams`) parametrii direct pe server și îi transmite către `getPublicListingsAction`. Acest model oferă URL-uri complet distribuibile (shareable links pentru orice combinație de filtre P2P/Firmă/categorie/oraș), randare SSR rapidă fără waterfall de request-uri în client și indexare SEO curată.
- **Cum funcționează join-ul relațional `profiles!listings_owner_id_fkey` în PostgREST / Supabase**: Pentru a evita problema `N+1 queries` (câte un request suplimentar pentru proprietarul fiecărui obiect din catalog), interogarea `.select("*, owner:profiles!listings_owner_id_fkey(...), category:categories!listings_category_id_fkey(...)")` instruiește PostgREST să rezolve cheile externe într-un singur query SQL cu `LEFT JOIN`. Astfel, fiecare `ObjectCard` primește simultan datele obiectului, categoria și tipul proprietarului (`individual` vs `company`).

---

## [v0.3.0-listings-crud] — 2026-11-15
### Adăugat
- **Faza 5 — CRUD Listări / Obiecte de Închiriat (`M5.1`, `M5.2`, `M5.3`)** (`renta-backend` + `renta-frontend`):
  - Constante și nomenclator tehnic de categorii în `src/lib/constants/categories.ts` (aliniate cu seed-ul SQL din `public.categories`, plus liste pentru condiția tehnică a echipamentului și orașele principale).
  - Server Actions complete pentru gestiunea inventarului în `src/app/actions/listings.ts`:
    - `createListingAction`: validare server-side pentru titlu, descriere, categorie, oraș, preț/zi (`> 0`), preț/oră opțional, garanție (`deposit_amount >= 0`), condiție tehnică și upload de până la 4 imagini (`JPG/PNG/WEBP`, max `5MB`/fișier) în bucket-ul Supabase Storage `listing-images` sub calea `{user.id}/{uuid}.{ext}`.
    - `toggleListingStatusAction`: comutare rapidă între starea `active` (vizibilă în catalog) și `paused` (ascunsă temporar), cu verificare strictă a proprietății (`owner_id = user.id`).
    - `deleteListingAction`: ștergerea listării proprii și curățarea imaginilor aferente din Supabase Storage.
  - Formularul interactiv `src/components/listings/ListingForm.tsx` și pagina `src/app/(dashboard)/listarile-mele/nou/page.tsx` (`/listarile-mele/nou`) în stil „Fișă de Inventar", cu preview local pentru pozele selectate, indicator de încărcare (`useActionState`) și validare clară.
  - Componenta `src/components/listings/MyListingCard.tsx` și pagina de administrare inventar `src/app/(dashboard)/listarile-mele/page.tsx` (`/listarile-mele`), cu sumar statistic (total fișe, active, în pauză), afișarea codului `#OBJ-XXXX` generat de PostgreSQL și butoane de acțiune rapidă.
  - Integrare linkuri de navigare către `/listarile-mele` și `/listarile-mele/nou` în `src/components/layout/Header.tsx` și `src/app/profil/page.tsx`.

### Remediat (Validare Live Faza 3 & Faza 4)
- **Normalizare automată URL Supabase (`src/lib/supabase/config.ts`)**: `getSupabaseEnv()` elimină automat sufixele lipite din greșeală (precum `/rest/v1` sau `/`), prevenind erorile de conectare la Auth și REST API.
- **Aliniere câmp `display_name` la Înregistrare și Profil (`src/app/actions/auth.ts`, `src/app/(auth)/inregistrare/page.tsx`, `src/app/profil/ProfileForm.tsx`)**: Unificarea numelui câmpului din formulare cu coloana `display_name` din `public.profiles` și metadatele citite de trigger-ul `handle_new_user`.

### Verificare QA & Audit Securitate (`renta-qa-tracker`)
- **Confirmare Live Fazele 1–4**: Înregistrarea, autentificarea, crearea automată a profilului în Supabase și actualizarea profilului au fost testate și confirmate funcționale în browser.
- **TypeScript Check (`npx tsc --noEmit`)**: **0 erori** pe întregul proiect după adăugarea modulului de listări.
- **Audit Securitate & RLS pe Listări**: Toate mutațiile din `src/app/actions/listings.ts` verifică sesiunea activă prin `supabase.auth.getUser()` și filtrează explicit după `.eq("owner_id", user.id)` în plus față de politicile RLS din PostgreSQL.

### Explicație Tehnică & Decizii de Arhitectură
- **Cum funcționează upload-ul `FormData` cu obiecte `File` în Next.js Server Actions către Supabase Storage**: Formularul `ListingForm` trimite nativ un obiect `FormData` care conține atât câmpurile text/numerice, cât și fișierele binare (`formData.getAll("images")`). Server Action-ul `createListingAction` validează tipul MIME și dimensiunea fiecărui fișier pe server, încarcă fișierele în bucket-ul `listing-images` în folderul izolat al utilizatorului (`{user.id}/...` — impus și de politica RLS din `storage.objects`), extrage URL-urile publice prin `getPublicUrl()` și salvează array-ul `images: string[]` direct în coloana `TEXT[]` a tabelului `public.listings`.
- **De ce folosim ștergere în cascadă (`ON DELETE CASCADE`) și curățare Storage**: La nivel de schemă SQL (`001_initial_schema.sql`), cheia externă `owner_id REFERENCES public.profiles(id) ON DELETE CASCADE` și legăturile din `bookings` / `reviews` asigură integritatea referențială fără înregistrări orfane. În plus, `deleteListingAction` extrage căile imaginilor din URL-urile stocate și apelează `supabase.storage.from("listing-images").remove(...)` înainte de `DELETE`-ul din baza de date pentru a nu lăsa fișiere nefolosite în bucket.

---

## [v0.2.0-backend-auth-db] — 2026-11-15
### Adăugat
- **Faza 1 & Faza 2 — Inițializare Next.js 15, Design System Minimalist & Navigație (`M1.1`, `M1.2`, `M2.1`, `M2.2`)** (`renta-frontend`):
  - Configurare proiect Next.js 15 + TypeScript + Tailwind CSS în `c:\Users\User\Desktop\Renta`, cu `.gitignore` și `.env.example` pregătite pentru deployment pe Vercel.
  - Sistemul cromatic *Warm Unbleached Paper* (`#F6F4EF`), *Technical Ink* (`#141413`), *Industrial Ochre* (`#D95D24`) și fonturile `Archivo`, `JetBrains Mono` și `Inter` în `src/app/layout.tsx` și `src/app/globals.css`.
  - Componentele de identitate și layout: `src/components/layout/BrandLogo.tsx`, `src/components/layout/Header.tsx` (cu switch P2P/Firme și stare de autentificare live) și `src/components/layout/Footer.tsx`.
- **Faza 3 — Infrastructura Supabase de la Zero, Migrații SQL & RLS (`M3.1`, `M3.2`, `M3.3`)** (`renta-backend`):
  - Clienți izolați `@supabase/ssr`: `src/lib/supabase/client.ts` (Browser), `src/lib/supabase/server.ts` (Server Components / Server Actions), `src/lib/supabase/middleware.ts` + `src/middleware.ts` (refresh sesiune și protecție rute) și `src/lib/supabase/config.ts`.
  - Tipuri TypeScript stricte în `src/lib/types/database.ts` pentru toate cele 5 tabele (`profiles`, `categories`, `listings`, `bookings`, `reviews`).
  - Migrația `supabase/migrations/001_initial_schema.sql`: tabele, constrângeri `CHECK`, secvențe automate pentru coduri de catalog (`#OBJ-0001`) și coduri de rezervare (`#REZ-0001`), trigger `handle_new_user` și seed cu cele 8 categorii standard.
  - Migrația `supabase/migrations/002_rls_and_storage.sql`: politici Row Level Security (RLS) complete pentru toate tabelele și configurare bucket-uri Supabase Storage (`listings`, `avatars`).
  - Pagina de diagnosticare `src/app/status-db/page.tsx` (`/status-db`) și ghidul pas-cu-pas `SUPABASE_SETUP_DE_LA_ZERO.md`.
- **Faza 4 — Autentificare Hibridă (P2P / Firmă) & Profil Utilizator (`M4.1`, `M4.2`, `M4.3`)** (`renta-backend` + `renta-frontend`):
  - Server Actions în `src/lib/actions/auth.ts` (`signUpAction`, `signInAction`, `signOutAction`, `updateProfileAction`) cu validare server-side completă.
  - Paginile `src/app/inregistrare/page.tsx` (cu selector interactiv Persoană Fizică P2P vs Firmă B2C și câmpuri CUI / Denumire Firmă), `src/app/login/page.tsx` și `src/app/profil/page.tsx` + `src/app/profil/ProfileForm.tsx`.

### Verificare QA & Audit Securitate (`renta-qa-tracker`)
- **TypeScript Check (`npx tsc --noEmit`)**: **0 erori** de compilare sau tipizare în întregul proiect.
- **Audit Variabile de Mediu**: Nicio cheie secretă (`SUPABASE_SERVICE_ROLE_KEY`) nu este expusă cu prefixul `NEXT_PUBLIC_`; `config.ts` gestionează sigur lipsa variabilelor fără a bloca aplicația înainte de conectarea proiectului Supabase.

### Explicație Tehnică & Decizii de Arhitectură
- **De ce s-a folosit `@supabase/ssr` cu Middleware dedicat**: În Next.js 15 App Router, Server Components nu pot scrie direct cookie-uri în timpul randării; `middleware.ts` interceptează cererile, reîmprospătează token-ul JWT în cookie-uri HTTP-only și redirecționează imediat vizitatorii neautentificați de pe rutele protejate (`/profil`, `/listarile-mele`, `/rezervarile-mele`).
- **Cum funcționează trigger-ul `handle_new_user` (`SECURITY DEFINER`)**: La înregistrarea în `auth.users`, metadatele trimise din formular (`full_name`, `user_type`, `city`, `phone`, `company_name`, `company_cui`) sunt preluate atomic de trigger-ul PostgreSQL care inserează rândul corespunzător în `public.profiles`. Astfel, nu există niciodată un utilizator autentificat fără profil valid și nu este nevoie de permisiuni publice de `INSERT` din client.
- **De ce RLS este activat din prima clipă (`002_rls_and_storage.sql`)**: Deoarece cheia `NEXT_PUBLIC_SUPABASE_ANON_KEY` este publică în browser, securitatea reală a datelor nu poate depinde doar de interfața UI. Politicile RLS garantează la nivel de motor PostgreSQL că un utilizator poate modifica exclusiv propriul profil (`auth.uid() = id`), propriile listări (`auth.uid() = owner_id`) și propriile fișiere din Storage.

---

## [v0.1.0-plan] — 2026-11-15
### Adăugat
- **Echipa de Agenți Specializați (`M0.1`)**:
  - `renta-architect` — Lead Architect & Product Orchestrator.
  - `renta-backend` — Supabase, Database & Backend Engineer.
  - `renta-frontend` — UI/UX & Frontend Engineer (direcția vizuală *„Fișă de Inventar / Atelier Contemporan"*).
  - `renta-qa-tracker` — QA, Security Reviewer & Tracker Agent.
- **Specificația Tehnică & Arhitecturală (`M0.2` — `ARCHITECTURE_SPEC.md`)**:
  - Definirea modelului hibrid al platformei: separare și filtrare nativă între **Închirieri Peer-to-Peer (Persoane Fizice)** și **Firme de Închirieri (B2C)** prin atributul `user_type` (`individual` vs `company`).
  - Proiectarea schemei PostgreSQL / Supabase pentru cele 5 entități principale (`profiles`, `categories`, `listings`, `bookings`, `reviews`), inclusiv codul tehnic automat `#OBJ-XXXX` și politicile Row Level Security (RLS).
  - Stabilirea sistemului estetic: paleta *Warm Unbleached Paper* (`#F6F4EF`), *Technical Ink* (`#141413`), *Industrial Ochre* (`#D95D24`), *Rental Forest* (`#1F5E43`), și perechea tipografică `Archivo Expanded` + `JetBrains Mono` + `Inter`.
- **Planul Operațional MVP (`M0.3` — `Prompt_RentA_MVP.md`)**:
  - Structurarea execuției în 9 faze secvențiale cu reguli stricte de validare după fiecare micro-etapă.
- **Sistemul de Tracking & Audit QA (`M0.4` — `PROGRESS_TRACKER.md` & `CHANGELOG.md`)**:
  - Inițializarea matricei de urmărire pentru micro-etapele `M0.1` – `M9.3`, cu criterii explicite de securitate și Definition of Done pentru fiecare pagină și componentă.

### Explicație Tehnică & Decizii de Arhitectură
- **De ce model hibrid într-o singură schemă de listări (`listings` + `profiles.user_type`)**: Evită duplicarea tabelelor și a logicii de rezervare, permițând atât afișarea separată în tab-urile principale (Peer-to-Peer vs Firme), cât și căutarea unificată în catalog cu filtre SQL rapide.
- **De ce validare obligatorie prin `renta-qa-tracker` după fiecare micro-etapă**: Previne acumularea erorilor de tipuri TypeScript, a breșelor de securitate în Server Actions / RLS și garantează trasabilitatea completă a proiectului.
