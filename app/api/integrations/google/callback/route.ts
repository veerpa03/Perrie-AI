import { NextResponse, type NextRequest } from "next/server";
import { safeEqual } from "@/server/crypto";
import { completeGoogleConnection, readGoogleState } from "@/server/integrations/google/oauth";
import { invalidateIntegrationStatus } from "@/server/integrations/registry";

/** Google redirects here after consent: http://localhost:3000/api/integrations/google/callback */
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const back = new URL("/dashboard/integrations", req.url);
  const state = readGoogleState(url.searchParams.get("state"));
  const cookie = req.cookies.get("perrie_oauth")?.value ?? "";
  const done = (res: NextResponse) => {
    res.cookies.delete({ name: "perrie_oauth", path: "/api/integrations/google" });
    return res;
  };

  if (!state || !cookie || !safeEqual(state.nonce, cookie)) {
    back.searchParams.set("error", "That sign-in link expired or didn't start here. Please try again.");
    return done(NextResponse.redirect(back));
  }
  const denied = url.searchParams.get("error");
  const code = url.searchParams.get("code");
  if (denied || !code) {
    back.searchParams.set("error", denied === "access_denied" ? "Google access was not granted." : "Google sign-in failed.");
    return done(NextResponse.redirect(back));
  }
  try {
    await completeGoogleConnection(state.integration, code);
    invalidateIntegrationStatus();
    back.searchParams.set("connected", state.integration);
  } catch (err) {
    back.searchParams.set("error", (err as Error).message);
  }
  return done(NextResponse.redirect(back));
}
