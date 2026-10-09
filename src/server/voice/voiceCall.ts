import type { WebSocket } from "ws";
import { AgentSession } from "../agent/session";
import { db, getProfile, listFacts, logGuardrail, type CallRecord } from "../db";
import { lookupContactByPhone } from "../integrations/google/contacts";
import { DeepgramStt, synthesize } from "./deepgram";
import { finalizeCallOnce } from "./finalize";

/**
 * One live phone call: Twilio media stream <-> Deepgram STT -> agent ->
 * Deepgram TTS -> Twilio. Handles turn-taking, barge-in (the caller can talk
 * over Perrie), silence and a maximum call length.
 */

const MAX_CALL_MS = 15 * 60_000;
const SILENCE_NUDGE_MS = 25_000;
const SILENCE_HANGUP_MS = 45_000;
const LOW_CONFIDENCE = 0.45;

export type StreamClaims = { callId: string; role: "owner" | "guest" | "delegate" };

export class VoiceCall {
  private agent: AgentSession | null = null;
  private stt: DeepgramStt | null = null;
  private call: CallRecord | null = null;
  private voice: string | null = null;

  private speakChain: Promise<void> = Promise.resolve();
  private ttsAborts = new Set<AbortController>();
  private responseAbort: AbortController | null = null;
  private outstandingMarks = new Set<string>();
  private markSeq = 0;
  private generating = false;
  private hangupAfterSpeech = false;
  private stopped = false;
  private timers: NodeJS.Timeout[] = [];
  private silenceTimer: NodeJS.Timeout | null = null;
  private nudged = false;

  constructor(
    private ws: WebSocket,
    private streamSid: string,
    private claims: StreamClaims,
  ) {}

  private get speaking() {
    return this.outstandingMarks.size > 0 || this.ttsAborts.size > 0;
  }

  async start() {
    this.call = await db().get("calls", this.claims.callId);
    if (!this.call) throw new Error(`Unknown call ${this.claims.callId}`);
    const [profile, facts] = await Promise.all([getProfile(), listFacts()]);
    this.voice = profile?.assistant_voice ?? null;

    let callerName: string | null = null;
    if (this.claims.role === "guest" && this.call.from_number) {
      callerName = (await lookupContactByPhone(this.call.from_number))?.name ?? null;
      if (callerName) await db().update("calls", this.call.id, { counterpart_name: callerName });
    }

    this.agent = await AgentSession.create({
      role: this.claims.role,
      channel: "voice",
      callId: this.call.id,
      profile,
      facts,
      mission: this.call.mission,
      counterpartName: this.call.counterpart_name ?? callerName,
      caller: { number: this.call.direction === "inbound" ? this.call.from_number : this.call.to_number, name: callerName },
    });

    await db().update("calls", this.call.id, {
      status: "in-progress",
      role: this.claims.role,
      started_at: this.call.started_at ?? new Date().toISOString(),
    });

    this.stt = new DeepgramStt({
      onInterim: (t) => this.onInterim(t),
      onUtterance: (t, c) => void this.onUtterance(t, c),
      onError: (err) => console.error("[voice] STT error", err.message),
    });

    this.timers.push(
      setTimeout(() => void this.wrapUp("We've been talking a while, so I'll let you go now. Goodbye!"), MAX_CALL_MS),
    );

    this.say(this.agent.greeting);
    await this.agent.logGreeting();
    this.armSilence();
  }

  // ---------------------------------------------------------------- audio in
  onAudio(base64: string) {
    this.stt?.send(Buffer.from(base64, "base64"));
  }

  onMark(name: string) {
    this.outstandingMarks.delete(name);
    if (!this.speaking && !this.generating) {
      if (this.hangupAfterSpeech) this.hangUp();
      else this.armSilence();
    }
  }

  private onInterim(text: string) {
    this.clearSilence();
    // Barge-in: the caller is talking over Perrie (2+ words, to ignore noise).
    if (this.speaking && text.split(/\s+/).length >= 2 && !this.hangupAfterSpeech) this.interrupt();
  }

  private async onUtterance(text: string, confidence: number) {
    if (this.stopped || !this.agent) return;
    this.clearSilence();
    this.nudged = false;
    if (this.speaking || this.generating) this.interrupt();
    if (confidence > 0 && confidence < LOW_CONFIDENCE && text.split(/\s+/).length <= 3) {
      this.say("Sorry, I didn't catch that — could you say it again?");
      return;
    }
    const abort = new AbortController();
    this.responseAbort = abort;
    this.generating = true;
    try {
      const { ended } = await this.agent.respond(text, { signal: abort.signal, onSentence: (s) => this.say(s) });
      if (ended) this.hangupAfterSpeech = true;
    } catch (err) {
      if (!abort.signal.aborted) {
        console.error("[voice] agent error", err);
        this.say("Sorry, I'm having trouble right now. Please try again in a moment.");
      }
    } finally {
      if (this.responseAbort === abort) {
        this.responseAbort = null;
        this.generating = false;
      }
      if (!this.speaking && !this.generating) {
        if (this.hangupAfterSpeech) this.hangUp();
        else this.armSilence();
      }
    }
  }

  // --------------------------------------------------------------- audio out
  private say(text: string) {
    if (this.stopped) return;
    const abort = new AbortController();
    this.ttsAborts.add(abort);
    // Start synthesis now (overlaps with the previous sentence playing) but
    // send audio strictly in order.
    const audio = synthesize(text, this.voice, abort.signal).catch((err) => {
      if (!abort.signal.aborted) console.error("[voice] TTS error", (err as Error).message);
      return null;
    });
    this.speakChain = this.speakChain.then(async () => {
      try {
        const body = await audio;
        if (!body || abort.signal.aborted) return;
        const reader = body.getReader();
        let pending = Buffer.alloc(0);
        for (;;) {
          const { done, value } = await reader.read();
          if (abort.signal.aborted) {
            await reader.cancel().catch(() => {});
            return;
          }
          if (value) pending = Buffer.concat([pending, Buffer.from(value)]);
          // ~200 ms frames of 8 kHz μ-law.
          while (pending.length >= 1600 || (done && pending.length)) {
            const chunk = pending.subarray(0, 1600);
            pending = pending.subarray(chunk.length);
            this.send({ event: "media", streamSid: this.streamSid, media: { payload: chunk.toString("base64") } });
          }
          if (done) break;
        }
        const mark = `m${++this.markSeq}`;
        this.outstandingMarks.add(mark);
        this.send({ event: "mark", streamSid: this.streamSid, mark: { name: mark } });
      } finally {
        this.ttsAborts.delete(abort);
      }
    });
  }

  private interrupt() {
    this.responseAbort?.abort();
    this.responseAbort = null;
    this.generating = false;
    for (const a of this.ttsAborts) a.abort();
    this.ttsAborts.clear();
    this.outstandingMarks.clear();
    this.send({ event: "clear", streamSid: this.streamSid });
  }

  private send(msg: unknown) {
    if (this.ws.readyState === this.ws.OPEN) this.ws.send(JSON.stringify(msg));
  }

  // ------------------------------------------------------------ call control
  private armSilence() {
    this.clearSilence();
    if (this.stopped || this.hangupAfterSpeech) return;
    this.silenceTimer = setTimeout(
      () => {
        if (!this.nudged) {
          this.nudged = true;
          this.say("Are you still there?");
          this.armSilence();
        } else {
          void this.wrapUp("I'll hang up for now. Goodbye!");
        }
      },
      this.nudged ? SILENCE_HANGUP_MS - SILENCE_NUDGE_MS : SILENCE_NUDGE_MS,
    );
  }

  private clearSilence() {
    if (this.silenceTimer) clearTimeout(this.silenceTimer);
    this.silenceTimer = null;
  }

  private async wrapUp(line: string) {
    if (this.stopped || this.hangupAfterSpeech) return;
    this.interrupt();
    this.hangupAfterSpeech = true;
    this.say(line);
    await logGuardrail({ kind: "call_wrapped_up", severity: "info", detail: line, call_id: this.claims.callId });
  }

  private hangUp() {
    // Closing the stream ends <Connect>; with no further TwiML Twilio hangs up.
    try {
      this.ws.close(1000, "done");
    } catch {
      /* closed */
    }
  }

  async stop() {
    if (this.stopped) return;
    this.stopped = true;
    this.clearSilence();
    for (const t of this.timers) clearTimeout(t);
    this.responseAbort?.abort();
    for (const a of this.ttsAborts) a.abort();
    this.stt?.close();
    if (!this.call) return;
    const fresh = await db().get("calls", this.call.id);
    const ended = new Date();
    const started = fresh?.started_at ? new Date(fresh.started_at) : ended;
    await db().update("calls", this.call.id, {
      status: fresh?.status === "in-progress" ? "completed" : (fresh?.status ?? "completed"),
      ended_at: fresh?.ended_at ?? ended.toISOString(),
      duration_seconds: fresh?.duration_seconds ?? Math.round((ended.getTime() - started.getTime()) / 1000),
    });
    await finalizeCallOnce(this.call.id);
  }
}
