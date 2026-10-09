# Perrie — personal AI assistant

Perrie answers **your** phone, calls people **for you**, books your calendar, and
looks people up in your contacts. It works for exactly one person: you. Anyone
else who calls gets a polite receptionist that takes messages.

- `pnpm dev` → http://localhost:3000/dashboard (landing page stays at `/`)
- `pnpm test` → guardrail, orchestrator, webhook-security and monitoring tests (with a stand-in Bluejay MCP server)
- `pnpm seed:sample` → adds labelled sample calls/tasks to the local store

---

## 1. How it fits together

Three separate areas:

- **Voice stack** — the engine: Twilio (telephony) → Deepgram (speech ⇄ text) → Claude (reasoning) → Supabase (storage).
- **Integrations** — *your apps* Perrie works with: Google Calendar and Google Contacts today; Excel, GitHub, Gmail… later.
- **Monitoring** — Bluejay watches quality from the outside: it scores every finished call and sends simulated callers to test Perrie.

```
 caller ⇄ Twilio ⇄ /api/twilio/stream ⇄ Deepgram STT → AgentSession (Claude) → Deepgram TTS ⇄ Twilio ⇄ caller
                                                │
                                   executeTool(): role · connected · schema · confirmation
                                                │
                     built-in tools (messages, tasks, calls/texts)  +  app integrations (Calendar, Contacts, …)
                                                │
 call ends → summary (Claude) → Supabase  ──▶  Bluejay MCP `evaluate`  ──▶  scores back on the call + Monitoring page
                                               Bluejay simulated callers ──▶ dial Perrie's Twilio number ──▶ scored runs
```

| Piece | Where |
| --- | --- |
| Data model (SQL) | `supabase/migrations/20261009000000_perrie_core.sql`, `…010000_monitoring.sql` |
| Storage (Supabase or local) | `src/server/db/` |
| Voice stack services | `src/server/platform/` (`services.ts`, `twilio.ts`) · `src/server/voice/` |
| Tools + registry (every tool call goes through `executeTool`) | `src/server/tools/` (`registry.ts`, `core.ts`, `telephony.ts`) |
| App integrations | `src/server/integrations/` (`index.ts`, `google/*`) |
| Agent brain + guardrails | `src/server/agent/` (`session.ts`, `guardrails.ts`, `prompts.ts`) |
| Task orchestration | `src/server/orchestrator/` (`planner.ts`, `executor.ts`) |
| Monitoring (Bluejay over MCP) | `src/server/monitoring/bluejay/` (`client`, `setup`, `payload`, `evaluations`, `simulations`) |
| Dashboard | `app/dashboard/*`, `src/components/dashboard/*` |

### Roles — "only my agent"

Every conversation has exactly one role, decided by the server, never by the model:

| Role | Who | Can do |
| --- | --- | --- |
| **owner** | You, calling from a number in your profile **and** typing your PIN | Everything: calendar, contacts, tasks, texts, messages |
| **guest** | Anyone else (including you without the PIN) | Leave a message; hear only facts you marked *shareable* |
| **delegate** | The person Perrie phones for a task | Talk about the mission only; leave a message for you |
| **system** | The orchestrator running a plan you approved | The tools in that plan |

Caller ID can be spoofed, so a matching number alone never unlocks owner mode.
Five wrong PINs in an hour locks owner mode for that hour.

### Guardrails (no hallucinating, no overstepping)

Enforced in code, outside the model:

1. **Role-gated tools**: a guest never even sees owner tools, and `executeTool`
   re-checks the role on every call (logged as *tool_blocked_for_role*).
2. **Grounded answers**: facts about you come only from your profile. Guests'
   prompts don't contain your private facts at all. Calendar/contacts questions
   must go through tools.
3. **Private-detail filter**: before anything is spoken to a non-owner, every sentence
   is checked against your private facts, e-mails and phone numbers. A match is
   replaced with "that's not something I can share" and logged.
4. **Confirm before acting**: any tool that changes something (book, text,
   call, start a task) is parked until you have spoken *and* said a clear yes.
   The model can't confirm on your behalf.
5. **Plans before actions**: tasks are planned first and run only after you
   approve. Plans using unknown tools are rejected. Steps fill their inputs from
   real earlier results, and they stop instead of guessing when information is missing.
6. **Calling safety**: no emergency, short-code or premium numbers; at most 10
   outbound calls per hour; Perrie always says it's an AI and that the call is
   transcribed.
7. **Webhook security**: Twilio requests must carry a valid signature; media
   streams need a short-lived HMAC token issued by our TwiML.
8. **Private dashboard**: without `DASHBOARD_PASSWORD`, the dashboard answers only
   direct requests to localhost. Anything through ngrok or another proxy gets 403.
9. **Audit trail**: every block, confirmation, failed PIN and rejected plan lands in
   `guardrail_events` and is shown on the dashboard.

---

## 2. Setup, step by step

Copy `.env.example` to `.env.local` and fill it in as you go. The overview page
has a checklist showing what's still missing.

### Step 1: Profile (no keys needed)
`pnpm dev`, then open **Profile**. Enter your name, timezone, phone numbers and a 4–8 digit
**PIN**. Add facts and mark each one *private* or *shareable*.

### Step 2: Supabase (database)
1. Create a project at supabase.com (a development project, not production data).
2. Connect the Supabase MCP server (already in `.mcp.json`). In a regular terminal run
   `claude /mcp`, choose **supabase**, and sign in in the browser. Then ask Claude Code to
   apply `supabase/migrations/20261009000000_perrie_core.sql`, or paste that file into the
   Supabase SQL editor.
   - Supabase's guidance: once the project exists, scope the MCP server to it
     (`&project_ref=<ref>`) and consider `&read_only=true`.
3. Add `SUPABASE_URL` and `SUPABASE_SECRET_KEY` (Settings › API keys › secret
   key) to `.env.local`. Restart. The sidebar badge switches to "Supabase connected".

RLS is enabled on every table with no policies, so only the server-side secret
key can read or write. Never put that key in browser code.

### Step 3: Claude (conversations, planning, summaries)
`ANTHROPIC_API_KEY`. Models default to `claude-sonnet-5-5` for voice (latency) and
`claude-opus-5-5` for planning. Override them with `PERRIE_MODEL_VOICE` / `PERRIE_MODEL_PLANNER`.
Now the **Playground** works: test yourself, a stranger, or a delegated call.

### Step 4: Phone (Twilio + Deepgram)
1. Buy a voice number in Twilio and set `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN` and
   `TWILIO_PHONE_NUMBER`.
2. `DEEPGRAM_API_KEY` (speech-to-text `nova-3`, voice `aura-2-*`; pick the voice on your profile).
3. Expose Perrie publicly, e.g. `ngrok http 3000`, and set `PUBLIC_BASE_URL=https://<id>.ngrok-free.app`.
4. In Twilio, set the number's **A call comes in** webhook to
   `POST {PUBLIC_BASE_URL}/api/twilio/voice`.
5. Call your number from your own phone: enter the PIN, then press #.

### Step 5: Google Calendar + Contacts
1. Google Cloud console: enable the **Google Calendar API** and the **People API**.
   Create an OAuth client of type *Web application* with the redirect URI
   `http://localhost:3000/api/integrations/google/callback`.
2. Set `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`, then use **Integrations › Connect Google**
   for Calendar and for Contacts. Tokens are encrypted with `PERRIE_SECRET` before storage.

### Step 6: Monitoring with Bluejay
1. app.getbluejay.ai › Settings › API Keys → `BLUEJAY_API_KEY` (shown only once). It is only ever sent as
   the `X-API-Key` header to `https://api.getbluejay.ai/mcp` — never as a tool argument.
2. Open **Monitoring** and press **Set up monitoring**. Over MCP, Perrie (idempotently — safe to re-run):
   - registers itself as an INBOUND · PHONE · VOICE agent with external id `perrie-voice` on your Twilio number
     (`get_agent_by_external_id` → `add_agent` / `update_agent_by_external_id`). Only *shareable* facts are sent as
     its knowledge base, and PII redaction is on;
   - creates six pass/fail guardrail metrics tagged `perrie-guardrails` (`create_custom_metrics`): no private info
     leaked, AI disclosure, owner-only actions, no made-up facts, stayed in role, message taken correctly;
   - creates the **Perrie guardrails** simulation (`create_simulation`) with seven simulated callers
     (`bulk_create_digital_humans`): a stranger fishing for your address, someone impersonating you, a prompt
     injection, an urgent message, "are you a robot?", an unknowable question, an abusive caller;
   - best effort: an uptime monitor and a guardrail alert (skipped, with the reason shown, if Bluejay needs fields
     Perrie can't know — finish those in the Bluejay app).
   It never calls `add_phone_number` (that buys a number).
3. From then on **every finished call** is sent to Bluejay's `evaluate` tool: the transcript (speaker + millisecond
   offsets), tool calls, guardrail events, direction (INBOUND/OUTBOUND), interface (PHONE, or WEB for the
   playground) and the `perrie-guardrails` metric tag. A background poller fetches the call log until Bluejay's
   scores are in — goal reached, made-up facts, latency, sentiment and each guardrail metric (a person's override
   in Bluejay wins) — and shows them on the call page and the Monitoring page.
   `BLUEJAY_EVALUATE=all|phone|non-owner|off` chooses which calls are sent.
4. **Run guardrail test now** queues the simulation (`queue_simulation_run`); results per simulated caller appear
   on the Monitoring page. **Run it daily** adds a Bluejay schedule. Each run is real phone calls, so it's opt-in.
5. The same key powers the `bluejay` entry in `.mcp.json`, so Claude Code can query and drive Bluejay too.

---

## 3. Adding an app integration (Excel, GitHub, …)

1. Create `src/server/integrations/<app>.ts` exporting an `AppIntegration`: how it connects (OAuth or API key),
   `status()`, and its tools — each with a zod `input`, the `roles` allowed to use it, and `sideEffect`
   (true ⇒ Perrie asks first). Set `async` if it completes later, like a phone call.
2. Add it to `APP_INTEGRATIONS` in `src/server/integrations/index.ts`.

That's all: the phone agent, the planner, the executor, the Integrations page and every guardrail apply to the
new tools automatically. (Infrastructure like a new speech provider belongs in `platform/`, not here.)

---

## 4. Known limits (for now)

- No sign-in or multi-user support: it's one owner, and the dashboard is local-only unless you set a password.
- Voice runs in one long-lived Node process. It deploys to Fly/Render/Railway, not to serverless hosts.
- After a task finishes, the result is reported on the dashboard. There's no "call me back with the result" yet.
- The private-detail filter matches exact values (short facts, e-mails, numbers).
  Long free-text private facts rely on not being in the guest prompt at all.
- Bluejay gets transcripts, not audio (no call recording yet), and transcript offsets are estimated from when
  Perrie logged each turn.
- Bluejay's request fields were taken from its published API models (bluejay-sdk 0.3.6); tool inputs are matched
  to each MCP tool's live schema at run time. Uptime-monitor and alert shapes aren't in those models, so those two
  setup steps are best effort.
