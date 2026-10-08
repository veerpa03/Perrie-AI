// Central configuration for copy, colors, asset paths, stage mapping, and
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
  headline: "Less busywork. More room for life.",
  subhead:
    "Meet Perrie, your personal AI assistant. Tell it what you need, and keep your day moving.",
};

// Normalized journey progress: 0 = hero above the clouds, 1 = landed on the tree.
// Stage boundaries were set by visually inspecting the ascent/descent frame
// sequences for the closest matching composition (sky, cloud layer, city
// reveal, tree approach, perched) in References/Acend_frames and
// References/Decend_frames.
export const STAGES = [
  { id: "sky", from: 0, to: 0.18 },
  { id: "clouds", from: 0.18, to: 0.45 },
  { id: "city-reveal", from: 0.45, to: 0.64 },
  { id: "tree-approach", from: 0.64, to: 0.88 },
  { id: "perched", from: 0.88, to: 1 },
] as const;

export type StageId = (typeof STAGES)[number]["id"];

export function stageAt(progress: number): StageId {
  const p = Math.min(1, Math.max(0, progress));
  for (const s of STAGES) {
    if (p >= s.from && p <= s.to) return s.id;
  }
  return STAGES[STAGES.length - 1].id;
}

// Scroll length of the journey section, in viewport heights.
export const JOURNEY_SCROLL_LENGTH_VH = 420;

// Direction-switch hysteresis: minimum accumulated progress delta (in the
// opposite direction) required before the active sequence is allowed to
// flip between descent/ascent frames. Prevents rapid flapping on small
// scroll jitters.
export const DIRECTION_HYSTERESIS = 0.012;

// Exponential smoothing factor applied to raw scroll progress each frame
// (0 = no smoothing / instant, 1 = frozen). Keep small: this is "modest"
// smoothing, not scroll hijacking.
export const PROGRESS_SMOOTHING = 0.18;

export const FRAME_CACHE = {
  // Max decoded frames kept resident per sequence (desktop tier).
  maxDecoded: 90,
  // Frames to eagerly preload around the current index.
  preloadRadius: 6,
  // Concurrent in-flight decodes.
  concurrency: 4,
};

export const BREAKPOINTS = {
  mobile: 768,
};

export const AUDIO = {
  masterVolume: 0.6,
  ambience: { volume: 0.35, fadeMs: 1200 },
  wind: { volume: 0.3, fadeMs: 900 },
  whoosh: { volume: 0.45 },
  flutter: { volume: 0.4 },
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
