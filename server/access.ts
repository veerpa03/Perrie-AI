import type { IncomingMessage, ServerResponse } from "node:http";
import { safeEqual } from "../src/server/crypto";
import { env } from "../src/server/env";

/**
 * Access guard for a dashboard with no sign-in.
 *
 * The same server must be publicly reachable (Twilio webhooks + media
 * stream), but the dashboard can read transcripts and place calls on the
 * owner's behalf. So:
 *   - Public: the landing page, static assets, and /api/twilio/* (those
 *     routes verify Twilio's request signature / a signed stream token).
 *   - Private (dashboard, other APIs): if DASHBOARD_PASSWORD is set, HTTP
 *     Basic auth is required. Otherwise only direct local requests are let in
 *     — anything arriving through a tunnel or proxy (ngrok, Cloudflare,
 *     a load balancer) is refused.
 */

const PUBLIC_PREFIXES = ["/_next/", "/frames/", "/mascot/", "/audio/", "/api/twilio/"];
const PUBLIC_EXACT = new Set(["/", "/sign-in", "/icon.png", "/favicon.ico", "/robots.txt"]);

const PROXY_HEADERS = ["x-forwarded-for", "x-forwarded-host", "forwarded", "x-real-ip", "cf-connecting-ip", "ngrok-trace-id"];

export function isPublicPath(pathname: string): boolean {
  return PUBLIC_EXACT.has(pathname) || PUBLIC_PREFIXES.some((p) => pathname.startsWith(p));
}

function isLoopback(addr: string | undefined): boolean {
  if (!addr) return false;
  return addr === "127.0.0.1" || addr === "::1" || addr === "::ffff:127.0.0.1";
}

export function isDirectLocalRequest(req: IncomingMessage): boolean {
  if (!isLoopback(req.socket.remoteAddress)) return false;
  if (PROXY_HEADERS.some((h) => req.headers[h] !== undefined)) return false;
  const host = (req.headers.host ?? "").replace(/:\d+$/, "").replace(/^\[|\]$/g, "");
  return host === "localhost" || host === "127.0.0.1" || host === "::1";
}

function passwordOk(req: IncomingMessage, password: string): boolean {
  const header = req.headers.authorization ?? "";
  if (!header.startsWith("Basic ")) return false;
  const decoded = Buffer.from(header.slice(6), "base64").toString("utf8");
  const pass = decoded.slice(decoded.indexOf(":") + 1);
  return safeEqual(pass, password);
}

/** Returns true when the request may continue; otherwise it has been answered. */
export function guardRequest(req: IncomingMessage, res: ServerResponse, pathname: string): boolean {
  if (isPublicPath(pathname)) return true;

  const password = env.dashboardPassword();
  if (password) {
    if (passwordOk(req, password)) return true;
    res.writeHead(401, {
      "WWW-Authenticate": 'Basic realm="Perrie dashboard", charset="UTF-8"',
      "Content-Type": "text/plain; charset=utf-8",
    });
    res.end("Perrie dashboard: password required.");
    return false;
  }

  if (isDirectLocalRequest(req)) return true;

  res.writeHead(403, { "Content-Type": "text/html; charset=utf-8" });
  res.end(
    `<!doctype html><meta charset="utf-8"><title>Perrie — private</title>` +
      `<body style="font-family:system-ui;background:#FBF8F3;color:#263445;display:grid;place-items:center;min-height:100vh;margin:0">` +
      `<div style="max-width:30rem;padding:2rem;text-align:center"><h1 style="margin:0 0 .5rem">This dashboard is private</h1>` +
      `<p>Open it on the machine running Perrie at <code>http://localhost</code>, or set <code>DASHBOARD_PASSWORD</code> to allow remote access.</p></div>`,
  );
  return false;
}
