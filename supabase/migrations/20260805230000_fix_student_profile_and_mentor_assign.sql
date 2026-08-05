-- Migration: Fix student profile blank dashboard + mentor assignment failures
-- Root causes:
--   1. is_admin_user() only checks auth metadata, not user_profiles.role
--      → admin accounts created without metadata role='admin' can't update students
--   2. student_user_id / student_id link may be missing for existing students (e.g. Sneha)
--      → student dashboard falls back to email lookup but RLS blocks the read
--   3. student_parent_view_own policy requires student_id in user_profiles,
--      but if the link was never written the student sees nothing

-- ─── 1. Improve is_admin_user() to also check user_profiles.role ─────────────
-- This fixes mentor assignment: admin can now update students.mentor_id
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
  OR EXISTS (
    SELECT 1 FROM public.user_profiles up
    WHERE up.id = auth.uid()
    AND up.role = 'admin'
  )
$$;

-- ─── 2. Fix student_parent_view_own on students ───────────────────────────────
-- Old policy only checked student_id in user_profiles (which may be null for Sneha).
-- New policy ALSO allows access when student_email matches the user's email,
-- so even if the link was never written the student can still see their record.
DROP POLICY IF EXISTS "student_parent_view_own" ON public.students;
CREATE POLICY "student_parent_view_own"
ON public.students
FOR SELECT
TO authenticated
USING (
  student_user_id = auth.uid()
  OR id IN (
    SELECT student_id FROM public.user_profiles
    WHERE id = auth.uid() AND student_id IS NOT NULL
  )
  OR student_email = (
    SELECT email FROM auth.users WHERE id = auth.uid()
  )
);

-- ─── 3. Allow student/parent users to update their own user_profiles.student_id ─
-- This lets the auto-link fallback in StudentParentDashboardContent work
-- (it calls supabase.from('user_profiles').update({ student_id }) for the current user)
DROP POLICY IF EXISTS "users_update_own_profile" ON public.user_profiles;
CREATE POLICY "users_update_own_profile"
ON public.user_profiles
FOR UPDATE
TO authenticated
USING (id = auth.uid())
WITH CHECK (id = auth.uid());

-- ─── 4. Fix existing students that are missing the student_user_id link ─────────
-- For any student whose student_email matches an existing user_profiles email,
-- backfill student_user_id and also set user_profiles.student_id
DO $$
DECLARE
  rec RECORD;
BEGIN
  FOR rec IN
    SELECT s.id AS student_id, up.id AS user_id
    FROM public.students s
    JOIN public.user_profiles up ON up.email = s.student_email
    WHERE s.student_user_id IS NULL
      AND s.student_email IS NOT NULL
      AND s.student_email <> ''
  LOOP
    -- Set student_user_id on students row
    UPDATE public.students
    SET student_user_id = rec.user_id
    WHERE id = rec.student_id;

    -- Set student_id on user_profiles row (if not already set)
    UPDATE public.user_profiles
    SET student_id = rec.student_id
    WHERE id = rec.user_id AND student_id IS NULL;
  END LOOP;
END $$;
