"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { updateBookingStatusAction } from "@/app/actions/bookings";
import { createReviewAction } from "@/app/actions/reviews";
import type { BookingStatus, BookingWithDetails } from "@/lib/types/database";

/**
 * Cardul unei Cereri de Rezervare (`components/bookings/BookingCard.tsx`).
 *
 * Explicație pentru C/Java:
 * Implementează interfața grafică a automatului de stări (State Machine) pentru
 * o rezervare (`pending` -> `confirmed` -> `completed` sau `rejected` / `cancelled`).
 * Când o rezervare ajunge în starea finală `completed`, deblochează formularul
 * de evaluare (1–5 stele) conectat la `createReviewAction`.
 */
interface BookingCardProps {
  booking: BookingWithDetails;
  role: "owner" | "renter";
}

function getStatusBadge(status: BookingStatus) {
  switch (status) {
    case "pending":
      return {
        label: "● ÎN AȘTEPTARE APROBARE",
        className: "bg-ochre-light border-ochre text-ink",
      };
    case "confirmed":
      return {
        label: "● CONFIRMATĂ / ÎN CURS",
        className: "bg-emerald-900/15 border-emerald-800 text-emerald-950",
      };
    case "completed":
      return {
        label: "✓ ÎNCHIRIERE FINALIZATĂ",
        className: "bg-ink text-cream border-ink",
      };
    case "rejected":
      return {
        label: "✕ REFUZATĂ DE OFERTANT",
        className: "bg-red-900/10 border-red-800/50 text-red-950",
      };
    case "cancelled":
      return {
        label: "○ ANULATĂ DE CHIRIAȘ",
        className: "bg-cream-dark border-ink/30 text-ink-muted",
      };
    default:
      return {
        label: String(status).toUpperCase(),
        className: "bg-cream-dark border-ink/30 text-ink",
      };
  }
}

export function BookingCard({ booking, role }: BookingCardProps) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Stări locale pentru formularul de recenzie (activ doar când status === "completed")
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [rating, setRating] = useState<number>(5);
  const [reviewBusy, setReviewBusy] = useState(false);
  const [reviewError, setReviewError] = useState<string | null>(null);
  const [reviewSuccess, setReviewSuccess] = useState<string | null>(null);

  const badge = getStatusBadge(booking.status);
  const bookingCode =
    booking.booking_code || `#REZ-${booking.id.slice(0, 4).toUpperCase()}`;
  const catalogCode = booking.listing?.catalog_code || "#OBJ";

  async function handleTransition(
    nextStatus: "confirmed" | "rejected" | "completed" | "cancelled"
  ) {
    setBusy(true);
    setErrorMsg(null);

    try {
      const res = await updateBookingStatusAction(booking.id, nextStatus);
      if (res && !res.success) {
        setErrorMsg(res.error || "Nu s-a putut actualiza starea rezervării.");
      } else {
        router.refresh();
      }
    } catch {
      setErrorMsg("Eroare la comunicarea cu serverul.");
    } finally {
      setBusy(false);
    }
  }

  async function handleReviewSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setReviewBusy(true);
    setReviewError(null);
    setReviewSuccess(null);

    const formData = new FormData(event.currentTarget);
    formData.set("booking_id", booking.id);
    formData.set("rating", String(rating));

    try {
      const res = await createReviewAction(formData);
      if (res && !res.success) {
        setReviewError(res.error || "Recenzia nu a putut fi salvată.");
      } else {
        setReviewSuccess(
          res?.message || "Recenzia a fost înregistrată în catalog!"
        );
        setShowReviewForm(false);
        router.refresh();
      }
    } catch {
      setReviewError("Eroare la trimiterea recenziei către server.");
    } finally {
      setReviewBusy(false);
    }
  }

  return (
    <article className="catalog-card p-5 space-y-4">
      {/* Antet Fișă Rezervare */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-ink/15 pb-3 font-mono text-xs">
        <div className="flex items-center gap-2">
          <span className="font-bold text-ink bg-cream-dark px-2 py-0.5 border border-ink/20">
            {bookingCode}
          </span>
          <span className="text-ink-muted">PENTRU</span>
          <Link
            href={`/obiect/${booking.listing_id}`}
            className="font-bold text-ochre hover:underline"
          >
            {catalogCode}
          </Link>
        </div>

        <span
          className={`px-2.5 py-0.5 text-[10px] font-bold uppercase border ${badge.className}`}
        >
          {badge.label}
        </span>
      </div>

      {/* Corpul Rezervării: Obiect, Perioadă, Cost și Partener */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
        {/* Titlu Obiect & Perioadă (7/12) */}
        <div className="md:col-span-7 space-y-1.5">
          <Link
            href={`/obiect/${booking.listing_id}`}
            className="font-display text-lg font-bold text-ink hover:text-ochre transition-colors block"
          >
            {booking.listing?.title || "Obiect din Catalogul RentA"}
          </Link>

          <div className="flex flex-wrap items-center gap-3 font-mono text-xs text-ink-muted">
            <span>
              PERIOADĂ:{" "}
              <strong className="text-ink">{booking.start_date}</strong> &rarr;{" "}
              <strong className="text-ink">{booking.end_date}</strong>
            </span>
            <span>&bull;</span>
            <span>
              DURATĂ:{" "}
              <strong className="text-ink">{booking.total_days} zile</strong>
            </span>
          </div>

          <div className="font-mono text-xs text-ink-muted">
            {role === "owner" ? (
              <span>
                CHIRIAȘ SOLICITANT:{" "}
                <strong className="text-ink">
                  {booking.renter?.display_name || "Utilizator RentA"}
                </strong>
                {booking.partner_phone || booking.renter?.phone ? (
                  <span className="text-ochre font-bold">
                    {" "}
                    • Tel: {booking.partner_phone || booking.renter?.phone}
                  </span>
                ) : booking.status === "pending" ? (
                  <span className="text-[11px]">
                    {" "}
                    • (Telefon vizibil după confirmare)
                  </span>
                ) : null}
              </span>
            ) : (
              <span>
                PROPRIETAR / OFERTANT:{" "}
                <strong className="text-ink">
                  {booking.owner?.display_name || "Proprietar RentA"}
                </strong>
                {booking.partner_phone || booking.owner?.phone ? (
                  <span className="text-ochre font-bold">
                    {" "}
                    • Tel: {booking.partner_phone || booking.owner?.phone}
                  </span>
                ) : booking.status === "pending" ? (
                  <span className="text-[11px]">
                    {" "}
                    • (Telefon vizibil după confirmare)
                  </span>
                ) : null}
              </span>
            )}
          </div>

          {booking.notes && (
            <div className="mt-2 p-2.5 bg-cream border border-ink/15 text-xs text-ink-muted font-sans">
              <span className="font-mono text-[10px] uppercase font-bold text-ink block mb-0.5">
                Notă atașată cererii:
              </span>
              &ldquo;{booking.notes}&rdquo;
            </div>
          )}
        </div>

        {/* Deviz Financiar (5/12) */}
        <div className="md:col-span-5 p-3.5 bg-cream border border-ink/20 font-mono text-xs space-y-1">
          <div className="flex items-center justify-between text-ink-muted">
            <span>Total Închiriere:</span>
            <span className="text-sm font-bold text-ink">
              {Number(booking.total_price_ron).toFixed(0)} RON
            </span>
          </div>
          <div className="flex items-center justify-between text-[11px] text-ink-muted">
            <span>Comision platformă (10%):</span>
            <span>{Number(booking.platform_fee_ron).toFixed(1)} RON</span>
          </div>
          <div className="text-[10px] text-ink-muted pt-1 border-t border-ink/10">
            Înregistrată la:{" "}
            {new Date(booking.created_at).toLocaleDateString("ro-RO")}
          </div>
        </div>
      </div>

      {errorMsg && (
        <div className="p-2.5 border border-red-800/40 bg-red-900/10 font-mono text-xs text-red-950">
          [EROARE]: {errorMsg}
        </div>
      )}

      {reviewSuccess && (
        <div className="p-3 border border-emerald-800 bg-emerald-900/10 font-mono text-xs text-emerald-950">
          [RECENZIE PUBLICATĂ]: {reviewSuccess}
        </div>
      )}

      {/* Bară de Acțiuni (State Machine Transitions + Declanșator Recenzie) */}
      <div className="pt-3 border-t border-ink/15 flex flex-wrap items-center justify-between gap-3">
        <Link
          href={`/obiect/${booking.listing_id}`}
          className="font-mono text-xs text-ink-muted hover:text-ink underline underline-offset-4"
        >
          Vezi Fișa Obiectului ({catalogCode}) &rarr;
        </Link>

        <div className="flex flex-wrap items-center gap-2">
          {/* Acțiuni disponibile pentru PROPRIETAR (Ofertant) */}
          {role === "owner" && booking.status === "pending" && (
            <>
              <button
                type="button"
                disabled={busy}
                onClick={() => handleTransition("confirmed")}
                className="catalog-btn-primary py-1.5 px-4 text-xs"
              >
                {busy ? "Se procesează..." : "✓ Acceptă Rezervarea"}
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => handleTransition("rejected")}
                className="px-3 py-1.5 border border-red-800/50 bg-red-900/10 hover:bg-red-800 hover:text-cream-light font-mono text-xs uppercase transition-colors"
              >
                ✕ Refuză
              </button>
            </>
          )}

          {role === "owner" && booking.status === "confirmed" && (
            <button
              type="button"
              disabled={busy}
              onClick={() => handleTransition("completed")}
              className="catalog-btn-primary py-1.5 px-4 text-xs"
            >
              {busy
                ? "Se finalizează..."
                : "Marchează Închirierea ca Finalizată"}
            </button>
          )}

          {/* Acțiuni disponibile pentru CHIRIAȘ (Solicitant) */}
          {role === "renter" && booking.status === "pending" && (
            <button
              type="button"
              disabled={busy}
              onClick={() => handleTransition("cancelled")}
              className="catalog-btn-secondary py-1.5 px-3 text-xs"
            >
              {busy ? "Se anulează..." : "Anulează Cererea"}
            </button>
          )}

          {/* Buton Acordare Recenzie disponibil când închirierea este FINALIZATĂ */}
          {booking.status === "completed" && !reviewSuccess && (
            <button
              type="button"
              onClick={() => setShowReviewForm((prev) => !prev)}
              className="catalog-btn-primary py-1.5 px-4 text-xs"
            >
              {showReviewForm
                ? "Închide Formularul de Recenzie"
                : "★ Lasă o Recenzie pentru această Închiriere"}
            </button>
          )}
        </div>
      </div>

      {/* Formular Expandabil de Recenzie (1–5 Stele) */}
      {booking.status === "completed" && showReviewForm && (
        <form
          onSubmit={handleReviewSubmit}
          className="p-4 border border-ink/25 bg-cream space-y-4 mt-2"
        >
          <div className="flex items-center justify-between border-b border-ink/15 pb-2 font-mono text-xs">
            <span className="font-bold text-ochre uppercase">
              FIȘĂ EVALUARE ÎNCHIRIERE // {bookingCode}
            </span>
            <span className="text-ink-muted">SCOR: 1–5 STELE</span>
          </div>

          {reviewError && (
            <div className="p-2.5 border border-red-800/40 bg-red-900/10 font-mono text-xs text-red-950">
              [EROARE]: {reviewError}
            </div>
          )}

          <input type="hidden" name="booking_id" value={booking.id} />
          <input type="hidden" name="rating" value={rating} />

          {/* Selector Interactiv 1..5 Stele */}
          <div className="space-y-1.5">
            <label className="block font-mono text-xs uppercase text-ink font-semibold">
              1. Calificativ Acordat *
            </label>
            <div className="flex flex-wrap items-center gap-2 font-mono text-xs">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setRating(star)}
                  className={`px-3 py-1.5 border transition-colors ${
                    rating === star
                      ? "bg-ochre text-cream-light border-ink font-bold"
                      : "bg-cream-light text-ink border-ink/30 hover:border-ink"
                  }`}
                >
                  [{star} ★]
                </button>
              ))}
            </div>
          </div>

          {/* Comentariu Recenzie */}
          <div className="space-y-1.5">
            <label
              htmlFor={`comment-${booking.id}`}
              className="block font-mono text-xs uppercase text-ink font-semibold"
            >
              2. Observații Tehnice &amp; Experiență *
            </label>
            <textarea
              id={`comment-${booking.id}`}
              name="comment"
              rows={3}
              required
              minLength={3}
              placeholder="Cum a decurs predarea și care a fost starea obiectului?"
              className="catalog-input text-xs"
            />
          </div>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowReviewForm(false)}
              className="catalog-btn-secondary py-1.5 px-3 text-xs"
            >
              Renunță
            </button>
            <button
              type="submit"
              disabled={reviewBusy}
              className="catalog-btn-primary py-1.5 px-4 text-xs"
            >
              {reviewBusy
                ? "Se înregistrează recenzia..."
                : "Publică Recenzia în Catalog"}
            </button>
          </div>
        </form>
      )}
    </article>
  );
}
