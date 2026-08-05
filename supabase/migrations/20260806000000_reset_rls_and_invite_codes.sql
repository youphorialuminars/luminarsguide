-- ============================================================
-- FULL RESET: Remove complex RLS, admin role, add invite codes
-- ============================================================

-- ─── 1. Drop ALL existing RLS policies on key tables ─────────────────────────
DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname, tablename
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN ('user_profiles', 'students', 'sessions', 'meetings', 'attendance',
                        'student_reflections', 'mentor_feedback', 'parent_observations',
                        'parent_engagement', 'suggestion_box')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol.policyname, pol.tablename);
  END LOOP;
END;
$$;

-- ─── 2. Drop admin-only helper functions ─────────────────────────────────────
DROP FUNCTION IF EXISTS public.is_admin_user() CASCADE;
DROP FUNCTION IF EXISTS public.admin_upsert_user_profile(UUID, TEXT, TEXT, TEXT, TEXT[]) CASCADE;
DROP FUNCTION IF EXISTS public.admin_link_student_to_profile(UUID, UUID) CASCADE;

-- ─── 3. Ensure invite_code column exists on students table ───────────────────
ALTER TABLE public.students
  ADD COLUMN IF NOT EXISTS invite_code TEXT,
  ADD COLUMN IF NOT EXISTS invite_used  BOOLEAN DEFAULT FALSE;

-- Unique index on invite_code
CREATE UNIQUE INDEX IF NOT EXISTS idx_students_invite_code
  ON public.students (invite_code)
  WHERE invite_code IS NOT NULL;

-- ─── 4. Function to generate a unique 6-digit invite code ────────────────────
CREATE OR REPLACE FUNCTION public.generate_invite_code()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_code TEXT;
  v_exists BOOLEAN;
BEGIN
  LOOP
    -- Generate 6 uppercase alphanumeric characters
    v_code := upper(substring(replace(gen_random_uuid()::text, '-', ''), 1, 6));
    SELECT EXISTS(SELECT 1 FROM public.students WHERE invite_code = v_code) INTO v_exists;
    EXIT WHEN NOT v_exists;
  END LOOP;
  RETURN v_code;
END;
$$;

GRANT EXECUTE ON FUNCTION public.generate_invite_code() TO authenticated;

-- ─── 5. Trigger: auto-create user_profile on signup ──────────────────────────
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

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ─── 6. Helper: get current user role ────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS TEXT
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT role FROM public.user_profiles WHERE id = auth.uid() LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_my_role() TO authenticated;

-- ─── 7. Simple RLS: user_profiles ────────────────────────────────────────────
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "up_select_own"
  ON public.user_profiles FOR SELECT TO authenticated
  USING (id = auth.uid());

CREATE POLICY "up_insert_own"
  ON public.user_profiles FOR INSERT TO authenticated
  WITH CHECK (id = auth.uid());

CREATE POLICY "up_update_own"
  ON public.user_profiles FOR UPDATE TO authenticated
  USING (id = auth.uid()) WITH CHECK (id = auth.uid());

-- Mentors can read profiles of students linked to them
CREATE POLICY "up_mentor_read_linked"
  ON public.user_profiles FOR SELECT TO authenticated
  USING (
    mentor_id = auth.uid()::text
    AND public.get_my_role() = 'mentor'
  );

-- ─── 8. Simple RLS: students ─────────────────────────────────────────────────
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;

-- Mentors: full access to their own students
CREATE POLICY "students_mentor_all"
  ON public.students FOR ALL TO authenticated
  USING (mentor_id = auth.uid())
  WITH CHECK (mentor_id = auth.uid());

-- Students: can read their own row (linked by student_user_id)
CREATE POLICY "students_self_select"
  ON public.students FOR SELECT TO authenticated
  USING (student_user_id = auth.uid());

-- Students: can update their own row
CREATE POLICY "students_self_update"
  ON public.students FOR UPDATE TO authenticated
  USING (student_user_id = auth.uid())
  WITH CHECK (student_user_id = auth.uid());

-- ─── 9. Simple RLS: sessions ─────────────────────────────────────────────────
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sessions_mentor_all"
  ON public.sessions FOR ALL TO authenticated
  USING (mentor_id = auth.uid())
  WITH CHECK (mentor_id = auth.uid());

CREATE POLICY "sessions_student_select"
  ON public.sessions FOR SELECT TO authenticated
  USING (
    student_id IN (
      SELECT id FROM public.students WHERE student_user_id = auth.uid()
    )
  );

-- ─── 10. Simple RLS: meetings ────────────────────────────────────────────────
ALTER TABLE public.meetings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "meetings_mentor_all"
  ON public.meetings FOR ALL TO authenticated
  USING (mentor_id = auth.uid())
  WITH CHECK (mentor_id = auth.uid());

CREATE POLICY "meetings_student_select"
  ON public.meetings FOR SELECT TO authenticated
  USING (
    student_id IN (
      SELECT id FROM public.students WHERE student_user_id = auth.uid()
    )
  );

-- ─── 11. Simple RLS: attendance ──────────────────────────────────────────────
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;

CREATE POLICY "attendance_mentor_all"
  ON public.attendance FOR ALL TO authenticated
  USING (mentor_id = auth.uid())
  WITH CHECK (mentor_id = auth.uid());

CREATE POLICY "attendance_student_select"
  ON public.attendance FOR SELECT TO authenticated
  USING (
    student_id IN (
      SELECT id FROM public.students WHERE student_user_id = auth.uid()
    )
  );

-- ─── 12. Simple RLS: student_reflections ─────────────────────────────────────
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='student_reflections') THEN
    ALTER TABLE public.student_reflections ENABLE ROW LEVEL SECURITY;
    EXECUTE 'CREATE POLICY "reflections_student_all" ON public.student_reflections FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid())';
    EXECUTE 'CREATE POLICY "reflections_mentor_select" ON public.student_reflections FOR SELECT TO authenticated USING (student_id IN (SELECT id FROM public.students WHERE mentor_id = auth.uid()))';
    EXECUTE 'CREATE POLICY "reflections_mentor_update" ON public.student_reflections FOR UPDATE TO authenticated USING (student_id IN (SELECT id FROM public.students WHERE mentor_id = auth.uid()))';
  END IF;
END;
$$;

-- ─── 13. Simple RLS: mentor_feedback ─────────────────────────────────────────
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='mentor_feedback') THEN
    ALTER TABLE public.mentor_feedback ENABLE ROW LEVEL SECURITY;
    EXECUTE 'CREATE POLICY "mf_student_all" ON public.mentor_feedback FOR ALL TO authenticated USING (submitted_by = auth.uid()) WITH CHECK (submitted_by = auth.uid())';
    EXECUTE 'CREATE POLICY "mf_mentor_select" ON public.mentor_feedback FOR SELECT TO authenticated USING (student_id IN (SELECT id FROM public.students WHERE mentor_id = auth.uid()))';
  END IF;
END;
$$;

-- ─── 14. Simple RLS: parent_observations ─────────────────────────────────────
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='parent_observations') THEN
    ALTER TABLE public.parent_observations ENABLE ROW LEVEL SECURITY;
    EXECUTE 'CREATE POLICY "po_user_all" ON public.parent_observations FOR ALL TO authenticated USING (submitted_by = auth.uid()) WITH CHECK (submitted_by = auth.uid())';
    EXECUTE 'CREATE POLICY "po_mentor_select" ON public.parent_observations FOR SELECT TO authenticated USING (student_id IN (SELECT id FROM public.students WHERE mentor_id = auth.uid()))';
  END IF;
END;
$$;

-- ─── 15. Simple RLS: parent_engagement ───────────────────────────────────────
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='parent_engagement') THEN
    ALTER TABLE public.parent_engagement ENABLE ROW LEVEL SECURITY;
    EXECUTE 'CREATE POLICY "pe_user_all" ON public.parent_engagement FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid())';
    EXECUTE 'CREATE POLICY "pe_select_all" ON public.parent_engagement FOR SELECT TO authenticated USING (true)';
  END IF;
END;
$$;

-- ─── 16. Simple RLS: suggestion_box ──────────────────────────────────────────
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='suggestion_box') THEN
    ALTER TABLE public.suggestion_box ENABLE ROW LEVEL SECURITY;
    EXECUTE 'CREATE POLICY "sb_user_all" ON public.suggestion_box FOR ALL TO authenticated USING (submitted_by = auth.uid()) WITH CHECK (submitted_by = auth.uid())';
  END IF;
END;
$$;

-- ─── 17. RPC: Mentor creates a student with auto-generated invite code ────────
CREATE OR REPLACE FUNCTION public.mentor_create_student_with_invite(
  p_name        TEXT,
  p_student_id  TEXT,
  p_grade       TEXT DEFAULT '',
  p_primary_topic TEXT DEFAULT '',
  p_age         INT  DEFAULT NULL,
  p_gender      TEXT DEFAULT '',
  p_notes       TEXT DEFAULT ''
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_mentor_id UUID;
  v_invite_code TEXT;
  v_student_row_id UUID;
  v_avatar TEXT;
BEGIN
  v_mentor_id := auth.uid();

  -- Verify caller is a mentor
  IF public.get_my_role() != 'mentor' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Only mentors can create students.');
  END IF;

  -- Generate unique invite code
  v_invite_code := public.generate_invite_code();

  -- Build avatar initials
  v_avatar := upper(substring(regexp_replace(p_name, '[^A-Za-z ]', '', 'g'), 1, 1));
  IF length(p_name) > 1 THEN
    v_avatar := v_avatar || upper(substring(split_part(p_name, ' ', 2), 1, 1));
  END IF;
  IF v_avatar = '' THEN v_avatar := 'ST'; END IF;

  INSERT INTO public.students (
    id, mentor_id, name, student_code, grade, primary_topic,
    age, gender, notes, avatar, avg_score, sessions,
    topics, trend, alert_level, last_session, invite_code, invite_used
  )
  VALUES (
    gen_random_uuid(),
    v_mentor_id,
    p_name,
    p_student_id,
    p_grade,
    p_primary_topic,
    p_age,
    p_gender,
    p_notes,
    v_avatar,
    0, 0,
    CASE WHEN p_primary_topic != '' THEN ARRAY[p_primary_topic] ELSE ARRAY[]::TEXT[] END,
    'stable', NULL, NULL,
    v_invite_code,
    FALSE
  )
  RETURNING id INTO v_student_row_id;

  RETURN jsonb_build_object(
    'success', true,
    'student_id', v_student_row_id,
    'invite_code', v_invite_code
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.mentor_create_student_with_invite(TEXT, TEXT, TEXT, TEXT, INT, TEXT, TEXT) TO authenticated;

-- ─── 18. RPC: Student uses invite code to link their auth account ─────────────
CREATE OR REPLACE FUNCTION public.student_use_invite_code(
  p_invite_code TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_student_id UUID;
  v_mentor_id  UUID;
  v_already_used BOOLEAN;
BEGIN
  -- Find the student row with this invite code
  SELECT id, mentor_id, invite_used
  INTO v_student_id, v_mentor_id, v_already_used
  FROM public.students
  WHERE invite_code = upper(trim(p_invite_code))
  LIMIT 1;

  IF v_student_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid invite code. Please check and try again.');
  END IF;

  IF v_already_used THEN
    RETURN jsonb_build_object('success', false, 'error', 'This invite code has already been used.');
  END IF;

  -- Link the student row to this auth user
  UPDATE public.students
  SET student_user_id = auth.uid(),
      student_email   = (SELECT email FROM auth.users WHERE id = auth.uid() LIMIT 1),
      invite_used     = TRUE,
      updated_at      = CURRENT_TIMESTAMP
  WHERE id = v_student_id;

  -- Update user_profile: set mentor_id and student_id
  UPDATE public.user_profiles
  SET mentor_id  = v_mentor_id::text,
      student_id = v_student_id,
      updated_at = CURRENT_TIMESTAMP
  WHERE id = auth.uid();

  RETURN jsonb_build_object(
    'success', true,
    'student_id', v_student_id,
    'mentor_id', v_mentor_id
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.student_use_invite_code(TEXT) TO authenticated;

-- ─── 19. RPC: Regenerate mentor code ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.regenerate_mentor_code()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_new_code TEXT;
BEGIN
  v_new_code := upper(substring(replace(gen_random_uuid()::text, '-', ''), 1, 8));
  UPDATE public.user_profiles
  SET mentor_code = v_new_code, updated_at = CURRENT_TIMESTAMP
  WHERE id = auth.uid();
  RETURN v_new_code;
END;
$$;

GRANT EXECUTE ON FUNCTION public.regenerate_mentor_code() TO authenticated;

-- ─── 20. RPC: Mentor links student by email (fallback) ───────────────────────
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
  IF public.get_my_role() != 'mentor' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Only mentors can link students.');
  END IF;

  v_mentor_id := auth.uid();
  v_student_email_lower := lower(trim(p_student_email));

  SELECT id INTO v_student_profile_id
  FROM public.user_profiles
  WHERE lower(email) = v_student_email_lower
  LIMIT 1;

  IF v_student_profile_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'No registered user found with that email address.');
  END IF;

  SELECT full_name INTO v_full_name
  FROM public.user_profiles WHERE id = v_student_profile_id;

  SELECT id INTO v_student_row_id
  FROM public.students
  WHERE student_user_id = v_student_profile_id
  LIMIT 1;

  IF v_student_row_id IS NOT NULL THEN
    UPDATE public.students
    SET mentor_id = v_mentor_id, updated_at = CURRENT_TIMESTAMP
    WHERE id = v_student_row_id;
  ELSE
    INSERT INTO public.students (
      id, mentor_id, name, student_code, grade, primary_topic,
      avg_score, sessions, topics, trend, student_user_id, student_email
    )
    VALUES (
      gen_random_uuid(), v_mentor_id,
      COALESCE(v_full_name, split_part(v_student_email_lower, '@', 1)),
      'STU-' || upper(substring(replace(gen_random_uuid()::text, '-', ''), 1, 6)),
      '', '', 0, 0, ARRAY[]::TEXT[], 'stable',
      v_student_profile_id, v_student_email_lower
    )
    RETURNING id INTO v_student_row_id;
  END IF;

  UPDATE public.user_profiles
  SET mentor_id  = v_mentor_id::text,
      student_id = v_student_row_id,
      updated_at = CURRENT_TIMESTAMP
  WHERE id = v_student_profile_id;

  RETURN jsonb_build_object('success', true, 'student_id', v_student_row_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.mentor_link_student_by_email(TEXT) TO authenticated;

-- ─── 21. RPC: link_student_to_mentor_by_code (kept for backward compat) ──────
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
  SELECT id INTO v_mentor_profile_id
  FROM public.user_profiles
  WHERE mentor_code = upper(trim(p_mentor_code)) AND role = 'mentor'
  LIMIT 1;

  IF v_mentor_profile_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid mentor code.');
  END IF;

  SELECT email INTO v_user_email FROM auth.users WHERE id = auth.uid() LIMIT 1;
  SELECT full_name INTO v_user_name FROM public.user_profiles WHERE id = auth.uid() LIMIT 1;

  SELECT id INTO v_existing_student_id
  FROM public.students WHERE student_user_id = auth.uid() LIMIT 1;

  IF v_existing_student_id IS NOT NULL THEN
    UPDATE public.students SET mentor_id = v_mentor_profile_id, updated_at = CURRENT_TIMESTAMP
    WHERE id = v_existing_student_id;
    v_student_id := v_existing_student_id;
  ELSE
    INSERT INTO public.students (
      id, mentor_id, name, student_code, grade, primary_topic,
      avg_score, sessions, topics, trend, student_user_id, student_email
    )
    VALUES (
      gen_random_uuid(), v_mentor_profile_id,
      COALESCE(p_student_name, v_user_name, split_part(v_user_email, '@', 1)),
      'STU-' || upper(substring(replace(gen_random_uuid()::text, '-', ''), 1, 6)),
      COALESCE(p_grade, ''), '', 0, 0, ARRAY[]::TEXT[], 'stable',
      auth.uid(), v_user_email
    )
    RETURNING id INTO v_student_id;
  END IF;

  UPDATE public.user_profiles
  SET mentor_id = v_mentor_profile_id::text, student_id = v_student_id, updated_at = CURRENT_TIMESTAMP
  WHERE id = auth.uid();

  RETURN jsonb_build_object('success', true, 'student_id', v_student_id, 'mentor_id', v_mentor_profile_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.link_student_to_mentor_by_code(TEXT, TEXT, TEXT) TO authenticated;
