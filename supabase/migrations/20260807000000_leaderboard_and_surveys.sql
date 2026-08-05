-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: Mentor Leaderboard & Survey Support
-- Tables: mentor_weekly_reflections, counselor_supervisor_ratings
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. mentor_weekly_reflections
-- Mentors rate their own weekly impact (1-10). Linked counselors can read.
CREATE TABLE IF NOT EXISTS public.mentor_weekly_reflections (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mentor_id       UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  week_start      DATE NOT NULL,
  impact_score    INTEGER NOT NULL CHECK (impact_score BETWEEN 1 AND 10),
  reflection_text TEXT NOT NULL DEFAULT '',
  created_at      TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_mentor_weekly_reflections_mentor_id
  ON public.mentor_weekly_reflections(mentor_id);

CREATE INDEX IF NOT EXISTS idx_mentor_weekly_reflections_week_start
  ON public.mentor_weekly_reflections(week_start);

-- 2. counselor_supervisor_ratings
-- Counselors submit a 1-10 rating for a specific mentor.
CREATE TABLE IF NOT EXISTS public.counselor_supervisor_ratings (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  counselor_id  UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  mentor_id     UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  rating        INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 10),
  notes         TEXT NOT NULL DEFAULT '',
  created_at    TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_counselor_supervisor_ratings_mentor_id
  ON public.counselor_supervisor_ratings(mentor_id);

CREATE INDEX IF NOT EXISTS idx_counselor_supervisor_ratings_counselor_id
  ON public.counselor_supervisor_ratings(counselor_id);

-- ─── Enable RLS ───────────────────────────────────────────────────────────────
ALTER TABLE public.mentor_weekly_reflections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.counselor_supervisor_ratings ENABLE ROW LEVEL SECURITY;

-- ─── Helper function: check if caller is a counselor linked to a mentor ───────
CREATE OR REPLACE FUNCTION public.is_counselor_of_mentor(p_mentor_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE id = p_mentor_id
      AND counselor_id = auth.uid()
  );
$$;

-- ─── RLS Policies: mentor_weekly_reflections ─────────────────────────────────

-- Mentors can manage their own reflections
DROP POLICY IF EXISTS "mentors_manage_own_reflections" ON public.mentor_weekly_reflections;
CREATE POLICY "mentors_manage_own_reflections"
  ON public.mentor_weekly_reflections
  FOR ALL
  TO authenticated
  USING (mentor_id = auth.uid())
  WITH CHECK (mentor_id = auth.uid());

-- Counselors can read reflections of their linked mentors
DROP POLICY IF EXISTS "counselors_read_linked_mentor_reflections" ON public.mentor_weekly_reflections;
CREATE POLICY "counselors_read_linked_mentor_reflections"
  ON public.mentor_weekly_reflections
  FOR SELECT
  TO authenticated
  USING (public.is_counselor_of_mentor(mentor_id));

-- ─── RLS Policies: counselor_supervisor_ratings ──────────────────────────────

-- Counselors can manage their own ratings
DROP POLICY IF EXISTS "counselors_manage_own_supervisor_ratings" ON public.counselor_supervisor_ratings;
CREATE POLICY "counselors_manage_own_supervisor_ratings"
  ON public.counselor_supervisor_ratings
  FOR ALL
  TO authenticated
  USING (counselor_id = auth.uid())
  WITH CHECK (counselor_id = auth.uid());

-- Mentors can read ratings submitted about them
DROP POLICY IF EXISTS "mentors_read_own_supervisor_ratings" ON public.counselor_supervisor_ratings;
CREATE POLICY "mentors_read_own_supervisor_ratings"
  ON public.counselor_supervisor_ratings
  FOR SELECT
  TO authenticated
  USING (mentor_id = auth.uid());
