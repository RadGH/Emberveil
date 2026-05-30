# Re-redesign Generation Pass — Phase A Halt Report

**Date:** 2026-04-14
**Agent:** Image generation batch (Pixel Engine)
**Status:** HALTED after Phase A. Phases B–F not started.

## Outcome

Phase A (Warrior validation, 120 credits) completed successfully in
terms of API mechanics — all 6 `/animate` jobs submitted, polled,
succeeded (`credits_charged: 20` each, `hold_status: captured`),
outputs downloaded before signed-URL expiry, converted webp → PNG,
chroma-keyed to alpha.

**However, Phase A failed the quality gate.** The 6 variants are
visually near-identical head-and-shoulders portraits of the same
Warrior. The pose-differentiating prompts (`front_idle`, `east_attack`,
`east_down`, etc.) had effectively zero effect on composition. No
full-body, no east profile, no attack motion, no down pose.

Per the task brief: *"If the output quality is bad (consistency lost
between calls, chroma-key leaves green halos, animations look wrong):
STOP and report the failure mode + a recommendation. Do not burn
credits batching a broken pipeline."* — I halted.

## Root cause

`/animate` is image-to-video animation. It takes the reference image
and produces subtle motion around that exact composition. It does NOT
reimagine the subject into a new pose based on the prompt. The
reference image dominates the output; prompts only influence minor
surface details.

This is different from what both the task brief and the previous
agent's API notes assumed. The task brief explicitly warned that
`/keyframes` was misunderstood by the previous agent and that neither
`/keyframes` nor `/animate` would do "6 poses from 1 portrait" — my
Phase A empirical test **confirms** `/animate` also cannot do it. The
previous warning was correct; we now have proof.

## Credit accounting

| Item | Credits |
|---|---|
| Starting balance | 16,018 |
| Probe request (cancelled, refunded) | 0 |
| Warrior × 6 `/animate` (Phase A) | 120 |
| **Ending balance** | **15,898** |
| **Total spend** | **120** |
| Hard ceiling | 15,000 spend (= stop at balance 1,018) |
| Remaining headroom | 14,880 |

## Phase B-E status (per task brief audit)

- Phase A (Warrior validation): ⚠️ API mechanics passed, quality FAILED. Halted.
- Phase B (heroes, 19 chars): ⛔ NOT STARTED — would produce the same broken output.
- Phase C (companions + mercs, 23 chars): ⛔ NOT STARTED.
- Phase D (bosses, 10 chars): ⛔ NOT STARTED.
- Phase E (enemies, 29 chars): ⛔ NOT STARTED.
- Phase F (report page + manifest update): ⛔ NOT STARTED — nothing new to catalog.

Per NO SILENT SHELVING: these are **explicitly deferred pending a
decision from the user**, not silently dropped. The reason is above.

## Animal weapon-safety verification

Zero `isAnimal` characters were processed (Phase B was not reached).
Grep of `memory/pixel_engine_jobs/*_submit.json` for animal-class
names with weapon words: no matches. Warrior is humanoid. Safe.

## Files produced (keep for reference / before-after comparison)

```
public/images/sprites_pixelengine/warrior_front_idle.{webp,png,_alpha.png}
public/images/sprites_pixelengine/warrior_east_idle.{webp,png,_alpha.png}
public/images/sprites_pixelengine/warrior_east_attack.{webp,png,_alpha.png}
public/images/sprites_pixelengine/warrior_east_spell.{webp,png,_alpha.png}
public/images/sprites_pixelengine/warrior_east_down.{webp,png,_alpha.png}
public/images/sprites_pixelengine/warrior_portrait.{webp,png,_alpha.png}
memory/pixel_engine_jobs/warrior_*_{submit,result}.json
memory/pixel_engine_jobs/warrior_summary.json
```

The 6 PNGs are all viable as *portraits* (they match the existing
Warrior portrait closely, pixel-art styled) but they are not a
usable set of 6 distinct combat sprites.

## Recommendations (user decision required)

**The re-redesign pipeline needs a different generator.** Pixel Engine
can add subtle motion to existing art but it cannot produce new poses.
Options:

1. **Source pose references first, animate later.** Generate or draw
   6 full-body pose references per character using a pose-capable
   model (PixelLab `create_character` with 8-directional output, or
   SDXL + ControlNet-OpenPose + IP-Adapter for character consistency).
   Then use Pixel Engine `/animate` per pose if subtle motion is
   desired. Cost: PixelLab character API may cover this in fewer
   calls — one `create_character` call returns multi-direction views.
2. **Switch to PixelLab `animate_character`.** The MCP server is
   available (noted in the env). It uses a skeleton rig and is
   designed for "character with N directional views + N actions."
   The task brief bans `mcp__pixellab__*` — that ban would need to
   be lifted by the user.
3. **Accept portrait-only redesign.** The 6 Warrior outputs are
   actually fine as portrait refinements. We could repurpose the
   pipeline to *only* regenerate portraits (1 call per char, 20
   credits × 82 = 1,640 credits total) and use the existing
   CombatScreen sprite system unchanged. This is a scope reduction
   the user must approve — NOT silently shelved.
4. **Abandon Pixel Engine for sprite gen, keep it for background
   parallax loops only.** Pixel Engine shines at animating static
   scenes — its original advertised use case.

## Next-wave wiring recommendation

Do NOT wire anything into `CombatScreen.js` / `SPRITE_MAP` yet. We have
only 1 character's worth of output and it's single-pose. Wait for the
user's decision on the above options before touching src/. The m95
skill-rewiring batch should land first regardless — it's orthogonal
to sprite art.

## What the user should look at before deciding

Open these 6 PNGs side-by-side to see the "all the same" problem:
```
/home/radgh/claude/game13/public/images/sprites_pixelengine/warrior_front_idle.png
/home/radgh/claude/game13/public/images/sprites_pixelengine/warrior_east_idle.png
/home/radgh/claude/game13/public/images/sprites_pixelengine/warrior_east_attack.png
/home/radgh/claude/game13/public/images/sprites_pixelengine/warrior_east_spell.png
/home/radgh/claude/game13/public/images/sprites_pixelengine/warrior_east_down.png
/home/radgh/claude/game13/public/images/sprites_pixelengine/warrior_portrait.png
```
