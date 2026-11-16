"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSupabaseEnv } from "@/lib/supabase/config";
import { checkRateLimit } from "@/lib/security/rate-limit";
import {
  formatZodIssues,
  signUpSchema,
  updateProfileSchema,
} from "@/lib/validations/profile";
import type {
  AccountType,
  ActionResponse,
  Profile,
  ProfilePrivate,
} from "@/lib/types/database";

/**
 * ============================================================================
 * RentA (Valul 1 Comercial) — Server Actions pentru Autentificare și Profil
 * (`app/actions/auth.ts`)
 * ============================================================================
 *
 * Explicație pentru dezvoltatori C / Java (Faza 10 — Separare PII):
 * - Datele publice ale utilizatorului (`display_name`, `account_type`, `city`,
 *   `bio`, `avatar_url`, `phone_verified`, `kyb_verified`, `rating_avg`, `rating_count`)
 *   locuiesc în `public.profiles`.
 * - Datele cu caracter personal / fiscal (`phone`, `company_cui`, `role`)
 *   locuiesc în `public.profile_private`, protejate de RLS strict (`auth.uid() = id`).
 */

const MAX_AVATAR_SIZE_BYTES = 2 * 1024 * 1024; // 2 MB

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

function translateAuthError(rawMessage: string): string {
  const msg = rawMessage.toLowerCase();

  if (msg.includes("invalid login credentials")) {
    return "Emailul sau parola introduse sunt incorecte.";
  }
  if (msg.includes("email not confirmed")) {
    return "Adresa de email nu a fost încă confirmată. Verifică inbox-ul (sau dezactivează 'Confirm email' în Supabase Auth -> Providers -> Email pentru testare rapidă).";
  }
  if (msg.includes("user already registered")) {
    return "Există deja un cont înregistrat cu această adresă de email.";
  }
  if (msg.includes("password should be at least")) {
    return "Parola trebuie să conțină cel puțin 6 caractere.";
  }
  if (msg.includes("rate limit") || msg.includes("too many requests")) {
    return "Prea multe încercări într-un timp scurt. Te rugăm să aștepți un minut.";
  }

  return `Eroare la autentificare: ${rawMessage}`;
}

/**
 * 1. ÎNREGISTRARE CONT NOU (`signUpAction`)
 */
export async function signUpAction(
  formData: FormData
): Promise<
  ActionResponse<{ requiresEmailConfirmation?: boolean; userId?: string }>
> {
  const { siteUrl, isConfigured } = getSupabaseEnv();

  if (!isConfigured) {
    return errorResponse(
      "Conexiunea Supabase nu este configurată. Completează NEXT_PUBLIC_SUPABASE_URL și NEXT_PUBLIC_SUPABASE_ANON_KEY în fișierul .env.local."
    );
  }

  const rawEmail = String(formData.get("email") ?? "").trim().toLowerCase();
  const rawPassword = String(formData.get("password") ?? "");
  const rawDisplayName = String(formData.get("display_name") ?? "").trim();
  const rawAccountType =
    String(formData.get("account_type") ?? "individual").trim() === "company"
      ? "company"
      : "individual";
  const rawCity =
    String(formData.get("city") ?? "București").trim() || "București";
  const rawCompanyCui = String(formData.get("company_cui") ?? "").trim();
  const rawPhone = String(formData.get("phone") ?? "").trim();

  // Protecție Rate Limiting pe înregistrare (max 5 încercări / minut per email)
  const rl = checkRateLimit(`auth:signup:${rawEmail || "anon"}`, 5, 60_000);
  if (!rl.allowed) {
    return errorResponse(
      `Prea multe încercări de înregistrare. Te rugăm să aștepți ${rl.retryAfterSeconds} secunde.`
    );
  }

  // Validare cu schema Zod
  const parsed = signUpSchema.safeParse({
    email: rawEmail,
    password: rawPassword,
    display_name: rawDisplayName,
    account_type: rawAccountType,
    city: rawCity,
    company_cui: rawCompanyCui || null,
    phone: rawPhone || null,
  });

  if (!parsed.success) {
    const { firstMessage, fieldErrors } = formatZodIssues(parsed.error.issues);
    return errorResponse(firstMessage, fieldErrors);
  }

  const {
    email,
    password,
    display_name: displayName,
    account_type: accountType,
    city,
    company_cui: companyCui,
    phone,
  } = parsed.data;

  const supabase = await createClient();
  if (!supabase) {
    return errorResponse("Clientul Supabase nu a putut fi inițializat pe server.");
  }

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${siteUrl}/auth/callback`,
      data: {
        display_name: displayName,
        account_type: accountType,
        city,
        company_cui: accountType === "company" && companyCui ? companyCui : null,
        phone: phone || null,
      },
    },
  });

  if (error) {
    return errorResponse(translateAuthError(error.message));
  }

  // Dacă utilizatorul este autentificat imediat (Confirm email = OFF),
  // sincronizăm atât `public.profiles` (date publice), cât și `public.profile_private` (PII).
  if (data.user && data.session) {
    await supabase.from("profiles").upsert(
      {
        id: data.user.id,
        display_name: displayName,
        account_type: accountType as AccountType,
        city,
      },
      { onConflict: "id" }
    );

    await supabase.from("profile_private").upsert(
      {
        id: data.user.id,
        phone: phone || null,
        company_cui:
          accountType === "company" && companyCui ? companyCui : null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "id" }
    );

    revalidatePath("/", "layout");

    return successResponse(
      "Contul a fost creat și ești acum autentificat în catalogul RentA!",
      {
        requiresEmailConfirmation: false,
        userId: data.user.id,
      }
    );
  }

  revalidatePath("/", "layout");

  return successResponse(
    "Contul a fost creat! Verifică adresa de email pentru linkul de activare (sau autentifică-te direct dacă ai dezactivat confirmarea de email în Supabase).",
    {
      requiresEmailConfirmation: true,
      userId: data.user?.id,
    }
  );
}

/**
 * 2. AUTENTIFICARE CONT EXISTENT (`signInAction`)
 */
export async function signInAction(
  formData: FormData
): Promise<ActionResponse<{ redirectTo: string }>> {
  const { isConfigured } = getSupabaseEnv();

  if (!isConfigured) {
    return errorResponse(
      "Conexiunea Supabase nu este configurată în .env.local. Vezi ghidul SUPABASE_SETUP_DE_LA_ZERO.md."
    );
  }

  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const redirectTo =
    String(formData.get("redirectTo") ?? "/profil").trim() || "/profil";

  if (!email || !password) {
    return errorResponse(
      "Te rugăm să completezi atât adresa de email, cât și parola."
    );
  }

  const rl = checkRateLimit(`auth:signin:${email}`, 10, 60_000);
  if (!rl.allowed) {
    return errorResponse(
      `Prea multe încercări de autentificare. Încearcă din nou peste ${rl.retryAfterSeconds} secunde.`
    );
  }

  const supabase = await createClient();
  if (!supabase) {
    return errorResponse("Clientul Supabase nu a putut fi inițializat.");
  }

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    return errorResponse(translateAuthError(error.message));
  }

  revalidatePath("/", "layout");

  return successResponse(
    "Autentificare reușită! Redirecționare către profil...",
    {
      redirectTo,
    }
  );
}

/**
 * 3. DELOGARE (`signOutAction`)
 */
export async function signOutAction(): Promise<void> {
  const supabase = await createClient();

  if (supabase) {
    await supabase.auth.signOut();
  }

  revalidatePath("/", "layout");
  redirect("/login");
}

/**
 * 4. ACTUALIZARE PROFIL (`updateProfileAction`)
 *
 * Validează datele cu `updateProfileSchema`, încarcă opțional noul avatar în
 * bucket-ul `avatars`, actualizează coloanele publice în `public.profiles` și
 * actualizează separat datele sensibile (`phone`, `company_cui`) în `public.profile_private`.
 */
export async function updateProfileAction(
  formData: FormData
): Promise<ActionResponse<Profile>> {
  const { isConfigured } = getSupabaseEnv();

  if (!isConfigured) {
    return errorResponse(
      "Conexiunea Supabase nu este configurată în .env.local."
    );
  }

  const supabase = await createClient();
  if (!supabase) {
    return errorResponse("Clientul Supabase nu este disponibil.");
  }

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return errorResponse(
      "Sesiunea ta a expirat sau nu ești autentificat. Te rugăm să te reconectezi."
    );
  }

  const rl = checkRateLimit(`profile:update:${user.id}`, 10, 60_000);
  if (!rl.allowed) {
    return errorResponse(
      `Prea multe actualizări consecutive. Așteaptă ${rl.retryAfterSeconds} secunde.`
    );
  }

  const rawDisplayName = String(formData.get("display_name") ?? "").trim();
  const rawAccountType =
    String(formData.get("account_type") ?? "individual").trim() === "company"
      ? "company"
      : "individual";
  const rawCity =
    String(formData.get("city") ?? "București").trim() || "București";
  const rawBio = String(formData.get("bio") ?? "").trim();
  const rawCompanyCui = String(formData.get("company_cui") ?? "").trim();
  const rawPhone = String(formData.get("phone") ?? "").trim();

  const parsed = updateProfileSchema.safeParse({
    display_name: rawDisplayName,
    account_type: rawAccountType,
    city: rawCity,
    bio: rawBio || null,
    company_cui: rawCompanyCui || null,
    phone: rawPhone || null,
  });

  if (!parsed.success) {
    const { firstMessage, fieldErrors } = formatZodIssues(parsed.error.issues);
    return errorResponse(firstMessage, fieldErrors);
  }

  const {
    display_name: displayName,
    account_type: accountType,
    city,
    bio,
    company_cui: companyCui,
    phone,
  } = parsed.data;

  // Upload opțional avatar dacă există un fișier `avatar` în FormData
  let uploadedAvatarUrl: string | undefined;
  const avatarEntry = formData.get("avatar");

  if (avatarEntry instanceof File && avatarEntry.size > 0) {
    if (avatarEntry.size > MAX_AVATAR_SIZE_BYTES) {
      return errorResponse("Imaginea de avatar nu poate depăși 2 MB.");
    }

    const ext =
      avatarEntry.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") ||
      "jpg";
    const avatarPath = `${user.id}/avatar-${Date.now()}.${ext}`;

    const { error: uploadErr } = await supabase.storage
      .from("avatars")
      .upload(avatarPath, avatarEntry, {
        cacheControl: "3600",
        upsert: true,
        contentType: avatarEntry.type || "image/jpeg",
      });

    if (!uploadErr) {
      const { data: pubData } = supabase.storage
        .from("avatars")
        .getPublicUrl(avatarPath);
      if (pubData?.publicUrl) {
        uploadedAvatarUrl = pubData.publicUrl;
      }
    }
  }

  // 1. Actualizăm tabelul public `public.profiles` (DOAR coloane publice!)
  const publicUpdatePayload: Record<string, unknown> = {
    id: user.id,
    display_name: displayName,
    account_type: accountType as AccountType,
    city,
    bio: bio || null,
    updated_at: new Date().toISOString(),
  };

  if (uploadedAvatarUrl) {
    publicUpdatePayload.avatar_url = uploadedAvatarUrl;
  }

  const { data: updatedPublicProfile, error: updatePublicError } =
    await supabase
      .from("profiles")
      .upsert(publicUpdatePayload, { onConflict: "id" })
      .select(
        "id, display_name, account_type, city, bio, avatar_url, phone_verified, kyb_verified, rating_avg, rating_count, created_at, updated_at"
      )
      .single();

  if (updatePublicError || !updatedPublicProfile) {
    return errorResponse(
      `Eroare la salvarea profilului public: ${
        updatePublicError?.message ?? "Răspuns gol"
      }`
    );
  }

  // 2. Actualizăm separat tabelul izolat `public.profile_private` (`phone`, `company_cui`)
  const resolvedCui =
    accountType === "company" && companyCui ? companyCui : null;
  const resolvedPhone = phone || null;

  const { error: updatePrivateError } = await supabase
    .from("profile_private")
    .upsert(
      {
        id: user.id,
        phone: resolvedPhone,
        company_cui: resolvedCui,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "id" }
    );

  if (updatePrivateError) {
    return errorResponse(
      `Profilul public a fost salvat, dar datele private (telefon/CUI) au întâmpinat o eroare: ${updatePrivateError.message}`
    );
  }

  revalidatePath("/profil");
  revalidatePath("/", "layout");

  const mergedProfile: Profile = {
    ...(updatedPublicProfile as Profile),
    rating_avg:
      updatedPublicProfile.rating_avg !== null &&
      updatedPublicProfile.rating_avg !== undefined
        ? Number(updatedPublicProfile.rating_avg)
        : null,
    rating_count: Number(updatedPublicProfile.rating_count ?? 0),
    phone: resolvedPhone,
    company_cui: resolvedCui,
  };

  return successResponse(
    "Fișa de profil și datele private au fost actualizate cu succes în registrul RentA.",
    mergedProfile
  );
}

/**
 * 5. CITIRE PROFIL COMPLET PENTRU UTILIZATORUL AUTENTIFICAT (`getMyFullProfile`)
 *
 * Interoghează în paralel `public.profiles` (date publice) și `public.profile_private`
 * (date PII izolate GDPR: `phone`, `company_cui`, `role`) pentru contul propriu.
 */
export async function getMyFullProfile(): Promise<{
  profile: Profile;
  privateData: ProfilePrivate | null;
  email: string;
} | null> {
  const supabase = await createClient();
  if (!supabase) {
    return null;
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  const [publicRes, privateRes] = await Promise.all([
    supabase
      .from("profiles")
      .select(
        "id, display_name, account_type, city, bio, avatar_url, phone_verified, kyb_verified, rating_avg, rating_count, created_at, updated_at"
      )
      .eq("id", user.id)
      .maybeSingle(),
    supabase
      .from("profile_private")
      .select("id, phone, company_cui, phone_verified, role, updated_at")
      .eq("id", user.id)
      .maybeSingle(),
  ]);

  const meta = user.user_metadata ?? {};
  const privateData: ProfilePrivate | null = privateRes.data
    ? (privateRes.data as ProfilePrivate)
    : null;

  const rawPublic = publicRes.data;
  const profile: Profile = {
    id: user.id,
    display_name:
      rawPublic?.display_name ??
      meta.display_name ??
      user.email?.split("@")[0] ??
      "Utilizator RentA",
    account_type:
      (rawPublic?.account_type as AccountType) ??
      (meta.account_type === "company" ? "company" : "individual"),
    city: rawPublic?.city ?? meta.city ?? "București",
    bio: rawPublic?.bio ?? null,
    avatar_url: rawPublic?.avatar_url ?? null,
    phone_verified: Boolean(
      rawPublic?.phone_verified ?? privateData?.phone_verified ?? false
    ),
    kyb_verified: Boolean(rawPublic?.kyb_verified ?? false),
    rating_avg:
      rawPublic?.rating_avg !== null && rawPublic?.rating_avg !== undefined
        ? Number(rawPublic.rating_avg)
        : null,
    rating_count: Number(rawPublic?.rating_count ?? 0),
    created_at: rawPublic?.created_at ?? new Date().toISOString(),
    updated_at: rawPublic?.updated_at ?? new Date().toISOString(),
    phone: privateData?.phone ?? (meta.phone as string | undefined) ?? null,
    company_cui:
      privateData?.company_cui ??
      (meta.company_cui as string | undefined) ??
      null,
  };

  return {
    profile,
    privateData,
    email: user.email ?? "",
  };
}

/**
 * 6. CITIRE PROFIL CURENT (`getCurrentProfile`)
 */
export async function getCurrentProfile(): Promise<Profile | null> {
  const full = await getMyFullProfile();
  return full ? full.profile : null;
}
