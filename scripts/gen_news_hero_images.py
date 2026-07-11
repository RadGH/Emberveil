#!/usr/bin/env python3
"""Generate news featured hero images for game13 Emberveil news section.

- Calls OpenAI gpt-image-1 at 1536x1024 medium quality.
- Saves PNG bytes -> JPG quality 90 in public/images/news_hero/<slug>.jpg.
- Idempotent: skips if output exists and >100KB.
- Also archives to public/archive/<batch_id>/<slug>_new.jpg and appends entries
  to public/assets/data/image_review_batches/<open_batch>.json.
"""
import json, base64, urllib.request, pathlib, time, sys, io

ROOT = pathlib.Path("/home/radgh/claude/game13")
KEY_PATH = pathlib.Path("/home/radgh/claude/assets/references/openai-api-key.txt")
OUT_DIR = ROOT / "public/images/news_hero"
BATCH_INDEX = ROOT / "public/assets/data/image_review_batches/index.json"
BATCHES_DIR = ROOT / "public/assets/data/image_review_batches"
ARCHIVE_ROOT = ROOT / "public/archive"
LOG = ROOT / "scripts/gen_news_hero_images.log"

try:
    from PIL import Image
except ImportError:
    print("PIL/Pillow required", file=sys.stderr)
    sys.exit(1)

OUT_DIR.mkdir(parents=True, exist_ok=True)

if not KEY_PATH.exists():
    print(f"FATAL: missing OpenAI key at {KEY_PATH}", file=sys.stderr)
    sys.exit(1)
KEY = KEY_PATH.read_text().strip()
if not KEY or len(KEY) < 20:
    print("FATAL: OpenAI key file invalid/empty", file=sys.stderr)
    sys.exit(1)

BASE = (
    "Wide cinematic dark-fantasy western pixel illustration, dusty desert canyon at golden-hour, "
    "red sandstone monoliths against burning red-orange sky, faint silhouettes of distant mountains, "
    "foreground a wide flat midground (no characters in midground — must be empty for sprite overlay), "
    "painterly textures, deep shadows, ember particles drifting through warm air."
)
TAIL = (
    " Style: hand-painted dark-fantasy illustration, Emberveil red-desert palette, no text, no UI, no logos. "
    "The midground composition must be empty (focal area for sprite overlay) — this image will be reused as "
    "an in-game encounter or map background."
)

ARTICLES = [
    ("m220-m254-consolidation",
     "ATMOSPHERE: sweeping questline trailmaps suggested by faint glowing ley-lines snaking across the canyon floor, distant signal-fires marking waypoints"),
    ("milestone-report",
     "ATMOSPHERE: triumphant retrospective vista, banners catching low wind on a high mesa, long shadows from monoliths, sunbeams cutting through dust"),
    ("re-redesign",
     "ATMOSPHERE: artisan workshop hint — scattered chiseled stone fragments and faintly glowing rune-etched boulders, suggesting characters being re-sculpted from sandstone"),
    ("balance-report",
     "ATMOSPHERE: precise cosmic balance — twin red moons hanging in equilibrium above the canyon, scales of stone and shadow, mathematical aurora shimmer"),
    ("tap-weapons",
     "ATMOSPHERE: volcanic forge glow — molten lava rivers cutting through the canyon floor, sparks flying upward, anvil-shaped rock formations, smoke-and-ember haze"),
    ("simulation-overhaul",
     "ATMOSPHERE: shimmering reality-bend — faint geometric grid lines overlaying the canyon walls, dust motes following deterministic paths, fractal cliff edges"),
    ("dragon-expansion",
     "ATMOSPHERE: dragon scale-shimmer in red sky — enormous serpentine silhouettes coiled around distant peaks, scattered gleaming red scales on the canyon floor, sky-fire breath in the high clouds"),
    ("milestone-53",
     "ATMOSPHERE: early-frontier feel — modest ember campfire smoke rising from a distant ridge, simple stone cairns, dawn light just touching the highest spires"),
    ("pre-game",
     "ATMOSPHERE: blank-slate brainstorming — pristine untouched canyon, faint sketch-like cloud wisps, blueprint-blue accents in the deep shadows hinting at unbuilt potential"),
    ("post-overhaul-update",
     "ATMOSPHERE: Emberveil flag (deep crimson with a stylized ember sigil) planted atop a desert-cliff sunrise, sweeping vista feel, triumphant low-angle hero composition, banner catching the morning wind"),
]


def log(msg):
    line = f"[{time.strftime('%H:%M:%S')}] {msg}"
    print(line, flush=True)
    with LOG.open("a") as f:
        f.write(line + "\n")


def gen_image(prompt):
    body = json.dumps({
        "model": "gpt-image-1",
        "prompt": prompt,
        "size": "1536x1024",
        "quality": "medium",
        "n": 1,
    }).encode()
    req = urllib.request.Request(
        "https://api.openai.com/v1/images/generations",
        data=body,
        headers={"Authorization": f"Bearer {KEY}", "Content-Type": "application/json"},
    )
    last_err = None
    for attempt in range(3):
        try:
            with urllib.request.urlopen(req, timeout=300) as r:
                data = json.loads(r.read())
            return base64.b64decode(data["data"][0]["b64_json"])
        except Exception as e:
            last_err = e
            time.sleep(5 + attempt * 5)
    raise RuntimeError(f"3x failure: {last_err}")


def save_jpg(png_bytes, out_path):
    img = Image.open(io.BytesIO(png_bytes)).convert("RGB")
    img.save(out_path, "JPEG", quality=90, optimize=True)


def main():
    # Open batch
    idx = json.loads(BATCH_INDEX.read_text())
    open_batch_id = idx["open"]["id"]
    batch_path = BATCHES_DIR / f"{open_batch_id}.json"
    batch = json.loads(batch_path.read_text())
    batch.setdefault("entries", [])
    archive_dir = ARCHIVE_ROOT / open_batch_id
    archive_dir.mkdir(parents=True, exist_ok=True)

    generated = []
    failed = []
    skipped = []

    for slug, atmos in ARTICLES:
        out = OUT_DIR / f"{slug}.jpg"
        if out.exists() and out.stat().st_size > 100_000:
            log(f"SKIP {slug}.jpg (exists, {out.stat().st_size} bytes)")
            skipped.append(slug)
            continue
        prompt = f"{BASE} {atmos}.{TAIL}"
        log(f"GEN  {slug}.jpg ...")
        try:
            png = gen_image(prompt)
            save_jpg(png, out)
            size = out.stat().st_size
            log(f"  -> wrote {size} bytes")
            # archive copy
            arch = archive_dir / f"{slug}_new.jpg"
            arch.write_bytes(out.read_bytes())
            generated.append((slug, size, prompt))
            time.sleep(1.0)
        except Exception as e:
            log(f"  !! FAIL {slug}: {e}")
            failed.append((slug, str(e)))

    # Wire batch entries for newly generated only
    existing_ids = {e.get("assetId") for e in batch["entries"]}
    for slug, size, prompt in generated:
        asset_id = f"openai-gen-{slug}"
        if asset_id in existing_ids:
            continue
        rel = f"images/news_hero/{slug}.jpg"
        batch["entries"].append({
            "assetId": asset_id,
            "category": "background",
            "type": "menu" if slug in ("pre-game", "milestone-53") else "combat",
            "prompt": prompt,
            "new": rel,
            "old": rel,
            "source": "openai-gpt-image-1",
            "addedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            "note": f"News hero image for /news/{slug}.html"
        })

    if generated:
        batch_path.write_text(json.dumps(batch, indent=2) + "\n")
        log(f"Updated batch {open_batch_id} with {len(generated)} entries")

    total_bytes = sum(s for _, s, _ in generated)
    log(f"DONE generated={len(generated)} skipped={len(skipped)} failed={len(failed)} total_bytes={total_bytes}")
    print("\n=== SUMMARY ===")
    print(f"Generated: {len(generated)}")
    print(f"Skipped (existing): {len(skipped)} -> {skipped}")
    print(f"Failed: {len(failed)} -> {failed}")
    print(f"Total bytes (new): {total_bytes}")


if __name__ == "__main__":
    main()
