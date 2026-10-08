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
 * The cinematic journey is a single scrubbed frame sequence. Progress is one
 * normalized value: 0 = hero above the clouds, 1 = perched on the tree.
 *
 * We scrub the DESCENT sequence (hero -> landing) and play it in reverse on
 * upward scroll. The ascent footage is a separate take and is not
 * frame-matched to the descent, so switching between the two mid-flight would
 * jump; reversible descent keeps the motion perfectly continuous in both
 * directions. See JourneyCanvas for the renderer and the handoff notes for
 * the asset limitation.
 *
 * Chapter `from`/`to` are normalized progress ranges, chosen by inspecting
 * the descent frames for the matching composition:
 *   hero     ~frame 0    (bird launching off a cloud, open sky to the right)
 *   clarity  ~frame 55   (wings-spread flight through the cloud layer)
 *   city     ~frame 220  (gliding over the city grid)
 *   landing  ~frame 344  (perched on the branch, skyline behind)
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

export function focalAt(progress: number): { x: number; y: number } {
  const p = Math.min(1, Math.max(0, progress));
  const t = JOURNEY_FOCAL_TRACK;
  for (let i = 0; i < t.length - 1; i++) {
    const a = t[i];
    const b = t[i + 1];
    if (p >= a.p && p <= b.p) {
      const f = b.p === a.p ? 0 : (p - a.p) / (b.p - a.p);
      return { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f };
    }
  }
  const last = t[t.length - 1];
  return { x: last.x, y: last.y };
}

// Direction-switch hysteresis is retained for the controller but the primary
// renderer scrubs a single sequence, so it is effectively a no-op guard.
export const DIRECTION_HYSTERESIS = 0.012;

// Exponential smoothing factor applied to raw scroll progress each frame
// (0 = instant, 1 = frozen). Restrained smoothing, not scroll hijacking.
export const PROGRESS_SMOOTHING = 0.16;

export const FRAME_CACHE = {
  // Max decoded frames kept resident per sequence.
  maxDecoded: 96,
  // Frames to eagerly preload around the current index.
  preloadRadius: 8,
  // Concurrent in-flight decodes.
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
 * Orbit carousel (redesign). Four product features rotate on a wide, gently
 * tilted elliptical orbit around the stationary hovering Perrie. One scroll-
 * derived rotation value is authoritative (see PerrieOrbitSection); cards
 * compute their screen position from their angle, so there is no competing
 * GSAP/Framer transform on the same property.
 *
 * Tuning lives in ORBIT below — swap radius/tilt/scroll length there.
 */
export const ORBIT_FEATURES = [
  {
    id: "plan",
    icon: "calendar",
    title: "MAKE ROOM.",
    description: "Bring a little structure to your day.",
    accent: "var(--color-peach)",
  },
  {
    id: "write",
    icon: "envelope",
    title: "FIND THE WORDS.",
    description: "Give your next message a starting point.",
    accent: "var(--color-powder)",
  },
  {
    id: "research",
    icon: "search",
    title: "STAY CURIOUS.",
    description: "Give your questions a clearer direction.",
    accent: "var(--color-mint)",
  },
  {
    id: "organize",
    icon: "notebook",
    title: "CLEAR THE CLUTTER.",
    description: "Turn scattered tasks into a next step.",
    accent: "var(--color-dusty)",
  },
] as const;

export type OrbitIcon = (typeof ORBIT_FEATURES)[number]["icon"];

export const ORBIT = {
  // Scroll length of the orbit section, in viewport heights. Long enough to
  // read all four features across one full rotation.
  scrollLengthVh: 360,
  // Smoothing applied to the scroll-derived rotation (0 = instant, 1 = frozen).
  rotationSmoothing: 0.14,
  // Responsive geometry: horizontal orbit radius, vertical tilt radius, and
  // card width per breakpoint (px). The bird sits at the centre; the ring sits
  // slightly below its face (verticalOffset).
  geometry: {
    desktop: { radiusX: 352, radiusY: 46, cardW: 170, verticalOffset: 78 },
    tablet: { radiusX: 260, radiusY: 40, cardW: 156, verticalOffset: 72 },
    mobile: { radiusX: 132, radiusY: 26, cardW: 132, verticalOffset: 118 },
  },
  // Depth → appearance mapping (depth = cos(angle), 1 = front, -1 = back).
  scaleBack: 0.66,
  scaleFront: 1.1,
  opacityBack: 0.42,
  maxBlurPx: 5,
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
