-- Sessions table: stores all AI-generated analyses permanently
-- Linked to both mentor (user_profiles) and student (students)

CREATE TABLE IF NOT EXISTS public.sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mentor_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  topic TEXT NOT NULL DEFAULT '',
  score INTEGER,
  observations TEXT NOT NULL DEFAULT '',
  model TEXT NOT NULL DEFAULT '',
  session_date TEXT NOT NULL DEFAULT '',
  -- AI analysis stored as JSONB arrays
  strengths JSONB NOT NULL DEFAULT '[]'::jsonb,
  weaknesses JSONB NOT NULL DEFAULT '[]'::jsonb,
  approach JSONB NOT NULL DEFAULT '[]'::jsonb,
  tasks JSONB NOT NULL DEFAULT '[]'::jsonb,
  -- Raw Gemini response for audit/replay
  gemini_response TEXT,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_sessions_mentor_id ON public.sessions(mentor_id);
CREATE INDEX IF NOT EXISTS idx_sessions_student_id ON public.sessions(student_id);
CREATE INDEX IF NOT EXISTS idx_sessions_mentor_student ON public.sessions(mentor_id, student_id);
CREATE INDEX IF NOT EXISTS idx_sessions_created_at ON public.sessions(created_at DESC);

-- updated_at trigger function (reuse pattern from students table)
CREATE OR REPLACE FUNCTION public.update_sessions_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sessions_updated_at ON public.sessions;
CREATE TRIGGER sessions_updated_at
  BEFORE UPDATE ON public.sessions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_sessions_updated_at();

-- Enable RLS
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;

-- RLS Policies: mentors can only access their own sessions
DROP POLICY IF EXISTS "mentors_select_own_sessions" ON public.sessions;
CREATE POLICY "mentors_select_own_sessions"
  ON public.sessions
  FOR SELECT
  TO authenticated
  USING (mentor_id = auth.uid());

DROP POLICY IF EXISTS "mentors_insert_own_sessions" ON public.sessions;
CREATE POLICY "mentors_insert_own_sessions"
  ON public.sessions
  FOR INSERT
  TO authenticated
  WITH CHECK (mentor_id = auth.uid());

DROP POLICY IF EXISTS "mentors_update_own_sessions" ON public.sessions;
CREATE POLICY "mentors_update_own_sessions"
  ON public.sessions
  FOR UPDATE
  TO authenticated
  USING (mentor_id = auth.uid())
  WITH CHECK (mentor_id = auth.uid());

DROP POLICY IF EXISTS "mentors_delete_own_sessions" ON public.sessions;
CREATE POLICY "mentors_delete_own_sessions"
  ON public.sessions
  FOR DELETE
  TO authenticated
  USING (mentor_id = auth.uid());
