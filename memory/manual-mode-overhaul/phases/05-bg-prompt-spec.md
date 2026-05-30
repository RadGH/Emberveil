# Phase 05 — Background Art Prompt Direction

**Author:** api-documenter agent  
**Date:** 2026-04-29  
**Scope:** OpenAI image generation spec for per-act combat backgrounds, 80/20 ground/atmosphere split, with proof-of-concept perspective-grid mockup.

---

## 1. The 80/20 Rule — Visual Breakdown

Combat backgrounds are dual-zone compositions serving the 2.5D tile grid overlay:

```
┌─────────────────────────────────────────────────┐
│                                                 │  
│          UPPER 20% — ATMOSPHERE ZONE            │  
│  Sky, distant terrain, vaulted ceiling, or     │  
│  narrative detail. Rich detail that sets biome │  
│  mood but does NOT occlude sprite silhouettes. │  
│                                                 │  
├─────────────────────────────────────────────────┤  
│                                                 │  
│          LOWER 80% — PLAYFIELD ZONE            │  
│  Stone tiles, ground surface, grout lines.     │  
│  This is where sprites land. Must feel solid,  │  
│  readable, and NOT cluttered with foreground   │  
│  obstacles that sprites would collide with.    │  
│                                                 │  
│  Subtle props allowed (rubble edges, small     │  
│  bones) but NOT floating debris or central     │  
│  obstructions.                                 │  
│                                                 │  
└─────────────────────────────────────────────────┘
```

**Why this split:**
- The lower 80% is the actual play surface — sprites stand on it, cast spells above it, take damage on it. It must read as solid stone or ground.
- The upper 20% sells the biome's narrative and mood (hellfire, ice, nature, void) without competing with combat action. It's atmosphere, not furniture.
- When the 2.5D perspective grid overlays this, the tiles on the lower 80% align with the actual play area; the upper 20% recedes properly behind the vanishing point.

---

## 2. Universal Prompt Skeleton

Every per-act background uses this template. All `{placeholders}` are filled per-act (see §3).

```
A {biome} dungeon interior rendered in cinematic dark fantasy style, 
pixel-art inspired 2D perspective. The floor is composed of {ground_texture} 
stone tiles arranged in a 2.5D isometric grid, descending toward the vanishing 
point. The tiles show {grout_detail}. 

LOWER 80% — Playfield: {ground_props}. The ground surface is {ground_lighting}. 
Small props like {small_props_allowed} are scattered subtly; NO central foreground 
obstacles, NO floating debris, NO oversized statuary blocking the midground.

UPPER 20% — Atmosphere: {atmospheric_detail}. The ceiling/sky/void above shows 
{top_detail}. A subtle vignette darkens the outer edges.

Color palette anchors: {primary_color_hex}, {secondary_color_hex}, {accent_color_hex}. 
No characters, no UI, no watermarks, no text overlays.
```

**Token reference** (from phase 00 palette):
- `--ember-void: #06030e` — outer vignette / deepest shadow
- `--ember-deep: #0d0820` — card surface / mid-shadow
- `--ember-pit: #1a1128` — tile shadow / grout
- `--ember-stone: #2e2438` — mid-value tile face
- `--ember-slate: #3d3250` — lit tile highlight
- `--gold-rim: #c8a020` — warm accent (torch light, rune glow)
- `--fire-core: #ff7020` / `--fire-bloom: #ffc040` — fire/heat
- `--arc-blue: #40a8ff` / `--arc-pale: #a0d8ff` — arcane/ice
- `--hp-green: #30cc60` — life/nature
- `--shield-blue: #4080e0` — void/curse

---

## 3. Per-Act Prompt Fills

| Act | Biome | Ground Texture | Lighting | Small Props | Atmospheric Detail | Color Anchors |
|-----|-------|-----------------|----------|-------------|-------------------|----------------|
| **1** | Border Roads — rolling grassland / stone outpost | weathered flagstone with moss patches, clay dirt between tiles | amber candlelight from scattered torches, cool blue moonlight from upper-left | scattered small bones, broken pottery shards, tufts of dead grass | distant rolling hills silhouetted against a twilight orange sky; faint torch glow on distant structures; 2-3 moonlit clouds | `#2e2438` (stone), `#c8a020` (torch amber), `#1a1128` (shadow) |
| **2** | Ashen Wastes — burnt volcanic plain / collapsed ruin | cracked volcanic rock, ash drifts, heat-fractured dark stone tiles | dull red ember glow from cracks in the rock, deep shadows from volcanic spires | half-buried stone blocks, ash piles at tile corners, sparse bleached bones | billowing ash clouds high above, volcanic spires jutting into a smoke-filled red sky, faint lava flow glow at the horizon | `#ff7020` (lava), `#06030e` (ash black), `#3d3250` (hot stone) |
| **3** | Shattered Hell — fractured obsidian cavern / chaos scar | jagged obsidian shards forming a broken floor, thin cracks bleeding purple necrotic light | sickly purple glow from cracks, deep blues in the deepest shadows, NO warm light | obsidian splinters, cracked geode clusters at tile edges, thin trails of void-dust | a fractured ceiling with crystalline formations, purple necrotic wisps coiling in the upper void, distant impossible geometry | `#40a8ff` (void blue), `#a0d8ff` (void fringe), `#06030e` (deep void) |
| **4** | Cosmic Rift — abyssal breach / reality tear | shattered marble and cosmic fragments forming tessellated tiles, torn fabric of reality | ethereal white/blue star-light filtering through rifts, sharp shadows, cold color cast | drifting cosmic debris (small), crystalline shards, thin lines of caustic light pooling on tiles | the sky/void above shows tearing reality edges, distant stars, cosmic nebulae, writhing tentacles or anomalies at the horizon; NO oversized creatures | `#a0d8ff` (cosmic light), `#4080e0` (rift blue), `#06030e` (void edge) |
| **5** | Primordial Nexus — ancient temple flooded with liquid energy | ornate stone tiles encrusted with glowing rune-work, fluid-mirror surface reflective in places | searing golden/white radiance from glowing runes, chromatic iridescence, cold reflection on wet surfaces | crystalline formations sprouting from tile edges, rune-carved blocks, ripples frozen in liquid light | towering ancient columns rising into infinity, radiant energy cascading from above, reality distortion at the horizon, ancient symbols glowing in the upper void | `#f8e890` (golden glow), `#40a8ff` (energy blue), `#c8a020` (rune amber) |
| **6** | Dragon Expansion — dragon's hoard chamber / obsidian den | polished black obsidian tiles arranged in a ritual pattern, gold inlay forming geometric designs | reflected firelight from a distant hoard, warm orange glow, dramatic side-lighting | scattered coins and gems at tile edges (NO pile blocks midground), ancient statuettes, obsidian spikes | a vast vaulted ceiling soaring overhead, piles of gold visible in the distance (upper-left/right), warm reflection on the obsidian floor, a faint draconic silhouette shadow implied but NOT rendered as a full character | `#c8a020` (gold), `#ff7020` (firelight), `#06030e` (deep void) |

**Row interpretation rules:**
- **Biome:** narrative context for the act (e.g. "Act 2 Ashen Wastes — volcanic plain aftermath").
- **Ground Texture:** the literal surface the tiles are made of.
- **Lighting:** dominant light source + color cast. This is the key to making each act feel distinct.
- **Small Props:** ONLY thin, edge-aligned, or corner-based details. NO center-of-tile furniture.
- **Atmospheric Detail:** upper 20% content. Distant, layered, and non-occluding.
- **Color Anchors:** 3-4 hex values from the palette tokens that dominate this act's mood.

---

## 4. Negative Prompt (Forbidden Elements)

Every generation request includes these to prevent common errors:

```
Avoid: floating debris in the lower 80%, central foreground statuary or urns 
that block movement, oversized character figures or monsters rendered as part 
of the background, off-screen text or watermarks, UI borders or HUD elements, 
perspective that does NOT converge to upper-center vanishing point, tile grid 
that is too regular or obviously computer-generated, water reflections that 
distract from the playfield, or any element that reads as foreground at the 
midplane where sprites would stand.
```

The goal: a background that reads as a painted environment, not a game screenshot.

---

## 5. Resolution, Endpoint, and Delivery

| Field | Value | Notes |
|-------|-------|-------|
| **Resolution** | 1536×1024 | Landscape, 16:10 aspect. Matches the reference design (phase 00, image dimensions). |
| **Endpoint** | OpenAI `gpt-image-2` | Fall back to `gpt-image-1.5`, then `gpt-image-1` if gpt-image-2 unavailable. |
| **Fallback rationale** | gpt-image-2 > gpt-image-1.5 > gpt-image-1 | gpt-image-2 is best at large atmospheric compositions; honors 16:10; fast. |
| **Tool, NOT SpriteCook** | OpenAI API direct call | SpriteCook is for pixel-art characters (256×256, `pixel=true`). Backgrounds are painterly JPGs generated via OpenAI, not sprites. |
| **Output format** | JPEG | Store as `.jpg` in `public/images/map_bg/` with filename pattern `act-N-biome.jpg` (e.g. `act-1-border-roads.jpg`). |
| **Mobile thumbnail** | Center crop, square, 512×512 | Generate from the same JPEG; store as `act-N-biome_thumb.jpg`. |

**Cost estimate:**
- 6 acts × 1 base image per act = 6 API calls.
- OpenAI image generation is typically ~$0.04/image for 1536×1024 at the standard quality tier.
- **Budget:** ~$0.24 (six images). Assume success on first generation; re-rolls will be needed if composition or 80/20 split is wrong.

---

## 6. Per-Act Regen Plan and Archive Strategy

**Goal:** Replace all existing map backgrounds with new per-act versions, archiving originals for rollback.

### Order of Operations

Regenerate **backwards** from Act 6 to Act 1. Act 6 (Dragon Chamber) has the smallest conceptual surface area and is most likely to converge quickly. Acts 1-2 are largest and most complex, so do them last.

1. **Act 6 — Dragon Expansion** (smallest scope, highest confidence).
2. **Act 5 — Primordial Nexus** (high fantasy, unique lighting).
3. **Act 4 — Cosmic Rift** (abstract, fewer ground-detail constraints).
4. **Act 3 — Shattered Hell** (harsh purple, demanding but achievable).
5. **Act 2 — Ashen Wastes** (fire effects, volcanic detail).
6. **Act 1 — Border Roads** (naturalistic, largest play area, final).

### Directory and Naming

**Current state** (pre-regen):
```
public/images/map_bg/
  └── [existing background files, if any]
```

**Archive strategy:**
```bash
mkdir -p public/images/map_bg/_archived-2026-04-29/
mv public/images/map_bg/*.jpg public/images/map_bg/_archived-2026-04-29/
mv public/images/map_bg/*_thumb.jpg public/images/map_bg/_archived-2026-04-29/ \
  || true  # no-op if thumbs don't exist yet
```

**New files post-regen:**
```
public/images/map_bg/
  ├── act-1-border-roads.jpg
  ├── act-1-border-roads_thumb.jpg
  ├── act-2-ashen-wastes.jpg
  ├── act-2-ashen-wastes_thumb.jpg
  ├── act-3-shattered-hell.jpg
  ├── act-3-shattered-hell_thumb.jpg
  ├── act-4-cosmic-rift.jpg
  ├── act-4-cosmic-rift_thumb.jpg
  ├── act-5-primordial-nexus.jpg
  ├── act-5-primordial-nexus_thumb.jpg
  ├── act-6-dragon-expansion.jpg
  ├── act-6-dragon-expansion_thumb.jpg
  └── _archived-2026-04-29/
      └── [old files]
```

**Concrete bash command pattern** (run after each successful generation):

```bash
# After downloading act-6 image as act-6-dragon-expansion.jpg:
mkdir -p /home/radgh/claude/game13/public/images/map_bg/_archived-$(date +%Y-%m-%d)
# Move old files (if any exist)
find /home/radgh/claude/game13/public/images/map_bg -maxdepth 1 -name '*.jpg' \
  -exec mv {} /home/radgh/claude/game13/public/images/map_bg/_archived-$(date +%Y-%m-%d)/ \;
# Copy new file into place
cp act-6-dragon-expansion.jpg /home/radgh/claude/game13/public/images/map_bg/
# Generate thumbnail (center crop to 512×512)
ffmpeg -i /home/radgh/claude/game13/public/images/map_bg/act-6-dragon-expansion.jpg \
  -vf "crop=min(w\\,h):min(w\\,h):(w-min(w\\,h))/2:(h-min(w\\,h))/2,scale=512:512" \
  /home/radgh/claude/game13/public/images/map_bg/act-6-dragon-expansion_thumb.jpg
```

### Catalog Entry (per image)

After generating, add to `public/assets/assets.json` immediately:

```json
{
  "id": "combat_bg_act_6_dragon",
  "name": "Combat Background — Act 6 Dragon Expansion",
  "category": "background",
  "source": "openai",
  "file": "../images/map_bg/act-6-dragon-expansion.jpg",
  "prompt": "[full prompt used, from §3 filled template]",
  "notes": "M### regen: per-act background art per manual-mode overhaul spec (phase 05)."
}
```

---

## 7. Acceptance Checklist

Every generated background must pass **all 8 checks** before shipping:

- [ ] **Composition ratio:** Lower 80% reads as clear play surface (stone/ground). Upper 20% is distinct atmosphere/sky.
- [ ] **Perspective:** Tile grid concept is visible (even if subtle) — lines converge toward upper-center vanishing point.
- [ ] **Biome accuracy:** Acts match their prompt fills (e.g. Act 2 feels volcanic/ashen; Act 4 feels cosmic/void).
- [ ] **Lighting clarity:** Light source is obvious and consistent. Act 1 is warm (torches/moon). Act 3 is cool (void-purple). Etc.
- [ ] **Midground empty:** No central statuary, floating objects, or large props blocking sprite placement. Edges and corners only.
- [ ] **No characters:** No human figures, monsters, or creatures rendered as part of the background.
- [ ] **No UI:** No borders, HUD elements, text, or watermarks visible anywhere.
- [ ] **Color palette:** Dominant colors match the palette tokens from phase 00. Hex anchors are recognizable in the image.

If any check fails, **do not ship**. Flag the issue, regenerate with adjusted prompt, and re-evaluate.

---

## 8. Cost / Call Estimate

- **Calls per act:** 1 (6 acts total = 6 calls).
- **Cost per call:** ~$0.04 (OpenAI 1536×1024 standard quality).
- **Estimated total:** ~$0.24 (assumes success on first pass).
- **Re-roll budget:** +$0.24–$0.48 for fixes if composition needs adjustment.
- **Assumption:** We hit the target 80/20 split on first pass for most acts. Acts 1–2 may need re-rolls due to naturalistic complexity.

---

## 9a. Universal negative-prompt amendment (post Act-1 review)

**Added 2026-04-30** after the first Act 1 generation showed strong stone-wall
framing on both lateral edges that ate ~12-15% of horizontal width per side
(see `assets/backgrounds/act-1-review.md`). The "no architectural framing"
rule is now part of the universal negative-prompt block on every act:

```
NEGATIVE: no architectural framing on the left or right edges of the image —
the ground/playfield must extend fully to the lateral image edges. No stone
walls, no archways, no pillars, no tree lines, and no decorative side
borders that constrain the playable width. Detail belongs in the upper 20%
horizon band, not in the lateral foreground.
```

Every existing prompt in the queue below has been updated to include this
clause. Phase 4's grid was also tightened from 8 → 6 columns to belt-and-
braces against the framing problem on a future regen.

---

## 9. Generation Queue

Below are the **literal full prompts** ready to paste into the OpenAI API for each act. Each prompt uses the universal skeleton (§2) filled with the per-act placeholders (§3).

### Act 1 — Border Roads

```
A Border Roads dungeon interior rendered in cinematic dark fantasy style, 
pixel-art inspired 2D perspective. The floor is composed of weathered flagstone 
with moss patches and clay dirt between tiles, arranged in a 2.5D isometric grid, 
descending toward the vanishing point. The tiles show subtle grout lines and 
age-worn edges.

LOWER 80% — Playfield: The ground surface shows amber candlelight from scattered 
torches mixed with cool blue moonlight from the upper-left, creating a duality 
of warmth and shadow. Scattered small bones, broken pottery shards, and tufts of 
dead grass are placed subtly at tile corners and edges; NO central foreground 
obstacles, NO floating debris, NO oversized statuary blocking the midground.

UPPER 20% — Atmosphere: Rolling grassland and distant hills silhouetted against 
a twilight orange sky. Faint torch glow on distant structures. 2-3 moonlit clouds 
drift across the upper void. The distant horizon shows the last embers of day 
surrendering to night.

Color palette anchors: #2e2438 (weathered stone), #c8a020 (torch amber), #1a1128 
(deep shadow). A subtle vignette darkens the outer edges.

No characters, no UI, no watermarks, no text overlays.
```

### Act 2 — Ashen Wastes

```
An Ashen Wastes dungeon interior rendered in cinematic dark fantasy style, 
pixel-art inspired 2D perspective. The floor is composed of cracked volcanic rock, 
ash drifts, and heat-fractured dark stone tiles, arranged in a 2.5D isometric grid 
descending toward the vanishing point. Grout lines glow faintly with residual heat.

LOWER 80% — Playfield: Dull red ember glow from cracks in the rock, with deep 
shadows cast by volcanic spires. Half-buried stone blocks, ash piles at tile corners, 
and sparse bleached bones are scattered at edges only; NO central foreground obstacles, 
NO floating debris, NO oversized statuary blocking the midground.

UPPER 20% — Atmosphere: Billowing ash clouds rise high above, volcanic spires jut 
into a smoke-filled red sky, and faint lava-flow glow emanates from the horizon. 
The upper void swirls with particulates, creating a sense of desolation and heat.

Color palette anchors: #ff7020 (lava glow), #06030e (ash black), #3d3250 (hot stone). 
A subtle vignette darkens the outer edges.

No characters, no UI, no watermarks, no text overlays.
```

### Act 3 — Shattered Hell

```
A Shattered Hell dungeon interior rendered in cinematic dark fantasy style, 
pixel-art inspired 2D perspective. The floor is composed of jagged obsidian shards 
forming a broken floor, thin cracks bleeding purple necrotic light, arranged in a 
2.5D isometric grid descending toward the vanishing point. Grout lines radiate 
sickly purple luminescence.

LOWER 80% — Playfield: Sickly purple glow emanates from cracks in the rock, deep 
blues dominate the deepest shadows. Obsidian splinters, cracked geode clusters at 
tile edges, and thin trails of void-dust are placed subtly at corners; NO central 
foreground obstacles, NO floating debris, NO oversized statuary blocking the midground.

UPPER 20% — Atmosphere: A fractured ceiling overhead with crystalline formations. 
Purple necrotic wisps coil in the upper void. Distant impossible geometry suggests 
chaotic terrain beyond. The upper realm feels warped and unreal.

Color palette anchors: #40a8ff (void blue), #a0d8ff (void fringe), #06030e (deep void). 
A subtle vignette darkens the outer edges.

No characters, no UI, no watermarks, no text overlays.
```

### Act 4 — Cosmic Rift

```
A Cosmic Rift dungeon interior rendered in cinematic dark fantasy style, 
pixel-art inspired 2D perspective. The floor is composed of shattered marble and 
cosmic fragments forming tessellated tiles, torn edges of reality, arranged in a 
2.5D isometric grid descending toward the vanishing point. Grout lines shimmer 
with ethereal caustic light.

LOWER 80% — Playfield: Ethereal white and blue star-light filters through rifts 
in the floor, casting sharp shadows. Drifting cosmic debris (small), crystalline 
shards, and thin lines of caustic light pool on tiles at edges; NO central foreground 
obstacles, NO floating debris, NO oversized statuary blocking the midground, NO large creatures.

UPPER 20% — Atmosphere: The sky/void above shows tearing reality edges, distant 
stars, cosmic nebulae swirling in impossible colors, and writhing anomalies at the 
horizon. The upper realm feels like a wound in the fabric of existence.

Color palette anchors: #a0d8ff (cosmic light), #4080e0 (rift blue), #06030e (void edge). 
A subtle vignette darkens the outer edges.

No characters, no UI, no watermarks, no text overlays.
```

### Act 5 — Primordial Nexus

```
A Primordial Nexus dungeon interior rendered in cinematic dark fantasy style, 
pixel-art inspired 2D perspective. The floor is composed of ornate stone tiles 
encrusted with glowing rune-work, a fluid-mirror surface reflective in places, 
arranged in a 2.5D isometric grid descending toward the vanishing point. Runes 
pulse with radiant energy.

LOWER 80% — Playfield: Searing golden and white radiance emanates from glowing 
runes, creating chromatic iridescence and cold reflection on wet surfaces. Crystalline 
formations sprouting from tile edges, rune-carved blocks, and ripples frozen in 
liquid light are scattered at edges; NO central foreground obstacles, NO floating 
debris, NO oversized statuary blocking the midground.

UPPER 20% — Atmosphere: Towering ancient columns rise into infinity overhead. 
Radiant energy cascades from above in flowing streams. Reality distortion warps 
the horizon. Ancient symbols glow in the upper void, suggesting vast age and power.

Color palette anchors: #f8e890 (golden glow), #40a8ff (energy blue), #c8a020 (rune amber). 
A subtle vignette darkens the outer edges.

No characters, no UI, no watermarks, no text overlays.
```

### Act 6 — Dragon Expansion

```
A Dragon Expansion dungeon interior rendered in cinematic dark fantasy style, 
pixel-art inspired 2D perspective. The floor is composed of polished black obsidian 
tiles arranged in a ritual pattern, gold inlay forming geometric designs, descending 
in a 2.5D isometric grid toward the vanishing point. Grout lines gleam with reflected 
gold.

LOWER 80% — Playfield: Reflected firelight from a distant hoard casts warm orange 
glow and dramatic side-lighting. Scattered coins and gems at tile edges (NO pile 
blocks midground), ancient statuettes, and obsidian spikes are placed at corners only; 
NO central foreground obstacles, NO floating debris, NO oversized statuary blocking 
the midground.

UPPER 20% — Atmosphere: A vast vaulted ceiling soars overhead, receding into shadow. 
Piles of gold are visible in the distance (upper-left and upper-right, NOT center). 
Warm reflection shimmers on the obsidian floor. A faint draconic silhouette shadow 
is implied at the horizon but NOT rendered as a full character or monster.

Color palette anchors: #c8a020 (gold), #ff7020 (firelight), #06030e (deep void). 
A subtle vignette darkens the outer edges.

No characters, no UI, no watermarks, no text overlays.
```

---

## Handoff to Phase 11 (Slideshow)

**5 facts for the deck author:**

1. **The 80/20 split is non-negotiable.** The lower 80% of every background is the playfield where sprites stand. The upper 20% is atmosphere. This is the only way combat backgrounds remain readable when the 2.5D grid overlays them. If a generation has floating debris in the middle 80%, it fails.

2. **Perspective converges to upper-center, not horizon-line.** Unlike traditional landscape paintings, these backgrounds converge toward a point ~15% from the top of the image (or ~23% from the top of the full screen in the reference design). This is how the isometric grid will work when overlaid. Generations with horizon-line perspective won't align with the tile grid.

3. **Per-act biome variation is the visual story.** Act 1 is warm candlelight + twilight sky (entry to danger). Act 6 is gold-hoard fire (dragons, treasure, final). The lighting and color shifts are how players feel progression. Each act must nail its own lighting mood or the whole narrative falls flat.

4. **Cost is ~$0.24 for all six.** With OpenAI's standard quality tier at 1536×1024, we're looking at ~$0.04 per image. Six acts, one image per act (assuming no major re-rolls) = $0.24 total. This is cheap enough to re-roll an act if the first pass misses the brief.

5. **Archive-first, then overwrite.** Before pushing any new background into `public/images/map_bg/`, move the old one to a dated archive folder (`_archived-2026-04-29/`). This is rollback insurance. If a new background breaks the game layout, we can restore the old one in seconds.

