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
