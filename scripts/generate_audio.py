"""
Generates subtle synthesized placeholder audio (no external assets used).
These are low-key filtered-noise beds, not recordings of real sound effects.
Outputs 16-bit mono WAV files into public/audio/.

Run with: python scripts/generate_audio.py
"""
import math
import os
import random
import struct
import wave

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "public", "audio")
os.makedirs(OUT, exist_ok=True)

SR = 22050


def write_wav(name, samples):
    path = os.path.join(OUT, name)
    with wave.open(path, "w") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        frames = b"".join(struct.pack("<h", max(-32767, min(32767, int(s * 32767)))) for s in samples)
        w.writeframes(frames)
    print(name, f"{len(samples)/SR:.2f}s")


def lowpass(samples, alpha):
    out = []
    prev = 0.0
    for s in samples:
        prev = prev + alpha * (s - prev)
        out.append(prev)
    return out


def fade(samples, in_s, out_s):
    n = len(samples)
    in_n = int(in_s * SR)
    out_n = int(out_s * SR)
    out = list(samples)
    for i in range(min(in_n, n)):
        out[i] *= i / max(1, in_n)
    for i in range(min(out_n, n)):
        out[n - 1 - i] *= i / max(1, out_n)
    return out


def noise_bed(duration, alpha, amp):
    random.seed(42)
    raw = [random.uniform(-1, 1) for _ in range(int(duration * SR))]
    filtered = lowpass(raw, alpha)
    peak = max(1e-6, max(abs(x) for x in filtered))
    return [x / peak * amp for x in filtered]


def wind_whoosh(duration, amp, rising):
    n = int(duration * SR)
    out = []
    random.seed(7)
    raw = [random.uniform(-1, 1) for _ in range(n)]
    filtered = lowpass(raw, 0.06)
    peak = max(1e-6, max(abs(x) for x in filtered))
    for i in range(n):
        t = i / n
        env = t if rising else (1 - t)
        env = env ** 1.5
        out.append(filtered[i] / peak * amp * env)
    return fade(out, 0.3, 0.3)


def flutter(duration, amp):
    n = int(duration * SR)
    out = []
    random.seed(3)
    for i in range(n):
        t = i / SR
        flap_rate = 7.0
        wing = max(0.0, math.sin(2 * math.pi * flap_rate * t)) ** 2
        rumble = random.uniform(-1, 1) * 0.5
        out.append((wing * 0.8 + rumble * 0.2) * amp)
    out = lowpass(out, 0.25)
    return fade(out, 0.05, 0.3)


def distant_bird_chirps(duration, amp):
    n = int(duration * SR)
    out = [0.0] * n
    random.seed(11)
    chirp_times = sorted(random.uniform(0.5, duration - 0.5) for _ in range(4))
    for ct in chirp_times:
        start = int(ct * SR)
        chirp_len = int(0.12 * SR)
        freq = random.uniform(1800, 2600)
        for i in range(chirp_len):
            if start + i >= n:
                break
            t = i / SR
            env = math.sin(math.pi * i / chirp_len)
            out[start + i] += math.sin(2 * math.pi * freq * t) * env * amp
    return out


if __name__ == "__main__":
    write_wav("wind-cloud.wav", fade(noise_bed(6.0, 0.015, 0.35), 1.0, 1.0))
    write_wav("whoosh-descend.wav", wind_whoosh(2.2, 0.5, rising=False))
    write_wav("whoosh-ascend.wav", wind_whoosh(2.2, 0.5, rising=True))
    write_wav("flutter.wav", flutter(1.4, 0.45))

    city = noise_bed(6.0, 0.03, 0.12)
    chirps = distant_bird_chirps(6.0, 0.18)
    mixed = [min(1.0, max(-1.0, a + b)) for a, b in zip(city, chirps)]
    write_wav("ambience-city.wav", fade(mixed, 1.0, 1.0))
    print("Done.")
