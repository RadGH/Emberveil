# M204 SpriteCook Pipeline Handoff v2 — 2026-04-21 (post-compaction)

Resume generating 7-pose sprite sets. v1 covered 6 of the 15 chars; v2 covers the remaining 9.

## Status snapshot

- **Credits used total:** 4968 (tracked in `public/data/pixellab_redesign_state.json`)
- **Remaining budget:** ~3828 credits — ample for 9 chars × 84 = 756 cr.
- **Completed in v1 session (post-handoff):** swashbuckler_female, dragon_knight, dragon_knight_male, tactician, tactician_female, chronomancer (Waves H–K, all committed).
- **Frames generated, awaiting user approval:** all six above + scavenger, scavenger_female, swashbuckler from earlier waves.

## Known issues (regen later, not blocking)

- `demon_hunter_female:east_attack` — weapon drawn but not held in hand.
- `chronomancer:east_attack` — first gen had opaque corner; regenerated successfully (asset 20ea6315). OK.

## 9 characters remaining (have reference_asset_id)

Fire 7 parallel `mcp__plugin_spritecook_spritecook__generate_game_art` per character. Args: `pixel=true`, `bg_mode="transparent"`, `size_preset="256x256"` (or width=256/height=256), and `reference_asset_id` from this table:

| sprite_id           | reference_asset_id |
|---------------------|--------------------|
| shaman              | ac45eaf3-02bf-4322-8498-68b2159af66a |
| shaman_male         | d76a855c-7c7f-4bb0-b4fc-9793f0bc9b52 |
| witch_hunter        | 4828f83a-876f-48e1-b03b-714454d377db |
| witch_hunter_female | 6efa5000-ced9-453d-82f2-ed5c0b318a62 |
| sorcerer            | 5a95396d-9f31-44ae-b81e-0d7363278628 |
| sorcerer_female     | d5eeb0ba-68de-441f-8b03-f37e24181063 |
| runesmith           | d8373599-6a5d-43a1-8445-ba947885eefb |
| runesmith_female    | cdc3b0b6-24bc-4264-bbb9-5fd1c46a15aa |
| shadow_dancer       | f22a2285-fc44-4ba9-9e73-7a408aacdacf |

## Still BLOCKED

`chronomancer_female` and `shadow_dancer_male` — no `referenceSheet.spritecookAssetId`. User decision required.

## Pre-built prompts (already on disk)

For all 9 remaining sids, prompts exist at `/tmp/m204/prompt_<sid>_<pose>.txt` (7 files each). Read them inline — no need to rerun `build_prompts.py`. (If `/tmp` was cleared, rerun: `python3 /tmp/m204/build_prompts.py <sid>`.)

Pose order (same for every char): `portrait, south, east, east_attack, east_spell, east_block, east_ko`.

## Wire script (reusable)

`python3 /tmp/m204/wire_generic.py <sid> /tmp/m204/pairs_<sid>.json`

The pairs file shape:
```json
{
  "portrait":   {"aid":"...", "url":"https://api.spritecook.ai/.../signed-content/pixel?sig=...&exp=..."},
  "south":      {"aid":"...", "url":"..."},
  "east":       {"aid":"...", "url":"..."},
  "east_attack":{"aid":"...", "url":"..."},
  "east_spell": {"aid":"...", "url":"..."},
  "east_block": {"aid":"...", "url":"..."},
  "east_ko":    {"aid":"...", "url":"..."}
}
```

`wire_generic.py` does: download → PIL validate (RGBA, 80–400 px, 4 corners alpha ≤30) → save to `public/images/pixellab/<sid>/<pose>.png` and `public/images/spritecook/<sid>_<pose>.png` → patch `public/data/art_direction/<sid>.json` (frames map) → patch `pixellab_redesign_state.json` (`status=frames_generated`, all `framesStatus=pending_approval`, `creditsUsed+=84`, `creditsUsedTotal+=84`).

If a corner fails validation, regenerate that single pose with stronger prompt: append "Pure transparent background to all 4 corners — no solid colored corners" and add `solid colored corners, opaque background corners` to NEGATIVE.

## Cadence

Commit every 2 chars (one Wave letter per commit). Next wave letter = **L**. Suggested batching:
- Wave L: shaman + shaman_male
- Wave M: witch_hunter + witch_hunter_female
- Wave N: sorcerer + sorcerer_female
- Wave O: runesmith + runesmith_female
- Wave P: shadow_dancer (solo)

Commit message pattern: `M204 Wave <X>: <sid>[, <sid2>] 7-pose sprite set`. Author: `Claude Code <claude-code@anthropic.com>`.

Skip `deploy_pages.sh` until end of batch (saves context). Run once after Wave P.

## Context-burn warning

MCP `generate_game_art` responses are large. Each char = 7 calls. If approaching limits mid-batch, write `handoff_2026-04-21_m204_waves_v3.md` and stop.
