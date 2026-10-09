import WebSocket from "ws";
import { env } from "../env";

/**
 * Deepgram streaming speech-to-text and text-to-speech, in the 8 kHz μ-law
 * format Twilio Media Streams use, so audio is forwarded without transcoding.
 */

export interface SttEvents {
  /** Partial words while the person is still talking (used for barge-in). */
  onInterim(text: string): void;
  /** A complete utterance: the person finished a thought. */
  onUtterance(text: string, confidence: number): void;
  onError(err: Error): void;
}

export class DeepgramStt {
  private ws: WebSocket;
  private finals: string[] = [];
  private confidences: number[] = [];
  private keepAlive: NodeJS.Timeout;
  private queue: Buffer[] = [];

  constructor(private events: SttEvents) {
    const dg = env.deepgram();
    if (!dg) throw new Error("DEEPGRAM_API_KEY is not set.");
    const params = new URLSearchParams({
      model: dg.sttModel,
      encoding: "mulaw",
      sample_rate: "8000",
      channels: "1",
      interim_results: "true",
      endpointing: "400",
      utterance_end_ms: "1200",
      vad_events: "true",
      smart_format: "true",
      punctuate: "true",
    });
    this.ws = new WebSocket(`wss://api.deepgram.com/v1/listen?${params}`, {
      headers: { Authorization: `Token ${dg.apiKey}` },
    });
    this.ws.on("open", () => {
      for (const b of this.queue) this.ws.send(b);
      this.queue = [];
    });
    this.ws.on("message", (raw) => this.onMessage(raw.toString()));
    this.ws.on("error", (err) => this.events.onError(err as Error));
    this.keepAlive = setInterval(() => {
      if (this.ws.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify({ type: "KeepAlive" }));
    }, 8000);
  }

  send(mulaw: Buffer) {
    if (this.ws.readyState === WebSocket.OPEN) this.ws.send(mulaw);
    else if (this.ws.readyState === WebSocket.CONNECTING && this.queue.length < 250) this.queue.push(mulaw);
  }

  private flush() {
    const text = this.finals.join(" ").trim();
    const conf = this.confidences.length ? this.confidences.reduce((a, b) => a + b, 0) / this.confidences.length : 0;
    this.finals = [];
    this.confidences = [];
    if (text) this.events.onUtterance(text, conf);
  }

  private onMessage(raw: string) {
    let msg: {
      type?: string;
      is_final?: boolean;
      speech_final?: boolean;
      channel?: { alternatives?: { transcript?: string; confidence?: number }[] };
    };
    try {
      msg = JSON.parse(raw);
    } catch {
      return;
    }
    if (msg.type === "Results") {
      const alt = msg.channel?.alternatives?.[0];
      const text = alt?.transcript?.trim() ?? "";
      if (!msg.is_final) {
        if (text) this.events.onInterim(text);
        return;
      }
      if (text) {
        this.finals.push(text);
        this.confidences.push(alt?.confidence ?? 0);
        this.events.onInterim(text);
      }
      if (msg.speech_final) this.flush();
    } else if (msg.type === "UtteranceEnd") {
      this.flush();
    }
  }

  close() {
    clearInterval(this.keepAlive);
    try {
      if (this.ws.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify({ type: "CloseStream" }));
      this.ws.close();
    } catch {
      /* already closed */
    }
  }
}

/** Text -> μ-law 8 kHz audio stream (raw, no container). */
export async function synthesize(text: string, voice: string | null | undefined, signal: AbortSignal) {
  const dg = env.deepgram();
  if (!dg) throw new Error("DEEPGRAM_API_KEY is not set.");
  const params = new URLSearchParams({
    model: voice || dg.ttsVoice,
    encoding: "mulaw",
    sample_rate: "8000",
    container: "none",
  });
  const res = await fetch(`https://api.deepgram.com/v1/speak?${params}`, {
    method: "POST",
    headers: { Authorization: `Token ${dg.apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
    signal,
  });
  if (!res.ok || !res.body) throw new Error(`Deepgram TTS ${res.status}: ${await res.text().catch(() => "")}`);
  return res.body;
}
