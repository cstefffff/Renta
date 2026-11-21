"use client";

import { useState } from "react";
import Link from "next/link";
import {
  anonymizeMyAccountAction,
  exportMyGdprDataAction,
} from "@/app/actions/legal";

/**
 * Panou Controale GDPR & Confidențialitate (`components/profile/GdprPrivacyPanel.tsx`).
 *
 * Explicație pentru dezvoltatori C / Java:
 * - Componentă Client (`"use client"`) cu stare locală (`useState`) pentru
 *   acțiunile GDPR ale utilizatorului autentificat:
 *   1. Art. 20 GDPR — Portabilitatea datelor: descarcă o arhivă JSON completă
 *      folosind `Blob` și `URL.createObjectURL` direct în browser.
 *   2. Art. 17 GDPR — Dreptul la ștergere / anonimizare: cere confirmare explicită
 *      prin tastarea frazei `STERGE CONTUL` înainte de apelul ireversibil către server.
 */
export function GdprPrivacyPanel() {
  // Stare pentru export JSON (Art. 20)
  const [exportBusy, setExportBusy] = useState(false);
  const [exportMsg, setExportMsg] = useState<string | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);

  // Stare pentru anonimizare cont (Art. 17)
  const [showDeleteZone, setShowDeleteZone] = useState(false);
  const [confirmationText, setConfirmationText] = useState("");
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  async function handleExportData() {
    setExportBusy(true);
    setExportMsg(null);
    setExportError(null);

    try {
      const res = await exportMyGdprDataAction();
      if (!res.success || !res.data) {
        setExportError(
          res.error || "Nu am putut genera arhiva datelor tale personale."
        );
        return;
      }

      const jsonContent = JSON.stringify(res.data, null, 2);
      const blob = new Blob([jsonContent], {
        type: "application/json;charset=utf-8",
      });
      const url = URL.createObjectURL(blob);
      const today = new Date().toISOString().slice(0, 10);

      const link = document.createElement("a");
      link.href = url;
      link.download = `renta-gdpr-export-${today}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      setExportMsg(
        "Arhiva JSON cu datele tale personale a fost generată și descărcată."
      );
    } catch {
      setExportError(
        "Eroare la comunicarea cu serverul în timpul exportului GDPR."
      );
    } finally {
      setExportBusy(false);
    }
  }

  async function handleAnonymizeAccount(
    event: React.FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();
    setDeleteError(null);

    if (confirmationText.trim() !== "STERGE CONTUL") {
      setDeleteError(
        'Pentru a confirma acțiunea ireversibilă, tastează exact "STERGE CONTUL".'
      );
      return;
    }

    setDeleteBusy(true);

    try {
      const res = await anonymizeMyAccountAction(confirmationText.trim());
      if (!res.success) {
        setDeleteError(
          res.error ||
            "Nu am putut anonimiza contul. Verifică să nu ai rezervări active."
        );
        return;
      }

      // Redirect complet la prima pagină după închiderea și delogarea contului
      window.location.href = "/";
    } catch {
      setDeleteError(
        "Eroare de rețea în timpul anonimizării contului. Încearcă din nou."
      );
    } finally {
      setDeleteBusy(false);
    }
  }

  return (
    <section
      id="gdpr-privacy"
      className="bg-white border border-slate-200/90 rounded-2xl p-6 sm:p-8 shadow-sm space-y-6"
    >
      {/* Antet */}
      <div className="border-b border-slate-100 pb-4 flex flex-wrap items-center justify-between gap-2">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center rounded-full bg-ochre-light px-2.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider text-ochre">
              GDPR // ART. 17 &amp; ART. 20
            </span>
          </div>
          <h2 className="font-display text-lg font-bold text-ink">
            Confidențialitate &amp; Controlul Datelor Tale (GDPR)
          </h2>
          <p className="text-xs text-ink-muted">
            Îți poți descărca oricând datele într-un format portabil JSON sau
            poți solicita anonimizarea definitivă a contului.{" "}
            <Link
              href="/confidentialitate"
              className="text-ochre font-semibold hover:underline"
            >
              Citește Politica de Confidențialitate &rarr;
            </Link>
          </p>
        </div>
      </div>

      {/* 1. Export Date Personale (Art. 20 GDPR) */}
      <div className="rounded-xl border border-slate-200/90 bg-slate-50/70 p-5 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <h3 className="font-display text-sm font-bold text-ink">
              Export Date Personale (Art. 20 GDPR — Dreptul la Portabilitate)
            </h3>
            <p className="text-xs text-ink-muted leading-relaxed">
              Include profilul public, datele private protejate, listările tale,
              rezervările, plățile, facturile fiscale și notificările într-un
              singur fișier <code className="font-mono">.json</code>.
            </p>
          </div>

          <button
            type="button"
            onClick={handleExportData}
            disabled={exportBusy}
            className="catalog-btn-primary shrink-0 whitespace-nowrap"
          >
            {exportBusy
              ? "Se generează arhiva JSON..."
              : "📥 Descarcă arhiva datelor mele (JSON)"}
          </button>
        </div>

        {exportMsg && (
          <div
            role="status"
            className="rounded-lg border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-xs font-medium text-emerald-800"
          >
            {exportMsg}
          </div>
        )}

        {exportError && (
          <div
            role="alert"
            className="rounded-lg border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs font-medium text-rose-800"
          >
            {exportError}
          </div>
        )}
      </div>

      {/* 2. Ștergere / Anonimizare Cont (Art. 17 GDPR) */}
      <div className="rounded-xl border border-rose-200/90 bg-rose-50/40 p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <h3 className="font-display text-sm font-bold text-rose-900">
              Ștergere / Anonimizare Cont (Art. 17 GDPR — Dreptul de a fi uitat)
            </h3>
            <p className="text-xs text-rose-900/80 leading-relaxed">
              Acțiune ireversibilă: datele tale personale (nume, telefon, CUI,
              avatar, bio) vor fi anonimizate, listările active vor fi
              dezactivate, iar sesiunea curentă va fi închisă.
            </p>
          </div>

          <button
            type="button"
            onClick={() => {
              setShowDeleteZone((prev) => !prev);
              setDeleteError(null);
            }}
            className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-rose-300 bg-white px-4 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-50 transition-colors shrink-0 whitespace-nowrap"
          >
            {showDeleteZone
              ? "Anulează"
              : "Solicită anonimizarea contului"}
          </button>
        </div>

        {showDeleteZone && (
          <form
            onSubmit={handleAnonymizeAccount}
            className="rounded-xl border border-rose-200 bg-white p-4 space-y-3"
          >
            <p className="text-xs text-ink-muted leading-relaxed">
              Pentru a confirma că înțelegi consecințele ireversibile ale
              anonimizării contului, tastează exact{" "}
              <strong className="font-mono text-rose-700">STERGE CONTUL</strong>{" "}
              în câmpul de mai jos:
            </p>

            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              <input
                type="text"
                value={confirmationText}
                onChange={(e) => setConfirmationText(e.target.value)}
                placeholder="STERGE CONTUL"
                disabled={deleteBusy}
                aria-label="Confirmare anonimizare cont"
                className="catalog-input max-w-xs font-mono"
              />

              <button
                type="submit"
                disabled={
                  deleteBusy || confirmationText.trim() !== "STERGE CONTUL"
                }
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-rose-600 px-4 py-2 text-xs font-semibold text-white hover:bg-rose-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
              >
                {deleteBusy
                  ? "Se anonimizează contul..."
                  : "Anonimizează și închide contul"}
              </button>
            </div>

            {deleteError && (
              <div
                role="alert"
                className="rounded-lg border border-rose-200 bg-rose-50 px-3.5 py-2 text-xs font-medium text-rose-800"
              >
                {deleteError}
              </div>
            )}
          </form>
        )}
      </div>
    </section>
  );
}
