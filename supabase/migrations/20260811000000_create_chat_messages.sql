-- Create chat_messages table for Mentor-Student Chat Room
-- This migration creates the missing chat_messages table with proper RLS policies

CREATE TABLE IF NOT EXISTS public.chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  recipient_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  student_id UUID REFERENCES public.students(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_chat_messages_sender ON public.chat_messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_recipient ON public.chat_messages(recipient_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_student ON public.chat_messages(student_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_created ON public.chat_messages(created_at);

ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

-- Users can see messages they sent or received
DROP POLICY IF EXISTS "users_view_own_chat_messages" ON public.chat_messages;
CREATE POLICY "users_view_own_chat_messages"
ON public.chat_messages
FOR SELECT
TO authenticated
USING (sender_id = auth.uid() OR recipient_id = auth.uid());

-- Users can insert messages where they are the sender
DROP POLICY IF EXISTS "users_send_chat_messages" ON public.chat_messages;
CREATE POLICY "users_send_chat_messages"
ON public.chat_messages
FOR INSERT
TO authenticated
WITH CHECK (sender_id = auth.uid());

-- Users can update is_read on messages they received
DROP POLICY IF EXISTS "users_mark_messages_read" ON public.chat_messages;
CREATE POLICY "users_mark_messages_read"
ON public.chat_messages
FOR UPDATE
TO authenticated
USING (recipient_id = auth.uid())
WITH CHECK (recipient_id = auth.uid());

-- Users can delete their own sent messages
DROP POLICY IF EXISTS "users_delete_own_messages" ON public.chat_messages;
CREATE POLICY "users_delete_own_messages"
ON public.chat_messages
FOR DELETE
TO authenticated
USING (sender_id = auth.uid());
