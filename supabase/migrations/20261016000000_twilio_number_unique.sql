-- Each tenant brings their own Twilio number now (see
-- src/server/integrations/twilioCreds.ts); nothing should let two tenants
-- claim the same number, since inbound-call routing (getProfileByPhoneNumber)
-- looks up the tenant by this column. The app already checks this before
-- saving, but the constraint is the real guarantee — defense in depth.
-- (Multiple NULLs are fine: Postgres UNIQUE treats NULL as distinct from NULL.)
alter table public.owner_profile
  add constraint owner_profile_assistant_phone_number_key unique (assistant_phone_number);
