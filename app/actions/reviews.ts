"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getSupabaseEnv } from "@/lib/supabase/config";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { dispatchNotification } from "@/app/actions/notifications";
import { formatZodIssues } from "@/lib/validations/profile";
import { createReviewSchema } from "@/lib/validations/bookings";
import type { ActionResponse, Profile, Review } from "@/lib/types/database";

/**
 * ============================================================================
 * RentA (Valul 1 Comercial) — Server Actions pentru Sistemul de Recenzii
 * (`app/actions/reviews.ts`)
 * ============================================================================
 *
 * Explicație pentru dezvoltatori C / Java (Faza 10):
 * - Input-ul din formular este validat cu `createReviewSchema` (Zod).
 * - După inserarea în `public.reviews`, trigger-ul SQL `recalculate_ratings()`
 *   actualizează atomic `rating_avg` și `rating_count` atât în `public.listings`,
 *   cât și în `public.profiles`!
 */

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

/**
 * 1. ADAUGĂ RECENZIE PENTRU O ÎNCHIRIERE FINALIZATĂ (`createReviewAction`)
 */
export async function createReviewAction(
  formData: FormData
): Promise<ActionResponse<Review>> {
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
      "Trebuie să fii autentificat pentru a publica o recenzie."
    );
  }

  const rl = checkRateLimit(`review:create:${user.id}`, 10, 60_000);
  if (!rl.allowed) {
    return errorResponse(
      `Ai trimis prea multe recenzii într-un timp scurt. Așteaptă ${rl.retryAfterSeconds} secunde.`
    );
  }

  const rawBookingId = String(formData.get("booking_id") ?? "").trim();
  const rawRating = Number(String(formData.get("rating") ?? "").trim());
  const rawComment = String(formData.get("comment") ?? "").trim();

  const parsed = createReviewSchema.safeParse({
    booking_id: rawBookingId,
    rating: rawRating,
    comment: rawComment,
  });

  if (!parsed.success) {
    const { firstMessage, fieldErrors } = formatZodIssues(parsed.error.issues);
    return errorResponse(firstMessage, fieldErrors);
  }

  const { booking_id: bookingId, rating, comment } = parsed.data;

  // Încărcăm rezervarea din `public.bookings` și verificăm regulile de domeniu
  const { data: booking, error: bookingError } = await supabase
    .from("bookings")
    .select("id, booking_code, listing_id, renter_id, owner_id, status")
    .eq("id", bookingId)
    .maybeSingle();

  if (bookingError || !booking) {
    return errorResponse("Rezervarea asociată nu a fost găsită în baza de date.");
  }

  if (booking.status !== "completed") {
    return errorResponse(
      "Poți lăsa o recenzie doar după ce închirierea a fost marcată ca finalizată (completed)."
    );
  }

  const isRenter = booking.renter_id === user.id;
  const isOwner = booking.owner_id === user.id;

  if (!isRenter && !isOwner) {
    return errorResponse(
      "Doar participanții la această rezervare (chiriașul sau proprietarul) pot lăsa o recenzie."
    );
  }

  const targetUserId = isRenter ? booking.owner_id : booking.renter_id;

  const { data: createdReview, error: insertError } = await supabase
    .from("reviews")
    .insert({
      booking_id: booking.id,
      author_id: user.id,
      target_user_id: targetUserId,
      listing_id: booking.listing_id,
      rating,
      comment,
    })
    .select("*")
    .single();

  if (insertError) {
    if (insertError.code === "23505") {
      return errorResponse(
        "Ai lăsat deja o recenzie pentru această rezervare."
      );
    }
    return errorResponse(
      `Eroare la salvarea recenziei: ${insertError.message}`
    );
  }

  // Notificăm non-blocant utilizatorul care a primit recenzia (Faza 13 / M13.2)
  await dispatchNotification({
    userId: String(targetUserId),
    type: "review_received",
    title: `Recenzie nouă (${rating}/5 stele) — ${booking.booking_code}`,
    body: `Ai primit o recenzie de ${rating}/5 stele pentru rezervarea ${booking.booking_code}.`,
    actionUrl: `/obiect/${booking.listing_id}`,
    bookingId: String(booking.id),
  });

  revalidatePath("/rezervarile-mele");
  revalidatePath(`/obiect/${booking.listing_id}`);
  revalidatePath("/catalog");
  revalidatePath("/profil");

  return successResponse(
    `Recenzia ta (${rating}/5 stele) pentru rezervarea ${booking.booking_code} a fost publicată!`,
    createdReview as Review
  );
}

/**
 * 2. INTEROGARE RECENZII ȘI MEDIE RATING PENTRU UN OBIECT (`getListingReviewsAction`)
 */
export async function getListingReviewsAction(listingId: string): Promise<{
  reviews: Review[];
  averageRating: number | null;
  totalCount: number;
}> {
  const { isConfigured } = getSupabaseEnv();
  if (!isConfigured || !listingId) {
    return { reviews: [], averageRating: null, totalCount: 0 };
  }

  const supabase = await createClient();
  if (!supabase) {
    return { reviews: [], averageRating: null, totalCount: 0 };
  }

  const { data, error } = await supabase
    .from("reviews")
    .select(
      `
      *,
      author:profiles!reviews_author_id_fkey(id, display_name, account_type, city, avatar_url)
    `
    )
    .eq("listing_id", listingId)
    .order("created_at", { ascending: false });

  if (error || !data) {
    return { reviews: [], averageRating: null, totalCount: 0 };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const reviews: Review[] = data.map((row: any) => {
    const rawAuthor = Array.isArray(row.author) ? row.author[0] : row.author;

    const authorFallback: Pick<
      Profile,
      "id" | "display_name" | "account_type" | "city" | "avatar_url"
    > = rawAuthor ?? {
      id: row.author_id,
      display_name: "Membru RentA",
      account_type: "individual",
      city: "București",
      avatar_url: null,
    };

    return {
      id: row.id,
      booking_id: row.booking_id,
      author_id: row.author_id,
      target_user_id: row.target_user_id,
      listing_id: row.listing_id,
      rating: Number(row.rating),
      comment: row.comment ?? null,
      created_at: row.created_at,
      author: authorFallback,
    };
  });

  const totalCount = reviews.length;
  const sum = reviews.reduce((acc, rev) => acc + rev.rating, 0);
  const averageRating =
    totalCount > 0 ? Math.round((sum / totalCount) * 10) / 10 : null;

  return {
    reviews,
    averageRating,
    totalCount,
  };
}
