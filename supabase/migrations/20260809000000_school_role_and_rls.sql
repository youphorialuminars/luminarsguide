-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: School Role, School Invite Codes, School-linked profiles
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Add school_id column to user_profiles (links students/mentors to a school)
ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS school_id UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_user_profiles_school_id ON public.user_profiles(school_id);

-- 2. School invite codes table
CREATE TABLE IF NOT EXISTS public.school_invite_codes (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id   UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  invite_code TEXT NOT NULL UNIQUE,
  used_by     UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  used_at     TIMESTAMPTZ,
  created_at  TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_school_invite_codes_school_id ON public.school_invite_codes(school_id);
CREATE INDEX IF NOT EXISTS idx_school_invite_codes_code ON public.school_invite_codes(invite_code);

ALTER TABLE public.school_invite_codes ENABLE ROW LEVEL SECURITY;

-- Schools can manage their own invite codes
DROP POLICY IF EXISTS "schools_manage_own_codes" ON public.school_invite_codes;
CREATE POLICY "schools_manage_own_codes"
  ON public.school_invite_codes
  FOR ALL
  TO authenticated
  USING (school_id = auth.uid())
  WITH CHECK (school_id = auth.uid());

-- Authenticated users can read codes (to validate during linking)
DROP POLICY IF EXISTS "authenticated_read_school_codes" ON public.school_invite_codes;
CREATE POLICY "authenticated_read_school_codes"
  ON public.school_invite_codes
  FOR SELECT
  TO authenticated
  USING (true);

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. RLS policies for school role on user_profiles
-- Schools can SELECT profiles where school_id = their own uid
-- ─────────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "schools_read_linked_profiles" ON public.user_profiles;
CREATE POLICY "schools_read_linked_profiles"
  ON public.user_profiles
  FOR SELECT
  TO authenticated
  USING (
    school_id = auth.uid()
    OR id = auth.uid()
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. RLS policies for school role on student_tasks
-- Schools can SELECT tasks where the student's mentor has school_id = school uid
-- ─────────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "schools_read_linked_tasks" ON public.student_tasks;
CREATE POLICY "schools_read_linked_tasks"
  ON public.student_tasks
  FOR SELECT
  TO authenticated
  USING (
    mentor_id IN (
      SELECT id FROM public.user_profiles
      WHERE school_id = auth.uid()
    )
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. RLS policies for school role on sessions
-- Schools can SELECT sessions where mentor has school_id = school uid
-- ─────────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "schools_read_linked_sessions" ON public.sessions;
CREATE POLICY "schools_read_linked_sessions"
  ON public.sessions
  FOR SELECT
  TO authenticated
  USING (
    mentor_id IN (
      SELECT id FROM public.user_profiles
      WHERE school_id = auth.uid()
    )
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. RPC: school_generate_invite_code
-- Generates a unique school invite code (format: S-XXXXXX)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.school_generate_invite_code()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_school_id UUID := auth.uid();
  v_code TEXT;
  v_attempts INT := 0;
  v_exists BOOLEAN;
BEGIN
  -- Verify caller is a school
  IF NOT EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE id = v_school_id AND role = 'school'
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Only school accounts can generate school invite codes');
  END IF;

  -- Generate unique code
  LOOP
    v_code := 'S-' || upper(substring(md5(random()::text) from 1 for 6));
    SELECT EXISTS(SELECT 1 FROM public.school_invite_codes WHERE invite_code = v_code) INTO v_exists;
    EXIT WHEN NOT v_exists;
    v_attempts := v_attempts + 1;
    IF v_attempts > 10 THEN
      RETURN jsonb_build_object('success', false, 'error', 'Failed to generate unique code');
    END IF;
  END LOOP;

  INSERT INTO public.school_invite_codes (school_id, invite_code)
  VALUES (v_school_id, v_code);

  RETURN jsonb_build_object('success', true, 'invite_code', v_code);
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 7. RPC: use_school_invite_code
-- Students/Mentors use this code to link their profile to a school
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.use_school_invite_code(p_invite_code TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_code_row public.school_invite_codes%ROWTYPE;
BEGIN
  -- Find the code
  SELECT * INTO v_code_row
  FROM public.school_invite_codes
  WHERE invite_code = upper(trim(p_invite_code))
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid school invite code');
  END IF;

  -- Update the user's school_id
  UPDATE public.user_profiles
  SET school_id = v_code_row.school_id
  WHERE id = v_user_id;

  RETURN jsonb_build_object('success', true, 'school_id', v_code_row.school_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.school_generate_invite_code() TO authenticated;
GRANT EXECUTE ON FUNCTION public.use_school_invite_code(TEXT) TO authenticated;
