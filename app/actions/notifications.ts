"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getSupabaseEnv } from "@/lib/supabase/config";
import {
  getEmailMode,
  isResendConfigured,
  sendTransactionalEmail,
} from "@/lib/email/resend";
import type {
  ActionResponse,
  NotificationRecord,
  NotificationType,
} from "@/lib/types/database";

/**
 * ============================================================================
 * RentA (Faza 13 / M13.2) — Server Actions pentru Notificări & Emailuri
 * (`app/actions/notifications.ts`)
 * ============================================================================
 *
 * Explicație pentru dezvoltatori C / Java:
 * - Acest fișier este echivalentul unui `NotificationService` din Spring Boot.
 * - `dispatchNotification(...)` implementează un model "fire-and-safe" (non-blocant):
 *   trimite opțional emailul tranzacțional prin Resend (dacă `RESEND_API_KEY`
 *   este prezentă) și salvează notificarea în `public.notifications` prin RPC-ul
 *   `SECURITY DEFINER` `create_system_notification`.
 * - Întreaga logică din `dispatchNotification` este izolată într-un bloc
 *   `try / catch` silențios, astfel încât o eroare (de ex. migrația 006 nerulată
 *   încă sau un timeout de rețea Resend) să NU oprească niciodată fluxurile
 *   critice (rezervări, plăți Escrow, dispute, recenzii).
 */

const MIGRATION_006_MISSING_MESSAGE =
  "Tabelul de notificări nu a fost creat încă în Supabase. Rulează fișierul supabase/migrations/006_notifications_and_emails.sql în Supabase SQL Editor și reîncearcă.";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const VALID_NOTIFICATION_TYPES = new Set<NotificationType>([
  "booking_created",
  "booking_confirmed",
  "booking_rejected",
  "booking_completed",
  "booking_cancelled",
  "payment_paid",
  "payment_released",
  "dispute_opened",
  "review_received",
  "system",
]);

function errorResponse<T = null>(message: string): ActionResponse<T> {
  return {
    success: false,
    ok: false,
    error: message,
    message,
  };
}

function successResponse<T = null>(
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
 * Detectează erorile PostgREST / PostgreSQL care indică lipsa tabelului sau
 * funcției din migrația 006 (`42P01`, `42883`, `PGRST202`, `PGRST205`).
 */
function isMissingNotificationMigrationError(
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
 * Normalizează un rând brut din `public.notifications` la DTO-ul `NotificationRecord`.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normalizeNotificationRow(row: any): NotificationRecord {
  const rawType = String(row.type ?? "system") as NotificationType;
  const type: NotificationType = VALID_NOTIFICATION_TYPES.has(rawType)
    ? rawType
    : "system";

  return {
    id: String(row.id),
    user_id: String(row.user_id),
    type,
    title: String(row.title ?? ""),
    body: String(row.body ?? ""),
    action_url: row.action_url ? String(row.action_url) : null,
    booking_id: row.booking_id ? String(row.booking_id) : null,
    is_read: Boolean(row.is_read),
    email_sent: Boolean(row.email_sent),
    created_at: String(row.created_at),
  };
}

/**
 * 1. DISPATCH NOTIFICARE IN-APP + EMAIL TRANZACȚIONAL (`dispatchNotification`)
 *
 * Apelează non-blocant Resend (dacă `recipientEmail` este oferit și cheia API
 * este configurată), apoi apelează RPC-ul `public.create_system_notification`
 * în `try/catch` silențios. Nu aruncă niciodată excepții către apelant.
 */
export async function dispatchNotification(params: {
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  actionUrl?: string | null;
  bookingId?: string | null;
  recipientEmail?: string | null;
}): Promise<void> {
  try {
    if (!params.userId || !UUID_REGEX.test(params.userId)) {
      return;
    }

    const { isConfigured } = getSupabaseEnv();
    if (!isConfigured) {
      return;
    }

    const supabase = await createClient();
    if (!supabase) {
      return;
    }

    let emailSent = false;
    const recipientEmail = params.recipientEmail?.trim();

    if (recipientEmail && isResendConfigured()) {
      const emailResult = await sendTransactionalEmail({
        to: recipientEmail,
        subject: `RentA Store — ${params.title}`,
        heading: params.title,
        body: params.body,
        ctaLabel: params.actionUrl ? "Vezi detalii în RentA" : undefined,
        ctaUrl: params.actionUrl ?? undefined,
      });
      emailSent = emailResult.sent;
    }

    await supabase.rpc("create_system_notification", {
      p_user_id: params.userId,
      p_type: params.type,
      p_title: params.title,
      p_body: params.body,
      p_action_url: params.actionUrl ?? null,
      p_booking_id: params.bookingId ?? null,
      p_email_sent: emailSent,
    });
  } catch {
    // Eșec silențios intenționat: notificările nu au voie să blocheze
    // fluxurile de business (ex. dacă migrația 006 nu a fost rulată încă).
  }
}

/**
 * 2. LISTARE NOTIFICĂRI PROPRII + CONTOR NECITITE (`getMyNotificationsAction`)
 */
export async function getMyNotificationsAction(limit = 30): Promise<{
  notifications: NotificationRecord[];
  unreadCount: number;
  migrationMissing?: boolean;
  emailMode: "resend" | "sandbox";
}> {
  const emailMode = getEmailMode();
  const { isConfigured } = getSupabaseEnv();

  if (!isConfigured) {
    return { notifications: [], unreadCount: 0, emailMode };
  }

  const supabase = await createClient();
  if (!supabase) {
    return { notifications: [], unreadCount: 0, emailMode };
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { notifications: [], unreadCount: 0, emailMode };
  }

  const safeLimit = Math.min(Math.max(Math.trunc(limit) || 30, 1), 100);

  const [listRes, unreadRes] = await Promise.all([
    supabase
      .from("notifications")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(safeLimit),
    supabase
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("is_read", false),
  ]);

  if (listRes.error || unreadRes.error) {
    if (
      isMissingNotificationMigrationError(listRes.error) ||
      isMissingNotificationMigrationError(unreadRes.error)
    ) {
      return {
        notifications: [],
        unreadCount: 0,
        migrationMissing: true,
        emailMode,
      };
    }
    return { notifications: [], unreadCount: 0, emailMode };
  }

  const notifications = Array.isArray(listRes.data)
    ? listRes.data.map(normalizeNotificationRow)
    : [];
  const unreadCount = Number(unreadRes.count ?? 0);

  return {
    notifications,
    unreadCount,
    emailMode,
  };
}

/**
 * 3. MARCARE NOTIFICARE INDIVIDUALĂ CA CITITĂ (`markNotificationReadAction`)
 */
export async function markNotificationReadAction(
  notificationId: string
): Promise<ActionResponse<null>> {
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
      "Trebuie să fii autentificat pentru a actualiza notificările."
    );
  }

  if (!notificationId || !UUID_REGEX.test(notificationId)) {
    return errorResponse("Identificatorul notificării nu este valid.");
  }

  const { error } = await supabase
    .from("notifications")
    .update({ is_read: true })
    .eq("id", notificationId)
    .eq("user_id", user.id);

  if (error) {
    if (isMissingNotificationMigrationError(error)) {
      return errorResponse(MIGRATION_006_MISSING_MESSAGE);
    }
    return errorResponse(
      `Nu am putut marca notificarea ca citită: ${error.message}`
    );
  }

  revalidatePath("/notificari");
  return successResponse("Notificarea a fost marcată ca citită.", null);
}

/**
 * 4. MARCARE TUTUROR NOTIFICĂRILOR CA CITITE (`markAllNotificationsReadAction`)
 */
export async function markAllNotificationsReadAction(): Promise<
  ActionResponse<null>
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
      "Trebuie să fii autentificat pentru a actualiza notificările."
    );
  }

  const { error } = await supabase
    .from("notifications")
    .update({ is_read: true })
    .eq("user_id", user.id)
    .eq("is_read", false);

  if (error) {
    if (isMissingNotificationMigrationError(error)) {
      return errorResponse(MIGRATION_006_MISSING_MESSAGE);
    }
    return errorResponse(
      `Nu am putut marca notificările ca citite: ${error.message}`
    );
  }

  revalidatePath("/notificari");
  return successResponse("Toate notificările au fost marcate ca citite.", null);
}
