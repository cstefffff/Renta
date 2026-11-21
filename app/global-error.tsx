"use client";

import { useEffect } from "react";
import { captureError } from "@/lib/observability/logger";

/**
 * Boundary Global de Eroare (`app/global-error.tsx`) — Client Component de rezervă
 * pentru erorile critice apărute chiar în `app/layout.tsx` (RootLayout).
 *
 * Explicație pentru C/Java:
 * - În Next.js App Router, când RootLayout aruncă o excepție, paginile nu mai au
 *   tag-urile `<html>` și `<body>`. De aceea `global-error.tsx` trebuie să definească
 *   propria structură completă `<html><body>...</body></html>` și stiluri autonome
 *   (pentru cazul în care fișierul CSS global nu s-a putut încărca).
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    captureError(error, {
      boundary: "global-error",
      digest: error.digest,
    });
  }, [error]);

  return (
    <html lang="ro">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "24px",
          backgroundColor: "#F5EEDD",
          color: "#211D18",
          fontFamily:
            'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        }}
      >
        <main
          style={{
            maxWidth: "560px",
            width: "100%",
            backgroundColor: "#FFFDF8",
            border: "2px solid #211D18",
            boxShadow: "4px 4px 0px #211D18",
            padding: "32px 28px",
            textAlign: "center",
          }}
        >
          <div
            style={{
              display: "inline-block",
              fontFamily: "monospace",
              fontSize: "12px",
              fontWeight: 700,
              textTransform: "uppercase",
              padding: "4px 10px",
              border: "1px solid #991B1B",
              backgroundColor: "rgba(153, 27, 27, 0.08)",
              color: "#7F1D1D",
              marginBottom: "16px",
            }}
          >
            [EROARE CRITICĂ SISTEM // #ROOT-ERR]
          </div>

          <h1
            style={{
              fontSize: "24px",
              fontWeight: 800,
              margin: "0 0 12px 0",
              lineHeight: 1.25,
            }}
          >
            Aplicația RentA a întâmpinat o eroare neașteptată
          </h1>

          <p
            style={{
              fontSize: "14px",
              color: "#574E44",
              margin: "0 0 16px 0",
              lineHeight: 1.5,
            }}
          >
            Incidentul a fost înregistrat fără date personale. Încearcă să
            reîncarci pagina sau revino pe prima pagină.
          </p>

          {error?.digest && (
            <p
              style={{
                fontFamily: "monospace",
                fontSize: "12px",
                color: "#574E44",
                margin: "0 0 20px 0",
              }}
            >
              Cod referință: {error.digest}
            </p>
          )}

          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "12px",
              justifyContent: "center",
              marginTop: "20px",
            }}
          >
            <button
              type="button"
              onClick={() => reset()}
              style={{
                cursor: "pointer",
                padding: "10px 18px",
                fontWeight: 700,
                fontSize: "14px",
                backgroundColor: "#C17F2C",
                color: "#FFFDF8",
                border: "2px solid #211D18",
              }}
            >
              Încearcă din nou
            </button>
            <a
              href="/"
              style={{
                display: "inline-block",
                textDecoration: "none",
                padding: "10px 18px",
                fontWeight: 700,
                fontSize: "14px",
                backgroundColor: "#F5EEDD",
                color: "#211D18",
                border: "2px solid #211D18",
              }}
            >
              Înapoi Acasă
            </a>
          </div>
        </main>
      </body>
    </html>
  );
}
