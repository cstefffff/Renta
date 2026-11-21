-- ============================================================================
-- RentA (Faza 13 / M13.2) — Migrația 006: Notificări In-App & Emailuri Tranzacționale
-- ============================================================================
-- Analogie pentru dezvoltatori C / Java:
--   1. Tabelul `public.notifications` este echivalentul unei cozi persistente de
--      mesaje/notificări per utilizator (Inbox / Notification Feed din Spring Boot).
--   2. Row Level Security (RLS) garantează că fiecare utilizator își poate citi,
--      marca drept citite sau șterge STRICT propriile notificări (`auth.uid() = user_id`),
--      fără a putea insera direct notificări false în inbox-ul altor utilizatori.
--   3. Funcția RPC `public.create_system_notification(...)` marcată `SECURITY DEFINER`
--      acționează ca un serviciu intern privilegiat (`NotificationService.dispatch`)
--      care permite serverului (în numele utilizatorului autentificat care declanșează
--      un eveniment, ex: chiriașul care creează o rezervare) să insereze o notificare
--      în inbox-ul destinatarului (ex: proprietarul), fără a slăbi politicile RLS.
-- ============================================================================

-- ============================================================================
-- 1. TABELUL `public.notifications`
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (
    type IN (
      'booking_created',
      'booking_confirmed',
      'booking_rejected',
      'booking_completed',
      'booking_cancelled',
      'payment_paid',
      'payment_released',
      'dispute_opened',
      'review_received',
      'system'
    )
  ),
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  action_url TEXT NULL,
  booking_id UUID NULL REFERENCES public.bookings(id) ON DELETE SET NULL,
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  email_sent BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index compus pentru listarea rapidă a notificărilor necitite și a celor mai recente
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread
  ON public.notifications (user_id, is_read, created_at DESC);

-- ============================================================================
-- 2. POLITICI ROW LEVEL SECURITY (RLS STRICT PER UTILIZATOR)
-- ============================================================================
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "notifications_select_own" ON public.notifications;
CREATE POLICY "notifications_select_own"
  ON public.notifications
  FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "notifications_update_own" ON public.notifications;
CREATE POLICY "notifications_update_own"
  ON public.notifications
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "notifications_delete_own" ON public.notifications;
CREATE POLICY "notifications_delete_own"
  ON public.notifications
  FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================================================
-- 3. FUNCȚIE RPC `SECURITY DEFINER`: `public.create_system_notification`
-- ============================================================================
-- Permite inserarea controlată a unei notificări către orice destinatar valid
-- din `public.profiles` atunci când acțiunea este inițiată de un utilizator
-- autentificat (ex: chiriaș -> proprietar la creare rezervare sau plată).
CREATE OR REPLACE FUNCTION public.create_system_notification(
  p_user_id UUID,
  p_type TEXT,
  p_title TEXT,
  p_body TEXT,
  p_action_url TEXT DEFAULT NULL,
  p_booking_id UUID DEFAULT NULL,
  p_email_sent BOOLEAN DEFAULT FALSE
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id UUID;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Neautentificat';
  END IF;

  INSERT INTO public.notifications (
    user_id,
    type,
    title,
    body,
    action_url,
    booking_id,
    email_sent
  )
  VALUES (
    p_user_id,
    p_type,
    p_title,
    p_body,
    p_action_url,
    p_booking_id,
    COALESCE(p_email_sent, FALSE)
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.create_system_notification(UUID, TEXT, TEXT, TEXT, TEXT, UUID, BOOLEAN) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_system_notification(UUID, TEXT, TEXT, TEXT, TEXT, UUID, BOOLEAN) TO authenticated;
