## Prompt Templates

Reusable prompt templates for SpriteCook / image generation. Consistency across batches is the whole point — substitute the variables, keep the surrounding text intact.

### Character frames

#### Portrait (reference frame for a new character)

```
Detailed fantasy RPG character portrait of {descriptor}, {palette} palette,
{mood} mood, shoulders-up, facing forward, clean neutral background,
consistent with Emberveil art style (painterly, atmospheric, high contrast).
```

#### South (map/idle)

```
Same {descriptor} as reference, same outfit and palette, full-body standing
pose facing the camera (south), neutral background, consistent proportions
and lighting with the reference portrait.
```

#### East (combat idle)

```
Same {descriptor} as reference, full-body side view facing east (right),
combat idle stance, weapon readied, neutral background, consistent with
reference portrait.
```

#### East attack

```
Same {descriptor} as reference, full-body side view facing east, mid-swing
attack frame with weapon extended toward the target, dynamic pose, neutral
background, matching palette and lighting.
```

#### East spell

```
Same {descriptor} as reference, full-body side view facing east, casting
a spell — hands raised with visible arcane/elemental energy matching
{element}, neutral background, matching palette.
```

#### East block

```
Same {descriptor} as reference, full-body side view facing east, defensive
block pose — weapon or shield raised to intercept an attack, bracing stance,
neutral background, matching palette.
```

#### East KO

```
Same {descriptor} as reference, full-body side view facing east, knocked-out
pose — collapsed on the ground or kneeling with head down, weapon dropped
or dropped beside them, neutral background, matching palette.
```

### Combat background

```
Atmospheric fantasy RPG combat environment: {zone descriptor}. Wide cinematic
composition, 1536×1024 aspect. Rich environmental detail in the background
and foreground framing elements, but the MIDGROUND IS INTENTIONALLY EMPTY —
a clear open focal area where combat takes place. No characters. No UI
elements, no borders, no text. Mood: {mood}. Palette: {palette}.
Style reference: painterly, atmospheric, high contrast — matching the
Emberveil title screen (menu_wide.jpg).
```

Examples of `{zone descriptor}`:
- `border_roads` → "a windswept grassland crossroads at dusk, distant mountain silhouettes, scattered broken wagon wheels"
- `thornwood_forest` → "a dense mossy forest interior, tangled roots, shafts of green-gold light through the canopy"
- `volcanic_waste` → "a cooled lava field under a smoky red sky, obsidian shards, distant active volcano"
- `cosmic_rift` → "an interstellar void with floating rock islands, stars and nebulae, broken reality geometry"

### Map background

```
Atmospheric fantasy zone wallpaper: {zone descriptor}. Wide cinematic
composition, 1536×1024 aspect. No midground requirement — pure atmosphere.
No characters. No UI. Mood: {mood}. Palette: {palette}.
```

### Tap weapon / effect icon

```
Clean fantasy RPG item icon: {weapon descriptor}. Centered on a transparent
or neutral background. Sharp outline. Consistent with Emberveil's inventory
icon style: painterly but readable at small sizes.
```

Effect frame prompt (for projectile / explosion artwork):

```
Fantasy VFX sprite: {effect descriptor} — single frame, transparent
background, facing east (for travel effects) or centered (for area effects).
Consistent palette with the source weapon's element.
```
