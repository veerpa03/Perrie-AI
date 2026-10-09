// Central configuration for copy, colors, asset paths, chapter mapping, and
// scroll/audio tuning. Edit values here rather than hunting through
// components.

export const COLORS = {
  cloudWhite: "#FAFAF7",
  slate: "#263445",
  skyBlue: "#EAF3FA",
  lavender: "#EEE8F8",
  teal: "#DDF3EE",
  tealDeep: "#226D68",
} as const;

export const SITE = {
  name: "Perrie",
  headline: "Less busywork. More life.",
  subhead: "Your personal AI assistant.",
};

/**
 * The cinematic journey is driven by one normalized scroll progress p:
 * 0 = hero above the clouds, 1 = perched on the tree.
 *
 * Two real flight takes are used:
 *   - scrolling DOWN plays the DESCENT frames (sky -> clouds -> city -> tree);
 *   - scrolling UP plays the ASCENT frames forward (takeoff from the branch ->
 *     past the skyline -> up through the clouds -> hovering above the cloud
 *     sea), so going back up is a real flight, not a rewind.
 * The two takes are different footage, so each scroll position is mapped to
 * the frame with the same scene in each take (DESCENT is linear, ASCENT uses
 * ASCENT_TRACK below), direction changes need sustained movement
 * (DIRECTION_HYSTERESIS) before switching, and the canvas cross-fades between
 * takes at the switch so there is no hard jump.
 *
 * Chapter `from`/`to` are normalized progress ranges matched to the scenes.
 */
export const PRIMARY_SEQUENCE = "descent" as const;

/**
 * Opening fly-in. On page load Perrie flies in from far away and settles into
 * the hero pose — this plays ONCE, automatically, and is NOT scrollable. It
 * covers descent frames 0 .. HERO_FRAC of the sequence. The scrollable journey
 * then begins AT the hero rest frame (HERO_FRAC) and maps scroll 0..1 onto
 * frames HERO_FRAC..1, so scrolling back to the top rests on the hero frame
 * and never replays the fly-in. The fly-in only runs again on a fresh load.
 *
 * `frameProgress` (0..1 over the whole sequence) drives the canvas; `scroll
 * progress` (0..1) drives the chapter overlays and maps to
 * frameProgress = HERO_FRAC + scroll * (1 - HERO_FRAC).
 */
export const HERO_FRAC = 0.2; // hero rest ≈ descent frame 69 — big Perrie, wings spread over clouds
export const INTRO_MS = 2600; // fly-in duration

export const CHAPTERS = [
  {
    id: "hero",
    eyebrow: "Meet Perrie",
    headline: "Less busywork. More life.",
    support: "Your personal AI assistant.",
    primary: { label: "Meet Perrie", action: "demo" },
    secondary: { label: "Explore", action: "scroll-next" },
    from: 0,
    to: 0.12,
    // Perrie launches from the top-left cloud; the whole right half is open sky.
    align: "right",
    justify: "center",
    // The cross-fading overlay headings are h2s; the page's single persistent
    // h1 lives in app/page.tsx so it is never inerted when scrolling past.
    heading: "h2",
    // Environment bed for the audio layer.
    ambience: "sky",
  },
  {
    id: "clarity",
    eyebrow: "A little clarity",
    headline: "Make room for what matters.",
    support: "Plan. Draft. Research. Organize.",
    from: 0.12,
    to: 0.46,
    align: "right",
    justify: "center",
    heading: "h2",
    ambience: "sky",
  },
  {
    id: "city",
    eyebrow: "Your next step",
    headline: "A simple ask. A lighter day.",
    support: "Tell Perrie what you have in mind.",
    from: 0.46,
    to: 0.74,
    align: "right",
    justify: "center",
    heading: "h2",
    ambience: "city",
  },
  {
    id: "landing",
    eyebrow: "Your everyday companion",
    headline: "A little help goes a long way.",
    support: "Start with a request. Review the next step.",
    primary: { label: "See an example", action: "demo" },
    from: 0.74,
    to: 1,
    align: "right",
    justify: "center",
    heading: "h2",
    ambience: "city",
  },
] as const;

export type ChapterId = (typeof CHAPTERS)[number]["id"];
export type Ambience = (typeof CHAPTERS)[number]["ambience"];

export function chapterAt(progress: number): (typeof CHAPTERS)[number] {
  const p = Math.min(1, Math.max(0, progress));
  for (const c of CHAPTERS) {
    if (p >= c.from && p <= c.to) return c;
  }
  return CHAPTERS[CHAPTERS.length - 1];
}

// Scroll length of the journey section, in viewport heights. Longer = a
// gentler, more cinematic scrub per frame.
export const JOURNEY_SCROLL_LENGTH_VH = 520;

// Extra scroll at the end of the journey for the animated hand-off from the
// tree landing into the carousel: a short settle, then pastel clay clouds rise
// and fill the screen while the scene softly blurs (see CloudCurtain).
export const TRANSITION = {
  settleVh: 24,
  curtainVh: 110,
} as const;

/** Splits the pinned journey section's raw scroll progress (0..1) into the
 *  journey progress p and the curtain transition t (both 0..1). */
export function splitJourneyProgress(raw: number) {
  const journeyTravel = JOURNEY_SCROLL_LENGTH_VH - 100;
  const total = journeyTravel + TRANSITION.settleVh + TRANSITION.curtainVh;
  const r = Math.min(1, Math.max(0, raw)) * total;
  const p = Math.min(1, r / journeyTravel);
  const t = Math.min(1, Math.max(0, (r - journeyTravel - TRANSITION.settleVh) / TRANSITION.curtainVh));
  return { p, t };
}

/** Fraction of the pinned travel at which the journey (p) reaches 1. */
export const JOURNEY_PORTION =
  (JOURNEY_SCROLL_LENGTH_VH - 100) /
  (JOURNEY_SCROLL_LENGTH_VH - 100 + TRANSITION.settleVh + TRANSITION.curtainVh);

/** Total height of the journey section (vh), including the transition tail. */
export const JOURNEY_SECTION_VH =
  JOURNEY_SCROLL_LENGTH_VH + TRANSITION.settleVh + TRANSITION.curtainVh;

/**
 * Scroll progress -> ASCENT frame fraction (frame / 359), matched by scene by
 * inspecting both takes:
 *   p 1.00 tree, perched           -> ascent   0 (perched on the branch)
 *   p 0.85 landing on the branch   -> ascent  30 (taking off)
 *   p 0.74 over the city           -> ascent  58 (climbing past the skyline)
 *   p 0.60 city below              -> ascent  86 (skyline low, climbing)
 *   p 0.46 clouds over the city    -> ascent 112 (bursting up through cloud)
 *   p 0.33 diving into clouds      -> ascent 172 (among the clouds)
 *   p 0.25 starting the dive       -> ascent 210 (front-facing among clouds)
 *   p 0.12 over the cloud sea      -> ascent 262 (centred over the cloud sea)
 *   p 0.00 hero                    -> ascent 330 (big hover above the clouds)
 */
export const ASCENT_TRACK = [
  { p: 0.0, f: 330 / 359 },
  { p: 0.12, f: 262 / 359 },
  { p: 0.25, f: 210 / 359 },
  { p: 0.33, f: 172 / 359 },
  { p: 0.46, f: 112 / 359 },
  { p: 0.6, f: 86 / 359 },
  { p: 0.74, f: 58 / 359 },
  { p: 0.85, f: 30 / 359 },
  { p: 1.0, f: 0 },
] as const;

/** Scroll progress -> DESCENT frame fraction (after the fly-in). */
export function descentFracFor(p: number) {
  return HERO_FRAC + Math.min(1, Math.max(0, p)) * (1 - HERO_FRAC);
}

/** Scroll progress -> ASCENT frame fraction (scene-matched). */
export function ascentFracFor(p: number) {
  const x = Math.min(1, Math.max(0, p));
  const t = ASCENT_TRACK;
  for (let i = 0; i < t.length - 1; i++) {
    const a = t[i];
    const b = t[i + 1];
    if (x >= a.p && x <= b.p) {
      const k = b.p === a.p ? 0 : (x - a.p) / (b.p - a.p);
      return a.f + (b.f - a.f) * k;
    }
  }
  return t[t.length - 1].f;
}

// Cover-fit focal point (fraction of the frame) used when the viewport aspect
// differs from the footage (16:9). Biased left so Perrie — who lives on the
// left/centre of frame — is protected from the crop on wide/landscape
// viewports (desktop). On a 16:9-ish screen the whole frame shows anyway.
export const JOURNEY_FOCAL = { x: 0.38, y: 0.5 } as const;

/**
 * On narrow (portrait) screens a 16:9 frame is cropped hard on the sides, so a
 * single fixed focal point would crop Perrie out as she moves across frame.
 * This track follows her approximate on-screen position through the descent so
 * the cover crop keeps her in view — "aspect-ratio-aware scaling that protects
 * the bird." Values were read from the descent frames at the sampled progress
 * points. Interpolated by focalAt().
 */
export const JOURNEY_FOCAL_TRACK = [
  { p: 0.0, x: 0.1, y: 0.42 },
  { p: 0.2, x: 0.3, y: 0.32 },
  { p: 0.45, x: 0.48, y: 0.46 },
  { p: 0.64, x: 0.5, y: 0.34 },
  { p: 0.84, x: 0.42, y: 0.44 },
  { p: 1.0, x: 0.34, y: 0.52 },
] as const;

/** Same idea for the ASCENT take (keyed by ascent frame fraction): Perrie
 *  starts left on the branch, then climbs into the centre of frame. */
export const ASCENT_FOCAL_TRACK = [
  { p: 0.0, x: 0.22, y: 0.5 },
  { p: 0.1, x: 0.3, y: 0.46 },
  { p: 0.2, x: 0.42, y: 0.42 },
  { p: 0.32, x: 0.52, y: 0.45 },
  { p: 0.5, x: 0.55, y: 0.45 },
  { p: 0.65, x: 0.5, y: 0.46 },
  { p: 1.0, x: 0.5, y: 0.5 },
] as const;

type FocalTrack = ReadonlyArray<{ readonly p: number; readonly x: number; readonly y: number }>;

function sampleTrack(track: FocalTrack, v: number): { x: number; y: number } {
  const p = Math.min(1, Math.max(0, v));
  for (let i = 0; i < track.length - 1; i++) {
    const a = track[i];
    const b = track[i + 1];
    if (p >= a.p && p <= b.p) {
      const f = b.p === a.p ? 0 : (p - a.p) / (b.p - a.p);
      return { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f };
    }
  }
  const last = track[track.length - 1];
  return { x: last.x, y: last.y };
}

/** Mobile cover-crop focal for a given take and frame fraction. */
export function focalAt(seq: "descent" | "ascent", frac: number): { x: number; y: number } {
  return sampleTrack(seq === "ascent" ? ASCENT_FOCAL_TRACK : JOURNEY_FOCAL_TRACK, frac);
}

// Direction-switch hysteresis (in scroll progress): how far you must keep
// scrolling the other way before the take switches (descent <-> ascent).
// Prevents flapping on small jitters and reversals.
export const DIRECTION_HYSTERESIS = 0.01;

// Cross-fade duration when switching takes, and how long the page must rest
// near the very top before the ascent hands back to the stable hero frame.
export const TAKE_CROSSFADE_MS = 380;
export const TOP_SETTLE_MS = 420;

// Exponential smoothing factor applied to raw scroll progress each frame
// (0 = instant, 1 = frozen). Restrained smoothing, not scroll hijacking.
export const PROGRESS_SMOOTHING = 0.16;

export const FRAME_CACHE = {
  // Max decoded frames kept resident per take (two takes are loaded).
  maxDecoded: 64,
  // Frames to eagerly preload around the current index of the active take.
  preloadRadius: 7,
  // Frames kept warm around the matching position in the standby take, so a
  // direction change can switch instantly.
  standbyRadius: 3,
  // Concurrent in-flight decodes per take.
  concurrency: 4,
};

export const BREAKPOINTS = {
  mobile: 768,
};

export const AUDIO = {
  masterVolume: 0.6,
  ambience: { volume: 0.32, fadeMs: 1200 },
  wind: { volume: 0.3, fadeMs: 900 },
  whoosh: { volume: 0.4 },
  flutter: { volume: 0.38 },
  flightFadeOutMs: 600,
};

export const CAPABILITIES = [
  {
    id: "plan-day",
    title: "Plan your day",
    description: "Lay out today's schedule around what actually matters.",
  },
  {
    id: "draft-message",
    title: "Draft a message",
    description: "Turn a rough idea into a message that's ready to send.",
  },
  {
    id: "research",
    title: "Research a topic",
    description: "Pull together the key facts so you don't have to dig.",
  },
  {
    id: "organize-tasks",
    title: "Organize your tasks",
    description: "Sort the scattered to-dos into a plan you can act on.",
  },
] as const;

export const DEMO_EXAMPLES = [
  {
    id: "plan-day",
    request:
      "I have a 9am standup, a dentist appointment at 2, and I need to finish the Q3 deck before Friday. Help me plan today.",
    plan: [
      "Block 9:00–9:30 for standup",
      "Draft deck outline 9:30–11:30 (deep work)",
      "Leave by 1:30 for the 2:00 dentist appointment",
      "Resume deck 3:30–5:00, finish slides 6–9",
    ],
  },
  {
    id: "draft-message",
    request:
      "Draft a short message to my team letting them know Friday's launch is moving to Monday.",
    plan: [
      "Open with the headline: launch moves to Monday",
      "Give the one-line reason (QA needs one more pass)",
      "Confirm nothing else on the timeline changes",
      "Close with where to ask questions",
    ],
  },
  {
    id: "research",
    request: "Give me a quick primer on how competitors price their starter plans.",
    plan: [
      "Pull starter-tier pricing from the top 5 competitors",
      "Note what's included at each price point",
      "Flag any usage-based or seat-based pricing patterns",
      "Summarize into a one-page comparison",
    ],
  },
  {
    id: "organize-tasks",
    request:
      "I've got sticky notes and half-written lists everywhere. Help me get this under control.",
    plan: [
      "Collect every loose task into one list",
      "Group by project: Launch, Hiring, Personal",
      "Flag anything with a deadline this week",
      "Hand back a clean, prioritized list",
    ],
  },
] as const;

export const STEPS = [
  {
    title: "Tell Perrie what you need",
    body: "Type it like you'd ask a person — no special syntax.",
  },
  {
    title: "Review the proposed step",
    body: "See exactly what Perrie plans to do first, before anything happens.",
  },
  {
    title: "Follow it through",
    body: "Watch the plan move forward, one clear step at a time.",
  },
] as const;

/**
 * Orbit carousel. Four product features float as chunky rainbow clay objects
 * on a gently tilted ring all around the centred headline. The carousel turns
 * on its own (time-based — one authoritative rotation value lives in
 * PerrieOrbitSection) and pauses on hover/focus, while a feature card is open,
 * off-screen, or for reduced motion. Clicking an object opens its gist card.
 *
 * These are illustrative example workflows; nothing is connected yet.
 */
export const ORBIT_HEADLINE = ["A little help.", "All around you."] as const;

export const ORBIT_FEATURES = [
  {
    id: "plan",
    icon: "calendar",
    demoId: "plan-day",
    label: "Plan your day.",
    description: "Bring a little structure to your day.",
    gist: "Tell Perrie what\u2019s on your plate and get a calm, time-blocked plan for the day \u2014 meetings, focused work and breaks laid out in one view.",
    examples: [
      "Fit a dentist visit around my 9am standup",
      "Block two hours for focused work",
      "Leave a buffer between back-to-back meetings",
    ],
    color: "#9B82EE",
    glow: "#EDE6FF",
  },
  {
    id: "write",
    icon: "envelope",
    demoId: "draft-message",
    label: "Draft a message.",
    description: "Give your next message a starting point.",
    gist: "Turn a rough idea into a clear, friendly draft that you review, tweak and send yourself.",
    examples: [
      "Tell the team the launch moved to Monday",
      "Thank a colleague for their help",
      "Politely follow up on an unanswered email",
    ],
    color: "#3FBF9B",
    glow: "#DDF7EE",
  },
  {
    id: "research",
    icon: "search",
    demoId: "research",
    label: "Research a topic.",
    description: "Give your questions a clearer direction.",
    gist: "Get a quick, organised primer on a question so you know what matters and where to start.",
    examples: [
      "Compare how competitors price starter plans",
      "Summarise the basics of a new topic",
      "List the questions to ask before deciding",
    ],
    color: "#F0A23A",
    glow: "#FFF0D2",
  },
  {
    id: "organize",
    icon: "notebook",
    demoId: "organize-tasks",
    label: "Organize your tasks.",
    description: "Turn scattered tasks into a next step.",
    gist: "Gather scattered to-dos into one prioritised list, grouped by project, with a clear next step.",
    examples: [
      "Collect sticky notes into one list",
      "Flag what\u2019s due this week",
      "Pick the one thing to do next",
    ],
    color: "#EC6FA6",
    glow: "#FFE1EE",
  },
] as const;

export type OrbitIcon = (typeof ORBIT_FEATURES)[number]["icon"];
export type OrbitFeature = (typeof ORBIT_FEATURES)[number];

export const ORBIT = {
  // Seconds for one full, automatic turn of the carousel.
  secondsPerTurn: 26,
  // How long the carousel holds a feature after a dot click before turning on.
  resumeAfterMs: 2600,
  // A gently tilted ellipse (radians): left side dips, right side lifts.
  tilt: -0.12,
  // Responsive geometry (px): ring radii, clay-object size, ring offset from
  // the stage centre. The ring is large enough that objects pass above,
  // beside and below the centred headline without covering it.
  geometry: {
    desktop: { radiusX: 450, radiusY: 196, iconSize: 136, verticalOffset: 6 },
    tablet: { radiusX: 330, radiusY: 172, iconSize: 112, verticalOffset: 6 },
    mobile: { radiusX: 148, radiusY: 214, iconSize: 78, verticalOffset: 0 },
  },
  // Depth -> appearance (depth = cos(angle): 1 = front, -1 = back).
  scaleBack: 0.6,
  scaleFront: 1.14,
  opacityBack: 0.55,
  maxBlurPx: 3,
  // Extra scale on hover / keyboard focus.
  hoverScale: 1.14,
} as const;

export const FAQ = [
  {
    q: "Is Perrie connected to my real accounts yet?",
    a: "Not yet. This site is a frontend preview — the demo screens and sample plans show how Perrie will work, but no real scheduling, messages, or accounts are connected.",
  },
  {
    q: "What will Perrie be able to do?",
    a: "Help with everyday busywork: planning your day, drafting messages, researching topics, and organizing scattered tasks into something you can act on.",
  },
  {
    q: "Will my data be private?",
    a: "Backend and data-handling details will be published once the connected product is ready. Nothing you enter on this preview is sent anywhere or stored.",
  },
  {
    q: "When can I actually use it?",
    a: "Backend integration is next. Sign up through the demo dashboard to get notified when real task execution goes live.",
  },
] as const;
