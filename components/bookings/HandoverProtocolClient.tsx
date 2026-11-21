"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  Camera,
  Check,
  PackageCheck,
  Printer,
  RotateCcw,
} from "lucide-react";
import { uploadHandoverProofAction } from "@/app/actions/trust";
import type {
  BookingWithDetails,
  HandoverPhase,
  HandoverProof,
} from "@/lib/types/database";

/**
 * ============================================================================
 * Protocol Predare-Primire Digital PDF & Dovezi Foto (`HandoverProtocolClient.tsx`)
 * ============================================================================
 *
 * Explicație pentru C/Java:
 * Această componentă Client (`"use client"`) primește datele rezervării și lista
 * inițială de dovezi foto (cu URL-uri semnate temporar din Supabase Storage) de la
 * Server Component-ul părinte (`proces-verbal/page.tsx`).
 *
 * - Butonul `window.print()` declanșează exportul nativ PDF/tipărire al browserului,
 *   iar clasa Tailwind `print:hidden` ascunde automat formularele de încărcare foto
 *   și navigarea, lăsând pe foaia A4 doar Procesul-Verbal oficial + galeria foto.
 */
interface HandoverProtocolClientProps {
  booking: BookingWithDetails;
  initialProofs: HandoverProof[];
  migrationMissing?: boolean;
}

export function HandoverProtocolClient({
  booking,
  initialProofs,
  migrationMissing = false,
}: HandoverProtocolClientProps) {
  const router = useRouter();

  const [proofs, setProofs] = useState<HandoverProof[]>(initialProofs);
  const [phase, setPhase] = useState<HandoverPhase>("checkin");
  const [notes, setNotes] = useState("");
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const bookingCode =
    booking.booking_code || `#REZ-${booking.id.slice(0, 4).toUpperCase()}`;
  const catalogCode =
    booking.listing?.catalog_code ||
    `#OBJ-${booking.listing_id.slice(0, 4).toUpperCase()}`;

  const depositRon =
    Number(booking.payment?.deposit_amount_ron) ||
    Number(
      (booking.listing as { deposit_ron?: number } | undefined)?.deposit_ron ?? 0
    );

  const checkinProofs = proofs.filter((p) => p.phase === "checkin");
  const checkoutProofs = proofs.filter((p) => p.phase === "checkout");

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    setSelectedFiles(files);
  }

  async function handleUpload(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (selectedFiles.length === 0) {
      setErrorMsg("Selectează cel puțin o fotografie (JPEG, PNG sau WebP).");
      return;
    }

    setBusy(true);
    try {
      const formData = new FormData();
      formData.set("booking_id", booking.id);
      formData.set("phase", phase);
      if (notes.trim()) {
        formData.set("notes", notes.trim());
      }
      for (const file of selectedFiles) {
        formData.append("photos", file);
      }

      const res = await uploadHandoverProofAction(formData);
      if (!res.success) {
        setErrorMsg(res.error || "Nu s-au putut încărca dovezile foto.");
        return;
      }

      if (res.data && res.data.length > 0) {
        setProofs((prev) => [...res.data!, ...prev]);
      }

      setNotes("");
      setSelectedFiles([]);
      const formEl = e.currentTarget;
      formEl.reset();
      setSuccessMsg(
        res.message || "Dovezile foto au fost încărcate și securizate cu succes!"
      );
      router.refresh();
    } catch {
      setErrorMsg("Eroare la încărcarea fotografiilor către server.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-8">
      {/* Bară superioară de navigare & acțiune Tipărire PDF (ascunsă la print) */}
      <div className="print:hidden flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/rezervarile-mele"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-ink-muted hover:text-ink transition-colors"
        >
          &larr; Înapoi la Rezervările Mele
        </Link>

        <div className="flex flex-wrap items-center gap-2.5">
          <Link
            href={`/rezervarile-mele/${booking.id}/disputa`}
            className="catalog-btn-secondary inline-flex items-center gap-1.5 text-xs"
          >
            <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" strokeWidth={1.8} aria-hidden="true" />
            <span>Raportează o Problemă / Dispută</span>
          </Link>
          <button
            type="button"
            onClick={() => window.print()}
            className="catalog-btn-primary inline-flex items-center gap-1.5 text-xs sm:text-sm"
          >
            <Printer className="w-4 h-4 shrink-0" strokeWidth={1.8} aria-hidden="true" />
            <span>Tipărește / Salvează PDF</span>
          </button>
        </div>
      </div>

      {migrationMissing && (
        <div className="print:hidden rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-900">
          <strong>Notă administrativă:</strong> Tabelul{" "}
          <code className="font-mono">handover_proofs</code> nu a fost încă
          aplicat în Supabase. Procesul-Verbal PDF este disponibil, iar upload-ul
          foto va deveni activ imediat după aplicarea migrației SQL pentru Faza 12.
        </div>
      )}

      {/* ====================================================================
          SECTIUNEA 1: PROCES-VERBAL DIGITAL DE PREDARE-PRIMIRE (PRINTABIL PDF)
          ==================================================================== */}
      <article className="bg-white border border-slate-200/90 rounded-2xl p-6 sm:p-10 shadow-sm print:shadow-none print:border-slate-300 print:rounded-none space-y-6">
        {/* Antet Oficial Document */}
        <header className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 border-b-2 border-ink pb-5">
          <div className="space-y-1">
            <div className="font-mono text-xs uppercase tracking-widest text-ochre font-bold">
              RENTA ROMÂNIA // DOCUMENT OFICIAL DE ÎNCHIRIERE
            </div>
            <h1 className="font-display text-2xl sm:text-3xl font-extrabold text-ink">
              PROCES-VERBAL DE PREDARE-PRIMIRE
            </h1>
            <p className="text-xs text-ink-muted">
              Încheiat electronic prin platforma RentA pentru rezervarea{" "}
              <strong className="font-mono text-ink">{bookingCode}</strong>.
            </p>
          </div>

          <div className="font-mono text-xs bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-1 shrink-0">
            <div>
              NR. REZERVARE: <strong className="text-ink">{bookingCode}</strong>
            </div>
            <div>
              COD INVENTAR: <strong className="text-ochre">{catalogCode}</strong>
            </div>
            <div>
              DATA EMITERII:{" "}
              <strong className="text-ink">
                {new Date().toLocaleDateString("ro-RO")}
              </strong>
            </div>
          </div>
        </header>

        {/* Părțile Contractante */}
        <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 space-y-1.5 text-xs">
            <div className="font-mono text-[10px] uppercase font-bold text-ochre tracking-wider">
              1. OFERTANT (PROPRIETAR / LOCATOR)
            </div>
            <div className="font-display text-base font-bold text-ink">
              {booking.owner?.display_name || "Proprietar RentA"}
            </div>
            <div className="text-ink-muted">
              Tip cont:{" "}
              <strong className="text-ink">
                {booking.owner?.account_type === "company"
                  ? "Firmă de Închirieri (B2C)"
                  : "Persoană Fizică (P2P)"}
              </strong>
              {booking.owner?.kyb_verified && (
                <span className="inline-flex items-center gap-1 ml-1.5 text-emerald-700 font-semibold">
                  <Check className="w-3.5 h-3.5 shrink-0" strokeWidth={1.8} aria-hidden="true" />
                  <span>Verificat ANAF</span>
                </span>
              )}
            </div>
            <div className="text-ink-muted">
              Localitate:{" "}
              <strong className="text-ink">
                {booking.owner?.city || booking.listing?.city || "România"}
              </strong>
            </div>
            {(booking.owner?.phone || booking.partner_phone) && (
              <div className="font-mono text-ink-muted">
                Telefon:{" "}
                <strong className="text-ink">
                  {booking.owner?.phone || booking.partner_phone}
                </strong>
              </div>
            )}
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 space-y-1.5 text-xs">
            <div className="font-mono text-[10px] uppercase font-bold text-ochre tracking-wider">
              2. CHIRIAȘ (BENEFICIAR / LOCATAR)
            </div>
            <div className="font-display text-base font-bold text-ink">
              {booking.renter?.display_name || "Chiriaș RentA"}
            </div>
            <div className="text-ink-muted">
              Tip cont:{" "}
              <strong className="text-ink">
                {booking.renter?.account_type === "company"
                  ? "Firmă (B2C)"
                  : "Persoană Fizică (P2P)"}
              </strong>
              {booking.renter?.phone_verified && (
                <span className="inline-flex items-center gap-1 ml-1.5 text-emerald-700 font-semibold">
                  <Check className="w-3.5 h-3.5 shrink-0" strokeWidth={1.8} aria-hidden="true" />
                  <span>Telefon Verificat</span>
                </span>
              )}
            </div>
            <div className="text-ink-muted">
              Localitate:{" "}
              <strong className="text-ink">
                {booking.renter?.city || "România"}
              </strong>
            </div>
            {booking.renter?.phone && (
              <div className="font-mono text-ink-muted">
                Telefon: <strong className="text-ink">{booking.renter.phone}</strong>
              </div>
            )}
          </div>
        </section>

        {/* Obiectul Închirierii & Condiții Financiare */}
        <section className="rounded-xl border border-slate-200 overflow-hidden">
          <div className="bg-slate-100/80 px-4 py-2.5 border-b border-slate-200 font-mono text-[11px] font-bold uppercase text-ink">
            3. OBIECTUL PREDĂRII-PRIMIRII &amp; CONDIȚII FINANCIARE
          </div>
          <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
            <div className="sm:col-span-2 space-y-1">
              <div className="text-ink-muted font-mono text-[10px] uppercase">
                Denumire Obiect ({catalogCode})
              </div>
              <div className="font-display text-sm font-bold text-ink">
                {booking.listing?.title || "Obiect din Catalogul RentA"}
              </div>
              <div className="text-ink-muted">
                Oraș predare: <strong>{booking.listing?.city || "—"}</strong>
              </div>
            </div>

            <div className="space-y-1">
              <div className="text-ink-muted font-mono text-[10px] uppercase">
                Perioadă Închiriere
              </div>
              <div className="font-mono font-bold text-ink">
                {booking.start_date} &rarr; {booking.end_date}
              </div>
              <div className="text-ink-muted">
                Durată totală: <strong>{booking.total_days} zile</strong>
              </div>
            </div>

            <div className="space-y-1">
              <div className="text-ink-muted font-mono text-[10px] uppercase">
                Tarif &amp; Garanție Escrow
              </div>
              <div className="font-mono font-bold text-ink">
                Chirie: {Number(booking.total_price_ron).toFixed(0)} RON
              </div>
              <div className="font-mono text-ochre font-bold">
                Garanție (deposit_ron): {depositRon.toFixed(0)} RON
              </div>
            </div>
          </div>
        </section>

        {/* Clauze de Responsabilitate */}
        <section className="space-y-2.5 text-xs text-ink-muted leading-relaxed">
          <h2 className="font-mono text-[11px] font-bold uppercase text-ink">
            4. CLAUZE DE RESPONSABILITATE &amp; PROTOCOL FOTO
          </h2>
          <ol className="list-decimal pl-5 space-y-1.5">
            <li>
              <strong>Starea la predare (Check-in):</strong> Chiriașul confirmă
              preluarea obiectului menționat mai sus în stare de funcționare,
              conformă cu fotografiile de <em>Check-in</em> încărcate în platforma
              RentA.
            </li>
            <li>
              <strong>Utilizare diligentă:</strong> Chiriașul se obligă să
              folosească obiectul conform destinației sale tehnice, să nu îl
              subînchirieze terților și să îl returneze la data convenită (
              <strong className="font-mono text-ink">{booking.end_date}</strong>).
            </li>
            <li>
              <strong>Garanția Escrow &amp; Returnare (Check-out):</strong> La
              returnare, ambele părți verifică integritatea obiectului și încarcă
              fotografiile de <em>Check-out</em>. În lipsa avariilor, garanția de{" "}
              <strong className="text-ink">{depositRon.toFixed(0)} RON</strong> se
              eliberează integral chiriașului.
            </li>
            <li>
              <strong>Soluționarea disputelor:</strong> În cazul unor daune,
              accesorii lipsă sau neconcordanțe, oricare dintre părți poate
              deschide o dispută oficială în platformă, blocând eliberarea
              automată a garanției până la soluționare pe baza dovezilor foto.
            </li>
          </ol>
        </section>

        {/* Semnături Digitale / Fizice */}
        <section className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-6 border-t border-slate-200">
          <div className="space-y-8">
            <div>
              <div className="font-mono text-[10px] uppercase font-bold text-ink-muted">
                SEMNĂTURĂ OFERTANT (PREDARE / PRIMIRE)
              </div>
              <div className="text-xs font-semibold text-ink mt-0.5">
                {booking.owner?.display_name || "Ofertant RentA"}
              </div>
            </div>
            <div className="border-b border-dashed border-slate-400 pt-4 text-[11px] font-mono text-ink-muted">
              Semnătură / Confirmare digitală RentA &bull; Data: ____ / ____ / ______
            </div>
          </div>

          <div className="space-y-8">
            <div>
              <div className="font-mono text-[10px] uppercase font-bold text-ink-muted">
                SEMNĂTURĂ CHIRIAȘ (PRIMIRE / RETURNARE)
              </div>
              <div className="text-xs font-semibold text-ink mt-0.5">
                {booking.renter?.display_name || "Chiriaș RentA"}
              </div>
            </div>
            <div className="border-b border-dashed border-slate-400 pt-4 text-[11px] font-mono text-ink-muted">
              Semnătură / Confirmare digitală RentA &bull; Data: ____ / ____ / ______
            </div>
          </div>
        </section>
      </article>

      {/* ====================================================================
          SECTIUNEA 2: FORMULAR UPLOAD PROTOCOL FOTO (ASCUNS LA PRINT)
          ==================================================================== */}
      <section className="print:hidden bg-white border border-slate-200/90 rounded-2xl p-6 shadow-sm space-y-5">
        <div className="border-b border-slate-100 pb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <span className="font-mono text-[11px] uppercase font-bold text-ochre">
              M12.3 // PROTOCOL FOTO CHECK-IN &amp; CHECK-OUT
            </span>
            <h2 className="font-display text-lg font-bold text-ink">
              Încarcă Dovezi Foto Securizate
            </h2>
          </div>
          <span className="text-xs text-ink-muted font-mono">
            Bucket privat cu URL-uri semnate
          </span>
        </div>

        <form onSubmit={handleUpload} className="space-y-4">
          {/* Selector Fază Check-in vs Check-out */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setPhase("checkin")}
              className={`p-3.5 rounded-xl border text-left transition-all ${
                phase === "checkin"
                  ? "border-ochre bg-ochre-light/60 ring-2 ring-ochre/15"
                  : "border-slate-200 bg-slate-50 hover:border-slate-300"
              }`}
            >
              <div className="flex items-center gap-1.5 font-semibold text-sm text-ink">
                <PackageCheck className="w-4 h-4 text-ochre shrink-0" strokeWidth={1.8} aria-hidden="true" />
                <span>Check-in — Predare Obiect</span>
              </div>
              <p className="text-xs text-ink-muted mt-0.5">
                Fotografii făcute la începutul închirierii (starea inițială +
                accesorii).
              </p>
            </button>

            <button
              type="button"
              onClick={() => setPhase("checkout")}
              className={`p-3.5 rounded-xl border text-left transition-all ${
                phase === "checkout"
                  ? "border-ochre bg-ochre-light/60 ring-2 ring-ochre/15"
                  : "border-slate-200 bg-slate-50 hover:border-slate-300"
              }`}
            >
              <div className="flex items-center gap-1.5 font-semibold text-sm text-ink">
                <RotateCcw className="w-4 h-4 text-ochre shrink-0" strokeWidth={1.8} aria-hidden="true" />
                <span>Check-out — Returnare Obiect</span>
              </div>
              <p className="text-xs text-ink-muted mt-0.5">
                Fotografii făcute la predarea înapoi către ofertant.
              </p>
            </button>
          </div>

          {/* Input Multi-File */}
          <div className="space-y-1.5">
            <label
              htmlFor="handover-photos"
              className="block text-xs font-semibold text-ink"
            >
              Fotografii dovadă (JPEG, PNG, WebP — poți selecta mai multe fișiere)
            </label>
            <input
              id="handover-photos"
              name="photos"
              type="file"
              multiple
              accept="image/jpeg,image/png,image/webp"
              onChange={handleFileChange}
              className="block w-full text-xs text-ink-muted file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-ochre-light file:text-ochre hover:file:bg-ochre/20 cursor-pointer border border-slate-200 rounded-lg p-1.5 bg-white"
            />
            {selectedFiles.length > 0 && (
              <p className="text-xs text-ochre font-medium">
                {selectedFiles.length}{" "}
                {selectedFiles.length === 1
                  ? "fișier selectat"
                  : "fișiere selectate"}
                : {selectedFiles.map((f) => f.name).join(", ")}
              </p>
            )}
          </div>

          {/* Observații Tehnice */}
          <div className="space-y-1.5">
            <label
              htmlFor="handover-notes"
              className="block text-xs font-semibold text-ink"
            >
              Observații tehnice / starea obiectului (opțional)
            </label>
            <textarea
              id="handover-notes"
              name="notes"
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ex: Obiect complet cu 2 acumulatori, încărcător și cutie de transport. Mică zgârietură pe carcasă laterală."
              className="catalog-input text-xs"
            />
          </div>

          {errorMsg && (
            <div className="rounded-lg border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs text-rose-800 font-medium">
              {errorMsg}
            </div>
          )}

          {successMsg && (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-xs text-emerald-800 font-medium">
              {successMsg}
            </div>
          )}

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={busy || selectedFiles.length === 0}
              className="catalog-btn-primary"
            >
              {busy
                ? "Se încarcă fotografiile..."
                : "Încarcă Dovezi Foto Securizate"}
            </button>
          </div>
        </form>
      </section>

      {/* ====================================================================
          SECTIUNEA 3: GALERII SEPARATE CHECK-IN & CHECK-OUT
          ==================================================================== */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Galerie Check-in */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h3 className="flex items-center gap-2 font-display text-base font-bold text-ink">
              <Camera className="w-4 h-4 text-ochre shrink-0" strokeWidth={1.8} aria-hidden="true" />
              <span>Dovezi Foto Check-in (Predare)</span>
            </h3>
            <span className="font-mono text-xs px-2 py-0.5 rounded-full bg-ochre-light text-ochre font-bold">
              {checkinProofs.length} poze
            </span>
          </div>

          {checkinProofs.length === 0 ? (
            <p className="text-xs text-ink-muted py-6 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200">
              Nu există încă fotografii încărcate pentru faza de Check-in.
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {checkinProofs.map((proof) => (
                <figure
                  key={proof.id}
                  className="rounded-xl border border-slate-200 overflow-hidden bg-slate-50 flex flex-col"
                >
                  {proof.signed_url ? (
                    <a
                      href={proof.signed_url}
                      target="_blank"
                      rel="noreferrer"
                      className="block aspect-[4/3] bg-slate-100 overflow-hidden"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={proof.signed_url}
                        alt={proof.notes || "Dovadă foto Check-in"}
                        className="w-full h-full object-cover hover:scale-105 transition-transform duration-200"
                      />
                    </a>
                  ) : (
                    <div className="aspect-[4/3] flex items-center justify-center text-xs text-ink-muted bg-slate-100">
                      Imagine indisponibilă
                    </div>
                  )}
                  <figcaption className="p-2.5 text-[11px] space-y-1">
                    <div className="font-mono text-[10px] text-ink-muted">
                      {new Date(proof.created_at).toLocaleString("ro-RO")}
                    </div>
                    {proof.notes && (
                      <p className="text-ink line-clamp-2">{proof.notes}</p>
                    )}
                  </figcaption>
                </figure>
              ))}
            </div>
          )}
        </div>

        {/* Galerie Check-out */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h3 className="flex items-center gap-2 font-display text-base font-bold text-ink">
              <RotateCcw className="w-4 h-4 text-ink-muted shrink-0" strokeWidth={1.8} aria-hidden="true" />
              <span>Dovezi Foto Check-out (Returnare)</span>
            </h3>
            <span className="font-mono text-xs px-2 py-0.5 rounded-full bg-slate-100 text-ink font-bold">
              {checkoutProofs.length} poze
            </span>
          </div>

          {checkoutProofs.length === 0 ? (
            <p className="text-xs text-ink-muted py-6 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200">
              Nu există încă fotografii încărcate pentru faza de Check-out.
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {checkoutProofs.map((proof) => (
                <figure
                  key={proof.id}
                  className="rounded-xl border border-slate-200 overflow-hidden bg-slate-50 flex flex-col"
                >
                  {proof.signed_url ? (
                    <a
                      href={proof.signed_url}
                      target="_blank"
                      rel="noreferrer"
                      className="block aspect-[4/3] bg-slate-100 overflow-hidden"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={proof.signed_url}
                        alt={proof.notes || "Dovadă foto Check-out"}
                        className="w-full h-full object-cover hover:scale-105 transition-transform duration-200"
                      />
                    </a>
                  ) : (
                    <div className="aspect-[4/3] flex items-center justify-center text-xs text-ink-muted bg-slate-100">
                      Imagine indisponibilă
                    </div>
                  )}
                  <figcaption className="p-2.5 text-[11px] space-y-1">
                    <div className="font-mono text-[10px] text-ink-muted">
                      {new Date(proof.created_at).toLocaleString("ro-RO")}
                    </div>
                    {proof.notes && (
                      <p className="text-ink line-clamp-2">{proof.notes}</p>
                    )}
                  </figcaption>
                </figure>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
