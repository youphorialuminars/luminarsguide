-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: Dynamic Surveys & Student Tasks
-- Tables: surveys, student_tasks
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. surveys
-- Mentors can INSERT/UPDATE/DELETE their own surveys.
-- Students can SELECT surveys where mentor_id matches their linked mentor.
CREATE TABLE IF NOT EXISTS public.surveys (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mentor_id   UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  url         TEXT NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_surveys_mentor_id ON public.surveys(mentor_id);

ALTER TABLE public.surveys ENABLE ROW LEVEL SECURITY;

-- Mentors manage their own surveys
DROP POLICY IF EXISTS "mentors_manage_own_surveys" ON public.surveys;
CREATE POLICY "mentors_manage_own_surveys"
  ON public.surveys
  FOR ALL
  TO authenticated
  USING (mentor_id = auth.uid())
  WITH CHECK (mentor_id = auth.uid());

-- Students can read surveys from their linked mentor
DROP POLICY IF EXISTS "students_read_mentor_surveys" ON public.surveys;
CREATE POLICY "students_read_mentor_surveys"
  ON public.surveys
  FOR SELECT
  TO authenticated
  USING (
    mentor_id IN (
      SELECT s.mentor_id
      FROM public.students s
      JOIN public.user_profiles up ON up.student_id = s.id
      WHERE up.id = auth.uid()
      UNION
      SELECT s2.mentor_id
      FROM public.students s2
      WHERE s2.student_user_id = auth.uid()
        OR s2.student_email = (SELECT email FROM auth.users WHERE id = auth.uid())
    )
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. student_tasks
-- Mentors assign tasks to students with priority, deadline, status.
-- Students can UPDATE the status column for their own tasks.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.student_tasks (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id       UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  mentor_id        UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  task_description TEXT NOT NULL,
  priority_rating  INTEGER NOT NULL DEFAULT 1 CHECK (priority_rating BETWEEN 1 AND 3),
  deadline         DATE,
  status           TEXT NOT NULL DEFAULT 'Pending' CHECK (status IN ('Pending', 'In Progress', 'Completed')),
  created_at       TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at       TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_student_tasks_student_id ON public.student_tasks(student_id);
CREATE INDEX IF NOT EXISTS idx_student_tasks_mentor_id  ON public.student_tasks(mentor_id);

ALTER TABLE public.student_tasks ENABLE ROW LEVEL SECURITY;

-- Mentors can fully manage tasks they created
DROP POLICY IF EXISTS "mentors_manage_own_tasks" ON public.student_tasks;
CREATE POLICY "mentors_manage_own_tasks"
  ON public.student_tasks
  FOR ALL
  TO authenticated
  USING (mentor_id = auth.uid())
  WITH CHECK (mentor_id = auth.uid());

-- Students can SELECT their own tasks
DROP POLICY IF EXISTS "students_read_own_tasks" ON public.student_tasks;
CREATE POLICY "students_read_own_tasks"
  ON public.student_tasks
  FOR SELECT
  TO authenticated
  USING (
    student_id IN (
      SELECT s.id FROM public.students s
      JOIN public.user_profiles up ON up.student_id = s.id
      WHERE up.id = auth.uid()
      UNION
      SELECT s2.id FROM public.students s2
      WHERE s2.student_user_id = auth.uid()
        OR s2.student_email = (SELECT email FROM auth.users WHERE id = auth.uid())
    )
  );

-- Students can UPDATE only the status column on their own tasks
DROP POLICY IF EXISTS "students_update_task_status" ON public.student_tasks;
CREATE POLICY "students_update_task_status"
  ON public.student_tasks
  FOR UPDATE
  TO authenticated
  USING (
    student_id IN (
      SELECT s.id FROM public.students s
      JOIN public.user_profiles up ON up.student_id = s.id
      WHERE up.id = auth.uid()
      UNION
      SELECT s2.id FROM public.students s2
      WHERE s2.student_user_id = auth.uid()
        OR s2.student_email = (SELECT email FROM auth.users WHERE id = auth.uid())
    )
  )
  WITH CHECK (
    student_id IN (
      SELECT s.id FROM public.students s
      JOIN public.user_profiles up ON up.student_id = s.id
      WHERE up.id = auth.uid()
      UNION
      SELECT s2.id FROM public.students s2
      WHERE s2.student_user_id = auth.uid()
        OR s2.student_email = (SELECT email FROM auth.users WHERE id = auth.uid())
    )
  );
