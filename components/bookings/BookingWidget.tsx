"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckCircle2, Lock } from "lucide-react";
import { createBookingAction } from "@/app/actions/bookings";
import type {
  CancellationPolicy,
  UnavailableDateRange,
} from "@/lib/types/database";

/**
 * Calculatorul și Formularul de Rezervare (`components/bookings/BookingWidget.tsx`).
 *
 * Explicație pentru C/Java:
 * - Verifică în timp real în `useMemo`:
 *   1. Dacă durata selectată respectă durata minimă impusă de proprietar (`minRentalDays`).
 *   2. Dacă intervalul `[startDate, endDate]` se intersectează matematic (`start <= r.end && end >= r.start`)
 *      cu vreun interval deja confirmat din `unavailableRanges`.
 * - Afișează transparent garanția returnabilă (`depositRon`) și politica de anulare.
 */
interface BookingWidgetProps {
  listingId: string;
  catalogCode: string;
  pricePerDay: number;
  pricePerHour: number | null;
  depositRon?: number;
  minRentalDays?: number;
  cancellationPolicy?: CancellationPolicy;
  unavailableRanges?: UnavailableDateRange[];
  isOwner: boolean;
  isLoggedIn: boolean;
  isAvailable: boolean;
}

function getTodayIso(): string {
  const now = new Date();
  return now.toISOString().split("T")[0];
}

function getCancellationLabel(policy: CancellationPolicy): string {
  switch (policy) {
    case "flexible":
      return "Flexibilă (anulare gratuită cu min. 24h înainte)";
    case "strict":
      return "Strictă (anulare gratuită cu min. 7 zile înainte)";
    default:
      return "Moderată (anulare gratuită cu min. 48h înainte)";
  }
}

export function BookingWidget({
  listingId,
  catalogCode,
  pricePerDay,
  pricePerHour,
  depositRon = 0,
  minRentalDays = 1,
  cancellationPolicy = "flexible",
  unavailableRanges = [],
  isOwner,
  isLoggedIn,
  isAvailable,
}: BookingWidgetProps) {
  const router = useRouter();
  const [startDate, setStartDate] = useState<string>(getTodayIso());
  const [endDate, setEndDate] = useState<string>(getTodayIso());
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successInfo, setSuccessInfo] = useState<{
    message: string;
    bookingCode?: string;
  } | null>(null);

  // Calculăm în timp real numărul de zile, costul și verificăm suprapunerile calendaristice
  const calculation = useMemo(() => {
    if (!startDate || !endDate) {
      return {
        valid: false,
        totalDays: 0,
        totalRon: 0,
        feeRon: 0,
        belowMinDays: false,
        overlappingRange: null as UnavailableDateRange | null,
      };
    }

    const start = new Date(`${startDate}T00:00:00Z`);
    const end = new Date(`${endDate}T00:00:00Z`);
    const diffMs = end.getTime() - start.getTime();
    if (diffMs < 0 || Number.isNaN(diffMs)) {
      return {
        valid: false,
        totalDays: 0,
        totalRon: 0,
        feeRon: 0,
        belowMinDays: false,
        overlappingRange: null as UnavailableDateRange | null,
      };
    }

    const totalDays = Math.max(
      1,
      Math.round(diffMs / (1000 * 60 * 60 * 24)) + 1
    );

    const belowMinDays = totalDays < minRentalDays;

    // Verificăm intersecția cu oricare dintre intervalele deja confirmate
    // Două intervale [A, B] și [C, D] în format YYYY-MM-DD se intersectează dacă A <= D && B >= C
    const overlappingRange =
      unavailableRanges.find(
        (r) => startDate <= r.end_date && endDate >= r.start_date
      ) ?? null;

    const totalRon = Math.round(totalDays * pricePerDay * 100) / 100;
    const feeRon = Math.round(totalRon * 0.1 * 100) / 100;

    return {
      valid: !belowMinDays && !overlappingRange,
      totalDays,
      totalRon,
      feeRon,
      belowMinDays,
      overlappingRange,
    };
  }, [startDate, endDate, pricePerDay, minRentalDays, unavailableRanges]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (calculation.belowMinDays) {
      setErrorMsg(
        `Durata minimă de închiriere pentru acest obiect este de ${minRentalDays} zile.`
      );
      return;
    }
    if (calculation.overlappingRange) {
      setErrorMsg(
        `Perioada selectată se suprapune cu o rezervare confirmată (${calculation.overlappingRange.start_date} → ${calculation.overlappingRange.end_date}).`
      );
      return;
    }
    if (!calculation.valid) {
      setErrorMsg(
        "Data de returnare trebuie să fie după sau egală cu data de preluare."
      );
      return;
    }

    setLoading(true);
    setErrorMsg(null);
    setSuccessInfo(null);

    const formData = new FormData(event.currentTarget);
    formData.set("listing_id", listingId);
    formData.set("start_date", startDate);
    formData.set("end_date", endDate);

    try {
      const result = await createBookingAction(formData);
      if (result && !result.success) {
        setErrorMsg(result.error || "Nu s-a putut înregistra rezervarea.");
      } else {
        const code =
          result?.data &&
          typeof result.data === "object" &&
          "booking_code" in result.data
            ? String(result.data.booking_code)
            : undefined;

        setSuccessInfo({
          message:
            result?.message ||
            "Cererea de rezervare a fost înregistrată și trimisă proprietarului!",
          bookingCode: code,
        });
        router.refresh();
      }
    } catch {
      setErrorMsg("Eroare de comunicare la trimiterea cererii de rezervare.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <aside className="bg-white border border-slate-200/90 rounded-2xl shadow-sm overflow-hidden p-6 space-y-5 sticky top-24">
      {/* Antet Tarifar */}
      <div className="border-b border-slate-100 pb-4 flex items-baseline justify-between gap-2">
        <div>
          <div className="inline-block font-mono text-[11px] uppercase px-2.5 py-0.5 rounded-full bg-ochre-light text-ochre font-semibold">
            REZERVARE &bull; {catalogCode}
          </div>
          <div className="font-display text-2xl sm:text-3xl font-extrabold text-ink mt-2">
            {Number(pricePerDay).toFixed(0)} RON
            <span className="text-xs font-normal text-ink-muted"> / zi</span>
          </div>
        </div>

        {pricePerHour && (
          <div className="font-mono text-xs text-ink font-semibold border border-slate-200 bg-slate-50 px-3 py-1.5 rounded-lg">
            {Number(pricePerHour).toFixed(0)} RON / oră
          </div>
        )}
      </div>

      {/* Calendar Zile Ocupate (Intervale Confirmate) */}
      {unavailableRanges.length > 0 && (
        <div className="p-3.5 rounded-xl border border-slate-200/90 bg-slate-50 space-y-2 text-xs">
          <div className="text-[11px] font-semibold uppercase text-ink">
            Perioade deja rezervate (Indisponibile):
          </div>
          <ul className="space-y-1.5 text-[11px] font-mono text-ink-muted">
            {unavailableRanges.slice(0, 5).map((r, idx) => (
              <li
                key={`${r.start_date}-${r.end_date}-${idx}`}
                className="flex items-center justify-between bg-white px-2.5 py-1.5 rounded-lg border border-slate-200/80"
              >
                <span>
                  {r.start_date} &rarr; {r.end_date}
                </span>
                <span className="text-amber-600 font-semibold">Ocupat</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Mesaj dacă obiectul este indisponibil */}
      {!isAvailable && (
        <div className="p-3.5 rounded-xl border border-amber-200 bg-amber-50 text-xs text-amber-900 font-medium">
          Acest obiect este marcat ca indisponibil temporar de către proprietar.
        </div>
      )}

      {/* Mesaj dacă privitorul este chiar proprietarul obiectului */}
      {isOwner ? (
        <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-3">
          <div className="text-xs font-bold text-ochre uppercase">
            Obiect propriu în inventar
          </div>
          <p className="text-xs text-ink-muted leading-relaxed">
            Acesta este propriul tău anunț publicat în catalog. Îl poți edita
            sau poți verifica cererile primite de la chiriași.
          </p>
          <div className="flex flex-col gap-2 pt-1">
            <Link
              href={`/listarile-mele/${listingId}/editeaza`}
              className="w-full bg-ochre hover:bg-ochre-hover text-white font-semibold py-2.5 px-4 rounded-xl shadow-sm transition-all text-center text-xs"
            >
              Editează Fișa Obiectului
            </Link>
            <Link
              href="/rezervarile-mele"
              className="w-full bg-white hover:bg-slate-100 text-ink border border-slate-200 font-semibold py-2.5 px-4 rounded-xl transition-all text-center text-xs"
            >
              Vezi Cererile de Rezervare Primite
            </Link>
          </div>
        </div>
      ) : successInfo ? (
        /* Confirmare după trimiterea cererii */
        <div className="p-4 rounded-xl border border-emerald-200 bg-emerald-50/80 space-y-3 text-xs text-emerald-950">
          <div className="inline-flex items-center gap-1.5 font-bold uppercase text-emerald-800">
            <CheckCircle2 className="w-4 h-4 shrink-0" strokeWidth={1.8} aria-hidden="true" />
            <span>
              Cerere înregistrată{" "}
              {successInfo.bookingCode ? `(${successInfo.bookingCode})` : ""}
            </span>
          </div>
          <p className="font-sans text-xs leading-relaxed">
            {successInfo.message}
          </p>
          <div className="pt-1 flex flex-col gap-2">
            <Link
              href="/rezervarile-mele"
              className="w-full bg-ochre hover:bg-ochre-hover text-white font-semibold py-2.5 px-4 rounded-xl shadow-sm transition-all text-center"
            >
              Vezi Statusul în Rezervările Mele &rarr;
            </Link>
            <button
              type="button"
              onClick={() => setSuccessInfo(null)}
              className="w-full bg-white hover:bg-slate-100 text-ink border border-slate-200 font-semibold py-2 px-4 rounded-xl transition-all"
            >
              Trimite altă cerere
            </button>
          </div>
        </div>
      ) : (
        /* Formularul de calcul și trimitere cerere */
        <form onSubmit={handleSubmit} className="space-y-4">
          {errorMsg && (
            <div className="p-3 rounded-xl border border-red-200 bg-red-50 text-xs text-red-800 font-medium">
              {errorMsg}
            </div>
          )}

          {calculation.overlappingRange && (
            <div className="p-3 rounded-xl border border-red-200 bg-red-50 text-xs text-red-800">
              Zilele selectate se suprapun cu rezervarea confirmată{" "}
              <strong>
                {calculation.overlappingRange.start_date} &rarr;{" "}
                {calculation.overlappingRange.end_date}
              </strong>
              . Alege alte date.
            </div>
          )}

          {calculation.belowMinDays && (
            <div className="p-3 rounded-xl border border-amber-200 bg-amber-50 text-xs text-amber-900">
              Proprietarul solicită minimum{" "}
              <strong>{minRentalDays} zile</strong> de închiriere (ai selectat{" "}
              {calculation.totalDays} zile).
            </div>
          )}

          {/* Selector Perioadă: Data Preluare & Data Returnare */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label
                htmlFor="start_date"
                className="block text-xs text-ink font-semibold"
              >
                Data Preluării *
              </label>
              <input
                id="start_date"
                name="start_date"
                type="date"
                required
                min={getTodayIso()}
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs font-mono text-ink focus:outline-none focus:border-ochre focus:ring-2 focus:ring-ochre/15 transition-all"
              />
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="end_date"
                className="block text-xs text-ink font-semibold"
              >
                Data Returnării *
              </label>
              <input
                id="end_date"
                name="end_date"
                type="date"
                required
                min={startDate || getTodayIso()}
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs font-mono text-ink focus:outline-none focus:border-ochre focus:ring-2 focus:ring-ochre/15 transition-all"
              />
            </div>
          </div>

          {/* Devizul Calculat în Timp Real */}
          <div className="p-4 rounded-xl border border-slate-200/90 bg-slate-50/80 space-y-2 text-xs">
            <div className="flex items-center justify-between text-ink-muted">
              <span>
                Închiriere ({calculation.totalDays} zile &times;{" "}
                {Number(pricePerDay).toFixed(0)} RON)
              </span>
              <span className="text-ink font-semibold font-mono">
                {calculation.totalDays > 0 ? `${calculation.totalRon} RON` : "—"}
              </span>
            </div>

            <div className="flex items-center justify-between text-[11px] text-ink-muted">
              <span>Comision platformă inclus (10%):</span>
              <span className="font-mono">
                {calculation.totalDays > 0 ? `${calculation.feeRon} RON` : "—"}
              </span>
            </div>

            {depositRon > 0 && (
              <div className="flex items-center justify-between text-[11px] text-ink">
                <span>Garanție returnabilă la predare:</span>
                <span className="font-bold font-mono">
                  {Number(depositRon).toFixed(0)} RON
                </span>
              </div>
            )}

            <div className="pt-2.5 border-t border-slate-200 flex items-center justify-between text-sm font-bold text-ink">
              <span>Total închiriere:</span>
              <span className="text-ochre font-mono text-base">
                {calculation.totalDays > 0
                  ? `${calculation.totalRon} RON`
                  : "Dată invalidă"}
              </span>
            </div>
          </div>

          {/* Condiții de anulare și durată minimă */}
          <div className="text-[11px] text-ink-muted space-y-1">
            <div>
              &bull; Durată minimă: <strong className="text-ink">{minRentalDays} zile</strong>
            </div>
            <div>
              &bull; Politică anulare:{" "}
              <strong className="text-ink">{getCancellationLabel(cancellationPolicy)}</strong>
            </div>
          </div>

          {/* Mesaj / Detalii predare către proprietar */}
          <div className="space-y-1.5">
            <label
              htmlFor="notes"
              className="block text-xs text-ink font-semibold"
            >
              Notă către Proprietar (Opțional)
            </label>
            <textarea
              id="notes"
              name="notes"
              rows={2}
              placeholder="Ex: Salut! Pot ridica obiectul dimineața la ora 09:30?"
              className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs text-ink placeholder:text-ink-muted focus:outline-none focus:border-ochre focus:ring-2 focus:ring-ochre/15 transition-all"
            />
          </div>

          {/* Buton Submit sau Redirect către Login */}
          {isLoggedIn ? (
            <button
              type="submit"
              disabled={loading || !isAvailable || !calculation.valid}
              className="w-full bg-ochre hover:bg-ochre-hover disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-3 px-5 rounded-xl shadow-sm transition-all text-sm"
            >
              {loading
                ? "Se înregistrează cererea..."
                : "Trimite Cerere de Rezervare"}
            </button>
          ) : (
            <Link
              href="/login"
              className="block w-full bg-ochre hover:bg-ochre-hover text-white font-semibold py-3 px-5 rounded-xl shadow-sm transition-all text-center text-sm"
            >
              Autentifică-te pentru a Rezerva &rarr;
            </Link>
          )}
        </form>
      )}

      {/* Caseta Arhitecturală: Plată & Garanție Escrow */}
      <div className="p-3.5 rounded-xl border border-slate-200/80 bg-slate-50/70 space-y-1">
        <div className="text-[11px] font-semibold text-ink flex items-center gap-1.5">
          <Lock className="w-3.5 h-3.5 text-ochre shrink-0" strokeWidth={1.8} aria-hidden="true" />
          <span>Rezervare Securizată &amp; Protecție GDPR</span>
        </div>
        <p className="text-[11px] text-ink-muted leading-relaxed">
          Datele de contact telefonic ale proprietarului sunt dezvăluite automat
          în panoul <strong>Rezervările Mele</strong> imediat ce cererea este
          confirmată.
        </p>
      </div>
    </aside>
  );
}
