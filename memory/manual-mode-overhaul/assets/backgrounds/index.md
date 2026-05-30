# Background generation — full set + variants

All 18 backgrounds are generated (6 acts × 3 variants). Each used the universal prompt skeleton from `phases/05-bg-prompt-spec.md` plus the §9a "no architectural framing" negative-prompt block.

**Generation:** `gpt-image-1.5`, 1536×1024, ~$0.04 each = **~$0.80 total** (6 ship + 14 variant + 2 deprecated re-rolls).

## Variant naming convention

Each act ships three encounter-eligible backgrounds. The encounter→variant mapping is **not yet wired** — it lands during the implementation milestones. Naming pattern:

```
act-N-biome-v1.png   ← canonical / "default" mood
act-N-biome-v2.png   ← alt mood A (different time of day, weather, or focus)
act-N-biome-v3.png   ← alt mood B
```

Failed first-pass generations are kept on disk with `-v0-<reason>.png` suffix so the regen story is auditable later.

## Per-act gallery

### Act 1 — Border Roads ✅
- **v1** (canonical): dusk + torches + moonlight — [act-1-border-roads-v1.png](act-1-border-roads-v1.png)
- **v2** (alt): early dawn, dewy grass, mist — [act-1-border-roads-v2.png](act-1-border-roads-v2.png)
- **v3** (alt): stormy night, lightning, rain on flagstone — [act-1-border-roads-v3.png](act-1-border-roads-v3.png)
- _archived: `act-1-border-roads-v0-archive.png` (lateral-wall framing problem)_

### Act 2 — Ashen Wastes ✅
- **v1** (canonical): lava cracks + volcanic spires — [act-2-ashen-wastes-v1.png](act-2-ashen-wastes-v1.png)
- **v2** (alt): ash-fall storm, dim red-gray, no visible lava — [act-2-ashen-wastes-v2.png](act-2-ashen-wastes-v2.png)
- **v3** (alt): active caldera edge, distant erupting volcano — [act-2-ashen-wastes-v3.png](act-2-ashen-wastes-v3.png)

### Act 3 — Shattered Hell ✅
- **v1** (canonical): purple necrotic + crystalline ceiling — [act-3-shattered-hell-v1.png](act-3-shattered-hell-v1.png)
- **v2** (alt): bone-littered, skull-pillars in distance — [act-3-shattered-hell-v2.png](act-3-shattered-hell-v2.png)
- **v3** (alt): flesh-cathedral, sickly green tint — [act-3-shattered-hell-v3.png](act-3-shattered-hell-v3.png)

### Act 4 — Cosmic Rift ✅ (re-roll fixed contrast)
- **v1** (canonical, re-rolled): dark obsidian floor with caustic blue cracks — [act-4-cosmic-rift-v1.png](act-4-cosmic-rift-v1.png)
- **v2** (alt): nebula burst, vivid pink-purple sky over dark floor — [act-4-cosmic-rift-v2.png](act-4-cosmic-rift-v2.png)
- **v3** (alt): twin suns (cold blue + dim red), dual-color light — [act-4-cosmic-rift-v3.png](act-4-cosmic-rift-v3.png)
- _archived: `act-4-cosmic-rift-v0-toobright.png` (pale white-blue floor; sprite contrast fail)_

### Act 5 — Primordial Nexus ✅ (re-roll moved runes to tile edges)
- **v1** (canonical, re-rolled): dark stone, gold rune-edges only, diffuse gold light — [act-5-primordial-nexus-v1.png](act-5-primordial-nexus-v1.png)
- **v2** (alt): vertical gold-light columns, temple-pillared — [act-5-primordial-nexus-v2.png](act-5-primordial-nexus-v2.png)
- **v3** (alt): ritual dawn, distant cosmic rings, low mist — [act-5-primordial-nexus-v3.png](act-5-primordial-nexus-v3.png)
- _archived: `act-5-primordial-nexus-v0-busyfloor.png` (rune circles painted on tile faces; floor too busy)_

### Act 6 — Dragon Expansion ✅
- **v1** (canonical): polished obsidian + gold inlay + distant hoard piles — [act-6-dragon-expansion-v1.png](act-6-dragon-expansion-v1.png)
- **v2** (alt): dragonfire-scarred, charred floor with ember cracks — [act-6-dragon-expansion-v2.png](act-6-dragon-expansion-v2.png)
- **v3** (alt): throne-hall with scale-pillars in distance — [act-6-dragon-expansion-v3.png](act-6-dragon-expansion-v3.png)

## Encounter→variant mapping (next-step planning, not yet wired)

The implementation phase will add a small table in `mapData.js` that maps each encounter (or zone) to a preferred variant key. Default rule of thumb:

- **Trash encounters** → v1 (the canonical mood)
- **Big-fight overlay** → v2 (different mood = subliminal "this fight is different")
- **Boss encounters** → v3 (most dramatic mood — storm, eruption, twin suns, nebula burst, throne hall, etc.)

This is **not locked**. Phase 12's roast flagged that the encounter→variant mapping wasn't owned by any phase; Implementation Milestone M387 should pick this up explicitly.

## Total cost ledger

| Bucket | Count | Cost |
|---|---|---|
| Initial 6-act run | 6 | $0.24 |
| Act 1 re-roll (lateral framing fix) | 1 | $0.04 |
| Act 4 re-roll (dark floor) | 1 | $0.04 |
| Act 5 re-roll (rune edges only) | 1 | $0.04 |
| v2/v3 variants (6 acts × 2) | 12 | $0.48 |
| **Total spent** | **21** | **~$0.84** |

Keeps every successful asset; archived deprecated v0 files for audit.
