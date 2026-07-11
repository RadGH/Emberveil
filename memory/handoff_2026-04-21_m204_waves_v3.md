# M204 SpriteCook Pipeline Handoff v3 — 2026-04-21 (post-Wave L)

Resume generating 7-pose sprite sets. v3 covers the remaining 7 characters.

## Status snapshot

- **Credits used total:** 5136 (tracked in `public/data/pixellab_redesign_state.json`)
- **Remaining budget:** ~3660 credits — ample for 7 chars × 84 = 588 cr.
- **Completed in v2 session:** shaman, shaman_male (Wave L, committed).
- **Earlier v1/v2 completions:** scavenger, scavenger_female, swashbuckler, swashbuckler_female, dragon_knight, dragon_knight_male, demon_hunter_female, tactician, tactician_female, chronomancer.

## Known issues (regen later, not blocking)

- `demon_hunter_female:east_attack` — weapon drawn but not held in hand.
- `shaman_male:east_attack` and `shaman_male:east_ko` landed at 256x256 full-frame (tight crop). Passed validation but visually less centered than shaman female — optional regen.

## 7 characters remaining (have reference_asset_id)

Fire 7 parallel `mcp__plugin_spritecook_spritecook__generate_game_art` per character. Args: `pixel=true`, `bg_mode="transparent"`, `width=256`, `height=256`, `reference_asset_id` from this table:

| sprite_id           | reference_asset_id |
|---------------------|--------------------|
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

Prompts exist at `/tmp/m204/prompt_<sid>_<pose>.txt` (7 files per char). Pose order: `portrait, south, east, east_attack, east_spell, east_block, east_ko`.

If `/tmp` was cleared, rerun: `python3 /tmp/m204/build_prompts.py <sid>`.

## Wire script (reusable)

`python3 /tmp/m204/wire_generic.py <sid> /tmp/m204/pairs_<sid>.json`

Pairs file shape:
```json
{
  "portrait":   {"aid":"...", "url":"https://api.spritecook.ai/.../pixel?sig=...&exp=..."},
  "south":      {"aid":"...", "url":"..."},
  "east":       {"aid":"...", "url":"..."},
  "east_attack":{"aid":"...", "url":"..."},
  "east_spell": {"aid":"...", "url":"..."},
  "east_block": {"aid":"...", "url":"..."},
  "east_ko":    {"aid":"...", "url":"..."}
}
```

`wire_generic.py` does: download → PIL validate (RGBA, 80–400 px, 4 corners alpha ≤30) → save to `public/images/pixellab/<sid>/<pose>.png` and `public/images/spritecook/<sid>_<pose>.png` → patch `public/data/art_direction/<sid>.json` → bump `pixellab_redesign_state.json` (`creditsUsedTotal+=84`).

If a corner fails validation, regenerate that single pose with stronger prompt: append "Pure transparent background to all 4 corners — no solid colored corners" and add `solid colored corners, opaque background corners` to NEGATIVE.

## Cadence

Commit every 2 chars (one Wave letter per commit). Next wave letter = **M**.
- Wave M: witch_hunter + witch_hunter_female
- Wave N: sorcerer + sorcerer_female
- Wave O: runesmith + runesmith_female
- Wave P: shadow_dancer (solo)

Commit message pattern: `M204 Wave <X>: <sid>[, <sid2>] 7-pose sprite set`. Author: `Claude Code <claude-code@anthropic.com>`.

Skip `deploy_pages.sh` until end of batch. Run once after Wave P.

## Context-burn warning

MCP `generate_game_art` responses echo full prompt back (~1KB each), and reading prompt files via `cat` adds another full copy per char. Budget realistically: 2 chars per fresh session before context gets heavy. **Do NOT read prompt files with `cat` for display** — pass the file path contents directly to the MCP tool via a script that reads the file and invokes... actually you can't pipe into MCP. Best mitigation: only read prompt files when firing that char's calls, never up-front as a batch; skip re-reading what you've already loaded.

If approaching limits mid-batch, write `handoff_2026-04-21_m204_waves_v4.md` and stop before triggering a partial wave.
