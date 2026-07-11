# OpenAI 3×3 Sprite-Sheet Generation Workflow

Repeatable workflow for generating character sprite sheets via OpenAI's
image gen API and post-processing them into the 9 individual canvas
frames the game expects. **Use this whenever the user asks for a sprite
sheet via OpenAI** (existing characters: pull the canonical reference;
new characters: no reference needed but follow the same layout +
post-process).

## Where this lives (file map) — M463 layout

- **Workflow doc**: `game13/memory/openai-sprite-sheet-workflow.md`
  *(this file)*
- **Generator script**: `game13/scripts/openai-spritesheet-gen.py`
  *(edit this when you need to change prompts, chroma params, or output
  paths)*
- **Output bucket (M463)**: `game13/public/images/openai_v2/`
  *(OpenAI-generated sprites live here, not `spritecook/`. The
  appearances-manifest builder scans this dir FIRST, so any frame here
  supersedes the same name under `spritecook/`. Backups of replaced files
  go to `openai_v2/_pre_openai/`.)*
- **Reference template (current, M463)**:
  `game13/public/assets/openai_v2/reference.png`
  *(canonical "current" reference — the script auto-picks this. Replace
  in place to swap. Also keep dated archive copies as
  `reference_YYYY-MM-DD.png` next to it. Falls back to
  `/home/radgh/claude/assets/references/emberveil/images/sprite-sheet-templates/knight-9pose-reference-2.png`
  then `knight-9pose-reference.png` if the local copy is missing.)*
- **Raw sheet archive (M463)**: `game13/public/assets/openai_v2/raw/<id>/<YYYY-MM-DD>_raw.png`
  *(unsliced 1024×1024 OpenAI output, lossless-PNG. Lets us re-process
  with new chroma/despill params later without spending another API
  call. Skipped by image optimizers via timestamp/hash.)*
- **Sidecar manifest**:
  `game13/public/assets/data/image-review-v2-openai-sidecar.json`
  *(persists openai-9pose entries across rebuilds; merged into
  `image-review-v2.json` by `scripts/build-image-review-v2.cjs` each
  release.)*
- **API key**: `/home/radgh/claude/assets/references/openai-api-key.txt`

### Reference image policy

When the user says "new reference image at &lt;path&gt;":
1. Copy to `public/assets/openai_v2/reference.png` (overwrite — current).
2. Copy to `public/assets/openai_v2/reference_YYYY-MM-DD.png` (today, archive).
3. The script picks up `reference.png` automatically — no code change.

### Originals preservation (M463)

Every regen call backs up the live frame (whether it lived in `openai_v2/`
OR `spritecook/`) into `openai_v2/_pre_openai/<id>_<pose>.png` BEFORE
overwrite, and the open-batch entry's `old` path points there. Lets
image-review-v2's "Original vs Candidate" comparison actually show the
prior art.

### Chroma fallback (M463)

`chroma_despill()` does a primary `#00FF00` key, then a fallback that
samples the top-left pixel and keys *that* colour too if it's still opaque.
Catches the case where OpenAI ignores the green-background instruction and
ships a pale-blue/grey backdrop (ash_wraith, bandit on the M458 batch).

## Inputs

1. **Character id** (e.g. `frost_wyrmling`)
2. **Existing south-frame path** (the ground-truth design reference) —
   normally `public/images/sprites/<id>_south.png` or
   `public/images/spritecook/<id>_south.png`. The script auto-discovers.
3. **Character description** — pulled from the project: TownScreen.js
   companion entries, `M304_DIALOG_NODES`, `randomEvents.js`, or
   `art_direction/<id>.json`. **Never invent prompt text** — the
   reference image + the existing description are the source of truth.

## Layout (canonical 3×3 grid, rows top-to-bottom)

```
Row 1:  Portrait               | South               | East
Row 2:  East Attack            | East Spell          | East Block
Row 3:  East KO                | East Cheer          | East Wound
```

The reference template in the path above defines the structural layout
ONLY — cell ordering, framing, character size relative to the cell.

**Important:** the model is told to copy the *layout and framing* of the
reference, NOT the reference character's weapons/spells/equipment. The
new character's actions are described separately (see below).

## Per-character action descriptors (non-negotiable)

The frost-wyrmling result on the first run copied the knight's holy
starburst spell verbatim, and held a shield. Both came from the model
mimicking the reference. Fix: every prompt now includes explicit attack /
spell / block descriptions tailored to the character.

### Attack
- **Humanoid**: swing the held weapon described in the desc (sword, bow,
  staff, etc.). Monks / unarmed builds → bare-fist or kick.
- **Beast / dragon / wolf**: claw + bite + tail. NO held weapon.
- **Elemental / spirit / wisp**: focused energy strike from its core.
- **Construct / golem / turret**: built-in arm or weapon attachment.

### Spell — colour + flavour MUST match the character's archetype
| Archetype | Spell flavour |
|---|---|
| Cleric / Priest / Paladin / Holy | Yellow-gold radiant healing aura |
| Warlock / Necromancer / Shadow | Deep purple-black shadow tendril or skull motif |
| Rogue / Poison / Assassin | Sickly green poison/toxin cloud |
| Mage / Arcane / Sorcerer / Wizard | Swirling cyan arcane sigil |
| Pyromancer / Fire | Vivid orange-red fireball |
| Frost / Ice / Cryo | Pale blue-white frost cone (BREATH for dragons) |
| Storm / Thunder / Lightning | Crackling yellow-white lightning bolt |
| Druid / Nature | Glowing green vines / leaves spiraling |
| Shaman / Spirit | Ghostly blue-green spirit wisps |
| Oracle / Fate | Silver-white fate sigils |
| Bard / Song | Glowing musical notes / pink-purple sound waves |
| Chronomancer / Time | Pale blue clock-face rotating around hand |
| Runesmith / Forge | Glowing orange runes carved in air |
| Dragon Knight | Draconic energy in family element |

The script's `default_spell()` function picks one of these based on the
character id + description. Override per-character with `--spell "..."`.

**Hard rule for non-humanoids**: spells manifest from the body
(mouth/horns/core), NEVER from a held wand/staff. Frost wyrmling does NOT
use a wand to cast — it BREATHES the frost cone.

### Block
- **Has shield/buckler/aegis in description** → raise the shield to parry
- **Has staff/wand** → hold horizontally to deflect
- **Has bow/crossbow** → twist away with weapon held horizontally
- **Monk / unarmed** → high martial-arts guard, both bare hands raised
- **Beast** → rear back / raise wing or forelimbs / claws. NO held shield.
- **Elemental** → condense into defensive shape; magical wards bloom.
- **Construct** → brace frame; built-in plating absorbs the blow.
- **Default humanoid** → parry with the held weapon raised crosswise.

## Equipment hard rule (non-humanoids)

| Kind | Held weapon? | Held shield? | How spells manifest |
|---|---|---|---|
| Humanoid | per description | per description | from hand / weapon |
| Beast / dragon | **NEVER** | **NEVER** | from mouth / body / horns |
| Elemental / spirit | **NEVER** | **NEVER** | from core / form |
| Construct | built-in only | built-in only | built-in projector |

The script auto-classifies via `auto_kind()`. Override with `--kind beast`
etc. when needed.

## Background + chroma keying

- Prompt: *"Solid green background, exactly #00FF00. Character fills its
  cell consistently across all 9 poses with no shadow/halo bleed into
  the green."*
- After generation:
  1. **Chroma key** — remove all pixels within `tolerance: 64` of
     `#00FF00` (RGB Euclidean). User-confirmed param ("not feather, this
     is **tolerance**"). Tune later if results are over- or under-keyed.
  2. **Despill** — desaturate any green tint in remaining pixels with
     `radius: 10` Gaussian alpha-feather.
  3. **Trim** to bounding box per cell, then center-pad to the canonical
     256×256 frame the game expects.
  4. Save as PNG with Pillow's `optimize=True`.

## Output paths

- Per-pose frames (M463 location):
  `public/images/openai_v2/<id>_<pose>.png` where pose ∈
  `{portrait, south, east, east_attack, east_spell, east_block, east_ko,
  east_cheer, east_wound}`.
- Backups of any pre-existing files (from EITHER bucket) →
  `public/images/openai_v2/_pre_openai/<id>_<pose>.png`
- Raw 1024×1024 sheet kept at
  `public/images/openai_v2/<id>_openai_sheet.png` (working copy) and
  `public/assets/openai_v2/raw/<id>/<YYYY-MM-DD>_raw.png` (dated archive).
- Review entries → `public/assets/data/image-review-v2-openai-sidecar.json`
  with full prompt text, merged into `image-review-v2.json` on the next
  release by `scripts/build-image-review-v2.cjs`. The image-review-v2
  page renders these next to the existing SpriteCook / PixelLab versions
  for side-by-side comparison.

## Running it

```bash
cd /home/radgh/claude/game13

# All defaults (auto-detect kind, attack, spell, block, description):
python3 scripts/openai-spritesheet-gen.py frost_wyrmling

# Override individual fields:
python3 scripts/openai-spritesheet-gen.py frost_wyrmling \
  --kind beast \
  --spell "exhaling a wide pale-blue frost cone from the mouth, crystals forming in the air" \
  --attack "lunging with bared fangs and claws extended" \
  --block "rearing back with wings flared as a natural shield"

# Dry-run (no API call, prints the prompt that would be sent):
python3 scripts/openai-spritesheet-gen.py frost_wyrmling --dry-run
```

## When to use this workflow vs SpriteCook

- **OpenAI 9-pose**: experimental but cheaper per character (one API call
  for 9 poses). Best for non-humanoid creatures whose appearance is
  hard to template-match in SpriteCook. Use when the user explicitly
  asks for "openai" or "9-pose" sprite gen.
- **SpriteCook MCP**: the established workflow. Per-pose generation,
  consistent palette, established `art_direction` prompts. Default for
  everything else.

## Trust protocol

**Never trust OpenAI blindly.** It needs:
- Reference template (always, both v1/v2 layout)
- Existing south-frame (when an existing character is being regenerated)
- Explicit attack / spell / block descriptions (Claude picks these per
  character; never let OpenAI guess)
- Equipment hard rule for non-humanoids

After generation, every result is tagged for human review on the Image
Review V2 page (`/assets/image-review-v2.html`) before it becomes
canonical. The full prompt is stored in the sidecar so the user can
audit *what* OpenAI was told for each frame.

## When the user asks me to swap the reference template

- The script's `TEMPLATE_PRIMARY` constant points to
  `knight-9pose-reference-2.png`. To use a third version, either:
  - Replace `knight-9pose-reference-2.png` in place (script auto-picks
    it up, no code change), or
  - Add a `TEMPLATE_v3` and bump `TEMPLATE_PRIMARY` in
    `openai-spritesheet-gen.py`.
- Keep older versions on disk for reference comparison.
