/**
 * Perrie server: Next.js (landing page, dashboard, API routes) plus the
 * Twilio media-stream WebSocket that powers live voice calls, in one process
 * so a single public URL (e.g. one ngrok tunnel) serves both.
 *
 *   pnpm dev    -> development (hot reload for the Next app)
 *   pnpm start  -> production (after `pnpm build`)
 */
import { createServer } from "node:http";
import next from "next";
import { WebSocketServer } from "ws";
import { guardRequest } from "./access";

const dev = process.env.NODE_ENV !== "production";
const port = Number(process.env.PORT ?? 3000);
const hostname = process.env.HOST ?? "localhost";

async function main() {
  const app = next({ dev, hostname, port });
  const handle = app.getRequestHandler();
  await app.prepare(); // also loads .env / .env.local into process.env
  const upgradeNext = app.getUpgradeHandler();

  // Imported after prepare() so modules see the loaded environment.
  const { handleMediaStream } = await import("../src/server/voice/mediaStream");
  const { resumeInterruptedTasks } = await import("../src/server/orchestrator/executor");
  const { startMonitoringPoller } = await import("../src/server/monitoring/poller");
  const { closeOutStaleCalls } = await import("../src/server/voice/finalize");

  const wss = new WebSocketServer({ noServer: true });

  const server = createServer((req, res) => {
    const url = new URL(req.url ?? "/", "http://localhost");
    if (!guardRequest(req, res, url.pathname)) return;
    void handle(req, res);
  });

  server.on("upgrade", (req, socket, head) => {
    const url = new URL(req.url ?? "/", "http://localhost");
    if (url.pathname === "/api/twilio/stream") {
      // Authorised inside the handler via the signed token Twilio passes back.
      wss.handleUpgrade(req, socket, head, (ws) => handleMediaStream(ws));
      return;
    }
    void upgradeNext(req, socket, head);
  });

  server.listen(port, hostname, () => {
    console.log(`> Perrie ready on http://${hostname}:${port} (${dev ? "development" : "production"})`);
    if (process.env.PUBLIC_BASE_URL) console.log(`> Public URL for Twilio: ${process.env.PUBLIC_BASE_URL}`);
  });

  // Mark interrupted task steps first, then close out calls cut off by the
  // restart (which may hand call outcomes back to waiting tasks).
  void resumeInterruptedTasks()
    .catch((err) => console.error("[orchestrator] resume failed", err))
    .then(() => closeOutStaleCalls())
    .catch((err) => console.error("[voice] stale-call sweep failed", err));
  // Bluejay monitoring: submit finished calls, collect scores and test results.
  startMonitoringPoller();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
