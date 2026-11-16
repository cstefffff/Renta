import type { NextConfig } from "next";

/**
 * ============================================================================
 * RentA (Valul 1 Comercial) — Configurare Next.js & Headere HTTP de Securitate
 * ============================================================================
 *
 * Analogie pentru dezvoltatori C / Java:
 * - În Spring Security (Java), configurezi headerele de protecție prin
 *   `http.headers(headers -> headers.frameOptions(FrameOptionsConfig::deny)...)`.
 * - În Next.js, metoda `async headers()` aplică aceste antete HTTP la nivel de
 *   server/edge pentru toate răspunsurile (`/(.*)`), protejând aplicația împotriva
 *   atacurilor de tip Clickjacking (`X-Frame-Options: DENY`), MIME-sniffing
 *   (`X-Content-Type-Options: nosniff`) și downgrade HTTPS (`Strict-Transport-Security`).
 */
const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**.supabase.co",
      },
    ],
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "X-Frame-Options",
            value: "DENY",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
          {
            key: "Strict-Transport-Security",
            value: "max-age=31536000; includeSubDomains",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
