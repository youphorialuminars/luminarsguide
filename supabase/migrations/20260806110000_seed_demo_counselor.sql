-- ============================================================
-- SEED: Demo Counselor account for login screen
-- ============================================================

DO $$
DECLARE
  v_counselor_id UUID;
BEGIN
  -- Check if the counselor demo account already exists in auth.users
  SELECT id INTO v_counselor_id
  FROM auth.users
  WHERE email = 'counselor@luminar.guide'
  LIMIT 1;

  -- Only insert if it does not already exist
  IF v_counselor_id IS NULL THEN
    v_counselor_id := gen_random_uuid();

    INSERT INTO auth.users (
      id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
      created_at, updated_at, raw_user_meta_data, raw_app_meta_data,
      is_sso_user, is_anonymous, confirmation_token, confirmation_sent_at,
      recovery_token, recovery_sent_at, email_change_token_new, email_change,
      email_change_sent_at, email_change_token_current, email_change_confirm_status,
      reauthentication_token, reauthentication_sent_at, phone, phone_change,
      phone_change_token, phone_change_sent_at
    ) VALUES (
      v_counselor_id,
      '00000000-0000-0000-0000-000000000000',
      'authenticated',
      'authenticated',
      'counselor@luminar.guide',
      crypt('LuminarCounselor@2026', gen_salt('bf', 10)),
      now(),
      now(),
      now(),
      jsonb_build_object('full_name', 'Demo Counselor', 'role', 'counselor'),
      jsonb_build_object('provider', 'email', 'providers', ARRAY['email']::TEXT[]),
      false, false, '', null, '', null, '', '', null, '', 0, '', null, null, '', '', null
    );

    -- The handle_new_user trigger will auto-create the user_profiles row.
    -- But in case the trigger already ran or we need to ensure the role is correct,
    -- upsert the profile explicitly.
    INSERT INTO public.user_profiles (id, email, full_name, role, mentor_pillars)
    VALUES (
      v_counselor_id,
      'counselor@luminar.guide',
      'Demo Counselor',
      'counselor',
      ARRAY[]::TEXT[]
    )
    ON CONFLICT (id) DO UPDATE SET
      role       = 'counselor',
      full_name  = COALESCE(EXCLUDED.full_name, public.user_profiles.full_name),
      updated_at = CURRENT_TIMESTAMP;

    RAISE NOTICE 'Demo counselor account created: counselor@luminar.guide';
  ELSE
    -- Account exists — ensure the role in user_profiles is set to counselor
    UPDATE public.user_profiles
    SET role = 'counselor', updated_at = CURRENT_TIMESTAMP
    WHERE id = v_counselor_id
      AND role != 'counselor';

    RAISE NOTICE 'Demo counselor account already exists; role ensured.';
  END IF;

EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Seed counselor failed: %', SQLERRM;
END $$;
