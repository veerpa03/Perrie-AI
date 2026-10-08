import { Howl } from "howler";
import { AUDIO } from "./constants";
import type { SequenceName } from "./types";
import type { StageId } from "./constants";

/**
 * Wraps Howler playback for the journey's ambient/flight sound layer.
 * Everything starts muted; nothing plays until the user explicitly
 * enables sound. All source files are synthesized placeholders generated
 * by scripts/generate_audio.py — not recordings of real sound effects.
 */
export class AudioController {
  private enabled = false;
  private ready = false;
  private wind: Howl | null = null;
  private ambienceCity: Howl | null = null;
  private whooshDescend: Howl | null = null;
  private whooshAscend: Howl | null = null;
  private flutter: Howl | null = null;

  private windId: number | null = null;
  private ambienceId: number | null = null;
  private lastStage: StageId | null = null;
  private lastSequence: SequenceName | null = null;
  private flightFadeTimer: ReturnType<typeof setTimeout> | null = null;

  init() {
    if (this.ready) return;
    this.ready = true;
    this.wind = new Howl({ src: ["/audio/wind-cloud.wav"], loop: true, volume: 0 });
    this.ambienceCity = new Howl({ src: ["/audio/ambience-city.wav"], loop: true, volume: 0 });
    this.whooshDescend = new Howl({ src: ["/audio/whoosh-descend.wav"], volume: 0 });
    this.whooshAscend = new Howl({ src: ["/audio/whoosh-ascend.wav"], volume: 0 });
    this.flutter = new Howl({ src: ["/audio/flutter.wav"], loop: true, volume: 0 });
  }

  setEnabled(enabled: boolean) {
    this.enabled = enabled;
    if (!enabled) {
      this.wind?.fade(this.wind.volume(), 0, 400);
      this.ambienceCity?.fade(this.ambienceCity.volume(), 0, 400);
      this.flutter?.fade(this.flutter.volume(), 0, 400);
      return;
    }
    this.init();
    if (this.windId === null) this.windId = this.wind!.play();
    if (this.ambienceId === null) this.ambienceId = this.ambienceCity!.play();
  }

  get isEnabled() {
    return this.enabled;
  }

  onVisibilityChange(hidden: boolean) {
    const vol = hidden ? 0 : undefined;
    if (hidden) {
      this.wind?.pause();
      this.ambienceCity?.pause();
      this.flutter?.pause();
    } else if (this.enabled) {
      this.wind?.play(this.windId ?? undefined);
      this.ambienceCity?.play(this.ambienceId ?? undefined);
    }
    void vol;
  }

  /** Call on every journey progress update with smoothed scroll speed (0..1) and current stage. */
  update(stage: StageId, sequence: SequenceName, speed: number) {
    if (!this.enabled || !this.ready) return;

    const inCloudLayer = stage === "sky" || stage === "clouds";
    const windTarget = inCloudLayer ? AUDIO.wind.volume * Math.min(1, 0.4 + speed) : 0;
    const cityTarget =
      stage === "city-reveal" || stage === "tree-approach" || stage === "perched"
        ? AUDIO.ambience.volume
        : 0;

    if (this.wind) this.wind.fade(this.wind.volume(), windTarget, AUDIO.wind.fadeMs);
    if (this.ambienceCity)
      this.ambienceCity.fade(this.ambienceCity.volume(), cityTarget, AUDIO.ambience.fadeMs);

    const flutterTarget = speed > 0.08 ? AUDIO.flutter.volume * Math.min(1, speed * 1.5) : 0;
    if (this.flutter) {
      if (flutterTarget > 0 && !this.flutter.playing()) this.flutter.play();
      this.flutter.fade(this.flutter.volume(), flutterTarget, 250);
      if (this.flightFadeTimer) clearTimeout(this.flightFadeTimer);
      if (flutterTarget === 0) {
        this.flightFadeTimer = setTimeout(() => {
          if (this.flutter && this.flutter.volume() < 0.01) this.flutter.pause();
        }, AUDIO.flightFadeOutMs);
      }
    }

    if (sequence !== this.lastSequence && this.lastSequence !== null) {
      const whoosh = sequence === "descent" ? this.whooshDescend : this.whooshAscend;
      if (whoosh && !whoosh.playing()) {
        whoosh.volume(AUDIO.whoosh.volume);
        whoosh.play();
      }
    }
    this.lastSequence = sequence;
    this.lastStage = stage;
  }

  dispose() {
    this.wind?.unload();
    this.ambienceCity?.unload();
    this.whooshDescend?.unload();
    this.whooshAscend?.unload();
    this.flutter?.unload();
  }
}
