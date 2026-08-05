-- ============================================================
-- COUNSELOR ROLE: Supervisory layer over Mentors and Students
-- ============================================================

-- ─── 1. Add counselor_id to user_profiles (links mentors to counselors) ──────
ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS counselor_id UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS counselor_invite_code TEXT;

-- ─── 2. Update handle_new_user trigger to support counselor role ──────────────
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_role TEXT;
  v_mentor_code TEXT;
BEGIN
  v_role := COALESCE(NEW.raw_user_meta_data->>'role', 'mentor');

  -- Generate mentor_code only for mentors
  IF v_role = 'mentor' THEN
    v_mentor_code := upper(substring(replace(gen_random_uuid()::text, '-', ''), 1, 8));
  ELSE
    v_mentor_code := NULL;
  END IF;

  INSERT INTO public.user_profiles (id, email, full_name, role, mentor_code, mentor_pillars)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    v_role,
    v_mentor_code,
    ARRAY[]::TEXT[]
  )
  ON CONFLICT (id) DO UPDATE SET
    email       = EXCLUDED.email,
    full_name   = COALESCE(EXCLUDED.full_name, public.user_profiles.full_name),
    role        = COALESCE(EXCLUDED.role, public.user_profiles.role),
    mentor_code = COALESCE(EXCLUDED.mentor_code, public.user_profiles.mentor_code),
    updated_at  = CURRENT_TIMESTAMP;

  RETURN NEW;
END;
$$;

GRANT EXECUTE ON FUNCTION public.handle_new_user() TO service_role;

-- ─── 3. Function: generate unique counselor invite code ──────────────────────
CREATE OR REPLACE FUNCTION public.generate_counselor_invite_code()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_code TEXT;
  v_exists BOOLEAN;
BEGIN
  LOOP
    v_code := 'C-' || upper(substring(replace(gen_random_uuid()::text, '-', ''), 1, 6));
    SELECT EXISTS(
      SELECT 1 FROM public.user_profiles WHERE counselor_invite_code = v_code
    ) INTO v_exists;
    EXIT WHEN NOT v_exists;
  END LOOP;
  RETURN v_code;
END;
$$;

GRANT EXECUTE ON FUNCTION public.generate_counselor_invite_code() TO authenticated;

-- ─── 4. RPC: Counselor generates invite code for a new mentor ────────────────
CREATE OR REPLACE FUNCTION public.counselor_generate_mentor_invite()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_counselor_id UUID;
  v_invite_code TEXT;
BEGIN
  v_counselor_id := auth.uid();

  IF public.get_my_role() != 'counselor' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Only counselors can generate mentor invite codes.');
  END IF;

  v_invite_code := public.generate_counselor_invite_code();

  -- Store the invite code on the counselor's own profile as a pending invite
  -- We store it in a temporary tracking record
  INSERT INTO public.counselor_mentor_invites (counselor_id, invite_code, created_at)
  VALUES (v_counselor_id, v_invite_code, CURRENT_TIMESTAMP)
  ON CONFLICT (invite_code) DO NOTHING;

  RETURN jsonb_build_object('success', true, 'invite_code', v_invite_code);
END;
$$;

GRANT EXECUTE ON FUNCTION public.counselor_generate_mentor_invite() TO authenticated;

-- ─── 5. Counselor-Mentor invite tracking table ───────────────────────────────
CREATE TABLE IF NOT EXISTS public.counselor_mentor_invites (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  counselor_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  invite_code  TEXT NOT NULL UNIQUE,
  used_by      UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  used_at      TIMESTAMPTZ,
  created_at   TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_cmi_counselor_id ON public.counselor_mentor_invites(counselor_id);
CREATE INDEX IF NOT EXISTS idx_cmi_invite_code  ON public.counselor_mentor_invites(invite_code);

ALTER TABLE public.counselor_mentor_invites ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "cmi_counselor_all" ON public.counselor_mentor_invites;
CREATE POLICY "cmi_counselor_all"
  ON public.counselor_mentor_invites FOR ALL TO authenticated
  USING (counselor_id = auth.uid())
  WITH CHECK (counselor_id = auth.uid());

-- ─── 6. Re-create counselor_generate_mentor_invite now table exists ───────────
CREATE OR REPLACE FUNCTION public.counselor_generate_mentor_invite()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_counselor_id UUID;
  v_invite_code TEXT;
BEGIN
  v_counselor_id := auth.uid();

  IF public.get_my_role() != 'counselor' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Only counselors can generate mentor invite codes.');
  END IF;

  v_invite_code := public.generate_counselor_invite_code();

  INSERT INTO public.counselor_mentor_invites (counselor_id, invite_code, created_at)
  VALUES (v_counselor_id, v_invite_code, CURRENT_TIMESTAMP)
  ON CONFLICT (invite_code) DO NOTHING;

  RETURN jsonb_build_object('success', true, 'invite_code', v_invite_code);
END;
$$;

GRANT EXECUTE ON FUNCTION public.counselor_generate_mentor_invite() TO authenticated;

-- ─── 7. RPC: Mentor uses counselor invite code during signup ─────────────────
CREATE OR REPLACE FUNCTION public.mentor_use_counselor_invite(
  p_invite_code TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_counselor_id UUID;
  v_invite_id    UUID;
  v_already_used BOOLEAN;
BEGIN
  -- Find the invite
  SELECT id, counselor_id, (used_by IS NOT NULL)
  INTO v_invite_id, v_counselor_id, v_already_used
  FROM public.counselor_mentor_invites
  WHERE invite_code = upper(trim(p_invite_code))
  LIMIT 1;

  IF v_invite_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid counselor invite code.');
  END IF;

  IF v_already_used THEN
    RETURN jsonb_build_object('success', false, 'error', 'This invite code has already been used.');
  END IF;

  -- Link mentor to counselor
  UPDATE public.user_profiles
  SET counselor_id = v_counselor_id,
      updated_at   = CURRENT_TIMESTAMP
  WHERE id = auth.uid();

  -- Mark invite as used
  UPDATE public.counselor_mentor_invites
  SET used_by  = auth.uid(),
      used_at  = CURRENT_TIMESTAMP
  WHERE id = v_invite_id;

  RETURN jsonb_build_object('success', true, 'counselor_id', v_counselor_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.mentor_use_counselor_invite(TEXT) TO authenticated;

-- ─── 8. Helper: is_counselor_of_mentor ───────────────────────────────────────
CREATE OR REPLACE FUNCTION public.is_counselor_of_mentor(p_mentor_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE id = p_mentor_id
      AND counselor_id = auth.uid()
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_counselor_of_mentor(UUID) TO authenticated;

-- ─── 9. Helper: is_counselor_of_student ──────────────────────────────────────
CREATE OR REPLACE FUNCTION public.is_counselor_of_student(p_student_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.students s
    JOIN public.user_profiles up ON up.id = s.mentor_id
    WHERE s.id = p_student_id
      AND up.counselor_id = auth.uid()
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_counselor_of_student(UUID) TO authenticated;

-- ─── 10. RLS: user_profiles — counselors can read their mentors' profiles ─────
DROP POLICY IF EXISTS "up_counselor_read_mentors" ON public.user_profiles;
CREATE POLICY "up_counselor_read_mentors"
  ON public.user_profiles FOR SELECT TO authenticated
  USING (
    counselor_id = auth.uid()
    AND public.get_my_role() = 'counselor'
  );

-- Counselors can read their own profile
DROP POLICY IF EXISTS "up_counselor_read_own" ON public.user_profiles;
CREATE POLICY "up_counselor_read_own"
  ON public.user_profiles FOR SELECT TO authenticated
  USING (
    id = auth.uid()
    AND public.get_my_role() = 'counselor'
  );

-- ─── 11. RLS: students — counselors can read students of their mentors ────────
DROP POLICY IF EXISTS "students_counselor_select" ON public.students;
CREATE POLICY "students_counselor_select"
  ON public.students FOR SELECT TO authenticated
  USING (
    public.is_counselor_of_student(id)
  );

-- ─── 12. RLS: sessions — counselors can read sessions of their mentors ────────
DROP POLICY IF EXISTS "sessions_counselor_select" ON public.sessions;
CREATE POLICY "sessions_counselor_select"
  ON public.sessions FOR SELECT TO authenticated
  USING (
    public.is_counselor_of_mentor(mentor_id)
  );

-- ─── 13. RLS: attendance — counselors can read attendance ────────────────────
DROP POLICY IF EXISTS "attendance_counselor_select" ON public.attendance;
CREATE POLICY "attendance_counselor_select"
  ON public.attendance FOR SELECT TO authenticated
  USING (
    public.is_counselor_of_mentor(mentor_id)
  );

-- ─── 14. RLS: meetings — counselors can read meetings ────────────────────────
DROP POLICY IF EXISTS "meetings_counselor_select" ON public.meetings;
CREATE POLICY "meetings_counselor_select"
  ON public.meetings FOR SELECT TO authenticated
  USING (
    public.is_counselor_of_mentor(mentor_id)
  );

-- ─── 15. RLS: mentor_feedback — counselors can read feedback ─────────────────
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='mentor_feedback') THEN
    EXECUTE 'DROP POLICY IF EXISTS "mf_counselor_select" ON public.mentor_feedback';
    EXECUTE 'CREATE POLICY "mf_counselor_select" ON public.mentor_feedback FOR SELECT TO authenticated USING (public.is_counselor_of_student(student_id))';
  END IF;
END;
$$;

-- ─── 16. RLS: student_reflections — counselors can read reflections ───────────
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='student_reflections') THEN
    EXECUTE 'DROP POLICY IF EXISTS "reflections_counselor_select" ON public.student_reflections';
    EXECUTE 'CREATE POLICY "reflections_counselor_select" ON public.student_reflections FOR SELECT TO authenticated USING (public.is_counselor_of_student(student_id))';
  END IF;
END;
$$;

-- ─── 17. Middleware redirect: counselors go to counselor-dashboard ────────────
-- (handled in application middleware.ts)
