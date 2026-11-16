/**
 * ============================================================================
 * RentA (Valul 1 Comercial) — Rate Limiter Sliding-Window In-Memory
 * (`lib/security/rate-limit.ts`)
 * ============================================================================
 *
 * Analogie pentru dezvoltatori C / Java:
 * - În Java (Spring Boot / Resilience4j / Bucket4j), folosești un `ConcurrentHashMap<String, Deque<Long>>`
 *   pentru a limita numărul de apeluri pe minut de la același utilizator/IP.
 * - În Node.js (care rulează pe un singur fir de execuție — Event Loop), un `Map<string, number[]>`
 *   este nativ thread-safe între operații sincrone.
 * - Acest utilitar protejează Server Actions critice (autentificare, creare anunț,
 *   trimitere cerere de rezervare, adăugare recenzie) împotriva abuzului / spam-ului.
 */

interface RateLimitEntry {
  timestamps: number[];
}

const store = new Map<string, RateLimitEntry>();
let lastCleanupMs = Date.now();
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000; // Curățare memorie la fiecare 5 minute

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

/**
 * Verifică și înregistrează o acțiune în fereastra de timp `[now - windowMs, now]`.
 *
 * @param key Identificator unic al acțiunii și apelantului (ex: `booking:create:${userId}`)
 * @param limit Numărul maxim de apeluri permise în fereastra de timp
 * @param windowMs Durata ferestrei în milisecunde (ex: 60_000 pt. 1 minut)
 */
export function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number
): RateLimitResult {
  const now = Date.now();

  // Curățare periodică a cheilor expirate pentru a preveni creșterea memoriei (Memory Leak prevention)
  if (now - lastCleanupMs > CLEANUP_INTERVAL_MS) {
    lastCleanupMs = now;
    for (const [k, v] of store.entries()) {
      const active = v.timestamps.filter((t) => now - t < windowMs);
      if (active.length === 0) {
        store.delete(k);
      } else {
        v.timestamps = active;
      }
    }
  }

  const existing = store.get(key);
  const windowStart = now - windowMs;
  const activeTimestamps = existing
    ? existing.timestamps.filter((t) => t > windowStart)
    : [];

  if (activeTimestamps.length >= limit) {
    const oldestInWindow = activeTimestamps[0] ?? now;
    const retryAfterSeconds = Math.max(
      1,
      Math.ceil((oldestInWindow + windowMs - now) / 1000)
    );
    store.set(key, { timestamps: activeTimestamps });
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds,
    };
  }

  activeTimestamps.push(now);
  store.set(key, { timestamps: activeTimestamps });

  return {
    allowed: true,
    remaining: Math.max(0, limit - activeTimestamps.length),
    retryAfterSeconds: 0,
  };
}
