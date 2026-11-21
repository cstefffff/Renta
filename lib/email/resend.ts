/**
 * ============================================================================
 * RentA (Faza 13 / M13.2) — Client Email Tranzacțional Mod Dual (Resend / Sandbox)
 * (`lib/email/resend.ts`)
 * ============================================================================
 *
 * Analogie pentru dezvoltatori C / Java:
 * - Funcționează după același Strategy Pattern folosit la Stripe (`lib/stripe/config.ts`):
 *     1. Modul `"resend"`: când variabila de mediu `RESEND_API_KEY` este configurată,
 *        trimite emailuri HTML reale prin API-ul REST Resend (`https://api.resend.com/emails`).
 *     2. Modul `"sandbox"`: când `RESEND_API_KEY` lipsește, NU blochează fluxul și
 *        returnează `{ sent: false, mode: "sandbox" }`, notificările rămânând
 *        100% funcționale în aplicație (In-App Notification Center).
 * - Folosim `fetch` nativ (zero dependențe npm externe) cu timeout de 5 secunde
 *   și protecție strictă `try/catch` astfel încât o eroare de rețea să nu poată
 *   întrerupe niciodată o rezervare sau o plată.
 */

export type EmailMode = "resend" | "sandbox";

export interface TransactionalEmailParams {
  to: string;
  subject: string;
  heading: string;
  body: string;
  ctaLabel?: string;
  ctaUrl?: string;
}

export interface TransactionalEmailResult {
  sent: boolean;
  mode: EmailMode;
  id?: string;
}

/**
 * Verifică dacă cheia API Resend este configurată în mediul de server.
 */
export function isResendConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY?.trim());
}

/**
 * Returnează modul curent de livrare emailuri (`"resend"` sau `"sandbox"`).
 */
export function getEmailMode(): EmailMode {
  return isResendConfigured() ? "resend" : "sandbox";
}

/**
 * Escapează caracterele HTML speciale pentru a preveni injectarea de cod HTML
 * în conținutul emailurilor tranzacționale.
 */
function escapeHtml(raw: string): string {
  return raw
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Rezolvă un URL relativ (ex: `/rezervarile-mele`) într-un URL absolut
 * folosind `NEXT_PUBLIC_SITE_URL`.
 */
function resolveAbsoluteUrl(url: string): string {
  const trimmed = url.trim();
  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }
  const baseUrl = (
    process.env.NEXT_PUBLIC_SITE_URL?.trim() || "http://localhost:3000"
  ).replace(/\/+$/, "");
  const path = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
  return `${baseUrl}${path}`;
}

/**
 * Construiește template-ul HTML responsive pentru emailurile RentA Store
 * (fond alb curat + accent Emerald Teal `#109E82`).
 */
function buildTransactionalEmailHtml(params: {
  heading: string;
  body: string;
  ctaLabel?: string;
  ctaUrl?: string;
}): string {
  const safeHeading = escapeHtml(params.heading);
  const safeBody = escapeHtml(params.body).replace(/\n/g, "<br />");

  const ctaSection =
    params.ctaLabel && params.ctaUrl
      ? `
        <tr>
          <td style="padding: 8px 32px 28px 32px;">
            <a
              href="${escapeHtml(resolveAbsoluteUrl(params.ctaUrl))}"
              style="display: inline-block; background-color: #109E82; color: #FFFFFF; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 14px; font-weight: 600; text-decoration: none; padding: 12px 24px; border-radius: 8px;"
            >
              ${escapeHtml(params.ctaLabel)}
            </a>
          </td>
        </tr>
      `
      : "";

  return `<!DOCTYPE html>
<html lang="ro">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${safeHeading}</title>
  </head>
  <body style="margin: 0; padding: 0; background-color: #F4F6F8; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #111827;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #F4F6F8; padding: 32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width: 580px; background-color: #FFFFFF; border-radius: 12px; overflow: hidden; border: 1px solid #E5E7EB;">
            <!-- Antet RentA Store -->
            <tr>
              <td style="background-color: #109E82; padding: 20px 32px;">
                <span style="font-size: 18px; font-weight: 700; letter-spacing: -0.02em; color: #FFFFFF;">
                  RentA Store
                </span>
                <span style="display: block; font-size: 12px; color: #D1FAE5; margin-top: 2px;">
                  Notificare tranzacțională securizată
                </span>
              </td>
            </tr>
            <!-- Conținut principal -->
            <tr>
              <td style="padding: 28px 32px 16px 32px;">
                <h1 style="margin: 0 0 12px 0; font-size: 20px; line-height: 1.35; font-weight: 700; color: #111827;">
                  ${safeHeading}
                </h1>
                <p style="margin: 0; font-size: 15px; line-height: 1.6; color: #374151;">
                  ${safeBody}
                </p>
              </td>
            </tr>
            ${ctaSection}
            <!-- Subsol -->
            <tr>
              <td style="padding: 18px 32px; background-color: #F9FAFB; border-top: 1px solid #E5E7EB;">
                <p style="margin: 0; font-size: 12px; line-height: 1.5; color: #6B7280;">
                  Ai primit acest mesaj automat deoarece ești participant într-o activitate pe platforma RentA Store.
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

/**
 * Trimite un email tranzacțional prin Resend API (dacă este configurat) sau
 * rulează în mod Sandbox fără a arunca niciodată excepții care să blocheze
 * operația principală.
 */
export async function sendTransactionalEmail(
  params: TransactionalEmailParams
): Promise<TransactionalEmailResult> {
  const mode = getEmailMode();
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const recipient = (params.to ?? "").trim();

  if (!apiKey || !recipient || !recipient.includes("@")) {
    return { sent: false, mode };
  }

  const from =
    process.env.RESEND_FROM_EMAIL?.trim() ||
    "RentA Store <onboarding@resend.dev>";

  const html = buildTransactionalEmailHtml({
    heading: params.heading,
    body: params.body,
    ctaLabel: params.ctaLabel,
    ctaUrl: params.ctaUrl,
  });

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [recipient],
        subject: params.subject,
        html,
      }),
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) {
      return { sent: false, mode: "resend" };
    }

    const payload = (await response.json()) as { id?: string };
    return {
      sent: true,
      mode: "resend",
      id: typeof payload?.id === "string" ? payload.id : undefined,
    };
  } catch {
    // Eroare de rețea sau timeout Resend: nu oprim niciodată fluxul principal
    return { sent: false, mode: "resend" };
  }
}
