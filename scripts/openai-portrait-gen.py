#!/usr/bin/env python3
"""
openai-portrait-gen.py — M518b
================================
Generate a single portrait image for one character via OpenAI, then
chroma-key the background, despill, and center-pad to 512x768 (portrait
aspect — taller than wide).

Derived from openai-spritesheet-gen.py. Single-image variant: no 3x3
grid, no slicing, no multi-pose loop.

Usage:
  python3 scripts/openai-portrait-gen.py <character_id> \\
      --desc "..." \\
      [--style emberveil]

Env / inputs:
  - OpenAI API key from /home/radgh/claude/secrets/openai-api-key.txt
  - Reference template (always sent):
      public/assets/openai_v2/reference.png (canonical)

Outputs:
  - Portrait:  public/images/openai_v2/<id>_portrait.png  (512x768, RGBA)
  - Raw:       public/assets/openai_v2/raw/<id>/<date>_raw.png
  - Sidecar:   public/assets/data/image-review-v2-openai-sidecar.json
  - Batch:     public/assets/data/image_review_batches/<openId>.json

M462 enrollment rule: every generated image is enrolled in the open
image-review batch so it appears in the Pending tab.
"""

import argparse, base64, io, json, pathlib, sys, time, urllib.request

try:
    from PIL import Image
except ImportError:
    sys.stderr.write("ERROR: Pillow not installed. Run: pip install pillow\n")
    sys.exit(2)

ROOT = pathlib.Path(__file__).resolve().parents[1]

def read_first_secret(paths):
    for path in paths:
        p = pathlib.Path(path)
        if p.exists():
            value = p.read_text().strip()
            if value:
                return value
    raise FileNotFoundError("OpenAI API key missing; checked: " + ", ".join(paths))

KEY = read_first_secret([
    "/home/radgh/claude/secrets/openai-api-key.txt",
    "/home/radgh/codex/secrets/openai-api-key.txt",
    "/home/radgh/claude/assets/references/openai-api-key.txt",
])

REFERENCE_CURRENT = ROOT / "public/assets/openai_v2/reference.png"
TEMPLATE_PRIMARY  = pathlib.Path("/home/radgh/claude/assets/references/emberveil/images/sprite-sheet-templates/knight-9pose-reference-2.png")
TEMPLATE_FALLBACK = pathlib.Path("/home/radgh/claude/assets/references/emberveil/images/sprite-sheet-templates/knight-9pose-reference.png")
TEMPLATE = REFERENCE_CURRENT if REFERENCE_CURRENT.exists() else (
    TEMPLATE_PRIMARY if TEMPLATE_PRIMARY.exists() else TEMPLATE_FALLBACK
)

OUT_DIR     = ROOT / "public/images/openai_v2"
BACKUP_DIR  = OUT_DIR / "_pre_openai"
RAW_DIR     = ROOT / "public/assets/openai_v2/raw"
SIDECAR_JSON = ROOT / "public/assets/data/image-review-v2-openai-sidecar.json"
BATCH_INDEX_JSON = ROOT / "public/assets/data/image_review_batches/index.json"
BATCH_DIR   = ROOT / "public/assets/data/image_review_batches"

# Output dimensions: portrait aspect (taller than wide)
TARGET_W = 512
TARGET_H = 768

CHROMA_RGB       = (0, 255, 0)
CHROMA_TOLERANCE = 64
DESPILL_RADIUS   = 66

PORTRAIT_PROMPT_TEMPLATE = (
    "Generate a single high-quality character portrait on a SOLID #00FF00 "
    "green background. This is a single standing portrait, NOT a grid or "
    "sprite sheet — just one image of one character, facing slightly toward "
    "the viewer (3/4 view or front-facing), shown from roughly head to mid-"
    "thigh so the face, costume, and weapon/tool are all visible.\n\n"
    "Character: {desc}\n\n"
    "Style guidelines:\n"
    "{style_desc}\n"
    "Background must be EXACTLY #00FF00 with NO shading, no gradient, no "
    "shadow, no floor. No text, no labels, no UI overlay. No other characters. "
    "Do NOT add vignetting at the edges. The character should be fully "
    "rendered with crisp outlines, rich colors, and a confident posed stance. "
    "Aspect ratio: tall portrait (roughly 2:3 width to height)."
)

STYLE_EMBERVEIL = (
    "High-fantasy pixel-art / hand-painted hybrid — tall, realistically-"
    "proportioned adult figure (6-7 head heights, NOT chibi, NOT super-"
    "deformed). Rich color palette, sharp outlines, dramatic lighting, "
    "dark fantasy palette. Match the visual fidelity of a painted character "
    "portrait for a dark fantasy RPG."
)


def log(msg):
    print(f"[portrait] {msg}", flush=True)


def call_openai(prompt: str, image_paths: list[pathlib.Path], size: str = "1024x1024") -> bytes:
    boundary = "----openai-portrait-boundary"
    body_parts: list[bytes] = []

    def add_field(name, value):
        body_parts.append(
            f"--{boundary}\r\nContent-Disposition: form-data; name=\"{name}\"\r\n\r\n{value}\r\n".encode()
        )

    def add_file(name, path: pathlib.Path):
        body_parts.append(
            f"--{boundary}\r\nContent-Disposition: form-data; name=\"{name}\"; filename=\"{path.name}\"\r\nContent-Type: image/png\r\n\r\n".encode()
        )
        body_parts.append(path.read_bytes())
        body_parts.append(b"\r\n")

    add_field("model", "gpt-image-1")
    add_field("prompt", prompt)
    add_field("size", size)
    add_field("n", "1")
    for p in image_paths:
        add_file("image[]", p)
    body_parts.append(f"--{boundary}--\r\n".encode())
    body = b"".join(body_parts)

    req = urllib.request.Request(
        "https://api.openai.com/v1/images/edits",
        data=body,
        headers={
            "Authorization": f"Bearer {KEY}",
            "Content-Type": f"multipart/form-data; boundary={boundary}",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=900) as r:
            data = json.loads(r.read())
        return base64.b64decode(data["data"][0]["b64_json"])
    except urllib.error.HTTPError as e:
        err_body = e.read().decode(errors="ignore")
        if size != "1024x1024":
            log(f"WARN: size {size} rejected ({e.code}); falling back to 1024x1024")
            log(f"      server said: {err_body[:300]}")
            return call_openai(prompt, image_paths, size="1024x1024")
        raise


def _key_color(im: Image.Image, target_rgb: tuple, do_despill: bool = True) -> Image.Image:
    """Chroma-key + alpha-unmix despill (ported from convert.radgh.com)."""
    import math
    im = im.convert("RGBA")
    px = im.load()
    w, h = im.size
    kr, kg, kb = target_rgb
    if kr >= kg and kr >= kb:
        km = 0
    elif kg >= kb:
        km = 1
    else:
        km = 2
    km1 = (km + 1) % 3
    km2 = (km + 2) % 3
    key = (kr, kg, kb)
    keyM, keyM1, keyM2 = key[km], key[km1], key[km2]
    if keyM == 0:
        tol2 = CHROMA_TOLERANCE * CHROMA_TOLERANCE * 3
        for y in range(h):
            for x in range(w):
                r, g, b, a = px[x, y]
                if a == 0: continue
                dr, dg, db = r - kr, g - kg, b - kb
                if dr*dr + dg*dg + db*db <= tol2:
                    px[x, y] = (0, 0, 0, 0)
        return im
    SQRT3 = math.sqrt(3)
    t_inner = max(0, min(255, CHROMA_TOLERANCE)) * SQRT3
    t_band  = max(1, min(255, DESPILL_RADIUS)) * SQRT3
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a == 0:
                continue
            ch = (r, g, b)
            dr, dg, db = r - kr, g - kg, b - kb
            dist = math.sqrt(dr*dr + dg*dg + db*db)
            if dist <= t_inner:
                px[x, y] = (0, 0, 0, 0)
                continue
            other_max = max(ch[km1], ch[km2])
            spill = ch[km] - other_max
            if not do_despill or spill <= 0:
                if dist < t_inner + t_band:
                    a_feather = (dist - t_inner) / t_band
                    px[x, y] = (r, g, b, round(a * a_feather))
                continue
            alpha = 1 - spill / keyM
            if alpha <= 0:
                px[x, y] = (0, 0, 0, 0)
                continue
            if dist < t_inner + t_band:
                a_feather = (dist - t_inner) / t_band
                if a_feather < alpha:
                    alpha = a_feather
            if alpha <= 0:
                px[x, y] = (0, 0, 0, 0)
                continue
            inv = 1 - alpha
            fM  = other_max / alpha
            fM1 = (ch[km1] - inv * keyM1) / alpha
            fM2 = (ch[km2] - inv * keyM2) / alpha
            out = [0, 0, 0]
            out[km]  = fM
            out[km1] = fM1
            out[km2] = fM2
            new_a = round(a * alpha)
            px[x, y] = (
                max(0, min(255, int(out[0]))),
                max(0, min(255, int(out[1]))),
                max(0, min(255, int(out[2]))),
                new_a,
            )
    return im


def chroma_despill(im: Image.Image) -> Image.Image:
    """Remove #00FF00 background, then top-left-pixel fallback (from M463)."""
    im = im.convert("RGBA")
    im = _key_color(im, CHROMA_RGB, do_despill=True)
    px = im.load()
    tl = px[0, 0]
    if len(tl) == 4 and tl[3] > 200:
        r, g, b, _a = tl
        if r + g + b > 150:
            im = _key_color(im, (r, g, b), do_despill=False)
    return im


def resize_and_pad(im: Image.Image, target_w: int, target_h: int) -> Image.Image:
    """Trim transparent margins, then scale and center-pad to target_w x target_h."""
    bbox = im.getbbox()
    if bbox:
        im = im.crop(bbox)
    w, h = im.size
    if w == 0 or h == 0:
        return Image.new("RGBA", (target_w, target_h), (0, 0, 0, 0))
    # Scale to fit within target box, preserving aspect ratio.
    scale = min(target_w / w, target_h / h)
    nw, nh = max(1, int(w * scale)), max(1, int(h * scale))
    im = im.resize((nw, nh), Image.LANCZOS)
    canvas = Image.new("RGBA", (target_w, target_h), (0, 0, 0, 0))
    canvas.paste(im, ((target_w - nw) // 2, (target_h - nh) // 2), im)
    return canvas


def append_review_entries(char_id: str, portrait_path: str, prompt: str, category: str = 'storyteller'):
    """Append entry to the OpenAI sidecar manifest and enroll in the open batch."""
    SIDECAR_JSON.parent.mkdir(parents=True, exist_ok=True)
    try:
        data = json.loads(SIDECAR_JSON.read_text()) if SIDECAR_JSON.exists() else {}
    except Exception:
        data = {}
    entries = data.setdefault("entries", [])
    now = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())

    # Drop existing entries for this character from this source.
    entries[:] = [e for e in entries if not (e.get("group") == char_id and e.get("source") == "openai-portrait")]

    p = pathlib.Path(portrait_path)
    file_rel = "../images/" + str(p.relative_to(ROOT / "public/images")).replace("\\", "/")
    entries.append({
        "id": f"portrait_{char_id}",
        "category": category,
        "group": char_id,
        "pose": "portrait",
        "file": file_rel,
        "prompt": prompt,
        "source": "openai-portrait",
        "generatedAt": now,
    })
    SIDECAR_JSON.write_text(json.dumps(data, indent=2))
    log(f"appended entry to {SIDECAR_JSON.name} (sidecar)")

    # M462 — also enroll in open review batch.
    register_open_batch_entry(char_id, portrait_path, prompt, category)


def register_open_batch_entry(char_id: str, portrait_path: str, prompt: str, category: str = 'storyteller'):
    """Enroll portrait in the current open batch JSON for the Pending tab."""
    if not BATCH_INDEX_JSON.exists():
        log(f"WARN: {BATCH_INDEX_JSON} missing — Pending entry skipped.")
        return
    try:
        idx = json.loads(BATCH_INDEX_JSON.read_text())
    except Exception as e:
        log(f"WARN: failed to read batch index: {e}")
        return
    open_batch = idx.get("open")
    if not open_batch:
        log("WARN: no open batch — Pending entry skipped.")
        return
    batch_path = BATCH_DIR / f"{open_batch['id']}.json"
    if not batch_path.exists():
        log(f"WARN: open batch file {batch_path.name} missing")
        return
    try:
        batch = json.loads(batch_path.read_text())
    except Exception as e:
        log(f"WARN: failed to read {batch_path.name}: {e}")
        return
    if not isinstance(batch.get("entries"), list):
        batch["entries"] = []

    # Drop any pre-existing un-approved entries for this character.
    batch["entries"] = [
        e for e in batch["entries"]
        if not (e.get("group") == char_id and e.get("source") == "openai-portrait" and not e.get("approved"))
    ]

    now = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    p = pathlib.Path(portrait_path)
    live_rel = "../images/" + str(p.relative_to(ROOT / "public/images")).replace("\\", "/")
    backup_path = ROOT / "public/images/openai_v2/_pre_openai" / p.name
    backup_dir_rel = "../images/openai_v2/_pre_openai"
    old_rel = f"{backup_dir_rel}/{p.name}" if backup_path.exists() else live_rel

    batch["entries"].append({
        "id": f"portrait_{char_id}",
        "group": char_id,
        "pose": "portrait",
        "category": category,
        "source": "openai-portrait",
        "prompt": prompt,
        "old": old_rel,
        "new": live_rel,
        "live": live_rel,
        "approved": False,
        "addedAt": now,
    })
    batch_path.write_text(json.dumps(batch, indent=2) + "\n")
    log(f"enrolled portrait_{char_id} in open batch {open_batch['id']} (Pending)")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("char_id")
    ap.add_argument("--desc", required=True, help="Character description for the portrait prompt")
    ap.add_argument("--style", default="emberveil", choices=["emberveil"],
                    help="Visual style preset (default: emberveil)")
    ap.add_argument("--category", default="storyteller",
                    help="Review category for batch enrollment (default: storyteller)")
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--no-review-tag", action="store_true")
    ap.add_argument("--size", default="1024x1024",
                    help="OpenAI image size, e.g. 1024x1024 (default). Falls back to 1024x1024 if rejected.")
    args = ap.parse_args()

    char_id = args.char_id
    style_desc = STYLE_EMBERVEIL if args.style == "emberveil" else STYLE_EMBERVEIL

    log(f"character: {char_id}")
    log(f"description: {args.desc[:120]}")

    if not TEMPLATE.exists():
        sys.stderr.write(f"ERROR: reference template missing: {TEMPLATE}\n")
        sys.exit(1)

    prompt = PORTRAIT_PROMPT_TEMPLATE.format(
        desc=args.desc,
        style_desc=style_desc,
    )

    if args.dry_run:
        log(f"DRY RUN — would call OpenAI with reference: {TEMPLATE}")
        log(f"prompt:\n{prompt}")
        return

    log(f"calling OpenAI… (size={args.size})")
    refs = [TEMPLATE]
    raw = call_openai(prompt, refs, size=args.size)

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    BACKUP_DIR.mkdir(parents=True, exist_ok=True)

    # Save dated raw archive (lossless, unprocessed).
    RAW_DIR.mkdir(parents=True, exist_ok=True)
    char_raw = RAW_DIR / char_id
    char_raw.mkdir(parents=True, exist_ok=True)
    today = time.strftime("%Y-%m-%d")
    raw_archive = char_raw / f"{today}_raw.png"
    try:
        Image.open(io.BytesIO(raw)).save(raw_archive, optimize=True, compress_level=9)
        log(f"raw archive → {raw_archive}")
    except Exception as e:
        log(f"WARN: raw archive failed: {e}")

    # Process: chroma-key + despill + resize-pad to 512x768.
    im = Image.open(io.BytesIO(raw)).convert("RGBA")
    im = chroma_despill(im)
    im = resize_and_pad(im, TARGET_W, TARGET_H)

    out_path = OUT_DIR / f"{char_id}_portrait.png"

    # Back up existing portrait if present.
    if out_path.exists():
        backup = BACKUP_DIR / out_path.name
        try:
            backup.write_bytes(out_path.read_bytes())
            log(f"backup → {backup}")
        except Exception:
            pass

    im.save(out_path, optimize=True)
    log(f"portrait → {out_path} ({out_path.stat().st_size} bytes)")

    if not args.no_review_tag:
        append_review_entries(char_id, str(out_path), prompt, args.category)

    log("done.")


if __name__ == "__main__":
    main()
