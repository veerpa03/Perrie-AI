# Perrie — personal AI assistant

Perrie answers **your** phone, calls people **for you**, books your calendar, and
looks people up in your contacts. It works for exactly one person: you. Anyone
else who calls gets a polite receptionist that takes messages.

- `pnpm dev` → http://localhost:3000/dashboard (landing page stays at `/`)
- `pnpm test` → guardrail, orchestrator and webhook-security tests
- `pnpm seed:sample` → adds labelled sample calls/tasks to the local store

---

## 1. How it fits together

```
           ┌────────────── one Node process (server/index.ts) ──────────────┐
 Twilio ──▶│ /api/twilio/voice  ── caller ID + keypad PIN ─▶ role            │
 (phone)   │ /api/twilio/stream ◀─ WebSocket (μ-law audio) ─▶ VoiceCall       │
           │      Deepgram STT ─▶ AgentSession ─▶ Deepgram TTS ─▶ back to call│
           │                          │                                       │
 Browser ─▶│ /dashboard (Next.js)     ▼                                       │
 (local)   │   profile · calls · ── executeTool() ── role check · connected · │
           │   tasks · integrations    │             schema · confirmation    │
           │   voice QA · playground   ▼                                       │
           │                   Integration registry ── Google Calendar         │
           │   Planner ─▶ Executor     (tools)          Google Contacts        │
           │   (tasks)                                  Twilio (call, SMS) …   │
           └──────────────────────┬─────────────────────────────────────────────┘
                                  ▼
                 Supabase (or .perrie/ local store until configured)
```

| Piece | Where |
| --- | --- |
| Data model (SQL) | `supabase/migrations/20261009000000_perrie_core.sql` |
| Storage (Supabase or local) | `src/server/db/` |
| Integrations + tools registry | `src/server/integrations/registry.ts` |
| Agent brain + guardrails | `src/server/agent/` (`session.ts`, `guardrails.ts`, `prompts.ts`) |
| Task orchestration | `src/server/orchestrator/` (`planner.ts`, `executor.ts`) |
| Phone calls | `app/api/twilio/*`, `src/server/voice/` |
| Bluejay MCP client | `src/server/integrations/bluejay.ts` |
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

### Step 6: Bluejay (voice QA)
1. app.getbluejay.ai › Settings › API Keys → `BLUEJAY_API_KEY` (it is shown only once).
2. In Bluejay, add an agent that points at your Twilio number.
3. **Voice QA** shows Bluejay's data. Its tools are discovered live over MCP, so read-only
   lists load automatically and any tool (e.g. queue a simulation run) can be run from a form.
   The page also lists guardrail scenarios to turn into digital humans.
4. The same key powers the `bluejay` entry in `.mcp.json` (sent as an `X-API-Key` header,
   never as a tool argument), so Claude Code can drive Bluejay too.

---

## 3. Adding an integration

1. Create `src/server/integrations/<name>.ts` that exports an `IntegrationDef`:
   `status()` plus tools. Each tool declares a zod `input`, `roles`, and
   `sideEffect` (if true, it asks first). Set `async` if it completes later, the way a call does.
2. Add it to `INTEGRATIONS` in `registry.ts`.

That's all. The voice agent, the planner, the executor, the Integrations page
and every guardrail apply to the new tools automatically.

---

## 4. Known limits (for now)

- No sign-in or multi-user support: it's one owner, and the dashboard is local-only unless you set a password.
- Voice runs in one long-lived Node process. It deploys to Fly/Render/Railway, not to serverless hosts.
- After a task finishes, the result is reported on the dashboard. There's no "call me back with the result" yet.
- The private-detail filter matches exact values (short facts, e-mails, numbers).
  Long free-text private facts rely on not being in the guest prompt at all.
