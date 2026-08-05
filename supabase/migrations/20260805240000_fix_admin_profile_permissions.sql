-- Migration: Fix admin permission denied for table users
-- Root cause: is_admin_user() only checked auth metadata, not user_profiles.role
-- Fix: Update is_admin_user() to also check user_profiles.role (via a separate SECURITY DEFINER function)
-- Also: Add admin_upsert_user_profile() RPC so admin can insert profiles for other users

-- ─── 1. Helper: check role from user_profiles (SECURITY DEFINER avoids recursion) ──
-- This function reads user_profiles without triggering RLS on user_profiles itself
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT role FROM public.user_profiles WHERE id = auth.uid() LIMIT 1
$$;

-- ─── 2. Update is_admin_user() to check BOTH auth metadata AND user_profiles.role ──
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
  OR public.get_my_role() = 'admin'
$$;

-- ─── 3. SECURITY DEFINER RPC: admin can upsert any user_profile ──────────────
-- This bypasses RLS entirely (runs as the function owner, not the calling user)
-- Only callable by authenticated users who pass the is_admin_user() check
CREATE OR REPLACE FUNCTION public.admin_upsert_user_profile(
  p_id UUID,
  p_email TEXT,
  p_full_name TEXT,
  p_role TEXT,
  p_mentor_pillars TEXT[] DEFAULT ARRAY[]::TEXT[],
  p_student_id UUID DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Security check: only admins can call this
  IF NOT public.is_admin_user() THEN
    RAISE EXCEPTION 'Permission denied: admin access required';
  END IF;

  INSERT INTO public.user_profiles (id, email, full_name, role, mentor_pillars, student_id)
  VALUES (p_id, p_email, p_full_name, p_role, p_mentor_pillars, p_student_id)
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = EXCLUDED.full_name,
    role = EXCLUDED.role,
    mentor_pillars = EXCLUDED.mentor_pillars,
    student_id = COALESCE(EXCLUDED.student_id, public.user_profiles.student_id),
    updated_at = CURRENT_TIMESTAMP;
END;
$$;

-- ─── 4. SECURITY DEFINER RPC: admin can link student_id to a user_profile ────
CREATE OR REPLACE FUNCTION public.admin_link_student_to_profile(
  p_user_id UUID,
  p_student_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NOT public.is_admin_user() THEN
    RAISE EXCEPTION 'Permission denied: admin access required';
  END IF;

  UPDATE public.user_profiles
  SET student_id = p_student_id, updated_at = CURRENT_TIMESTAMP
  WHERE id = p_user_id;
END;
$$;

-- ─── 5. Grant execute permissions to authenticated users ─────────────────────
GRANT EXECUTE ON FUNCTION public.get_my_role() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin_user() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_upsert_user_profile(UUID, TEXT, TEXT, TEXT, TEXT[], UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_link_student_to_profile(UUID, UUID) TO authenticated;
