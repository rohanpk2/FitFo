-- List accounts for Fitfo Pro bypass / paywall rollout (run in Supabase SQL Editor as postgres).
-- Copy `id` values into FITFO_PRO_BYPASS_USER_IDS (API .env) and/or mobile
-- EXPO_PUBLIC_BILLING_BYPASS_USER_IDS, or paste into HARDCODED lists in code if needed.

select
  id,
  coalesce(nullif(trim(full_name), ''), '(no name)') as full_name,
  phone,
  email,
  apple_user_id,
  created_at,
  updated_at
from public.profiles
order by created_at desc;
