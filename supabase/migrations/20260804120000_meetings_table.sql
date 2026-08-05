-- Migration: meetings table for per-student scheduled video sessions
-- Linked to students (cascade delete) and mentors (user_profiles)

CREATE TABLE IF NOT EXISTS public.meetings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    mentor_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    title TEXT NOT NULL DEFAULT 'Mentorship Session',
    meeting_date DATE NOT NULL,
    meeting_time TEXT NOT NULL DEFAULT '10:00',
    jitsi_room TEXT NOT NULL,
    jitsi_url TEXT NOT NULL,
    notes TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_meetings_mentor_id ON public.meetings(mentor_id);
CREATE INDEX IF NOT EXISTS idx_meetings_student_id ON public.meetings(student_id);
CREATE INDEX IF NOT EXISTS idx_meetings_meeting_date ON public.meetings(meeting_date);

-- Updated_at trigger
CREATE OR REPLACE FUNCTION public.update_meetings_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS meetings_updated_at ON public.meetings;
CREATE TRIGGER meetings_updated_at
    BEFORE UPDATE ON public.meetings
    FOR EACH ROW
    EXECUTE FUNCTION public.update_meetings_updated_at();

-- Enable RLS
ALTER TABLE public.meetings ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DROP POLICY IF EXISTS "mentors_manage_own_meetings" ON public.meetings;
CREATE POLICY "mentors_manage_own_meetings"
ON public.meetings
FOR ALL
TO authenticated
USING (mentor_id = auth.uid())
WITH CHECK (mentor_id = auth.uid());
