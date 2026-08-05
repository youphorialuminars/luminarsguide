-- Migration: Fix mentor RLS policies
-- 1. Mentors can SELECT their own user_profile row
-- 2. Mentors can SELECT all students where students.mentor_id = their user_profiles.id
-- Uses SECURITY DEFINER helper to avoid recursion on user_profiles

-- ─── Helper: check if current user has mentor role ────────────────────────────
-- get_my_role() already exists from migration 20260805240000 — reuse it.
-- We add a convenience wrapper for mentor check on non-user_profiles tables.
CREATE OR REPLACE FUNCTION public.is_mentor_user()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT public.get_my_role() = 'mentor'
$$;

GRANT EXECUTE ON FUNCTION public.is_mentor_user() TO authenticated;

-- ─── user_profiles: mentor can SELECT own row ─────────────────────────────────
-- The existing policy likely only allows users to see their own row via id = auth.uid()
-- which already covers mentors. But we add an explicit named policy to be safe.
DROP POLICY IF EXISTS "mentor_select_own_profile" ON public.user_profiles;
CREATE POLICY "mentor_select_own_profile"
ON public.user_profiles
FOR SELECT
TO authenticated
USING (id = auth.uid());

-- ─── students: mentor can SELECT students assigned to them ────────────────────
-- We use a SECURITY DEFINER function to look up the mentor's profile id
-- without causing recursion (students table is not user_profiles).
CREATE OR REPLACE FUNCTION public.get_my_mentor_profile_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT id FROM public.user_profiles WHERE id = auth.uid() LIMIT 1
$$;

GRANT EXECUTE ON FUNCTION public.get_my_mentor_profile_id() TO authenticated;

-- Allow mentors to SELECT students where mentor_id matches their profile id
DROP POLICY IF EXISTS "mentor_select_assigned_students" ON public.students;
CREATE POLICY "mentor_select_assigned_students"
ON public.students
FOR SELECT
TO authenticated
USING (
  mentor_id = public.get_my_mentor_profile_id()
  AND public.is_mentor_user()
);

-- ─── Ensure admins retain full access to students ─────────────────────────────
-- is_admin_user() already exists from migration 20260805240000
DROP POLICY IF EXISTS "admin_full_access_students" ON public.students;
CREATE POLICY "admin_full_access_students"
ON public.students
FOR ALL
TO authenticated
USING (public.is_admin_user())
WITH CHECK (public.is_admin_user());

-- ─── Allow student_parent users to SELECT their own student row ───────────────
DROP POLICY IF EXISTS "student_parent_select_own_student" ON public.students;
CREATE POLICY "student_parent_select_own_student"
ON public.students
FOR SELECT
TO authenticated
USING (
  student_user_id = auth.uid()
  OR student_email = (SELECT email FROM public.user_profiles WHERE id = auth.uid() LIMIT 1)
);
