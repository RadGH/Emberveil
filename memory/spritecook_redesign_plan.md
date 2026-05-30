# SpriteCook Character Redesign Plan

## Overview

Regenerate all 73 characters (20 heroes, 15 companions, ~38 enemies/bosses) using SpriteCook's `generate_game_art` MCP tool. Each character gets 7 poses from a single canonical portrait via `reference_asset_id`.

**Model:** `gemini-2.5-flash-image` (cheapest, 8 credits/generation)
**Cost per character:** 56 credits (7 poses × 8 credits)
**Total estimated cost:** ~4,088 credits
**Recommended tier:** Archmage ($56/mo, 7,000 credits) — covers full roster in 1 month with retries

## Asset manifest

All `asset_id` values are stored in:
`public/images/spritecook/spritecook-assets.json`

Always check this file before generating — reuse `reference_asset_id` from existing portraits.

## Poses per character (7 total)

| # | Pose | Filename | Notes |
|---|------|----------|-------|
| 1 | Portrait (canonical) | `{id}_portrait.png` | This becomes `reference_asset_id` for all others |
| 2 | South idle | `{id}_south.png` | Front-facing, arms relaxed |
| 3 | East idle | `{id}_east.png` | Side profile, standing |
| 4 | East attack | `{id}_east_attack.png` | Melee swing or magic blast depending on class |
| 5 | East spell | `{id}_east_spell.png` | Channeling/casting pose |
| 6 | East unconscious | `{id}_east_unconscious.png` | Fallen/collapsed on ground |
| 7 | East block | `{id}_east_block.png` | Defensive stance, shield up or arms crossed |

West-facing sprites are horizontal flips of east — no extra credits.
North-facing can be deferred or generated later if needed.

## Generation settings (all poses)

```
width: 256
height: 256
pixel: true
bg_mode: "transparent"
theme: "dark fantasy medieval"
style: "16-bit SNES RPG style, <character_palette> palette with <accent_color> accents"
model: "gemini-2.5-flash-image"
reference_asset_id: <portrait asset_id>  (except for portrait itself)
```

## Aesthetic & tone instructions

**ALWAYS include these in every prompt** to maintain cross-character consistency:

1. **Color palette descriptor in the `style` field.** Each character gets a dominant palette + accent color baked into the style string:
   - Oracle: `"cool-toned palette with cyan and gold accents"`
   - Paladin: `"warm gold and white palette with divine light accents"`
   - Necromancer: `"dark desaturated palette with sickly green accents"`
   - Pyromancer: `"warm orange and red palette with ember glow accents"`
   - etc. — match the palette to the character's elemental/class identity.

2. **Explicit material/color callouts in the prompt.** Don't just say "robes" — say "flowing white and ivory hooded robes." Don't just say "eyes" — say "glowing bright cyan eyes." The model drifts less when colors are named.

3. **Skin tone consistency.** Always include a skin descriptor: "warm peach skin tone," "pale ashen skin," "green-skinned," etc. Without this the model picks a random tone per pose.

4. **"clean transparent background, no background elements"** — append to every prompt. Reduces white-bg incidents on the pixel URL.

5. **Describe the portrait's key identifiers** (armor, hair, circlet, wings, etc.) in every follow-up pose prompt, not just the portrait. The `reference_asset_id` helps but explicit description reinforces consistency.

6. **For weapons/magic:** Be explicit about WHAT the character wields and HOW. "Swinging a glowing holy warhammer forward in aggressive overhead strike" beats "attacking with weapon." For casters, name the element and the visual: "glowing cyan magical energy orb in hand."

7. **For animals/creatures:** NEVER mention weapons. Describe natural attacks only: "lunging bite attack," "pouncing claw swipe," "breathing fire blast."

## Post-processing

1. Download pixel URL (preferred) or raw URL if pixel version is too small (check dimensions — if ≤64px, use raw)
2. Scale to 256×256 nearest-neighbor: `ffmpeg -y -i input.png -vf "scale=256:256:flags=neighbor" output.png`
3. If raw URL was used (RGB, no alpha): run background removal via sharp corner-pixel method:
   ```js
   node -e "const sharp=require('/tmp/img_opt/node_modules/sharp'); /* see bg removal script in session notes */"
   ```
   Tolerance=30 works well for white/near-white backgrounds.
4. Run `node optimize_images.js --dir public/images/spritecook/` (skips files <100KB)
5. Update `spritecook-assets.json` manifest
6. Update `public/news/re-redesign.html` with before/after card for the character

## Prompt templates

### HEROES (weapon/magic users)

**Portrait:**
```
{class_name} character portrait, {description}, dark fantasy RPG character, front-facing bust portrait
```

**South idle:**
```
{class_name} character full body sprite, south-facing idle stance, {description}, arms relaxed at sides, standing pose facing camera, dark fantasy RPG character sprite
```

**East idle:**
```
{class_name} character full body sprite, east-facing side view idle stance, {description}, standing in profile facing right, arms relaxed, dark fantasy RPG character sprite
```

**East attack (melee):**
```
{class_name} character full body sprite, east-facing attack pose, {description}, swinging {weapon} forward in aggressive strike, action pose leaning forward, dark fantasy RPG character sprite
```

**East attack (caster):**
```
{class_name} character full body sprite, east-facing attack pose, {description}, right hand extended forward casting {element} magic, glowing magical energy in hand, action pose, dark fantasy RPG character sprite
```

**East spell:**
```
{class_name} character full body sprite, east-facing spellcasting pose, {description}, both hands raised channeling a large glowing {element} magical aura, mystical energy around hands, powerful channeling stance, dark fantasy RPG character sprite
```

**East unconscious:**
```
{class_name} character full body sprite, east-facing fallen unconscious pose, {description}, collapsed on ground face down, defeated and limp, dark fantasy RPG character sprite
```

**East block:**
```
{class_name} character full body sprite, east-facing defensive block pose, {description}, {block_action}, braced defensive stance, dark fantasy RPG character sprite
```

### COMPANIONS (animals/creatures)

**Key rule:** NEVER mention weapons for animal companions. Describe natural attacks only.

**Portrait:**
```
{creature_name}, {description}, dark fantasy creature portrait, front-facing
```

**Attack:**
```
{creature_name} full body sprite, east-facing attack pose, {description}, {natural_attack}, aggressive action pose, dark fantasy RPG creature sprite
```

### ENEMIES / BOSSES

Same templates as heroes, adjusted for monster anatomy. For non-humanoid enemies, describe body shape explicitly.

## Character descriptions (constructive prompts)

These descriptions are intentionally generic enough that SpriteCook can fill in creative details while staying on-theme.

### Heroes (20)

| ID | Description | Weapon/Attack | Block Action |
|----|-------------|---------------|--------------|
| warrior | heavy plate armor, broad-shouldered, stern face, iron helm with visor | greatsword | raising heavy shield |
| fighter | chain mail armor, athletic build, battle-scarred, leather bracers | longsword and shield | shield raised high |
| ranger | green leather armor, hooded cloak, quiver on back, lean build | bow drawn with arrow | dodging sideways with cloak flowing |
| rogue | dark leather armor, masked face, twin daggers at belt, agile | dual daggers slashing | crossing daggers in X block |
| mage | blue robes with silver trim, pointed hat, ancient tome | arcane energy | magical barrier shield of light |
| paladin | white and gold plate armor, holy symbol on chest, cape | holy-infused warhammer | golden divine shield barrier |
| cleric | white robes with gold accents, prayer beads, gentle face | divine light beam | hands clasped in prayer ward |
| necromancer | tattered black robes, pale skin, skull staff, sunken eyes | dark necrotic energy | bone shield barrier |
| bard | colorful traveling clothes, lute on back, feathered cap | sound wave from instrument | melodic defensive ward |
| druid | nature-worn robes, antler crown, bark-textured staff | nature vine magic | thorny vine barrier |
| demon_hunter | dark red leather, crossbow, demon-bone trophies on belt | crossbow bolt with holy fire | demon-ward sigil barrier |
| tactician | military officer uniform, map scroll, strategic medals | command aura energy | tactical shield formation |
| chronomancer | shimmering time-distorted robes, clock motifs, hourglass staff | temporal distortion energy | time-freeze bubble |
| oracle | flowing white hooded robes, golden diadem circlet, glowing cyan eyes, wavy golden-brown hair | cyan magical energy orb | arms raised channeling protective vision |
| stormcaller | storm-grey armor with lightning motifs, crackling eyes | lightning bolt | wind barrier vortex |
| dragon_knight | dragon-scale armor, dragon helm, massive build | fire-wreathed greataxe | dragon-scale shield wall |
| swashbuckler | pirate-style coat, wide-brimmed hat, confident grin | rapier flourish | parrying with rapier |
| scavenger | patchwork leather, many pouches and belts, resourceful look | thrown knife or improvised weapon | ducking behind makeshift cover |
| pyromancer | fire-themed robes, ember-glowing eyes, flame-licked staff | fireball | flame curtain barrier |
| warlock | dark purple robes, demonic runes on skin, sinister aura | shadow bolt energy | dark magical ward |

### Companions (15)

| ID | Description | Natural Attack |
|----|-------------|---------------|
| war_dog | armored war hound, spiked collar, muscular | lunging bite attack |
| dire_wolf | massive grey wolf, glowing amber eyes | snapping jaw lunge |
| forest_owl | large tawny owl, spread wings, sharp talons | diving talon strike |
| ember_drake | small fire-breathing drake, scaled, bat-winged | breathing fire blast |
| shadow_cat | sleek black panther, glowing purple eyes | pouncing claw swipe |
| crystal_golem | translucent crystalline humanoid, glowing core | smashing crystal fist |
| spirit_wisp | ethereal floating orb of light, trailing wisps | energy pulse blast |
| bone_hound | skeletal dog, glowing eye sockets, exposed ribs | biting with skeletal jaw |
| ice_sprite | tiny frost fairy, icicle wings, blue glow | frost shard projectile |
| swamp_frog | oversized toad, mossy back, toxic markings | tongue lash attack |
| void_moth | large dark moth, void-purple wings, star patterns | wing dust burst |
| dragon_whelp | baby dragon, stubby wings, curious expression | small flame breath |
| storm_drake | electric-blue drake, crackling scales | lightning breath |
| corrupted_wolf | dark matted fur, red glowing eyes, shadow aura | shadow-infused bite |
| corrupted_bear | massive bear with dark corruption veins, red eyes | heavy claw slam |

### Enemies (~38)

Use the same template pattern. Key enemies:

| ID | Description |
|----|-------------|
| goblin_warrior | small green-skinned goblin in crude iron armor |
| goblin_scout | lean goblin with leather cap and shortbow |
| goblin_shaman | goblin in feathered robes with glowing staff |
| goblin_warlord | large armored goblin chief with battle standard |
| bandit | rough human in patched leather, scarred face |
| bandit_captain | bandit in studded leather with commanding presence |
| imp | small red-skinned demon, bat wings, mischievous |
| demon_brute | hulking red demon, horned, massive fists |
| cinder_hound | fire-wreathed wolf, magma dripping from jaws |
| molten_golem | lava-rock humanoid, glowing cracks, massive |
| lava_titan | enormous magma giant, volcanic shoulder vents |
| ash_wraith | ghostly smoke figure, ember-glowing eyes |
| void_wraith | dark spectral being, tattered shadow cloak |
| void_shade | wispy shadow entity, barely corporeal |
| void_prophet | robed void cultist, glowing void sigils |
| veil_cultist | hooded cultist, purple robes, ritual dagger |
| veil_sorcerer | elite cultist, powerful magical aura |
| veil_warden | armored veil guardian, tower shield |
| giant_spider | massive arachnid, venomous fangs, hairy |
| frost_wyrm | ice dragon, crystalline scales, frost breath |
| frost_wyrmling | young ice dragon, smaller, icy blue |
| wyrm_warrior | dragonborn warrior in scale armor |
| dragon_cultist | dragon-worshipping cultist, dragon tattoos |
| dragon_hatchling | newly hatched dragon, small and fierce |
| storm_dragon | adult lightning dragon, crackling scales |
| dragon_king | ancient dragon, massive, crown of horns |
| abyssal_knight | dark armor consumed by void energy |
| hell_knight | demon in full infernal plate armor |
| star_horror | cosmic aberration, tentacles, many eyes |
| reality_shard | geometric crystal entity, reality-warping |
| primordial_elemental | raw elemental force, shifting elements |
| cosmic_titan | planet-scale entity, star-studded body |
| grax_veil_touched | named NPC boss, veil-corrupted warrior |
| archfiend_malgrath | named demon lord boss, massive horned |
| the_architect | named final boss, reality-manipulating entity |
| the_unraveler | named void boss, reality-tearing presence |
| emberveil_sovereign | ultimate boss, fusion of ember and void |
| genesis_worm | enormous primordial worm, cosmic devourer |

## Batch workflow

1. Pick a category (heroes first, then companions, then enemies)
2. For each character:
   a. Generate portrait (no reference) → save asset_id to manifest
   b. Generate 6 poses with reference_asset_id = portrait asset_id
   c. Download all, scale to 256×256, save to `public/images/spritecook/`
   d. Update manifest
3. After a full category, review results and retry any bad generations
4. When ready to swap into game: copy from `spritecook/` to `sprites/` and `portraits/`

## Notes

- Free tier: 40 credits/month, 1 concurrent job (5 characters max)
- If pixel URL returns tiny image (smart crop issue), use raw URL instead and scale manually
- The east_spell raw URL worked at 1024×1024 when pixel was 16×16 — always check pixel dimensions
- Oracle test used 40 credits for 5 poses (portrait + south + east + attack + spell). Unconscious and block need more credits.
