/**
 * Server-side configuration, read lazily from process.env (Next loads
 * .env.local before any request is handled). Every service is optional: the
 * dashboard shows what is configured and what is missing instead of crashing.
 * Never import this from client components — it reads secrets.
 */

const read = (key: string): string | undefined => {
  const v = process.env[key];
  return v && v.trim() ? v.trim() : undefined;
};

const trimSlash = (u: string) => u.replace(/\/+$/, "");

/** Local data folder (dev store + generated secret). Gitignored. */
export const dataDir = () => read("PERRIE_DATA_DIR") ?? `${process.cwd()}/.perrie`;

export const env = {
  /** Public HTTPS URL Twilio can reach (ngrok / Cloudflare tunnel / deploy). */
  publicBaseUrl: () => {
    const v = read("PUBLIC_BASE_URL");
    return v ? trimSlash(v) : undefined;
  },
  /** Where the owner opens the dashboard (used for the Google OAuth redirect). */
  appUrl: () => trimSlash(read("APP_URL") ?? `http://localhost:${read("PORT") ?? "3000"}`),
  secret: () => read("PERRIE_SECRET"),
  isProduction: () => process.env.NODE_ENV === "production",

  supabase: () => {
    const url = read("SUPABASE_URL");
    const key = read("SUPABASE_SECRET_KEY") ?? read("SUPABASE_SERVICE_ROLE_KEY");
    return url && key ? { url, key } : null;
  },
  groq: () => {
    const apiKey = read("GROQ_API_KEY");
    if (!apiKey) return null;
    return {
      apiKey,
      // Voice turns favour latency; planning favours capability. Both free on Groq.
      // gpt-oss-20b/qwen are org-blocked on the free tier; 120b is the one
      // confirmed working model, so both roles use it (voice at low
      // reasoning effort for latency, planner at medium for better plans).
      voiceModel: read("PERRIE_MODEL_VOICE") ?? "openai/gpt-oss-120b",
      plannerModel: read("PERRIE_MODEL_PLANNER") ?? "openai/gpt-oss-120b",
    };
  },
  deepgram: () => {
    const apiKey = read("DEEPGRAM_API_KEY");
    if (!apiKey) return null;
    return {
      apiKey,
      sttModel: read("DEEPGRAM_STT_MODEL") ?? "nova-3",
      ttsVoice: read("DEEPGRAM_TTS_VOICE") ?? "aura-2-thalia-en",
    };
  },
  google: () => {
    const clientId = read("GOOGLE_CLIENT_ID");
    const clientSecret = read("GOOGLE_CLIENT_SECRET");
    return clientId && clientSecret ? { clientId, clientSecret } : null;
  },
  bluejay: () => {
    const apiKey = read("BLUEJAY_API_KEY");
    return apiKey ? { apiKey, url: read("BLUEJAY_MCP_URL") ?? "https://api.getbluejay.ai/mcp" } : null;
  },
};

export type ServiceKey = "supabase" | "groq" | "deepgram" | "google" | "bluejay" | "publicUrl";

/** Which operator-level services have credentials, for the setup checklist. Twilio is per-tenant (see twilioCreds.ts), not here. */
export function serviceStatus(): Record<ServiceKey, boolean> {
  return {
    supabase: !!env.supabase(),
    groq: !!env.groq(),
    deepgram: !!env.deepgram(),
    google: !!env.google(),
    bluejay: !!env.bluejay(),
    publicUrl: !!env.publicBaseUrl(),
  };
}
