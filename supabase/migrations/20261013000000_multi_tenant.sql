-- Multi-tenant: every tenant-scoped table gets a `user_id` (a Clerk user id,
-- e.g. "user_xxx" — text, not uuid). Tenant isolation is enforced in the app
-- layer (every read filters by user_id, every write stamps it, every
-- update/remove-by-id checks ownership first) — see src/server/db/index.ts.
-- RLS stays enabled with NO policies, same as before: only the server, via
-- the secret key, can touch these tables. Clerk is not wired into Supabase
-- Auth/JWTs, so there is nothing for a policy to check here.

alter table public.owner_profile add column if not exists user_id text;
alter table public.owner_profile add column if not exists assistant_phone_number text;
alter table public.profile_facts add column if not exists user_id text;
alter table public.tasks add column if not exists user_id text;
alter table public.task_steps add column if not exists user_id text;
alter table public.calls add column if not exists user_id text;
alter table public.call_turns add column if not exists user_id text;
alter table public.messages add column if not exists user_id text;
alter table public.guardrail_events add column if not exists user_id text;

-- `integrations.id` used to double as the primary key AND the integration
-- slug (e.g. "google_calendar"), global across the whole app. Multi-tenant
-- needs one row per (user, integration), so the slug moves to its own
-- column and the primary key becomes a generated uuid.
alter table public.integrations add column if not exists user_id text;
alter table public.integrations add column if not exists integration text;
update public.integrations set integration = id where integration is null;
alter table public.integrations alter column integration set not null;
alter table public.integrations drop constraint if exists integrations_pkey;
alter table public.integrations alter column id drop default;
alter table public.integrations alter column id type uuid using (
  case when id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    then id::uuid else gen_random_uuid() end
);
alter table public.integrations alter column id set default gen_random_uuid();
alter table public.integrations add constraint integrations_pkey primary key (id);
create unique index if not exists integrations_user_integration_idx
  on public.integrations (user_id, integration);

-- Backfill: existing rows (from before multi-tenant) have no owner yet.
-- Leave user_id null on them rather than guessing a tenant — a fresh
-- dev/local setup has none of this data anyway, and a real deployment
-- should re-create its one profile through the new sign-up flow.

alter table public.owner_profile add constraint owner_profile_user_unique unique (user_id);

create index if not exists profile_facts_user_idx on public.profile_facts (user_id);
create index if not exists integrations_user_idx on public.integrations (user_id);
create index if not exists tasks_user_idx on public.tasks (user_id);
create index if not exists task_steps_user_idx on public.task_steps (user_id);
create index if not exists calls_user_idx on public.calls (user_id);
create index if not exists call_turns_user_idx on public.call_turns (user_id);
create index if not exists messages_user_idx on public.messages (user_id);
create index if not exists guardrail_events_user_idx on public.guardrail_events (user_id);
