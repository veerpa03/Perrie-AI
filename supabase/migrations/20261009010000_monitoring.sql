-- Voice-agent monitoring (Bluejay over MCP): setup state, per-call
-- evaluations and guardrail simulation runs. Same lock-down as the core
-- schema: RLS on, no policies, server-side secret key only.

-- One row per monitoring provider ('bluejay'): what the setup created there.
create table if not exists public.monitoring_state (
  id text primary key,
  status text not null default 'not_set_up' check (status in ('not_set_up', 'ready', 'partial', 'error')),
  config jsonb not null default '{}',
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Every finished call sent for evaluation, and what came back.
create table if not exists public.call_evaluations (
  id uuid primary key default gen_random_uuid(),
  call_id uuid not null references public.calls (id) on delete cascade,
  provider text not null default 'bluejay',
  status text not null default 'pending' check (
    status in ('pending', 'submitted', 'evaluating', 'completed', 'failed', 'skipped')
  ),
  -- The provider's id for the call log (Bluejay: EvaluateCallResponse.call_id).
  external_call_id text,
  -- Normalised scores shown on the dashboard.
  scores jsonb,
  -- Last raw evaluation payload from the provider (trimmed).
  raw jsonb,
  error text,
  attempts int not null default 0,
  -- Sent by hand from the dashboard (bypasses BLUEJAY_EVALUATE).
  forced boolean not null default false,
  submitted_at timestamptz,
  completed_at timestamptz,
  next_check_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists call_evaluations_call_provider_idx on public.call_evaluations (call_id, provider);
create index if not exists call_evaluations_status_idx on public.call_evaluations (status, next_check_at);

-- Simulated-caller test runs (Bluejay digital humans calling Perrie).
create table if not exists public.simulation_runs (
  id uuid primary key default gen_random_uuid(),
  provider text not null default 'bluejay',
  simulation_id text,
  external_run_id text,
  status text not null default 'queued' check (status in ('queued', 'running', 'completed', 'failed')),
  summary jsonb,
  results jsonb,
  error text,
  completed_at timestamptz,
  next_check_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$
declare t text;
begin
  foreach t in array array['monitoring_state', 'call_evaluations', 'simulation_runs'] loop
    execute format('drop trigger if exists %I_touch on public.%I', t, t);
    execute format(
      'create trigger %I_touch before update on public.%I for each row execute function public.perrie_touch_updated_at()',
      t, t
    );
    execute format('alter table public.%I enable row level security', t);
  end loop;
end;
$$;
