import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Termeni și Condiții — RentA Store",
  description:
    "Termenii și condițiile de utilizare a platformei RentA pentru închirieri peer-to-peer (P2P) și firme de închirieri (B2C) în România.",
};

/**
 * Pagina Termeni și Condiții (`/termeni-si-conditii`) — Server Component.
 *
 * Explicație pentru dezvoltatori C / Java:
 * - Este o componentă pură de server (nu folosește `useState` sau `useEffect`),
 *   fiind randată direct în HTML static pentru SEO optim și încărcare instantanee.
 */
export default function TermeniSiConditiiPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10 space-y-6">
      {/* Breadcrumb & Navigare rapidă */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <nav
          aria-label="Breadcrumb"
          className="flex items-center gap-2 text-xs font-medium text-ink-muted"
        >
          <Link href="/" className="hover:text-ochre transition-colors">
            Acasă
          </Link>
          <span aria-hidden="true" className="text-slate-400">
            &rsaquo;
          </span>
          <span className="text-ink font-semibold">Termeni și Condiții</span>
        </nav>

        <div className="flex flex-wrap items-center gap-2 text-xs">
          <Link href="/confidentialitate" className="catalog-btn-secondary">
            Confidențialitate (GDPR)
          </Link>
          <Link href="/politica-cookie" className="catalog-btn-secondary">
            Politica Cookie
          </Link>
        </div>
      </div>

      {/* Card principal document legal */}
      <article className="bg-white border border-slate-200/90 rounded-2xl p-6 sm:p-10 shadow-sm space-y-8">
        <header className="border-b border-slate-200/80 pb-6 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center rounded-full bg-ochre-light px-3 py-1 font-mono text-[11px] font-bold uppercase tracking-wider text-ochre">
              DOCUMENT LEGAL // T&amp;C v1.0
            </span>
            <span className="font-mono text-xs text-ink-muted">
              Ultima actualizare: Noiembrie 2026
            </span>
          </div>
          <h1 className="font-display text-2xl sm:text-3xl font-extrabold text-ink tracking-tight">
            Termeni și Condiții de Utilizare — RentA
          </h1>
          <p className="text-sm text-ink-muted leading-relaxed">
            Prezentul document stabilește regulile de acces și utilizare a
            platformei online <strong>RentA</strong>, marketplace hibrid din
            România dedicat închirierii temporare de obiecte, unelte și
            echipamente între persoane fizice (<strong>Peer-to-Peer / P2P</strong>
            ) și operatori economici verificați (<strong>Firme B2C</strong>).
          </p>
        </header>

        {/* 1. Rolul RentA ca intermediar */}
        <section className="space-y-2.5">
          <h2 className="font-display text-lg font-bold text-ink">
            1. Identitatea Operatorului și Rolul RentA ca Intermediar
          </h2>
          <p className="text-sm text-ink-muted leading-relaxed">
            Platforma RentA este operată de <strong>RentA Platform SRL</strong>{" "}
            (în continuare „Operatorul” sau „RentA”), societate constituită în
            conformitate cu legislația din România. RentA acționează exclusiv în
            calitate de <strong>intermediar tehnic și comercial</strong> care
            pune la dispoziție infrastructura digitală de listare, rezervare,
            plată protejată (Escrow) și comunicare între:
          </p>
          <ul className="list-disc list-inside space-y-1.5 text-sm text-ink-muted pl-1">
            <li>
              <strong>Ofertanți (Proprietari):</strong> persoane fizice
              (Segment A — P2P) sau persoane juridice / PFA cu CUI verificat
              ANAF KYB (Segment B — Firme de închirieri) care oferă bunuri spre
              închiriere temporară.
            </li>
            <li>
              <strong>Chiriași:</strong> utilizatori autentificați care rezervă
              și utilizează bunurile listate pentru o perioadă determinată.
            </li>
          </ul>
          <p className="text-sm text-ink-muted leading-relaxed">
            Contractul de închiriere (locațiune) se încheie direct între Ofertant
            și Chiriaș. RentA nu este proprietarul bunurilor listate și nu
            garantează direct conformitatea fizică a acestora, dar pune la
            dispoziție mecanisme de verificare, Escrow și protocol foto de
            predare-primire.
          </p>
        </section>

        {/* 2. Contul de utilizator și verificarea identității */}
        <section className="space-y-2.5">
          <h2 className="font-display text-lg font-bold text-ink">
            2. Înregistrarea Contului și Verificarea Identității
          </h2>
          <p className="text-sm text-ink-muted leading-relaxed">
            Pentru a publica anunțuri sau a iniția rezervări, utilizatorul
            trebuie să aibă vârsta minimă de 18 ani și să furnizeze date reale.
            Pentru creșterea siguranței în comunitate, RentA utilizează:
          </p>
          <ul className="list-disc list-inside space-y-1.5 text-sm text-ink-muted pl-1">
            <li>
              <strong>Verificare telefon (OTP):</strong> confirmarea numărului
              de telefon mobil al utilizatorului.
            </li>
            <li>
              <strong>Verificare KYB / ANAF (pentru Firme):</strong> validarea
              Codului Unic de Înregistrare (CUI) și a stării fiscale a firmei
              partenere.
            </li>
            <li>
              <strong>Onboarding Plăți (KYC / Stripe Connect):</strong>{" "}
              verificarea identității și a contului IBAN necesare pentru
              încasarea sumelor din închirieri.
            </li>
          </ul>
        </section>

        {/* 3. Comision platformă 10% și sistemul Escrow */}
        <section className="space-y-2.5">
          <h2 className="font-display text-lg font-bold text-ink">
            3. Tarife, Comisionul de Intermediere (10%) și Garanția Escrow
          </h2>
          <p className="text-sm text-ink-muted leading-relaxed">
            Crearea contului și publicarea listărilor în catalog sunt gratuite.
            Pentru fiecare rezervare confirmată și plătită prin platformă:
          </p>
          <ul className="list-disc list-inside space-y-1.5 text-sm text-ink-muted pl-1">
            <li>
              <strong>Comision platformă (10%):</strong> RentA percepe un
              comision de intermediere de <strong>10%</strong> din valoarea
              chiriei, acoperind procesarea securizată a plăților, protecția
              Escrow, suportul pentru dispute și emiterea documentelor fiscale
              (inclusiv compatibilitate <strong>RO e-Factura</strong> pentru
              comisionul facturat).
            </li>
            <li>
              <strong>Încasare Ofertant (90% net):</strong> Ofertantul primește{" "}
              <strong>90%</strong> din valoarea chiriei, suma fiind eliberată
              automat după finalizarea închirierii și confirmarea returnării
              bunului.
            </li>
            <li>
              <strong>Garanția de bună folosință (Escrow):</strong> Dacă
              listarea prevede o garanție returnabilă, suma este blocată în
              sistemul Escrow pe durata închirierii. La returnarea bunului fără
              daune, garanția este restituită integral Chiriașului.
            </li>
          </ul>
        </section>

        {/* 4. Proces-verbal predare-primire */}
        <section className="space-y-2.5">
          <h2 className="font-display text-lg font-bold text-ink">
            4. Proces-Verbal de Predare-Primire (Protocol Foto Check-in / Check-out)
          </h2>
          <p className="text-sm text-ink-muted leading-relaxed">
            Pentru protejarea ambelor părți, atât Ofertantul, cât și Chiriașul au
            obligația de a documenta starea fizică a obiectului în aplicație la
            momentul preluării (<strong>Check-in</strong>) și al returnării (
            <strong>Check-out</strong>), prin încărcarea de fotografii clare și
            note de constatare (accesorii incluse, eventuale urme de uzură
            preexistente). Aceste dovezi stau la baza oricărei analize în caz de
            dispută.
          </p>
        </section>

        {/* 5. Politici de anulare */}
        <section className="space-y-2.5">
          <h2 className="font-display text-lg font-bold text-ink">
            5. Politici de Anulare și Rambursare
          </h2>
          <ul className="list-disc list-inside space-y-1.5 text-sm text-ink-muted pl-1">
            <li>
              <strong>Înainte de confirmarea Ofertantului:</strong> Chiriașul
              poate anula gratuit cererea de rezervare.
            </li>
            <li>
              <strong>După confirmare și plată în Escrow:</strong> Anularea cu
              cel puțin 24 de ore înainte de data începerii închirierii atrage
              rambursarea integrală a chiriei și a garanției. Anulările
              tardive (sub 24 de ore) pot atrage reținerea contravalorii primei
              zile de închiriere, garanția fiind restituită integral.
            </li>
            <li>
              <strong>Anularea din culpa Ofertantului:</strong> Chiriașul
              primește rambursare 100% (chirie + garanție), iar contul
              Ofertantului poate suferi penalizări de vizibilitate.
            </li>
          </ul>
        </section>

        {/* 6. Soluționarea disputelor */}
        <section className="space-y-2.5">
          <h2 className="font-display text-lg font-bold text-ink">
            6. Soluționarea Disputelor și Reținerea Garanției
          </h2>
          <p className="text-sm text-ink-muted leading-relaxed">
            În cazul unor daune, accesorii lipsă, întârzieri semnificative la
            returnare sau neconformități ale produsului, oricare dintre părți
            poate deschide o <strong>Dispută</strong> din pagina rezervării în
            termen de 48 de ore de la data de check-out. Pe durata analizei,
            fondurile din Escrow rămân înghețate. Echipa RentA analizează
            protocolul foto de check-in/check-out și conversația părților și
            emite o decizie imparțială privind eliberarea sau reținerea parțială
            / integrală a garanției.
          </p>
        </section>

        {/* 7. Legea aplicabilă și ANPC / SOL */}
        <section className="space-y-2.5">
          <h2 className="font-display text-lg font-bold text-ink">
            7. Legea Aplicabilă, Protecția Consumatorilor (ANPC) și Litigii
          </h2>
          <p className="text-sm text-ink-muted leading-relaxed">
            Prezenții Termeni și Condiții sunt guvernați de{" "}
            <strong>legislația din România</strong> (inclusiv Codul Civil
            român, OUG nr. 34/2014 privind drepturile consumatorilor și
            Regulamentul UE 2016/679 — GDPR). Eventualele litigii vor fi
            soluționate pe cale amiabilă sau, în caz de eșec, de către instanțele
            judecătorești competente din România.
          </p>
          <p className="text-sm text-ink-muted leading-relaxed">
            Consumatorii persoane fizice beneficiază și de procedurile de{" "}
            <a
              href="https://anpc.ro/ce-este-sal/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-ochre font-semibold hover:underline"
            >
              Soluționare Alternativă a Litigiilor (ANPC — SAL)
            </a>{" "}
            și de platforma europeană de{" "}
            <a
              href="https://ec.europa.eu/consumers/odr"
              target="_blank"
              rel="noopener noreferrer"
              className="text-ochre font-semibold hover:underline"
            >
              Soluționare Online a Litigiilor (SOL / ODR UE)
            </a>
            .
          </p>
        </section>
      </article>
    </div>
  );
}
