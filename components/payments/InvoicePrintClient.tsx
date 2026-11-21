"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, Download, Printer } from "lucide-react";
import type { EFacturaStatus, InvoiceRecord } from "@/lib/types/database";

interface InvoicePrintClientProps {
  invoice: InvoiceRecord;
  xmlPreview: string;
}

function getEFacturaBadge(status: EFacturaStatus) {
  switch (status) {
    case "accepted":
      return {
        label: "RO e-Factura: Acceptată ANAF",
        className: "bg-emerald-50 text-emerald-700 border-emerald-200",
      };
    case "submitted":
      return {
        label: "RO e-Factura: Transmisă SPV",
        className: "bg-sky-50 text-sky-700 border-sky-200",
      };
    case "pending_anaf":
      return {
        label: "RO e-Factura: Pregătită ANAF",
        className: "bg-ochre-light text-ochre border-ochre/25",
      };
    case "rejected":
      return {
        label: "RO e-Factura: Respinsă",
        className: "bg-rose-50 text-rose-700 border-rose-200",
      };
    default:
      return {
        label: "RO e-Factura: Neaplicabil (PF)",
        className: "bg-slate-100 text-slate-600 border-slate-200",
      };
  }
}

/**
 * Vizualizare & Imprimare Factură Fiscală A4 (`components/payments/InvoicePrintClient.tsx`).
 *
 * Explicație pentru dezvoltatori C / Java:
 * - Componentă Client (`"use client"`) deoarece folosește API-uri ale browserului:
 *   `window.print()` (pentru tipărire sau salvare directă ca PDF A4) și
 *   `Blob` + `URL.createObjectURL` (pentru descărcarea fișierului XML UBL 2.1
 *   compatibil ANAF RO e-Factura).
 * - Clasa Tailwind `print:hidden` ascunde automat bara de acțiuni și panoul de
 *   inspectare XML atunci când utilizatorul tipărește sau salvează documentul PDF.
 */
export function InvoicePrintClient({
  invoice,
  xmlPreview,
}: InvoicePrintClientProps) {
  const [showXml, setShowXml] = useState(false);
  const eFacturaBadge = getEFacturaBadge(invoice.efactura_status);

  const issuedDateFormatted = new Date(invoice.issued_at).toLocaleDateString(
    "ro-RO",
    {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }
  );

  function handlePrintPdf() {
    window.print();
  }

  function handleDownloadXml() {
    const blob = new Blob([xmlPreview], {
      type: "application/xml;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const safeNumber = invoice.invoice_number.replace(/[^a-zA-Z0-9_-]/g, "_");

    const link = document.createElement("a");
    link.href = url;
    link.download = `RO-eFactura-${safeNumber}.xml`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6">
      {/* Bara de acțiuni (ascunsă la imprimare / export PDF) */}
      <div className="print:hidden flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white border border-slate-200/90 rounded-2xl p-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          <Link href="/profil/plati" className="catalog-btn-secondary text-xs">
            &larr; Înapoi la Plăți &amp; Facturi
          </Link>
          <span
            className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold border ${eFacturaBadge.className}`}
          >
            {eFacturaBadge.label}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setShowXml((prev) => !prev)}
            className="catalog-btn-secondary text-xs"
          >
            {showXml ? "Ascunde Preview XML" : "Previzualizează XML UBL"}
          </button>

          <button
            type="button"
            onClick={handleDownloadXml}
            className="catalog-btn-secondary inline-flex items-center gap-1.5 text-xs"
          >
            <Download className="w-3.5 h-3.5 shrink-0" strokeWidth={1.8} aria-hidden="true" />
            <span>Descarcă XML RO e-Factura</span>
          </button>

          <button
            type="button"
            onClick={handlePrintPdf}
            className="catalog-btn-primary inline-flex items-center gap-1.5 text-xs"
          >
            <Printer className="w-3.5 h-3.5 shrink-0" strokeWidth={1.8} aria-hidden="true" />
            <span>Tipărește / Salvează PDF</span>
          </button>
        </div>
      </div>

      {/* Foaie A4 curată pentru Factură Fiscală */}
      <article className="bg-white border border-slate-200/90 rounded-2xl p-6 sm:p-10 shadow-sm print:border-0 print:shadow-none print:rounded-none print:p-0 space-y-8">
        {/* Antet Factură */}
        <header className="flex flex-col sm:flex-row sm:items-start justify-between gap-6 border-b border-slate-200 pb-6">
          <div className="space-y-1.5">
            <div className="font-display text-2xl font-extrabold text-ink tracking-tight">
              Rent<span className="text-ochre">A</span>{" "}
              <span className="text-sm font-mono font-semibold text-ink-muted">
                // FACTURĂ FISCALĂ
              </span>
            </div>
            <div className="text-sm font-bold text-ink">
              {invoice.issuer_name}
            </div>
            <div className="font-mono text-xs text-ink-muted">
              CUI / CIF Emitent: <strong className="text-ink">{invoice.issuer_cui}</strong>
            </div>
            <div className="text-xs text-ink-muted">
              România &bull; Operator Platformă Marketplace RentA
            </div>
          </div>

          <div className="sm:text-right space-y-1.5">
            <div className="inline-flex items-center rounded-lg bg-slate-100 px-3 py-1.5 font-mono text-sm font-extrabold text-ink">
              Seria &amp; Nr.: {invoice.invoice_number}
            </div>
            <div className="text-xs text-ink-muted">
              Data emiterii:{" "}
              <strong className="font-mono text-ink">
                {issuedDateFormatted}
              </strong>
            </div>
            <div className="text-xs text-ink-muted">
              Monedă:{" "}
              <strong className="font-mono text-ink">
                {invoice.currency || "RON"}
              </strong>{" "}
              &bull; Provider:{" "}
              <strong className="font-mono uppercase text-ink">
                {invoice.provider}
              </strong>
            </div>
            <div className="pt-1">
              <span
                className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${eFacturaBadge.className}`}
              >
                {eFacturaBadge.label}
              </span>
            </div>
          </div>
        </header>

        {/* Bloc Furnizor vs Client */}
        <section className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div className="rounded-xl border border-slate-200/80 bg-slate-50/70 p-4 space-y-1.5">
            <div className="font-mono text-[10px] font-bold uppercase tracking-wider text-ink-muted">
              FURNIZOR (EMITENT)
            </div>
            <div className="font-display text-sm font-bold text-ink">
              {invoice.issuer_name}
            </div>
            <div className="text-xs text-ink-muted font-mono">
              CUI: {invoice.issuer_cui}
            </div>
            <div className="text-xs text-ink-muted">
              Sediu Social: București, România
            </div>
          </div>

          <div className="rounded-xl border border-slate-200/80 bg-slate-50/70 p-4 space-y-1.5">
            <div className="font-mono text-[10px] font-bold uppercase tracking-wider text-ink-muted">
              CLIENT (BENEFICIAR)
            </div>
            <div className="font-display text-sm font-bold text-ink">
              {invoice.client_name}
            </div>
            <div className="text-xs text-ink-muted font-mono">
              CUI / CIF:{" "}
              {invoice.client_cui ? invoice.client_cui : "Persoană Fizică (PF)"}
            </div>
            <div className="text-xs text-ink-muted">
              Adresă: {invoice.client_address || "România"}
            </div>
            <div className="text-[11px] font-mono text-ink-muted pt-1">
              Referință Rezervare: #REZ-
              {invoice.booking_id.slice(0, 8).toUpperCase()}
            </div>
          </div>
        </section>

        {/* Tabel linie de comision */}
        <section className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs sm:text-sm">
            <thead>
              <tr className="border-y border-slate-200 bg-slate-50 font-mono text-[11px] uppercase text-ink-muted">
                <th className="py-3 px-3">Nr.</th>
                <th className="py-3 px-3">Denumire produs / serviciu</th>
                <th className="py-3 px-3 text-center">U.M.</th>
                <th className="py-3 px-3 text-right">Cant.</th>
                <th className="py-3 px-3 text-right">Bază impozabilă</th>
                <th className="py-3 px-3 text-right">Cotă TVA</th>
                <th className="py-3 px-3 text-right">Valoare TVA</th>
                <th className="py-3 px-3 text-right">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              <tr>
                <td className="py-4 px-3 font-mono text-ink-muted">1</td>
                <td className="py-4 px-3">
                  <div className="font-semibold text-ink">
                    Comision intermediere platformă RentA (10%)
                  </div>
                  <div className="text-xs text-ink-muted mt-0.5 font-mono">
                    Rezervare #REZ-
                    {invoice.booking_id.slice(0, 8).toUpperCase()}
                  </div>
                </td>
                <td className="py-4 px-3 text-center text-ink-muted">buc</td>
                <td className="py-4 px-3 text-right font-mono">1</td>
                <td className="py-4 px-3 text-right font-mono">
                  {Number(invoice.subtotal_ron).toFixed(2)}{" "}
                  {invoice.currency || "RON"}
                </td>
                <td className="py-4 px-3 text-right font-mono">
                  {Number(invoice.vat_rate).toFixed(0)}%
                </td>
                <td className="py-4 px-3 text-right font-mono">
                  {Number(invoice.vat_amount_ron).toFixed(2)}{" "}
                  {invoice.currency || "RON"}
                </td>
                <td className="py-4 px-3 text-right font-mono font-bold text-ink">
                  {Number(invoice.total_ron).toFixed(2)}{" "}
                  {invoice.currency || "RON"}
                </td>
              </tr>
            </tbody>
          </table>
        </section>

        {/* Sumar Totaluri */}
        <section className="flex justify-end">
          <div className="w-full sm:w-80 rounded-xl border border-slate-200 bg-slate-50/70 p-4 space-y-2 text-sm">
            <div className="flex items-center justify-between text-ink-muted">
              <span>Total fără TVA</span>
              <span className="font-mono font-medium text-ink">
                {Number(invoice.subtotal_ron).toFixed(2)}{" "}
                {invoice.currency || "RON"}
              </span>
            </div>
            <div className="flex items-center justify-between text-ink-muted">
              <span>TVA ({Number(invoice.vat_rate).toFixed(0)}%)</span>
              <span className="font-mono font-medium text-ink">
                {Number(invoice.vat_amount_ron).toFixed(2)}{" "}
                {invoice.currency || "RON"}
              </span>
            </div>
            <div className="border-t border-slate-200 pt-2 flex items-center justify-between font-bold text-base text-ink">
              <span>TOTAL DE PLATĂ</span>
              <span className="font-mono text-ochre">
                {Number(invoice.total_ron).toFixed(2)}{" "}
                {invoice.currency || "RON"}
              </span>
            </div>
            <div className="flex items-start gap-1.5 text-[11px] text-emerald-700 font-medium pt-1">
              <Check className="w-3.5 h-3.5 shrink-0 mt-0.5" strokeWidth={1.8} aria-hidden="true" />
              <span>
                Achitat prin reținere automată din Escrow la finalizarea
                închirierii.
              </span>
            </div>
          </div>
        </section>

        {/* Mențiuni legale România */}
        <footer className="border-t border-slate-200 pt-5 text-[11px] text-ink-muted space-y-1 leading-relaxed">
          <p>
            Document generat electronic prin platforma RentA. Factura este
            valabilă fără semnătură și ștampilă conform art. 319 alin. (29) din
            Legea nr. 227/2015 privind Codul Fiscal.
          </p>
          <p className="font-mono">
            Standard RO e-Factura: UBL 2.1 / CIUS-RO 1.0.1 &bull; ID Intern:{" "}
            {invoice.id}
          </p>
        </footer>
      </article>

      {/* Previzualizare XML UBL 2.1 (ascunsă la imprimare) */}
      {showXml && (
        <section className="print:hidden bg-white border border-slate-200/90 rounded-2xl p-5 shadow-sm space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-display text-sm font-bold text-ink">
              Preview XML UBL 2.1 (ANAF RO e-Factura — CIUS-RO 1.0.1)
            </h2>
            <button
              type="button"
              onClick={handleDownloadXml}
              className="catalog-btn-secondary inline-flex items-center gap-1.5 text-xs"
            >
              <Download className="w-3.5 h-3.5 shrink-0" strokeWidth={1.8} aria-hidden="true" />
              <span>Descarcă .xml</span>
            </button>
          </div>
          <pre className="overflow-x-auto rounded-xl bg-slate-900 text-slate-100 p-4 text-[11px] font-mono leading-relaxed max-h-96">
            <code>{xmlPreview}</code>
          </pre>
        </section>
      )}
    </div>
  );
}
