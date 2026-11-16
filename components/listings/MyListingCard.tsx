"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  toggleListingStatusAction,
  deleteListingAction,
} from "@/app/actions/listings";
import { getCategoryLabel } from "@/lib/constants/categories";

/**
 * Interfața unui anunț (Listing) afișat în inventarul proprietarului.
 */
export interface MyListingItem {
  id: string;
  catalog_code: string | null;
  title: string;
  description: string;
  category: string;
  price_per_day: number;
  price_per_hour: number | null;
  deposit_ron?: number;
  min_rental_days?: number;
  city: string;
  status: "available" | "unavailable" | "archived" | string;
  created_at: string;
  images?: {
    id: string;
    url?: string;
    image_url?: string;
    display_order: number;
  }[];
  listing_images?: {
    id: string;
    url?: string;
    image_url?: string;
    display_order: number;
  }[];
}

export function MyListingCard({ item }: { item: MyListingItem }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [infoMsg, setInfoMsg] = useState<string | null>(null);

  const isAvailable = item.status === "available";
  const isArchived = item.status === "archived";
  const rawImageList = item.images || item.listing_images || [];
  const sortedImages = [...rawImageList].sort(
    (a, b) => (a.display_order ?? 0) - (b.display_order ?? 0)
  );
  const coverImage =
    sortedImages[0]?.url || sortedImages[0]?.image_url || null;
  const catalogCode =
    item.catalog_code || `#OBJ-${item.id.slice(0, 4).toUpperCase()}`;

  async function handleToggleStatus() {
    setBusy(true);
    setErrorMsg(null);
    setInfoMsg(null);
    const nextStatus = isAvailable ? "unavailable" : "available";

    try {
      const res = await toggleListingStatusAction(item.id, nextStatus);
      if (res && !res.success) {
        setErrorMsg(res.error || "Nu s-a putut actualiza statusul.");
      } else {
        router.refresh();
      }
    } catch {
      setErrorMsg("Nu s-a putut schimba statusul obiectului.");
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete() {
    setBusy(true);
    setErrorMsg(null);
    setInfoMsg(null);

    try {
      const res = await deleteListingAction(item.id);
      if (res && !res.success) {
        setErrorMsg(res.error || "Eroare la ștergere.");
        setBusy(false);
      } else {
        if (res?.data?.mode === "archived") {
          setInfoMsg(res.message || "Obiectul a fost arhivat automat.");
          setConfirmDelete(false);
          setBusy(false);
        }
        router.refresh();
      }
    } catch {
      setErrorMsg("Eroare la ștergerea obiectului din inventar.");
      setBusy(false);
    }
  }

  return (
    <article className="catalog-card flex flex-col justify-between overflow-hidden">
      <div>
        {/* Bara tehnică superioară: Cod Catalog + Badge Status */}
        <div className="px-4 py-2.5 border-b border-ink/20 bg-cream-dark/50 flex items-center justify-between gap-2 font-mono text-xs">
          <Link
            href={`/obiect/${item.id}`}
            className="font-bold text-ink hover:text-ochre underline underline-offset-4"
          >
            {catalogCode}
          </Link>
          <span
            className={`px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider border ${
              isAvailable
                ? "bg-emerald-900/10 border-emerald-800 text-emerald-900"
                : isArchived
                ? "bg-ink text-cream border-ink"
                : "bg-cream border-ink/30 text-ink-muted"
            }`}
          >
            {isAvailable
              ? "● DISPONIBIL"
              : isArchived
              ? "▪ ARHIVAT"
              : "○ INDISPONIBIL"}
          </span>
        </div>

        {/* Imaginea Obiectului sau Schiță Tehnică Placeholder */}
        <div className="relative h-48 w-full bg-cream border-b border-ink/20 overflow-hidden flex items-center justify-center">
          {coverImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={coverImage}
              alt={item.title}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="text-center p-4 space-y-1 font-mono text-xs text-ink-muted">
              <div className="border border-dashed border-ink/30 px-3 py-2 inline-block">
                [FĂRĂ FOTOGRAFIE // {catalogCode}]
              </div>
              <p className="text-[10px]">Fișă tehnică fără imagine atașată</p>
            </div>
          )}

          <span className="absolute bottom-2 left-2 bg-ink/90 text-cream font-mono text-[10px] uppercase px-2 py-0.5">
            {getCategoryLabel(item.category)}
          </span>
        </div>

        {/* Corpul Fișei: Titlu, Locație, Descriere scurtă și Preț */}
        <div className="p-4 space-y-2.5">
          <div className="flex items-center justify-between font-mono text-[11px] text-ink-muted uppercase">
            <span>
              LOCAȚIE: <strong className="text-ink">{item.city}</strong>
            </span>
            {item.deposit_ron && Number(item.deposit_ron) > 0 ? (
              <span>
                GARANȚIE:{" "}
                <strong className="text-ink">
                  {Number(item.deposit_ron).toFixed(0)} RON
                </strong>
              </span>
            ) : null}
          </div>

          <h3 className="font-display text-lg font-bold text-ink leading-snug line-clamp-2">
            {item.title}
          </h3>

          <p className="text-xs text-ink-muted line-clamp-2 leading-relaxed">
            {item.description}
          </p>

          {/* Caseta de Tarifare */}
          <div className="pt-2 border-t border-ink/15 flex items-baseline justify-between font-mono">
            <div>
              <span className="text-lg font-bold text-ink">
                {Number(item.price_per_day).toFixed(0)} RON
              </span>
              <span className="text-xs text-ink-muted"> / zi</span>
            </div>

            {item.price_per_hour && (
              <div className="text-xs text-ochre font-bold">
                {Number(item.price_per_hour).toFixed(0)} RON / oră
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Subsolul Fișei: Acțiuni Rapide CRUD (Editează, Comută Status, Șterge/Arhivează) */}
      <div className="p-4 pt-0 space-y-2">
        {errorMsg && (
          <div className="p-2 border border-red-800/40 bg-red-900/10 font-mono text-[11px] text-red-950">
            {errorMsg}
          </div>
        )}
        {infoMsg && (
          <div className="p-2 border border-ochre bg-ochre-light font-mono text-[11px] text-ink">
            {infoMsg}
          </div>
        )}

        <div className="pt-3 border-t border-ink/15 flex flex-wrap items-center justify-between gap-2">
          <Link
            href={`/listarile-mele/${item.id}/editeaza`}
            className="catalog-btn-secondary py-1.5 px-3 text-[11px]"
          >
            Editează
          </Link>

          <button
            type="button"
            disabled={busy}
            onClick={handleToggleStatus}
            className="catalog-btn-secondary flex-1 py-1.5 text-[11px]"
          >
            {busy
              ? "Se aplică..."
              : isAvailable
              ? "Pauză (Indisponibil)"
              : "Activează"}
          </button>

          {!confirmDelete ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => setConfirmDelete(true)}
              className="px-2.5 py-1.5 border border-ink/30 hover:border-red-800 hover:bg-red-900/10 hover:text-red-900 font-mono text-[11px] uppercase transition-colors"
            >
              Șterge
            </button>
          ) : (
            <div className="flex items-center gap-1">
              <button
                type="button"
                disabled={busy}
                onClick={handleDelete}
                className="px-2.5 py-1.5 bg-red-800 text-cream-light font-mono text-[11px] uppercase"
              >
                Confirmă
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => setConfirmDelete(false)}
                className="px-2 py-1.5 border border-ink/30 font-mono text-[11px]"
              >
                Nu
              </button>
            </div>
          )}
        </div>
      </div>
    </article>
  );
}
