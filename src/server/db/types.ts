/**
 * Row types. Field names mirror the Supabase columns exactly (snake_case) so
 * both storage backends can share one generic table API without mapping.
 * Keep in sync with supabase/migrations/*.sql.
 */

type Base = { id: string; created_at: string; updated_at: string };
type Json = Record<string, unknown>;

export type Visibility = "private" | "shareable";
export type CallRole = "owner" | "guest" | "delegate" | "unverified";
export type CallDirection = "inbound" | "outbound" | "web";
export type TaskStatus =
  | "planning"
  | "awaiting_approval"
  | "running"
  | "waiting"
  | "completed"
  | "failed"
  | "canceled";
export type StepStatus = "pending" | "running" | "waiting" | "succeeded" | "failed" | "skipped";
export type Severity = "info" | "warn" | "block";

export interface OwnerProfile extends Base {
  full_name: string;
  preferred_name: string | null;
  pronouns: string | null;
  timezone: string;
  phone_numbers: string[];
  pin_hash: string | null;
  assistant_name: string;
  assistant_voice: string | null;
  rules: string[];
}

export interface ProfileFact extends Base {
  category: string;
  label: string;
  value: string;
  visibility: Visibility;
}

export interface IntegrationRecord extends Base {
  status: "connected" | "disconnected" | "error";
  account_label: string | null;
  scopes: string[];
  credentials_enc: string | null;
  meta: Json;
  connected_at: string | null;
}

export interface TaskRecord extends Base {
  title: string;
  request: string;
  source: "dashboard" | "voice" | "playground";
  status: TaskStatus;
  plan_summary: string | null;
  result_summary: string | null;
  error: string | null;
  origin_call_id: string | null;
  completed_at: string | null;
}

export interface TaskStep extends Base {
  task_id: string;
  position: number;
  title: string;
  description: string;
  tool: string;
  depends_on: number[];
  status: StepStatus;
  input: Json | null;
  output: Json | null;
  error: string | null;
  started_at: string | null;
  finished_at: string | null;
}

export interface CallRecord extends Base {
  twilio_call_sid: string | null;
  direction: CallDirection;
  role: CallRole;
  from_number: string | null;
  to_number: string | null;
  counterpart_name: string | null;
  status: string;
  mission: string | null;
  summary: string | null;
  outcome: Json | null;
  task_id: string | null;
  task_step_id: string | null;
  started_at: string | null;
  ended_at: string | null;
  duration_seconds: number | null;
}

export interface CallTurn extends Base {
  call_id: string;
  seq: number;
  speaker: "caller" | "agent" | "system" | "tool";
  text: string;
  meta: Json;
}

export interface MessageRecord extends Base {
  call_id: string | null;
  from_name: string | null;
  from_number: string | null;
  body: string;
  urgency: "low" | "normal" | "high";
  read: boolean;
}

export interface GuardrailEvent extends Base {
  call_id: string | null;
  task_id: string | null;
  kind: string;
  severity: Severity;
  detail: string;
  meta: Json;
}

export type EvaluationStatus = "pending" | "submitted" | "evaluating" | "completed" | "failed" | "skipped";

export interface MonitoringState extends Base {
  status: "not_set_up" | "ready" | "partial" | "error";
  config: Json;
  last_error: string | null;
}

export interface CallEvaluation extends Base {
  call_id: string;
  provider: string;
  status: EvaluationStatus;
  external_call_id: string | null;
  scores: Json | null;
  raw: Json | null;
  error: string | null;
  attempts: number;
  submitted_at: string | null;
  completed_at: string | null;
  next_check_at: string | null;
  /** Sent by hand ("Send to Bluejay"), bypassing BLUEJAY_EVALUATE. */
  forced: boolean;
}

export interface SimulationRun extends Base {
  provider: string;
  simulation_id: string | null;
  external_run_id: string | null;
  status: "queued" | "running" | "completed" | "failed";
  summary: Json | null;
  results: Json | null;
  error: string | null;
  completed_at: string | null;
  next_check_at: string | null;
}

export interface Tables {
  owner_profile: OwnerProfile;
  profile_facts: ProfileFact;
  integrations: IntegrationRecord;
  tasks: TaskRecord;
  task_steps: TaskStep;
  calls: CallRecord;
  call_turns: CallTurn;
  messages: MessageRecord;
  guardrail_events: GuardrailEvent;
  monitoring_state: MonitoringState;
  call_evaluations: CallEvaluation;
  simulation_runs: SimulationRun;
}

export type TableName = keyof Tables;
export type Row<T extends TableName> = Tables[T];
/** Insert shape: id/timestamps optional, everything else as declared. */
export type Insert<T extends TableName> = Omit<Row<T>, "id" | "created_at" | "updated_at"> &
  Partial<Pick<Row<T>, "id" | "created_at">>;
export type Patch<T extends TableName> = Partial<Omit<Row<T>, "id" | "created_at" | "updated_at">>;

export interface ListOptions<T extends TableName> {
  where?: Partial<Row<T>>;
  orderBy?: keyof Row<T> & string;
  ascending?: boolean;
  limit?: number;
}

/** Minimal table API implemented by both the Supabase and local backends. */
export interface Store {
  readonly kind: "supabase" | "local";
  insert<T extends TableName>(table: T, row: Insert<T>): Promise<Row<T>>;
  upsert<T extends TableName>(table: T, row: Insert<T> & { id: string }): Promise<Row<T>>;
  update<T extends TableName>(table: T, id: string, patch: Patch<T>): Promise<Row<T>>;
  get<T extends TableName>(table: T, id: string): Promise<Row<T> | null>;
  list<T extends TableName>(table: T, opts?: ListOptions<T>): Promise<Row<T>[]>;
  remove<T extends TableName>(table: T, id: string): Promise<void>;
}
