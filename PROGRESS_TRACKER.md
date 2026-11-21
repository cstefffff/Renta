# RentA — Progress Tracker & QA Matrix

Acest document urmărește execuția pas-cu-pas a platformei **RentA** (Marketplace Hibrid de Închirieri P2P + B2C).
**Regulă de Aur:** Nicio micro-etapă nu poate trece la statusul `[x] Finalizat` fără validarea `renta-qa-tracker` (TypeScript check, Build check, Test funcțional, Audit Securitate & RLS).

> **Notă Operațională Curentă (2026-11-21):**
>
> - **PROGRES MVP v0 (Fazele 0–9): 30 / 30 Micro-Etape Finalizate (100%)**
> - **PROGRES UZ COMERCIAL — VALUL 1 (Faza 10: `M10.1` – `M10.4`): 4 / 4 Micro-Etape Finalizate & Validate Live (`[x] Finalizat` — migrația `003_commercial_hardening.sql` confirmată live în Supabase; aplicația este publicată pe Vercel la `https://renta-peach.vercel.app`)**.
> - **REDESIGN UI/UX (`v0.8.0` — Modern Storefront / E-Commerce Dashboard): `[x] Finalizat (2026-11-16)`** — Sistemul de design și interfața au fost actualizate la arhitectura **Modern Storefront** (inspirată din „Corelystics Store > Products”), construită modular cu variabile CSS în `app/globals.css` și tokeni semantici în `tailwind.config.ts` (`#F8FAFC` / `#FFFFFF` / `#F1F5F9`, text Slate `#0F172A`, accent principal Emerald Teal `#109E82` ușor de schimbat dintr-un singur loc), `SidebarRail.tsx` vertical + `Header.tsx` cu breadcrumb și căutare `⌘ + F` + `FilterBar.tsx` vertical pe 2 coloane în `/catalog` + `ObjectCard.tsx` modern rotunjit.
> - **POPULARE DEMO & VALIDARE CONȚINUT (`v0.8.1` — 2026-11-21)**: Create **4 conturi demo** (2 P2P + 2 Firme B2C), **12 anunțuri noi (`#OBJ-0002` – `#OBJ-0013`)** cu poze în Supabase Storage (`listing-images`) și **3 recenzii verificate** (`#REZ-0006` – `#REZ-0008`), acoperind toate cele 8 categorii și 5 orașe.
> - **SISTEM ANUNȚURI APRECIATE / FAVORITE (`v0.8.2` — 2026-11-21): `[x] Finalizat`** — Implementat fluxul complet de apreciere/salvare a anunțurilor (`FavoriteButton.tsx`, `FavoriteNavBadge.tsx`, `useFavorites.ts`, pagina dedicată `/favorite` cu filtrare pe segment `Toate` / `P2P` / `Firme B2C`, sincronizare hibridă `localStorage` + `user_metadata.favorite_listing_ids` în Supabase Auth prin `getUserFavoriteIdsAction` / `syncUserFavoriteIdsAction`, inimioară interactivă reală pe `ObjectCard.tsx` și `/obiect/[id]` care nu se mai activează la hover-ul general pe card).
> - **HEADER COMPACT „AIRBNB PILL” & SHORTCUT `Ctrl + K` (`v0.8.3` — 2026-11-21): `[x] Finalizat`** — Decongestionat `Header.tsx` (păstrate doar `+ Listează`, butonul rotund `Favorite (♥)` cu badge și meniul dropdown `UserMenu.tsx` organizat în 5 secțiuni pe roluri: Identitate, Ca Chiriaș, Ca Proprietar, Cont & Sistem, Delogare), adăugat `SearchBar.tsx` cu scurtătură reală de tastatură `Ctrl + K` / `⌘ + K` și aliniat `MobileNav.tsx` la aceeași structură pe roluri.
> - **GALERIE INTERACTIVĂ MULTI-FOTO, CTA `+ Listează` PRONUNȚAT & 23 ANUNȚURI ACTIVE (`v0.8.4` — 2026-11-21): `[x] Finalizat`** — Butonul `+ Listează` din `Header.tsx` este acum o pastilă plină Emerald Teal (`h-9 px-4 rounded-full bg-ochre text-white shadow-sm`) armonizată cu butonul `Favorite` (`w-9 h-9`) și `UserMenu`; adăugată galeria foto interactivă `ProductGallery.tsx` pe `/obiect/[id]` (săgeți `‹` / `›`, contor `1 / N fotografii`, miniaturi clickable), badge-ul cu numărul de poze pe `ObjectCard.tsx`, `pageSize: 12` în `/catalog` și încă **10 anunțuri noi (`#OBJ-0014` – `#OBJ-0023`)** cu câte **3 fotografii distincte** (30 imagini noi în Supabase Storage, total **23 anunțuri active**).
> - **Verificare Tehnică & Compilare (`v0.8.4`)**: `npx.cmd tsc --noEmit` = **0 erori** (`exit code 0`). Următorul pas din roadmap (**Faza 11: Stripe Connect**) rămâne on-hold până la rafinările de UX/UI.

---

## Sumar Progres pe Faze (MVP v0 + Uz Comercial Valul 1)

| Fază                  | Nume Fază                                                            |         Micro-etape         | Status Curent                                                                                                 |
| :--------------------- | :-------------------------------------------------------------------- | :--------------------------: | :------------------------------------------------------------------------------------------------------------ |
| **Faza 0**       | Planificare, Arhitectură & Setup Agenți                             |  `M0.1` – `M0.4` (4/4)  | `[x] Finalizat (100%)`                                                                                      |
| **Faza 1**       | Inițializare Proiect & Design System ("Fișă de Inventar")          |  `M1.1` – `M1.3` (3/3)  | `[x] Finalizat (100%)`                                                                                      |
| **Faza 2**       | Layout Global & Navigație                                            |  `M2.1` – `M2.3` (3/3)  | `[x] Finalizat (100%)`                                                                                      |
| **Faza 3**       | Baza de Date Supabase, RLS & Clienți                                 |  `M3.1` – `M3.3` (3/3)  | `[x] Finalizat & Validat Live (100%)`                                                                       |
| **Faza 4**       | Autentificare & Profil Utilizator                                     |  `M4.1` – `M4.3` (3/3)  | `[x] Finalizat & Validat Live (100%)`                                                                       |
| **Faza 5**       | CRUD Listări (Obiecte de Închiriat)                                 |  `M5.1` – `M5.3` (3/3)  | `[x] Finalizat & Validat Live (100%)`                                                                       |
| **Faza 6**       | Homepage & Catalog Public (P2P + Firme)                               |  `M6.1` – `M6.3` (3/3)  | `[x] Finalizat & Validat Live (100%)`                                                                       |
| **Faza 7**       | Pagina de Detaliu Obiect (`/obiect/[id]`)                           |  `M7.1` – `M7.3` (3/3)  | `[x] Finalizat & Validat Live (100%)`                                                                       |
| **Faza 8**       | Fluxul de Rezervări & Dashboard                                      |  `M8.1` – `M8.3` (3/3)  | `[x] Finalizat & Validat Live (100%)`                                                                       |
| **Faza 9**       | Sistemul de Recenzii & Audit Final QA                                 |  `M9.1` – `M9.3` (3/3)  | `[x] Finalizat (100%)`                                                                                      |
| **TOTAL MVP v0** | **RentA MVP v0 (Fazele 0–9)**                                  |      **30 / 30**      | **`[x] 100% FINALIZAT`**                                                                              |
| **Faza 10**      | Hardening Securitate, Remediere Bug-uri MVP & Finalizare CRUD         | `M10.1` – `M10.4` (4/4) | `[x] Finalizat & Validat Live (2026-11-21)`                                                                   |
| **Faza 11**      | Plăți Reale, Split Comision & Garanție/Escrow (Stripe Connect)     | `M11.1` – `M11.3` (0/3) | `[ ] On-hold (Urmează după rafinările de UI/UX)`                                                              |
| **Faza 12**      | Încredere, Verificare Telefon, Verificare Firme ANAF & Protocol Foto | `M12.1` – `M12.4` (0/4) | `[ ] În așteptare`                                                                                        |
| **Faza 13**      | Notificări Tranzacționale & Email (Valul 1: `M13.2`)              |       `M13.2` (0/1)       | `[ ] În așteptare`                                                                                        |
| **Faza 14**      | Conformitate Legală România & UE, Facturare SRL (Valul 1)           | `M14.1` – `M14.2` (0/2) | `[ ] În așteptare`                                                                                        |
| **Faza 15**      | Panou Administrare Minim & Branding Final (Valul 1: `M15.1`)        |       `M15.1` (0/1)       | `[ ] În așteptare`                                                                                        |
| **Faza 16**      | Testare Automată, Observabilitate & Go-Live Producție               | `M16.1` – `M16.3` (0/3) | `[ ] În așteptare`                                                                                        |

---

## Matricea Detaliată a Micro-Etapelor — MVP v0 (M0.1 – M9.3)

### Faza 0: Planificare, Arhitectură & Setup Agenți

> **Status Fază:** `[x] Finalizat (2026-11-15)`

| ID | Element / Secțiune / Pagină | Status | Agent Responsabil | Criterii de Testare & Securitate (Definition of Done) | Data Finalizării |
| :------------- | :---------------------------------------------------------------------------------------------------------- | :----------------------------- | :------------------- | :----------------------------------------------------------------------------------------------------------------------------- | :---------------- |
| **M0.1** | Definire echipă agenți (`renta-architect`, `renta-backend`, `renta-frontend`, `renta-qa-tracker`) | `[x] Finalizat (2026-11-15)` | `renta-architect` | Toți cei 4 agenți specializați au instrucțiuni clare, responsabilități delimitate și reguli de validare încrucișată. | 2026-11-15 |
| **M0.2** | Rafinare schemă DB & arhitectură în `ARCHITECTURE_SPEC.md` | `[x] Finalizat (2026-11-15)` | `renta-architect` | Specificația acoperă tabelele SQL, politici RLS, structura App Router, fluxurile de date și estetica „Fișă de Inventar". | 2026-11-15 |
| **M0.3** | Actualizare plan pas-cu-pas în `Prompt_RentA_MVP.md` | `[x] Finalizat (2026-11-15)` | `renta-architect` | Planul reflectă arhitectura validată, regulile de lucru multi-agent și pașii secvențiali de implementare. | 2026-11-15 |
| **M0.4** | Inițializare `PROGRESS_TRACKER.md` & `CHANGELOG.md` | `[x] Finalizat (2026-11-15)` | `renta-qa-tracker` | Ambele fișiere de tracking sunt create, structurate pe micro-etape `M0.1`–`M9.3` și pregătite pentru audit continuu. | 2026-11-15 |

---

### Faza 1: Inițializare Proiect & Design System ("Fișă de Inventar")

> **Status Fază:** `[x] Finalizat (2026-11-16)`

| ID | Element / Secțiune / Pagină | Status | Agent Responsabil | Criterii de Testare & Securitate (Definition of Done) | Data Finalizării |
| :------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :----------------------------- | :----------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------ | :---------------- |
| **M1.1** | Setup Next.js 15 + TS + Tailwind în `c:\Users\User\Desktop\Renta`, `.gitignore` și `.env.example` pregătite pentru Vercel | `[x] Finalizat (2026-11-15)` | `renta-frontend` | `npx tsc --noEmit` rulează cu 0 erori; structura `src/` și `.gitignore` / `.env.example` configurate curat pentru deployment Vercel. | 2026-11-15 |
| **M1.2** | Configurare culori Cream/Ink/Ochre și fonturi (`Archivo`, `JetBrains Mono`, `Inter`) + `BrandLogo.tsx` minimalist | `[x] Finalizat (2026-11-15)` | `renta-frontend` | Variabilele CSS (`--bg-cream`, `--ink-black`, `--ochre-action`, etc.), fonturile și componenta `BrandLogo.tsx` se încarcă fără layout shift (CLS = 0). | 2026-11-15 |
| **M1.3** | Sistemul de componente UI „Fișă de Inventar" (butoane, badge-uri P2P/Firmă, etichete `#OBJ-XXXX`/`#REZ-XXXX`, input-uri și carduri tehnice) integrate în paginile aplicației | `[x] Finalizat (2026-11-16)` | `renta-frontend` | Toate stările (`hover`, `focus-visible`, `disabled`, `error`) sunt vizibile, accesibile din tastatură și respectă bordurile tehnice `1px solid`. | 2026-11-16 |

---

### Faza 2: Layout Global & Navigație

> **Status Fază:** `[x] Finalizat (2026-11-16)`

| ID | Element / Secțiune / Pagină | Status | Agent Responsabil | Criterii de Testare & Securitate (Definition of Done) | Data Finalizării |
| :------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :----------------------------- | :----------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :---------------- |
| **M2.1** | `Header.tsx` minimalist cu logo/wordmark, switch rapid P2P/Firme, linkuri `/listarile-mele`, `[03. Rezervări]` (`/rezervarile-mele`) și stare autentificare | `[x] Finalizat (2026-11-15)` | `renta-frontend` | Navigație curată, afișare condiționată pentru utilizator logat (linkuri `/listarile-mele`, `/rezervarile-mele`, `/profil` + delogare) vs vizitator (`/login`, `/inregistrare`). | 2026-11-15 |
| **M2.2** | `Footer.tsx` minimalist stil catalog tehnic | `[x] Finalizat (2026-11-15)` | `renta-frontend` | Conține linkuri rapide (inclusiv `/status-db`), indicator versiune sistem și grilă arhitecturală cu linii vizibile de 1px. | 2026-11-15 |
| **M2.3** | Structura de grupuri de rute și layout-uri pentru paginile publice, `(auth)` și `(dashboard)` | `[x] Finalizat (2026-11-16)` | `renta-frontend` | Separare curată între paginile publice (`/`, `/catalog`, `/obiect/[id]`), ecranele `(auth)` (`/login`, `/inregistrare`) și rutele `(dashboard)` protejate prin middleware. | 2026-11-16 |

---

### Faza 3: Baza de Date Supabase, RLS & Clienți

> **Status Fază:** `[x] Finalizat & Validat Live (2026-11-15)`

| ID | Element / Secțiune / Pagină | Status | Agent Responsabil | Criterii de Testare & Securitate (Definition of Done) | Data Finalizării |
| :------------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------- | :-------------------------------------------- | :---------------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :---------------- |
| **M3.1** | Clienți `@supabase/ssr` (`client.ts`, `server.ts`, `middleware.ts`, `config.ts` cu normalizare URL) + `lib/types/database.ts` + pagina `/status-db` | `[x] Finalizat & Validat Live (2026-11-15)` | `renta-backend` | Nicio cheie privată (`SERVICE_ROLE_KEY`) nu folosește prefixul `NEXT_PUBLIC_`; `getSupabaseEnv()` curăță automat sufixele eronate (`/rest/v1/`); `/status-db` confirmă conexiunea live. | 2026-11-15 |
| **M3.2** | Migrație SQL `supabase/migrations/001_initial_schema.sql` — tabele, secvențe `#OBJ-0001`/`#REZ-0001`, triggere | `[x] Finalizat & Validat Live (2026-11-15)` | `renta-backend` | Tabelele `profiles`, `categories`, `listings`, `bookings`, `reviews` au constrângeri `CHECK` pe prețuri, date (`end_date >= start_date`), rating (`1..5`) și trigger `handle_new_user`. | 2026-11-15 |
| **M3.3** | Migrație SQL `supabase/migrations/002_rls_and_storage.sql` — politici RLS complete + Storage buckets + `SUPABASE_SETUP_DE_LA_ZERO.md` | `[x] Finalizat & Validat Live (2026-11-15)` | `renta-backend` | RLS este activat pe toate cele 5 tabele; politicile previn modificarea resurselor altui utilizator și restricționează upload-ul în Storage la propriul folder `auth.uid()`. | 2026-11-15 |

---

### Faza 4: Autentificare & Profil Utilizator

> **Status Fază:** `[x] Finalizat & Validat Live în Browser (2026-11-15)`

| ID | Element / Secțiune / Pagină | Status | Agent Responsabil | Criterii de Testare & Securitate (Definition of Done) | Data Finalizării |
| :------------- | :-------------------------------------------------------------------------------------------------- | :-------------------------------------------- | :------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | :---------------- |
| **M4.1** | Pagina `/inregistrare` cu selector P2P vs Firmă + `signUpAction` (aliniat cu `display_name`) | `[x] Finalizat & Validat Live (2026-11-15)` | `renta-backend` + `renta-frontend` | Validare server-side a câmpurilor (`display_name`); crearea contului populează automat profilul în `public.profiles` cu `user_type` ales (`individual` sau `company`). | 2026-11-15 |
| **M4.2** | Pagina `/login` + delogare + Middleware + `signInAction`/`signOutAction` | `[x] Finalizat & Validat Live (2026-11-15)` | `renta-backend` + `renta-frontend` | Utilizatorii neautentificați care accesează rutele protejate (`/profil`, `/listarile-mele`, `/rezervarile-mele`) sunt redirecționați la `/login`; erorile de autentificare sunt clare și sigure. | 2026-11-15 |
| **M4.3** | Pagina `/profil` + `ProfileForm.tsx` + `updateProfileAction` + linkuri rapide către listări | `[x] Finalizat & Validat Live (2026-11-15)` | `renta-backend` + `renta-frontend` | Utilizatorul își poate actualiza doar propriul profil (`auth.uid() = id`); validare server-side pentru `display_name`, oraș, telefon, bio și detalii firmă. | 2026-11-15 |

---

### Faza 5: CRUD Listări (Obiecte de Închiriat)

> **Status Fază:** `[x] Finalizat & Validat Live în Browser (2026-11-15)`

| ID | Element / Secțiune / Pagină | Status | Agent Responsabil | Criterii de Testare & Securitate (Definition of Done) | Data Finalizării |
| :------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :-------------------------------------------- | :----------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :---------------- |
| **M5.1** | `lib/constants/categories.ts` + `app/actions/listings.ts` — creare obiect cu `#OBJ-XXXX`, upload poze în Supabase Storage (`listing-images`), toggle status, ștergere | `[x] Finalizat & Validat Live (2026-11-15)` | `renta-backend` | Verificare strictă `owner_id = auth.uid()` pe server; validare preț > 0, titlu nenul, categorie validă, maxim 4 poze (`<= 5MB`, `JPG/PNG/WEBP`); generare automată `catalog_number` (`#OBJ-XXXX`). | 2026-11-15 |
| **M5.2** | `components/listings/ListingForm.tsx` + `app/(dashboard)/listarile-mele/nou/page.tsx` — formular adăugare obiect cu preview poze și validare | `[x] Finalizat & Validat Live (2026-11-15)` | `renta-frontend` | Afișare erori pe câmpuri la input invalid/gol, preview instantaneu pentru imaginile selectate, stare de încărcare pe butonul de submit, suport preț/zi, preț/oră, garanție și condiție tehnică. | 2026-11-15 |
| **M5.3** | `components/listings/MyListingCard.tsx` + `app/(dashboard)/listarile-mele/page.tsx` + navigație în `Header.tsx` și `profil/page.tsx` | `[x] Finalizat & Validat Live (2026-11-15)` | `renta-frontend` | Afișează exclusiv obiectele utilizatorului curent în stil „Fișă de Inventar", cu statistici rapide (total/active/pauză) și acțiuni directe pentru activare/pauză și ștergere cu confirmare. | 2026-11-15 |

---

### Faza 6: Homepage & Catalog Public (P2P + Firme)

> **Status Fază:** `[x] Finalizat & Validat Live în Browser (2026-11-15)`

| ID | Element / Secțiune / Pagină | Status | Agent Responsabil | Criterii de Testare & Securitate (Definition of Done) | Data Finalizării |
| :------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :-------------------------------------------- | :------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :---------------- |
| **M6.1** | Homepage `app/page.tsx` — Hero secțiune stil atelier/catalog, bară de căutare rapidă, cele 2 tab-uri Peer-to-Peer vs Firme de Închirieri și grila live de obiecte | `[x] Finalizat & Validat Live (2026-11-15)` | `renta-frontend` | Comutarea între tabul P2P (`individual`), Firme (`company`) și Toate filtrează corect afișarea pe Homepage și transmite parametrii către `/catalog`. | 2026-11-15 |
| **M6.2** | Componentele `components/catalog/ObjectCard.tsx` (fișă de inventar cu `#OBJ-XXXX`, preț/zi, preț/oră, oraș, badge P2P/Firmă) și `components/catalog/FilterBar.tsx` | `[x] Finalizat & Validat Live (2026-11-15)` | `renta-frontend` | Prețurile și codul de catalog folosesc `JetBrains Mono`; imaginile au `aspect-ratio: 4/3` fără distorsiuni; `FilterBar` sincronizează filtrele direct în URL (`searchParams`). | 2026-11-15 |
| **M6.3** | Pagina `app/catalog/page.tsx` + `getPublicListingsAction` și `getListingByIdAction` în `app/actions/listings.ts` | `[x] Finalizat & Validat Live (2026-11-15)` | `renta-backend` + `renta-frontend` | Confirmare live în browser cu obiectul `#OBJ-0001`: filtrarea după tip proprietar (P2P/Firmă), categorie, oraș, text și preț maxim funcționează fără erori. | 2026-11-15 |

---

### Faza 7: Pagina de Detaliu Obiect (`/obiect/[id]`)

> **Status Fază:** `[x] Finalizat & Validat Live (2026-11-15)`

| ID | Element / Secțiune / Pagină | Status | Agent Responsabil | Criterii de Testare & Securitate (Definition of Done) | Data Finalizării |
| :------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------- | :----------------------------- | :----------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :---------------- |
| **M7.1** | `app/obiect/[id]/page.tsx` — Galerie foto stil fișă tehnică + metadate catalog (`#OBJ-XXXX`, categorie, disponibilitate) | `[x] Finalizat (2026-11-15)` | `renta-frontend` | Rută dinamică Next.js 15 (`await params`), tratare corectă `notFound()` pentru ID-uri inexistente sau listări inactive (dacă vizitatorul nu e proprietarul). | 2026-11-15 |
| **M7.2** | Card informații proprietar (P2P sau Firmă) + tabel specificații tehnice + secțiune recenzii în `app/obiect/[id]/page.tsx` | `[x] Finalizat (2026-11-15)` | `renta-frontend` | Afișează badge-ul P2P vs Firmă, orașul, ratingul mediu al proprietarului și specificațiile tehnice în stil monospațiat. | 2026-11-15 |
| **M7.3** | Widget lateral de rezervare `components/bookings/BookingWidget.tsx` cu selector de date, calcul automat număr zile + total RON + caseta Escrow/Stripe v1 | `[x] Finalizat (2026-11-15)` | `renta-frontend` | Blochează selectarea datelor din trecut sau `end_date < start_date`; afișează avertisment și dezactivează formularul dacă utilizatorul logat este proprietarul obiectului. | 2026-11-15 |

---

### Faza 8: Fluxul de Rezervări & Dashboard

> **Status Fază:** `[x] Finalizat & Validat Live (2026-11-15)`

| ID | Element / Secțiune / Pagină | Status | Agent Responsabil | Criterii de Testare & Securitate (Definition of Done) | Data Finalizării |
| :------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :----------------------------- | :------------------------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :---------------- |
| **M8.1** | `app/actions/bookings.ts` (`createBookingAction`, `updateBookingStatusAction`, `getMyBookingsAction`) — creare cerere `#REZ-XXXX`, verificare suprapunere date și State Machine status | `[x] Finalizat (2026-11-15)` | `renta-backend` | Previne auto-rezervarea (`owner_id !== user.id`), verifică suprapunerea cu rezervări `confirmed` în intervalul selectat și recalculează `total_price` pe server. | 2026-11-15 |
| **M8.2** | `components/bookings/BookingCard.tsx` + `app/(dashboard)/rezervarile-mele/page.tsx` + link `[03. Rezervări]` în `Header.tsx` | `[x] Finalizat (2026-11-15)` | `renta-frontend` | Separă clar "Obiecte luate cu împrumut (Chiriaș)" și "Cereri primite pentru obiectele mele (Ofertant)"; impune regulile State Machine pentru fiecare rol. | 2026-11-15 |
| **M8.3** | Caseta informativă Escrow / Stripe Test Mode v1 în `BookingWidget.tsx` + feedback vizual de status în `BookingCard.tsx` | `[x] Finalizat (2026-11-15)` | `renta-backend` + `renta-frontend` | Explicație transparentă a fluxului de plată/garanție pentru MVP și afișare date de contact după confirmarea rezervării. | 2026-11-15 |

---

### Faza 9: Sistemul de Recenzii & Audit Final QA

> **Status Fază:** `[x] Finalizat (2026-11-16)`

| ID | Element / Secțiune / Pagină | Status | Agent Responsabil | Criterii de Testare & Securitate (Definition of Done) | Data Finalizării |
| :------------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :----------------------------- | :------------------------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :---------------- |
| **M9.1** | `app/actions/reviews.ts` (`createReviewAction`, `getListingReviewsAction`, `getReviewedBookingIdsAction`) + formular recenzie 1–5 stele în `BookingCard.tsx` disponibil doar după `completed` | `[x] Finalizat (2026-11-16)` | `renta-backend` + `renta-frontend` | Constrângere unică per rezervare (`UNIQUE (booking_id, reviewer_id)`); Server Action și RLS verifică că rezervarea este `completed` și că autorul a participat la tranzacție. | 2026-11-16 |
| **M9.2** | Afișare medie rating + lista de recenzii verificate pe fișa obiectului (`app/obiect/[id]/page.tsx`) și actualizare automată prin trigger SQL pe profil și listare | `[x] Finalizat (2026-11-16)` | `renta-backend` + `renta-frontend` | Trigger-ul PostgreSQL `update_ratings_after_review` recalculează atomic `rating_avg` și `rating_count` pe `listings` și `profiles`; recenziile sunt afișate pe `/obiect/[id]`. | 2026-11-16 |
| **M9.3** | Audit final end-to-end de securitate (RLS), verificare TypeScript (`tsc --noEmit`) și configurare permanentă Workspace & Agenți (`RentA.code-workspace`, `AGENTS.md`, `.agents/agents/*`) | `[x] Finalizat (2026-11-16)` | `renta-qa-tracker` | `npx tsc --noEmit` = 0 erori, verificare completă a politicilor RLS, validare variabile de mediu, configurare workspace multi-agent și actualizare finală `CHANGELOG.md`. | 2026-11-16 |

---

---

# Roadmap Uz Comercial — Valul 1 (Fazele 10–16)

Această secțiune urmărește tranziția platformei **RentA** de la prototipul funcțional MVP v0 la o platformă comercială complet securizată, pregătită pentru tranzacții reale în România (P2P + B2C).

---

### Faza 10: Hardening Securitate, Remediere Bug-uri MVP & Finalizare CRUD

> **Status Fază:** `[x] Finalizat — Așteaptă rularea 003_commercial_hardening.sql în Supabase & testare live (2026-11-16)`

| ID | Element / Secțiune / Pagină | Status | Agent Responsabil | Criterii de Testare & Securitate (Definition of Done) | Data Finalizării |
| :-------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------ | :--------------------------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :---------------- |
| **M10.1** | Upgrade Next.js `15.5.29` (rezolvare `CVE-2025-66478`), migrare fonturi self-hosted (`next/font/local` + `@fontsource-variable/*`), instalare și scheme de validare `zod` (`lib/validations/schemas.ts`), configurare Security Headers în `next.config.ts` și restricționare `/status-db` în producție | `[x] Finalizat — Așteaptă rularea 003_commercial_hardening.sql în Supabase & testare live (2026-11-16)` | `renta-backend` | Next.js actualizat la `15.5.29`, build 100% autonom fără apeluri externe Google Fonts, headere HTTP (`X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`) active, `/status-db` protejat în producție. | 2026-11-16 |
| **M10.2** | Migrația SQL `003_commercial_hardening.sql` (separare PII în `profile_private`, `bio` + `deposit_ron` + `rating_avg`/`rating_count`, constrângere `btree_gist` anti double-booking, State Machine SQL pe `bookings`, politici RLS întărite) + actualizare `lib/types/database.ts` și Server Actions (`auth.ts`, `listings.ts`, `bookings.ts`, `reviews.ts`) | `[x] Finalizat — Așteaptă rularea 003_commercial_hardening.sql în Supabase & testare live (2026-11-16)` | `renta-backend` | Audit confirmat: nicio interogare pe `public.profiles` nu mai selectează `phone` sau `company_cui`; `EXCLUDE USING gist` previne matematic suprapunerea rezervărilor `confirmed`; telefonul partenerului este expus doar prin RPC `get_booking_partner_phone`. | 2026-11-16 |
| **M10.3** | Completare CRUD & UX Mobil (`Header.tsx` + `MobileNav.tsx` cu meniu mobil, editare anunț `/listarile-mele/[id]/editeaza`, upload avatar în `ProfileForm.tsx`, persistare `bio`, `deposit_ron` + `min_rental_days` + `cancellation_policy` în `ListingForm.tsx`, calendar zile ocupate în `BookingWidget.tsx`, rating pe `ObjectCard.tsx`, sortare & paginare `/catalog`, `app/error.tsx` & `app/not-found.tsx`) | `[x] Finalizat — Așteaptă rularea 003_commercial_hardening.sql în Supabase & testare live (2026-11-16)` | `renta-frontend` | Proprietarul își poate edita complet anunțul și gestiona pozele; meniul mobil este accesibil; zilele deja rezervate sunt marcate și validate în widget; catalogul suportă sortare și paginare; paginile `error.tsx` și `not-found.tsx` sunt active. | 2026-11-16 |
| **M10.4** | Rate limiting (`lib/security/rate-limit.ts`) pe acțiunile sensibile & verificare audit complet Faza 10 (`tsc --noEmit`, `npm run build`, audit RLS & PII) | `[x] Finalizat — Așteaptă rularea 003_commercial_hardening.sql în Supabase & testare live (2026-11-16)` | `renta-backend` + `renta-qa-tracker` | Rate limiter Token Bucket activ pe autentificare/profil/listări/rezervări/recenzii; `npx.cmd tsc --noEmit` = 0 erori; `npm.cmd run build` = 0 erori; zero scurgeri PII sau chei secrete în codul sursă. | 2026-11-16 |

---

### Faza 11: Plăți Reale, Split Comision & Garanție/Escrow (Stripe Connect)

> **Status Fază:** `[ ] În așteptare`

| ID | Element / Secțiune / Pagină | Status | Agent Responsabil | Criterii de Testare & Securitate (Definition of Done) | Data Finalizării |
| :-------------- | :-------------------------------------------------------------------------------------------------------------- | :--------------------- | :------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :---------------- |
| **M11.1** | Arhitectură financiară & migrație DB (`payout_accounts`, `payments`, `stripe_webhook_events`) | `[ ] În așteptare` | `renta-backend` | Tabele financiare protejate strict prin RLS; idempotență garantată prin stocarea `event_id` din Stripe Webhooks. | - |
| **M11.2** | Onboarding ofertant (`/profil/plati`) prin Stripe Connect | `[ ] În așteptare` | `renta-backend` + `renta-frontend` | Ofertanții (P2P și Firme) își pot conecta contul bancar prin Stripe Connect Express și pot vedea starea KYC / payout. | - |
| **M11.3** | Checkout chiriaș + mecanism garanție (`deposit_ron`) + Webhook `/api/webhooks/stripe` + eliberare plăți | `[ ] În așteptare` | `renta-backend` + `renta-frontend` | Verificare semnătură `stripe.webhooks.constructEvent`; autorizare/reținere garanție (`capture_method: manual`) și split automat al comisionului platformei. | - |

---

### Faza 12: Încredere, Verificare Telefon, Verificare Firme ANAF & Protocol Foto

> **Status Fază:** `[ ] În așteptare`

---

### Faza 13: Notificări Tranzacționale & Email (Valul 1: `M13.2`)

> **Status Fază:** `[ ] În așteptare`

| ID | Element / Secțiune / Pagină | Status | Agent Responsabil | Criterii de Testare & Securitate (Definition of Done) | Data Finalizării |
| :-------------- | :------------------------------------------------------------------------------------------------------------ | :--------------------- | :------------------------------------- | :--------------------------------------------------------------------------------------------------------------------------------- | :---------------- |
| **M13.2** | Emailuri tranzacționale Resend + React Email (confirmări, acceptări, remindere retur) + notificări in-app | `[ ] În așteptare` | `renta-backend` + `renta-frontend` | Fiecare tranziție din State Machine-ul rezervării trimite email tranzacțional și actualizează contorul de notificări in-app. | - |

---

### Faza 14: Conformitate Legală România & UE, Facturare SRL (Valul 1)

> **Status Fază:** `[ ] În așteptare`

| ID | Element / Secțiune / Pagină | Status | Agent Responsabil | Criterii de Testare & Securitate (Definition of Done) | Data Finalizării |
| :-------------- | :-------------------------------------------------------------------------------------------------------------------------------------------- | :--------------------- | :------------------------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------- | :---------------- |
| **M14.1** | Pagini legale (`/termeni-si-conditii`, `/confidentialitate`, `/politica-cookie`, ANPC/SOL) + banner cookie GDPR + Export/Ștergere cont | `[ ] În așteptare` | `renta-frontend` + `renta-backend` | Linkuri obligatorii ANPC SAL / SOL în Footer, consimțământ granular cookie-uri și opțiune funcțională de ștergere/anonimizare cont conform GDPR. | - |
| **M14.2** | Integrare facturare automată comision SRL + transmitere RO e-Factura (Oblio / SmartBill) | `[ ] În așteptare` | `renta-backend` | La fiecare rezervare finalizată se emite automat factura pentru comisionul platformei RentA, cu suport RO e-Factura pentru B2B/B2C. | - |

---

### Faza 15: Panou Administrare Minim & Branding Final (Valul 1: `M15.1`)

> **Status Fază:** `[ ] În așteptare`

| ID | Element / Secțiune / Pagină | Status | Agent Responsabil | Criterii de Testare & Securitate (Definition of Done) | Data Finalizării |
| :-------------- | :------------------------------------------------------------------------------------------------------------------------------ | :--------------------- | :------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------ | :---------------- |
| **M15.1** | Panou `/admin` (moderare anunțuri raportate, verificare firme, rezolvare dispute, KPI comisioane) + integrare SVG logo final | `[ ] În așteptare` | `renta-backend` + `renta-frontend` | Ruta `/admin` este protejată strict pe server pentru rolul `admin`; toate acțiunile de moderare sunt jurnalizate în audit log. | - |

---

### Faza 16: Testare Automată, Observabilitate & Go-Live Producție

> **Status Fază:** `[ ] În așteptare`

| ID | Element / Secțiune / Pagină | Status | Agent Responsabil | Criterii de Testare & Securitate (Definition of Done) | Data Finalizării |
| :-------------- | :---------------------------------------------------------- | :--------------------- | :----------------------------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------- | :---------------- |
| **M16.1** | Teste automate Vitest + Playwright & GitHub Actions CI | `[ ] În așteptare` | `renta-qa-tracker` | Suite de teste unitare (calcul preț, validări Zod, State Machine) și E2E (înregistrare -> listare -> rezervare -> recenzie) verzi în pipeline-ul CI. | - |
| **M16.2** | Medii Staging vs Production, Sentry, backup DB Supabase Pro | `[ ] În așteptare` | `renta-backend` + `renta-qa-tracker` | Monitorizare erori runtime prin Sentry fără scurgeri PII; backup-uri automate zilnice și PITR configurate pe Supabase. | - |
| **M16.3** | Checklist Go-Live pe domeniu `.ro` | `[ ] În așteptare` | `renta-architect` + `renta-qa-tracker` | Audit final de securitate, verificare DNS/SSL, chei Stripe Live, politici GDPR active și zero erori la `npm run build`. | - |

---

## Raport Audit Securitate & QA — Faza 10 (Uz Comercial Valul 1)

- **Compilare TypeScript (`npx.cmd tsc --noEmit`)**: **0 erori** pe întregul cod sursă.
- **Build Producție (`npm.cmd run build`)**: **0 erori** (`exit code 0`), toate cele 13 rute + Middleware compilate, fonturi self-hosted (`next/font/local` cu `@fontsource-variable/*`).
- **Audit Separare PII (`public.profiles` vs `public.profile_private`)**: Verificat cu `Select-String` pe tot directorul `app/`: nicio interogare publică pe `profiles` nu mai selectează `phone` sau `company_cui`. Datele personale și fiscale sunt stocate exclusiv în `public.profile_private` (protejat prin RLS `auth.uid() = id`), iar telefonul partenerului într-o rezervare confirmată/finalizată este returnat doar prin funcția RPC `get_booking_partner_phone(p_booking_id)`.
- **Audit Chei Secrete**: Zero apariții ale `SUPABASE_SERVICE_ROLE_KEY` sau `sb_secret` în codul de client sau în variabilele `NEXT_PUBLIC_*`.
- **Audit Integritate DB (`003_commercial_hardening.sql`)**:
  - `EXCLUDE USING gist (listing_id WITH =, daterange(start_date, end_date, '[]') WITH &&) WHERE (status = 'confirmed')` blochează matematic double-booking-ul la nivel de motor PostgreSQL.
  - Trigger-ul `trg_bookings_state_machine` garantează imutabilitatea sumelor și datelor unei rezervări și impune automatul finit de stări (`pending -> confirmed/rejected/cancelled -> completed`).
  - Trigger-ele `trg_protect_profile_private_cols` și `trg_protect_public_profile_badges` previn escaladarea privilegiilor (`role`, `phone_verified`, `kyb_verified`, `rating_avg`).

| ID | Element / Secțiune / Pagină | Status | Agent Responsabil | Criterii de Testare & Securitate (Definition of Done) | Data Finalizării |
| :-------------- | :--------------------------------------------------------------------------------------------------------------- | :--------------------- | :------------------------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :---------------- |
| **M12.1** | Verificare Telefon (OTP SMS) obligatorie pentru ofertanți/chiriași | `[ ] În așteptare` | `renta-backend` + `renta-frontend` | Utilizatorul trebuie să aibă `phone_verified = true` înainte de a publica un anunț sau de a trimite o cerere de rezervare. | - |
| **M12.2** | Verificare automată firme B2C prin API ANAF (`CUI`) + badge `Firmă Verificată` | `[ ] În așteptare` | `renta-backend` + `renta-frontend` | Interogare CUI în registrul ANAF, preluare automată denumire/sediu/stare fiscală și acordare badge verificat. | - |
| **M12.3** | Generare Proces-Verbal Digital (PDF) + Check-in / Check-out foto obligatoriu (`handover-proofs` bucket privat) | `[ ] În așteptare` | `renta-backend` + `renta-frontend` | Pozele de predare/primire sunt stocate într-un bucket privat cu Signed URLs accesibile doar părților tranzacției; PDF-ul de predare-primire se generează automat. | - |
| **M12.4** | Flux Dispute & Reclamații (`/rezervarile-mele/[id]/disputa`) | `[ ] În așteptare` | `renta-backend` + `renta-frontend` | Deschiderea unei dispute blochează eliberarea automată a garanției până la soluționare și atașează dovezile foto din check-in/check-out. | - |
