#!/usr/bin/env python3
"""
openai-spritesheet-gen.py — M450
================================
Generate a 9-pose 3×3 sprite sheet for one character via OpenAI image
edits, then chroma-key the green background, despill, slice into 9
cells, and write the cells to public/images/spritecook/.

Workflow spec: game13/memory/openai-sprite-sheet-workflow.md

Layout (rows top→bottom, columns left→right):
  Portrait      | South        | East
  East Attack   | East Spell   | East Block
  East KO       | East Cheer   | East Wound

Usage:
  python3 scripts/openai-spritesheet-gen.py <character_id>

Env / inputs:
  - OpenAI API key from /home/radgh/claude/secrets/openai-api-key.txt
  - Reference template (always sent):
      assets/references/emberveil/images/sprite-sheet-templates/knight-9pose-reference.png
  - Per-character description: pulled from random-event / town entry by id;
    pass --desc "..." to override.
  - Existing south-frame visual reference (optional; auto-discovered):
      public/images/sprites/<id>_south.png  OR
      public/images/spritecook/<id>_south.png

Outputs:
  - Raw sheet:        public/images/spritecook/<id>_openai_sheet.png
  - Sliced cells:     public/images/spritecook/<id>_<pose>.png  (9 files)
                      pose ∈ {portrait, south, east, east_attack, east_spell,
                              east_block, east_ko, east_cheer, east_wound}
  - Backups of any pre-existing files into spritecook/_pre_openai/<id>_<pose>.png
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
# M463 — canonical reference template lives at public/assets/openai_v2/reference.png
# (mirrored from /assets/references/...). Replace it in place to swap; the dated
# archive copy at reference_<YYYY-MM-DD>.png keeps history.
REFERENCE_CURRENT  = ROOT / "public/assets/openai_v2/reference.png"
TEMPLATE_PRIMARY   = pathlib.Path("/home/radgh/claude/assets/references/emberveil/images/sprite-sheet-templates/knight-9pose-reference-2.png")
TEMPLATE_FALLBACK  = pathlib.Path("/home/radgh/claude/assets/references/emberveil/images/sprite-sheet-templates/knight-9pose-reference.png")
TEMPLATE = REFERENCE_CURRENT if REFERENCE_CURRENT.exists() else (
    TEMPLATE_PRIMARY if TEMPLATE_PRIMARY.exists() else TEMPLATE_FALLBACK
)
# M463 — OpenAI-generated sprites live in their own bucket so manifests can
# distinguish them from SpriteCook output and the per-frame mixer can resolve
# the right source.
OUT_DIR  = ROOT / "public/images/openai_v2"
SPRITECOOK_DIR  = ROOT / "public/images/spritecook"
SPRITES_FALLBACK = ROOT / "public/images/sprites"
BACKUP_DIR = OUT_DIR / "_pre_openai"
RAW_DIR    = ROOT / "public/assets/openai_v2/raw"
REVIEW_JSON = ROOT / "public/assets/data/image-review-v2.json"
# Sidecar manifest read by scripts/build-image-review-v2.cjs and merged
# into the regenerated review file every release. Persisting through
# rebuilds is what makes openai-9pose entries actually visible on the
# /assets/image-review-v2.html page.
SIDECAR_JSON = ROOT / "public/assets/data/image-review-v2-openai-sidecar.json"
# Image Review V2 has TWO data paths:
#   1) Sidecar above → feeds the Current/All view via build-image-review-v2.cjs
#   2) The OPEN BATCH at image_review_batches/<openId>.json → feeds the Pending
#      view. Every regenerated sprite MUST enrol in the open batch so the
#      user can review before approving. M462 wires this up; previously only
#      the sidecar got written and the Pending list was empty.
BATCH_INDEX_JSON = ROOT / "public/assets/data/image_review_batches/index.json"
BATCH_DIR = ROOT / "public/assets/data/image_review_batches"

POSES = [
    "portrait", "south", "east",
    "east_attack", "east_spell", "east_block",
    "east_ko", "east_cheer", "east_wound",
]

CHROMA_RGB = (0, 255, 0)
CHROMA_TOLERANCE = 64   # hard-cut radius (per-channel scale)
DESPILL_RADIUS = 66     # outer feather softness (matches convert.radgh.com defaults)
TARGET_CELL = 256       # canonical cell size

PROMPT_TEMPLATE = (
    "Generate a 3x3 sprite sheet (square cells, identical size) of the same "
    "character, all on a SOLID #00FF00 green background. Match the LAYOUT and "
    "FRAMING of the attached reference image exactly. The reference shows the "
    "structural template only — DO NOT copy the reference character's "
    "weapons, spells, equipment, or actions. Use the new character's own "
    "actions (described below) instead.\n\n"
    "  Row 1: Portrait / South idle / East side-profile idle\n"
    "  Row 2: East attack ({attack_desc}) / East spell ({spell_desc}) / East block ({block_desc})\n"
    "  Row 3: East knocked out (lying down) / East cheering / East wounded\n\n"
    "Character: {desc}\n"
    "{equipment_constraint}\n\n"
    "Use a high-fantasy pixel-art style — tall, realistically-proportioned "
    "adult figures (roughly 6-7 head heights, NOT chibi, NOT super-deformed, "
    "NOT 2-3 head-height JRPG overworld sprites). MATCH the reference figure's "
    "proportions, height, head-to-body ratio, silhouette scale, and level of "
    "facial / costume detail within each cell — only the costume, weapon, and "
    "species change. Rich color palette, sharp pixel outlines, no halo/glow "
    "into the green, no text, no labels, no UI. Each pose centered in its "
    "cell. Background must be exactly #00FF00 with no shading or gradient. "
    "DO NOT draw any dark frame, outline, border, gridlines, or panel "
    "around cells — the green background must extend all the way to the "
    "edge of each cell without any dividing lines or contrasting trim."
)


def default_attack(kind: str, desc: str) -> str:
    """Pick an attack pose appropriate to the character. Beasts swing a
    natural weapon (claw/bite/tail), humanoids swing the weapon implied
    by the description, monks/martial-arts use bare hands."""
    s = desc.lower()
    if kind in ('beast',):
        if 'dragon' in s or 'wyrm' in s or 'drake' in s:
            return 'lunging forward with a fang/claw bite, no held weapon'
        if 'wolf' in s or 'hound' in s or 'cat' in s:
            return 'pouncing with claws and bared fangs, no held weapon'
        return 'striking with claws/fangs, no held weapon'
    if kind == 'elemental':
        return 'projecting a focused energy strike from its core, no held weapon'
    if kind == 'construct':
        return 'striking with built-in arm/limb attachment, no loose weapon'
    # humanoid: use what the description implies
    if 'monk' in s or 'martial' in s or 'unarmed' in s or 'fists' in s:
        return 'unarmed martial-arts strike — bare-fist or kick'
    if 'bow' in s or 'crossbow' in s or 'archer' in s:
        return 'firing the bow/crossbow with arrow drawn'
    return 'swinging the weapon described above in a forward strike'


def default_spell(char_id: str, desc: str) -> str:
    """Spells must be ORIGINAL to the character — never copy the reference
    knight's holy starburst. Pick a flavor that matches the character's
    archetype + element/theme."""
    s = (char_id + ' ' + desc).lower()
    # Class / archetype → spell flavor
    pairs = [
        (('cleric', 'priest', 'paladin', 'holy', 'divine'),
            'channeling a yellow-gold radiant healing aura from outstretched hand'),
        (('warlock', 'necromancer', 'shadow', 'death', 'lich'),
            'unleashing a deep purple-black shadow tendril or skull motif from a clenched fist'),
        (('rogue', 'poison', 'assassin', 'shadow_dancer'),
            'flicking a sickly green poison/toxin cloud from one hand'),
        (('mage', 'arcane', 'sorcerer', 'wizard'),
            'projecting a swirling cyan arcane sigil from an open palm'),
        (('pyromancer', 'fire', 'flame', 'ember'),
            'hurling a vivid orange-red fireball from an open palm'),
        (('frost', 'ice', 'cryo', 'wyrmling'),
            'breathing a pale blue-white frost cone from the mouth (NOT a held wand spell)'),
        (('storm', 'thunder', 'lightning'),
            'channeling a crackling yellow-white lightning bolt between hands or horns'),
        (('druid', 'nature', 'forest', 'thorn'),
            'summoning glowing green vines / leaves spiraling around the body'),
        (('shaman', 'spirit', 'totem'),
            'invoking ghostly blue-green spirit wisps that orbit the body'),
        (('oracle', 'fate', 'foresight'),
            'projecting silver-white fate sigils from a third eye or open palm'),
        (('bard', 'song', 'tune'),
            'projecting glowing musical notes / pink-purple sound waves from an instrument or mouth'),
        (('chronomancer', 'time', 'temporal'),
            'casting a slow-rotating pale blue clock-face around outstretched hand'),
        (('runesmith', 'rune', 'forge'),
            'igniting glowing orange runes carved into the air around its hand'),
        (('demon_hunter',),
            'firing a crimson-violet hunter\'s mark from a crossbow or hand'),
        (('witch_hunter', 'inquisitor'),
            'channeling a silver-white purifying flame from the weapon'),
        (('dragon_knight', 'dragon'),
            'breathing or channeling a draconic energy in the family element (fire/frost/storm)'),
    ]
    for keys, spell in pairs:
        if any(k in s for k in keys):
            return spell
    # Generic fallback — distinct from the reference's holy starburst.
    return 'projecting a custom energy effect distinct from the reference\'s holy spell'


def default_block(kind: str, desc: str) -> str:
    """Block pose. Use the character's actual equipment if known. Beasts
    rear back / use wings. Monks raise a guard with bare hands."""
    s = desc.lower()
    if kind in ('beast',):
        if 'wing' in s or 'dragon' in s or 'wyrm' in s or 'drake' in s:
            return 'raising a wing or rearing back to absorb the blow, NO held shield, NO held weapon'
        return 'crouching low with raised forelimbs / claws to absorb the blow, NO held shield, NO held weapon'
    if kind == 'elemental':
        return 'condensing into a tighter shape; magical wards flare around the body'
    if kind == 'construct':
        return 'bracing its frame; built-in plating or arms absorb the blow'
    # humanoid
    if 'shield' in s or 'buckler' in s or 'aegis' in s:
        return 'raising the shield to parry'
    if 'monk' in s or 'martial' in s or 'unarmed' in s:
        return 'high martial-arts guard — both bare hands raised to parry'
    if 'staff' in s or 'wand' in s:
        return 'holding the staff/wand horizontally to deflect'
    if 'bow' in s or 'crossbow' in s:
        return 'twisting away with bow/crossbow held horizontally to deflect'
    # Default humanoid: brace with weapon
    return 'parrying with the held weapon raised crosswise to block'

# Humanoid kinds get weapons + shields. Beasts/dragons/elementals etc. block
# with their own body (claws, wings, magical aura) and never use props.
# The user's frost wyrmling result was holding a shield, which is silly for
# a small dragon — this constraint stops that across the board.
KIND_PROFILES = {
    'humanoid':  dict(equipment_constraint=(
        "EQUIPMENT: humanoid character — may carry the weapon and/or "
        "shield described in the description. If no weapon/shield is "
        "mentioned, default to a sensible weapon for the class.")),
    'beast':     dict(equipment_constraint=(
        "EQUIPMENT (HARD RULE): this is a BEAST / DRAGON / NON-HUMANOID. "
        "DO NOT add a shield. DO NOT add a sword, axe, staff, wand, or any "
        "held weapon. The creature uses its own body — claws, fangs, wings, "
        "tail, magical breath, elemental aura — for every pose. Spells "
        "manifest as glow / breath / particles around the head or mouth, "
        "not from a wand or staff. Block uses the body itself "
        "(rearing back, wing-shield, etc.), never a held shield.")),
    'elemental': dict(equipment_constraint=(
        "EQUIPMENT (HARD RULE): this is an ELEMENTAL / SPIRIT / AMORPHOUS "
        "being. NO held weapons, NO shields, NO armor. All actions express "
        "through the elemental form itself (swirling energy, condensing "
        "matter, projected glyphs).")),
    'construct': dict(equipment_constraint=(
        "EQUIPMENT (HARD RULE): this is a CONSTRUCT / GOLEM / MACHINE. "
        "Built-in arms or weapon-attachments only — NO loose held weapons, "
        "NO loose shields. Anything the construct uses for combat is fused "
        "into its frame.")),
}


def auto_kind(char_id: str, desc: str) -> str:
    """Heuristic classifier for the equipment constraint. Words that imply
    non-humanoid override 'humanoid' default."""
    s = (char_id + ' ' + desc).lower()
    if any(k in s for k in ['dragon', 'wyrm', 'wyrmling', 'drake', 'wolf', 'hound',
                            'spider', 'bear', 'cat', 'owl', 'frog', 'sprite',
                            'wisp', 'moth', 'serpent', 'snake', 'beast']):
        return 'beast'
    if any(k in s for k in ['elemental', 'spirit', 'wraith', 'shade', 'ghost',
                            'orb', 'flame', 'mist']):
        return 'elemental'
    if any(k in s for k in ['golem', 'construct', 'turret', 'automaton', 'clockwork']):
        return 'construct'
    return 'humanoid'


def log(msg):
    print(f"[gen] {msg}", flush=True)


def find_south_frame(char_id: str) -> pathlib.Path | None:
    candidates = [
        OUT_DIR / f"{char_id}_south.png",
        SPRITECOOK_DIR / f"{char_id}_south.png",
        SPRITES_FALLBACK / f"{char_id}_south.png",
        OUT_DIR / f"{char_id}_portrait.png",
        SPRITECOOK_DIR / f"{char_id}_portrait.png",
        SPRITES_FALLBACK / f"{char_id}_east.png",
    ]
    for c in candidates:
        if c.exists() and c.stat().st_size > 1000:
            return c
    return None


def auto_description(char_id: str) -> str:
    """Best-effort character description harvester. Walks known sources;
    returns empty string if none found (caller should pass --desc)."""
    sources = [
        ROOT / "src/ui/screens/TownScreen.js",
        ROOT / "src/maps/randomEvents.js",
        ROOT / "src/game/appearances.js",
    ]
    for p in sources:
        if not p.exists():
            continue
        text = p.read_text(errors="ignore")
        # Simple substring heuristic — find a line with the id and a description field.
        idx = 0
        while idx < len(text):
            j = text.find(f"id: '{char_id}'", idx)
            if j < 0:
                break
            block = text[j: j + 1200]
            for key in ("description:", "desc:", "name:"):
                k = block.find(key)
                if k >= 0:
                    val = block[k + len(key):]
                    # find first quoted string
                    for q in ("'", '"'):
                        a = val.find(q)
                        if a >= 0:
                            b = val.find(q, a + 1)
                            if b >= 0 and b - a < 400:
                                return val[a + 1: b]
            idx = j + 1
    return ""


def call_openai(prompt: str, image_paths: list[pathlib.Path], size: str = "1024x1024") -> bytes:
    """Call OpenAI image edits with the provided reference images.

    Tries gpt-image-1 (currently most widely available for /v1/images/edits).
    Falls back to the generations endpoint if edits fails.

    `size` accepts the API's supported sizes (e.g. 1024x1024, 1024x1792,
    1792x1024, 2048x2048 if/where supported). The script will retry once
    at 1024x1024 if the requested size is rejected.
    """
    boundary = "----openai-spritesheet-boundary"
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


def _key_color(im: Image.Image, target_rgb: tuple[int, int, int], do_despill: bool = True) -> Image.Image:
    """Chroma-key + alpha-unmix despill, ported verbatim from
    convert.radgh.com (Offline-File-Converter src/lib/advanced/filters.ts
    applyBgRemovalDespill). Only pixels where the key's dominant channel
    exceeds the other two channels are treated as 'spill' — clean foreground
    (e.g. tan/yellow robes whose green sits at-or-below their red) is left
    completely untouched. Inner threshold = hard cut. Outer softness =
    feather band that ramps alpha smoothly so edges blend instead of pop."""
    import math
    im = im.convert("RGBA")
    px = im.load()
    w, h = im.size
    kr, kg, kb = target_rgb
    # Dominant key channel index (0=R, 1=G, 2=B).
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
        # Degenerate key — fall back to plain hard-cut.
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
                # No key bleed (or despill disabled) — leave colour alone, but
                # still apply the soft alpha feather so the hard cut blends.
                # This is what saves green-skinned characters (goblins): we
                # skip the colour unmix that was desaturating their skin.
                if dist < t_inner + t_band:
                    a_feather = (dist - t_inner) / t_band
                    px[x, y] = (r, g, b, round(a * a_feather))
                continue
            alpha = 1 - spill / keyM
            if alpha <= 0:
                px[x, y] = (0, 0, 0, 0)
                continue
            # Outer feather: cap alpha so the boundary at t_inner blends.
            if dist < t_inner + t_band:
                a_feather = (dist - t_inner) / t_band
                if a_feather < alpha:
                    alpha = a_feather
            if alpha <= 0:
                px[x, y] = (0, 0, 0, 0)
                continue
            inv = 1 - alpha
            # Alpha-unmix: P = a*F + (1-a)*K, solve for F. Dominant channel
            # is capped at otherMax (the "no excess key" assumption).
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
    """Remove #00FF00 background within tolerance, then despill green from
    edge pixels. M463 — adds a fallback pass that samples the top-left
    pixel and chroma-keys that colour too. OpenAI sometimes ignores the
    "#00FF00 background" instruction and renders a pale-blue or grey
    backdrop (ash_wraith, bandit). The fallback catches those without a
    code change per character."""
    im = im.convert("RGBA")
    # Pass A: the canonical green key.
    im = _key_color(im, CHROMA_RGB, do_despill=True)

    # Pass B (fallback): if the top-left pixel is still opaque after the
    # green pass, that's the actual background colour the model produced.
    # Key it too. Skip if it's already mostly transparent or near-black
    # (which would key out a real character standing in a corner).
    px = im.load()
    tl = px[0, 0]
    if len(tl) == 4 and tl[3] > 200:
        r, g, b, _a = tl
        # Don't key very dark colours (might be a real character corner).
        if r + g + b > 150:
            im = _key_color(im, (r, g, b), do_despill=False)

    # M464c — no separate Gaussian alpha blur; the new converter-style
    # despill already produces a smooth alpha ramp via the softness band,
    # and an extra blur on top blurs character edges (was visibly soft).
    return im


def slice_3x3(im: Image.Image) -> list[Image.Image]:
    """Slice the 3×3 sheet with a small inset on each cell so cell-boundary
    dark frames (OpenAI sometimes draws thin dark lines between cells, e.g.
    dragon_hatchling, molten_golem) don't leak into the sliced sprites and
    get picked up by `bbox()` in normalize_cell as character bounds. The
    inset is ~3% of cell size — enough to drop a 2–4 px frame at 256–340 px
    cells without clipping characters that respect the centered framing."""
    w, h = im.size
    cw, ch = w // 3, h // 3
    inset = max(2, min(cw, ch) * 3 // 100)
    cells = []
    for r in range(3):
        for c in range(3):
            x0 = c * cw + inset
            y0 = r * ch + inset
            x1 = c * cw + cw - inset
            y1 = r * ch + ch - inset
            cell = im.crop((x0, y0, x1, y1))
            cells.append(cell)
    return cells


def normalize_cell(cell: Image.Image) -> Image.Image:
    """Trim transparent margins, then center-pad onto a TARGET_CELL square."""
    bbox = cell.getbbox()
    if bbox:
        cell = cell.crop(bbox)
    # Scale longest side to TARGET_CELL preserving aspect.
    w, h = cell.size
    if w == 0 or h == 0:
        return Image.new("RGBA", (TARGET_CELL, TARGET_CELL), (0, 0, 0, 0))
    scale = TARGET_CELL / max(w, h)
    nw, nh = max(1, int(w * scale)), max(1, int(h * scale))
    cell = cell.resize((nw, nh), Image.LANCZOS)
    canvas = Image.new("RGBA", (TARGET_CELL, TARGET_CELL), (0, 0, 0, 0))
    canvas.paste(cell, ((TARGET_CELL - nw) // 2, (TARGET_CELL - nh) // 2), cell)
    return canvas


def append_review_entries(char_id: str, written: list[str], prompt: str):
    """Append entries to the OPEN-AI 9-POSE SIDECAR manifest. The release
    pipeline runs scripts/build-image-review-v2.cjs which regenerates
    image-review-v2.json from scratch each release; appending directly to
    that file would be wiped on the next build. The sidecar persists, and
    build-image-review-v2.cjs merges it into the rebuilt manifest each
    release.

    Schema matches the existing characters[] entry shape so the page
    renders these next to the SpriteCook/PixelLab versions for side-by-
    side comparison."""
    SIDECAR_JSON.parent.mkdir(parents=True, exist_ok=True)
    try:
        data = json.loads(SIDECAR_JSON.read_text()) if SIDECAR_JSON.exists() else {}
    except Exception:
        data = {}
    entries = data.setdefault("entries", [])
    now = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())

    # Drop any existing entries for this character so re-runs replace
    # cleanly instead of accumulating duplicates.
    entries[:] = [e for e in entries if e.get("group") != char_id or e.get("source") != "openai-9pose"]

    for path_str in written:
        p = pathlib.Path(path_str)
        # Pose = filename stem after the character id prefix.
        stem = p.stem
        pose = stem[len(char_id) + 1:] if stem.startswith(char_id + "_") else stem
        entries.append({
            "id": f"openai9_{char_id}_{pose}",
            "category": "companion",  # gets remapped by build script if char is hero/boss/enemy
            "group": char_id,
            "pose": pose,
            "file": "../images/" + str(p.relative_to(ROOT / "public/images")).replace("\\", "/"),
            "prompt": prompt,
            "source": "openai-9pose",
            "generatedAt": now,
        })
    SIDECAR_JSON.write_text(json.dumps(data, indent=2))
    log(f"appended {len(written)} entries to {SIDECAR_JSON.name} (sidecar)")

    # M462 — also enrol in the open review batch so Pending view shows them.
    register_open_batch_entries(char_id, written, prompt)


def register_open_batch_entries(char_id: str, written: list[str], prompt: str):
    """Append entries to the current open batch JSON so the Image Review V2
    page's Pending tab surfaces them. Without this, the user never sees
    newly generated sprites as 'needs review' — they just appear in the
    Current view alongside everything else, indistinguishable.

    Each batch entry has:
      id    — stable identifier
      group — character id (used to group in UI)
      pose  — which of the 9 poses
      old   — backup of the previous live file (saved automatically to
              spritecook/_pre_openai/) — what the user is replacing
      new   — the generated candidate file — currently same as `live` for
              backward-compat with how we write directly into spritecook/
      live  — the live game path the sprite will resolve from
      prompt — full prompt sent to OpenAI (visible in lightbox)
      source — 'openai-9pose'
    Approving via scripts/approve-image-review-v2.cjs copies new→live (no-op
    when they match) and marks approved. Rejecting (manual) restores old→live.
    """
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

    # Drop any pre-existing un-approved entries for this character from the
    # same source so reruns replace cleanly instead of stacking up.
    batch["entries"] = [
        e for e in batch["entries"]
        if not (e.get("group") == char_id and e.get("source") == "openai-9pose" and not e.get("approved"))
    ]

    now = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    backup_dir_rel = "../images/openai_v2/_pre_openai"
    for path_str in written:
        p = pathlib.Path(path_str)
        stem = p.stem
        pose = stem[len(char_id) + 1:] if stem.startswith(char_id + "_") else stem
        live_rel = "../images/" + str(p.relative_to(ROOT / "public/images")).replace("\\", "/")
        backup_path = ROOT / "public/images/openai_v2/_pre_openai" / p.name
        old_rel = f"{backup_dir_rel}/{p.name}" if backup_path.exists() else live_rel
        batch["entries"].append({
            "id": f"openai9_{char_id}_{pose}",
            "group": char_id,
            "pose": pose,
            "category": "companion",  # corrected by build-image-review-v2.cjs if needed
            "source": "openai-9pose",
            "prompt": prompt,
            "old": old_rel,
            "new": live_rel,
            "live": live_rel,
            "approved": False,
            "addedAt": now,
        })
    batch_path.write_text(json.dumps(batch, indent=2) + "\n")
    log(f"enrolled {len(written)} entries in open batch {open_batch['id']} (Pending)")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("char_id")
    ap.add_argument("--desc", default="", help="character description override")
    ap.add_argument("--kind", default="", choices=['', 'humanoid', 'beast', 'elemental', 'construct'],
                    help="equipment profile; auto-detected if empty")
    ap.add_argument("--attack", default="", help="custom attack pose description")
    ap.add_argument("--spell",  default="", help="custom spell pose description (color + flavor)")
    ap.add_argument("--block",  default="", help="custom block pose description")
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--no-review-tag", action="store_true")
    ap.add_argument("--no-south-reference", action="store_true",
                    help="skip the auto-discovered south frame; force the model "
                         "to generate from the description + template alone "
                         "(use when existing art is wrong / off-style)")
    ap.add_argument("--size", default="1024x1024",
                    help="OpenAI image size, e.g. 1024x1024 (default), 1024x1792, "
                         "2048x2048. Falls back to 1024x1024 if rejected.")
    args = ap.parse_args()

    char_id = args.char_id
    desc = args.desc or auto_description(char_id) or f"a fantasy creature ({char_id})"
    kind = args.kind or auto_kind(char_id, desc)
    log(f"character: {char_id}")
    log(f"description: {desc[:120]}")

    if not TEMPLATE.exists():
        sys.stderr.write(f"ERROR: reference template missing: {TEMPLATE}\n")
        sys.exit(1)

    refs = [TEMPLATE]
    if args.no_south_reference:
        log("--no-south-reference: ignoring any existing art for this character.")
    else:
        south = find_south_frame(char_id)
        if south:
            log(f"south reference: {south}")
            refs.append(south)
        else:
            log("no existing south/portrait reference — proceeding with template only.")

    # M451 — per-character behavior. The earlier prompt let OpenAI copy the
    # reference template's actions verbatim (frost wyrmling cast a sparkle
    # spell because the knight in the reference cast a sparkle spell). The
    # caller must supply attack / spell / block descriptions at runtime,
    # appropriate to THIS character. Defaults below derive from the kind +
    # description but can be overridden via --attack / --spell / --block.
    attack_desc = (args.attack or default_attack(kind, desc))
    spell_desc  = (args.spell  or default_spell(char_id, desc))
    block_desc  = (args.block  or default_block(kind, desc))

    profile = KIND_PROFILES.get(kind, KIND_PROFILES['humanoid'])
    prompt = PROMPT_TEMPLATE.format(
        desc=desc,
        attack_desc=attack_desc,
        spell_desc=spell_desc,
        block_desc=block_desc,
        equipment_constraint=profile['equipment_constraint'],
    )

    if args.dry_run:
        log(f"DRY RUN — would call OpenAI with {len(refs)} reference image(s)")
        log(f"prompt:\n{prompt}")
        return

    log(f"calling OpenAI… (size={args.size})")
    raw = call_openai(prompt, refs, size=args.size)
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    sheet_path = OUT_DIR / f"{char_id}_openai_sheet.png"
    sheet_path.write_bytes(raw)
    log(f"raw sheet → {sheet_path} ({len(raw)} bytes)")

    # M463 — preserve a dated raw copy under public/assets/openai_v2/raw/<id>/.
    # This is the unsliced 3×3 OpenAI output before chroma-key/despill, so we
    # can re-process with new params later without spending another API call.
    RAW_DIR.mkdir(parents=True, exist_ok=True)
    char_raw = RAW_DIR / char_id
    char_raw.mkdir(parents=True, exist_ok=True)
    today = time.strftime("%Y-%m-%d")
    raw_archive = char_raw / f"{today}_raw.png"
    # Save lossless-optimised PNG via Pillow (good enough; no extra dep).
    try:
        Image.open(io.BytesIO(raw)).save(raw_archive, optimize=True, compress_level=9)
        log(f"raw archive → {raw_archive}")
    except Exception as e:
        log(f"WARN: raw archive failed: {e}")

    sheet = Image.open(io.BytesIO(raw)).convert("RGBA")
    sheet = chroma_despill(sheet)
    cells = slice_3x3(sheet)

    BACKUP_DIR.mkdir(parents=True, exist_ok=True)
    written = []
    for pose, cell in zip(POSES, cells):
        out = OUT_DIR / f"{char_id}_{pose}.png"
        # Back up an existing live frame from EITHER the new openai_v2 or the
        # legacy spritecook bucket, whichever currently holds the live version.
        prev = None
        if out.exists():
            prev = out
        else:
            sc_prev = SPRITECOOK_DIR / f"{char_id}_{pose}.png"
            if sc_prev.exists():
                prev = sc_prev
        if prev is not None:
            backup = BACKUP_DIR / f"{char_id}_{pose}.png"
            try: backup.write_bytes(prev.read_bytes())
            except Exception: pass
        normalized = normalize_cell(cell)
        normalized.save(out, optimize=True)
        written.append(str(out))
        log(f"  → {out.name}")

    if not args.no_review_tag:
        append_review_entries(char_id, written, prompt)

    log("done.")


if __name__ == "__main__":
    main()
