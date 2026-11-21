"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { openDisputeAction } from "@/app/actions/trust";
import type {
  BookingWithDetails,
  DisputeReason,
  DisputeRecord,
  DisputeStatus,
  HandoverProof,
} from "@/lib/types/database";

/**
 * ============================================================================
 * Flux Dispute & Blocare Garanție Escrow (`components/bookings/DisputeFormClient.tsx`)
 * ============================================================================
 *
 * Explicație pentru C/Java:
 * Această componentă Client (`"use client"`) gestionează două stări principale:
 *   1. Dacă există deja o dispută (`dispute !== null`), randează fișa oficială
 *      de status al disputei (blocând garanția Escrow) + galeria dovezilor foto.
 *   2. Dacă nu există o dispută, randează formularul securizat care trimite
 *      `booking_id`, `reason`, `claimed_amount_ron` și `description` către
 *      Server Action-ul `openDisputeAction`.
 */
interface DisputeFormClientProps {
  booking: BookingWithDetails;
  initialDispute: DisputeRecord | null;
  proofs: HandoverProof[];
  migrationMissing?: boolean;
}

const REASON_LABELS: Record<DisputeReason, string> = {
  damage: "Avarie / Deteriorare obiect",
  missing_accessories: "Accesorii lipsă la returnare",
  late_return: "Întârziere semnificativă la returnare",
  not_as_described: "Obiectul nu corespunde descrierii",
  other: "Alt motiv (specificat în descriere)",
};

function getDisputeStatusBadge(status: DisputeStatus) {
  switch (status) {
    case "open":
      return {
        label: "● DISPUTĂ DESCHISĂ — Garanția Escrow este blocată",
        className: "bg-rose-50 text-rose-800 border-rose-200",
      };
    case "under_review":
      return {
        label: "● ÎN ANALIZĂ — Moderator RentA verifică dovezile",
        className: "bg-amber-50 text-amber-800 border-amber-200",
      };
    case "resolved_owner":
      return {
        label: "✓ SOLUȚIONATĂ — În favoarea Ofertantului",
        className: "bg-emerald-50 text-emerald-800 border-emerald-200",
      };
    case "resolved_renter":
      return {
        label: "✓ SOLUȚIONATĂ — În favoarea Chiriașului",
        className: "bg-emerald-50 text-emerald-800 border-emerald-200",
      };
    case "closed":
      return {
        label: "○ ÎNCHISĂ",
        className: "bg-slate-100 text-slate-700 border-slate-200",
      };
    default:
      return {
        label: String(status).toUpperCase(),
        className: "bg-slate-100 text-slate-700 border-slate-200",
      };
  }
}

export function DisputeFormClient({
  booking,
  initialDispute,
  proofs,
  migrationMissing = false,
}: DisputeFormClientProps) {
  const router = useRouter();

  const [dispute, setDispute] = useState<DisputeRecord | null>(initialDispute);
  const [reason, setReason] = useState<DisputeReason>("damage");
  const [claimedAmount, setClaimedAmount] = useState<string>(
    booking.payment?.deposit_amount_ron
      ? String(Number(booking.payment.deposit_amount_ron))
      : "0"
  );
  const [description, setDescription] = useState("");
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

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);
    setBusy(true);

    try {
      const formData = new FormData();
      formData.set("booking_id", booking.id);
      formData.set("reason", reason);
      formData.set("claimed_amount_ron", claimedAmount || "0");
      formData.set("description", description.trim());

      const res = await openDisputeAction(formData);
      if (!res.success) {
        setErrorMsg(res.error || "Nu s-a putut deschide disputa.");
        return;
      }

      if (res.data) {
        setDispute(res.data);
      }
      setSuccessMsg(
        res.message ||
          "Disputa a fost înregistrată, iar garanția Escrow a fost blocată!"
      );
      router.refresh();
    } catch {
      setErrorMsg("Eroare la trimiterea disputei către server.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-8">
      {/* Navigare superioară */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/rezervarile-mele"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-ink-muted hover:text-ink transition-colors"
        >
          &larr; Înapoi la Rezervările Mele
        </Link>

        <Link
          href={`/rezervarile-mele/${booking.id}/proces-verbal`}
          className="catalog-btn-secondary text-xs"
        >
          📄 Vezi Proces-Verbal &amp; Încarcă Poze
        </Link>
      </div>

      {/* Sumar Rezervare */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2 font-mono text-xs">
            <span className="font-bold text-ink bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200">
              {bookingCode}
            </span>
            <span className="text-ochre font-bold">{catalogCode}</span>
            <span className="text-ink-muted">
              {booking.start_date} &rarr; {booking.end_date} ({booking.total_days}{" "}
              zile)
            </span>
          </div>
          <h1 className="font-display text-xl sm:text-2xl font-extrabold text-ink">
            Centru Dispute &amp; Protecție Escrow
          </h1>
          <p className="text-sm text-ink-muted">
            Obiect:{" "}
            <strong className="text-ink">
              {booking.listing?.title || "Obiect din Catalogul RentA"}
            </strong>{" "}
            &bull; Garanție Escrow:{" "}
            <strong className="font-mono text-ink">
              {depositRon.toFixed(0)} RON
            </strong>
          </p>
        </div>
      </div>

      {migrationMissing && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-900">
          <strong>Notă administrativă:</strong> Tabelul{" "}
          <code className="font-mono">disputes</code> nu a fost încă aplicat în
          Supabase. Aplică migrația SQL pentru Faza 12 pentru a salva dispute noi.
        </div>
      )}

      {successMsg && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-xs text-emerald-900 font-medium">
          {successMsg}
        </div>
      )}

      {/* ====================================================================
          CAZ 1: EXISTĂ DEJA O DISPUTĂ DESCHISĂ
          ==================================================================== */}
      {dispute ? (
        <section className="bg-white border border-rose-200 rounded-2xl p-6 sm:p-8 shadow-sm space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
            <span
              className={`inline-flex items-center px-3.5 py-1.5 rounded-full text-xs font-bold border ${
                getDisputeStatusBadge(dispute.status).className
              }`}
            >
              {getDisputeStatusBadge(dispute.status).label}
            </span>
            <span className="font-mono text-xs text-ink-muted">
              ID Dispută: #{dispute.id.slice(0, 8).toUpperCase()} &bull;{" "}
              {new Date(dispute.created_at).toLocaleString("ro-RO")}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-1">
              <div className="font-mono text-[10px] uppercase text-ink-muted">
                Motiv Invocat
              </div>
              <div className="font-semibold text-sm text-ink">
                {REASON_LABELS[dispute.reason] ?? dispute.reason}
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-1">
              <div className="font-mono text-[10px] uppercase text-ink-muted">
                Sumă Solicitată din Garanție
              </div>
              <div className="font-mono text-lg font-extrabold text-rose-700">
                {Number(dispute.claimed_amount_ron).toFixed(0)} RON
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-1">
              <div className="font-mono text-[10px] uppercase text-ink-muted">
                Status Garanție Escrow
              </div>
              <div className="text-sm font-semibold text-ink">
                {dispute.status === "open" || dispute.status === "under_review"
                  ? "🔒 Blocată până la soluționare"
                  : "✓ Procesată conform deciziei"}
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="font-mono text-[11px] uppercase font-bold text-ink-muted">
              Descrierea Incidentului
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 text-sm text-ink whitespace-pre-line leading-relaxed">
              {dispute.description}
            </div>
          </div>
        </section>
      ) : (
        /* ====================================================================
           CAZ 2: FORMULAR DESCHIDERE DISPUTĂ NOUĂ
           ==================================================================== */
        <section className="bg-white border border-slate-200/90 rounded-2xl p-6 sm:p-8 shadow-sm space-y-6">
          {/* Avertisment Blocare Garanție Escrow */}
          <div className="rounded-xl border border-amber-200 bg-amber-50/80 p-4 flex items-start gap-3">
            <span className="text-xl shrink-0" aria-hidden="true">
              ⚠️
            </span>
            <div className="space-y-1 text-xs text-amber-950">
              <div className="font-bold text-sm">
                Atenție: Deschiderea unei dispute blochează garanția Escrow
              </div>
              <p className="leading-relaxed">
                Odată înregistrată disputa, eliberarea automată a garanției de{" "}
                <strong className="font-mono">{depositRon.toFixed(0)} RON</strong>{" "}
                este suspendată până la soluționarea cazului. Echipa de mediere va
                analiza Procesul-Verbal și fotografiile de{" "}
                <strong>Check-in</strong> și <strong>Check-out</strong>.
              </p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Motiv Dispută */}
              <div className="space-y-1.5">
                <label
                  htmlFor="dispute-reason"
                  className="block text-xs font-semibold text-ink"
                >
                  Motivul Disputei *
                </label>
                <select
                  id="dispute-reason"
                  name="reason"
                  value={reason}
                  onChange={(e) => setReason(e.target.value as DisputeReason)}
                  required
                  className="catalog-input"
                >
                  {(
                    Object.entries(REASON_LABELS) as [DisputeReason, string][]
                  ).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Sumă Solicitată */}
              <div className="space-y-1.5">
                <label
                  htmlFor="dispute-amount"
                  className="block text-xs font-semibold text-ink"
                >
                  Sumă solicitată / prejudiciu estimat (RON) *
                </label>
                <input
                  id="dispute-amount"
                  name="claimed_amount_ron"
                  type="number"
                  min={0}
                  step="1"
                  value={claimedAmount}
                  onChange={(e) => setClaimedAmount(e.target.value)}
                  required
                  className="catalog-input font-mono"
                />
                <p className="text-[11px] text-ink-muted">
                  Garanție disponibilă în Escrow:{" "}
                  <strong className="font-mono text-ink">
                    {depositRon.toFixed(0)} RON
                  </strong>
                </p>
              </div>
            </div>

            {/* Descriere Detaliată */}
            <div className="space-y-1.5">
              <label
                htmlFor="dispute-description"
                className="block text-xs font-semibold text-ink"
              >
                Descriere detaliată a problemei *
              </label>
              <textarea
                id="dispute-description"
                name="description"
                rows={4}
                minLength={15}
                required
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Descrie clar ce s-a întâmplat, menționând diferențele față de pozele de Check-in, accesoriile lipsă sau daunele constatate la returnare..."
                className="catalog-input text-sm"
              />
            </div>

            {errorMsg && (
              <div className="rounded-lg border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs text-rose-800 font-medium">
                {errorMsg}
              </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100">
              <p className="text-xs text-ink-muted">
                Asigură-te că ai încărcat pozele de Check-in/Check-out înainte de a
                trimite disputa.
              </p>
              <button
                type="submit"
                disabled={busy}
                className="inline-flex items-center justify-center gap-2 bg-rose-600 hover:bg-rose-700 text-white font-sans font-semibold text-xs sm:text-sm px-5 py-2.5 rounded-lg transition-all shadow-sm disabled:opacity-50"
              >
                {busy
                  ? "Se înregistrează disputa..."
                  : "⚠️ Deschide Dispută & Blochează Garanția"}
              </button>
            </div>
          </form>
        </section>
      )}

      {/* ====================================================================
          PREVIZUALIZARE DOVEZI FOTO CHECK-IN / CHECK-OUT ATAȘATE REZERVĂRII
          ==================================================================== */}
      <section className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-sm space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
          <div>
            <h2 className="font-display text-base font-bold text-ink">
              📸 Dovezi Foto Atașate Rezervării (Check-in &amp; Check-out)
            </h2>
            <p className="text-xs text-ink-muted">
              Fotografiile încărcate în Protocolul de Predare-Primire sunt anexate
              automat la dosarul disputei.
            </p>
          </div>
          <Link
            href={`/rezervarile-mele/${booking.id}/proces-verbal`}
            className="text-xs font-semibold text-ochre hover:underline"
          >
            + Adaugă fotografii noi &rarr;
          </Link>
        </div>

        {proofs.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center space-y-2">
            <p className="text-xs text-ink-muted">
              Nu există încă fotografii de Check-in sau Check-out încărcate pentru
              această rezervare.
            </p>
            <Link
              href={`/rezervarile-mele/${booking.id}/proces-verbal`}
              className="catalog-btn-secondary text-xs"
            >
              Încarcă Dovezi Foto în Procesul-Verbal &rarr;
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {proofs.map((proof) => (
              <figure
                key={proof.id}
                className="rounded-xl border border-slate-200 overflow-hidden bg-slate-50"
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
                      alt={proof.notes || `Dovadă ${proof.phase}`}
                      className="w-full h-full object-cover hover:scale-105 transition-transform duration-200"
                    />
                  </a>
                ) : (
                  <div className="aspect-[4/3] flex items-center justify-center text-xs text-ink-muted">
                    Fără previzualizare
                  </div>
                )}
                <figcaption className="p-2 text-[11px] space-y-0.5">
                  <span
                    className={`inline-block font-mono text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${
                      proof.phase === "checkin"
                        ? "bg-ochre-light text-ochre"
                        : "bg-slate-200 text-ink"
                    }`}
                  >
                    {proof.phase === "checkin" ? "Check-in" : "Check-out"}
                  </span>
                  {proof.notes && (
                    <p className="text-ink-muted line-clamp-2">{proof.notes}</p>
                  )}
                </figcaption>
              </figure>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
