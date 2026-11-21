"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getSupabaseEnv } from "@/lib/supabase/config";
import {
  calculateVatBreakdown,
  getIssuerConfig,
} from "@/lib/invoicing/provider";
import type {
  ActionResponse,
  EFacturaStatus,
  GdprExportPayload,
  InvoiceProvider,
  InvoiceRecord,
} from "@/lib/types/database";

/**
 * ============================================================================
 * RentA (Faza 14) — Server Actions pentru Conformitate GDPR & Facturare SRL
 * (`app/actions/legal.ts`)
 * ============================================================================
 *
 * Explicație pentru dezvoltatori C / Java:
 * - Acest fișier joacă rolul unui `ComplianceAndInvoicingService` din Spring Boot.
 * - `exportMyGdprDataAction()` implementează Art. 20 GDPR (Dreptul la
 *   portabilitatea datelor): colectează într-un singur DTO JSON toate datele
 *   utilizatorului autentificat (profil public, profil privat PII, anunțuri,
 *   rezervări ca chiriaș/proprietar, plăți, facturi și notificări).
 * - `anonymizeMyAccountAction()` implementează Art. 17 GDPR (Dreptul la
 *   ștergerea datelor) apelând funcția SQL `SECURITY DEFINER`
 *   `public.anonymize_my_account_gdpr()`, apoi închide sesiunea Auth.
 * - `issueCommissionInvoiceAction()`, `getMyInvoicesAction()` și
 *   `getInvoiceByIdAction()` gestionează registrul de facturi de comision SRL
 *   și starea RO e-Factura, cu tratare grațioasă (`migrationMissing`) dacă
 *   migrația `007_legal_gdpr_and_invoicing.sql` nu a fost rulată încă.
 */

const MIGRATION_MISSING_MESSAGE =
  "Tabelele și funcțiile din Faza 14 nu au fost create încă în Supabase. Rulează fișierul supabase/migrations/007_legal_gdpr_and_invoicing.sql în Supabase SQL Editor și reîncearcă.";

function errorResponse<T = unknown>(message: string): ActionResponse<T> {
  return {
    success: false,
    ok: false,
    error: message,
    message,
  };
}

function successResponse<T = unknown>(
  message: string,
  data?: T
): ActionResponse<T> {
  return {
    success: true,
    ok: true,
    message,
    data,
  };
}

/**
 * Detectează erorile PostgREST / PostgreSQL care indică lipsa tabelului `invoices`
 * sau a funcției RPC `anonymize_my_account_gdpr` (migrația 007 nerulată încă).
 */
function isMissingMigration007Error(
  error: { code?: string; message?: string } | null | undefined
): boolean {
  if (!error) return false;
  const code = error.code ?? "";
  const msg = (error.message ?? "").toLowerCase();
  return (
    code === "42P01" ||
    code === "42883" ||
    code === "PGRST202" ||
    code === "PGRST205" ||
    msg.includes("could not find the table") ||
    msg.includes("could not find the function") ||
    (msg.includes("relation") && msg.includes("invoices")) ||
    msg.includes("anonymize_my_account_gdpr") ||
    msg.includes("does not exist")
  );
}

/**
 * Normalizează un rând brut din `public.invoices` astfel încât valorile `NUMERIC`
 * venite din PostgreSQL să fie garantat de tip `number` în TypeScript.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normalizeInvoiceRow(row: any): InvoiceRecord {
  const rawProvider = String(row.provider ?? "internal");
  const provider: InvoiceProvider =
    rawProvider === "oblio" || rawProvider === "smartbill"
      ? rawProvider
      : "internal";

  const rawEfactura = String(row.efactura_status ?? "pending_anaf");
  const efacturaStatus: EFacturaStatus =
    rawEfactura === "not_applicable" ||
    rawEfactura === "pending_anaf" ||
    rawEfactura === "submitted" ||
    rawEfactura === "accepted" ||
    rawEfactura === "rejected"
      ? rawEfactura
      : "pending_anaf";

  return {
    id: String(row.id),
    invoice_number: String(row.invoice_number),
    booking_id: String(row.booking_id),
    payment_id: row.payment_id ? String(row.payment_id) : null,
    owner_id: String(row.owner_id),
    renter_id: String(row.renter_id),
    issuer_name: String(row.issuer_name ?? "RENTA MARKETPLACE SRL"),
    issuer_cui: String(row.issuer_cui ?? "RO00000000"),
    client_name: String(row.client_name ?? "Client RentA"),
    client_cui: row.client_cui ? String(row.client_cui) : null,
    client_address: row.client_address ? String(row.client_address) : null,
    subtotal_ron: Number(row.subtotal_ron ?? 0),
    vat_rate: Number(row.vat_rate ?? 19),
    vat_amount_ron: Number(row.vat_amount_ron ?? 0),
    total_ron: Number(row.total_ron ?? 0),
    currency: String(row.currency ?? "RON"),
    provider,
    external_invoice_id: row.external_invoice_id
      ? String(row.external_invoice_id)
      : null,
    efactura_status: efacturaStatus,
    issued_at: String(row.issued_at ?? row.created_at),
    created_at: String(row.created_at),
  };
}

/**
 * 1. EXPORT DATE PERSONALE GDPR (`exportMyGdprDataAction`) — Art. 20 GDPR
 *
 * Colectează toate înregistrările aferente utilizatorului autentificat din
 * tabelele aplicației (protejate prin RLS strict pe `auth.uid()`).
 * Dacă unele tabele din migrații opționale (ex. `invoices`, `notifications`)
 * nu există încă, exportul nu eșuează — întoarce `[]` pentru acele secțiuni.
 */
export async function exportMyGdprDataAction(): Promise<
  ActionResponse<GdprExportPayload>
> {
  const { isConfigured } = getSupabaseEnv();
  if (!isConfigured) {
    return errorResponse("Conexiunea Supabase nu este configurată.");
  }

  const supabase = await createClient();
  if (!supabase) {
    return errorResponse("Clientul Supabase nu a putut fi inițializat pe server.");
  }

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return errorResponse(
      "Trebuie să fii autentificat pentru a exporta datele tale GDPR."
    );
  }

  // Executăm interogările în paralel (`Promise.all` — similar cu `CompletableFuture.allOf` în Java)
  const [
    profileRes,
    profilePrivateRes,
    listingsRes,
    bookingsRenterRes,
    bookingsOwnerRes,
    paymentsRes,
    invoicesRes,
    notificationsRes,
  ] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(),
    supabase
      .from("profile_private")
      .select("*")
      .eq("id", user.id)
      .maybeSingle(),
    supabase
      .from("listings")
      .select("*")
      .eq("owner_id", user.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("bookings")
      .select("*")
      .eq("renter_id", user.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("bookings")
      .select("*")
      .eq("owner_id", user.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("payments")
      .select("*")
      .or(`renter_id.eq.${user.id},owner_id.eq.${user.id}`)
      .order("created_at", { ascending: false }),
    supabase
      .from("invoices")
      .select("*")
      .or(`owner_id.eq.${user.id},renter_id.eq.${user.id}`)
      .order("issued_at", { ascending: false }),
    supabase
      .from("notifications")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false }),
  ]);

  const payload: GdprExportPayload = {
    exported_at: new Date().toISOString(),
    user_id: user.id,
    email: user.email ?? null,
    profile:
      !profileRes.error && profileRes.data
        ? (profileRes.data as Record<string, unknown>)
        : null,
    profile_private:
      !profilePrivateRes.error && profilePrivateRes.data
        ? (profilePrivateRes.data as Record<string, unknown>)
        : null,
    listings:
      !listingsRes.error && Array.isArray(listingsRes.data)
        ? (listingsRes.data as Record<string, unknown>[])
        : [],
    bookings_as_renter:
      !bookingsRenterRes.error && Array.isArray(bookingsRenterRes.data)
        ? (bookingsRenterRes.data as Record<string, unknown>[])
        : [],
    bookings_as_owner:
      !bookingsOwnerRes.error && Array.isArray(bookingsOwnerRes.data)
        ? (bookingsOwnerRes.data as Record<string, unknown>[])
        : [],
    payments:
      !paymentsRes.error && Array.isArray(paymentsRes.data)
        ? (paymentsRes.data as Record<string, unknown>[])
        : [],
    invoices:
      !invoicesRes.error && Array.isArray(invoicesRes.data)
        ? (invoicesRes.data as Record<string, unknown>[])
        : [],
    notifications:
      !notificationsRes.error && Array.isArray(notificationsRes.data)
        ? (notificationsRes.data as Record<string, unknown>[])
        : [],
  };

  return successResponse(
    "Arhiva ta GDPR în format JSON a fost generată cu succes.",
    payload
  );
}

/**
 * 2. ANONIMIZARE & ȘTERGERE CONT GDPR (`anonymizeMyAccountAction`) — Art. 17 GDPR
 *
 * Solicită confirmare explicită (`STERGE CONTUL`), rulează RPC-ul atomic
 * `public.anonymize_my_account_gdpr()` (care verifică lipsa rezervărilor active,
 * arhivează anunțurile și șterge PII-ul), apoi deconectează utilizatorul.
 */
export async function anonymizeMyAccountAction(
  confirmationText: string
): Promise<ActionResponse<null>> {
  const normalizedConfirm = (confirmationText ?? "")
    .trim()
    .toUpperCase()
    .replace(/Ș/g, "S")
    .replace(/Ş/g, "S");

  if (normalizedConfirm !== "STERGE CONTUL") {
    return errorResponse(
      'Pentru confirmare, introdu exact textul "STERGE CONTUL" în câmpul de verificare.'
    );
  }

  const { isConfigured } = getSupabaseEnv();
  if (!isConfigured) {
    return errorResponse("Conexiunea Supabase nu este configurată.");
  }

  const supabase = await createClient();
  if (!supabase) {
    return errorResponse("Clientul Supabase nu a putut fi inițializat pe server.");
  }

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return errorResponse(
      "Trebuie să fii autentificat pentru a solicita anonimizarea contului."
    );
  }

  const { error: rpcError } = await supabase.rpc("anonymize_my_account_gdpr");

  if (rpcError) {
    if (isMissingMigration007Error(rpcError)) {
      return errorResponse(MIGRATION_MISSING_MESSAGE);
    }
    return errorResponse(
      rpcError.message ||
        "Nu am putut finaliza anonimizarea contului. Verifică să nu ai rezervări active."
    );
  }

  // Deconectăm sesiunea curentă după anonimizare
  await supabase.auth.signOut();

  revalidatePath("/");
  revalidatePath("/catalog");
  revalidatePath("/profil");
  revalidatePath("/profil/confidentialitate");

  return successResponse(
    "Contul tău a fost anonimizat conform Art. 17 GDPR, anunțurile au fost arhivate, iar sesiunea a fost închisă.",
    null
  );
}

/**
 * 3. EMITERE FACTURĂ COMISION SRL (`issueCommissionInvoiceAction`) — M14.2
 *
 * Operație IDEMPOTENTĂ:
 * - Dacă pentru `bookingId` există deja o factură în `public.invoices`, o returnează
 *   direct fără a genera dubluri.
 * - Doar proprietarul obiectului (`booking.owner_id === user.id`) poate emite
 *   factura aferentă rezervării (în acord cu politica RLS `invoices_insert_owner`).
 * - Calculează automat defalcarea TVA (bază + TVA = comision total) și setează
 *   starea RO e-Factura (`pending_anaf` pentru firme cu CUI, `not_applicable`
 *   pentru persoane fizice fără CUI).
 */
export async function issueCommissionInvoiceAction(
  bookingId: string
): Promise<ActionResponse<InvoiceRecord>> {
  const { isConfigured } = getSupabaseEnv();
  if (!isConfigured) {
    return errorResponse("Conexiunea Supabase nu este configurată.");
  }

  const supabase = await createClient();
  if (!supabase) {
    return errorResponse("Clientul Supabase nu a putut fi inițializat pe server.");
  }

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return errorResponse(
      "Trebuie să fii autentificat pentru a emite factura de comision."
    );
  }

  if (!bookingId || !bookingId.trim()) {
    return errorResponse("ID-ul rezervării lipsește.");
  }

  // 1. Verificăm idempotent dacă există deja o factură emisă pentru această rezervare
  const { data: existingInvoice, error: existingErr } = await supabase
    .from("invoices")
    .select("*")
    .eq("booking_id", bookingId)
    .maybeSingle();

  if (existingErr) {
    if (isMissingMigration007Error(existingErr)) {
      return errorResponse(MIGRATION_MISSING_MESSAGE);
    }
    return errorResponse(
      `Eroare la verificarea facturii existente: ${existingErr.message}`
    );
  }

  if (existingInvoice) {
    return successResponse(
      `Factura ${existingInvoice.invoice_number} a fost deja emisă pentru această rezervare.`,
      normalizeInvoiceRow(existingInvoice)
    );
  }

  // 2. Încărcăm rezervarea și validăm drepturile proprietarului
  const { data: booking, error: bookingErr } = await supabase
    .from("bookings")
    .select(
      "id, booking_code, renter_id, owner_id, total_price_ron, platform_fee_ron, status"
    )
    .eq("id", bookingId)
    .maybeSingle();

  if (bookingErr || !booking) {
    return errorResponse("Rezervarea nu a fost găsită în baza de date.");
  }

  if (booking.owner_id !== user.id) {
    return errorResponse(
      "Doar proprietarul obiectului poate emite factura de comision pentru această rezervare."
    );
  }

  // 3. Încărcăm plata aferentă (opțional) și datele fiscale ale proprietarului
  const [paymentRes, ownerProfileRes, ownerPrivateRes] = await Promise.all([
    supabase
      .from("payments")
      .select("id, platform_fee_ron, payment_status")
      .eq("booking_id", booking.id)
      .maybeSingle(),
    supabase
      .from("profiles")
      .select("display_name, city, company_name, company_address")
      .eq("id", booking.owner_id)
      .maybeSingle(),
    supabase
      .from("profile_private")
      .select("company_cui")
      .eq("id", booking.owner_id)
      .maybeSingle(),
  ]);

  const paymentRow = !paymentRes.error ? paymentRes.data : null;
  const ownerProfile = !ownerProfileRes.error ? ownerProfileRes.data : null;
  const ownerPrivate = !ownerPrivateRes.error ? ownerPrivateRes.data : null;

  // 4. Determinăm valoarea brută a comisionului (TVA inclus)
  const rawCommission =
    paymentRow?.platform_fee_ron !== undefined &&
    paymentRow?.platform_fee_ron !== null
      ? Number(paymentRow.platform_fee_ron)
      : booking.platform_fee_ron !== undefined &&
          booking.platform_fee_ron !== null
        ? Number(booking.platform_fee_ron)
        : Math.round(Number(booking.total_price_ron ?? 0) * 0.1 * 100) / 100;

  const issuer = getIssuerConfig();
  const vat = calculateVatBreakdown(rawCommission, issuer.vatRate);

  const clientName =
    ownerProfile?.company_name?.trim() ||
    ownerProfile?.display_name?.trim() ||
    "Proprietar RentA";
  const clientCui = ownerPrivate?.company_cui?.trim() || null;
  const clientAddress =
    ownerProfile?.company_address?.trim() ||
    ownerProfile?.city?.trim() ||
    "România";

  // Firmele cu CUI intră automat în fluxul de raportare RO e-Factura (`pending_anaf`)
  const efacturaStatus: EFacturaStatus = clientCui
    ? "pending_anaf"
    : "not_applicable";

  const { data: insertedInvoice, error: insertErr } = await supabase
    .from("invoices")
    .insert({
      booking_id: booking.id,
      payment_id: paymentRow?.id ?? null,
      owner_id: booking.owner_id,
      renter_id: booking.renter_id,
      issuer_name: issuer.name,
      issuer_cui: issuer.cui,
      client_name: clientName,
      client_cui: clientCui,
      client_address: clientAddress,
      subtotal_ron: vat.subtotal_ron,
      vat_rate: vat.vat_rate,
      vat_amount_ron: vat.vat_amount_ron,
      total_ron: vat.total_ron,
      currency: "RON",
      provider: issuer.provider,
      efactura_status: efacturaStatus,
    })
    .select("*")
    .single();

  if (insertErr || !insertedInvoice) {
    if (isMissingMigration007Error(insertErr)) {
      return errorResponse(MIGRATION_MISSING_MESSAGE);
    }
    // În caz de race-condition pe `UNIQUE (booking_id)` (SQLSTATE 23505), recitim factura existentă
    if (insertErr?.code === "23505") {
      const { data: racedInvoice } = await supabase
        .from("invoices")
        .select("*")
        .eq("booking_id", booking.id)
        .maybeSingle();
      if (racedInvoice) {
        return successResponse(
          `Factura ${racedInvoice.invoice_number} a fost deja emisă.`,
          normalizeInvoiceRow(racedInvoice)
        );
      }
    }
    return errorResponse(
      `Nu am putut emite factura de comision: ${
        insertErr?.message ?? "Răspuns gol de la baza de date"
      }`
    );
  }

  revalidatePath("/profil/facturi");
  revalidatePath("/profil/plati");
  revalidatePath("/rezervarile-mele");

  const normalized = normalizeInvoiceRow(insertedInvoice);
  return successResponse(
    `Factura fiscală ${normalized.invoice_number} în valoare de ${normalized.total_ron.toFixed(2)} RON a fost emisă cu succes.`,
    normalized
  );
}

/**
 * 4. LISTARE FACTURI PROPRII (`getMyInvoicesAction`)
 *
 * Întoarce toate facturile vizibile utilizatorului autentificat (ca `owner_id`
 * sau `renter_id`), ordonate descrescător după `issued_at`.
 * Dacă migrația 007 nu a fost rulată încă, întoarce `{ invoices: [], migrationMissing: true }`.
 */
export async function getMyInvoicesAction(): Promise<{
  invoices: InvoiceRecord[];
  migrationMissing?: boolean;
}> {
  const { isConfigured } = getSupabaseEnv();
  if (!isConfigured) {
    return { invoices: [] };
  }

  const supabase = await createClient();
  if (!supabase) {
    return { invoices: [] };
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { invoices: [] };
  }

  const { data, error } = await supabase
    .from("invoices")
    .select("*")
    .or(`owner_id.eq.${user.id},renter_id.eq.${user.id}`)
    .order("issued_at", { ascending: false });

  if (error) {
    if (isMissingMigration007Error(error)) {
      return { invoices: [], migrationMissing: true };
    }
    return { invoices: [] };
  }

  const invoices = Array.isArray(data) ? data.map(normalizeInvoiceRow) : [];
  return { invoices };
}

/**
 * 5. CITIRE O SINGURĂ FACTURĂ DUPĂ ID (`getInvoiceByIdAction`)
 *
 * Politica RLS `invoices_select_participants` garantează că doar proprietarul
 * sau chiriașul rezervării pot accesa factura.
 */
export async function getInvoiceByIdAction(
  invoiceId: string
): Promise<InvoiceRecord | null> {
  if (!invoiceId || !invoiceId.trim()) {
    return null;
  }

  const { isConfigured } = getSupabaseEnv();
  if (!isConfigured) {
    return null;
  }

  const supabase = await createClient();
  if (!supabase) {
    return null;
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  const { data, error } = await supabase
    .from("invoices")
    .select("*")
    .eq("id", invoiceId)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return normalizeInvoiceRow(data);
}
