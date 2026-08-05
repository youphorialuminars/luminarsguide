-- Migration: Add age/gender to students, restructure sessions observations, add attendance table

-- 1. Add age and gender columns to students table
ALTER TABLE public.students
  ADD COLUMN IF NOT EXISTS age INTEGER,
  ADD COLUMN IF NOT EXISTS gender TEXT DEFAULT '';

-- 2. Add five structured observation columns to sessions table
ALTER TABLE public.sessions
  ADD COLUMN IF NOT EXISTS obs_offline_class TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS obs_online_task TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS obs_group_task TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS obs_mentor_call TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS obs_comprehensive TEXT NOT NULL DEFAULT '';

-- 3. Create attendance table
CREATE TABLE IF NOT EXISTS public.attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mentor_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  attendance_date DATE NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('present', 'absent')),
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(student_id, attendance_date)
);

-- 4. Indexes for attendance
CREATE INDEX IF NOT EXISTS idx_attendance_student_id ON public.attendance(student_id);
CREATE INDEX IF NOT EXISTS idx_attendance_mentor_id ON public.attendance(mentor_id);
CREATE INDEX IF NOT EXISTS idx_attendance_date ON public.attendance(attendance_date);

-- 5. Updated_at trigger for attendance
CREATE OR REPLACE FUNCTION public.update_attendance_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS attendance_updated_at ON public.attendance;
CREATE TRIGGER attendance_updated_at
  BEFORE UPDATE ON public.attendance
  FOR EACH ROW
  EXECUTE FUNCTION public.update_attendance_updated_at();

-- 6. Enable RLS on attendance
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "mentors_manage_own_attendance" ON public.attendance;
CREATE POLICY "mentors_manage_own_attendance"
  ON public.attendance
  FOR ALL
  TO authenticated
  USING (mentor_id = auth.uid())
  WITH CHECK (mentor_id = auth.uid());
