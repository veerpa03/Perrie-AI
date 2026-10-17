# Perrie

Perrie is a personal AI assistant: a marketing/landing page in front, plus a
real working backend behind it — a voice agent that answers phone calls for
its owner, a task orchestrator, and a dashboard the owner uses to configure
integrations and review calls/tasks. Next.js 15 (App Router) + React 19 +
Tailwind v4. Backend is real, not a preview; Supabase is optional (falls back
to local file storage when unset — see "Storage" below).

## Stack

- **Next.js 15 / React 19**, App Router, TypeScript.
- **Not plain `next dev`.** `server/index.ts` is a custom Node server that
  runs the Next app *and* a Twilio media-stream WebSocket in one process, so
  one public URL (e.g. one ngrok tunnel) serves both the site and live voice
  calls. `pnpm dev` / `pnpm start` run this custom server (`tsx
  server/index.ts`); `pnpm dev:next` is a plain-Next fallback with no voice
  gateway. The dashboard is gated by real Clerk accounts (`@clerk/nextjs`):
  `middleware.ts` calls `clerkMiddleware()` and `auth.protect()` on
  `/dashboard(.*)` and `/api/playground(.*)`, and dashboard pages are tied to
  the signed-in Clerk user (multi-tenant — each owner only sees their own
  calls/tasks/integrations). `/sign-in` and `/sign-up` are real Clerk pages.
  `server/access.ts` and `SignInForm.tsx` (an earlier HTTP-Basic/
  localhost-only gate) are gone — don't look for them.
- **Tailwind v4** — theme tokens live in `app/globals.css` under `@theme`,
  not in a `tailwind.config`.
- **GSAP + ScrollTrigger** pins and scroll-scrubs the hero journey
  (`JourneySection.tsx`). **Lenis is gone** — there is no smooth-scroll
  library in this project anymore; scrolling is native.
- **Three.js / React Three Fiber / drei are installed but unused.** Nothing
  in `src` or `app` imports them. The 3D "clay bead" icon panel and the
  particle `CloudField` that used R3F were both replaced by the orbit
  carousel redesign (CSS/DOM only — see below) and no longer exist. Don't
  assume an R3F scene exists; if the three.js devtools MCP server shows no
  activity, that's expected, not broken.
- **framer-motion is a real dependency now**, used for entrance/exit
  transitions in `AnimatedSignInButton.tsx`, `FeaturePopup.tsx`,
  `FinalCTA.tsx`, and `PerrieOrbitSection.tsx`. (An earlier version of this
  doc said the opposite — that's no longer true.)
- **Howler** for layered ambience/whoosh audio (`src/lib/audioController.ts`),
  muted by default.
- **Anthropic SDK + MCP SDK + Supabase JS + zod + ws** power the backend
  (voice agent, tool calling, storage, realtime media). See "Backend" below.

Run `pnpm dev`, `pnpm build`, `pnpm lint`, `pnpm typecheck`, `pnpm test`.
Package manager is pnpm (`pnpm-workspace.yaml`, `pnpm-lock.yaml`) — don't
introduce npm/yarn lockfiles.

## The landing page: `app/page.tsx`

Renders `JourneySection → PerrieOrbitSection → FinalCTA → Footer`, with
`AnimatedSignInButton` and `FloatingSoundToggle` as the only chrome (no
navbar, no wordmark, deliberately). There is **no FAQ section anymore** —
`FAQSection`/`CapabilitiesPanel`/`IntegrationsPanel` don't exist as
components. A `FAQ` constant still sits in `src/lib/constants.ts` but nothing
renders it — dead data, not a bug, if you go looking for where it's used.

### The journey (`JourneySection.tsx` + `useJourneyDriver.ts`)

Desktop pins `#journey-section` with GSAP `ScrollTrigger` (`pin`,
`start: "top top"`, `end: "bottom bottom"`) and drives a single rAF loop
(`useJourneyDriver`) that:
1. **Locks scroll for a one-time opening fly-in** on mount (`INTRO_MS`,
   descent frames 0 → `HERO_FRAC`, eased) — wheel/touch/key events are
   `preventDefault`-ed until it finishes, then unlocked. **This is an
   autoplay/scroll-locked intro, by design, as of the current build** — note
   this if you've seen an older version of this doc that said the opposite;
   that was true of an earlier iteration, not this one.
2. After the intro, scroll takes over: raw `ScrollTrigger` progress is
   exponentially smoothed (`PROGRESS_SMOOTHING`) and split via
   `splitJourneyProgress` into journey progress `p` (which frame/chapter) and
   a curtain transition `t` (the tree → carousel hand-off, see below).
3. `p` → `DirectionalSequencer` (`src/lib/journeyController.ts`) picks
   descent vs. ascent frames based on scroll direction, with hysteresis
   (`DIRECTION_HYSTERESIS`) so jitter near a turnaround doesn't flap.
4. Visuals are applied imperatively (`applyTransitionStyles`): as `t` rises,
   the canvas blurs/scales/saturates and the chapter-text overlay fades and
   leaves the tab order (`inert`) — **no 3D perspective/rotateX tilt
   anymore**; that mechanism (`TILT_SETTLE_PROGRESS`) was removed along with
   the old panel system.
5. `CloudCurtain.tsx` renders the tree→carousel hand-off as three staggered
   CSS/DOM "clay cloud" dome layers (lilac → mint → cream), keyed off the
   same `t` ref — plain DOM, no canvas, no Three.js, fully reversible since
   it's driven by `t` not time.

`StoryOverlay.tsx` is the chapter-copy overlay (replaces the old
`StoryPanels`/`PerchedPanel`). Chapter data lives in `CHAPTERS` in
`constants.ts` (renamed from `STAGES`; `ChapterId` replaces `StageId`).
Nav/anchor scrolling goes through `scrollToChapter()` in
`src/lib/scrollTargets.ts` (renamed from `scrollToStage`), fed by
`setJourneyBounds()` from `ScrollTrigger`'s `onRefresh`. **`window.__perrieLenis`
no longer exists** — don't reference it; there's no Lenis instance to read.

Mobile (`MobileJourney.tsx`) and reduced-motion (`ReducedMotionJourney.tsx`)
variants still exist and still skip the pin/intro-lock respectively — same
intent as before (sticky canvas in normal flow for mobile; fully static for
reduced motion), just reading the renamed constants/hooks above.

**To retime the intro**: `INTRO_MS`, `HERO_FRAC` in `constants.ts`. **To
change scroll-to-journey-length ratio**: `JOURNEY_SECTION_VH` /
`JOURNEY_PORTION`. **To retune the cloud curtain**: the `LAYERS` array and
`smooth()` easing in `CloudCurtain.tsx`.

### Frame sequence asset pipeline (unchanged)

Raw PNG sequences in `References/Acend_frames/`, `Decend_frames/`,
`Perrie_mascot_images/` (reference only, not shipped).
`scripts/process_frames.py` resizes them into `lg`/`sm` WebP tiers under
`public/frames/{ascent,descent}/` and writes the manifest JSON. Re-run after
adding/replacing frames — nothing auto-regenerates it.
`scripts/generate_audio.py` is new since the last pass of this doc; check it
directly if you need to know what it generates before relying on its output.
`FrameCache` (`src/lib/frameCache.ts`) still handles bounded decode/eviction;
`FRAME_CACHE` tuning is still in `constants.ts`.

### The feature showcase: `PerrieOrbitSection.tsx` (replaces city-reveal/`IntegrationsPanel`)

Four clay-styled feature cards (`ORBIT_FEATURES` in `constants.ts`) orbiting
a centered headline, built with plain DOM/CSS (`ClayIcons.tsx`,
`ClayShapes.tsx`) — **not** Three.js/R3F. It is **not scroll-driven** — it's
a self-running rAF loop on a fixed `secondsPerTurn`, gated by an
`IntersectionObserver` (pauses when off-screen) and paused on hover or while
a feature's popup card is open. Clicking a card opens `FeaturePopup.tsx`,
which can hand off to `DemoModal.tsx`. Reduced motion / not-yet-mounted
renders `OrbitStatic` instead: a static readable grid, still clickable, no
rotation.

## Backend: voice agent, dashboard, integrations

This is the part the project didn't have when an earlier pass of this doc
was written — don't trust old guidance that says "no backend is connected."

- **Storage** (`src/server/db/`): a `Store` interface with two
  implementations — `SupabaseStore` when `SUPABASE_URL` +
  `SUPABASE_SECRET_KEY` (or `SUPABASE_SERVICE_ROLE_KEY`) are set,
  `LocalStore` (flat files under `.perrie/`, gitignored) otherwise. Chosen
  once per process and cached on `globalThis` (`src/server/db/index.ts`) —
  the custom server and Next's route handlers share one process but load
  separate module copies, hence the `globalThis` cache. The dashboard shows
  which one is active (`StorageBadge` in `app/dashboard/layout.tsx`).
- **Agent** (`src/server/agent/`): `AgentSession` (`session.ts`) runs one
  phone call or playground chat against Claude (`@anthropic-ai/sdk`,
  streamed), sentence-by-sentence. Enforced guardrails, independent of what
  the model says: side-effecting tools are **parked** on first attempt and
  only run once the model repeats the *same* call after the person has
  actually said yes (`actionKey`/`isAffirmative` in `guardrails.ts`); a
  **leak filter** strips private owner details from anything said to
  non-owners; manipulation attempts are logged, not blocked silently. Every
  turn and tool call is written to the call transcript via `addTurn`.
- **Integrations** (`src/server/integrations/registry.ts`): single choke
  point (`executeTool`) for every tool call from the voice agent, the
  playground, and the orchestrator. Checks, in order: tool exists → role may
  use it (owner-only tools never run for guests/callers) → integration is
  connected → input validates against its zod schema. Registered
  integrations: `perrieCore`, Twilio, Google Calendar, Google Contacts,
  Deepgram, Anthropic, Supabase, Bluejay. Add an integration by writing its
  `IntegrationDef` and listing it in `INTEGRATIONS` — it then becomes
  available everywhere (voice, planner, dashboard) automatically, gated by
  role + connection status.
- **Orchestrator** (`src/server/orchestrator/`): `planner.ts` turns a
  request into a short, owner-reviewable plan of named tool steps (max 8,
  via `submit_plan`) without guessing concrete inputs (phone numbers, times)
  — those resolve at run time from earlier steps' real outputs. `executor.ts`
  runs plans and can resume ones interrupted by a server restart
  (`resumeInterruptedTasks()`, called from `server/index.ts` on boot).
- **Voice** (`src/server/voice/`): Twilio TwiML + media-stream handling,
  Deepgram STT/TTS, call finalization. The WebSocket upgrade path
  (`/api/twilio/stream`) is handled directly in `server/index.ts`, not
  through a Next API route, because Next's upgrade handler doesn't own it.
- **Models**: voice turns use `claude-sonnet-5-5` (latency-favoring),
  planning uses `claude-opus-5-5` (capability-favoring) — both overridable
  via `PERRIE_MODEL_VOICE` / `PERRIE_MODEL_PLANNER` (`src/server/env.ts`).
  Every external service in `env.ts` is optional; `serviceStatus()` is what
  the dashboard's setup checklist reads to show what's configured vs.
  missing, rather than crashing on a missing key.
- **Dashboard** (`app/dashboard/*`): owner profile, calls (list + transcript
  detail), integrations setup, playground (text chat against the same
  `AgentSession` the phone line uses), tasks (list + detail), voice QA
  (Bluejay), all gated by Clerk auth (see "Stack" above) and scoped to the
  signed-in owner's own data.
- **Content-Security-Policy**: set per-request in `middleware.ts` (not
  `next.config.ts`, which only holds the static headers) with a fresh nonce
  each request — `script-src` is nonce + `strict-dynamic` (Next's own
  inline/hydration scripts pick up the nonce automatically; `'unsafe-eval'`
  is added only when `NODE_ENV !== "production"`, for Fast Refresh).
  `style-src` keeps `'unsafe-inline'` on purpose — this codebase relies on
  inline `style={{...}}` for the clay gradients/shadows throughout, which a
  nonce can't cover. Verified live against Clerk sign-in, Google-connected
  integrations, Bluejay, and a streaming playground chat with zero CSP
  console violations.

## Conventions

- Central config (copy, colors, chapter/progress constants, audio levels,
  demo content, orbit features) lives in `src/lib/constants.ts`. Edit there,
  not scattered through components. `FAQ` is the one exception — it's dead,
  not wired to anything; don't assume adding to it does anything until you
  wire a renderer.
- Avoid ALL-CAPS tracked-out eyebrow labels and generic SaaS-card grids —
  an earlier pass of this site had both; removed for feeling templated.
- Components that animate off scroll/time progress read a
  `MutableRefObject<number>` and mutate DOM/canvas directly (`style.transform`,
  canvas draws) rather than going through React state, for per-frame
  performance (`JourneyCanvas`, `StoryOverlay`, `CloudCurtain`,
  `PerrieOrbitSection`'s `OrbitStage` all follow this shape). Match it rather
  than introducing `useState`-driven animation in anything that ticks every
  frame.
- Respect `prefers-reduced-motion` in anything new that animates — both the
  journey and the orbit section already branch on it; new scroll/time-driven
  components should too.
- `src/server/env.ts` must never be imported from a client component — it
  reads secrets. Every service accessor returns `null`/`undefined` when
  unconfigured rather than throwing, by design — match that if you add one.

## Known gotchas

- Windows dev environment: paths in shell commands need forward slashes or
  quoting; the repo itself has no Windows-specific code.
- `next lint` is deprecated as of Next 15.5 (prints a warning); still works.
- The dashboard's login is real Clerk auth via `middleware.ts`, not a
  localhost/HTTP-Basic gate — `/sign-in` does protect the dashboard. If you
  see guidance elsewhere (old commits, old docs) describing
  `server/access.ts` or `DASHBOARD_PASSWORD`, that's stale; it was replaced.
- Three/@react-three/fiber/drei remain in `package.json` but are dead code
  (zero imports). Don't be surprised if removing them breaks nothing, and
  don't add new Three.js work assuming an existing scene/canvas context to
  attach to — there isn't one.
