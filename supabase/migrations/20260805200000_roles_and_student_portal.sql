-- Migration: Add role system, student portal tables
-- Adds role to user_profiles, creates student_reflections, mentor_feedback, parent_observations, suggestion_box, parent_leaderboard tables

-- 1. Add role column to user_profiles
ALTER TABLE public.user_profiles
ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'mentor';

-- 2. Add index on role
CREATE INDEX IF NOT EXISTS idx_user_profiles_role ON public.user_profiles(role);

-- 3. Update handle_new_user trigger to include role
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.user_profiles (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'role', 'mentor')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- 4. Helper function to get current user role (from auth metadata to avoid recursion)
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT COALESCE(
    (SELECT role FROM public.user_profiles WHERE id = auth.uid() LIMIT 1),
    'mentor'
  );
$$;

-- 5. Admin check function
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
$$;

-- 6. Update user_profiles RLS to allow admin full access
DROP POLICY IF EXISTS "users_manage_own_user_profiles" ON public.user_profiles;
CREATE POLICY "users_manage_own_user_profiles"
ON public.user_profiles
FOR ALL
TO authenticated
USING (id = auth.uid() OR public.is_admin())
WITH CHECK (id = auth.uid() OR public.is_admin());

-- 7. Student reflections table
CREATE TABLE IF NOT EXISTS public.student_reflections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID REFERENCES public.students(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  week_start DATE NOT NULL,
  learned_this_week TEXT NOT NULL DEFAULT '',
  needs_work TEXT NOT NULL DEFAULT '',
  team_dynamics TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_student_reflections_student_id ON public.student_reflections(student_id);
CREATE INDEX IF NOT EXISTS idx_student_reflections_user_id ON public.student_reflections(user_id);

ALTER TABLE public.student_reflections ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users_manage_student_reflections" ON public.student_reflections;
CREATE POLICY "users_manage_student_reflections"
ON public.student_reflections
FOR ALL
TO authenticated
USING (user_id = auth.uid() OR public.is_admin() OR public.get_my_role() = 'mentor')
WITH CHECK (user_id = auth.uid() OR public.is_admin());

-- 8. Mentor feedback (student rates mentor)
CREATE TABLE IF NOT EXISTS public.mentor_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID REFERENCES public.students(id) ON DELETE CASCADE,
  submitted_by UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  mentor_interaction_score INTEGER NOT NULL DEFAULT 5,
  active_listening_score INTEGER NOT NULL DEFAULT 5,
  teaching_clarity_score INTEGER NOT NULL DEFAULT 5,
  fruitful_comments TEXT NOT NULL DEFAULT '',
  help_needed_comments TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_mentor_feedback_student_id ON public.mentor_feedback(student_id);

ALTER TABLE public.mentor_feedback ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users_manage_mentor_feedback" ON public.mentor_feedback;
CREATE POLICY "users_manage_mentor_feedback"
ON public.mentor_feedback
FOR ALL
TO authenticated
USING (submitted_by = auth.uid() OR public.is_admin() OR public.get_my_role() = 'mentor')
WITH CHECK (submitted_by = auth.uid() OR public.is_admin());

-- 9. Parent observations table
CREATE TABLE IF NOT EXISTS public.parent_observations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID REFERENCES public.students(id) ON DELETE CASCADE,
  submitted_by UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  observation_text TEXT NOT NULL DEFAULT '',
  program_experience TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_parent_observations_student_id ON public.parent_observations(student_id);
CREATE INDEX IF NOT EXISTS idx_parent_observations_submitted_by ON public.parent_observations(submitted_by);

ALTER TABLE public.parent_observations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users_manage_parent_observations" ON public.parent_observations;
CREATE POLICY "users_manage_parent_observations"
ON public.parent_observations
FOR ALL
TO authenticated
USING (submitted_by = auth.uid() OR public.is_admin() OR public.get_my_role() = 'mentor')
WITH CHECK (submitted_by = auth.uid() OR public.is_admin());

-- 10. Suggestion box
CREATE TABLE IF NOT EXISTS public.suggestion_box (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submitted_by UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  suggestion_text TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL DEFAULT 'general',
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_suggestion_box_submitted_by ON public.suggestion_box(submitted_by);

ALTER TABLE public.suggestion_box ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users_manage_suggestion_box" ON public.suggestion_box;
CREATE POLICY "users_manage_suggestion_box"
ON public.suggestion_box
FOR ALL
TO authenticated
USING (submitted_by = auth.uid() OR public.is_admin())
WITH CHECK (submitted_by = auth.uid() OR public.is_admin());

-- 11. Parent engagement leaderboard scores (computed/cached)
CREATE TABLE IF NOT EXISTS public.parent_engagement (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE UNIQUE,
  student_id UUID REFERENCES public.students(id) ON DELETE CASCADE,
  observations_count INTEGER NOT NULL DEFAULT 0,
  suggestions_count INTEGER NOT NULL DEFAULT 0,
  total_score INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_parent_engagement_user_id ON public.parent_engagement(user_id);
CREATE INDEX IF NOT EXISTS idx_parent_engagement_total_score ON public.parent_engagement(total_score DESC);

ALTER TABLE public.parent_engagement ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users_view_parent_engagement" ON public.parent_engagement;
CREATE POLICY "users_view_parent_engagement"
ON public.parent_engagement
FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS "users_manage_own_parent_engagement" ON public.parent_engagement;
CREATE POLICY "users_manage_own_parent_engagement"
ON public.parent_engagement
FOR ALL
TO authenticated
USING (user_id = auth.uid() OR public.is_admin())
WITH CHECK (user_id = auth.uid() OR public.is_admin());

-- 12. Create demo admin user
DO $$
DECLARE
  admin_uuid UUID := gen_random_uuid();
  student_parent_uuid UUID := gen_random_uuid();
BEGIN
  -- Admin user
  INSERT INTO auth.users (
    id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
    created_at, updated_at, raw_user_meta_data, raw_app_meta_data,
    is_sso_user, is_anonymous, confirmation_token, confirmation_sent_at,
    recovery_token, recovery_sent_at, email_change_token_new, email_change,
    email_change_sent_at, email_change_token_current, email_change_confirm_status,
    reauthentication_token, reauthentication_sent_at, phone, phone_change,
    phone_change_token, phone_change_sent_at
  ) VALUES (
    admin_uuid, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
    'admin@luminar.guide', crypt('LuminarAdmin@2026', gen_salt('bf', 10)), now(), now(), now(),
    jsonb_build_object('full_name', 'Tech Admin', 'role', 'admin'),
    jsonb_build_object('provider', 'email', 'providers', ARRAY['email']::TEXT[]),
    false, false, '', null, '', null, '', '', null, '', 0, '', null, null, '', '', null
  )
  ON CONFLICT (id) DO NOTHING;

  -- Student/Parent user
  INSERT INTO auth.users (
    id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
    created_at, updated_at, raw_user_meta_data, raw_app_meta_data,
    is_sso_user, is_anonymous, confirmation_token, confirmation_sent_at,
    recovery_token, recovery_sent_at, email_change_token_new, email_change,
    email_change_sent_at, email_change_token_current, email_change_confirm_status,
    reauthentication_token, reauthentication_sent_at, phone, phone_change,
    phone_change_token, phone_change_sent_at
  ) VALUES (
    student_parent_uuid, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
    'student@luminar.guide', crypt('LuminarStudent@2026', gen_salt('bf', 10)), now(), now(), now(),
    jsonb_build_object('full_name', 'Arjun Sharma (Parent)', 'role', 'student_parent'),
    jsonb_build_object('provider', 'email', 'providers', ARRAY['email']::TEXT[]),
    false, false, '', null, '', null, '', '', null, '', 0, '', null, null, '', '', null
  )
  ON CONFLICT (id) DO NOTHING;

EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Demo user creation skipped: %', SQLERRM;
END $$;

-- 13. Update existing mentor demo user role
DO $$
BEGIN
  UPDATE public.user_profiles
  SET role = 'mentor'
  WHERE email = 'mentor@luminar.guide' AND role = 'mentor';
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Role update skipped: %', SQLERRM;
END $$;
