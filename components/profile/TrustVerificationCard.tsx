"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Building2, Check, Circle, Phone, ShieldCheck } from "lucide-react";
import {
  requestPhoneOtpAction,
  verifyPhoneOtpAction,
  verifyCompanyAnafAction,
} from "@/app/actions/trust";

/**
 * ============================================================================
 * Cardul de Încredere & Verificări (`components/profile/TrustVerificationCard.tsx`)
 * ============================================================================
 *
 * Explicație pentru C/Java:
 * Această componentă Client (`"use client"`) funcționează ca un panou interactiv
 * cu două fluxuri independente (fiecare cu propriile sale variabile de stare `useState`):
 *   1. Stânga (M12.1): Verificarea numărului de telefon prin cod OTP (6 cifre).
 *   2. Dreapta (M12.2): Verificarea automată a firmelor B2C (KYB) prin CUI în ANAF.
 *
 * Apelurile către server (`requestPhoneOtpAction`, `verifyPhoneOtpAction`,
 * `verifyCompanyAnafAction`) sunt Next.js Server Actions — echivalentul apelării
 * directe a unei metode dintr-un `@RestController` Java, cu tipuri verificate la compilare.
 */
export interface TrustVerificationCardProps {
  initialPhone: string | null;
  phoneVerified: boolean;
  accountType: "individual" | "company";
  initialCui: string | null;
  kybVerified: boolean;
  companyName?: string | null;
  companyAddress?: string | null;
  layout?: "grid" | "stack";
}

export function TrustVerificationCard({
  initialPhone,
  phoneVerified,
  accountType,
  initialCui,
  kybVerified,
  companyName,
  companyAddress,
  layout = "grid",
}: TrustVerificationCardProps) {
  const router = useRouter();

  // --- Stări locale pentru M12.1: Verificare Telefon (OTP SMS) ---
  const [phone, setPhone] = useState(initialPhone ?? "");
  const [isPhoneVerified, setIsPhoneVerified] = useState(phoneVerified);
  const [otpRequested, setOtpRequested] = useState(false);
  const [devOtpCode, setDevOtpCode] = useState<string | null>(null);
  const [otpExpiresIn, setOtpExpiresIn] = useState<number>(10);
  const [otpCode, setOtpCode] = useState("");
  const [otpBusy, setOtpBusy] = useState(false);
  const [otpError, setOtpError] = useState<string | null>(null);
  const [otpSuccess, setOtpSuccess] = useState<string | null>(null);

  // --- Stări locale pentru M12.2: Verificare Firmă ANAF (CUI / KYB) ---
  const [cui, setCui] = useState(initialCui ?? "");
  const [isKybVerified, setIsKybVerified] = useState(kybVerified);
  const [verifiedCompanyName, setVerifiedCompanyName] = useState<string | null>(
    companyName ?? null
  );
  const [verifiedCompanyAddress, setVerifiedCompanyAddress] = useState<
    string | null
  >(companyAddress ?? null);
  const [verifiedCui, setVerifiedCui] = useState<string | null>(
    initialCui ?? null
  );
  const [anafBusy, setAnafBusy] = useState(false);
  const [anafError, setAnafError] = useState<string | null>(null);
  const [anafSuccess, setAnafSuccess] = useState<string | null>(null);

  async function handleRequestOtp(e: React.FormEvent) {
    e.preventDefault();
    setOtpBusy(true);
    setOtpError(null);
    setOtpSuccess(null);

    try {
      const res = await requestPhoneOtpAction(phone.trim());
      if (!res.success) {
        setOtpError(res.error || "Nu s-a putut trimite codul OTP.");
        return;
      }

      setOtpRequested(true);
      setDevOtpCode(res.data?.devOtpCode ?? null);
      setOtpExpiresIn(res.data?.expiresInMinutes ?? 10);
      if (res.data?.phone) {
        setPhone(res.data.phone);
      }
      setOtpSuccess(
        res.message ||
          "Codul OTP de 6 cifre a fost generat. Introdu-l mai jos pentru confirmare."
      );
    } catch {
      setOtpError("Eroare la comunicarea cu serverul de verificare OTP.");
    } finally {
      setOtpBusy(false);
    }
  }

  async function handleVerifyOtp(e: React.FormEvent) {
    e.preventDefault();
    setOtpBusy(true);
    setOtpError(null);
    setOtpSuccess(null);

    try {
      const res = await verifyPhoneOtpAction(phone.trim(), otpCode.trim());
      if (!res.success) {
        setOtpError(res.error || "Codul OTP introdus este invalid sau expirat.");
        return;
      }

      setIsPhoneVerified(true);
      setOtpRequested(false);
      setDevOtpCode(null);
      setOtpCode("");
      setOtpSuccess(
        res.message || "Numărul de telefon a fost verificat cu succes!"
      );
      router.refresh();
    } catch {
      setOtpError("Eroare la verificarea codului OTP.");
    } finally {
      setOtpBusy(false);
    }
  }

  async function handleVerifyAnaf(e: React.FormEvent) {
    e.preventDefault();
    setAnafBusy(true);
    setAnafError(null);
    setAnafSuccess(null);

    try {
      const res = await verifyCompanyAnafAction(cui.trim());
      if (!res.success) {
        setAnafError(
          res.error || "Nu s-a putut valida CUI-ul în Registrul ANAF."
        );
        return;
      }

      const data = res.data as
        | {
            cui?: string;
            company_name?: string;
            denumire?: string;
            address?: string;
            adresa?: string;
          }
        | undefined;

      setIsKybVerified(true);
      if (data?.cui) setVerifiedCui(data.cui);
      else setVerifiedCui(cui.trim().toUpperCase());

      setVerifiedCompanyName(
        data?.company_name ?? data?.denumire ?? verifiedCompanyName
      );
      setVerifiedCompanyAddress(
        data?.address ?? data?.adresa ?? verifiedCompanyAddress
      );
      setAnafSuccess(
        res.message || "Firma a fost verificată automat în Registrul ANAF!"
      );
      router.refresh();
    } catch {
      setAnafError("Eroare la interogarea serviciului ANAF.");
    } finally {
      setAnafBusy(false);
    }
  }

  return (
    <section className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-sm space-y-5">
      {/* Antet Secțiune Verificare Identitate */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-4">
        <div>
          <span className="inline-flex items-center rounded-full bg-ochre-light px-2.5 py-0.5 text-[11px] font-semibold text-ochre">
            Încredere &amp; Siguranță
          </span>
          <h2 className="font-display text-lg font-bold text-ink mt-1">
            Verificare Telefon &amp; Business (ANAF)
          </h2>
        </div>
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-ink-muted">
          <ShieldCheck className="w-3.5 h-3.5 text-ochre shrink-0" strokeWidth={1.8} aria-hidden="true" />
          <span>Insignă verificată în catalog</span>
        </span>
      </div>

      {/* Grid sau Stack adaptiv */}
      <div
        className={
          layout === "stack"
            ? "grid grid-cols-1 gap-4"
            : "grid grid-cols-1 lg:grid-cols-2 gap-6"
        }
      >
        {/* COLOANA STÂNGA — M12.1 Verificare Telefon (OTP SMS) */}
        <div className="rounded-xl border border-slate-200/80 bg-slate-50/60 p-5 flex flex-col justify-between gap-4">
          <div className="space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <h3 className="flex items-center gap-2 font-display text-base font-bold text-ink">
                  <Phone className="w-4 h-4 text-ochre shrink-0" strokeWidth={1.8} aria-hidden="true" />
                  <span>Verificare Telefon (OTP SMS)</span>
                </h3>
                <p className="text-xs text-ink-muted mt-0.5">
                  Confirmă numărul tău de telefon pentru a debloca badge-ul de
                  contact verificat.
                </p>
              </div>

              {isPhoneVerified ? (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200 shrink-0">
                  <Check className="w-3.5 h-3.5 shrink-0" strokeWidth={1.8} aria-hidden="true" />
                  <span>Telefon Verificat</span>
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200 shrink-0">
                  <Circle className="w-3 h-3 shrink-0" strokeWidth={1.8} aria-hidden="true" />
                  <span>Neverificat</span>
                </span>
              )}
            </div>

            {/* Formular Trimite Cod OTP */}
            <form onSubmit={handleRequestOtp} className="space-y-3">
              <div className="space-y-1">
                <label
                  htmlFor="trust-phone-input"
                  className="block text-xs font-semibold text-ink"
                >
                  Număr de telefon (România)
                </label>
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    id="trust-phone-input"
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="0740123456"
                    required
                    className="catalog-input flex-1 font-mono"
                  />
                  <button
                    type="submit"
                    disabled={otpBusy || !phone.trim()}
                    className="catalog-btn-primary shrink-0 whitespace-nowrap"
                  >
                    {otpBusy ? "Se trimite..." : "Trimite Cod OTP"}
                  </button>
                </div>
              </div>
            </form>

            {/* Banner Cod Sandbox (când nu există provider SMS extern configurat) */}
            {otpRequested && devOtpCode && (
              <div className="rounded-xl border border-ochre/30 bg-ochre-light/70 p-3.5 text-xs text-ink space-y-1">
                <div className="font-semibold text-ochre flex items-center justify-between gap-2">
                  <span>Cod OTP Sandbox (Gratuit):</span>
                  <span className="font-mono text-base font-extrabold tracking-widest bg-white px-2.5 py-0.5 rounded-md border border-ochre/30 text-ink">
                    {devOtpCode}
                  </span>
                </div>
                <p className="text-[11px] text-ink-muted">
                  Valabil {otpExpiresIn} minute. Introdu codul de 6 cifre mai
                  jos pentru a finaliza verificarea.
                </p>
              </div>
            )}

            {/* Formular Confirmă Codul OTP */}
            {otpRequested && (
              <form
                onSubmit={handleVerifyOtp}
                className="space-y-2.5 pt-2 border-t border-slate-200/80"
              >
                <label
                  htmlFor="trust-otp-code"
                  className="block text-xs font-semibold text-ink"
                >
                  Introdu codul OTP de 6 cifre
                </label>
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    id="trust-otp-code"
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    value={otpCode}
                    onChange={(e) =>
                      setOtpCode(e.target.value.replace(/\D/g, "").slice(0, 6))
                    }
                    placeholder="123456"
                    required
                    className="catalog-input flex-1 font-mono tracking-[0.25em] text-center font-bold"
                  />
                  <button
                    type="submit"
                    disabled={otpBusy || otpCode.length < 6}
                    className="catalog-btn-primary shrink-0 whitespace-nowrap"
                  >
                    {otpBusy ? "Se verifică..." : "Confirmă Codul OTP"}
                  </button>
                </div>
              </form>
            )}

            {otpError && (
              <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800 font-medium">
                {otpError}
              </div>
            )}

            {otpSuccess && (
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800 font-medium">
                {otpSuccess}
              </div>
            )}
          </div>

          <p className="text-[11px] text-ink-muted">
            Numărul tău rămâne protejat GDPR în tabelul privat și este dezvăluit
            partenerului doar după confirmarea unei rezervări.
          </p>
        </div>

        {/* COLOANA DREAPTA — M12.2 Verificare Firmă ANAF (CUI / KYB) */}
        <div className="rounded-xl border border-slate-200/80 bg-slate-50/60 p-5 flex flex-col justify-between gap-4">
          <div className="space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <h3 className="flex items-center gap-2 font-display text-base font-bold text-ink">
                  <Building2 className="w-4 h-4 text-ochre shrink-0" strokeWidth={1.8} aria-hidden="true" />
                  <span>Verificare Business ANAF (CUI)</span>
                </h3>
                <p className="text-xs text-ink-muted mt-0.5">
                  Validare automată pentru conturile Business direct în
                  Registrul ANAF.
                </p>
              </div>

              {isKybVerified ? (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200 shrink-0">
                  <Check className="w-3.5 h-3.5 shrink-0" strokeWidth={1.8} aria-hidden="true" />
                  <span>Business Verificat</span>
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200 shrink-0">
                  <Circle className="w-3 h-3 shrink-0" strokeWidth={1.8} aria-hidden="true" />
                  <span>Neverificat</span>
                </span>
              )}
            </div>

            {/* Detalii firmă verificată din ANAF */}
            {isKybVerified && (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-3.5 space-y-1 text-xs">
                <div className="font-semibold text-emerald-950">
                  {verifiedCompanyName || "Societate comercială validată ANAF"}
                </div>
                {verifiedCui && (
                  <div className="font-mono text-[11px] text-emerald-800">
                    CUI: <strong>{verifiedCui}</strong>
                  </div>
                )}
                {verifiedCompanyAddress && (
                  <div className="text-[11px] text-emerald-900/80">
                    Sediu social: {verifiedCompanyAddress}
                  </div>
                )}
              </div>
            )}

            {accountType === "company" ? (
              <form onSubmit={handleVerifyAnaf} className="space-y-3">
                <div className="space-y-1">
                  <label
                    htmlFor="trust-cui-input"
                    className="block text-xs font-semibold text-ink"
                  >
                    Cod Unic de Înregistrare (CUI / CIF)
                  </label>
                  <input
                    id="trust-cui-input"
                    type="text"
                    value={cui}
                    onChange={(e) => setCui(e.target.value)}
                    placeholder="RO14399840 sau 14399840"
                    required
                    className="catalog-input font-mono uppercase"
                  />
                </div>
                <button
                  type="submit"
                  disabled={anafBusy || !cui.trim()}
                  className="catalog-btn-primary w-full"
                >
                  {anafBusy
                    ? "Se interoghează Registrul ANAF..."
                    : "Verifică automat în Registrul ANAF"}
                </button>
              </form>
            ) : (
              <div className="rounded-xl border border-slate-200 bg-white p-3.5 text-xs text-ink-muted space-y-1.5">
                <div className="font-semibold text-ink">
                  Cont activ: Personal
                </div>
                <p>
                  Verificarea automată ANAF (CUI) este dedicată conturilor de tip{" "}
                  <strong>Business</strong>. Dacă reprezinți o firmă sau un PFA,
                  poți comuta tipul contului pe Business din formularul de
                  profil.
                </p>
              </div>
            )}

            {anafError && (
              <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800 font-medium">
                {anafError}
              </div>
            )}

            {anafSuccess && (
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800 font-medium">
                {anafSuccess}
              </div>
            )}
          </div>

          <p className="text-[11px] text-ink-muted">
            Conturile verificate ANAF primesc automat insigna{" "}
            <strong className="inline-flex items-center gap-1 text-emerald-700 align-bottom">
              <Building2 className="w-3 h-3 shrink-0" strokeWidth={1.8} aria-hidden="true" />
              <span>Business verificat</span>
              <Check className="w-3 h-3 shrink-0" strokeWidth={1.8} aria-hidden="true" />
            </strong>{" "}
            pe toate cardurile din catalogul public.
          </p>
        </div>
      </div>
    </section>
  );
}
