"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signInAction } from "@/app/actions/auth";

/**
 * Pagina de Autentificare (`/login`) — Client Component.
 * Trimite credențialele către Server Action-ul `signInAction` și redirecționează
 * utilizatorul către fișa sa de profil (`/profil`).
 */
export default function LoginPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setErrorMsg(null);

    const formData = new FormData(event.currentTarget);

    try {
      const result = await signInAction(formData);

      if (result && "error" in result && result.error) {
        setErrorMsg(result.error);
      } else {
        router.push("/profil");
        router.refresh();
      }
    } catch {
      // Dacă signInAction apelează redirect(), Next.js navighează automat
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-md mx-auto px-4 sm:px-6 py-14">
      <div className="catalog-card p-6 sm:p-8 space-y-6">
        <div className="border-b border-ink/20 pb-4 space-y-1">
          <div className="flex items-center justify-between font-mono text-xs text-ochre font-bold">
            <span>ACCES CATALOG // #AUTH-02</span>
            <span>SESIUNE SSR</span>
          </div>
          <h1 className="font-display text-2xl font-extrabold text-ink">
            Autentificare Membru
          </h1>
          <p className="text-xs text-ink-muted">
            Introdu emailul și parola pentru a accesa inventarul și rezervările.
          </p>
        </div>

        {errorMsg && (
          <div className="p-3.5 border border-red-800/50 bg-red-900/10 text-xs font-mono text-red-950">
            [EROARE AUTENTIFICARE]: {errorMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label
              htmlFor="email"
              className="block font-mono text-xs uppercase text-ink font-semibold"
            >
              Adresă Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              placeholder="nume@exemplu.ro"
              className="catalog-input"
            />
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="password"
              className="block font-mono text-xs uppercase text-ink font-semibold"
            >
              Parolă
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              placeholder="••••••••"
              className="catalog-input"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="catalog-btn-primary w-full py-3 mt-2"
          >
            {loading ? "Se verifică sesiunea..." : "Intră în Cont"}
          </button>
        </form>

        <div className="pt-4 border-t border-ink/15 flex items-center justify-between text-xs font-mono">
          <span className="text-ink-muted">Nu ai încă fișă de membru?</span>
          <Link
            href="/inregistrare"
            className="text-ink font-bold underline underline-offset-4 hover:text-ochre"
          >
            Creează cont &rarr;
          </Link>
        </div>
      </div>
    </div>
  );
}
