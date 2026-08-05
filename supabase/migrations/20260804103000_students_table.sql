-- Migration: students table linked to authenticated mentors
-- Each mentor (auth user) owns their own students for full data isolation

-- 1. Create students table
CREATE TABLE IF NOT EXISTS public.students (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    mentor_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    student_code TEXT NOT NULL,
    grade TEXT NOT NULL DEFAULT '',
    primary_topic TEXT NOT NULL DEFAULT '',
    notes TEXT DEFAULT '',
    avatar TEXT NOT NULL DEFAULT '',
    avg_score INTEGER NOT NULL DEFAULT 0,
    sessions INTEGER NOT NULL DEFAULT 0,
    topics TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    trend TEXT NOT NULL DEFAULT 'stable',
    alert_level TEXT DEFAULT NULL,
    last_session TEXT DEFAULT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 2. Indexes
CREATE INDEX IF NOT EXISTS idx_students_mentor_id ON public.students(mentor_id);
CREATE INDEX IF NOT EXISTS idx_students_created_at ON public.students(created_at);

-- 3. Updated_at trigger function
CREATE OR REPLACE FUNCTION public.handle_students_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$;

-- 4. Enable RLS
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;

-- 5. RLS Policies (mentor sees only their own students)
DROP POLICY IF EXISTS "mentors_manage_own_students" ON public.students;
CREATE POLICY "mentors_manage_own_students"
ON public.students
FOR ALL
TO authenticated
USING (mentor_id = auth.uid())
WITH CHECK (mentor_id = auth.uid());

-- 6. Trigger for updated_at
DROP TRIGGER IF EXISTS on_students_updated ON public.students;
CREATE TRIGGER on_students_updated
    BEFORE UPDATE ON public.students
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_students_updated_at();
