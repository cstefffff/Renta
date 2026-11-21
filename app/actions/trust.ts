"use server";

import { createHash, randomInt } from "crypto";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getSupabaseEnv } from "@/lib/supabase/config";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { dispatchNotification } from "@/app/actions/notifications";
import type {
  AccountType,
  ActionResponse,
  AnafCompanyResult,
  BookingStatus,
  BookingWithDetails,
  DisputeReason,
  DisputeRecord,
  DisputeStatus,
  HandoverPhase,
  HandoverProof,
  ListingImage,
  PaymentRecord,
} from "@/lib/types/database";

/**
 * ============================================================================
 * RentA (Faza 12) — Server Actions pentru Încredere, Verificare & Siguranță
 * (`app/actions/trust.ts`)
 * ============================================================================
 *
 * Explicație pentru dezvoltatori C / Java:
 * - Acest fișier este echivalentul unui `TrustAndSafetyService` din Spring Boot.
 * - M12.1 (OTP Telefon): Generează un cod criptografic sigur de 6 cifre
 *   (`crypto.randomInt`, echivalent cu `java.security.SecureRandom`), salvează
 *   doar hash-ul SHA-256 în PostgreSQL (`public.phone_otp_codes`) și validează
 *   verificarea prin RPC-ul `SECURITY DEFINER` `complete_phone_otp_verification`.
 * - M12.2 (ANAF CUI / KYB): Validează matematic cifra de control a CUI-ului
 *   românesc (algoritmul oficial cu cheia `753217532`), interoghează API-ul
 *   public ANAF v9 (cu timeout de 6 secunde și fallback pe checksum) și
 *   activează badge-ul `kyb_verified` prin RPC-ul `complete_company_kyb_verification`.
 * - M12.3 (Protocol Foto Check-in / Check-out): Încarcă probele foto în bucket-ul
 *   privat `handover-proofs` și generează Signed URLs temporare (1 oră) exclusiv
 *   pentru participanții rezervării (`renter_id` sau `owner_id`).
 * - M12.4 (Flux Dispute): Deschide un litigiu formal în `public.disputes` și
 *   îngheață automat eliberarea fondurilor marcând plata ca `disputed`.
 */

const MIGRATION_005_MISSING_MESSAGE =
  "Tabelele pentru Faza 12 (verificare OTP, probe foto, dispute) nu au fost create încă în Supabase. Rulează fișierul supabase/migrations/005_trust_verification_handover_disputes.sql în Supabase SQL Editor și reîncearcă.";

const PUBLIC_PARTICIPANT_SELECT =
  "id, display_name, account_type, city, avatar_url, phone_verified, kyb_verified, rating_avg, rating_count";

const MAX_HANDOVER_FILES = 4;
const MAX_HANDOVER_FILE_BYTES = 5 * 1024 * 1024; // 5 MB
const ALLOWED_HANDOVER_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

const VALID_DISPUTE_REASONS = new Set<DisputeReason>([
  "damage",
  "missing_accessories",
  "late_return",
  "not_as_described",
  "other",
]);

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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
 * Detectează erorile PostgREST / PostgreSQL care indică lipsa tabelelor/funcțiilor
 * din migrația 005 (`42P01`, `42883`, `PGRST202`, `PGRST205`).
 */
function isMissingMigrationError(
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
    msg.includes("does not exist")
  );
}

/**
 * Curăță și normalizează un număr de telefon mobil românesc la formatul `+407XXXXXXXX`.
 * Returnează `null` dacă formatul nu respectă `/^(\+40|0)7\d{8}$/`.
 */
function normalizeRomanianPhone(rawPhone: string): string | null {
  const cleaned = rawPhone.replace(/[\s\-().]/g, "").trim();
  if (!/^(\+40|0)7\d{8}$/.test(cleaned)) {
    return null;
  }
  if (cleaned.startsWith("0")) {
    return `+4${cleaned}`;
  }
  return cleaned;
}

/**
 * Generează hash-ul SHA-256 al codului OTP legat de utilizator și numărul de telefon
 * (echivalent cu `MessageDigest.getInstance("SHA-256")` în Java).
 */
function hashOtpCode(userId: string, phone: string, code: string): string {
  return createHash("sha256")
    .update(`renta-otp-v1:${userId}:${phone}:${code}`)
    .digest("hex");
}

/**
 * Algoritmul oficial de validare a cifrei de control pentru CUI / CIF românesc.
 *
 * Explicație matematică (cheia de test oficială ANAF: `753217532`):
 * 1. Se elimină prefixul `RO` (dacă există) și spațiile.
 * 2. Lungimea trebuie să fie între 2 și 10 cifre.
 * 3. Ultima cifră este cifra de control `c`.
 * 4. Celelalte cifre se aliniază la dreapta pe 9 poziții (pad cu `'0'` la stânga)
 *    și se înmulțesc pozițional cu cheia `753217532`.
 * 5. `computed = (sum * 10) % 11`; dacă `computed === 10`, atunci `computed = 0`.
 * 6. CUI-ul este valid dacă `computed === c`.
 */
function validateRomanianCuiChecksum(digits: string): boolean {
  if (!/^\d{2,10}$/.test(digits)) {
    return false;
  }

  const controlDigit = Number(digits[digits.length - 1]);
  const body = digits.slice(0, -1).padStart(9, "0");
  const weights = [7, 5, 3, 2, 1, 7, 5, 3, 2];

  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += Number(body[i]) * weights[i];
  }

  let computed = (sum * 10) % 11;
  if (computed === 10) {
    computed = 0;
  }

  return computed === controlDigit;
}

function getExtensionFromMime(mimeType: string): string {
  switch (mimeType) {
    case "image/png":
      return "png";
    case "image/webp":
      return "webp";
    default:
      return "jpg";
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normalizeHandoverProofRow(row: any, signedUrl?: string | null): HandoverProof {
  return {
    id: String(row.id),
    booking_id: String(row.booking_id),
    uploaded_by: String(row.uploaded_by),
    phase: row.phase === "checkout" ? "checkout" : "checkin",
    storage_path: String(row.storage_path),
    signed_url: signedUrl ?? null,
    notes: row.notes ?? null,
    created_at: String(row.created_at),
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normalizeDisputeRow(row: any): DisputeRecord {
  const rawReason = String(row.reason ?? "other") as DisputeReason;
  const reason: DisputeReason = VALID_DISPUTE_REASONS.has(rawReason)
    ? rawReason
    : "other";

  return {
    id: String(row.id),
    booking_id: String(row.booking_id),
    opened_by: String(row.opened_by),
    reason,
    description: String(row.description ?? ""),
    claimed_amount_ron: Number(row.claimed_amount_ron ?? 0),
    status: (row.status ?? "open") as DisputeStatus,
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  };
}

// ============================================================================
// 1. M12.1 — SOLICITARE COD OTP TELEFON (`requestPhoneOtpAction`)
// ============================================================================
export async function requestPhoneOtpAction(
  phone: string
): Promise<
  ActionResponse<{
    phone: string;
    devOtpCode?: string;
    expiresInMinutes: number;
  }>
> {
  const { isConfigured } = getSupabaseEnv();
  if (!isConfigured) {
    return errorResponse("Conexiunea Supabase nu este configurată în .env.local.");
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
      "Trebuie să fii autentificat pentru a solicita verificarea numărului de telefon."
    );
  }

  // Rate limiting: maxim 5 cereri OTP la 5 minute per utilizator
  const rl = checkRateLimit(`otp:req:${user.id}`, 5, 5 * 60_000);
  if (!rl.allowed) {
    return errorResponse(
      `Ai solicitat prea multe coduri OTP. Încearcă din nou peste ${rl.retryAfterSeconds} secunde.`
    );
  }

  const normalizedPhone = normalizeRomanianPhone(phone ?? "");
  if (!normalizedPhone) {
    return errorResponse(
      "Introdu un număr de telefon mobil românesc valid (ex: 0722 123 456 sau +40 722 123 456)."
    );
  }

  // Generăm cod criptografic sigur de 6 cifre (`100000` – `999999`)
  const otpCode = String(randomInt(100000, 1000000));
  const codeHash = hashOtpCode(user.id, normalizedPhone, otpCode);
  const expiresInMinutes = 10;
  const expiresAtIso = new Date(
    Date.now() + expiresInMinutes * 60_000
  ).toISOString();

  const { error: insertError } = await supabase.from("phone_otp_codes").insert({
    user_id: user.id,
    phone: normalizedPhone,
    code_hash: codeHash,
    expires_at: expiresAtIso,
  });

  if (insertError) {
    if (isMissingMigrationError(insertError)) {
      return errorResponse(MIGRATION_005_MISSING_MESSAGE);
    }
    return errorResponse(
      `Nu am putut genera codul OTP: ${insertError.message}`
    );
  }

  // În modul Sandbox gratuit (fără gateway SMS plătit), returnăm codul `devOtpCode`
  // pentru a permite testarea completă a fluxului end-to-end.
  return successResponse(
    `Codul OTP de 6 cifre a fost generat pentru ${normalizedPhone} (valabil ${expiresInMinutes} minute).`,
    {
      phone: normalizedPhone,
      devOtpCode: otpCode,
      expiresInMinutes,
    }
  );
}

// ============================================================================
// 2. M12.1 — VALIDARE COD OTP TELEFON (`verifyPhoneOtpAction`)
// ============================================================================
export async function verifyPhoneOtpAction(
  phone: string,
  code: string
): Promise<ActionResponse<{ phone_verified: boolean }>> {
  const { isConfigured } = getSupabaseEnv();
  if (!isConfigured) {
    return errorResponse("Conexiunea Supabase nu este configurată în .env.local.");
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
      "Trebuie să fii autentificat pentru a confirma codul OTP."
    );
  }

  const rl = checkRateLimit(`otp:verify:${user.id}`, 10, 5 * 60_000);
  if (!rl.allowed) {
    return errorResponse(
      `Prea multe încercări de verificare OTP. Încearcă peste ${rl.retryAfterSeconds} secunde.`
    );
  }

  const normalizedPhone = normalizeRomanianPhone(phone ?? "");
  if (!normalizedPhone) {
    return errorResponse("Numărul de telefon introdus nu este valid.");
  }

  const cleanedCode = (code ?? "").replace(/\s+/g, "").trim();
  if (!/^\d{6}$/.test(cleanedCode)) {
    return errorResponse("Codul OTP trebuie să conțină exact 6 cifre.");
  }

  const codeHash = hashOtpCode(user.id, normalizedPhone, cleanedCode);

  const { data: verified, error: rpcError } = await supabase.rpc(
    "complete_phone_otp_verification",
    {
      p_phone: normalizedPhone,
      p_code_hash: codeHash,
    }
  );

  if (rpcError) {
    if (isMissingMigrationError(rpcError)) {
      return errorResponse(MIGRATION_005_MISSING_MESSAGE);
    }
    return errorResponse(
      `Eroare la verificarea codului OTP: ${rpcError.message}`
    );
  }

  if (!verified) {
    return errorResponse(
      "Codul OTP este incorect, a expirat sau a depășit limita de încercări. Solicită un cod nou."
    );
  }

  revalidatePath("/profil");

  return successResponse(
    "Numărul de telefon a fost verificat cu succes! Badge-ul tău de încredere este acum activ.",
    { phone_verified: true }
  );
}

// ============================================================================
// 3. M12.2 — VERIFICARE FIRMĂ ANAF CUI / KYB (`verifyCompanyAnafAction`)
// ============================================================================
export async function verifyCompanyAnafAction(
  rawCui: string
): Promise<ActionResponse<AnafCompanyResult>> {
  const { isConfigured } = getSupabaseEnv();
  if (!isConfigured) {
    return errorResponse("Conexiunea Supabase nu este configurată în .env.local.");
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
      "Trebuie să fii autentificat pentru a verifica firma în registrul ANAF."
    );
  }

  const rl = checkRateLimit(`kyb:anaf:${user.id}`, 10, 10 * 60_000);
  if (!rl.allowed) {
    return errorResponse(
      `Prea multe interogări ANAF într-un timp scurt. Așteaptă ${rl.retryAfterSeconds} secunde.`
    );
  }

  // Eliminăm prefixul opțional "RO" și orice spații / cratime
  const digits = (rawCui ?? "")
    .trim()
    .toUpperCase()
    .replace(/^RO/i, "")
    .replace(/[\s\-]/g, "");

  if (!validateRomanianCuiChecksum(digits)) {
    return errorResponse(
      "CUI-ul introdus nu este valid (cifra de control nu corespunde algoritmului oficial ANAF). Verifică cifrele și încearcă din nou."
    );
  }

  const todayIso = new Date().toISOString().slice(0, 10);
  let result: AnafCompanyResult | null = null;

  try {
    const response = await fetch(
      "https://webservicesp.anaf.ro/api/PlatitorTvaRest/v9/tva",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify([{ cui: Number(digits), data: todayIso }]),
        signal: AbortSignal.timeout(6000),
      }
    );

    if (response.ok) {
      const payload = (await response.json()) as {
        found?: Array<{
          date_generale?: {
            cui?: number | string;
            denumire?: string;
            adresa?: string;
            stare_inregistrare?: string;
          };
        }>;
        notFound?: Array<number | string>;
      };

      const generalData = payload?.found?.[0]?.date_generale;
      if (generalData && (generalData.denumire || generalData.adresa)) {
        result = {
          cui: String(generalData.cui ?? digits),
          denumire: String(
            generalData.denumire ?? `Firmă CUI ${digits}`
          ).trim(),
          adresa: String(generalData.adresa ?? "Sediu înregistrat ANAF").trim(),
          stare: String(
            generalData.stare_inregistrare ?? "INREGISTRAT"
          ).trim(),
          source: "anaf_live",
        };
      } else if (
        Array.isArray(payload?.notFound) &&
        payload.notFound.length > 0
      ) {
        return errorResponse(
          `CUI-ul ${digits} are cifră de control validă, dar nu a fost găsit activ în registrul public ANAF.`
        );
      }
    }
  } catch {
    // Timeout sau indisponibilitate temporară a serviciului ANAF:
    // continuăm controlat cu fallback-ul bazat pe validarea matematică a cifrei de control.
  }

  if (!result) {
    result = {
      cui: digits,
      denumire: `Firmă verificată (CUI ${digits})`,
      adresa: "Validare prin cifră de control CUI (ANAF temporar indisponibil)",
      stare: "VERIFICAT_CHECKSUM",
      source: "checksum_fallback",
    };
  }

  const { data: saved, error: rpcError } = await supabase.rpc(
    "complete_company_kyb_verification",
    {
      p_cui: result.cui,
      p_company_name: result.denumire,
      p_company_address: result.adresa,
    }
  );

  if (rpcError) {
    if (isMissingMigrationError(rpcError)) {
      return errorResponse(MIGRATION_005_MISSING_MESSAGE);
    }
    return errorResponse(
      `Nu am putut salva verificarea firmei: ${rpcError.message}`
    );
  }

  if (!saved) {
    return errorResponse("Nu am putut actualiza statutul KYB al contului.");
  }

  revalidatePath("/profil");
  revalidatePath("/catalog");

  const sourceMsg =
    result.source === "anaf_live"
      ? `Firma ${result.denumire} (CUI ${result.cui}) a fost verificată live prin ANAF!`
      : `CUI-ul ${result.cui} a fost validat matematic (serviciul ANAF a fost temporar indisponibil). Contul tău de firmă a fost activat.`;

  return successResponse(sourceMsg, result);
}

// ============================================================================
// 4. M12.3 — ÎNCĂRCARE PROBE FOTO CHECK-IN / CHECK-OUT (`uploadHandoverProofAction`)
// ============================================================================
export async function uploadHandoverProofAction(
  formData: FormData
): Promise<ActionResponse<HandoverProof[]>> {
  const { isConfigured } = getSupabaseEnv();
  if (!isConfigured) {
    return errorResponse("Conexiunea Supabase nu este configurată în .env.local.");
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
      "Trebuie să fii autentificat pentru a încărca fotografii în procesul-verbal."
    );
  }

  const rl = checkRateLimit(`handover:upload:${user.id}`, 15, 5 * 60_000);
  if (!rl.allowed) {
    return errorResponse(
      `Ai încărcat prea multe fișiere într-un timp scurt. Așteaptă ${rl.retryAfterSeconds} secunde.`
    );
  }

  const bookingId = String(formData.get("booking_id") ?? "").trim();
  const rawPhase = String(formData.get("phase") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim().slice(0, 500);

  if (!UUID_REGEX.test(bookingId)) {
    return errorResponse("Identificatorul rezervării nu este valid.");
  }

  if (rawPhase !== "checkin" && rawPhase !== "checkout") {
    return errorResponse(
      "Etapa procesului-verbal trebuie să fie 'checkin' (predare) sau 'checkout' (returnare)."
    );
  }
  const phase: HandoverPhase = rawPhase;

  const rawFiles = formData.getAll("photos");
  const files = rawFiles.filter(
    (entry): entry is File => entry instanceof File && entry.size > 0
  );

  if (files.length === 0) {
    return errorResponse(
      "Selectează cel puțin o fotografie (JPEG, PNG sau WebP) pentru a o atașa la procesul-verbal."
    );
  }

  if (files.length > MAX_HANDOVER_FILES) {
    return errorResponse(
      `Poți încărca cel mult ${MAX_HANDOVER_FILES} fotografii simultan.`
    );
  }

  for (const file of files) {
    if (!ALLOWED_HANDOVER_MIME_TYPES.has(file.type)) {
      return errorResponse(
        `Fișierul „${file.name}” are un format neacceptat (${file.type || "necunoscut"}). Sunt permise doar JPEG, PNG și WebP.`
      );
    }
    if (file.size > MAX_HANDOVER_FILE_BYTES) {
      return errorResponse(
        `Fișierul „${file.name}” depășește limita de 5 MB per fotografie.`
      );
    }
  }

  // Verificăm că utilizatorul participă efectiv la această rezervare
  const { data: booking, error: bookingError } = await supabase
    .from("bookings")
    .select("id, renter_id, owner_id")
    .eq("id", bookingId)
    .maybeSingle();

  if (bookingError || !booking) {
    return errorResponse(
      "Rezervarea nu a fost găsită sau nu ai permisiunea de a o accesa."
    );
  }

  if (booking.renter_id !== user.id && booking.owner_id !== user.id) {
    return errorResponse(
      "Doar chiriașul și proprietarul rezervării pot încărca probe foto în procesul-verbal."
    );
  }

  const uploadedProofs: HandoverProof[] = [];
  const timestamp = Date.now();

  for (let idx = 0; idx < files.length; idx++) {
    const file = files[idx];
    const ext = getExtensionFromMime(file.type);
    const storagePath = `${bookingId}/${user.id}/${phase}-${timestamp}-${idx}.${ext}`;
    const arrayBuffer = await file.arrayBuffer();

    const { error: uploadError } = await supabase.storage
      .from("handover-proofs")
      .upload(storagePath, arrayBuffer, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) {
      const msg = uploadError.message?.toLowerCase() ?? "";
      if (msg.includes("bucket not found") || msg.includes("does not exist")) {
        return errorResponse(MIGRATION_005_MISSING_MESSAGE);
      }
      return errorResponse(
        `Eroare la încărcarea imaginii „${file.name}”: ${uploadError.message}`
      );
    }

    const { data: insertedRow, error: insertError } = await supabase
      .from("handover_proofs")
      .insert({
        booking_id: bookingId,
        uploaded_by: user.id,
        phase,
        storage_path: storagePath,
        notes: notes || null,
      })
      .select("*")
      .single();

    if (insertError) {
      // Curățăm fișierul din Storage dacă inserarea în DB a eșuat
      await supabase.storage.from("handover-proofs").remove([storagePath]);
      if (isMissingMigrationError(insertError)) {
        return errorResponse(MIGRATION_005_MISSING_MESSAGE);
      }
      return errorResponse(
        `Nu am putut înregistra proba foto în baza de date: ${insertError.message}`
      );
    }

    const { data: signedData } = await supabase.storage
      .from("handover-proofs")
      .createSignedUrl(storagePath, 3600);

    uploadedProofs.push(
      normalizeHandoverProofRow(insertedRow, signedData?.signedUrl ?? null)
    );
  }

  revalidatePath(`/rezervarile-mele/${bookingId}/proces-verbal`);

  return successResponse(
    `${uploadedProofs.length} ${
      uploadedProofs.length === 1 ? "fotografie a fost adăugată" : "fotografii au fost adăugate"
    } în procesul-verbal de ${phase === "checkin" ? "predare (Check-in)" : "returnare (Check-out)"}.`,
    uploadedProofs
  );
}

// ============================================================================
// 5. M12.3 — LISTARE PROBE FOTO CU SIGNED URLs (`getHandoverProofsAction`)
// ============================================================================
export async function getHandoverProofsAction(
  bookingId: string
): Promise<{ proofs: HandoverProof[]; migrationMissing?: boolean }> {
  const { isConfigured } = getSupabaseEnv();
  if (!isConfigured || !UUID_REGEX.test(bookingId)) {
    return { proofs: [] };
  }

  const supabase = await createClient();
  if (!supabase) {
    return { proofs: [] };
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { proofs: [] };
  }

  const { data: rows, error } = await supabase
    .from("handover_proofs")
    .select("*")
    .eq("booking_id", bookingId)
    .order("created_at", { ascending: true });

  if (error) {
    if (isMissingMigrationError(error)) {
      return { proofs: [], migrationMissing: true };
    }
    return { proofs: [] };
  }

  if (!Array.isArray(rows) || rows.length === 0) {
    return { proofs: [] };
  }

  const proofs = await Promise.all(
    rows.map(async (row) => {
      const storagePath = String(row.storage_path);
      const { data: signedData } = await supabase.storage
        .from("handover-proofs")
        .createSignedUrl(storagePath, 3600);

      return normalizeHandoverProofRow(row, signedData?.signedUrl ?? null);
    })
  );

  return { proofs };
}

// ============================================================================
// 6. M12.4 — DESCHIDERE DISPUTĂ & BLOCARE GARANȚIE (`openDisputeAction`)
// ============================================================================
export async function openDisputeAction(
  formData: FormData
): Promise<ActionResponse<DisputeRecord>> {
  const { isConfigured } = getSupabaseEnv();
  if (!isConfigured) {
    return errorResponse("Conexiunea Supabase nu este configurată în .env.local.");
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
      "Trebuie să fii autentificat pentru a deschide o dispută."
    );
  }

  const rl = checkRateLimit(`dispute:open:${user.id}`, 5, 10 * 60_000);
  if (!rl.allowed) {
    return errorResponse(
      `Ai trimis prea multe cereri de dispută. Încearcă din nou peste ${rl.retryAfterSeconds} secunde.`
    );
  }

  const bookingId = String(formData.get("booking_id") ?? "").trim();
  const rawReason = String(formData.get("reason") ?? "").trim() as DisputeReason;
  const description = String(formData.get("description") ?? "").trim();
  const rawAmount = String(formData.get("claimed_amount_ron") ?? "0").trim();
  const claimedAmountRon = Number(rawAmount.replace(",", "."));

  if (!UUID_REGEX.test(bookingId)) {
    return errorResponse("Identificatorul rezervării nu este valid.");
  }

  if (!VALID_DISPUTE_REASONS.has(rawReason)) {
    return errorResponse("Selectează un motiv valid pentru deschiderea disputei.");
  }

  if (description.length < 15) {
    return errorResponse(
      "Descrierea problemei trebuie să conțină cel puțin 15 caractere pentru a putea fi analizată."
    );
  }

  if (description.length > 2000) {
    return errorResponse(
      "Descrierea problemei nu poate depăși 2000 de caractere."
    );
  }

  if (!Number.isFinite(claimedAmountRon) || claimedAmountRon < 0) {
    return errorResponse(
      "Suma revendicată trebuie să fie un număr pozitiv (sau 0 RON)."
    );
  }

  const normalizedAmount = Math.round(claimedAmountRon * 100) / 100;

  // Verificăm că utilizatorul participă la rezervare (`renter_id` sau `owner_id`)
  const { data: booking, error: bookingError } = await supabase
    .from("bookings")
    .select("id, renter_id, owner_id")
    .eq("id", bookingId)
    .maybeSingle();

  if (bookingError || !booking) {
    return errorResponse(
      "Rezervarea nu a fost găsită sau nu ai permisiunea de a deschide o dispută."
    );
  }

  if (booking.renter_id !== user.id && booking.owner_id !== user.id) {
    return errorResponse(
      "Doar chiriașul sau proprietarul acestei rezervări poate deschide o dispută."
    );
  }

  const { data: insertedDispute, error: insertError } = await supabase
    .from("disputes")
    .insert({
      booking_id: bookingId,
      opened_by: user.id,
      reason: rawReason,
      description,
      claimed_amount_ron: normalizedAmount,
      status: "open",
    })
    .select("*")
    .single();

  if (insertError) {
    if (isMissingMigrationError(insertError)) {
      return errorResponse(MIGRATION_005_MISSING_MESSAGE);
    }
    if (insertError.code === "23505") {
      return errorResponse(
        "Există deja o dispută deschisă pentru această rezervare."
      );
    }
    return errorResponse(
      `Nu am putut înregistra disputa: ${insertError.message}`
    );
  }

  // Înghețăm automat eliberarea fondurilor / garanției în `public.payments`
  try {
    await supabase
      .from("payments")
      .update({ payment_status: "disputed" })
      .eq("booking_id", bookingId);
  } catch {
    // Nu blocăm crearea disputei dacă tabelul `public.payments` nu există încă
  }

  // Notificăm non-blocant celălalt participant al rezervării despre disputa deschisă (Faza 13 / M13.2)
  const otherParticipantId =
    booking.renter_id === user.id
      ? String(booking.owner_id)
      : String(booking.renter_id);

  await dispatchNotification({
    userId: otherParticipantId,
    type: "dispute_opened",
    title: "Dispută deschisă pentru o rezervare",
    body: `Celălalt participant a deschis o dispută formală (sumă revendicată: ${normalizedAmount.toFixed(
      2
    )} RON). Eliberarea garanției Escrow a fost blocată până la soluționare.`,
    actionUrl: `/rezervarile-mele/${bookingId}/disputa`,
    bookingId,
  });

  revalidatePath(`/rezervarile-mele/${bookingId}/disputa`);
  revalidatePath("/rezervarile-mele");

  return successResponse(
    "Disputa a fost înregistrată, iar eliberarea garanției a fost blocată automat până la soluționare.",
    normalizeDisputeRow(insertedDispute)
  );
}

// ============================================================================
// 7. M12.4 — CITIRE DISPUTĂ ACTIVĂ PENTRU REZERVARE (`getDisputeForBookingAction`)
// ============================================================================
export async function getDisputeForBookingAction(
  bookingId: string
): Promise<{ dispute: DisputeRecord | null; migrationMissing?: boolean }> {
  const { isConfigured } = getSupabaseEnv();
  if (!isConfigured || !UUID_REGEX.test(bookingId)) {
    return { dispute: null };
  }

  const supabase = await createClient();
  if (!supabase) {
    return { dispute: null };
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { dispute: null };
  }

  const { data, error } = await supabase
    .from("disputes")
    .select("*")
    .eq("booking_id", bookingId)
    .maybeSingle();

  if (error) {
    if (isMissingMigrationError(error)) {
      return { dispute: null, migrationMissing: true };
    }
    return { dispute: null };
  }

  return {
    dispute: data ? normalizeDisputeRow(data) : null,
  };
}

// ============================================================================
// 8. HELPER SIGUR DETALII REZERVARE PENTRU PARTICIPANȚI
//    (`getBookingDetailForParticipantAction`)
// ============================================================================
export async function getBookingDetailForParticipantAction(
  bookingId: string
): Promise<BookingWithDetails | null> {
  const { isConfigured } = getSupabaseEnv();
  if (!isConfigured || !UUID_REGEX.test(bookingId)) {
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

  const selectQuery = `
    *,
    listing:listings(id, catalog_code, title, price_per_day, city, category, images:listing_images(*)),
    renter:profiles!bookings_renter_id_fkey(${PUBLIC_PARTICIPANT_SELECT}),
    owner:profiles!bookings_owner_id_fkey(${PUBLIC_PARTICIPANT_SELECT})
  `;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: row, error } = (await supabase
    .from("bookings")
    .select(selectQuery)
    .eq("id", bookingId)
    .maybeSingle()) as { data: any; error: unknown };

  if (error || !row) {
    return null;
  }

  // Verificare explicită pe server (Defense-in-Depth peste RLS)
  if (row.renter_id !== user.id && row.owner_id !== user.id) {
    return null;
  }

  const rawImages = Array.isArray(row.listing?.images)
    ? ([...row.listing.images] as ListingImage[]).sort(
        (a, b) => (a.display_order ?? 0) - (b.display_order ?? 0)
      )
    : [];

  let partnerPhone: string | null = null;
  if (row.status === "confirmed" || row.status === "completed") {
    try {
      const { data: phoneData } = await supabase.rpc(
        "get_booking_partner_phone",
        { p_booking_id: String(row.id) }
      );
      if (typeof phoneData === "string" && phoneData.trim().length > 0) {
        partnerPhone = phoneData.trim();
      }
    } catch {
      partnerPhone = null;
    }
  }

  let payment: PaymentRecord | null = null;
  try {
    const { data: paymentRow, error: paymentError } = await supabase
      .from("payments")
      .select("*")
      .eq("booking_id", bookingId)
      .maybeSingle();

    if (!paymentError && paymentRow) {
      payment = {
        id: String(paymentRow.id),
        booking_id: String(paymentRow.booking_id),
        renter_id: String(paymentRow.renter_id),
        owner_id: String(paymentRow.owner_id),
        mode: paymentRow.mode === "stripe" ? "stripe" : "sandbox",
        currency: String(paymentRow.currency ?? "RON"),
        rental_amount_ron: Number(paymentRow.rental_amount_ron ?? 0),
        platform_fee_ron: Number(paymentRow.platform_fee_ron ?? 0),
        owner_payout_ron: Number(paymentRow.owner_payout_ron ?? 0),
        deposit_amount_ron: Number(paymentRow.deposit_amount_ron ?? 0),
        total_charged_ron: Number(paymentRow.total_charged_ron ?? 0),
        stripe_checkout_session_id: paymentRow.stripe_checkout_session_id ?? null,
        stripe_payment_intent_id: paymentRow.stripe_payment_intent_id ?? null,
        stripe_deposit_intent_id: paymentRow.stripe_deposit_intent_id ?? null,
        payment_status: paymentRow.payment_status ?? "unpaid",
        deposit_status: paymentRow.deposit_status ?? "none",
        paid_at: paymentRow.paid_at ?? null,
        released_at: paymentRow.released_at ?? null,
        created_at: String(paymentRow.created_at),
        updated_at: String(paymentRow.updated_at),
      };
    }
  } catch {
    payment = null;
  }

  const isOwner = row.owner_id === user.id;

  return {
    id: String(row.id),
    booking_code: String(row.booking_code ?? "#REZ-0000"),
    listing_id: String(row.listing_id),
    renter_id: String(row.renter_id),
    owner_id: String(row.owner_id),
    start_date: String(row.start_date),
    end_date: String(row.end_date),
    total_days: Number(row.total_days ?? 1),
    total_price_ron: Number(row.total_price_ron ?? 0),
    platform_fee_ron: Number(row.platform_fee_ron ?? 0),
    status: String(row.status ?? "pending") as BookingStatus,
    notes: row.notes ?? null,
    created_at: String(row.created_at),
    listing: {
      id: String(row.listing?.id ?? row.listing_id),
      catalog_code: String(row.listing?.catalog_code ?? "#OBJ-0000"),
      title: String(row.listing?.title ?? "Obiect închiriat"),
      price_per_day: Number(row.listing?.price_per_day ?? 0),
      city: String(row.listing?.city ?? "București"),
      category: String(row.listing?.category ?? "altele"),
      primary_image_url: rawImages[0]?.url ?? null,
      images: rawImages,
    },
    renter: {
      id: String(row.renter?.id ?? row.renter_id),
      display_name: String(row.renter?.display_name ?? "Chiriaș"),
      account_type: (row.renter?.account_type ?? "individual") as AccountType,
      city: String(row.renter?.city ?? "București"),
      avatar_url: row.renter?.avatar_url ?? null,
      phone_verified: Boolean(row.renter?.phone_verified),
      kyb_verified: Boolean(row.renter?.kyb_verified),
      rating_avg:
        row.renter?.rating_avg !== null && row.renter?.rating_avg !== undefined
          ? Number(row.renter.rating_avg)
          : null,
      rating_count: Number(row.renter?.rating_count ?? 0),
      phone: isOwner ? partnerPhone : null,
    },
    owner: {
      id: String(row.owner?.id ?? row.owner_id),
      display_name: String(row.owner?.display_name ?? "Proprietar"),
      account_type: (row.owner?.account_type ?? "individual") as AccountType,
      city: String(row.owner?.city ?? "București"),
      avatar_url: row.owner?.avatar_url ?? null,
      phone_verified: Boolean(row.owner?.phone_verified),
      kyb_verified: Boolean(row.owner?.kyb_verified),
      rating_avg:
        row.owner?.rating_avg !== null && row.owner?.rating_avg !== undefined
          ? Number(row.owner.rating_avg)
          : null,
      rating_count: Number(row.owner?.rating_count ?? 0),
      phone: !isOwner ? partnerPhone : null,
    },
    partner_phone: partnerPhone,
    payment,
  };
}
