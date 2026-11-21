"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getSupabaseEnv } from "@/lib/supabase/config";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { dispatchNotification } from "@/app/actions/notifications";
import { formatZodIssues } from "@/lib/validations/profile";
import {
  createBookingSchema,
  parseIsoDateUtcMs,
} from "@/lib/validations/bookings";
import type {
  AccountType,
  ActionResponse,
  Booking,
  BookingStatus,
  BookingWithDetails,
  ListingImage,
  PaymentRecord,
  Profile,
} from "@/lib/types/database";

/**
 * ============================================================================
 * RentA (Valul 1 Comercial) — Server Actions pentru Rezervări
 * (`app/actions/bookings.ts`)
 * ============================================================================
 *
 * Explicație pentru dezvoltatori C / Java (Faza 10):
 * - Protecția Anti Double-Booking este garantată atât în aplicație, cât și în
 *   nucleul PostgreSQL prin constrângerea `EXCLUDE USING gist` (eroare SQLSTATE `23P01`).
 * - Automatul finit de stări (State Machine) este verificat în TypeScript și
 *   impus prin trigger-ul SQL `enforce_booking_state_and_immutability`.
 * - Numărul de telefon al partenerului NU se află în `public.profiles`; el este
 *   obținut din `public.profile_private` prin funcția RPC `get_booking_partner_phone`
 *   EXCLUSIV pentru rezervările aflate în starea `'confirmed'` sau `'completed'`.
 */

const PUBLIC_PARTICIPANT_SELECT =
  "id, display_name, account_type, city, avatar_url, phone_verified, kyb_verified, rating_avg, rating_count";

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
 * 1. CREARE CERERE DE REZERVARE (`createBookingAction`)
 */
export async function createBookingAction(
  formData: FormData
): Promise<ActionResponse<Booking>> {
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

  // 1. Verificăm autentificarea utilizatorului (Chiriaș / Renter)
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return errorResponse(
      "Trebuie să fii autentificat în contul tău RentA pentru a trimite o cerere de rezervare."
    );
  }

  // 2. Rate limiting (max 10 cereri de rezervare / minut per utilizator)
  const rl = checkRateLimit(`booking:create:${user.id}`, 10, 60_000);
  if (!rl.allowed) {
    return errorResponse(
      `Ai trimis prea multe cereri de rezervare într-un timp scurt. Așteaptă ${rl.retryAfterSeconds} secunde.`
    );
  }

  // 3. Extragem și validăm câmpurile cu schema Zod
  const rawListingId = String(formData.get("listing_id") ?? "").trim();
  const rawStartDate = String(formData.get("start_date") ?? "").trim();
  const rawEndDate = String(formData.get("end_date") ?? "").trim();
  const rawNotes = String(formData.get("notes") ?? "").trim();

  const parsed = createBookingSchema.safeParse({
    listing_id: rawListingId,
    start_date: rawStartDate,
    end_date: rawEndDate,
    notes: rawNotes || null,
  });

  if (!parsed.success) {
    const { firstMessage, fieldErrors } = formatZodIssues(parsed.error.issues);
    return errorResponse(firstMessage, fieldErrors);
  }

  const {
    listing_id: listingId,
    start_date: startDate,
    end_date: endDate,
    notes,
  } = parsed.data;

  const startMs = parseIsoDateUtcMs(startDate)!;
  const endMs = parseIsoDateUtcMs(endDate)!;

  // 4. Încărcăm obiectul din `public.listings`
  const { data: listing, error: listingError } = await supabase
    .from("listings")
    .select(
      "id, catalog_code, title, owner_id, price_per_day, min_rental_days, deposit_ron, status, city"
    )
    .eq("id", listingId)
    .maybeSingle();

  if (listingError || !listing) {
    return errorResponse("Obiectul solicitat nu a fost găsit în catalog.");
  }

  if (listing.status !== "available") {
    return errorResponse(
      "Acest obiect este marcat momentan ca indisponibil și nu poate primi cereri noi."
    );
  }

  if (listing.owner_id === user.id) {
    return errorResponse(
      "Nu poți trimite o cerere de rezervare pentru propriul tău obiect din inventar."
    );
  }

  // 5. Calculăm numărul de zile și verificăm durata minimă de închiriere (`min_rental_days`)
  const totalDays = Math.max(
    1,
    Math.round((endMs - startMs) / (1000 * 60 * 60 * 24)) + 1
  );

  const minRentalDays = Math.max(1, Number(listing.min_rental_days ?? 1));
  if (totalDays < minRentalDays) {
    return errorResponse(
      `Durata minimă de închiriere pentru acest obiect este de ${minRentalDays} zile (ai selectat ${totalDays} ${
        totalDays === 1 ? "zi" : "zile"
      }).`
    );
  }

  const pricePerDay = Number(listing.price_per_day);
  const totalPriceRon = Math.round(totalDays * pricePerDay * 100) / 100;
  const platformFeeRon = Math.round(totalPriceRon * 0.1 * 100) / 100;

  // 6. Verificăm suprapunerea cu rezervări deja confirmate
  const { data: overlappingBookings } = await supabase
    .from("bookings")
    .select("id, booking_code, start_date, end_date")
    .eq("listing_id", listingId)
    .eq("status", "confirmed")
    .lte("start_date", endDate)
    .gte("end_date", startDate);

  if (overlappingBookings && overlappingBookings.length > 0) {
    const conflict = overlappingBookings[0];
    return errorResponse(
      `Obiectul este deja rezervat și confirmat în intervalul ${conflict.start_date} — ${conflict.end_date}. Te rugăm să alegi alte zile.`
    );
  }

  // 7. Safety Upsert pentru profilul chiriașului (doar coloane publice!)
  const { data: existingProfile } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", user.id)
    .maybeSingle();

  if (!existingProfile) {
    const meta = user.user_metadata ?? {};
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
        city:
          (typeof meta.city === "string" && meta.city.trim()) || "București",
      },
      { onConflict: "id" }
    );
  }

  // 8. Inserăm rezervarea în `public.bookings`
  const { data: createdBooking, error: insertError } = await supabase
    .from("bookings")
    .insert({
      listing_id: listingId,
      renter_id: user.id,
      owner_id: listing.owner_id,
      start_date: startDate,
      end_date: endDate,
      total_days: totalDays,
      total_price_ron: totalPriceRon,
      platform_fee_ron: platformFeeRon,
      status: "pending",
      notes: notes && notes.length > 0 ? notes : null,
    })
    .select("*")
    .single();

  if (insertError || !createdBooking) {
    if (insertError?.code === "23P01") {
      return errorResponse(
        "Acest interval tocmai a fost confirmat pentru o altă rezervare. Te rugăm să alegi alte zile."
      );
    }
    return errorResponse(
      `Eroare la înregistrarea cererii de rezervare: ${
        insertError?.message ?? "Răspuns gol de la baza de date"
      }`
    );
  }

  const booking = {
    ...createdBooking,
    total_days: Number(createdBooking.total_days),
    total_price_ron: Number(createdBooking.total_price_ron),
    platform_fee_ron: Number(createdBooking.platform_fee_ron),
  } as Booking;

  // Notificăm non-blocant proprietarul despre noua cerere de rezervare (Faza 13 / M13.2)
  await dispatchNotification({
    userId: String(listing.owner_id),
    type: "booking_created",
    title: `Cerere nouă de rezervare (${booking.booking_code})`,
    body: `Ai primit o cerere nouă pentru „${listing.title}” în perioada ${startDate} — ${endDate} (${totalDays} ${
      totalDays === 1 ? "zi" : "zile"
    }, ${totalPriceRon} RON).`,
    actionUrl: "/rezervarile-mele",
    bookingId: booking.id,
  });

  revalidatePath(`/obiect/${listingId}`);
  revalidatePath("/rezervarile-mele");

  return successResponse(
    `Cererea de rezervare ${booking.booking_code} (${totalDays} zile — ${totalPriceRon} RON) a fost trimisă proprietarului!`,
    booking
  );
}

/**
 * 2. ACTUALIZARE STATUS REZERVARE (`updateBookingStatusAction`)
 *
 * Verifică graful de tranziție (State Machine):
 * - `pending` -> `confirmed` | `rejected` | `cancelled`
 * - `confirmed` -> `completed` | `cancelled`
 * - Stările terminale (`rejected`, `completed`, `cancelled`) nu mai pot fi modificate.
 * Tratează și eroarea PostgreSQL `23P01` (constrângerea GiST `bookings_no_overlapping_confirmed`)
 * dacă proprietarul încearcă să confirme două cereri care se suprapun.
 */
export async function updateBookingStatusAction(
  bookingId: string,
  nextStatus: "confirmed" | "rejected" | "completed" | "cancelled"
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

  if (!bookingId) {
    return errorResponse("ID-ul rezervării lipsește.");
  }

  const allowedStatuses: BookingStatus[] = [
    "confirmed",
    "rejected",
    "completed",
    "cancelled",
  ];
  if (!allowedStatuses.includes(nextStatus)) {
    return errorResponse("Statusul solicitat este invalid.");
  }

  const { data: booking, error: fetchError } = await supabase
    .from("bookings")
    .select("*")
    .eq("id", bookingId)
    .maybeSingle();

  if (fetchError || !booking) {
    return errorResponse("Rezervarea nu a fost găsită în baza de date.");
  }

  const isOwner = booking.owner_id === user.id;
  const isRenter = booking.renter_id === user.id;

  if (!isOwner && !isRenter) {
    return errorResponse(
      "Nu ai permisiunea de a modifica această cerere de rezervare."
    );
  }

  const currentStatus = booking.status as BookingStatus;

  // 1. Verificăm că rezervarea nu se află deja într-o stare terminală
  if (
    currentStatus === "rejected" ||
    currentStatus === "completed" ||
    currentStatus === "cancelled"
  ) {
    return errorResponse(
      `Această rezervare se află deja într-o stare finală (${currentStatus}) și nu mai poate fi modificată.`
    );
  }

  // 2. Verificăm tranzițiile legale din starea curentă
  if (
    currentStatus === "pending" &&
    nextStatus !== "confirmed" &&
    nextStatus !== "rejected" &&
    nextStatus !== "cancelled"
  ) {
    return errorResponse(
      `Tranziție invalidă din starea 'În așteptare' (pending) în '${nextStatus}'.`
    );
  }

  if (
    currentStatus === "confirmed" &&
    nextStatus !== "completed" &&
    nextStatus !== "cancelled"
  ) {
    return errorResponse(
      `Tranziție invalidă din starea 'Confirmată' (confirmed) în '${nextStatus}'.`
    );
  }

  // 3. Verificăm permisiunile per rol
  if (
    (nextStatus === "confirmed" ||
      nextStatus === "rejected" ||
      nextStatus === "completed") &&
    !isOwner
  ) {
    return errorResponse(
      "Doar proprietarul obiectului poate aproba, respinge sau finaliza o rezervare."
    );
  }

  const { error: updateError } = await supabase
    .from("bookings")
    .update({ status: nextStatus })
    .eq("id", bookingId);

  if (updateError) {
    // Codul SQLSTATE 23P01 = Exclusion Violation (constrângerea GiST anti double-booking)
    if (updateError.code === "23P01") {
      return errorResponse(
        "Nu poți confirma această cerere deoarece există deja o altă rezervare confirmată care se suprapune pe aceleași zile!"
      );
    }
    return errorResponse(
      `Eroare la actualizarea statusului rezervării: ${updateError.message}`
    );
  }

  // Trimitem notificare non-blocantă către destinatarul relevant (Faza 13 / M13.2)
  const notificationConfig: Record<
    "confirmed" | "rejected" | "completed" | "cancelled",
    {
      userId: string;
      type:
        | "booking_confirmed"
        | "booking_rejected"
        | "booking_completed"
        | "booking_cancelled";
      title: string;
      body: string;
    }
  > = {
    confirmed: {
      userId: String(booking.renter_id),
      type: "booking_confirmed",
      title: `Rezervare confirmată (${booking.booking_code})`,
      body: `Proprietarul a confirmat rezervarea ${booking.booking_code}. Poți continua cu plata securizată Escrow și poți vedea datele de contact.`,
    },
    rejected: {
      userId: String(booking.renter_id),
      type: "booking_rejected",
      title: `Cerere de rezervare respinsă (${booking.booking_code})`,
      body: `Cererea ta de rezervare ${booking.booking_code} a fost respinsă de proprietar. Poți alege alte date sau un obiect similar din catalog.`,
    },
    completed: {
      userId: String(booking.renter_id),
      type: "booking_completed",
      title: `Închiriere finalizată (${booking.booking_code})`,
      body: `Închirierea ${booking.booking_code} a fost marcată ca finalizată. Acum poți lăsa o recenzie și poți urmări eliberarea garanției.`,
    },
    cancelled: {
      userId: isOwner ? String(booking.renter_id) : String(booking.owner_id),
      type: "booking_cancelled",
      title: `Rezervare anulată (${booking.booking_code})`,
      body: `Rezervarea ${booking.booking_code} a fost anulată de ${
        isOwner ? "proprietar" : "chiriaș"
      }.`,
    },
  };

  const notif = notificationConfig[nextStatus];
  await dispatchNotification({
    userId: notif.userId,
    type: notif.type,
    title: notif.title,
    body: notif.body,
    actionUrl: "/rezervarile-mele",
    bookingId: String(booking.id),
  });

  revalidatePath("/rezervarile-mele");
  revalidatePath(`/obiect/${booking.listing_id}`);

  const statusMessages: Record<
    "confirmed" | "rejected" | "completed" | "cancelled",
    string
  > = {
    confirmed: `Rezervarea ${booking.booking_code} a fost CONFIRMATĂ. Numărul de telefon de contact este acum vizibil pentru ambele părți.`,
    rejected: `Cererea de rezervare ${booking.booking_code} a fost RESPINSĂ.`,
    completed: `Închirierea ${booking.booking_code} a fost marcată ca FINALIZATĂ. Acum se pot acorda recenzii!`,
    cancelled: `Rezervarea ${booking.booking_code} a fost ANULATĂ.`,
  };

  return successResponse(statusMessages[nextStatus]);
}

/**
 * Helper intern: normalizează un rând brut din `public.bookings`.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapRowToBookingWithDetails(row: any): BookingWithDetails {
  const rawListing = Array.isArray(row.listing) ? row.listing[0] : row.listing;
  const rawRenter = Array.isArray(row.renter) ? row.renter[0] : row.renter;
  const rawOwner = Array.isArray(row.owner) ? row.owner[0] : row.owner;

  const listingImages: ListingImage[] = Array.isArray(rawListing?.images)
    ? [...(rawListing.images as ListingImage[])].sort(
        (a, b) => (a.display_order ?? 0) - (b.display_order ?? 0)
      )
    : [];

  const normalizeParticipant = (
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    raw: any,
    fallbackId: string,
    fallbackLabel: string
  ): Pick<
    Profile,
    | "id"
    | "display_name"
    | "account_type"
    | "city"
    | "avatar_url"
    | "phone_verified"
    | "kyb_verified"
    | "rating_avg"
    | "rating_count"
    | "company_cui"
    | "phone"
  > => ({
    id: raw?.id ?? fallbackId,
    display_name: raw?.display_name ?? fallbackLabel,
    account_type: raw?.account_type === "company" ? "company" : "individual",
    city: raw?.city ?? "București",
    avatar_url: raw?.avatar_url ?? null,
    phone_verified: Boolean(raw?.phone_verified ?? false),
    kyb_verified: Boolean(raw?.kyb_verified ?? false),
    rating_avg:
      raw?.rating_avg !== null && raw?.rating_avg !== undefined
        ? Number(raw.rating_avg)
        : null,
    rating_count: Number(raw?.rating_count ?? 0),
    company_cui: null,
    phone: null,
  });

  return {
    id: row.id,
    booking_code: row.booking_code,
    listing_id: row.listing_id,
    renter_id: row.renter_id,
    owner_id: row.owner_id,
    start_date: row.start_date,
    end_date: row.end_date,
    total_days: Number(row.total_days),
    total_price_ron: Number(row.total_price_ron),
    platform_fee_ron: Number(row.platform_fee_ron),
    status: row.status,
    notes: row.notes ?? null,
    created_at: row.created_at,
    listing: {
      id: rawListing?.id ?? row.listing_id,
      catalog_code: rawListing?.catalog_code ?? "#OBJ-0000",
      title: rawListing?.title ?? "Obiect din catalog",
      price_per_day: Number(rawListing?.price_per_day ?? 0),
      city: rawListing?.city ?? "București",
      category: rawListing?.category ?? "altele",
      primary_image_url: listingImages[0]?.url ?? null,
      images: listingImages,
    },
    renter: normalizeParticipant(rawRenter, row.renter_id, "Chiriaș RentA"),
    owner: normalizeParticipant(rawOwner, row.owner_id, "Proprietar RentA"),
    partner_phone: null,
    payment: null,
  };
}

/**
 * 3. INTEROGARE REZERVĂRI PROPRII (`getMyBookingsAction`)
 *
 * Pentru fiecare rezervare aflată în starea `'confirmed'` sau `'completed'`,
 * apelează funcția RPC `get_booking_partner_phone` pentru a atașa telefonul
 * partenerului pe DTO (`partner_phone`), păstrând numerele de telefon complet
 * ascunse pentru cererile `pending`, `rejected` sau `cancelled`.
 */
export async function getMyBookingsAction(): Promise<{
  incoming: BookingWithDetails[];
  outgoing: BookingWithDetails[];
}> {
  const { isConfigured } = getSupabaseEnv();
  if (!isConfigured) {
    return { incoming: [], outgoing: [] };
  }

  const supabase = await createClient();
  if (!supabase) {
    return { incoming: [], outgoing: [] };
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { incoming: [], outgoing: [] };
  }

  const selectQuery = `
    *,
    listing:listings(id, catalog_code, title, price_per_day, city, category, images:listing_images(*)),
    renter:profiles!bookings_renter_id_fkey(${PUBLIC_PARTICIPANT_SELECT}),
    owner:profiles!bookings_owner_id_fkey(${PUBLIC_PARTICIPANT_SELECT})
  `;

  const [incomingRes, outgoingRes] = await Promise.all([
    supabase
      .from("bookings")
      .select(selectQuery)
      .eq("owner_id", user.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("bookings")
      .select(selectQuery)
      .eq("renter_id", user.id)
      .order("created_at", { ascending: false }),
  ]);

  const incomingRaw = Array.isArray(incomingRes.data)
    ? incomingRes.data.map(mapRowToBookingWithDetails)
    : [];

  const outgoingRaw = Array.isArray(outgoingRes.data)
    ? outgoingRes.data.map(mapRowToBookingWithDetails)
    : [];

  // Atașăm numărul de telefon prin RPC doar pentru rezervările 'confirmed' sau 'completed'
  const attachPartnerPhones = async (
    list: BookingWithDetails[],
    partnerRole: "renter" | "owner"
  ): Promise<BookingWithDetails[]> => {
    return Promise.all(
      list.map(async (b) => {
        if (b.status !== "confirmed" && b.status !== "completed") {
          return b;
        }
        try {
          const { data: phoneData } = await supabase.rpc(
            "get_booking_partner_phone",
            {
              p_booking_id: b.id,
            }
          );
          const resolvedPhone =
            typeof phoneData === "string" && phoneData.trim().length > 0
              ? phoneData.trim()
              : null;

          return {
            ...b,
            partner_phone: resolvedPhone,
            renter:
              partnerRole === "renter"
                ? { ...b.renter, phone: resolvedPhone }
                : b.renter,
            owner:
              partnerRole === "owner"
                ? { ...b.owner, phone: resolvedPhone }
                : b.owner,
          };
        } catch {
          return b;
        }
      })
    );
  };

  const [incomingWithPhones, outgoingWithPhones] = await Promise.all([
    attachPartnerPhones(incomingRaw, "renter"),
    attachPartnerPhones(outgoingRaw, "owner"),
  ]);

  // Atașăm înregistrările de plată Escrow din `public.payments` (Faza 11).
  // Blocul try/catch asigură că pagina `/rezervarile-mele` rămâne 100% funcțională
  // chiar și înainte ca utilizatorul să ruleze migrația 004_payments_and_escrow.sql.
  const allBookingIds = [
    ...incomingWithPhones.map((b) => b.id),
    ...outgoingWithPhones.map((b) => b.id),
  ];

  const paymentsMap = new Map<string, PaymentRecord>();
  if (allBookingIds.length > 0) {
    try {
      const { data: paymentsData, error: paymentsError } = await supabase
        .from("payments")
        .select("*")
        .in("booking_id", allBookingIds);

      if (!paymentsError && Array.isArray(paymentsData)) {
        for (const row of paymentsData) {
          paymentsMap.set(String(row.booking_id), {
            id: String(row.id),
            booking_id: String(row.booking_id),
            renter_id: String(row.renter_id),
            owner_id: String(row.owner_id),
            mode: row.mode === "stripe" ? "stripe" : "sandbox",
            currency: String(row.currency ?? "RON"),
            rental_amount_ron: Number(row.rental_amount_ron ?? 0),
            platform_fee_ron: Number(row.platform_fee_ron ?? 0),
            owner_payout_ron: Number(row.owner_payout_ron ?? 0),
            deposit_amount_ron: Number(row.deposit_amount_ron ?? 0),
            total_charged_ron: Number(row.total_charged_ron ?? 0),
            stripe_checkout_session_id: row.stripe_checkout_session_id ?? null,
            stripe_payment_intent_id: row.stripe_payment_intent_id ?? null,
            stripe_deposit_intent_id: row.stripe_deposit_intent_id ?? null,
            payment_status: row.payment_status ?? "unpaid",
            deposit_status: row.deposit_status ?? "none",
            paid_at: row.paid_at ?? null,
            released_at: row.released_at ?? null,
            created_at: String(row.created_at),
            updated_at: String(row.updated_at),
          });
        }
      }
    } catch {
      // Ignorăm silențios dacă tabelul `public.payments` nu există încă în DB
    }
  }

  const incoming = incomingWithPhones.map((b) => ({
    ...b,
    payment: paymentsMap.get(b.id) ?? null,
  }));

  const outgoing = outgoingWithPhones.map((b) => ({
    ...b,
    payment: paymentsMap.get(b.id) ?? null,
  }));

  return { incoming, outgoing };
}
