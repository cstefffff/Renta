# RentA — Checklist Go-Live Producție pe Domeniu `.ro` (`M16.3`)

Acest ghid reprezintă lista oficială de verificare pre-lansare pentru trecerea platformei **RentA** din modul de validare/sandbox în **producție comercială live** pe domeniu propriu `.ro`.

> **Regulă de Aur:** Bifează fiecare punct în ordinea de mai jos și nu activa plățile reale Stripe Live (`sk_live_`) înainte de a finaliza verificările de securitate Supabase, DNS/SSL și conformitate legală România.

---

## 1. Configurare Domeniu `.ro` + DNS / SSL pe Vercel
- [ ] **Domeniu achiziționat (RoTLD)** — ex: `renta.ro` și `www.renta.ro`.
- [ ] **Conectare în Vercel Dashboard** → Project Settings → Domains:
  - [ ] Adăugat apex domain (`renta.ro`) cu record `A` → `76.76.21.21`.
  - [ ] Adăugat `www.renta.ro` cu record `CNAME` → `cname.vercel-dns.com` (redirect 308 către domeniul principal).
  - [ ] Confirmat certificat **SSL / HTTPS** emis automat (Let's Encrypt) și HSTS activ.
- [ ] **Variabile de mediu Production pe Vercel** (`Settings → Environment Variables`):
  - [ ] `NEXT_PUBLIC_SITE_URL=https://renta.ro` (fără slash final).
  - [ ] Confirmat că **nicio** cheie privată (`SUPABASE_SERVICE_ROLE_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `RESEND_API_KEY`, `TWILIO_AUTH_TOKEN`, `OBLIO_API_SECRET`) nu are prefix `NEXT_PUBLIC_`.
- [ ] **Verificare pagină diagnostic**: `/status-db` returnează blocat / indisponibil în producție (protecție activă din Faza 10).

---

## 2. Supabase Production Hardening
- [ ] **Toate cele 8 migrații SQL rulate în ordine pe proiectul de producție**:
  - [ ] `001_initial_schema.sql` (tabele de bază, secvențe `#OBJ-XXXX`/`#REZ-XXXX`, triggere)
  - [ ] `002_rls_and_storage.sql` (politici RLS inițiale + bucket `listing-images` & `avatars`)
  - [ ] `003_commercial_hardening.sql` (separare PII `profile_private`, `btree_gist` anti double-booking, State Machine `bookings`, protecție badge-uri)
  - [ ] `004_payments_and_escrow.sql` (`payout_accounts`, `payments`, `stripe_webhook_events`)
  - [ ] `005_trust_verification_handover_disputes.sql` (`phone_otp_codes`, `handover_proofs`, bucket privat `handover-proofs`, `disputes`, RPC-uri verificare)
  - [ ] `006_notifications_and_emails.sql` (`notifications` + RPC `create_system_notification`)
  - [ ] `007_legal_gdpr_and_invoicing.sql` (`invoices`, `invoice_number_seq`, RPC `anonymize_my_account_gdpr`)
  - [ ] `008_admin_panel_and_audit.sql` (`is_current_user_admin`, `admin_audit_logs`, `listing_reports`, 3 RPC-uri administrative)
- [ ] **Verificare RLS**: confirmat în Supabase Dashboard (`Database → Tables`) că **Row Level Security = ENABLED** pe toate tabelele din schema `public`.
- [ ] **Backup zilnic & PITR**: upgrade la **Supabase Pro** și activare Daily Backups + **Point-in-Time Recovery (PITR)** (recomandat pentru date financiare/Escrow).
- [ ] **Auth URL Configuration** (`Authentication → URL Configuration`):
  - [ ] `Site URL` setat la `https://renta.ro`.
  - [ ] `Redirect URLs` include `https://renta.ro/**` (și eliminat `http://localhost:3000` dacă proiectul este strict de producție).
- [ ] **Promovare cont fondator la `admin`**:
  - [ ] Rulat SQL în Supabase SQL Editor:
    ```sql
    UPDATE public.profile_private SET role = 'admin' WHERE id = '<UUID_CONT_FONDATOR>';
    ```
  - [ ] Confirmat accesul la `https://renta.ro/admin` și blocarea (`403`) pentru conturile standard.

---

## 3. Activare Plăți Live Stripe Connect (Escrow + Split Comision 10%)
- [ ] **Cont Stripe SRL verificat** (KYB complet pentru firma operatoare din România, cont bancar RON atașat).
- [ ] **Activare Stripe Connect (Express Accounts)** în Stripe Dashboard → Connect → Settings (branding logo RentA, culoare `#109E82`, monedă implicită `RON`).
- [ ] **Trecere de la chei Test la chei Live** în Vercel Production Environment Variables:
  - [ ] `STRIPE_SECRET_KEY=sk_live_...` (înlocuiește `sk_test_...`)
  - [ ] `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...` (înlocuiește `pk_test_...`)
- [ ] **Configurare Webhook Live** în Stripe Dashboard → Developers → Webhooks:
  - [ ] Endpoint URL: `https://renta.ro/api/webhooks/stripe`
  - [ ] Evenimente selectate:
    - `checkout.session.completed`
    - `account.updated`
    - `charge.refunded`
  - [ ] Copiat `Signing secret` (`whsec_...`) în `STRIPE_WEBHOOK_SECRET` pe Vercel.
- [ ] **Test tranzacție reală de control (ex. 5–10 RON)**: verificat split comision 10% (`application_fee_amount`), transfer net 90%, înregistrare în `public.payments` și idempotență în `public.stripe_webhook_events`.

---

## 4. Activare Emailuri Live Resend & SMS OTP (Opțional Twilio)
- [ ] **Domeniu verificat în Resend** (`Domains → Add Domain → renta.ro`):
  - [ ] Adăugate în DNS recordurile **SPF**, **DKIM** și **DMARC** (`v=DMARC1; p=quarantine; ...`).
  - [ ] Status domeniu în Resend = `Verified`.
- [ ] **Variabile de mediu pe Vercel**:
  - [ ] `RESEND_API_KEY=re_...`
  - [ ] `RESEND_FROM_EMAIL=RentA <notificari@renta.ro>`
- [ ] **Test livrare email real**: creat o rezervare de test și verificat sosirea emailului în Inbox (nu Spam) + marcarea `email_sent = true` în `public.notifications`.
- [ ] *(Opțional)* **SMS OTP live prin Twilio**: completate `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER` pentru verificarea reală prin SMS în `/profil`.

---

## 5. Facturare SRL & RO e-Factura (ANAF)
- [ ] **Datele fiscale ale firmei operatoare (SRL)** setate în Vercel Production:
  - [ ] `RENTA_ISSUER_NAME="SC RENTA MARKETPLACE SRL"`
  - [ ] `RENTA_ISSUER_CUI="RO12345678"` (sau fără prefix `RO` dacă firma este neplătitoare de TVA)
  - [ ] `RENTA_VAT_RATE="19"` (sau `"0"` pentru neplătitor de TVA)
- [ ] **Verificare emitere automată factură**: la finalizarea unei rezervări (`releaseEscrowAndDepositAction`), factura `RNT-YYYY-XXXX` se generează automat în `public.invoices` și poate fi descărcată în format PDF și **XML UBL 2.1 (CIUS-RO 1.0.1)** din `/profil/facturi/[id]`.
- [ ] *(Opțional)* **Integrare automată SPV ANAF via Oblio / SmartBill**: configurate `OBLIO_EMAIL` și `OBLIO_API_SECRET` (sau conectare SmartBill) pentru transmiterea automată a facturilor B2B/B2C în SPV ANAF în termenul legal de 5 zile calendaristice.

---

## 6. Observabilitate, Uptime & Pipeline CI/CD
- [ ] **Monitorizare Healthcheck `/api/health`**:
  - [ ] Verificat `GET https://renta.ro/api/health` returnează HTTP `200 OK` cu `{ "status": "ok" }` (sau `degraded` cu detalii structurate).
  - [ ] Configurat monitor extern gratuit (ex: UptimeRobot / Better Stack) la interval de 5 minute pe `https://renta.ro/api/health` cu alertă pe email/Slack.
- [ ] **Monitorizare Erori Runtime (Sentry)**:
  - [ ] Configurat `NEXT_PUBLIC_SENTRY_DSN` / `SENTRY_DSN` în Vercel (când integrarea Sentry este activată).
  - [ ] Verificat că erorile afișate în `app/error.tsx` nu expun stack trace-uri sau date PII către utilizatori.
- [ ] **GitHub Actions CI (`.github/workflows/ci.yml`)**:
  - [ ] Confirmat că ultimul commit pe branch-ul `main` are status **verde** la `npx tsc --noEmit`, `npm run test` (Vitest) și `npm run build`.
  - [ ] Activat **Branch Protection** pe `main` (necesită CI verde înainte de merge).

---

## 7. Verificare Legală România & UE (Conformitate Pre-Lansare)
- [ ] **Completare date reale de identificare ale SRL-ului** (Denumire, CUI, Nr. Reg. Com., Sediu Social, Email DPO/Suport) în:
  - [ ] `/termeni-si-conditii`
  - [ ] `/confidentialitate`
  - [ ] `/politica-cookie`
- [ ] **Banner Cookie Consent GDPR (`CookieConsentBanner.tsx`)**: testat în mod Incognito că apare la prima vizită, salvează preferințele granulare și permite redeschiderea din Footer.
- [ ] **Linkuri obligatorii ANPC SAL & SOL UE**: verificat că ambele pictograme/linkuri din `Footer.tsx` (`https://anpc.ro/ce-este-sal/` și `https://ec.europa.eu/consumers/odr`) sunt vizibile și funcționale pe desktop și mobil.
- [ ] **Drepturi GDPR Art. 17 & Art. 20 (`/profil`)**:
  - [ ] Testat butonul **Exportă datele mele (JSON)** — fișierul conține toate datele utilizatorului și nimic de la alți utilizatori.
  - [ ] Testat **Anonimizare cont** pe un cont dummy fără rezervări active — verificat că profilul devine anonimizat, anunțurile sunt arhivate și facturile fiscale istorice rămân intacte.
- [ ] **Curățare date demo înainte de lansarea publică** (opțional): arhivarea sau păstrarea etichetată a anunțurilor demo `#OBJ-0001` – `#OBJ-0023`.

---

*Document generat și validat de `renta-qa-tracker` în cadrul Fazei 16 (`v1.0.0-commercial-wave1-complete`).*
