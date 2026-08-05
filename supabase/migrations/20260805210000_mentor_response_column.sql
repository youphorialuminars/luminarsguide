-- Migration: Add mentor_response and responded_at columns to student_reflections
-- Enables two-way sync: mentors write feedback, students see it on their dashboard

ALTER TABLE public.student_reflections
ADD COLUMN IF NOT EXISTS mentor_response TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS responded_at TIMESTAMPTZ DEFAULT NULL;
