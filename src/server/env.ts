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

export const env = {
  /** Public HTTPS URL Twilio can reach (ngrok / Cloudflare tunnel / deploy). */
  publicBaseUrl: () => {
    const v = read("PUBLIC_BASE_URL");
    return v ? trimSlash(v) : undefined;
  },
  /** Where the owner opens the dashboard (used for the Google OAuth redirect). */
  appUrl: () => trimSlash(read("APP_URL") ?? `http://localhost:${read("PORT") ?? "3000"}`),
  dashboardPassword: () => read("DASHBOARD_PASSWORD"),
  secret: () => read("PERRIE_SECRET"),
  isProduction: () => process.env.NODE_ENV === "production",

  supabase: () => {
    const url = read("SUPABASE_URL");
    const key = read("SUPABASE_SECRET_KEY") ?? read("SUPABASE_SERVICE_ROLE_KEY");
    return url && key ? { url, key } : null;
  },
  anthropic: () => {
    const apiKey = read("ANTHROPIC_API_KEY");
    if (!apiKey) return null;
    return {
      apiKey,
      // Voice turns favour latency; planning favours capability.
      voiceModel: read("PERRIE_MODEL_VOICE") ?? "claude-sonnet-5-5",
      plannerModel: read("PERRIE_MODEL_PLANNER") ?? "claude-opus-5-5",
    };
  },
  twilio: () => {
    const accountSid = read("TWILIO_ACCOUNT_SID");
    const authToken = read("TWILIO_AUTH_TOKEN");
    const phoneNumber = read("TWILIO_PHONE_NUMBER");
    return accountSid && authToken && phoneNumber ? { accountSid, authToken, phoneNumber } : null;
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

export type ServiceKey = "supabase" | "anthropic" | "twilio" | "deepgram" | "google" | "bluejay" | "publicUrl";

/** Which services have credentials, for the setup checklist. */
export function serviceStatus(): Record<ServiceKey, boolean> {
  return {
    supabase: !!env.supabase(),
    anthropic: !!env.anthropic(),
    twilio: !!env.twilio(),
    deepgram: !!env.deepgram(),
    google: !!env.google(),
    bluejay: !!env.bluejay(),
    publicUrl: !!env.publicBaseUrl(),
  };
}
