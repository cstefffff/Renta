---
trigger: always_on
---

# Reguli de Proiect & Context Workspace — RentA (MVP)

Acest workspace (`c:\Users\User\Desktop\Renta`) găzduiește proiectul **RentA**, un marketplace românesc peer-to-peer (P2P) și B2C (Firme de închirieri) pentru închirierea temporară de obiecte fizice.

## 1. Documente de Referință Obligatorii în Workspace
Înainte de orice modificare, consultă și menține sincronizate:
- [PROGRESS_TRACKER.md](file:///c:/Users/User/Desktop/Renta/PROGRESS_TRACKER.md) — stadiul la zi al fiecărei faze și micro-etape (`M0.1` – `M9.3`).
- [CHANGELOG.md](file:///c:/Users/User/Desktop/Renta/CHANGELOG.md) — jurnalul tehnic al tuturor modificărilor.
- [ARCHITECTURE_SPEC.md](file:///c:/Users/User/Desktop/Renta/ARCHITECTURE_SPEC.md) — schema PostgreSQL/Supabase, matricea RLS și contractul Server Actions.
- [Prompt_RentA_MVP.md](file:///c:/Users/User/Desktop/Renta/Prompt_RentA_MVP.md) — specificația de business și de produs.

## 2. Echipa de Agenți din Workspace (`.agents/agents/`)
Folosește agenții specializați pentru orice dezvoltare:
1. **`renta-architect`** — arhitectură, schemă DB, contracte TypeScript.
2. **`renta-backend`** — migrații SQL Supabase, RLS, Auth, Server Actions (`app/actions/*`).
3. **`renta-frontend`** — componente și pagini Next.js + Tailwind CSS conform Design System-ului „Fișă de Inventar” (`Cream #F5EEDD`, `Ink #211D18`, `Ochre #C17F2C`, fonturi `Archivo`, `JetBrains Mono`, `Inter`).
4. **`renta-qa-tracker`** — verificare compilare (`npx.cmd tsc --noEmit`), audit RLS și actualizarea obligatorie a `PROGRESS_TRACKER.md` și `CHANGELOG.md` după fiecare pas.

## 3. Reguli Tehnice & Stil de Lucru
- Fondatorul are baze de C/Java (anul 1 facultate) și învață TypeScript/Next.js pe parcurs: scrie cod curat, comentat în limba română, cu analogii clare C/Java.
- Pe Windows PowerShell, folosește întotdeauna `npm.cmd` și `npx.cmd` în loc de `npm` / `npx`.
- Stadiul curent: **Fazele 0–8 sunt finalizate și funcționale** (`M0.1` – `M8.3`). Următorul pas din MVP este **Faza 9 (`M9.1` – `M9.3`): Sistemul de Recenzii & Auditul Final QA**.
