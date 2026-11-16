"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LISTING_CATEGORIES } from "@/lib/constants/categories";
import { RENTA_CITIES, type ListingWithDetails } from "@/lib/types/database";
import {
  createListingAction,
  updateListingAction,
} from "@/app/actions/listings";

/**
 * Formularul Unificat de Creare / Editare Obiect în Inventar (`ListingForm.tsx`) — Client Component.
 *
 * Explicație pentru C/Java:
 * Această componentă suportă ambele moduri ale operațiilor CRUD (`mode = "create"` sau `mode = "edit"`).
 * - În modul `"create"`, trimite `FormData` către `createListingAction(formData)`.
 * - În modul `"edit"`, populează toate câmpurile cu valorile existente din `initialListing`,
 *   permite bifarea imaginilor existente pentru ștergere (`remove_image_ids`) și apelează
 *   `updateListingAction(initialListing.id, formData)`.
 */
interface ListingFormProps {
  defaultCity?: string;
  mode?: "create" | "edit";
  initialListing?: ListingWithDetails;
}

export function ListingForm({
  defaultCity = "București",
  mode = "create",
  initialListing,
}: ListingFormProps) {
  const router = useRouter();
  const isEdit = mode === "edit" && Boolean(initialListing);

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<string[]>([]);
  const [removedImageIds, setRemovedImageIds] = useState<string[]>([]);

  const existingImages = [...(initialListing?.images ?? [])].sort(
    (a, b) => (a.display_order ?? 0) - (b.display_order ?? 0)
  );

  function toggleRemoveImage(imgId: string) {
    setRemovedImageIds((prev) =>
      prev.includes(imgId)
        ? prev.filter((id) => id !== imgId)
        : [...prev, imgId]
    );
  }

  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const files = event.target.files;
    if (!files || files.length === 0) {
      setSelectedFiles([]);
      return;
    }
    const names = Array.from(files)
      .slice(0, 4)
      .map((f) => `${f.name} (${Math.round(f.size / 1024)} KB)`);
    setSelectedFiles(names);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setErrorMsg(null);

    const formData = new FormData(event.currentTarget);

    // În modul editare, atașăm ID-urile imaginilor selectate pentru ștergere
    if (isEdit) {
      formData.delete("remove_image_ids");
      for (const id of removedImageIds) {
        formData.append("remove_image_ids", id);
      }
    }

    try {
      const result =
        isEdit && initialListing
          ? await updateListingAction(initialListing.id, formData)
          : await createListingAction(formData);

      if (result && !result.success) {
        setErrorMsg(result.error || "Eroare la validarea formularului.");
      } else {
        router.push("/listarile-mele");
        router.refresh();
      }
    } catch {
      setErrorMsg("A apărut o eroare la salvarea obiectului în catalog.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {errorMsg && (
        <div className="p-4 border border-red-800/50 bg-red-900/10 text-xs font-mono text-red-950">
          [EROARE VALIDARE INVENTAR]: {errorMsg}
        </div>
      )}

      {/* 1. Titlu Obiect & Status (în modul Editare) */}
      <div className="grid grid-cols-1 sm:grid-cols-12 gap-4">
        <div className={isEdit ? "sm:col-span-8 space-y-1.5" : "sm:col-span-12 space-y-1.5"}>
          <label
            htmlFor="title"
            className="block font-mono text-xs uppercase text-ink font-semibold"
          >
            1. Denumire Obiect / Echipament *
          </label>
          <input
            id="title"
            name="title"
            type="text"
            required
            minLength={3}
            defaultValue={initialListing?.title ?? ""}
            placeholder="Ex: Ciocan rotopercutor Bosch Professional GBH 2-26"
            className="catalog-input"
          />
          <p className="text-[11px] text-ink-muted font-mono">
            Include marca și modelul pentru o identificare rapidă în catalog.
          </p>
        </div>

        {isEdit && (
          <div className="sm:col-span-4 space-y-1.5">
            <label
              htmlFor="status"
              className="block font-mono text-xs uppercase text-ink font-semibold"
            >
              Stare în Catalog *
            </label>
            <select
              id="status"
              name="status"
              defaultValue={initialListing?.status ?? "available"}
              className="catalog-input font-mono text-xs"
            >
              <option value="available">● DISPONIBIL (Activ)</option>
              <option value="unavailable">○ INDISPONIBIL (Pauză)</option>
              <option value="archived">▪ ARHIVAT (Ascuns)</option>
            </select>
          </div>
        )}
      </div>

      {/* 2. Categorie & Oraș */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <label
            htmlFor="category"
            className="block font-mono text-xs uppercase text-ink font-semibold"
          >
            2. Categorie Catalog *
          </label>
          <select
            id="category"
            name="category"
            required
            defaultValue={
              initialListing?.category ??
              LISTING_CATEGORIES[0]?.slug ??
              "scule-unelte"
            }
            className="catalog-input"
          >
            {LISTING_CATEGORIES.map((cat) => (
              <option key={cat.slug} value={cat.slug}>
                {cat.code} — {cat.label}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1.5">
          <label
            htmlFor="city"
            className="block font-mono text-xs uppercase text-ink font-semibold"
          >
            3. Oraș (Punct de Ridicare) *
          </label>
          <select
            id="city"
            name="city"
            required
            defaultValue={initialListing?.city ?? defaultCity}
            className="catalog-input"
          >
            {RENTA_CITIES.map((city) => (
              <option key={city} value={city}>
                {city}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* 3. Tarifare & Garanție Returnabilă */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-4 border border-ink/20 bg-cream">
        <div className="space-y-1.5">
          <label
            htmlFor="price_per_day"
            className="block font-mono text-xs uppercase text-ink font-semibold"
          >
            4. Tarif pe Zi (RON / Zi) *
          </label>
          <input
            id="price_per_day"
            name="price_per_day"
            type="number"
            min={1}
            step="1"
            required
            defaultValue={initialListing?.price_per_day ?? ""}
            placeholder="Ex: 65"
            className="catalog-input"
          />
        </div>

        <div className="space-y-1.5">
          <label
            htmlFor="price_per_hour"
            className="block font-mono text-xs uppercase text-ink font-semibold"
          >
            5. Tarif / Oră (Opțional)
          </label>
          <input
            id="price_per_hour"
            name="price_per_hour"
            type="number"
            min={1}
            step="1"
            defaultValue={initialListing?.price_per_hour ?? ""}
            placeholder="Ex: 15"
            className="catalog-input"
          />
        </div>

        <div className="space-y-1.5">
          <label
            htmlFor="deposit_ron"
            className="block font-mono text-xs uppercase text-ink font-semibold"
          >
            6. Garanție Returnabilă (RON)
          </label>
          <input
            id="deposit_ron"
            name="deposit_ron"
            type="number"
            min={0}
            step="10"
            defaultValue={initialListing?.deposit_ron ?? 0}
            placeholder="0 (fără garanție)"
            className="catalog-input"
          />
        </div>
      </div>

      {/* 4. Condiții Comerciale: Durată Minimă & Politică de Anulare */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 border border-ink/20 bg-cream">
        <div className="space-y-1.5">
          <label
            htmlFor="min_rental_days"
            className="block font-mono text-xs uppercase text-ink font-semibold"
          >
            7. Durată Minimă Închiriere (Zile) *
          </label>
          <input
            id="min_rental_days"
            name="min_rental_days"
            type="number"
            min={1}
            max={90}
            required
            defaultValue={initialListing?.min_rental_days ?? 1}
            className="catalog-input"
          />
        </div>

        <div className="space-y-1.5">
          <label
            htmlFor="cancellation_policy"
            className="block font-mono text-xs uppercase text-ink font-semibold"
          >
            8. Politică de Anulare *
          </label>
          <select
            id="cancellation_policy"
            name="cancellation_policy"
            defaultValue={initialListing?.cancellation_policy ?? "flexible"}
            className="catalog-input"
          >
            <option value="flexible">
              Flexibilă — Anulare gratuită cu 24h înainte
            </option>
            <option value="moderate">
              Moderată — Anulare gratuită cu 48h înainte
            </option>
            <option value="strict">
              Strictă — Anulare gratuită cu 7 zile înainte
            </option>
          </select>
        </div>
      </div>

      {/* 5. Descriere tehnică & Condiții de predare */}
      <div className="space-y-1.5">
        <label
          htmlFor="description"
          className="block font-mono text-xs uppercase text-ink font-semibold"
        >
          9. Specificații Tehnice &amp; Condiții de Predare *
        </label>
        <textarea
          id="description"
          name="description"
          rows={4}
          required
          minLength={10}
          defaultValue={initialListing?.description ?? ""}
          placeholder="Descrie starea tehnică, accesoriile incluse (ex: valiză transport, 3 burghie SDS-Plus) și zona orientativă de predare..."
          className="catalog-input"
        />
      </div>

      {/* 6. Fotografii Obiect (Gestionare Imagini Existente + Upload Nou) */}
      <div className="space-y-4 p-4 border border-ink/20 bg-cream">
        <div className="flex items-center justify-between border-b border-ink/15 pb-2">
          <span className="font-mono text-xs uppercase font-bold text-ink">
            10. Fotografii Obiect (Maxim 4 imagini)
          </span>
          <span className="font-mono text-[11px] text-ink-muted">
            BUCKET: listing-images
          </span>
        </div>

        {/* În modul Editare: Afișăm pozele existente cu opțiune de eliminare */}
        {isEdit && existingImages.length > 0 && (
          <div className="space-y-2">
            <div className="font-mono text-xs text-ink-muted">
              Fotografii atașate în prezent (bifează imaginile pe care dorești
              să le elimini):
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {existingImages.map((img, idx) => {
                const isMarked = removedImageIds.includes(img.id);
                return (
                  <div
                    key={img.id}
                    className={`border p-2 space-y-2 bg-cream-light ${
                      isMarked ? "border-red-800 opacity-60" : "border-ink/25"
                    }`}
                  >
                    <div className="h-24 w-full overflow-hidden bg-cream border border-ink/15">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={img.url}
                        alt={`Foto ${idx + 1}`}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => toggleRemoveImage(img.id)}
                      className={`w-full py-1 px-2 font-mono text-[10px] uppercase border transition-colors ${
                        isMarked
                          ? "bg-red-800 text-cream-light border-red-900"
                          : "bg-cream text-ink border-ink/30 hover:border-red-800"
                      }`}
                    >
                      {isMarked ? "✕ Va fi ștearsă" : "Șterge Foto"}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="space-y-2">
          <label
            htmlFor="images"
            className="block font-mono text-xs text-ink-muted"
          >
            {isEdit
              ? "Încarcă fotografii noi (în limita a 4 imagini totale):"
              : "Încarcă fotografii din dispozitiv (JPG, PNG, WEBP — max 5MB/poză):"}
          </label>
          <input
            id="images"
            name="images"
            type="file"
            accept="image/*"
            multiple
            onChange={handleFileChange}
            className="block w-full text-xs font-mono text-ink file:mr-4 file:py-2 file:px-4 file:border file:border-ink file:text-xs file:font-mono file:uppercase file:bg-cream-light file:text-ink hover:file:bg-ochre hover:file:text-cream-light file:transition-colors cursor-pointer"
          />

          {selectedFiles.length > 0 && (
            <div className="p-2.5 bg-cream-light border border-ink/20 font-mono text-[11px] space-y-1">
              <div className="text-ochre font-bold uppercase">
                Fișiere pregătite pentru încărcare ({selectedFiles.length}):
              </div>
              <ul className="list-disc list-inside text-ink-muted">
                {selectedFiles.map((fileInfo, idx) => (
                  <li key={idx}>{fileInfo}</li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div className="pt-2 border-t border-ink/10 space-y-1.5">
          <label
            htmlFor="image_url"
            className="block font-mono text-xs text-ink-muted"
          >
            Sau adaugă URL imagine direct (opțional):
          </label>
          <input
            id="image_url"
            name="image_url"
            type="url"
            placeholder="https://images.unsplash.com/..."
            className="catalog-input"
          />
        </div>
      </div>

      {/* Buton Submit */}
      <div className="pt-2 flex items-center justify-end gap-3">
        <button
          type="submit"
          disabled={loading}
          className="catalog-btn-primary py-3 px-6"
        >
          {loading
            ? "Se salvează fișa în inventar..."
            : isEdit
            ? "Salvează Modificările Fișei"
            : "Înregistrează Obiectul în Catalog"}
        </button>
      </div>
    </form>
  );
}
