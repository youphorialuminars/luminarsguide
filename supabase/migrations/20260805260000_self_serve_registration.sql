-- Migration: Self-Serve Registration & Mentor Code Linking
-- 1. Add mentor_code column to user_profiles (unique per mentor)
-- 2. Update handle_new_user trigger to auto-create profile on signup with role from metadata
-- 3. Update RLS: users can read/update their own profiles
-- 4. Add RPC: student can link to mentor via mentor_code
-- 5. Add RPC: mentor can link student by email

-- ─── 1. Add mentor_code column to user_profiles ───────────────────────────────
ALTER TABLE public.user_profiles
ADD COLUMN IF NOT EXISTS mentor_code TEXT;

-- Create unique index on mentor_code (only for non-null values)
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_profiles_mentor_code
ON public.user_profiles (mentor_code)
WHERE mentor_code IS NOT NULL;

-- ─── 2. Trigger: auto-create user_profile on new auth signup ─────────────────
-- This replaces the admin-only creation flow with self-serve
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

  -- Generate a unique mentor_code only for mentor role
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
    email = EXCLUDED.email,
    full_name = COALESCE(EXCLUDED.full_name, public.user_profiles.full_name),
    role = COALESCE(EXCLUDED.role, public.user_profiles.role),
    mentor_code = COALESCE(EXCLUDED.mentor_code, public.user_profiles.mentor_code),
    updated_at = CURRENT_TIMESTAMP;

  RETURN NEW;
END;
$$;

GRANT EXECUTE ON FUNCTION public.handle_new_user() TO service_role;

-- Recreate trigger (idempotent)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- ─── 3. RLS: users can read and update their own profile ─────────────────────
-- Drop old policies and replace with comprehensive self-serve policies

DROP POLICY IF EXISTS "mentor_select_own_profile" ON public.user_profiles;
DROP POLICY IF EXISTS "users_manage_own_user_profiles" ON public.user_profiles;
DROP POLICY IF EXISTS "user_profiles_select_own" ON public.user_profiles;
DROP POLICY IF EXISTS "user_profiles_update_own" ON public.user_profiles;
DROP POLICY IF EXISTS "user_profiles_insert_own" ON public.user_profiles;

-- Users can SELECT their own profile
CREATE POLICY "user_profiles_select_own"
ON public.user_profiles
FOR SELECT
TO authenticated
USING (id = auth.uid());

-- Users can INSERT their own profile (needed for self-serve signup trigger fallback)
CREATE POLICY "user_profiles_insert_own"
ON public.user_profiles
FOR INSERT
TO authenticated
WITH CHECK (id = auth.uid());

-- Users can UPDATE their own profile
CREATE POLICY "user_profiles_update_own"
ON public.user_profiles
FOR UPDATE
TO authenticated
USING (id = auth.uid())
WITH CHECK (id = auth.uid());

-- Admins retain full access
DROP POLICY IF EXISTS "admin_full_access_user_profiles" ON public.user_profiles;
CREATE POLICY "admin_full_access_user_profiles"
ON public.user_profiles
FOR ALL
TO authenticated
USING (public.is_admin_user())
WITH CHECK (public.is_admin_user());

-- ─── 4. RLS: mentors can read profiles of students linked to them ─────────────
-- Mentors need to read student user_profiles when student links via mentor_code
DROP POLICY IF EXISTS "mentor_read_linked_student_profiles" ON public.user_profiles;
CREATE POLICY "mentor_read_linked_student_profiles"
ON public.user_profiles
FOR SELECT
TO authenticated
USING (
  -- Allow mentor to see profiles where mentor_id = their own profile id
  mentor_id = auth.uid()::text
  AND public.get_my_role() = 'mentor'
);

-- ─── 5. RLS: students can INSERT themselves into students table ───────────────
-- When a student self-registers and links via mentor_code, they need to insert a student row
DROP POLICY IF EXISTS "student_self_insert" ON public.students;
CREATE POLICY "student_self_insert"
ON public.students
FOR INSERT
TO authenticated
WITH CHECK (student_user_id = auth.uid());

-- Students can update their own student row
DROP POLICY IF EXISTS "student_self_update" ON public.students;
CREATE POLICY "student_self_update"
ON public.students
FOR UPDATE
TO authenticated
USING (student_user_id = auth.uid())
WITH CHECK (student_user_id = auth.uid());

-- ─── 6. RPC: student links themselves to a mentor via mentor_code ─────────────
CREATE OR REPLACE FUNCTION public.link_student_to_mentor_by_code(
  p_mentor_code TEXT,
  p_student_name TEXT DEFAULT NULL,
  p_grade TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_mentor_profile_id UUID;
  v_student_id UUID;
  v_user_email TEXT;
  v_user_name TEXT;
  v_existing_student_id UUID;
BEGIN
  -- Find mentor by code
  SELECT id INTO v_mentor_profile_id
  FROM public.user_profiles
  WHERE mentor_code = upper(trim(p_mentor_code))
    AND role = 'mentor'
  LIMIT 1;

  IF v_mentor_profile_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid mentor code. Please check and try again.');
  END IF;

  -- Get current user info
  SELECT email INTO v_user_email FROM auth.users WHERE id = auth.uid() LIMIT 1;
  SELECT full_name INTO v_user_name FROM public.user_profiles WHERE id = auth.uid() LIMIT 1;

  -- Check if student row already exists for this user
  SELECT id INTO v_existing_student_id
  FROM public.students
  WHERE student_user_id = auth.uid()
  LIMIT 1;

  IF v_existing_student_id IS NOT NULL THEN
    -- Update existing student row with new mentor
    UPDATE public.students
    SET mentor_id = v_mentor_profile_id,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = v_existing_student_id;
    v_student_id := v_existing_student_id;
  ELSE
    -- Create new student row
    INSERT INTO public.students (
      id, mentor_id, name, student_code, grade, primary_topic,
      avg_score, sessions, topics, trend, student_user_id, student_email
    )
    VALUES (
      gen_random_uuid(),
      v_mentor_profile_id,
      COALESCE(p_student_name, v_user_name, split_part(v_user_email, '@', 1)),
      'STU-' || upper(substring(replace(gen_random_uuid()::text, '-', ''), 1, 6)),
      COALESCE(p_grade, ''),
      '',
      0, 0, ARRAY[]::TEXT[], 'stable',
      auth.uid(),
      v_user_email
    )
    RETURNING id INTO v_student_id;
  END IF;

  -- Update user_profile: set mentor_id and student_id
  UPDATE public.user_profiles
  SET mentor_id = v_mentor_profile_id::text,
      student_id = v_student_id,
      updated_at = CURRENT_TIMESTAMP
  WHERE id = auth.uid();

  RETURN jsonb_build_object('success', true, 'student_id', v_student_id, 'mentor_id', v_mentor_profile_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.link_student_to_mentor_by_code(TEXT, TEXT, TEXT) TO authenticated;

-- ─── 7. RPC: mentor links a student by their registered email ─────────────────
CREATE OR REPLACE FUNCTION public.mentor_link_student_by_email(
  p_student_email TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_mentor_id UUID;
  v_student_profile_id UUID;
  v_student_row_id UUID;
  v_student_email_lower TEXT;
  v_full_name TEXT;
BEGIN
  -- Verify caller is a mentor
  IF public.get_my_role() != 'mentor' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Only mentors can link students.');
  END IF;

  v_mentor_id := auth.uid();
  v_student_email_lower := lower(trim(p_student_email));

  -- Find student's user_profile by email
  SELECT id INTO v_student_profile_id
  FROM public.user_profiles
  WHERE lower(email) = v_student_email_lower
  LIMIT 1;

  IF v_student_profile_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'No registered user found with that email address.');
  END IF;

  -- Check if student already has a row in students table
  SELECT id INTO v_student_row_id
  FROM public.students
  WHERE student_user_id = v_student_profile_id
  LIMIT 1;

  IF v_student_row_id IS NOT NULL THEN
    -- Update existing student row with new mentor
    UPDATE public.students
    SET mentor_id = v_mentor_id,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = v_student_row_id;
  ELSE
    -- Create student row for this user
    SELECT full_name INTO v_full_name FROM public.user_profiles WHERE id = v_student_profile_id LIMIT 1;
    INSERT INTO public.students (
      id, mentor_id, name, student_code, grade, primary_topic,
      avg_score, sessions, topics, trend, student_user_id, student_email
    )
    VALUES (
      gen_random_uuid(),
      v_mentor_id,
      COALESCE(v_full_name, split_part(v_student_email_lower, '@', 1)),
      'STU-' || upper(substring(replace(gen_random_uuid()::text, '-', ''), 1, 6)),
      '', '', 0, 0, ARRAY[]::TEXT[], 'stable',
      v_student_profile_id,
      v_student_email_lower
    )
    RETURNING id INTO v_student_row_id;
  END IF;

  -- Update student's user_profile to link mentor
  UPDATE public.user_profiles
  SET mentor_id = v_mentor_id::text,
      student_id = v_student_row_id,
      updated_at = CURRENT_TIMESTAMP
  WHERE id = v_student_profile_id;

  RETURN jsonb_build_object('success', true, 'student_id', v_student_row_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.mentor_link_student_by_email(TEXT) TO authenticated;

-- ─── 8. RPC: regenerate mentor code ──────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.regenerate_mentor_code()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_new_code TEXT;
  v_attempts INT := 0;
BEGIN
  IF public.get_my_role() != 'mentor' THEN
    RAISE EXCEPTION 'Only mentors can regenerate their code.';
  END IF;

  LOOP
    v_new_code := upper(substring(replace(gen_random_uuid()::text, '-', ''), 1, 8));
    v_attempts := v_attempts + 1;
    -- Check uniqueness
    IF NOT EXISTS (SELECT 1 FROM public.user_profiles WHERE mentor_code = v_new_code) THEN
      EXIT;
    END IF;
    IF v_attempts > 10 THEN
      RAISE EXCEPTION 'Could not generate unique mentor code after 10 attempts.';
    END IF;
  END LOOP;

  UPDATE public.user_profiles
  SET mentor_code = v_new_code, updated_at = CURRENT_TIMESTAMP
  WHERE id = auth.uid();

  RETURN v_new_code;
END;
$$;

GRANT EXECUTE ON FUNCTION public.regenerate_mentor_code() TO authenticated;

-- ─── 9. Backfill mentor_code for existing mentors who don't have one ──────────
DO $$
DECLARE
  r RECORD;
  v_code TEXT;
  v_attempts INT;
BEGIN
  FOR r IN
    SELECT id FROM public.user_profiles
    WHERE role = 'mentor' AND (mentor_code IS NULL OR mentor_code = '')
  LOOP
    v_attempts := 0;
    LOOP
      v_code := upper(substring(replace(gen_random_uuid()::text, '-', ''), 1, 8));
      v_attempts := v_attempts + 1;
      IF NOT EXISTS (SELECT 1 FROM public.user_profiles WHERE mentor_code = v_code) THEN
        EXIT;
      END IF;
      IF v_attempts > 20 THEN
        RAISE NOTICE 'Could not generate unique code for mentor %', r.id;
        v_code := NULL;
        EXIT;
      END IF;
    END LOOP;
    IF v_code IS NOT NULL THEN
      UPDATE public.user_profiles SET mentor_code = v_code WHERE id = r.id;
    END IF;
  END LOOP;
END $$;
