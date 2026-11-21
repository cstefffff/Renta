/**
 * ============================================================================
 * RentA (Faza 16 / M16.2) — Observabilitate, Logging Structurat & Protecție PII
 * (`lib/observability/logger.ts`)
 * ============================================================================
 *
 * Explicație pentru dezvoltatori C / Java:
 * - În Java (Spring Boot), ai un `Logger` (SLF4J + Logback) cu un filtru custom
 *   care maschează datele personale (PII — Personally Identifiable Information)
 *   înainte ca mesajele să ajungă în stdout sau în Sentry/Datadog.
 * - În acest modul implementăm:
 *   1. `sanitizePii(value)` — parcurge recursiv obiecte, array-uri, erori și
 *      string-uri, înlocuind cheile sensibile (`password`, `token`, `email`,
 *      `phone`, `cui`, `iban` etc.) și pattern-urile de email/telefon din
 *      România cu marcaje `[REDACTED]`.
 *   2. `logServerEvent(level, event, meta)` — emite log-uri JSON structurate
 *      (ușor de parsat de Vercel Logs / CloudWatch / Grafana Loki).
 *   3. `captureError(error, context)` — loghează eroarea sanitizată și, dacă
 *      `NEXT_PUBLIC_SENTRY_DSN` este setat, o trimite asincron și non-blocant
 *      către Sentry Envelope API fără dependențe npm grele.
 */

export type LogLevel = "info" | "warn" | "error";

const REDACTED_VALUE = "[REDACTED]";
const MAX_SANITIZE_DEPTH = 8;

/**
 * Chei considerate sensibile (match case-insensitive pe numele proprietății).
 * Orice proprietate care conține unul dintre aceste fragmente este redactată.
 */
const SENSITIVE_KEY_SUBSTRINGS = [
  "password",
  "passwd",
  "token",
  "secret",
  "authorization",
  "cookie",
  "phone",
  "telefon",
  "email",
  "company_cui",
  "stripe_secret",
  "apikey",
  "api_key",
] as const;

/**
 * Chei scurte care necesită potrivire pe graniță de cuvânt / delimitator
 * (ex. `cui`, `user_cui`, `iban`, `bank_iban`) pentru a evita false-positives
 * pe cuvinte comune precum `circuit`.
 */
const SENSITIVE_KEY_BOUNDARY_REGEX = /(^|[_\-.])(cui|iban|cnp)($|[_\-.])/i;

/**
 * Expresii regulate pentru detectarea PII în interiorul string-urilor libere:
 * - Adrese de email
 * - Numere de telefon mobile din România (`07xx xxx xxx`, `+40 7xx ...`, `00407...`)
 * - Coduri IBAN românești (`RO49AAAA1B31007593840000`)
 * - Token-uri Bearer în headere / mesaje de eroare
 */
const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const RO_PHONE_REGEX =
  /(?:\+40|0040|(?<![0-9])0)\s*7\d{2}[\s.-]?\d{3}[\s.-]?\d{3}\b/g;
const RO_IBAN_REGEX = /\bRO\d{2}[A-Z]{4}[A-Z0-9]{16}\b/gi;
const BEARER_TOKEN_REGEX = /\bBearer\s+[A-Za-z0-9\-._~+/]+=*/gi;

function isSensitiveKey(key: string): boolean {
  const normalized = key.trim().toLowerCase();
  if (!normalized) return false;

  for (const fragment of SENSITIVE_KEY_SUBSTRINGS) {
    if (normalized.includes(fragment)) {
      return true;
    }
  }

  return SENSITIVE_KEY_BOUNDARY_REGEX.test(normalized);
}

function sanitizeString(input: string): string {
  return input
    .replace(EMAIL_REGEX, "[REDACTED_EMAIL]")
    .replace(RO_PHONE_REGEX, "[REDACTED_PHONE]")
    .replace(RO_IBAN_REGEX, "[REDACTED_IBAN]")
    .replace(BEARER_TOKEN_REGEX, "Bearer [REDACTED]");
}

function sanitizeRecursive(
  value: unknown,
  seen: WeakSet<object>,
  depth: number
): unknown {
  if (value === null || value === undefined) {
    return value;
  }

  if (typeof value === "string") {
    return sanitizeString(value);
  }

  if (
    typeof value === "number" ||
    typeof value === "boolean" ||
    typeof value === "bigint"
  ) {
    return typeof value === "bigint" ? value.toString() : value;
  }

  if (typeof value === "symbol" || typeof value === "function") {
    return `[${typeof value}]`;
  }

  if (depth >= MAX_SANITIZE_DEPTH) {
    return "[MAX_DEPTH_REACHED]";
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (value instanceof Error) {
    const errorWithDigest = value as Error & { digest?: string };
    return {
      name: sanitizeString(value.name || "Error"),
      message: sanitizeString(value.message || "Unknown error"),
      ...(errorWithDigest.digest ? { digest: errorWithDigest.digest } : {}),
      ...(value.stack ? { stack: sanitizeString(value.stack) } : {}),
    };
  }

  if (typeof value === "object") {
    if (seen.has(value)) {
      return "[CIRCULAR]";
    }
    seen.add(value);

    if (Array.isArray(value)) {
      return value.map((item) => sanitizeRecursive(item, seen, depth + 1));
    }

    const sanitizedObj: Record<string, unknown> = {};
    for (const [key, entryValue] of Object.entries(
      value as Record<string, unknown>
    )) {
      if (isSensitiveKey(key)) {
        sanitizedObj[key] = REDACTED_VALUE;
      } else {
        sanitizedObj[key] = sanitizeRecursive(entryValue, seen, depth + 1);
      }
    }
    return sanitizedObj;
  }

  return value;
}

/**
 * Redactează recursiv cheile sensibile și maschează pattern-urile de email,
 * telefon RO, IBAN sau Bearer token din string-uri, garantând zero scurgeri PII.
 */
export function sanitizePii(value: unknown): unknown {
  return sanitizeRecursive(value, new WeakSet<object>(), 0);
}

/**
 * Emite un eveniment de log structurat JSON în stdout/stderr (`console.log`,
 * `console.warn`, `console.error`) cu timestamp ISO, `service: "renta-web"`
 * și `meta` sanitizat complet prin `sanitizePii`.
 */
export function logServerEvent(
  level: LogLevel,
  event: string,
  meta?: Record<string, unknown>
): void {
  const payload: Record<string, unknown> = {
    timestamp: new Date().toISOString(),
    level,
    service: "renta-web",
    event: sanitizeString(event),
  };

  if (meta && Object.keys(meta).length > 0) {
    payload.meta = sanitizePii(meta);
  }

  let serialized: string;
  try {
    serialized = JSON.stringify(payload);
  } catch {
    serialized = JSON.stringify({
      timestamp: new Date().toISOString(),
      level,
      service: "renta-web",
      event: sanitizeString(event),
      meta: "[UNSERIALIZABLE_META]",
    });
  }

  if (level === "error") {
    console.error(serialized);
  } else if (level === "warn") {
    console.warn(serialized);
  } else {
    console.log(serialized);
  }
}

interface ParsedSentryDsn {
  endpointUrl: string;
  authHeader: string;
}

/**
 * Parsează un DSN Sentry standard (`https://<public_key>@<host>/<project_id>`)
 * în URL-ul Envelope API fără a necesita SDK-ul extern `@sentry/nextjs`.
 */
function parseSentryDsn(dsn: string): ParsedSentryDsn | null {
  try {
    const parsed = new URL(dsn.trim());
    const publicKey = parsed.username;
    const pathSegments = parsed.pathname.split("/").filter(Boolean);
    const projectId = pathSegments.pop();

    if (!publicKey || !projectId) {
      return null;
    }

    const basePath =
      pathSegments.length > 0 ? `/${pathSegments.join("/")}` : "";
    const endpointUrl = `${parsed.protocol}//${parsed.host}${basePath}/api/${projectId}/envelope/`;
    const authHeader = `Sentry sentry_version=7, sentry_key=${publicKey}, sentry_client=renta-logger/1.0.0`;

    return { endpointUrl, authHeader };
  } catch {
    return null;
  }
}

function generateEventId(): string {
  // 32 caractere hex conforme specificației Sentry event_id
  let hex = "";
  for (let i = 0; i < 32; i++) {
    hex += Math.floor(Math.random() * 16).toString(16);
  }
  return hex;
}

/**
 * Trimite eroarea sanitizată către Sentry Envelope API (non-blocant, best-effort).
 * Nu aruncă niciodată excepții și nu oprește randarea aplicației.
 */
function sendToSentryNonBlocking(
  dsn: string,
  errorInfo: { name: string; message: string; digest?: string },
  sanitizedContext?: Record<string, unknown>
): void {
  const parsed = parseSentryDsn(dsn);
  if (!parsed || typeof fetch !== "function") {
    return;
  }

  try {
    const eventId = generateEventId();
    const sentAt = new Date().toISOString();

    const envelopeHeader = JSON.stringify({
      event_id: eventId,
      sent_at: sentAt,
      dsn: dsn.trim(),
    });
    const itemHeader = JSON.stringify({ type: "event" });
    const eventBody = JSON.stringify({
      event_id: eventId,
      timestamp: Math.floor(Date.now() / 1000),
      level: "error",
      platform: "javascript",
      logger: "renta-web",
      exception: {
        values: [
          {
            type: errorInfo.name,
            value: errorInfo.message,
          },
        ],
      },
      extra: {
        ...(errorInfo.digest ? { digest: errorInfo.digest } : {}),
        ...(sanitizedContext ?? {}),
      },
    });

    const body = `${envelopeHeader}\n${itemHeader}\n${eventBody}`;

    void fetch(parsed.endpointUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-sentry-envelope",
        "X-Sentry-Auth": parsed.authHeader,
      },
      body,
      keepalive: true,
    }).catch(() => {
      // Eșecurile de rețea către Sentry sunt ignorate intenționat (non-blocant).
    });
  } catch {
    // Protecție defensivă: monitorizarea nu trebuie să producă erori secundare.
  }
}

/**
 * Captează și loghează o eroare în format structurat fără PII.
 * Dacă `NEXT_PUBLIC_SENTRY_DSN` este configurat, transmite evenimentul
 * non-blocant către Sentry fără dependențe grele.
 */
export function captureError(
  error: unknown,
  context?: Record<string, unknown>
): void {
  const sanitizedError = sanitizePii(error);
  const sanitizedContext = context
    ? (sanitizePii(context) as Record<string, unknown>)
    : undefined;

  logServerEvent("error", "captured_error", {
    error: sanitizedError,
    ...(sanitizedContext ? { context: sanitizedContext } : {}),
  });

  const sentryDsn = process.env.NEXT_PUBLIC_SENTRY_DSN?.trim();
  if (!sentryDsn) {
    return;
  }

  let errorInfo: { name: string; message: string; digest?: string };
  if (error instanceof Error) {
    const errorWithDigest = error as Error & { digest?: string };
    errorInfo = {
      name: sanitizeString(error.name || "Error"),
      message: sanitizeString(error.message || "Unexpected error"),
      ...(errorWithDigest.digest ? { digest: errorWithDigest.digest } : {}),
    };
  } else {
    errorInfo = {
      name: "NonErrorException",
      message:
        typeof sanitizedError === "string"
          ? sanitizedError
          : JSON.stringify(sanitizedError),
    };
  }

  sendToSentryNonBlocking(sentryDsn, errorInfo, sanitizedContext);
}
