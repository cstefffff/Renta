"use client";

import { useState, useTransition } from "react";
import { Flag } from "lucide-react";
import { reportListingAction } from "@/app/actions/admin";

/**
 * Buton discret și formular inline de raportare a unui anunț (`components/listings/ReportListingButton.tsx`).
 *
 * Explicație pentru C/Java:
 * - Este un Client Component (`"use client"`) deoarece menține starea locală
 *   a formularului (`open`, `reason`, `details`, `feedback`) cu `useState` și
 *   apelează Server Action-ul `reportListingAction` prin `useTransition`
 *   (echivalentul unei cereri asincrone care blochează doar butonul de trimitere).
 */
interface ReportListingButtonProps {
  listingId: string;
  isLoggedIn: boolean;
  isOwner: boolean;
}

const REPORT_REASONS = [
  "Informații false sau înșelătoare",
  "Obiect interzis / periculos",
  "Preț sau garanție suspectă",
  "Spam sau anunț duplicat",
  "Comportament neadecvat / Fraudă",
  "Alt motiv",
] as const;

export function ReportListingButton({
  listingId,
  isLoggedIn,
  isOwner,
}: ReportListingButtonProps) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<string>(REPORT_REASONS[0]);
  const [details, setDetails] = useState("");
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const [isPending, startTransition] = useTransition();

  // Proprietarul nu are nevoie să își raporteze propriul anunț
  if (isOwner) {
    return null;
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);

    if (!isLoggedIn) {
      setFeedback({
        type: "error",
        text: "Autentifică-te în cont pentru a putea raporta un anunț.",
      });
      return;
    }

    startTransition(async () => {
      try {
        const res = await reportListingAction(
          listingId,
          reason,
          details.trim() || undefined
        );
        if (res.success || res.ok) {
          setFeedback({
            type: "success",
            text:
              res.message ||
              "Raportul a fost înregistrat și trimis echipei de moderare.",
          });
          setDetails("");
          setOpen(false);
        } else {
          setFeedback({
            type: "error",
            text:
              res.error ||
              res.message ||
              "Nu am putut înregistra raportul. Încearcă din nou.",
          });
        }
      } catch {
        setFeedback({
          type: "error",
          text: "A apărut o eroare neașteptată la trimiterea raportului.",
        });
      }
    });
  };

  return (
    <div className="pt-1">
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => {
            setOpen((prev) => !prev);
            setFeedback(null);
          }}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-ink-muted hover:text-rose-600 transition-colors"
        >
          <Flag
            className="w-3.5 h-3.5 shrink-0"
            strokeWidth={1.8}
            aria-hidden="true"
          />
          <span>{open ? "Anulează raportarea" : "Raportează anunț"}</span>
        </button>

        {feedback && !open && (
          <span
            className={`text-xs font-medium ${
              feedback.type === "success" ? "text-emerald-700" : "text-rose-600"
            }`}
          >
            {feedback.text}
          </span>
        )}
      </div>

      {open && (
        <form
          onSubmit={handleSubmit}
          className="mt-3 p-4 rounded-xl border border-slate-200 bg-slate-50/80 space-y-3"
        >
          <div className="flex items-center justify-between gap-2">
            <h3 className="font-display text-xs font-bold uppercase tracking-wider text-ink">
              Semnalează o problemă cu acest anunț
            </h3>
            <span className="font-mono text-[11px] text-ink-muted">
              MODERARE
            </span>
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor={`report-reason-${listingId}`}
              className="block text-xs font-medium text-ink"
            >
              Motivul raportării
            </label>
            <select
              id={`report-reason-${listingId}`}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              disabled={isPending}
              className="catalog-input text-xs py-2"
            >
              {REPORT_REASONS.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor={`report-details-${listingId}`}
              className="block text-xs font-medium text-ink"
            >
              Detalii suplimentare (opțional)
            </label>
            <textarea
              id={`report-details-${listingId}`}
              rows={2}
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              disabled={isPending}
              maxLength={500}
              placeholder="Descrie pe scurt ce pare în neregulă..."
              className="catalog-input text-xs py-2 resize-none"
            />
          </div>

          {feedback && (
            <p
              className={`text-xs font-medium ${
                feedback.type === "success"
                  ? "text-emerald-700"
                  : "text-rose-600"
              }`}
            >
              {feedback.text}
            </p>
          )}

          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setOpen(false)}
              disabled={isPending}
              className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-medium text-ink hover:bg-slate-50 transition-colors"
            >
              Renunță
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="px-3.5 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold transition-colors disabled:opacity-50"
            >
              {isPending ? "Se trimite..." : "Trimite raportul"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
