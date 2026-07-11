# M204 SpriteCook Pipeline Handoff — 2026-04-21

Resume generating 7-pose sprite sets for the remaining characters.

## Status snapshot

- **Credits used total:** 4464 (tracked in `public/data/pixellab_redesign_state.json`)
- **Remaining budget for this batch:** ~1428 credits (17 chars × 7 poses × 12 cr) — check `get_credit_balance` before firing.
- **Approved so far:** oracle, warrior, fighter, paladin, ranger, ranger_male, rogue, rogue_male, cleric, cleric_male, bard, bard_female, mage, mage_female, necromancer, necromancer_female, warlock, warlock_male, demon_hunter, demon_hunter_female, pyromancer, pyromancer_male, stormcaller, stormcaller_female, druid, druid_male, monk, monk_female, knight, knight_male, oracle_male, warrior_female, fighter_female, paladin_female.
- **Frames generated, awaiting user approval:** scavenger, scavenger_female, swashbuckler.

## Known issue (not blocking — regenerate later)

- `demon_hunter_female:east_attack` — weapon is drawn but not held in the character's hand. User flagged this but still approved the set. Regen at some point.

## 15 characters ready to generate (have reference_asset_id)

Fire 7 parallel `mcp__plugin_spritecook_spritecook__generate_game_art` calls per character with `reference_asset_id` locked, `pixel=true`, `bg_mode="transparent"`, `size_preset="256x256"`:

| sprite_id | reference_asset_id |
|-----------|--------------------|
| swashbuckler_female   | bf0af665-a911-4683-a4eb-561b87616e0e |
| dragon_knight         | f2b6c707-bde5-40d2-a2b4-a8971ad70a46 |
| dragon_knight_male    | 076221f3-f975-42a4-98ff-c6aa970bd8e4 |
| tactician             | 1b07e996-7799-4ab6-8396-0c028bcc4f76 |
| tactician_female      | 29f9e85d-3624-4c77-b449-257397dfa54e |
| chronomancer          | 528c08eb-bead-4c8b-956c-e8983c55fc77 |
| shaman                | ac45eaf3-02bf-4322-8498-68b2159af66a |
| shaman_male           | d76a855c-7c7f-4bb0-b4fc-9793f0bc9b52 |
| witch_hunter          | 4828f83a-876f-48e1-b03b-714454d377db |
| witch_hunter_female   | 6efa5000-ced9-453d-82f2-ed5c0b318a62 |
| sorcerer              | 5a95396d-9f31-44ae-b81e-0d7363278628 |
| sorcerer_female       | d5eeb0ba-68de-441f-8b03-f37e24181063 |
| runesmith             | d8373599-6a5d-43a1-8445-ba947885eefb |
| runesmith_female      | cdc3b0b6-24bc-4264-bbb9-5fd1c46a15aa |
| shadow_dancer         | f22a2285-fc44-4ba9-9e73-7a408aacdacf |

## 2 characters BLOCKED — no reference sheet yet

`chronomancer_female` and `shadow_dancer_male` have `referenceSheet.spritecookAssetId = None` in their art_direction JSONs. Must generate a reference sheet first (same SpriteCook pattern) before firing the 7-pose wave, OR reuse the opposite-gender reference if the user approves. Note from prior sessions: chronomancer_female also has a "two-hourglass portrait" regen request in the wishlist.

## Canonical poses (every character, same order)

`portrait`, `south`, `east`, `east_attack`, `east_spell`, `east_block`, `east_ko`.

## Prompt builder

Run `python3 /tmp/m204/build_prompts.py <sid>` — reads `public/data/art_direction/<sid>.json` and emits 7-pose prompts with identity/outfit/weapons + pose-specific style key. Portrait uses `BUST SHOT`, others use `FULL-BODY`. Copy each prompt into its `generate_game_art` call.

## Wire pattern (per-wave script)

Model after `/tmp/m204/wire_wave_H.py`. Each script:

1. Maps 7 asset_ids → poses for one sprite_id.
2. Downloads each signed URL (URLs expire ~20h — refresh via `get_asset_metadata` if stale).
3. PIL validates: RGBA, 80–400 px, all 4 corners transparent (alpha ≤30).
4. Saves to `public/images/pixellab/<sid>/<pose>.png` AND `public/images/spritecook/<sid>_<pose>.png`.
5. Patches `public/data/art_direction/<sid>.json` → adds `frames[pose] = { path, spritecookAssetId, generatedAt, approvedAt }`.
6. Patches `pixellab_redesign_state.json` → `characters[sid].status = "frames_generated"`, all `framesStatus` → `pending_approval`, bumps `creditsUsed` by 84.

## Commit cadence

**Commit + deploy every 2–3 characters.** Do NOT wait until all 15 are done — if context fills mid-wave, completed work is safe on main. Commit message pattern: `M204 Wave <letter>: <sid>[, <sid>...] 7-pose sprite set`. Deploy: `bash /home/radgh/claude/deploy_pages.sh`.

## NO SILENT SHELVING

If you can't finish all 15 this session, declare it upfront and offer a fresh handoff. User will re-clear as needed.
