"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, Check, CheckCircle2, Circle } from "lucide-react";
import { startPayoutOnboardingAction } from "@/app/actions/payments";
import type {
  DepositStatus,
  EFacturaStatus,
  InvoiceRecord,
  PaymentMode,
  PaymentRecord,
  PaymentStatus,
  PayoutAccount,
  PayoutOnboardingStatus,
} from "@/lib/types/database";

/**
 * Panou Interactiv de Onboarding Plăți & Registru Escrow (`components/payments/PayoutOnboardingPanel.tsx`).
 *
 * Explicație pentru dezvoltatori C / Java:
 * - Aceasta este o componentă Client (`"use client"`), echivalentul unui Controller UI
 *   cu stare locală (`useState`) care primește datele inițiale de la Server Component
 *   (`app/(dashboard)/profil/plati/page.tsx`) prin `props` (ca parametrii unui constructor).
 * - Când utilizatorul apasă pe butonul de activare cont, invocăm Server Action-ul
 *   `startPayoutOnboardingAction` (un RPC sigur către server) fără a expune chei secrete
 *   în browser.
 */
interface PayoutOnboardingPanelProps {
  mode: PaymentMode;
  initialAccount: PayoutAccount | null;
  payments: PaymentRecord[];
  invoices?: InvoiceRecord[];
  invoicesMigrationMissing?: boolean;
  migrationMissing?: boolean;
  currentUserId: string;
}

function getOnboardingBadge(status: PayoutOnboardingStatus | null) {
  switch (status) {
    case "active":
      return {
        label: "Cont Activ & Verificat",
        className: "bg-emerald-50 text-emerald-700 border-emerald-200",
        dotClass: "bg-emerald-500",
      };
    case "pending":
      return {
        label: "Verificare KYC în curs",
        className: "bg-amber-50 text-amber-800 border-amber-200",
        dotClass: "bg-amber-500",
      };
    case "restricted":
      return {
        label: "Cont Restricționat",
        className: "bg-rose-50 text-rose-700 border-rose-200",
        dotClass: "bg-rose-500",
      };
    default:
      return {
        label: "Neconfigurat",
        className: "bg-slate-100 text-slate-700 border-slate-200",
        dotClass: "bg-slate-400",
      };
  }
}

function getPaymentStatusBadge(status: PaymentStatus) {
  switch (status) {
    case "released":
      return {
        label: "Fonduri eliberate",
        className: "bg-emerald-50 text-emerald-700 border-emerald-200",
      };
    case "paid":
      return {
        label: "Plătită · În Escrow",
        className: "bg-ochre-light text-ochre border-ochre/25",
      };
    case "authorized":
      return {
        label: "Autorizată",
        className: "bg-sky-50 text-sky-700 border-sky-200",
      };
    case "refunded":
      return {
        label: "Rambursată",
        className: "bg-slate-100 text-slate-600 border-slate-200",
      };
    case "disputed":
      return {
        label: "În dispută",
        className: "bg-rose-50 text-rose-700 border-rose-200",
      };
    default:
      return {
        label: "Neplătită",
        className: "bg-amber-50 text-amber-800 border-amber-200",
      };
  }
}

function getDepositStatusBadge(status: DepositStatus) {
  switch (status) {
    case "held":
      return {
        label: "Garanție blocată în Escrow",
        className: "bg-amber-50 text-amber-800 border-amber-200",
      };
    case "released":
      return {
        label: "Garanție returnată chiriașului",
        className: "bg-emerald-50 text-emerald-700 border-emerald-200",
      };
    case "captured":
      return {
        label: "Garanție reținută",
        className: "bg-rose-50 text-rose-700 border-rose-200",
      };
    default:
      return {
        label: "Fără garanție",
        className: "bg-slate-50 text-slate-500 border-slate-200",
      };
  }
}

function getEFacturaBadge(status: EFacturaStatus) {
  switch (status) {
    case "accepted":
      return {
        label: "e-Factura Acceptată",
        className: "bg-emerald-50 text-emerald-700 border-emerald-200",
      };
    case "submitted":
      return {
        label: "e-Factura Transmisă",
        className: "bg-sky-50 text-sky-700 border-sky-200",
      };
    case "pending_anaf":
      return {
        label: "Pregătită ANAF",
        className: "bg-ochre-light text-ochre border-ochre/25",
      };
    case "rejected":
      return {
        label: "e-Factura Respinsă",
        className: "bg-rose-50 text-rose-700 border-rose-200",
      };
    default:
      return {
        label: "PF / Standard",
        className: "bg-slate-100 text-slate-600 border-slate-200",
      };
  }
}

export function PayoutOnboardingPanel({
  mode,
  initialAccount,
  payments,
  invoices = [],
  invoicesMigrationMissing = false,
  migrationMissing = false,
  currentUserId,
}: PayoutOnboardingPanelProps) {
  const router = useRouter();
  const [account, setAccount] = useState<PayoutAccount | null>(initialAccount);
  const [ibanLast4, setIbanLast4] = useState<string>(
    initialAccount?.iban_last4 ?? ""
  );
  const [busy, setBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const isAccountActive = account?.onboarding_status === "active";
  const statusBadge = getOnboardingBadge(account?.onboarding_status ?? null);

  // Calculăm indicatorii financiari (KPI) din lista plăților utilizatorului
  const totalEarnedAsOwner = payments
    .filter(
      (p) => p.owner_id === currentUserId && p.payment_status === "released"
    )
    .reduce((sum, p) => sum + Number(p.owner_payout_ron || 0), 0);

  const totalHeldInEscrow = payments
    .filter(
      (p) => p.payment_status === "paid" || p.payment_status === "authorized"
    )
    .reduce((sum, p) => sum + Number(p.total_charged_ron || 0), 0);

  const totalPlatformFees = payments
    .filter(
      (p) =>
        p.payment_status === "paid" ||
        p.payment_status === "released" ||
        p.payment_status === "authorized"
    )
    .reduce((sum, p) => sum + Number(p.platform_fee_ron || 0), 0);

  async function handleStartOnboarding(
    event?: React.FormEvent<HTMLFormElement>
  ) {
    if (event) event.preventDefault();
    setBusy(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    const sanitizedIban = ibanLast4.replace(/\D/g, "").slice(0, 4);

    try {
      const res = await startPayoutOnboardingAction(
        mode === "sandbox" && sanitizedIban.length > 0
          ? sanitizedIban
          : undefined
      );

      if (!res.success) {
        setErrorMsg(
          res.error || "Nu s-a putut iniția configurarea contului de încasări."
        );
        return;
      }

      if (res.data?.onboardingUrl) {
        window.location.href = res.data.onboardingUrl;
        return;
      }

      if (res.data?.account) {
        setAccount(res.data.account);
      }

      setSuccessMsg(
        res.message ||
          "Contul tău de încasări a fost activat cu succes în modul Sandbox Escrow!"
      );
      router.refresh();
    } catch {
      setErrorMsg("Eroare la comunicarea cu serverul. Încearcă din nou.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Banner Migrație Lipsă (dacă tabelul SQL 004 nu a fost rulat încă) */}
      {migrationMissing && (
        <div className="bg-amber-50 border border-amber-300/90 rounded-2xl p-5 shadow-sm space-y-3">
          <div className="flex items-start gap-3">
            <span
              className="w-8 h-8 rounded-lg bg-amber-100 text-amber-800 flex items-center justify-center shrink-0"
              aria-hidden="true"
            >
              <AlertTriangle className="w-4 h-4" strokeWidth={1.8} aria-hidden="true" />
            </span>
            <div className="space-y-2 text-sm text-amber-950">
              <h2 className="font-display font-bold text-base">
                Migrația SQL pentru Plăți &amp; Escrow nu a fost rulată încă
              </h2>
              <p className="text-amber-900/90 leading-relaxed">
                Pentru a activa tabelele{" "}
                <code className="font-mono text-xs bg-amber-100 px-1.5 py-0.5 rounded">
                  public.payout_accounts
                </code>{" "}
                și{" "}
                <code className="font-mono text-xs bg-amber-100 px-1.5 py-0.5 rounded">
                  public.payments
                </code>
                , rulează migrația 004 în Supabase SQL Editor (durează 10
                secunde):
              </p>
              <ol className="list-decimal list-inside space-y-1 text-xs text-amber-950 font-medium">
                <li>
                  Deschide <strong>Supabase Dashboard &rarr; SQL Editor</strong>{" "}
                  și apasă <strong>New Query</strong>.
                </li>
                <li>
                  Copiază (Ctrl+C / Ctrl+V) tot conținutul fișierului{" "}
                  <code className="font-mono bg-amber-100 px-1.5 py-0.5 rounded">
                    supabase/migrations/004_payments_and_escrow.sql
                  </code>
                  .
                </li>
                <li>
                  Apasă <strong>Run</strong>, apoi reîncarcă această pagină.
                </li>
              </ol>
            </div>
          </div>
        </div>
      )}

      {/* Banner Mod Activ (Stripe Test Mode vs Sandbox Gratuit) */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-4 sm:p-5 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2.5">
          {mode === "stripe" ? (
            <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-mono font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              STRIPE CONNECT TEST MODE ACTIV
            </span>
          ) : (
            <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-mono font-bold bg-ochre-light text-ochre border border-ochre/25">
              <span className="w-2 h-2 rounded-full bg-ochre" />
              MOD SANDBOX ESCROW GRATUIT (Fără chei Stripe necesare — 0 RON
              costuri)
            </span>
          )}
        </div>
        <p className="text-xs text-ink-muted">
          {mode === "stripe"
            ? "Conectat la API-ul Stripe Express cu split automat 90% ofertant / 10% platformă."
            : "Simulare completă End-to-End în PostgreSQL: KYC instant, Escrow și eliberare garanție."}
        </p>
      </div>

      {/* Card 1: Status Cont Încasări (KYC & Payouts) */}
      <section className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-sm space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
          <div className="space-y-1">
            <h2 className="font-display text-lg font-bold text-ink">
              Cont Încasări &amp; Verificare KYC (Payouts)
            </h2>
            <p className="text-xs text-ink-muted">
              Primești 90% din valoarea fiecărei închirieri finalizate direct în
              contul tău bancar.
            </p>
          </div>
          <span
            className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold border self-start sm:self-center ${statusBadge.className}`}
          >
            <span className={`w-2 h-2 rounded-full ${statusBadge.dotClass}`} />
            {statusBadge.label}
          </span>
        </div>

        {/* Detalii tehnice cont + 3 mini-badge-uri capabilități */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="rounded-xl bg-slate-50 border border-slate-200/80 p-4 space-y-2">
            <div className="text-[11px] font-mono uppercase tracking-wider text-ink-muted">
              Identificator Cont Connect
            </div>
            <div className="font-mono text-sm font-bold text-ink">
              {account?.stripe_account_id || "Neasignat încă"}
            </div>
            <div className="text-xs text-ink-muted flex flex-wrap items-center gap-x-4 gap-y-1 pt-1">
              <span>
                IBAN atașat:{" "}
                <strong className="font-mono text-ink">
                  {account?.iban_last4
                    ? `RO•• •••• •••• •••• ${account.iban_last4}`
                    : "Nesetat"}
                </strong>
              </span>
              <span>
                Mod:{" "}
                <strong className="font-mono uppercase text-ink">
                  {account?.mode || mode}
                </strong>
              </span>
            </div>
          </div>

          <div className="rounded-xl bg-slate-50 border border-slate-200/80 p-4 space-y-2.5">
            <div className="text-[11px] font-mono uppercase tracking-wider text-ink-muted">
              Capabilități Cont (Stripe / Escrow)
            </div>
            <div className="flex flex-wrap gap-2">
              <CapabilityBadge
                label="charges_enabled"
                active={Boolean(account?.charges_enabled)}
              />
              <CapabilityBadge
                label="payouts_enabled"
                active={Boolean(account?.payouts_enabled)}
              />
              <CapabilityBadge
                label="details_submitted"
                active={Boolean(account?.details_submitted)}
              />
            </div>
          </div>
        </div>

        {/* Mesaje de feedback */}
        {errorMsg && (
          <div
            role="alert"
            className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-medium text-rose-800"
          >
            {errorMsg}
          </div>
        )}

        {successMsg && (
          <div
            role="status"
            className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs font-medium text-emerald-800"
          >
            {successMsg}
          </div>
        )}

        {/* Acțiune Onboarding dacă contul nu este activ */}
        {!isAccountActive ? (
          mode === "sandbox" ? (
            <form
              onSubmit={handleStartOnboarding}
              className="rounded-xl border border-ochre/25 bg-ochre-light/40 p-4 sm:p-5 flex flex-col sm:flex-row sm:items-end gap-4"
            >
              <div className="flex-1 space-y-1.5">
                <label
                  htmlFor="iban-last4"
                  className="block text-xs font-semibold text-ink"
                >
                  Ultimele 4 cifre ale contului IBAN (opțional, pentru simulare)
                </label>
                <input
                  id="iban-last4"
                  type="text"
                  inputMode="numeric"
                  maxLength={4}
                  value={ibanLast4}
                  onChange={(e) =>
                    setIbanLast4(e.target.value.replace(/\D/g, "").slice(0, 4))
                  }
                  placeholder="ex: 4242"
                  disabled={busy || migrationMissing}
                  className="catalog-input max-w-xs font-mono"
                />
              </div>

              <button
                type="submit"
                disabled={busy || migrationMissing}
                className="catalog-btn-primary whitespace-nowrap"
              >
                {busy
                  ? "Se activează contul..."
                  : "Activează Contul de Încasări (Sandbox Gratuit)"}
              </button>
            </form>
          ) : (
            <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <p className="text-sm font-semibold text-ink">
                  Finalizează verificarea identității prin Stripe Express
                </p>
                <p className="text-xs text-ink-muted">
                  Vei fi redirecționat securizat pe platforma Stripe pentru a
                  introduce IBAN-ul și datele KYC.
                </p>
              </div>
              <button
                type="button"
                disabled={busy || migrationMissing}
                onClick={() => handleStartOnboarding()}
                className="catalog-btn-primary whitespace-nowrap shrink-0"
              >
                {busy
                  ? "Se generează link-ul Stripe..."
                  : "Conectează Contul Bancar prin Stripe Express →"}
              </button>
            </div>
          )
        ) : (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 px-4 py-3 text-xs text-emerald-900 flex items-center gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" strokeWidth={1.8} aria-hidden="true" />
            <span>
              Contul tău este activ și pregătit să primească încasări automate
              la finalizarea fiecărei închirieri.
            </span>
          </div>
        )}
      </section>

      {/* Card 2: Istoric Tranzacții & Garanții Escrow */}
      <section className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-sm space-y-6">
        <div className="border-b border-slate-100 pb-4 space-y-1">
          <h2 className="font-display text-lg font-bold text-ink">
            Istoric Tranzacții &amp; Garanții Escrow
          </h2>
          <p className="text-xs text-ink-muted">
            Evidența completă a chiriilor încasate/plătite, a comisionului de
            10% și a garanțiilor blocate în Escrow.
          </p>
        </div>

        {/* Sumar Financiar (3 carduri KPI) */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="rounded-xl border border-emerald-200/80 bg-emerald-50/50 p-4 space-y-1">
            <div className="text-[11px] font-mono uppercase tracking-wider text-emerald-800/80">
              Total Încasat ca Ofertant
            </div>
            <div className="font-display text-2xl font-extrabold text-emerald-900">
              {totalEarnedAsOwner.toFixed(2)}{" "}
              <span className="text-sm font-mono font-semibold">RON</span>
            </div>
            <div className="text-[11px] text-emerald-800/70">
              90% net eliberat după finalizare
            </div>
          </div>

          <div className="rounded-xl border border-ochre/25 bg-ochre-light/50 p-4 space-y-1">
            <div className="text-[11px] font-mono uppercase tracking-wider text-ochre">
              Total Blocat în Escrow
            </div>
            <div className="font-display text-2xl font-extrabold text-ink">
              {totalHeldInEscrow.toFixed(2)}{" "}
              <span className="text-sm font-mono font-semibold">RON</span>
            </div>
            <div className="text-[11px] text-ink-muted">
              Chirie + garanții în curs de protecție
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-1">
            <div className="text-[11px] font-mono uppercase tracking-wider text-ink-muted">
              Comision Platformă (10%)
            </div>
            <div className="font-display text-2xl font-extrabold text-ink">
              {totalPlatformFees.toFixed(2)}{" "}
              <span className="text-sm font-mono font-semibold">RON</span>
            </div>
            <div className="text-[11px] text-ink-muted">
              Taxă procesare &amp; protecție Escrow
            </div>
          </div>
        </div>

        {/* Lista Tranzacțiilor */}
        {payments.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/60 p-8 text-center space-y-1.5">
            <div className="font-mono text-xs font-semibold text-ink-muted">
              [NICIO TRANZACȚIE ÎNREGISTRATĂ ÎNCĂ]
            </div>
            <p className="text-xs text-ink-muted max-w-md mx-auto">
              După ce o rezervare este confirmată și plătită în Escrow,
              detaliile financiare și statusul garanției vor apărea automat
              aici.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {payments.map((payment) => {
              const isOwner = payment.owner_id === currentUserId;
              const pBadge = getPaymentStatusBadge(payment.payment_status);
              const dBadge = getDepositStatusBadge(payment.deposit_status);

              return (
                <div
                  key={payment.id}
                  className="rounded-xl border border-slate-200/90 bg-white p-4 hover:border-slate-300 transition-colors space-y-3"
                >
                  {/* Antet rând tranzacție */}
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full font-semibold ${
                          isOwner
                            ? "bg-emerald-50 text-emerald-700"
                            : "bg-slate-100 text-slate-700"
                        }`}
                      >
                        {isOwner ? "Încasare Ofertant" : "Plată Chiriaș"}
                      </span>
                      <span className="font-mono text-ink-muted">
                        #REZ-{payment.booking_id.slice(0, 8).toUpperCase()}
                      </span>
                      <span className="text-slate-300">&bull;</span>
                      <span className="font-mono text-[11px] text-ink-muted">
                        {new Date(payment.created_at).toLocaleDateString(
                          "ro-RO"
                        )}
                      </span>
                      <span className="px-1.5 py-0.5 rounded bg-slate-100 font-mono text-[10px] uppercase text-ink-muted">
                        {payment.mode}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${pBadge.className}`}
                      >
                        {pBadge.label}
                      </span>
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-medium border ${dBadge.className}`}
                      >
                        {dBadge.label}
                      </span>
                    </div>
                  </div>

                  {/* Defalcare sume */}
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-xs">
                    <div>
                      <div className="text-[11px] text-ink-muted">Chirie</div>
                      <div className="font-mono font-semibold text-ink">
                        {Number(payment.rental_amount_ron).toFixed(2)} RON
                      </div>
                    </div>
                    <div>
                      <div className="text-[11px] text-ink-muted">
                        Comision (10%)
                      </div>
                      <div className="font-mono font-medium text-ink-muted">
                        {Number(payment.platform_fee_ron).toFixed(2)} RON
                      </div>
                    </div>
                    <div>
                      <div className="text-[11px] text-ink-muted">
                        Payout Ofertant (90%)
                      </div>
                      <div className="font-mono font-bold text-emerald-700">
                        {Number(payment.owner_payout_ron).toFixed(2)} RON
                      </div>
                    </div>
                    <div>
                      <div className="text-[11px] text-ink-muted">
                        Garanție Escrow
                      </div>
                      <div className="font-mono font-semibold text-ink">
                        {Number(payment.deposit_amount_ron).toFixed(2)} RON
                      </div>
                    </div>
                    <div>
                      <div className="text-[11px] text-ink-muted">
                        Total Încasat Card
                      </div>
                      <div className="font-mono font-bold text-ink">
                        {Number(payment.total_charged_ron).toFixed(2)} RON
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Card 3: Facturi Fiscale Comision (SRL & RO e-Factura — M14.2) */}
      <section className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-sm space-y-5">
        <div className="border-b border-slate-100 pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="space-y-1">
            <h2 className="font-display text-lg font-bold text-ink">
              Facturi Fiscale Comision (SRL &amp; RO e-Factura)
            </h2>
            <p className="text-xs text-ink-muted">
              Facturile emise pentru comisionul de intermediere RentA (10%),
              disponibile pentru imprimare PDF A4 și export XML UBL 2.1.
            </p>
          </div>
          <span className="inline-flex items-center px-2.5 py-1 rounded-full font-mono text-[11px] font-semibold bg-ochre-light text-ochre self-start sm:self-center">
            {invoices.length}{" "}
            {invoices.length === 1 ? "factură emisă" : "facturi emise"}
          </span>
        </div>

        {invoicesMigrationMissing ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-4 text-xs text-amber-950 space-y-1">
            <div className="font-semibold">
              Registrul de facturi necesită migrația SQL 007
            </div>
            <p className="text-amber-900/90">
              Rulează fișierul{" "}
              <code className="font-mono bg-amber-100 px-1.5 py-0.5 rounded">
                supabase/migrations/007_legal_gdpr_and_invoicing.sql
              </code>{" "}
              în Supabase SQL Editor pentru a activa emiterea și listarea
              facturilor de comision.
            </p>
          </div>
        ) : invoices.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/60 p-8 text-center space-y-1.5">
            <div className="font-mono text-xs font-semibold text-ink-muted">
              [NICIO FACTURĂ DE COMISION EMISĂ ÎNCĂ]
            </div>
            <p className="text-xs text-ink-muted max-w-md mx-auto">
              Facturile fiscale pentru comisionul de 10% apar automat aici după
              emitere și pot fi salvate ca PDF sau XML RO e-Factura.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {invoices.map((invoice) => {
              const eBadge = getEFacturaBadge(invoice.efactura_status);
              return (
                <div
                  key={invoice.id}
                  className="rounded-xl border border-slate-200/90 bg-white p-4 hover:border-slate-300 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                >
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-sm font-bold text-ink">
                        {invoice.invoice_number}
                      </span>
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold border ${eBadge.className}`}
                      >
                        {eBadge.label}
                      </span>
                      <span className="px-1.5 py-0.5 rounded bg-slate-100 font-mono text-[10px] uppercase text-ink-muted">
                        {invoice.provider}
                      </span>
                    </div>
                    <div className="text-xs text-ink-muted flex flex-wrap items-center gap-x-3 gap-y-1">
                      <span>
                        Client:{" "}
                        <strong className="text-ink">
                          {invoice.client_name}
                        </strong>
                        {invoice.client_cui ? ` (${invoice.client_cui})` : ""}
                      </span>
                      <span>&bull;</span>
                      <span className="font-mono">
                        Data:{" "}
                        {new Date(invoice.issued_at).toLocaleDateString("ro-RO")}
                      </span>
                      <span>&bull;</span>
                      <span className="font-mono">
                        #REZ-{invoice.booking_id.slice(0, 8).toUpperCase()}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-4">
                    <div className="text-left sm:text-right">
                      <div className="text-[11px] text-ink-muted">
                        Total (TVA {Number(invoice.vat_rate).toFixed(0)}%)
                      </div>
                      <div className="font-mono text-sm font-bold text-ink">
                        {Number(invoice.total_ron).toFixed(2)}{" "}
                        {invoice.currency || "RON"}
                      </div>
                    </div>

                    <Link
                      href={`/profil/facturi/${invoice.id}`}
                      className="catalog-btn-secondary text-xs whitespace-nowrap"
                    >
                      Vezi / PDF &rarr;
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

/**
 * Mini-badge pentru capabilitățile tehnice ale contului de încasări.
 */
function CapabilityBadge({
  label,
  active,
}: {
  label: string;
  active: boolean;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full font-mono text-[11px] font-semibold border ${
        active
          ? "bg-emerald-50 text-emerald-700 border-emerald-200"
          : "bg-white text-slate-500 border-slate-200"
      }`}
    >
      {active ? (
        <Check className="w-3 h-3 shrink-0" strokeWidth={1.8} aria-hidden="true" />
      ) : (
        <Circle className="w-3 h-3 shrink-0" strokeWidth={1.8} aria-hidden="true" />
      )}
      <span>{label}</span>
    </span>
  );
}
