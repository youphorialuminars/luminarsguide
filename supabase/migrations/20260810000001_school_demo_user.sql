-- Add School demo user for login page demo credentials
DO $$
DECLARE
  school_uuid UUID := gen_random_uuid();
BEGIN
  INSERT INTO auth.users (
    id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
    created_at, updated_at, raw_user_meta_data, raw_app_meta_data,
    is_sso_user, is_anonymous, confirmation_token, confirmation_sent_at,
    recovery_token, recovery_sent_at, email_change_token_new, email_change,
    email_change_sent_at, email_change_token_current, email_change_confirm_status,
    reauthentication_token, reauthentication_sent_at, phone, phone_change,
    phone_change_token, phone_change_sent_at
  ) VALUES (
    school_uuid, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
    'school@luminar.guide', crypt('LuminarSchool@2026', gen_salt('bf', 10)), now(), now(), now(),
    jsonb_build_object('full_name', 'Demo School', 'role', 'school'),
    jsonb_build_object('provider', 'email', 'providers', ARRAY['email']::TEXT[]),
    false, false, '', null, '', null, '', '', null, '', 0, '', null, null, '', '', null
  )
  ON CONFLICT (email) DO NOTHING;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'School demo user creation skipped: %', SQLERRM;
END $$;
