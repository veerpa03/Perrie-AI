import type { WebSocket } from "ws";
import { verifyToken } from "../crypto";
import { logGuardrail } from "../db";
import { VoiceCall, type StreamClaims } from "./voiceCall";

/**
 * Twilio Media Streams WebSocket (bidirectional, via <Connect><Stream>).
 * The stream is only accepted with the short-lived HMAC token our TwiML
 * passed as a <Parameter>, so nobody can open a stream and claim to be the
 * owner.
 */
export function handleMediaStream(ws: WebSocket) {
  let call: VoiceCall | null = null;
  const authTimer = setTimeout(() => {
    if (!call) ws.close(1008, "no start");
  }, 10_000);

  ws.on("message", (raw) => {
    let msg: {
      event?: string;
      streamSid?: string;
      start?: { streamSid: string; callSid: string; customParameters?: Record<string, string> };
      media?: { payload: string; track?: string };
      mark?: { name: string };
    };
    try {
      msg = JSON.parse(raw.toString());
    } catch {
      return;
    }
    switch (msg.event) {
      case "start": {
        clearTimeout(authTimer);
        const claims = verifyToken<StreamClaims & Record<string, unknown>>(msg.start?.customParameters?.token);
        if (!claims || !claims.callId || !["owner", "guest", "delegate"].includes(claims.role)) {
          void logGuardrail({
            kind: "stream_rejected",
            severity: "block",
            detail: "A media stream connected without a valid token and was refused.",
          });
          ws.close(1008, "unauthorised");
          return;
        }
        call = new VoiceCall(ws, msg.start!.streamSid, { callId: claims.callId, role: claims.role });
        call.start().catch((err) => {
          console.error("[voice] start failed", err);
          ws.close(1011, "start failed");
        });
        break;
      }
      case "media":
        if (msg.media && (!msg.media.track || msg.media.track === "inbound")) call?.onAudio(msg.media.payload);
        break;
      case "mark":
        if (msg.mark) call?.onMark(msg.mark.name);
        break;
      case "stop":
        void call?.stop();
        break;
    }
  });

  ws.on("close", () => {
    clearTimeout(authTimer);
    void call?.stop();
  });
  ws.on("error", (err) => console.error("[voice] socket error", err.message));
}
