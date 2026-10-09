-- Perrie core schema: owner profile, integrations, calls + transcripts,
-- task orchestration, messages taken for the owner, and guardrail events.
--
-- Security model (no end-user auth yet): Row Level Security is ENABLED on
-- every table and NO policies are created, so the public anon / publishable
-- key can read or write nothing. Only the server (service-role / secret key,
-- never shipped to the browser) can access these tables.

create extension if not exists pgcrypto;

create or replace function public.perrie_touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Owner profile (single row: Perrie works for exactly one person)
-- ---------------------------------------------------------------------------
create table if not exists public.owner_profile (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  preferred_name text,
  pronouns text,
  timezone text not null default 'UTC',
  -- E.164 numbers the owner calls from. Caller ID alone is never trusted for
  -- actions: the PIN below is the second factor.
  phone_numbers text[] not null default '{}',
  pin_hash text,
  assistant_name text not null default 'Perrie',
  assistant_voice text,
  -- Standing instructions ("never book before 9am", ...).
  rules text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Facts the agent may use. 'private' facts are only ever used with the
-- verified owner; 'shareable' facts may be told to other callers.
create table if not exists public.profile_facts (
  id uuid primary key default gen_random_uuid(),
  category text not null default 'other',
  label text not null,
  value text not null,
  visibility text not null default 'private' check (visibility in ('private', 'shareable')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Integrations (Google Calendar, Google Contacts, ... future ones)
-- ---------------------------------------------------------------------------
create table if not exists public.integrations (
  id text primary key,
  status text not null default 'disconnected' check (status in ('connected', 'disconnected', 'error')),
  account_label text,
  scopes text[] not null default '{}',
  -- AES-256-GCM encrypted JSON (OAuth tokens). Encrypted by the app with
  -- PERRIE_SECRET before it ever reaches the database.
  credentials_enc text,
  meta jsonb not null default '{}',
  connected_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Task orchestration
-- ---------------------------------------------------------------------------
create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  request text not null,
  source text not null default 'dashboard' check (source in ('dashboard', 'voice', 'playground')),
  status text not null default 'planning' check (
    status in ('planning', 'awaiting_approval', 'running', 'waiting', 'completed', 'failed', 'canceled')
  ),
  plan_summary text,
  result_summary text,
  error text,
  origin_call_id uuid,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.task_steps (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks (id) on delete cascade,
  position int not null,
  title text not null,
  description text not null default '',
  tool text not null,
  depends_on int[] not null default '{}',
  status text not null default 'pending' check (
    status in ('pending', 'running', 'waiting', 'succeeded', 'failed', 'skipped')
  ),
  input jsonb,
  output jsonb,
  error text,
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists task_steps_task_idx on public.task_steps (task_id, position);

-- ---------------------------------------------------------------------------
-- Calls and transcripts
-- ---------------------------------------------------------------------------
create table if not exists public.calls (
  id uuid primary key default gen_random_uuid(),
  twilio_call_sid text unique,
  direction text not null check (direction in ('inbound', 'outbound', 'web')),
  role text not null default 'unverified' check (role in ('owner', 'guest', 'delegate', 'unverified')),
  from_number text,
  to_number text,
  counterpart_name text,
  status text not null default 'queued',
  -- For delegate (outbound) calls: what the owner asked Perrie to achieve.
  mission text,
  -- Human-readable description written after the call.
  summary text,
  outcome jsonb,
  task_id uuid references public.tasks (id) on delete set null,
  task_step_id uuid references public.task_steps (id) on delete set null,
  started_at timestamptz,
  ended_at timestamptz,
  duration_seconds int,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists calls_created_idx on public.calls (created_at desc);

alter table public.tasks
  drop constraint if exists tasks_origin_call_fk,
  add constraint tasks_origin_call_fk foreign key (origin_call_id) references public.calls (id) on delete set null;

create table if not exists public.call_turns (
  id uuid primary key default gen_random_uuid(),
  call_id uuid not null references public.calls (id) on delete cascade,
  seq int not null,
  speaker text not null check (speaker in ('caller', 'agent', 'system', 'tool')),
  text text not null,
  meta jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists call_turns_call_idx on public.call_turns (call_id, seq);

-- Messages Perrie took for the owner from other callers.
create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  call_id uuid references public.calls (id) on delete set null,
  from_name text,
  from_number text,
  body text not null,
  urgency text not null default 'normal' check (urgency in ('low', 'normal', 'high')),
  read boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Every time a guardrail fires (blocked tool, redacted private detail,
-- failed owner verification, ...) it is recorded here for review.
create table if not exists public.guardrail_events (
  id uuid primary key default gen_random_uuid(),
  call_id uuid references public.calls (id) on delete cascade,
  task_id uuid references public.tasks (id) on delete cascade,
  kind text not null,
  severity text not null default 'info' check (severity in ('info', 'warn', 'block')),
  detail text not null,
  meta jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists guardrail_events_created_idx on public.guardrail_events (created_at desc);

-- ---------------------------------------------------------------------------
-- updated_at triggers + RLS lock-down
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array[
    'owner_profile', 'profile_facts', 'integrations', 'tasks', 'task_steps',
    'calls', 'call_turns', 'messages', 'guardrail_events'
  ] loop
    execute format('drop trigger if exists %I_touch on public.%I', t, t);
    execute format(
      'create trigger %I_touch before update on public.%I for each row execute function public.perrie_touch_updated_at()',
      t, t
    );
    execute format('alter table public.%I enable row level security', t);
  end loop;
end;
$$;
