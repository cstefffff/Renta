"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getSupabaseEnv } from "@/lib/supabase/config";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { formatZodIssues } from "@/lib/validations/profile";
import {
  createListingSchema,
  updateListingSchema,
} from "@/lib/validations/listings";
import type {
  AccountType,
  ActionResponse,
  CancellationPolicy,
  CatalogFilters,
  Listing,
  ListingImage,
  ListingStatus,
  ListingWithDetails,
  PaginatedCatalogResult,
  Profile,
  UnavailableDateRange,
} from "@/lib/types/database";

export type { CatalogFilters };

/**
 * ============================================================================
 * RentA (Valul 1 Comercial) — Server Actions pentru Obiecte Listate
 * (`app/actions/listings.ts`)
 * ============================================================================
 *
 * Explicație pentru dezvoltatori C / Java (Faza 10):
 * - Toate interogările pe `owner:profiles(...)` selectează EXCLUSIV coloanele
 *   publice (`id`, `display_name`, `account_type`, `city`, `bio`, `avatar_url`,
 *   `phone_verified`, `kyb_verified`, `rating_avg`, `rating_count`).
 * - La ștergerea unui anunț (`deleteListingAction`), dacă motorul PostgreSQL
 *   returnează codul SQLSTATE `23503` (`foreign_key_violation` — anunțul are
 *   rezervări istorice în `public.bookings`), executăm automat un Soft Delete
 *   (`status = 'archived'`), păstrând integritatea contabilă a rezervărilor.
 */

const MAX_IMAGES_PER_LISTING = 4;
const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

const PUBLIC_OWNER_SELECT =
  "id, display_name, account_type, city, bio, avatar_url, phone_verified, kyb_verified, rating_avg, rating_count";

function errorResponse<T = unknown>(
  message: string,
  fieldErrors?: Record<string, string[]>
): ActionResponse<T> {
  return {
    success: false,
    ok: false,
    error: message,
    message,
    fieldErrors,
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

function sanitizeFileName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]/g, "-")
    .replace(/-+/g, "-")
    .toLowerCase();
}

/**
 * Helper intern: normalizează un rând brut din `public.listings` într-un `ListingWithDetails`.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapRowToListingWithDetails(row: any): ListingWithDetails {
  const rawOwner = Array.isArray(row.owner) ? row.owner[0] : row.owner;
  const rawImages: ListingImage[] = Array.isArray(row.images)
    ? [...(row.images as ListingImage[])].sort(
        (a, b) => (a.display_order ?? 0) - (b.display_order ?? 0)
      )
    : [];

  const ownerFallback: Pick<
    Profile,
    | "id"
    | "display_name"
    | "account_type"
    | "city"
    | "bio"
    | "avatar_url"
    | "phone_verified"
    | "kyb_verified"
    | "rating_avg"
    | "rating_count"
    | "company_cui"
    | "phone"
  > = rawOwner
    ? {
        id: rawOwner.id,
        display_name: rawOwner.display_name ?? "Proprietar RentA",
        account_type:
          rawOwner.account_type === "company" ? "company" : "individual",
        city: rawOwner.city ?? row.city ?? "București",
        bio: rawOwner.bio ?? null,
        avatar_url: rawOwner.avatar_url ?? null,
        phone_verified: Boolean(rawOwner.phone_verified ?? false),
        kyb_verified: Boolean(rawOwner.kyb_verified ?? false),
        rating_avg:
          rawOwner.rating_avg !== null && rawOwner.rating_avg !== undefined
            ? Number(rawOwner.rating_avg)
            : null,
        rating_count: Number(rawOwner.rating_count ?? 0),
      }
    : {
        id: row.owner_id,
        display_name: "Proprietar RentA",
        account_type: "individual",
        city: row.city ?? "București",
        bio: null,
        avatar_url: null,
        phone_verified: false,
        kyb_verified: false,
        rating_avg: null,
        rating_count: 0,
      };

  const ratingAvg =
    row.rating_avg !== null && row.rating_avg !== undefined
      ? Number(row.rating_avg)
      : null;
  const ratingCount = Number(row.rating_count ?? 0);

  return {
    id: row.id,
    catalog_code: row.catalog_code,
    owner_id: row.owner_id,
    title: row.title,
    description: row.description,
    category: row.category,
    price_per_day: Number(row.price_per_day),
    price_per_hour:
      row.price_per_hour !== null && row.price_per_hour !== undefined
        ? Number(row.price_per_hour)
        : null,
    deposit_ron: Number(row.deposit_ron ?? 0),
    min_rental_days: Number(row.min_rental_days ?? 1),
    cancellation_policy:
      (row.cancellation_policy as CancellationPolicy) ?? "moderate",
    rating_avg: ratingAvg,
    rating_count: ratingCount,
    city: row.city,
    status: row.status,
    created_at: row.created_at,
    updated_at: row.updated_at,
    owner: ownerFallback,
    images: rawImages,
    average_rating: ratingAvg,
    reviews_count: ratingCount,
  };
}

/**
 * 1. PUBLICARE OBIECT NOU ÎN CATALOG (`createListingAction`)
 */
export async function createListingAction(
  formData: FormData
): Promise<ActionResponse<Listing>> {
  const { isConfigured } = getSupabaseEnv();

  if (!isConfigured) {
    return errorResponse(
      "Conexiunea Supabase nu este configurată în .env.local."
    );
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
      "Trebuie să fii autentificat pentru a publica un obiect în catalog."
    );
  }

  const rl = checkRateLimit(`listing:create:${user.id}`, 10, 60_000);
  if (!rl.allowed) {
    return errorResponse(
      `Ai publicat prea multe anunțuri într-un timp scurt. Așteaptă ${rl.retryAfterSeconds} secunde.`
    );
  }

  // Safety upsert pe `public.profiles` (doar coloane publice!)
  const { data: existingProfile } = await supabase
    .from("profiles")
    .select("id, city")
    .eq("id", user.id)
    .maybeSingle();

  const meta = user.user_metadata ?? {};
  const fallbackCity =
    (typeof existingProfile?.city === "string" && existingProfile.city) ||
    (typeof meta.city === "string" && meta.city) ||
    "București";

  if (!existingProfile) {
    const rawAccountType =
      meta.account_type === "company" ? "company" : "individual";
    const fallbackName =
      (typeof meta.display_name === "string" && meta.display_name.trim()) ||
      (user.email ? user.email.split("@")[0] : "Utilizator RentA");

    await supabase.from("profiles").upsert(
      {
        id: user.id,
        display_name: fallbackName,
        account_type: rawAccountType as AccountType,
        city: fallbackCity,
      },
      { onConflict: "id" }
    );
  }

  // Extragem câmpurile din FormData
  const rawTitle = String(formData.get("title") ?? "").trim();
  const rawDescription = String(formData.get("description") ?? "").trim();
  const rawCategory = String(formData.get("category") ?? "").trim();
  const rawCity =
    String(formData.get("city") ?? "").trim() || fallbackCity || "București";
  const rawPricePerDay = String(formData.get("price_per_day") ?? "")
    .trim()
    .replace(",", ".");
  const rawPricePerHour = String(formData.get("price_per_hour") ?? "")
    .trim()
    .replace(",", ".");
  const rawDepositRon = String(formData.get("deposit_ron") ?? "0")
    .trim()
    .replace(",", ".");
  const rawMinRentalDays = String(formData.get("min_rental_days") ?? "1").trim();
  const rawCancellationPolicy = String(
    formData.get("cancellation_policy") ?? "moderate"
  ).trim();
  const externalImageUrl = String(formData.get("image_url") ?? "").trim();

  const parsed = createListingSchema.safeParse({
    title: rawTitle,
    description: rawDescription,
    category: rawCategory,
    city: rawCity,
    price_per_day: Number(rawPricePerDay),
    price_per_hour:
      rawPricePerHour.length > 0 ? Number(rawPricePerHour) : null,
    deposit_ron: rawDepositRon.length > 0 ? Number(rawDepositRon) : 0,
    min_rental_days:
      rawMinRentalDays.length > 0 ? Number(rawMinRentalDays) : 1,
    cancellation_policy:
      rawCancellationPolicy === "flexible" ||
      rawCancellationPolicy === "strict"
        ? rawCancellationPolicy
        : "moderate",
  });

  if (!parsed.success) {
    const { firstMessage, fieldErrors } = formatZodIssues(parsed.error.issues);
    return errorResponse(firstMessage, fieldErrors);
  }

  const {
    title,
    description,
    category,
    city,
    price_per_day: pricePerDay,
    price_per_hour: pricePerHour,
    deposit_ron: depositRon,
    min_rental_days: minRentalDays,
    cancellation_policy: cancellationPolicy,
  } = parsed.data;

  // Validăm fișierele foto
  const rawFiles = formData.getAll("images");
  const validFiles: File[] = [];

  for (const item of rawFiles) {
    if (item instanceof File && item.size > 0) {
      if (item.size > MAX_IMAGE_SIZE_BYTES) {
        return errorResponse(
          `Imaginea "${item.name}" depășește limita maximă de 5 MB per fișier.`
        );
      }
      validFiles.push(item);
    }
  }

  const filesToUpload = validFiles.slice(0, MAX_IMAGES_PER_LISTING);

  const { data: createdListing, error: insertError } = await supabase
    .from("listings")
    .insert({
      owner_id: user.id,
      title,
      description,
      category,
      price_per_day: Math.round(pricePerDay * 100) / 100,
      price_per_hour:
        pricePerHour !== null && pricePerHour !== undefined
          ? Math.round(pricePerHour * 100) / 100
          : null,
      deposit_ron: Math.round(depositRon * 100) / 100,
      min_rental_days: minRentalDays,
      cancellation_policy: cancellationPolicy,
      city,
      status: "available",
    })
    .select("*")
    .single();

  if (insertError || !createdListing) {
    return errorResponse(
      `Eroare la salvarea anunțului în baza de date: ${
        insertError?.message ?? "Răspuns gol de la server"
      }`
    );
  }

  const listing = createdListing as Listing;
  let currentDisplayOrder = 0;
  const imageRowsToInsert: {
    listing_id: string;
    storage_path: string;
    url: string;
    display_order: number;
  }[] = [];

  if (
    externalImageUrl.startsWith("https://") ||
    externalImageUrl.startsWith("http://")
  ) {
    imageRowsToInsert.push({
      listing_id: listing.id,
      storage_path: "external-url",
      url: externalImageUrl,
      display_order: currentDisplayOrder++,
    });
  }

  for (let i = 0; i < filesToUpload.length; i++) {
    const file = filesToUpload[i];
    const safeName = sanitizeFileName(file.name || `foto-${i + 1}.jpg`);
    const storagePath = `${user.id}/${listing.id}/${Date.now()}-${i}-${safeName}`;

    const { error: uploadError } = await supabase.storage
      .from("listing-images")
      .upload(storagePath, file, {
        cacheControl: "3600",
        upsert: false,
        contentType: file.type || "image/jpeg",
      });

    if (!uploadError) {
      const { data: publicUrlData } = supabase.storage
        .from("listing-images")
        .getPublicUrl(storagePath);

      if (publicUrlData?.publicUrl) {
        imageRowsToInsert.push({
          listing_id: listing.id,
          storage_path: storagePath,
          url: publicUrlData.publicUrl,
          display_order: currentDisplayOrder++,
        });
      }
    }
  }

  if (imageRowsToInsert.length > 0) {
    await supabase.from("listing_images").insert(imageRowsToInsert);
  }

  revalidatePath("/listarile-mele");
  revalidatePath("/catalog");
  revalidatePath("/");

  return successResponse(
    `Obiectul ${listing.catalog_code} ("${listing.title}") a fost publicat cu succes în catalog!`,
    listing
  );
}

/**
 * 2. ACTUALIZARE COMPLETĂ ANUNȚ & GALERIE FOTO (`updateListingAction`)
 */
export async function updateListingAction(
  listingId: string,
  formData: FormData
): Promise<ActionResponse<Listing>> {
  const { isConfigured } = getSupabaseEnv();
  if (!isConfigured) {
    return errorResponse("Conexiunea Supabase nu este configurată.");
  }

  const supabase = await createClient();
  if (!supabase) {
    return errorResponse("Clientul Supabase nu este disponibil.");
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return errorResponse("Trebuie să fii autentificat pentru a edita un anunț.");
  }

  if (!listingId) {
    return errorResponse("ID-ul anunțului lipsește.");
  }

  const { data: existingListing } = await supabase
    .from("listings")
    .select("id, owner_id, catalog_code")
    .eq("id", listingId)
    .maybeSingle();

  if (!existingListing || existingListing.owner_id !== user.id) {
    return errorResponse(
      "Nu ai permisiunea de a edita acest obiect din catalog."
    );
  }

  const rawTitle = String(formData.get("title") ?? "").trim();
  const rawDescription = String(formData.get("description") ?? "").trim();
  const rawCategory = String(formData.get("category") ?? "").trim();
  const rawCity = String(formData.get("city") ?? "București").trim();
  const rawPricePerDay = String(formData.get("price_per_day") ?? "")
    .trim()
    .replace(",", ".");
  const rawPricePerHour = String(formData.get("price_per_hour") ?? "")
    .trim()
    .replace(",", ".");
  const rawDepositRon = String(formData.get("deposit_ron") ?? "0")
    .trim()
    .replace(",", ".");
  const rawMinRentalDays = String(formData.get("min_rental_days") ?? "1").trim();
  const rawCancellationPolicy = String(
    formData.get("cancellation_policy") ?? "moderate"
  ).trim();
  const rawStatus = String(formData.get("status") ?? "").trim();

  const parsed = updateListingSchema.safeParse({
    title: rawTitle,
    description: rawDescription,
    category: rawCategory,
    city: rawCity,
    price_per_day: Number(rawPricePerDay),
    price_per_hour:
      rawPricePerHour.length > 0 ? Number(rawPricePerHour) : null,
    deposit_ron: rawDepositRon.length > 0 ? Number(rawDepositRon) : 0,
    min_rental_days:
      rawMinRentalDays.length > 0 ? Number(rawMinRentalDays) : 1,
    cancellation_policy:
      rawCancellationPolicy === "flexible" ||
      rawCancellationPolicy === "strict"
        ? rawCancellationPolicy
        : "moderate",
    status:
      rawStatus === "available" ||
      rawStatus === "unavailable" ||
      rawStatus === "archived"
        ? (rawStatus as ListingStatus)
        : undefined,
  });

  if (!parsed.success) {
    const { firstMessage, fieldErrors } = formatZodIssues(parsed.error.issues);
    return errorResponse(firstMessage, fieldErrors);
  }

  const {
    title,
    description,
    category,
    city,
    price_per_day: pricePerDay,
    price_per_hour: pricePerHour,
    deposit_ron: depositRon,
    min_rental_days: minRentalDays,
    cancellation_policy: cancellationPolicy,
    status,
  } = parsed.data;

  const updatePayload: Record<string, unknown> = {
    title,
    description,
    category,
    city,
    price_per_day: Math.round(pricePerDay * 100) / 100,
    price_per_hour:
      pricePerHour !== null && pricePerHour !== undefined
        ? Math.round(pricePerHour * 100) / 100
        : null,
    deposit_ron: Math.round(depositRon * 100) / 100,
    min_rental_days: minRentalDays,
    cancellation_policy: cancellationPolicy,
    updated_at: new Date().toISOString(),
  };

  if (status) {
    updatePayload.status = status;
  }

  const { data: updatedListing, error: updateErr } = await supabase
    .from("listings")
    .update(updatePayload)
    .eq("id", listingId)
    .eq("owner_id", user.id)
    .select("*")
    .single();

  if (updateErr || !updatedListing) {
    return errorResponse(
      `Eroare la actualizarea obiectului: ${
        updateErr?.message ?? "Răspuns gol"
      }`
    );
  }

  // 1. Ștergem imaginile marcate pentru eliminare (`remove_image_ids`)
  const removeImageIds = formData
    .getAll("remove_image_ids")
    .map((v) => String(v).trim())
    .filter(Boolean);

  if (removeImageIds.length > 0) {
    const { data: imagesToDelete } = await supabase
      .from("listing_images")
      .select("id, storage_path")
      .eq("listing_id", listingId)
      .in("id", removeImageIds);

    if (imagesToDelete && imagesToDelete.length > 0) {
      const storagePaths = imagesToDelete
        .map((img) => img.storage_path as string)
        .filter((p) => Boolean(p) && p !== "external-url");

      if (storagePaths.length > 0) {
        await supabase.storage.from("listing-images").remove(storagePaths);
      }

      await supabase
        .from("listing_images")
        .delete()
        .eq("listing_id", listingId)
        .in("id", removeImageIds);
    }
  }

  // 2. Verificăm câte imagini mai are obiectul și încărcăm eventuale imagini noi (până la max 4 total)
  const { data: remainingImages } = await supabase
    .from("listing_images")
    .select("id, display_order")
    .eq("listing_id", listingId)
    .order("display_order", { ascending: true });

  const currentCount = remainingImages?.length ?? 0;
  const maxOrder =
    remainingImages && remainingImages.length > 0
      ? Math.max(...remainingImages.map((img) => Number(img.display_order ?? 0)))
      : -1;

  let nextDisplayOrder = maxOrder + 1;
  const slotsAvailable = Math.max(0, MAX_IMAGES_PER_LISTING - currentCount);

  if (slotsAvailable > 0) {
    const rawFiles = formData.getAll("images");
    const validFiles: File[] = [];

    for (const item of rawFiles) {
      if (item instanceof File && item.size > 0) {
        if (item.size > MAX_IMAGE_SIZE_BYTES) {
          return errorResponse(
            `Imaginea "${item.name}" depășește limita maximă de 5 MB per fișier.`
          );
        }
        validFiles.push(item);
      }
    }

    const filesToUpload = validFiles.slice(0, slotsAvailable);
    const newImageRows: {
      listing_id: string;
      storage_path: string;
      url: string;
      display_order: number;
    }[] = [];

    for (let i = 0; i < filesToUpload.length; i++) {
      const file = filesToUpload[i];
      const safeName = sanitizeFileName(file.name || `foto-${i + 1}.jpg`);
      const storagePath = `${user.id}/${listingId}/${Date.now()}-${i}-${safeName}`;

      const { error: uploadError } = await supabase.storage
        .from("listing-images")
        .upload(storagePath, file, {
          cacheControl: "3600",
          upsert: false,
          contentType: file.type || "image/jpeg",
        });

      if (!uploadError) {
        const { data: publicUrlData } = supabase.storage
          .from("listing-images")
          .getPublicUrl(storagePath);

        if (publicUrlData?.publicUrl) {
          newImageRows.push({
            listing_id: listingId,
            storage_path: storagePath,
            url: publicUrlData.publicUrl,
            display_order: nextDisplayOrder++,
          });
        }
      }
    }

    const externalImageUrl = String(formData.get("image_url") ?? "").trim();
    if (
      newImageRows.length < slotsAvailable &&
      (externalImageUrl.startsWith("https://") ||
        externalImageUrl.startsWith("http://"))
    ) {
      newImageRows.push({
        listing_id: listingId,
        storage_path: "external-url",
        url: externalImageUrl,
        display_order: nextDisplayOrder++,
      });
    }

    if (newImageRows.length > 0) {
      await supabase.from("listing_images").insert(newImageRows);
    }
  }

  revalidatePath("/listarile-mele");
  revalidatePath("/catalog");
  revalidatePath(`/obiect/${listingId}`);
  revalidatePath("/");

  return successResponse(
    `Fișa obiectului ${updatedListing.catalog_code} a fost actualizată cu succes!`,
    updatedListing as Listing
  );
}

/**
 * 3. COMUTARE STATUS DISPONIBILITATE (`toggleListingStatusAction`)
 */
export async function toggleListingStatusAction(
  listingId: string,
  nextStatus: "available" | "unavailable" | "archived"
): Promise<ActionResponse> {
  const { isConfigured } = getSupabaseEnv();
  if (!isConfigured) {
    return errorResponse("Conexiunea Supabase nu este configurată.");
  }

  const supabase = await createClient();
  if (!supabase) {
    return errorResponse("Clientul Supabase nu este disponibil.");
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return errorResponse("Trebuie să fii autentificat pentru această acțiune.");
  }

  if (!listingId) {
    return errorResponse("ID-ul listării lipsește.");
  }

  if (
    nextStatus !== "available" &&
    nextStatus !== "unavailable" &&
    nextStatus !== "archived"
  ) {
    return errorResponse("Status invalid.");
  }

  const { error } = await supabase
    .from("listings")
    .update({
      status: nextStatus,
      updated_at: new Date().toISOString(),
    })
    .eq("id", listingId)
    .eq("owner_id", user.id);

  if (error) {
    return errorResponse(
      `Nu s-a putut actualiza statusul obiectului: ${error.message}`
    );
  }

  revalidatePath("/listarile-mele");
  revalidatePath("/catalog");
  revalidatePath(`/obiect/${listingId}`);
  revalidatePath("/");

  const messages: Record<"available" | "unavailable" | "archived", string> = {
    available: "Obiectul este acum marcat ca DISPONIBIL în catalog.",
    unavailable: "Obiectul a fost trecut în starea INDISPONIBIL temporar.",
    archived: "Obiectul a fost ARHIVAT și ascuns din catalogul public.",
  };

  return successResponse(messages[nextStatus]);
}

/**
 * 4. ȘTERGERE SAU ARHIVARE AUTOMATĂ OBIECT (`deleteListingAction`)
 *
 * Dacă obiectul NU are rezervări în istoric, îl șterge definitiv și îi curăță
 * imaginile din Storage.
 * Dacă obiectul ARE rezervări în istoric (eroare PostgreSQL `23503` de la
 * `ON DELETE RESTRICT`), îl trece automat în `status = 'archived'` (Soft Delete)!
 */
export async function deleteListingAction(
  listingId: string
): Promise<ActionResponse<{ mode: "deleted" | "archived" }>> {
  const { isConfigured } = getSupabaseEnv();
  if (!isConfigured) {
    return errorResponse("Conexiunea Supabase nu este configurată.");
  }

  const supabase = await createClient();
  if (!supabase) {
    return errorResponse("Clientul Supabase nu este disponibil.");
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return errorResponse("Trebuie să fii autentificat pentru această acțiune.");
  }

  if (!listingId) {
    return errorResponse("ID-ul listării lipsește.");
  }

  // Încercăm mai întâi ștergerea rândului din `public.listings`
  const { data: existingImages } = await supabase
    .from("listing_images")
    .select("storage_path")
    .eq("listing_id", listingId);

  const { error } = await supabase
    .from("listings")
    .delete()
    .eq("id", listingId)
    .eq("owner_id", user.id);

  if (error) {
    // Codul SQLSTATE 23503 = Foreign Key Violation (obiectul are rezervări în public.bookings)
    // Aplicăm automat Soft Delete: arhivăm anunțul (`status = 'archived'`)
    if (error.code === "23503") {
      const { error: archiveErr } = await supabase
        .from("listings")
        .update({
          status: "archived",
          updated_at: new Date().toISOString(),
        })
        .eq("id", listingId)
        .eq("owner_id", user.id);

      if (archiveErr) {
        return errorResponse(
          `Obiectul are rezervări în istoric și nu a putut fi arhivat: ${archiveErr.message}`
        );
      }

      revalidatePath("/listarile-mele");
      revalidatePath("/catalog");
      revalidatePath(`/obiect/${listingId}`);
      revalidatePath("/");

      return successResponse(
        "Obiectul are rezervări în istoric, așa că a fost ARHIVAT automat (ascuns din catalogul public, dar păstrat pentru evidența rezervărilor).",
        { mode: "archived" }
      );
    }

    return errorResponse(`Eroare la ștergerea obiectului: ${error.message}`);
  }

  // Dacă ștergerea fizică a reușit, curățăm și fișierele din Supabase Storage
  if (existingImages && existingImages.length > 0) {
    const storagePaths = existingImages
      .map((img) => img.storage_path as string)
      .filter((p) => Boolean(p) && p !== "external-url");

    if (storagePaths.length > 0) {
      await supabase.storage.from("listing-images").remove(storagePaths);
    }
  }

  revalidatePath("/listarile-mele");
  revalidatePath("/catalog");
  revalidatePath("/");

  return successResponse("Obiectul a fost șters definitiv din inventarul tău.", {
    mode: "deleted",
  });
}

export const deleteOrArchiveListingAction = deleteListingAction;

/**
 * 5. INTEROGARE LISTĂRI PROPRII (`getMyListingsAction`)
 */
export async function getMyListingsAction(): Promise<ListingWithDetails[]> {
  const { isConfigured } = getSupabaseEnv();
  if (!isConfigured) {
    return [];
  }

  const supabase = await createClient();
  if (!supabase) {
    return [];
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return [];
  }

  const { data, error } = await supabase
    .from("listings")
    .select(
      `
      *,
      images:listing_images(*),
      owner:profiles!listings_owner_id_fkey(${PUBLIC_OWNER_SELECT})
    `
    )
    .eq("owner_id", user.id)
    .order("created_at", { ascending: false });

  if (error || !data) {
    return [];
  }

  return data.map(mapRowToListingWithDetails);
}

/**
 * 6. INTEROGARE CATALOG PUBLIC PAGINAT ȘI SORTAT (`getPaginatedPublicListingsAction`)
 *
 * Suportă filtrare după segment (`individual` vs `company`), căutare text (`q`),
 * categorie, oraș, interval de preț, sortare (`newest`, `price_asc`, `price_desc`,
 * `rating_desc`) și paginare (`page`, `pageSize = 9`).
 */
export async function getPaginatedPublicListingsAction(
  filters: CatalogFilters = {}
): Promise<PaginatedCatalogResult> {
  const page = Math.max(1, Math.floor(Number(filters.page ?? 1) || 1));
  const pageSize = Math.max(
    1,
    Math.min(50, Math.floor(Number(filters.pageSize ?? 9) || 9))
  );

  const emptyResult: PaginatedCatalogResult = {
    items: [],
    totalCount: 0,
    page,
    pageSize,
    totalPages: 1,
  };

  const { isConfigured } = getSupabaseEnv();
  if (!isConfigured) {
    return emptyResult;
  }

  const supabase = await createClient();
  if (!supabase) {
    return emptyResult;
  }

  const hasSegmentFilter =
    filters.segment === "individual" || filters.segment === "company";

  const ownerRelation = hasSegmentFilter
    ? `owner:profiles!listings_owner_id_fkey!inner(${PUBLIC_OWNER_SELECT})`
    : `owner:profiles!listings_owner_id_fkey(${PUBLIC_OWNER_SELECT})`;

  let query = supabase
    .from("listings")
    .select(
      `
      *,
      images:listing_images(*),
      ${ownerRelation}
    `,
      { count: "exact" }
    )
    .eq("status", "available");

  if (hasSegmentFilter && filters.segment) {
    query = query.eq("owner.account_type", filters.segment);
  }

  if (filters.q && filters.q.trim().length > 0) {
    const safeQ = filters.q
      .trim()
      .replace(/[,()]/g, " ")
      .trim();

    if (safeQ.length > 0) {
      query = query.or(
        `title.ilike.%${safeQ}%,description.ilike.%${safeQ}%,catalog_code.ilike.%${safeQ}%`
      );
    }
  }

  if (filters.category && filters.category !== "all") {
    query = query.eq("category", filters.category);
  }

  if (filters.city && filters.city !== "all") {
    query = query.eq("city", filters.city);
  }

  if (
    typeof filters.minPrice === "number" &&
    Number.isFinite(filters.minPrice) &&
    filters.minPrice > 0
  ) {
    query = query.gte("price_per_day", filters.minPrice);
  }

  if (
    typeof filters.maxPrice === "number" &&
    Number.isFinite(filters.maxPrice) &&
    filters.maxPrice > 0
  ) {
    query = query.lte("price_per_day", filters.maxPrice);
  }

  // Aplicăm ordonarea solicitată
  const sort = filters.sort ?? "newest";
  if (sort === "price_asc") {
    query = query
      .order("price_per_day", { ascending: true })
      .order("created_at", { ascending: false });
  } else if (sort === "price_desc") {
    query = query
      .order("price_per_day", { ascending: false })
      .order("created_at", { ascending: false });
  } else if (sort === "rating_desc") {
    query = query
      .order("rating_avg", { ascending: false, nullsFirst: false })
      .order("rating_count", { ascending: false })
      .order("created_at", { ascending: false });
  } else {
    query = query.order("created_at", { ascending: false });
  }

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const { data, count, error } = await query.range(from, to);

  if (error || !data) {
    return emptyResult;
  }

  const items = data.map(mapRowToListingWithDetails);
  const totalCount = count ?? items.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  return {
    items,
    totalCount,
    page,
    pageSize,
    totalPages,
  };
}

/**
 * 7. INTEROGARE CATALOG PUBLIC (`getPublicListingsAction` — păstrează semnătura compatibilă)
 */
export async function getPublicListingsAction(
  filters: CatalogFilters = {}
): Promise<ListingWithDetails[]> {
  const res = await getPaginatedPublicListingsAction({
    ...filters,
    page: filters.page ?? 1,
    pageSize: filters.pageSize ?? 50,
  });
  return res.items;
}

/**
 * 8. INTEROGARE FIȘĂ TEHNICĂ OBIECT DUPĂ ID (`getListingByIdAction`)
 */
export async function getListingByIdAction(
  listingId: string
): Promise<ListingWithDetails | null> {
  const { isConfigured } = getSupabaseEnv();
  if (!isConfigured || !listingId) {
    return null;
  }

  const supabase = await createClient();
  if (!supabase) {
    return null;
  }

  const cleanId = listingId.trim();
  if (!cleanId) {
    return null;
  }

  const baseQuery = supabase.from("listings").select(
    `
      *,
      images:listing_images(*),
      owner:profiles!listings_owner_id_fkey(${PUBLIC_OWNER_SELECT})
    `
  );

  const { data, error } = cleanId.toUpperCase().startsWith("#OBJ-")
    ? await baseQuery.eq("catalog_code", cleanId.toUpperCase()).maybeSingle()
    : await baseQuery.eq("id", cleanId).maybeSingle();

  if (error || !data) {
    return null;
  }

  return mapRowToListingWithDetails(data);
}

/**
 * 9. INTEROGARE INTERVALE INDISPONIBILE PENTRU UN OBIECT (`getUnavailableDateRangesAction`)
 *
 * Apelează funcția RPC `get_listing_unavailable_ranges` definită în `003_commercial_hardening.sql`
 * pentru a afișa perioadele deja confirmate fără a expune identitatea chiriașilor.
 */
export async function getUnavailableDateRangesAction(
  listingId: string
): Promise<UnavailableDateRange[]> {
  const { isConfigured } = getSupabaseEnv();
  if (!isConfigured || !listingId) {
    return [];
  }

  const supabase = await createClient();
  if (!supabase) {
    return [];
  }

  const { data, error } = await supabase.rpc(
    "get_listing_unavailable_ranges",
    {
      p_listing_id: listingId,
    }
  );

  if (error || !Array.isArray(data)) {
    return [];
  }

  return data.map((row: { start_date: string; end_date: string }) => ({
    start_date: String(row.start_date),
    end_date: String(row.end_date),
  }));
}
