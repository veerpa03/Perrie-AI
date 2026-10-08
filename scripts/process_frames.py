"""
Processes raw reference frame sequences into optimized production assets.
Reads from References/{Acend_frames,Decend_frames,Perrie_mascot_images},
writes resized WebP frames into public/frames/{ascent,descent}/ and
public/mascot/, and emits JSON manifests consumed by the journey canvas.

Run with: python scripts/process_frames.py
"""
import json
import os
import re
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
REF = os.path.join(ROOT, "References")
PUB = os.path.join(ROOT, "public")

# Target dimensions: downscale from 1920x1080 for web delivery.
# Two tiers: desktop (1280x720) and mobile (800x450) to cap decode memory.
TIERS = {
    "lg": (1280, 720, 72),
    "sm": (800, 450, 68),
}

FRAME_RE = re.compile(r"(\d+)")


def numeric_key(filename: str) -> int:
    m = FRAME_RE.search(filename)
    return int(m.group(1)) if m else 0


def process_sequence(src_dir: str, out_name: str):
    files = sorted(
        (f for f in os.listdir(src_dir) if f.lower().endswith(".png")),
        key=numeric_key,
    )
    if not files:
        raise RuntimeError(f"No frames found in {src_dir}")

    manifest_frames = []
    for tier_name in TIERS:
        os.makedirs(os.path.join(PUB, "frames", out_name, tier_name), exist_ok=True)

    first_im = Image.open(os.path.join(src_dir, files[0]))
    src_w, src_h = first_im.size

    for i, fname in enumerate(files):
        src_path = os.path.join(src_dir, fname)
        im = Image.open(src_path).convert("RGB")
        out_fname = f"{i:04d}.webp"
        for tier_name, (w, h, q) in TIERS.items():
            resized = im.resize((w, h), Image.LANCZOS)
            out_path = os.path.join(PUB, "frames", out_name, tier_name, out_fname)
            resized.save(out_path, "WEBP", quality=q, method=4)
        manifest_frames.append(out_fname)

    manifest = {
        "sequence": out_name,
        "count": len(manifest_frames),
        "sourceWidth": src_w,
        "sourceHeight": src_h,
        "aspect": round(src_w / src_h, 6),
        "tiers": {
            name: {"width": w, "height": h, "path": f"/frames/{out_name}/{name}/"}
            for name, (w, h, q) in TIERS.items()
        },
        "frames": manifest_frames,
    }
    manifest_path = os.path.join(PUB, "frames", f"{out_name}.manifest.json")
    with open(manifest_path, "w") as f:
        json.dump(manifest, f)
    print(f"{out_name}: {len(manifest_frames)} frames, source {src_w}x{src_h}")
    return manifest


def process_mascot():
    src_dir = os.path.join(REF, "Perrie_mascot_images")
    out_dir = os.path.join(PUB, "mascot")
    os.makedirs(out_dir, exist_ok=True)
    names = []
    for fname in sorted(os.listdir(src_dir)):
        if not fname.lower().endswith(".png"):
            continue
        im = Image.open(os.path.join(src_dir, fname)).convert("RGBA")
        im.thumbnail((640, 640), Image.LANCZOS)
        out_name = fname.lower()
        im.save(os.path.join(out_dir, out_name), "PNG", optimize=True)
        names.append(out_name)
    print(f"mascot: {names}")


if __name__ == "__main__":
    process_sequence(os.path.join(REF, "Acend_frames"), "ascent")
    process_sequence(os.path.join(REF, "Decend_frames"), "descent")
    process_mascot()
    print("Done.")
