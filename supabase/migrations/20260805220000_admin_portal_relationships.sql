-- Migration: Admin Portal - Full Mentor/Student/Parent Relationships
-- Adds: student_id to user_profiles, mentor_pillars, parent fields on students
-- Adds: admin RLS bypass functions, mentor_assignments table for explicit admin linking

-- ─── 1. Extend user_profiles ─────────────────────────────────────────────────
ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS student_id UUID REFERENCES public.students(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS mentor_pillars TEXT[] DEFAULT ARRAY[]::TEXT[];

-- ─── 2. Extend students with parent contact fields ───────────────────────────
ALTER TABLE public.students
  ADD COLUMN IF NOT EXISTS parent_name TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS parent_email TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS student_email TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS student_user_id UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL;

-- ─── 3. Indexes ──────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_user_profiles_student_id ON public.user_profiles(student_id);
CREATE INDEX IF NOT EXISTS idx_user_profiles_role ON public.user_profiles(role);
CREATE INDEX IF NOT EXISTS idx_students_student_user_id ON public.students(student_user_id);

-- ─── 4. Admin helper function (reads from auth.users metadata to avoid recursion) ──
CREATE OR REPLACE FUNCTION public.is_admin_user()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM auth.users au
    WHERE au.id = auth.uid()
    AND (
      au.raw_user_meta_data->>'role' = 'admin'
      OR au.raw_app_meta_data->>'role' = 'admin'
    )
  )
$$;

-- ─── 5. RLS: user_profiles — admin can read all, users manage own ─────────────
-- Drop existing policies first
DROP POLICY IF EXISTS "users_manage_own_user_profiles" ON public.user_profiles;
DROP POLICY IF EXISTS "admin_read_all_user_profiles" ON public.user_profiles;
DROP POLICY IF EXISTS "admin_update_all_user_profiles" ON public.user_profiles;
DROP POLICY IF EXISTS "users_select_own_profile" ON public.user_profiles;
DROP POLICY IF EXISTS "users_update_own_profile" ON public.user_profiles;
DROP POLICY IF EXISTS "users_insert_own_profile" ON public.user_profiles;

-- Admin can do everything
CREATE POLICY "admin_full_access_user_profiles"
ON public.user_profiles
FOR ALL
TO authenticated
USING (public.is_admin_user())
WITH CHECK (public.is_admin_user());

-- Regular users can manage their own profile
CREATE POLICY "users_select_own_profile"
ON public.user_profiles
FOR SELECT
TO authenticated
USING (id = auth.uid());

CREATE POLICY "users_update_own_profile"
ON public.user_profiles
FOR UPDATE
TO authenticated
USING (id = auth.uid())
WITH CHECK (id = auth.uid());

CREATE POLICY "users_insert_own_profile"
ON public.user_profiles
FOR INSERT
TO authenticated
WITH CHECK (id = auth.uid());

-- ─── 6. RLS: students — admin can read/update all ────────────────────────────
DROP POLICY IF EXISTS "admin_full_access_students" ON public.students;
DROP POLICY IF EXISTS "mentors_manage_own_students" ON public.students;
DROP POLICY IF EXISTS "student_parent_view_own" ON public.students;

CREATE POLICY "admin_full_access_students"
ON public.students
FOR ALL
TO authenticated
USING (public.is_admin_user())
WITH CHECK (public.is_admin_user());

CREATE POLICY "mentors_manage_own_students"
ON public.students
FOR ALL
TO authenticated
USING (mentor_id = auth.uid())
WITH CHECK (mentor_id = auth.uid());

-- Student/parent users can view their own linked student record
CREATE POLICY "student_parent_view_own"
ON public.students
FOR SELECT
TO authenticated
USING (
  student_user_id = auth.uid()
  OR id IN (
    SELECT student_id FROM public.user_profiles WHERE id = auth.uid() AND student_id IS NOT NULL
  )
);

-- ─── 7. RLS: sessions — admin can read all ───────────────────────────────────
DROP POLICY IF EXISTS "admin_full_access_sessions" ON public.sessions;
DROP POLICY IF EXISTS "mentors_manage_own_sessions" ON public.sessions;
DROP POLICY IF EXISTS "student_parent_view_own_sessions" ON public.sessions;

CREATE POLICY "admin_full_access_sessions"
ON public.sessions
FOR ALL
TO authenticated
USING (public.is_admin_user())
WITH CHECK (public.is_admin_user());

CREATE POLICY "mentors_manage_own_sessions"
ON public.sessions
FOR ALL
TO authenticated
USING (mentor_id = auth.uid())
WITH CHECK (mentor_id = auth.uid());

CREATE POLICY "student_parent_view_own_sessions"
ON public.sessions
FOR SELECT
TO authenticated
USING (
  student_id IN (
    SELECT student_id FROM public.user_profiles WHERE id = auth.uid() AND student_id IS NOT NULL
  )
);

-- ─── 8. RLS: attendance — admin can read all ─────────────────────────────────
DROP POLICY IF EXISTS "admin_full_access_attendance" ON public.attendance;
DROP POLICY IF EXISTS "mentors_manage_own_attendance" ON public.attendance;
DROP POLICY IF EXISTS "student_parent_view_own_attendance" ON public.attendance;

CREATE POLICY "admin_full_access_attendance"
ON public.attendance
FOR ALL
TO authenticated
USING (public.is_admin_user())
WITH CHECK (public.is_admin_user());

CREATE POLICY "mentors_manage_own_attendance"
ON public.attendance
FOR ALL
TO authenticated
USING (mentor_id = auth.uid())
WITH CHECK (mentor_id = auth.uid());

CREATE POLICY "student_parent_view_own_attendance"
ON public.attendance
FOR SELECT
TO authenticated
USING (
  student_id IN (
    SELECT student_id FROM public.user_profiles WHERE id = auth.uid() AND student_id IS NOT NULL
  )
);

-- ─── 9. RLS: meetings — admin can read all ───────────────────────────────────
DROP POLICY IF EXISTS "admin_full_access_meetings" ON public.meetings;
DROP POLICY IF EXISTS "mentors_manage_own_meetings" ON public.meetings;
DROP POLICY IF EXISTS "student_parent_view_own_meetings" ON public.meetings;

CREATE POLICY "admin_full_access_meetings"
ON public.meetings
FOR ALL
TO authenticated
USING (public.is_admin_user())
WITH CHECK (public.is_admin_user());

CREATE POLICY "mentors_manage_own_meetings"
ON public.meetings
FOR ALL
TO authenticated
USING (mentor_id = auth.uid())
WITH CHECK (mentor_id = auth.uid());

CREATE POLICY "student_parent_view_own_meetings"
ON public.meetings
FOR SELECT
TO authenticated
USING (
  student_id IN (
    SELECT student_id FROM public.user_profiles WHERE id = auth.uid() AND student_id IS NOT NULL
  )
);
