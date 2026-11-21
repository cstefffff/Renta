# Changelog — Proiectul RentA

Toate modificările notabile, deciziile arhitecturale și validările QA ale platformei **RentA** sunt documentate cronologic în acest fișier.

---

## [v1.0.0-commercial-wave1-complete] — 2026-11-21
### Adăugat (Faza 16: Testare Automată Vitest + CI, Observabilitate & Checklist Go-Live `.ro` — `M16.1`–`M16.3` — 100% Roadmap Uz Comercial Valul 1 Finalizat!)
- **Suite de Teste Automate Vitest & Configurare (`M16.1`)** (`renta-qa-tracker`):
  - **`vitest.config.ts` & `package.json`**: configurat mediul de testare `node` cu alias `@` aliniat cu `tsconfig.json` și adăugate scripturile `"test": "vitest run"` și `"test:watch": "vitest"`.
  - **`tests/unit/validations.test.ts` (17 teste)**: acoperă schemele Zod `createListingSchema` & `updateListingSchema` (preț negativ/0 respins, titlu scurt respins, categorie invalidă și garanție negativă respinse, payload valid acceptat), `signUpSchema`, `updateProfileSchema` & `formatZodIssues` (telefon RO, CUI RO), `createBookingSchema`, `createReviewSchema` & `parseIsoDateUtcMs` (`end_date < start_date` respins, UUID invalid respins, rating 1..5), `isValidCategory`/`getCategoryLabel`/`getCategoryCode` și normalizarea URL-ului Supabase (`/rest/v1`) în `getSupabaseEnv`.
  - **`tests/unit/invoicing-and-security.test.ts` (7 teste)**: acoperă `calculateVatBreakdown` (TVA 19%, TVA 0%, identitatea contabilă `subtotal_ron + vat_amount_ron === total_ron`), `generateEFacturaXmlPreview` (structură XML UBL 2.1 / CIUS-RO 1.0.1 + escape strict împotriva XML Injection / XSS pentru caracterele `<script>&"'`) și Rate Limiter-ul `checkRateLimit` (permite cererile sub limită, blochează peste limită cu `allowed: false` și `retryAfterSeconds > 0`, izolare pe chei și expirare fereastră).
- **Pipeline GitHub Actions CI (`.github/workflows/ci.yml`)** (`renta-qa-tracker`):
  - Declanșat automat pe `push` și `pull_request` pe branch-ul `main`: Node 20 cu cache `npm` -> `npm ci` -> `npx tsc --noEmit` -> `npm run test` -> `npm run build` (cu variabile dummy `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` pentru build autonom în CI).
- **Observabilitate Runtime & Healthcheck (`M16.2`)** (`renta-backend`):
  - Endpoint `/api/health` (`app/api/health/route.ts`), modul de observabilitate (`lib/observability/*`), eroare globală curată (`app/error.tsx`) și documentare variabile în `.env.example`.
- **Checklist Go-Live Producție pe Domeniu `.ro` (`GO_LIVE_CHECKLIST.md` — `M16.3`)** (`renta-qa-tracker`):
  - Ghid operațional în 7 capitole: Domeniu `.ro` + DNS/SSL Vercel, Supabase Production Hardening (migrațiile `001`–`008`, RLS, PITR, promovare `admin`), Stripe Connect Live + Webhook `/api/webhooks/stripe`, Emailuri Live Resend (SPF/DKIM/DMARC), Facturare SRL & RO e-Factura, Observabilitate/Uptime (`/api/health` + Sentry) și Conformitate Legală România (Termeni, GDPR, Cookie Consent, ANPC SAL/SOL).
- **Confirmare Live Faza 15 (`M15.1`)**: Migrația `008_admin_panel_and_audit.sql` și panoul `/admin` marcate ca `[x] Finalizat & Validat Live (2026-11-21)` în `PROGRESS_TRACKER.md`.

### Verificare QA & Audit Final (`renta-qa-tracker`)
- **Vitest Unit Tests (`npm.cmd run test`)**: **24 / 24 teste PASS** (2 fișiere de test, 0 eșecuri).
- **TypeScript Check (`npx.cmd tsc --noEmit`)**: **0 erori** (`exit code 0`).
- **Status Milestone**: **MVP v0 (30/30) + Roadmap Uz Comercial Valul 1 (18/18) = 100% FINALIZAT (`v1.0.0`).**

---

## [v0.13.0-phase15-admin-panel-and-branding] — 2026-11-21
### Adăugat (Faza 15: Panou Administrare `/admin`, Audit Log, Raportare Anunțuri & Branding SVG Final — `M15.1`)
- **Arhitectură Bază de Date & RPC-uri Administrative (`supabase/migrations/008_admin_panel_and_audit.sql`)** (`renta-backend`):
  - **Funcția `public.is_current_user_admin()` (`SECURITY DEFINER STABLE`)**: verifică sigur dacă utilizatorul autentificat (`auth.uid()`) are `role = 'admin'` în `public.profile_private`, fără a expune tabelul privat prin RLS.
  - **Tabelul `public.admin_audit_logs`**: jurnal imutabil (append-only) pentru toate deciziile administrative (`admin_id`, `action`, `target_type`, `target_id`, `details`), cu RLS `SELECT` permis exclusiv administratorilor.
  - **Tabelul `public.listing_reports`**: sesizări trimise de utilizatori pentru anunțuri suspecte (`status` `'open' | 'dismissed' | 'action_taken'`), cu RLS care permite `INSERT` propriu (`auth.uid() = reporter_id`), `SELECT` pentru autor sau admin și `UPDATE` exclusiv pentru admin.
  - **3 Funcții RPC `SECURITY DEFINER SET search_path = public`**:
    - `admin_moderate_listing(p_listing_id, p_new_status, p_report_id, p_notes)`: actualizează starea anunțului (`available`/`unavailable`/`archived`), închide raportul asociat și scrie în `admin_audit_logs`.
    - `admin_verify_company(p_user_id, p_approve)`: activează flag-ul local `renta.trusted_verification = 'on'`, aprobă/revocă `kyb_verified` și jurnalizează acțiunea.
    - `admin_resolve_dispute(p_dispute_id, p_resolution, p_notes)`: soluționează disputa (`resolved_owner` cu capturarea garanției, `resolved_renter` cu restituirea sumelor sau `closed`), actualizează automat `public.payments` și jurnalizează decizia.
- **Server Actions & Panou Administrativ `/admin` (`app/actions/admin.ts`, `components/admin/AdminDashboardClient.tsx`, `app/(dashboard)/admin/page.tsx`)** (`renta-backend` + `renta-frontend`):
  - Verificare dublă a rolului `admin` pe server prin `requireAdminContext()` + politicile RLS SQL.
  - 4 carduri KPI în timp real (Volum GMV & Comision Platformă 10%, Utilizatori & Anunțuri Active, Dispute Deschise, Rapoarte Anunțuri) și 4 tab-uri interactive (`⚖️ Dispute & Escrow`, `🏢 Verificare Firme (KYB)`, `🚩 Rapoarte Anunțuri`, `📜 Jurnal Audit`), plus ecran `403 Acces Restricționat` cu instrucțiuni SQL de promovare a contului la `admin`.
- **Raportare Anunțuri & Branding Oficial SVG (`components/listings/ReportListingButton.tsx`, `public/design-assets/logo.svg`, `app/icon.svg`, `components/ui/BrandLogo.tsx`)** (`renta-frontend`):
  - Buton și modal `🚩 Raportează anunțul` montat pe `/obiect/[id]` pentru utilizatorii non-proprietari.
  - Emblema vectorială oficială RentA (`public/design-assets/logo.svg` și favicon `app/icon.svg`) integrată în `BrandLogo.tsx` și acces condiționat `🛡️ Panou Admin` în `Header.tsx`, `UserMenu.tsx` și `MobileNav.tsx`.

### Verificare QA & Audit Securitate (`renta-qa-tracker`)
- **TypeScript Check (`npx.cmd tsc --noEmit`)**: **0 erori** (`exit code 0`).
- **Audit RLS & `SECURITY DEFINER` (`008_admin_panel_and_audit.sql` & `app/actions/admin.ts`)**:
  - Toate funcțiile RPC administrative verifică explicit `IF v_admin_id IS NULL OR NOT public.is_current_user_admin() THEN RAISE EXCEPTION` la începutul execuției și au `REVOKE ALL ... FROM PUBLIC` + `GRANT EXECUTE ... TO authenticated`.
  - Fiecare Server Action din `app/actions/admin.ts` validează sesiunea și `profile_private.role === 'admin'` prin `requireAdminContext()` înainte de orice interogare.

---

## [v0.12.0-phase14-legal-gdpr-and-invoicing] — 2026-11-21
### Adăugat (Faza 14: Conformitate Legală România & UE, GDPR, ANPC/SOL & Facturare SRL / RO e-Factura — `M14.1`–`M14.2`)
- **Pagini Legale România & UE, Banner Cookie GDPR & Drepturi Art. 17/20 (`M14.1`)** (`renta-backend` + `renta-frontend`):
  - **Documente legale complete**: `/termeni-si-conditii` (`app/termeni-si-conditii/page.tsx`), `/confidentialitate` (`app/confidentialitate/page.tsx`) și `/politica-cookie` (`app/politica-cookie/page.tsx`), plus linkuri directe în `Footer.tsx` către **ANPC — SAL** (`https://anpc.ro/ce-este-sal/`) și **Platforma Europeană SOL / ODR** (`https://ec.europa.eu/consumers/odr`).
  - **Banner Cookie Consent Granular (`components/legal/CookieConsentBanner.tsx` & `app/layout.tsx`)**: opțiuni `Acceptă Toate`, `Doar Esențiale` și `Personalizează` (Esențiale, Analitice, Preferințe), persistate în `localStorage` (`renta_cookie_consent_v1`) cu buton de redeschidere `Preferințe Cookie`.
  - **Portabilitate Date (Art. 20 GDPR) & Dreptul la Ștergere/Anonimizare (Art. 17 GDPR)**:
    - `exportMyGdprDataAction` în `app/actions/legal.ts` + descărcare fișier `.json` în `components/profile/GdprPrivacyPanel.tsx` (`/profil`).
    - Funcție RPC `public.anonymize_my_account_gdpr()` (`SECURITY DEFINER SET search_path = public` în `007_legal_gdpr_and_invoicing.sql`) + `anonymizeMyAccountAction`: verifică lipsa rezervărilor active (`pending`/`confirmed`), arhivează anunțurile utilizatorului și anonimizează PII-ul din `public.profiles` și `public.profile_private`, păstrând integritatea fiscală a facturilor istorice.
- **Facturare Automată Comision SRL & Export XML UBL 2.1 RO e-Factura (`M14.2`)** (`renta-backend` + `renta-frontend`):
  - **Tabelul `public.invoices` & Secvența `public.invoice_number_seq` (`007_legal_gdpr_and_invoicing.sql`)**: serie automată `RNT-YYYY-XXXX`, RLS strict pentru participanți (`auth.uid() = owner_id OR auth.uid() = renter_id`), defalcare `subtotal_ron` + `vat_amount_ron` (TVA 19%) = `total_ron` și stare `efactura_status` (`not_applicable` pentru P2P fără CUI, `pending_anaf`/`submitted` pentru firme B2B/B2C).
  - **Motor Facturare & Generator XML UBL 2.1 (`lib/invoicing/provider.ts` & `app/actions/legal.ts`)**: `calculateVatBreakdown`, `generateEFacturaXmlPreview` (compatibil CIUS-RO 1.0.1 ANAF RO e-Factura cu sanitizare XML) și `issueCommissionInvoiceAction` (idempotent, apelat automat în `releaseEscrowAndDepositAction` din `app/actions/payments.ts` la finalizarea rezervării).
  - **Vizualizare Factură PDF & Descărcare XML e-Factura (`app/(dashboard)/profil/facturi/[id]/page.tsx`, `InvoicePrintClient.tsx` & `PayoutOnboardingPanel.tsx`)**: pagină fiscală A4 printabilă/PDF cu buton de descărcare `.xml` UBL 2.1 și tabel de facturi emise integrat în `/profil/plati`.

### Verificare QA & Audit Securitate (`renta-qa-tracker`)
- **TypeScript Check (`npx.cmd tsc --noEmit`)**: **0 erori** (`exit code 0`).
- **Audit RLS & `SECURITY DEFINER` (`007_legal_gdpr_and_invoicing.sql`)**:
  - `public.invoices` are `ENABLE ROW LEVEL SECURITY` activ (`SELECT` permis doar pentru `owner_id` și `renter_id`, `INSERT` permis doar pentru `owner_id`).
  - Funcția `public.anonymize_my_account_gdpr()` folosește `SECURITY DEFINER SET search_path = public`, `REVOKE ALL ... FROM PUBLIC` și `GRANT EXECUTE ... TO authenticated`, plus `set_config('renta.trusted_verification', 'on', true)` local pe tranzacție.

---

## [v0.11.0-phase13-notifications-and-resend] — 2026-11-21
### Adăugat (Faza 13: Notificări Tranzacționale In-App & Email Resend — `M13.2`)
- **Bază de Date & Securitate Notificări (`supabase/migrations/006_notifications_and_emails.sql`)** (`renta-backend`):
  - **Tabelul `public.notifications`**: stochează notificările utilizatorilor (`type` din 10 categorii tranzacționale: `booking_created`, `booking_confirmed`, `booking_rejected`, `booking_completed`, `booking_cancelled`, `payment_paid`, `payment_released`, `dispute_opened`, `review_received`, `system`, plus `title`, `body`, `action_url`, `booking_id`, `is_read`, `email_sent`).
  - **Politici RLS Stricte**: `SELECT`, `UPDATE` și `DELETE` sunt permise strict pentru proprietarul notificării (`auth.uid() = user_id`), fără politică `INSERT` directă din client (pentru a preveni injectarea de notificări false în inbox-ul altor utilizatori).
  - **Funcție RPC `public.create_system_notification` (`SECURITY DEFINER SET search_path = public`)**: permite serverului, în contextul unei acțiuni autentificate (`auth.uid() IS NOT NULL`), să insereze în siguranță notificări către partenerul tranzacției.
- **Serviciu Email Tranzacțional Mod Dual Resend / Sandbox (`lib/email/resend.ts` & `.env.example`)** (`renta-backend`):
  - Când `RESEND_API_KEY` este configurată, expediază emailuri HTML responsive în stilul RentA Storefront (`#109E82`) prin Resend REST API (`https://api.resend.com/emails`, timeout 5s, sanitizare HTML `escapeHtml`).
  - Când `RESEND_API_KEY` lipsește, rulează automat în modul gratuit **In-App Sandbox**, fără a bloca fluxul principal.
- **Server Actions & Integrare în Toate Fluxurile Tranzacționale (`app/actions/notifications.ts`, `bookings.ts`, `payments.ts`, `trust.ts`, `reviews.ts`)** (`renta-backend`):
  - `getMyNotificationsAction`, `markNotificationReadAction`, `markAllNotificationsReadAction`, `deleteNotificationAction` și `dispatchNotification` (apelat automat la crearea/schimbarea stării unei rezervări, plata în Escrow, eliberarea/reținerea garanției, deschiderea unei dispute și primirea unei recenzii).
- **Clopoțel Interactiv în Header & Pagina Centrului de Notificări (`components/layout/NotificationBell.tsx`, `Header.tsx`, `UserMenu.tsx`, `MobileNav.tsx`, `app/(dashboard)/notificari/page.tsx`)** (`renta-frontend`):
  - Dropdown rapid în `Header.tsx` cu badge numeric pentru notificările necitite, marcare ca citit la click și buton „Marchează tot citit”.
  - Pagina dedicată `/notificari` (`NotificationsPageClient.tsx`) cu filtre `Toate` / `Necitite`, indicator de mod (`Resend Live` vs `In-App Sandbox`), marcare individuală/în masă și ștergere.

### Verificare QA & Audit Securitate (`renta-qa-tracker`)
- **TypeScript Check (`npx.cmd tsc --noEmit`)**: **0 erori** (`exit code 0`).
- **Audit RLS, `SECURITY DEFINER` & Variabile Secrete**:
  - `public.notifications` are RLS activ și blochează `INSERT`-ul direct din client; `create_system_notification` folosește `SECURITY DEFINER SET search_path = public` cu `REVOKE ALL ... FROM PUBLIC` și `GRANT EXECUTE ... TO authenticated`.
  - Confirmat că `RESEND_API_KEY` nu folosește prefixul `NEXT_PUBLIC_` și este citită exclusiv pe server.

---

## [v0.10.0-phase12-trust-anaf-handover-disputes] — 2026-11-21
### Adăugat (Faza 12: Încredere, Verificare Telefon OTP, Verificare Firme ANAF, Protocol Foto Check-in/Check-out + Proces-Verbal Digital PDF & Flux Dispute — `M12.1`–`M12.4`)
- **Verificare Telefon prin OTP SMS — Mod Dual Twilio/Sandbox (`M12.1`)** (`renta-backend` + `renta-frontend`):
  - **Tabelul `public.phone_otp_codes` (`005_trust_verification_handover_disputes.sql`)**: stochează exclusiv hash-ul SHA-256 al codului OTP (`code_hash`), expirarea la 10 minute (`expires_at`) și contorul de încercări (`attempts < 5`), protejat prin RLS strict `auth.uid() = user_id`.
  - **Funcție RPC `complete_phone_otp_verification(p_phone, p_code_hash)` (`SECURITY DEFINER`)**: validează atomic hash-ul OTP, marchează codul ca folosit (`consumed_at = NOW()`), activează flag-ul local tranzacției `renta.trusted_verification = 'on'` pentru a trece controlat de trigger-ele anti-falsificare din Migrația 003 și setează `phone_verified = true` atât în `public.profile_private`, cât și în `public.profiles`.
  - **Server Actions (`app/actions/trust.ts`) & UI (`components/profile/TrustVerificationCard.tsx`)**: `requestPhoneOtpAction` și `verifyPhoneOtpAction`, cu expediere SMS prin Twilio REST API (dacă `TWILIO_ACCOUNT_SID` este configurat) sau afișare directă a codului `demoCode` în modul Sandbox gratuit.
- **Verificare Automată Firme B2C prin API ANAF (`CUI`) & Badge `🏢 Firmă Verificată ✓` (`M12.2`)** (`renta-backend` + `renta-frontend`):
  - **Algoritm oficial cifră de control CUI & Interogare ANAF v9 (`verifyCompanyAnafAction`)**: validează matematic CUI-ul cu cheia de test `753217532`, interoghează serviciul oficial `https://webservicesp.anaf.ro/PlatitorTvaRest/api/v9/ws/tva` (timeout 4.5s + fallback determinist când serverul ANAF este în mentenanță) și apelează RPC-ul `complete_company_kyb_verification` (`SECURITY DEFINER`) pentru a popula `kyb_verified = true`, `company_name`, `company_address` și `kyb_verified_at`.
  - **Badge Vizual în Catalog (`components/catalog/ObjectCard.tsx`)**: afișează badge-ul `🏢 Firmă Verificată ✓` pentru toate anunțurile publicate de firme verificate ANAF (`owner.kyb_verified`).
- **Protocol Foto Check-in / Check-out & Proces-Verbal Digital PDF (`M12.3`)** (`renta-backend` + `renta-frontend`):
  - **Tabelul `public.handover_proofs` & Bucket Privat `handover-proofs` (`public = false`)**: politici RLS și Storage care permit încărcarea (`<= 5MB`, `JPG/PNG/WEBP`) și citirea exclusiv pentru cei 2 participanți ai rezervării (`renter_id` sau `owner_id`), cu acces prin Signed URLs temporare (valabile 1 oră) generate pe server în `getHandoverProofsAction`.
  - **Pagina Proces-Verbal Digital (`app/(dashboard)/rezervarile-mele/[id]/proces-verbal/page.tsx` & `HandoverProtocolClient.tsx`)**: document oficial de predare-primire cu datele părților, echipamentului (`#OBJ-XXXX`), perioadei, tarifelor, grilei de fotografii horodatate la predare (`checkin`) și returnare (`checkout`), bloc de semnături și buton `🖨️ Tipărește / Salvează PDF` (`window.print()` cu stiluri `@media print`).
- **Flux Dispute & Blocare Automată Garanție Escrow (`M12.4`)** (`renta-backend` + `renta-frontend`):
  - **Tabelul `public.disputes` & `openDisputeAction`**: permite oricărui participant al unei rezervări `confirmed` sau `completed` să deschidă o dispută (`damage`, `missing_accessories`, `late_return`, `not_as_described`, `other`) cu sumă pretinsă din garanție (`claimed_amount_ron`) și îngheață instantaneu eliberarea garanției (`public.payments.payment_status = 'disputed'`).
  - **Pagina Dispute (`app/(dashboard)/rezervarile-mele/[id]/disputa/page.tsx` & `DisputeFormClient.tsx`) + Integrare în `BookingCard.tsx`**: formular de deschidere/vizualizare dosar dispută cu probele foto atașate și butoane rapide `📋 Proces-Verbal & Foto Predare/Retur` și `⚠️ Raportează Problemă / Dispută` pe cardul fiecărei rezervări eligibile.

### Verificare QA & Audit Securitate (`renta-qa-tracker`)
- **TypeScript Check (`npx.cmd tsc --noEmit`)**: **0 erori** (`exit code 0`).
- **Audit RLS, Bucket Privat & `SECURITY DEFINER` (`005_trust_verification_handover_disputes.sql`)**:
  - Tabelele `phone_otp_codes`, `handover_proofs` și `disputes` au `ENABLE ROW LEVEL SECURITY` activ; bucket-ul `handover-proofs` este privat (`public = false`) și verifică apartenența la rezervare pe `(storage.foldername(name))[1] = booking_id` și `(storage.foldername(name))[2] = auth.uid()`.
  - Funcțiile `complete_phone_otp_verification` și `complete_company_kyb_verification` folosesc `SECURITY DEFINER SET search_path = public` și variabila locală pe tranzacție `set_config('renta.trusted_verification', 'on', true)`, menținând intactă protecția împotriva modificării directe din client a coloanelor `phone_verified` și `kyb_verified`.

---

## [v0.9.0-phase11-payments-and-escrow] — 2026-11-21
### Adăugat (Faza 11: Plăți, Split Comision 10% & Garanție/Escrow — Stripe Connect + Mod Sandbox Gratuit — `M11.1`–`M11.3`)
- **Arhitectură Financiară Mod Dual & Migrația `004_payments_and_escrow.sql` (`M11.1`)** (`renta-backend`):
  - **Tabelul `public.payout_accounts`**: conturi de încasare 1:1 cu `public.profiles` (`stripe_account_id`, `mode` `'stripe' | 'sandbox'`, `onboarding_status`, `charges_enabled`, `payouts_enabled`, `details_submitted`, `iban_last4`), protejat prin RLS strict `auth.uid() = user_id`.
  - **Tabelul `public.payments`**: registru financiar Escrow 1:1 cu `public.bookings` (`rental_amount_ron`, `platform_fee_ron` 10%, `owner_payout_ron` 90%, `deposit_amount_ron`, `total_charged_ron`, `payment_status` `'unpaid' | 'authorized' | 'paid' | 'released' | 'refunded' | 'disputed'`, `deposit_status` `'none' | 'held' | 'released' | 'captured'`), protejat prin RLS strict pentru participanții tranzacției (`auth.uid() = renter_id OR auth.uid() = owner_id`).
  - **Tabelul `public.stripe_webhook_events`**: tabelă de idempotență cu cheie primară `event_id` și `ENABLE ROW LEVEL SECURITY` fără politici publice (accesibilă exclusiv pe server prin `SUPABASE_SERVICE_ROLE_KEY`).
  - **Singleton Stripe & Mod Dual (`lib/stripe/config.ts`, `lib/types/database.ts`, `.env.example`)**: comutare automată între API-ul oficial Stripe Connect (`"stripe"`, când `STRIPE_SECRET_KEY` este prezentă) și Simulatorul Escrow Gratuit (`"sandbox"`, când cheile Stripe lipsesc).
- **Onboarding Financiar Ofertant la `/profil/plati` (`M11.2`)** (`renta-backend` + `renta-frontend`):
  - **Server Actions (`app/actions/payments.ts`)**: `getMyPayoutAccountAction`, `startPayoutOnboardingAction(formData?)` (creează cont Stripe Connect Express + `accountLinks` sau activează instant contul Sandbox cu ultimele 4 caractere din IBAN) și `getPaymentsForMyBookingsAction`.
  - **Panou & Pagină dedicată (`components/payments/PayoutOnboardingPanel.tsx` & `app/(dashboard)/profil/plati/page.tsx`)**: afișează starea KYC (`charges_enabled`, `payouts_enabled`, `iban_last4`), cele 4 carduri KPI financiare (Volum Total Chirii, Comision Platformă 10%, Încasări Nete Proprietar 90% și Garanții Blocate în Escrow) și tabelul tranzacțiilor.
  - **Navigație integrată**: card de acces rapid în `app/(dashboard)/profil/page.tsx` și link `Plăți & Cont Încasare (Escrow)` în secțiunea `CA PROPRIETAR` din `components/layout/UserMenu.tsx`.
- **Checkout Chiriaș, Garanție Escrow & Webhook Stripe Idempotent (`M11.3`)** (`renta-backend` + `renta-frontend`):
  - **`initiateBookingCheckoutAction(bookingId)`**: recalculează exclusiv pe server chiria, comisionul de 10% (`platform_fee_ron`), suma netă a proprietarului (`owner_payout_ron`) și garanția (`deposit_amount_ron`), inițiind fie o sesiune `stripe.checkout.sessions.create` (cu `application_fee_amount` și `transfer_data.destination`), fie plata instantanee în Escrow Sandbox.
  - **`releaseEscrowAndDepositAction(bookingId, depositDecision)`**: permite proprietarului, la returnarea echipamentului, să marcheze rezervarea ca `completed`, să elibereze chiria netă (`payment_status = 'released'`) și să deblocheze garanția către chiriaș (`deposit_status = 'released'`) sau să o rețină pentru daune (`deposit_status = 'captured'`).
  - **Ruta Webhook `/api/webhooks/stripe` (`app/api/webhooks/stripe/route.ts`)**: verifică semnătura HMAC-SHA256 pe corpul brut (`request.text()`) prin `stripe.webhooks.constructEvent`, garantează idempotența în `public.stripe_webhook_events` (cod PostgreSQL `23505`) și procesează `checkout.session.completed`, `account.updated` și `charge.refunded`.
  - **Panou Financiar Escrow în `components/bookings/BookingCard.tsx` & `app/actions/bookings.ts`**: fiecare rezervare confirmată/finalizată afișează defalcarea financiară, badge-urile de status pentru plată și garanție, butonul de Checkout pentru chiriaș și butoanele de finalizare + eliberare/reținere garanție pentru proprietar.

### Verificare QA, Build & Audit Securitate (`renta-qa-tracker`)
- **TypeScript Check (`npx.cmd tsc --noEmit`)**: **0 erori** (`exit code 0`).
- **Production Build (`npm.cmd run build`)**: **0 erori** (`exit code 0`, 16 rute + Middleware compilate cu succes, inclusiv `/profil/plati` și `/api/webhooks/stripe`).
- **Audit RLS & Variabile Secrete (`004_payments_and_escrow.sql` & `.env.example`)**:
  - Toate cele 3 tabele financiare noi au `ENABLE ROW LEVEL SECURITY`; `stripe_webhook_events` este complet izolat față de clienții `anon`/`authenticated`.
  - Nicio cheie privată (`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `SUPABASE_SERVICE_ROLE_KEY`) nu folosește prefixul `NEXT_PUBLIC_`.

---

## [v0.8.4-multi-photo-gallery-and-cta] — 2026-11-21
### Adăugat & Îmbunătățit (Galerie Foto Interactivă, CTA `+ Listează` Pronunțat & Extindere Inventar Multi-Foto)
- **Evidențiere CTA `+ Listează` în Top Header (`src/components/layout/Header.tsx`)** (`renta-frontend`):
  - Butonul `+ Listează` din dreapta header-ului a fost transformat într-o pastilă pronunțată (`h-9 px-4 rounded-full bg-ochre hover:bg-ochre-hover text-white text-xs font-semibold shadow-sm`), aliniată la înălțime cu butonul rotund `Favorite (♥)` (`w-9 h-9`) și capsula `UserMenu`.
- **Galerie Foto Interactivă pe Pagina Obiectului (`src/components/listings/ProductGallery.tsx` & `src/app/obiect/[id]/page.tsx`)** (`renta-frontend`):
  - Componentă client `ProductGallery.tsx` pentru navigarea între fotografiile echipamentului: butoane anterioară/următoare (`‹` / `›`), indicator `1 / N fotografii` și rând de miniaturi (thumbnails) interactive cu chenar activ Emerald Teal (`ring-2 ring-ochre/30`).
- **Indicator Număr Fotografii pe Carduri & Grilă Catalog 12/Pagină (`src/components/catalog/ObjectCard.tsx` & `src/app/catalog/page.tsx`)** (`renta-frontend`):
  - Afișarea unui badge cu iconiță cameră + numărul total de fotografii în colțul dreapta-jos al imaginii pentru toate anunțurile cu mai multe poze (`images.length > 1`).
  - Ajustarea `pageSize` la `12` în `/catalog` pentru rânduri complete pe grilele de 2, 3 și 4 coloane.
- **Populare Inventar Multi-Foto în Supabase (`#OBJ-0014` – `#OBJ-0023`)**:
  - Adăugarea a **10 anunțuri noi** (5 P2P + 5 Firme B2C), fiecare având câte **3 fotografii distincte** (vedere principală, detaliu tehnic și accesorii incluse — 30 imagini noi încărcate în bucket-ul `listing-images`), ridicând inventarul activ al platformei la **23 de anunțuri**.

### Verificare QA (`renta-qa-tracker`)
- **TypeScript Check (`npx.cmd tsc --noEmit`)**: **0 erori** (`exit code 0`).

---

## [v0.8.3-compact-header-airbnb-pill] — 2026-11-21
### Schimbat & Adăugat (Header Compact „Airbnb Pill” & Scurtătură Căutare `Ctrl + K`)
- **Decongestionare Top Header (`src/components/layout/Header.tsx`)** (`renta-frontend`):
  - Eliminarea celor 7 elemente concurente din dreapta (badge-ul static `🇷🇴 RO`, linkul text `Favorite`, butoanele separate `Rezervări` și `Inventar`, pastila cu emailul lung și butonul separat `Delogare`).
  - Păstrarea a doar **3 acțiuni clare** în zona din dreapta: CTA-ul primar **`+ Listează`** (`/listarile-mele/nou`), butonul rotund icon-only **`Favorite (♥)`** (`/favorite`) cu badge numeric flotant (`FavoriteNavBadge`) și capsula de cont **`<UserMenu />`**.
- **Meniu Dropdown de Cont în Stil „Airbnb Pill” (`src/components/layout/UserMenu.tsx`)** (`renta-frontend`):
  - Buton-capsulă (`rounded-full`) cu iconiță hamburger (`☰`) + avatar (fotografie sau inițiale pe fundal `#E6F6F3`) și punct verde de sesiune activă.
  - Dropdown structurat pe **5 secțiuni**:
    1. **Antet Identitate**: nume/companie, email și badge de cont (`CONT P2P` vs `FIRMĂ B2C`).
    2. **Secțiunea „CA CHIRIAȘ”**: `Rezervările Mele` (`/rezervarile-mele`), `Anunțuri Apreciate` (`/favorite` cu contor live) și `Explorează Catalogul` (`/catalog`).
    3. **Secțiunea „CA PROPRIETAR”**: `Inventarul Meu` (`/listarile-mele`) și `+ Adaugă Obiect Nou` (`/listarile-mele/nou`).
    4. **Secțiunea „CONT & SISTEM”**: `Profil & Verificare` (`/profil`).
    5. **Footer Acțiune**: `Delogare` (`signOutAction`).
  - Accesibilitate completă: `aria-expanded`, `aria-haspopup="menu"`, închidere la tasta `Escape` cu restaurarea focusului pe butonul trigger, închidere la click în exterior și la schimbarea rutei (`usePathname`).
- **Bară de Căutare cu Scurtătură Reală `Ctrl + K` / `⌘ + K` (`src/components/layout/SearchBar.tsx`)** (`renta-frontend`):
  - Ascultător global `keydown` pentru `Ctrl + K` (Windows/Linux) și `⌘ + K` (macOS) care mută instantaneu focusul și selectează textul din inputul de căutare, plus tasta `Escape` pentru `blur()`.
- **Aliniere Sertar Mobil (`src/components/layout/MobileNav.tsx`)** (`renta-frontend`):
  - Reorganizarea linkurilor din meniul mobil pe aceleași secțiuni semantice (`Ca Chiriaș`, `Ca Proprietar`, `Cont & Sistem`) pentru consistență între desktop și mobil.

### Verificare QA (`renta-qa-tracker`)
- **TypeScript Check (`npx.cmd tsc --noEmit`)**: **0 erori** (`exit code 0`).
- **Audit Accesibilitate (a11y)**: Meniul `UserMenu` și sertarul `MobileNav` gestionează corect `Escape`, click-outside, atributele ARIA și focusul din tastatură.

---

## [v0.8.2-favorites-system] — 2026-11-21
### Adăugat & Îmbunătățit (Sistemul de Anunțuri Apreciate / Favorite)
- **Server Actions pentru Favorite & Sincronizare Cont (`src/app/actions/listings.ts`)** (`renta-backend`):
  - `getListingsByIdsAction(ids: string[])`: validează lista de UUID-uri (maxim 50), interoghează anunțurile disponibile din `public.listings` cu `owner` și `category`, și păstrează ordinea exactă a ID-urilor salvate de utilizator.
  - `getUserFavoriteIdsAction()`: returnează lista `user_metadata.favorite_listing_ids` din Supabase Auth pentru utilizatorul autentificat (sau `[]` pentru vizitatori).
  - `syncUserFavoriteIdsAction(ids: string[])`: validează UUID-urile și persistă lista de favorite în `auth.updateUser({ data: { favorite_listing_ids } })`.
- **Store Reactiv cu `useSyncExternalStore` & Sincronizare Hibridă (`src/lib/favorites/useFavorites.ts`)** (`renta-frontend`):
  - Persistență instantanee în `localStorage` (`renta_favorite_listing_ids_v1`) sincronizată între toate componentele și tab-urile deschise, plus reconciliere automată (union) cu `user_metadata.favorite_listing_ids` din Supabase Auth pentru utilizatorii autentificați.
- **Buton Interactiv de Apreciere & Badge Live în Navigație (`src/components/catalog/FavoriteButton.tsx`, `FavoriteNavBadge.tsx`, `ObjectCard.tsx`, `src/app/obiect/[id]/page.tsx`)** (`renta-frontend`):
  - Înlocuirea iconiței decorative de pe `ObjectCard.tsx` cu componenta interactivă `FavoriteButton` (`<button type="button" aria-pressed={active}>`), eliminând efectul fals de înroșire la `group-hover` pe card: inimioara își schimbă culoarea doar la hover direct pe buton sau când anunțul este apreciat (`fill-current text-rose-500 bg-rose-50 border-rose-200`).
  - Integrarea butonului `Salvează` / `Salvat la favorite` și în antetul paginii de detaliu `/obiect/[id]`.
  - Adăugarea linkului către `/favorite` cu contor numeric live (`FavoriteNavBadge`) în `SidebarRail.tsx`, `Header.tsx` și `MobileNav.tsx`.
- **Pagina Dedicată Anunțuri Apreciate (`src/app/favorite/page.tsx` — `/favorite`)** (`renta-frontend`):
  - Pagină completă pentru vizualizarea și gestionarea anunțurilor salvate, cu filtre rapide pe segment (`Toate` / `De la Oameni (P2P)` / `Firme de Închirieri (B2C)`), acțiune de golire a listei și stare goală cu CTA-uri directe către `/catalog`.

### Verificare QA (`renta-qa-tracker`)
- **TypeScript Check (`npx.cmd tsc --noEmit`)**: **0 erori** (`exit code 0`).
- **Audit Securitate Server Actions**: Toate ID-urile transmise către `getListingsByIdsAction` și `syncUserFavoriteIdsAction` sunt filtrate cu regex strict UUID și plafonate la maximum 50 de elemente.

---

## [v0.8.1-demo-seed-and-live-deploy] — 2026-11-21
### Adăugat & Validat Live
- **Deployment Vercel & Confirmare Migrație `003_commercial_hardening.sql`**:
  - Aplicația a fost publicată pe Vercel (`https://renta-peach.vercel.app`) și conectată la instanța Supabase cu schema comercială completă (`deposit_ron`, `min_rental_days`, `cancellation_policy`, `rating_avg`, `profile_private`).
- **Populare Conturi Demo & Inventar Multi-Categorie (`#OBJ-0002` – `#OBJ-0013`)**:
  - **4 conturi noi** (2 Peer-to-Peer + 2 Firme B2C): `Andrei Popescu` (București), `ProRent Unelte & Utilaje SRL` (Cluj-Napoca), `Elena Ionescu` (Brașov) și `EventSound & Party Logistics SRL` (Timișoara).
  - **12 anunțuri noi** distribuite în toate cele 8 categorii (`scule-unelte`, `foto-video`, `camping-outdoor`, `evenimente-party`, `electronice`, `vestimentar`, `sport-timp-liber`, `altele`) și 5 orașe, fiecare cu imagine încărcată în Supabase Storage (`listing-images`).
  - **3 fluxuri complete de rezervare & recenzie** (`#REZ-0006` – `#REZ-0008`), populând ratingurile reale pe `#OBJ-0002` (5★), `#OBJ-0007` (5★) și `#OBJ-0011` (4★).

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
