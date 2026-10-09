import { env } from "../env";
import type { ProviderStatus } from "../tools/types";

/**
 * The voice stack Perrie runs on. These are infrastructure, configured with
 * environment variables — not app integrations the owner connects.
 *
 *   caller ⇄ Twilio (telephony) ⇄ Deepgram (speech-to-text / text-to-speech)
 *                                   ⇅
 *                             Claude (reasoning)  →  Supabase (storage)
 */
export interface PlatformService {
  id: "twilio" | "deepgram" | "claude" | "supabase";
  name: string;
  layer: "Telephony" | "Voice" | "Reasoning" | "Storage";
  description: string;
  accent: "lilac" | "pink" | "amber" | "mint" | "sky" | "coral" | "slate";
  icon: string;
  vars: string[];
  status(): ProviderStatus;
}

export const PLATFORM_SERVICES: PlatformService[] = [
  {
    id: "twilio",
    name: "Twilio",
    layer: "Telephony",
    description: "Perrie's phone number: carries every call in and out, and texts.",
    accent: "coral",
    icon: "phone",
    vars: ["TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN", "TWILIO_PHONE_NUMBER", "PUBLIC_BASE_URL"],
    status() {
      const t = env.twilio();
      if (!t) return { connected: false, hint: "Add TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN and TWILIO_PHONE_NUMBER." };
      if (!env.publicBaseUrl()) return { connected: false, label: t.phoneNumber, hint: "Set PUBLIC_BASE_URL so Twilio can reach Perrie." };
      return { connected: true, label: t.phoneNumber };
    },
  },
  {
    id: "deepgram",
    name: "Deepgram",
    layer: "Voice",
    description: "Hears the caller (streaming speech-to-text) and speaks Perrie's replies (text-to-speech).",
    accent: "pink",
    icon: "waves",
    vars: ["DEEPGRAM_API_KEY"],
    status() {
      const d = env.deepgram();
      return d ? { connected: true, label: `${d.sttModel} · ${d.ttsVoice}` } : { connected: false, hint: "Add DEEPGRAM_API_KEY." };
    },
  },
  {
    id: "claude",
    name: "Claude",
    layer: "Reasoning",
    description: "Understands the conversation, decides what to say and which tools to use, plans tasks, writes call summaries.",
    accent: "amber",
    icon: "brain",
    vars: ["ANTHROPIC_API_KEY"],
    status() {
      const a = env.anthropic();
      return a ? { connected: true, label: `${a.voiceModel} / ${a.plannerModel}` } : { connected: false, hint: "Add ANTHROPIC_API_KEY." };
    },
  },
  {
    id: "supabase",
    name: "Supabase",
    layer: "Storage",
    description: "Stores your profile, calls, transcripts, tasks and monitoring results.",
    accent: "mint",
    icon: "database",
    vars: ["SUPABASE_URL", "SUPABASE_SECRET_KEY"],
    status() {
      const s = env.supabase();
      return s
        ? { connected: true, label: new URL(s.url).host }
        : { connected: false, hint: "Using local dev storage. Add SUPABASE_URL and SUPABASE_SECRET_KEY." };
    },
  },
];
