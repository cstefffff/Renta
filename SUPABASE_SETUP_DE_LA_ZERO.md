# Ghid Pas-cu-Pas: Configurare Supabase de la Zero pentru RentA (MVP)

Acest ghid îți arată cum să creezi de la zero un proiect PostgreSQL + Auth + Storage în **Supabase** și să îl conectezi în **3 minute** la aplicația locală **RentA**.

---

## Pasul 1: Crearea unui Proiect Nou în Supabase

1. Accesează [https://supabase.com/dashboard](https://supabase.com/dashboard) și autentifică-te.
2. Apasă pe butonul **New project**.
3. Completează detaliile proiectului:
   - **Name:** `renta-mvp`
   - **Database Password:** Alege o parolă puternică (și salveaz-o, deși aplicația Next.js se va conecta prin API Keys + RLS).
   - **Region:** Alege o regiune europeană apropiată de România, de exemplu **Central EU (Frankfurt)** (`eu-central-1`).
4. Apasă pe **Create new project** și așteaptă ~60 de secunde până când instanța PostgreSQL devine **Active (Green)**.

---

## Pasul 2: Rularea celor 2 Migrații SQL în Supabase SQL Editor

Proiectul conține două scripturi SQL idempotente (pot fi rulate ori de câte ori dorești fără erori):

1. În meniul din stânga din Supabase Dashboard, intră în **SQL Editor** și apasă pe **+ New query**.
2. **Migrația 1 (Tabele, Secvențe `#OBJ-0001` / `#REZ-0001`, Indecși și Trigger-e):**
   - Deschide fișierul local `supabase/migrations/001_initial_schema.sql`.
   - Copiază tot conținutul său, lipește-l în **SQL Editor** și apasă pe **Run** (`Ctrl + Enter`).
   - Ar trebui să vezi mesajul `Success. No rows returned`.
3. **Migrația 2 (Row Level Security pe toate cele 5 tabele + Bucket-uri Storage `listing-images` și `avatars`):**
   - Apasă din nou pe **+ New query** în SQL Editor.
   - Deschide fișierul local `supabase/migrations/002_rls_and_storage.sql`.
   - Copiază tot conținutul său, lipește-l în **SQL Editor** și apasă pe **Run** (`Ctrl + Enter`).

> **Ce s-a creat automat în baza ta de date?**
>
> - Cele 5 tabele în schema `public`: `profiles`, `listings`, `listing_images`, `bookings`, `reviews`.
> - Trigger-ul `on_auth_user_created` care creează automat un rând în `public.profiles` de fiecare dată când un utilizator se înregistrează în `auth.users`.
> - Politicile **Row Level Security (RLS)** pe toate cele 5 tabele.
> - Cele 2 bucket-uri în **Supabase Storage**: `listing-images` și `avatars` cu politici RLS pe foldere (`{user_id}/...`).

---

## Pasul 3: (Recomandat pentru Testare Rapidă în MVP) Dezactivarea Confirmării de Email

Implicit, Supabase cere confirmarea adresei de email la înregistrare și are o limită strictă de câteva emailuri pe oră pe serverul SMTP demonstrativ. Pentru a testa instantaneu înregistrarea mai multor conturi (Persoane Fizice P2P și Firme de Închirieri B2C):

1. În meniul din stânga din Supabase Dashboard, mergi la **Authentication** $\rightarrow$ **Providers** (sau **Sign In / Providers**).
2. Dă click pe **Email**.
3. Dezactivează opțiunea **Confirm email** (trece comutatorul pe **OFF**).
4. Apasă pe **Save**.

Acum, când creezi un cont nou în `/inregistrare`, vei fi autentificat instantaneu și redirecționat în `/profil`!

---

## Pasul 4: Copierea Cheilor API în `.env.local`

1. În Supabase Dashboard, mergi la **Project Settings** (iconița rotiță din stânga-jos) $\rightarrow$ **API** (sau **Data API** / **API Keys**).
2. Copiază cele două valori în fișierul `.env.local` din rădăcina proiectului (`c:\Users\User\Desktop\Renta\.env.local`):

```env
NEXT_PUBLIC_SUPABASE_URL=https://PROIECTUL_TAU.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

> **Notă de Securitate (Analogie C/Java):**
> Cheia `anon` (`public`) este destinată să fie publică în browser, deoarece toate permisiunile de citire și scriere sunt filtrate strict de motorul PostgreSQL prin politicile **Row Level Security (RLS)** definite în `002_rls_and_storage.sql`. Nu pune **niciodată** cheia `service_role` în variabile cu prefixul `NEXT_PUBLIC_`.

---

## Pasul 5: Verificarea Conexiunii în `/status-db`

1. Pornește (sau repornește) serverul de dezvoltare Next.js:

   ```bash
   npm run dev
   ```

2. Deschide în browser: [http://localhost:3000/status-db](http://localhost:3000/status-db)
3. Vei vedea:
   - **Variabile de Mediu:** `CONFIGURAT OK`
   - **Toate cele 5 tabele (`profiles`, `listings`, `listing_images`, `bookings`, `reviews`):** `OK — Tabel activ & RLS pregătit`
4. Mergi la [http://localhost:3000/inregistrare](http://localhost:3000/inregistrare), creează primul tău cont (Persoană Fizică sau Firmă de Închirieri) și verifică în `/profil` (sau în **Supabase Dashboard $\rightarrow$ Table Editor $\rightarrow$ profiles**) că profilul tău a fost creat automat!
