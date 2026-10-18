import { NextResponse } from "next/server";
import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

/**
 * Only the dashboard and the playground API need a signed-in user.
 * Everything under /api/twilio/* is called by Twilio itself (verified by
 * request signature, not a session) and must stay public.
 */
const isProtectedRoute = createRouteMatcher(["/dashboard(.*)", "/api/playground(.*)"]);

/**
 * Content-Security-Policy, built per-request with a nonce.
 *
 * script-src uses a nonce + 'strict-dynamic': Next's own inline/hydration
 * scripts pick up the nonce automatically (it reads the CSP header), and
 * strict-dynamic lets any script THAT nonce'd code loads (Clerk's clerk-js
 * loader, webpack chunk loading, GSAP/framer-motion/howler bundles) run
 * without listing every host — trust propagates from the nonce'd script,
 * not from a URL allowlist. The explicit clerk.com/clerk.accounts.dev hosts
 * are kept only as a fallback for browsers that don't understand
 * strict-dynamic (they ignore it and fall back to the host list).
 *
 * style-src keeps 'unsafe-inline': this codebase relies heavily on inline
 * `style={{...}}` (the clay gradients/shadows), which a nonce can't cover —
 * only <style> elements take a nonce, not the style attribute. Tightening
 * this would mean rewriting every clay-styled component to CSS
 * classes/variables, which is out of scope here.
 */
function buildCsp(nonce: string) {
  // Next's dev-mode Fast Refresh runtime uses eval(); production builds
  // don't. Only relax script-src for that in development.
  const devEval = process.env.NODE_ENV === "production" ? "" : " 'unsafe-eval'";
  // No 'strict-dynamic': with it, browsers ignore 'self' entirely and only
  // trust nonce'd scripts, but Next's automatic nonce-injection into its own
  // bootstrap <script src> tags doesn't apply here (custom server), which
  // silently blocked every script and broke hydration in production. 'self'
  // plus the explicit Clerk hosts is enough on its own — nonce is kept for
  // defense-in-depth on any inline scripts, not as the sole trust anchor.
  return [
    `default-src 'self'`,
    `script-src 'self' 'nonce-${nonce}' https://*.clerk.accounts.dev https://*.clerk.com https://clerk.perrie.site${devEval}`,
    `style-src 'self' 'unsafe-inline'`,
    `img-src 'self' blob: data: https://img.clerk.com https://*.googleusercontent.com`,
    `font-src 'self' data:`,
    `connect-src 'self' https://*.clerk.accounts.dev https://*.clerk.com https://clerk.perrie.site wss://*.clerk.accounts.dev wss://clerk.perrie.site https://api.getbluejay.ai`,
    `frame-src 'self' https://*.clerk.accounts.dev https://*.clerk.com https://clerk.perrie.site https://accounts.google.com`,
    `worker-src 'self' blob:`,
    `object-src 'none'`,
    `base-uri 'self'`,
    `form-action 'self'`,
    `frame-ancestors 'self'`,
  ].join("; ");
}

export default clerkMiddleware(async (auth, req) => {
  if (isProtectedRoute(req)) await auth.protect();

  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const csp = buildCsp(nonce);

  const requestHeaders = new Headers(req.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);

  const res = NextResponse.next({ request: { headers: requestHeaders } });
  res.headers.set("Content-Security-Policy", csp);
  return res;
});

export const config = {
  matcher: ["/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)", "/(api|trpc)(.*)"],
};
