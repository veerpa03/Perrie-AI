import type { WebSocket } from "ws";

/** Twilio media stream handler — implemented in the voice phase. */
export function handleMediaStream(ws: WebSocket) {
  ws.close(1013, "Voice agent not set up yet");
}
