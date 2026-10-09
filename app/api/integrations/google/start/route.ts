import { NextResponse } from "next/server";
import { buildGoogleAuthUrl, isGoogleIntegration } from "@/server/integrations/google/oauth";

/** Starts the Google consent flow for one integration (Calendar or Contacts). */
export async function GET(req: Request) {
  const id = new URL(req.url).searchParams.get("integration") ?? "";
  const back = new URL("/dashboard/integrations", req.url);
  if (!isGoogleIntegration(id)) {
    back.searchParams.set("error", "Unknown integration.");
    return NextResponse.redirect(back);
  }
  try {
    const { url, nonce } = buildGoogleAuthUrl(id);
    const res = NextResponse.redirect(url);
    // Binds the OAuth round-trip to this browser (CSRF protection).
    res.cookies.set("perrie_oauth", nonce, { httpOnly: true, sameSite: "lax", path: "/api/integrations/google", maxAge: 600 });
    return res;
  } catch (err) {
    back.searchParams.set("error", (err as Error).message);
    return NextResponse.redirect(back);
  }
}
