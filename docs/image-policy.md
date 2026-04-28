## Image Policy

Canonical definitions for every image type in Emberveil. This file is authoritative — update it when the rules change, and keep `image-review-manifest.json` in sync.

### Rigid asset-type definitions

#### Character art (heroes, companions, bosses, enemies — same spec)

Every character has **7 frames**:

| Pose         | Purpose                               | Size     |
|--------------|---------------------------------------|----------|
| `portrait`   | Menus, party UI, dialogs              | 256×256  |
| `south`      | Map view, idle                        | 256×256  |
| `east`       | Combat idle (facing enemies)          | 256×256  |
| `east_attack`| Combat attack frame                   | 256×256  |
| `east_spell` | Combat spell/cast frame               | 256×256  |
| `east_block` | Combat block/defend frame             | 256×256  |
| `east_ko`    | Combat KO / unconscious frame         | 256×256  |

File naming: `{character_id}_{pose}.png` under `public/images/spritecook/`.

**No animations.** The 7 frames above are the complete canonical set. Do NOT generate walk-cycle webm/webp/gif animations, attack-cycle animations, or any multi-frame animated output. Each of the 7 frames is a single static PNG. Animation in-game is achieved by swapping between these static frames in code — never by rendering animated media files. `animate_game_art` / similar MCP calls are off-limits unless the user explicitly asks for an animated asset.

There is no `north` or `west` direction. Legacy `_north`/`_west` assets are not rendered; treat them as archived.

##### 🛑 RIGID SpriteCook download contract (added 2026-04-21 after M198 incident)

When generating character frames via SpriteCook MCP, the download step is the most common place for silent corruption. The rules below are non-negotiable; treat a violation as a user-review flag, never as a workaround opportunity.

1. **Generation args** — `generate_game_art` must be called with: `pixel=true`, `bg_mode="transparent"`, `width=256`, `height=256`, `model="gemini-3.1-flash-image-preview"`. Pass `reference_asset_id` for style-lock.
2. **Endpoint** — when fetching the PNG, ALWAYS use the `pixel_url` field from `get_asset_metadata` (`/signed-content/pixel`). **NEVER** use `raw_url` (`/signed-content/raw`). `/pixel` returns a 200×200 RGBA PNG with alpha preserved. `/raw` returns the 1024×1024 Gemini output with a solid white background and no alpha channel. Downloading from `/raw` is indistinguishable at the URL level — this is the bug that shipped in M198.
3. **Post-download validation** — every PNG written to disk must pass all three checks:
   - Size is exactly 200×200
   - Mode is RGBA (or P with a tRNS chunk — PIL's `img.convert("RGBA")` makes the check mode-agnostic)
   - At least one of the four corners has alpha == 0 (proves transparency was preserved)
4. **On validation failure** — do NOT write the file, do NOT attempt background removal, do NOT retry against a different endpoint, do NOT crop/pad to force compliance. Stop the pipeline, list the failed asset IDs, and ask the user how to proceed (regenerate with different `smart_crop_mode`, adjust the prompt, or accept the non-standard size).
5. **Background removal is banned.** If a frame has a white background, the frame is wrong; regenerate it, do not post-process it. (Prior bg-removal work on warlock_east_spell is the one exception that already shipped.)
6. **Reference implementation** — `/tmp/wire_m198_fix.py` (M198 recovery). Use this as the template for any future bulk wire script.

#### Background art (combat zones)

- **Size:** 1536×1024.
- **Composition:** atmospheric environment. The **midground must be empty** — a focal area where combat takes place with room for sprites. No fake UI, no borders, no HUD elements baked into the image.
- **Reference:** `public/images/menu_bg/menu_wide.jpg` is the composition bar.
- **Mobile:** generate a square thumbnail crop per image (center crop, stored alongside as `*_thumb.jpg`).
- **Prompt template:** see `/docs/prompt-templates.md#combat-background`.

#### Map art (zones)

- **Size:** 1536×1024 (same as backgrounds).
- **Composition:** no midground requirement. Pure atmosphere — jungle, mountains, volcano, cosmic void. Does not need to represent node layout; it's texture for the zone feel.

#### Tap Weapon / Tap Equipment icons

- **Icon:** the item icon itself (small, square, transparent bg preferred).
- **Effect artwork:** any projectile, explosion, splash, or VFX frame the weapon uses in combat. One file per effect frame.
- Indexed in image-review under category `tap-weapons`.

### Framing & Scale Policy (character art)

Every character frame — **reference, portrait, south, east, east_attack, east_spell, east_block, east_ko** — must obey these rules. They are enforced in the SpriteCook prompt via `GLOBAL_ANCHORS` + per-pose `framing()` in `scripts/pixellab/rewrite-prompts.cjs`. If a generated frame violates framing, **re-run** — do not accept cropped feet or tops of heads; they cascade into every downstream pose because the reference is the style anchor.

#### Full-body poses (reference, south, east, east_attack, east_spell, east_block, east_ko)

- **FULL-BODY, head-to-toe.** The entire figure fits inside the 256×256 canvas.
- **Feet** ~6–8% above the bottom edge, fully visible, NEVER cropped.
- **Head** ~6–8% headroom above the hair, NEVER cropped.
- **Figure height** ~85–90% of canvas height, centered horizontally.
- **Weapon overhang** is allowed laterally and above, but body (feet→head) stays inside the canvas.

**Canonical sizing reference (adopted M217):** `public/images/spritecook/sorcerer_east_spell.png` is the exemplar for how large and detailed a full-body character frame should read. New generation prompts should explicitly cite "match the generous full-body framing of sorcerer_male east_spell" so the model targets this scale. Frames that come back noticeably smaller or with lots of empty canvas should be flagged and regenerated.

#### Portrait pose (portrait only)

- **Head-and-shoulders bust shot** from mid-chest upward, three-quarter view.
- Head fills the upper half of the canvas; shoulders fill the lower half.
- ~5% headroom above the hair. Face must be clearly readable.

#### Cross-roster scale consistency

A standard adult human is **180 cm tall in-world** and must render at the **same relative pixel height** as every other adult humanoid in the set. Fighter, Knight, Paladin, Rogue, Cleric, Mage, Swashbuckler, etc all read at the same size in their respective full-body frames. The only permitted variance is small natural adult build differences (slender vs broad) — never scale differences.

This is how we avoid the M58–M64 bug where one class looked like a bobblehead and another looked like an old man: both were hitting the model with different implicit framing cues. Keep the anchors in sync with every new class.

#### Head-to-body ratio

Realistic adult: head ≈ 1/7 to 1/8 of total body height. Chibi, bobblehead, and child-bodied proportions are banned via the GLOBAL_ANCHORS negative list.

### Image generation workflow

1. **Reference image required.** Every generation must pass a reference asset_id (for characters, the portrait; for a new character, pick the closest stylistic match). This keeps art cohesive.
2. **Visual descriptor in the prompt.** Always include tone, color palette, and mood — not just pose. SpriteCook needs this to lock style across frames.
3. **Animation frames refer to the reference frame.** When generating east_attack from east, explicitly say "same character as reference, same outfit, same palette" — otherwise drift.
4. **Register immediately.** Any image added to `public/images/` MUST be entered in `public/assets/image-review-manifest.json` in the same change. Missing entries are a bug, not a deferral.

### Background removal flexibility

For spritecook outputs with multi-color backgrounds, plain color-key removal fails. Use tolerance-based sampling (corner pixel samples with Euclidean distance threshold) rather than exact match.

### See also

- `/docs/prompt-templates.md` — canonical prompt templates for each category
- `/docs/asset-types.md` — full list of registered character IDs and their canonical pose coverage
