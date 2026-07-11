# Phase 01 — Current State Audit

**Date:** 2026-04-29
**Scope:** Audit of shipped CombatScreen combat system vs proposed manual-mode + UI redesign.
**No code changes here.** This document feeds phases 02 and 04.

---

## 1. Combat Lifecycle Today (Sequence Diagram)

```
CONSTRUCTION
  CombatScreen(manager, audio, hero, encounter)
    ├─ _preloadSprites(encounter)                         CombatScreen.js:311
    ├─ GameState.sanitizeRoster()
    ├─ _heroMembers → _memberToCombatant()                CombatScreen.js:386
    │    Folds passives (getPassiveBonuses), affixes (getEquipmentAffixBonuses),
    │    set bonuses (applySetBonusStats), computes maxHp/Mp, hit/dodge/init,
    │    block stats, barrier status, _speedExtraPerRound
    ├─ _companionMembers → _memberToCombatant()           same
    ├─ Companion Level Sync (optional)                   CombatScreen.js:332-358
    ├─ createMeter() + seed ally entries                 CombatScreen.js:368-372
    ├─ encounter.enemies.map(_buildGroup)                CombatScreen.js:377
    │    NG+ scaling → enemyScalingForNgPlus()           formulas.js:428
    │    Champion modifier roll → rollChampionModifiers() CombatScreen.js:596
    ├─ _buildTurnOrder()                                 CombatScreen.js:640
    │    DEX * coef + level * coef + d10 roll, slow halves
    │    enemies seeded _speedExtraRemaining = _speedExtraPerRound
    └─ _dispatchLegendaryToAllies('onCombatStart')       CombatScreen.js:383

ENTER
  onEnter()                                              CombatScreen.js:699
    ├─ audio.playCombatMusic()
    ├─ preload tap-fx sprites
    ├─ _build()                                          CombatScreen.js:860
    │    Injects HTML overlay: log panel, meter panel, potion belt, HUD div, captions
    │    Attaches to manager.uiOverlay (NOT the canvas)
    │    _renderHud() → member bars + speed/pause controls
    │    _renderCombatPotionBelt()
    ├─ recordFightStart() telemetry
    ├─ combatDebug.clear() / group / push 'combat_start'
    ├─ ESC key handler (pause menu)
    └─ _showBossIntroSplash() if isBoss                  CombatScreen.js:750

PHASE: START (delay 1.2s normal, 3.0s boss)
  update(dt)                                             CombatScreen.js:2369
    └─ waits _startDelay seconds, then _phase = 'PLAYING'

PHASE: PLAYING — Turn Loop (0.5s / TURN_SPEED per tick)
  update(dt)
    ├─ accumulate _turnTimer
    └─ when _turnTimer >= TURN_SPEED → _executeTurn()   CombatScreen.js:2444

  _executeTurn()
    ├─ if _turnIdx >= _turnOrder.length:  ROUND BOUNDARY
    │    ├─ _round++
    │    ├─ _processStatusEffects()   (DoT ticks, buff decay)
    │    ├─ _regenMana()
    │    ├─ Barrier regen for magic-shield holders        CombatScreen.js:2453
    │    ├─ _buildTurnOrder()   (new initiative rolls each round)
    │    └─ GameState.tickTapCooldown('round')
    │
    └─ else: POP actor from _turnOrder[_turnIdx++]
         ├─ skip if !alive
         ├─ skipNextTurn → clear, log, return
         ├─ stun / freeze / confused → skip
         ├─ skill cooldown tick (per-skill map)          CombatScreen.js:2536
         ├─ if actor.isHero → _heroAI(actor)             CombatScreen.js:2573
         │    ├─ if gs.manualCombat && real hero → _openManualActionPanel()
         │    └─ else → pickHeroAction() [pure fn]       _aiTargeting.js
         │         → if skill → deduct mp, set cooldown, _executeSkill()
         │         → else → _basicAttack()
         ├─ if !actor.isHero → _enemyAI(actor)          CombatScreen.js:2738
         │    healer heal / wind-up spell / champion spell / basic attack
         │
         ├─ EXTRA ATTACK #1: actor.extraAction > 0      CombatScreen.js:2549
         │    splice actor back at _turnIdx; actor.extraAction--
         ├─ EXTRA ATTACK #2: actor._speedExtraRemaining > 0  CombatScreen.js:2559
         │    splice actor back at _turnIdx; _speedExtraRemaining--
         └─ _checkCombatEnd()

  DAMAGE RESOLUTION (called from _basicAttack / _executeSkill)
    rollToHit(actor, target)           clamp(hit - dodge, 5, 95)   formulas.js:169
    if miss → log, return
    rollBlock(target) if has shield    formulas.js:342
    applyBlock(rawDmg, target)         formulas.js:352
    applyMitigation(rawDmg, target, {type})  formulas.js:266
      physical → curve-DR (armor/(armor+k))  or flat (armor - rawDmg)
      magic    → flat rawDmg - magicResist
      true     → bypass
    _applyDamage(actor, target, finalDmg)    CombatScreen.js:3913
      → parry check (riposte counter-strike)
      → revive immunity absorb
      → champion shield 50% cut
      → dmgReduct buff
      → marked amp +30%
      → barrier absorb pool
      → soulbind redirect
      → thorns reflection
      → HP deduction
      → lifeSteal / manaSteal heal-back
      → on-kill hooks (hpOnKill, manaOnKill, chainOnHit)
      → spawn floating dmg number + particles
      → meter telemetry

  STATUS TICK (each round boundary)
    _processStatusEffects()
      burn / poison / bleed → computeDotTick() → _applyDamage()
      slow / stun / freeze / mark / confused → duration--; drop at 0
      haste → extraActionPerRound re-grant
      barrier → duration--
      regen nodes → hp + hpRegen

  VICTORY / DEFEAT
    _checkCombatEnd()                         CombatScreen.js:4601
    all enemies dead → _phase = 'VICTORY' → _victory() after 800ms
    all allies dead  → _phase = 'DEFEAT'  → _defeat() after 800ms

    _victory()                                CombatScreen.js:4666
      ├─ _applyEndOfCombatAutoRevive()
      ├─ awardXp() per hero
      ├─ computeGoldReward() / computeXpReward() per enemy
      ├─ rollBossLoot() if boss; generateItem() if zone drop
      ├─ unlock next zone (ZONE_UNLOCK_MAP)
      ├─ sync combatant hp/mp back to GameState members
      └─ _showVictoryModal()

    _defeat()                                 CombatScreen.js:5052
      GameState.setFlag('survived_defeat')
      → TownScreen (full party wipe)
```

---

## 2. Reusable Subsystems

| System | Location | What it does | Why reusable |
|---|---|---|---|
| `formulas.js` entire module | `src/game/formulas.js:1-703` | All combat math: hit/dodge, mitigation (curve-DR + flat), block, crit, spellPower, DoT, heals, rewards, NG+ scaling | Pure functions, `.formula` + `.inputs` metadata, already battle-tested. Keep as-is. |
| `_memberToCombatant()` | `CombatScreen.js:386-541` | Builds a combat-ready combatant snapshot from a GameState member | Already absorbs passives, affixes, set bonuses, companion sync. Manual mode needs the same combatants. Minor changes only (add `isPlayerControlled` flag). |
| `_buildGroup()` | `CombatScreen.js:544-639` | Enemy group construction, NG+ scaling, champion modifier roll | Entirely independent of auto vs manual. |
| `_buildTurnOrder()` | `CombatScreen.js:640-666` | DEX + d10 initiative, slow halving, per-round re-roll | Initiative strip in new design reads from `_turnOrder`. Keep; expose the array to the new DOM strip. |
| `_executeSkill()` | `CombatScreen.js:~3200+` | Skill dispatch engine (damage, heal, buff, DoT, AOE, chain, revive) | Entirely formulas-driven via skills.js schema. Manual mode calls it directly after player picks. |
| `_basicAttack()` | `CombatScreen.js:~3000+` | Auto-attack with hit roll, crit check, thorns, chain | Called from both auto AI and manual panel now; stays. |
| `_applyDamage()` | `CombatScreen.js:3913` | Damage pipeline: parry, immunity, dmgReduct, marked, barrier, soulbind, thorns, HP deduction, meter | Central damage sink; manual mode doesn't change this at all. |
| `_processStatusEffects()` | `CombatScreen.js:~4500+` | Per-round status tick (DoT, buff decay, haste re-grant) | Fully round-based; unaffected by manual vs auto. |
| `_regenMana()` | `CombatScreen.js:~4570+` | Per-round MP regen from INT + affix | Same. |
| `_checkCombatEnd()` | `CombatScreen.js:4601` | Victory/defeat gate | Already a clean two-liner. |
| `_victory()` / `_defeat()` | `CombatScreen.js:4666 / 5052` | XP/gold award, loot roll, zone unlock, GameState sync | Keep reward logic; only the victory modal DOM needs redesign. |
| `_meterTracker.js` | `src/ui/screens/_meterTracker.js:1-124` | Pure data layer for DPS/heal/mit meter (createMeter, meterAddDamage, etc.) | Zero DOM. Stays unchanged. |
| `_damagePipeline.js` | `src/ui/screens/_damagePipeline.js` (M274 extract) | Incoming-damage mitigation math wrapper | Already extracted as pure module. |
| `_aiTargeting.js` | `src/ui/screens/_aiTargeting.js` (M274 extract) | Hero AI skill picker — pure, no DOM | In manual mode companions still use this. Heroes skip it when `gs.manualCombat`. |
| `passives.js:getPassiveBonuses` | `src/game/passives.js:106-136` | Sums purchased passive node effects | Feeds `_memberToCombatant`; untouched. |
| `skills.js: SKILLS` dict | `src/game/skills.js` | Schema-driven skill definitions (damageMult, aoe, statusEffects, talents, upgrades) | Manual mode's spell rail reads this to render button labels, costs, estimated damage. |
| `_enemyAI()` | `CombatScreen.js:2738` | Enemy action resolver (healer heal, wind-up, champion spell, basic attack) | Companions and enemies both stay AI in manual mode. |
| Combat background system | `CombatScreen.js:200-233` + `_backgroundRenderer.js` | Zone-keyed image cache + procedural fallback | Background assets will be regenerated per phase 05; the loading/fallback architecture is reusable. |
| `STATUS_META` + `_renderStatusRow()` | `CombatScreen.js:107-136` | Status icon row (glyph, color, duration superscript) | Small, self-contained, used by HUD and new card rail equally. |
| Sprite cache + `_loadSprite()` | `CombatScreen.js:235-256` | SpriteCook-first, legacy-fallback sprite loader, all 7 poses | Keep; the new grid draws the same sprites. |

---

## 3. Will-Need-Refactor Subsystems

### 3a. `_heroAI()` → manual handoff path

**Location:** `CombatScreen.js:2573-2736`

**Conflict:** The current manual path (`gs.manualCombat`) is embedded inside `_heroAI()` via an early-return that calls `_openManualActionPanel()` and sets `_speedMult = 0`. The panel is a raw-innerHTML overlay with inline style. It does not integrate with the new card-rail UI, has no spell-icon SVG system, and shows no enemy-targeting affordances (required by README item: per-character spell rail with click-to-cast).

**Refactor sketch:** Extract a dedicated `_pauseForPlayerInput(actor, ...)` method. It sets a `_awaitingInput: actor` flag and returns. The update loop checks `_awaitingInput` before advancing. The new card-rail HUD lights up the active character's spell buttons; the player's click dispatches into the existing `_executeSkill` / `_basicAttack` path and clears the flag.

### 3b. `_renderHud()` — entire HUD structure

**Location:** `CombatScreen.js:1766-1811`

**Conflict:** Current HUD renders member cards as a flat flex row of minimal `.hm` divs (name + HP/MP bar + status icons). No portrait slot, no spell rail, no bottom-anchored card, no SVG border. The proposed design puts large character cards (portrait, HP/MP bars, spell rail, status) at the bottom of the screen as the primary interactive element.

**Refactor sketch:** Replace `.hud-members` content with a new `#cs-card-rail` component defined in phase 06. The `_renderHud()` wrapper becomes a thin bootstrap that mounts the card rail and wires speed/pause controls. The existing `.hm` element shape is too minimal to extend; replace it entirely.

### 3c. The `draw(ctx)` canvas layout — combatant positioning math

**Location:** `CombatScreen.js:5491-5581`

**Conflict:** Current layout uses a percentage-of-canvas-width placement table (`heroBaseX = gx0 + gridW * 0.14`). It is flat (no vertical depth/rows), hard-coded to left = heroes/companions, right = enemies, with no concept of a 2.5D perspective grid. The README requires an 80% ground / 20% top playfield with perspective squares and a separate companion row.

**Refactor sketch:** Replace the ad-hoc `gx0/gy0/heroBaseX` math block with a `_computeGridLayout()` method (phase 04) that maps logical grid cells to screen XY based on the perspective-transform parameters. Combatants get a `gridCell: {row, col}` property; `_computeGridLayout` fills `{x, y, drawScale}` from that. The rest of `draw(ctx)` (background, particles, sprites, floating numbers) stays.

### 3d. `_openManualActionPanel()` — the existing manual overlay

**Location:** `CombatScreen.js:2622-2736`

**Conflict:** This is a pure inner-HTML modal injected into `manager.uiOverlay`. It duplicates the card rail concept, has no spell icons, no per-target affordance, and will collide with the new design visually. It also restores `_speedMult` to `prevSpeed` on dismiss — coupling combat speed to the UI visibility in a way that the new loop-pause model must replace.

**Refactor sketch:** Delete this method. The new `_pauseForPlayerInput()` flow renders actions into the card rail directly; no modal needed. Keyboard shortcuts (1–9, Escape) can be re-wired to the card rail buttons.

### 3e. `_renderTapHudBtn()` + tap weapon system

**Location:** `CombatScreen.js:1882-1909`

**Conflict:** Tap weapon slot buttons live inside the current HUD right column alongside speed/pause controls. They render a 40×40 canvas each. The new HUD right-of-screen area is a turn-order strip; the tap buttons need repositioning or integration into the card rail as a free-action slot.

**Refactor sketch:** Relocate tap buttons to the card rail as an "item / free action" slot per-character (README: "items are free actions"). Keep the underlying `getTapItem` / `resolveTap` logic from `tapWeapons.js` untouched.

### 3f. COMBAT_STYLES inline CSS (monolith)

**Location:** Bottom of `CombatScreen.js` — the `COMBAT_STYLES` string (approx. `CombatScreen.js:6850+`)

**Conflict:** A large inline `injectStyles('combat-styles', COMBAT_STYLES)` block governs the current layout. The new 2.5D grid, SVG borders, and card rail will need their own stylesheet. Mixing new rules into the existing block makes them hard to audit and revert.

**Refactor sketch:** Keep `combat-styles` for the canvas/overlay wrapper and log panel. Extract a `combat-grid-styles` injection for the new playfield and a `combat-card-rail-styles` for the card rail (phase 06 deliverable).

---

## 4. Multi-Attack / Extra-Attack Handling Today

There are **two independent extra-attack mechanisms** that operate through the same splice-back pattern:

### Mechanism A — skill-granted `extraAction` (M89)

- **Seed site:** `_executeSkill` — when a skill's effect has `eff.extraAction`, it adds to `actor.extraAction` (`CombatScreen.js:3248`). The Haste status also re-grants `extraActionPerRound` at each round boundary (`CombatScreen.js:4520`).
- **Consume site:** `_executeTurn()` after the primary action (`CombatScreen.js:2549`). If `actor.extraAction > 0`, decrements it and splices the actor back at `_turnIdx`. This fires immediately — on the very next `_executeTurn()` tick (same frame or the next 0.5s cycle).
- **Behavior:** The extra action fires another full `_heroAI()` or `_enemyAI()` call, which may pick a skill or a basic attack exactly as normal.

### Mechanism B — weapon attack speed `_speedExtraRemaining` (M231/M357)

- **Seed site:** `_memberToCombatant` stamps `_speedExtraPerRound = _combatantExtraActions(m)` based on weapon `attackSpeed` tier: `fast` = 1 extra, `very_fast` = 2 extra (`CombatScreen.js:527`). At each round boundary in `_buildTurnOrder()`, each combatant's `_speedExtraRemaining` is reset to `_speedExtraPerRound` (`CombatScreen.js:652`).
- **Consume site:** `_executeTurn()` after the primary action and after mechanism A (`CombatScreen.js:2559`). If `_speedExtraRemaining > 0`, decrements and splices the actor back. Logged as "strikes again (fast weapon)!".
- **Behavior:** Only basic attacks — `_heroAI` for heroes (which calls `_basicAttack` since skills have their own MP/cooldown cost not reset between extra attacks), or `_enemyAI` for enemies.

### The problem for manual mode

Both mechanisms fire after the current actor's turn by re-inserting the actor into the turn order. In manual mode this means the player would get a second prompt immediately. Per the README: "consolidate multi-attack weapons into a single turn so a future 'bonus turn' slot can slot in."

**Exact current flow (per-tick):**
```
_executeTurn():
  pop actor
  _heroAI(actor)         ← primary action
  if actor.extraAction > 0:
    actor.extraAction--
    splice actor back at turnIdx   ← immediate re-pop next tick
  if actor._speedExtraRemaining > 0:
    actor._speedExtraRemaining--
    splice actor back at turnIdx   ← another immediate re-pop
  _checkCombatEnd()
```

Phase 02 must consolidate: run all extra attacks automatically (no player prompt) within the same logical "player turn," then advance to the next actor.

---

## 5. Companion AI — Current Behavior and Manual Mode Handoff

**Current behavior:**

Companions are built via `_memberToCombatant()` with `isCompanion: true` and placed in `this._companions`. They are included in `this._allies` and in `_buildTurnOrder()` alongside heroes and enemies.

When a companion's turn fires in `_executeTurn()`, `actor.isHero` is `true` (companions share the hero flag path — see `CombatScreen.js:386`: `isHero: true` set unconditionally by `_memberToCombatant`). The `_heroAI()` call then checks `partyMember.isCompanion || partyMember.class === 'companion'` to skip the `manualCombat` branch (`CombatScreen.js:2585`). Companions fall through to `pickHeroAction()` automatically.

**What changes for manual mode:**

The gate at `CombatScreen.js:2585` already handles this correctly:
```js
if (gs.manualCombat && actor.isHero && partyMember
    && !(partyMember.isCompanion || partyMember.class === 'companion')) {
  this._openManualActionPanel(...);
  return;
}
// companions fall through to pickHeroAction()
```

The companion auto-play path is correct. Phase 02 only needs to confirm that when the `_openManualActionPanel` replacement fires for a real hero, companions' turns continue to auto-resolve without interruption.

**One risk:** if `partyMember` lookup in `_heroAI` returns `undefined` for a companion (e.g. the companion is in `gs.companions` but the `[...gs.party, ...gs.companions].find()` call misses it), the companion falls through to the `decision` path unguarded. Review `CombatScreen.js:2575-2576` when refactoring.

---

## 6. DOM Structure Today

`_build()` (`CombatScreen.js:860`) injects this into `manager.uiOverlay`:

```
<div class="combat-screen">
  <div class="cbt-log-panel">          ← combat log (left side, scrollable)
    <div class="cbt-log-title">
    <div class="cbt-log-entries" id="cbt-log">
  </div>
  <div id="cbt-meter" class="cbt-meter-panel">  ← draggable DPS/heal/mit meter
    <div class="meter-head">
    <div class="meter-body">
  </div>
  <button id="cbt-meter-open">         ← "M" toggle button
  <div class="cbt-potion-belt" id="cbt-potion-belt">  ← above HUD
  <div class="cbt-hud" id="cbt-hud">   ← bottom bar (filled by _renderHud)
    <div class="hud-members">          ← flex row of .hm cards
      <div class="hm" id="hm-{id}">   ← one per ally
        <div class="hm-top">name + HP values
        <div class="hm-bars">
          <div class="hm-bar-t">       ← HP bar track
            <div class="hm-bar hp-bar">
            <div class="hm-bar shield-bar">  ← barrier
          <div class="hm-bar-t mp-t">  ← MP bar track
            <div class="hm-bar mp-bar">
        <div class="hm-statuses">      ← status icon row
    </div>
    <div class="hud-right">
      <div class="hud-round">         ← round counter
      <div class="hud-controls">
        tap-weapon button
        tap-utility button
        next-turn step button (pause mode only)
        speed cycle button
        pause button
    </div>
  </div>
  <div class="cbt-captions" id="cbt-captions">  ← accessibility captions
</div>
```

The actual combat scene (sprites, background, particles, floating numbers) is drawn entirely on `manager.canvas` via `draw(ctx)` — **not** inside this DOM tree.

**Distance from the new design:** The `.hm` cards are minimal (name + bars only). They have no portrait slot, no spell-button rail, no SVG border ornament. The HUD right column packs speed/pause/tap controls into ~100px vertical space; the new design needs that space for the turn-order strip. The overall structure (canvas for scene, DOM overlay for controls) is correct and matches the proposed design direction. Only the interior of `#cbt-hud` needs full replacement.

---

## 7. Known Debt / Risks Near the Combat Path

- **Sprite comment at `CombatScreen.js:163`:** Dragon expansion companions reuse `dragon_knight` art as a placeholder. If phase 05 regenerates backgrounds, those companions will still have placeholder sprites visible on screen.

- **M380 companion stat scaling (`CombatScreen.js:392-444`):** The effective-level HP/MP calc path has a branch that recomputes maxHp/Mp from the adjusted CON/INT, but only if `_effectiveLevel > m.level`. The standard `computeMaxHp(m)` path reads `m.attrs` not the locally-adjusted `base`. This creates a subtle divergence that is already noted in the code but not fixed. Not a blocker for the overhaul, but phase 02 should be aware when testing companion stats at high sync levels.

- **`_parryProcessing` recursion guard (`CombatScreen.js:3949`):** Riposte calls `_applyDamage` recursively. This boolean guard is fragile — any exception in the `try` block leaves `_parryProcessing = true` permanently for the fight (the `finally` block does clear it, but the recovery path calls `_basicAttack` which could re-throw). Low risk but worth noting.

- **`_manualOpen` guard (`CombatScreen.js:2623`):** The existing `_openManualActionPanel` has a `if (this._manualOpen) return` guard against double-open. The replacement input-wait model must carry an equivalent guard (`_awaitingInput` check in `_executeTurn`).

- **Speed persistence coupling (`CombatScreen.js:2689`):** On manual panel dismiss, `_speedMult` is restored to `prevSpeed`. If `prevSpeed` was 0 (combat debug pause mode), this restores to 0, which is correct. But if the player closed the panel via Escape (dispatch 'attack'), `prevSpeed` was the value before manual triggered — which could be 4×. The new model should restore speed only at end-of-player-turn, not per-panel-dismiss.

- **`manager.uiOverlay.appendChild(overlay)` (`CombatScreen.js:2684`):** The existing manual panel appends to `manager.uiOverlay`, which is the same layer as `this._el`. This works but bypasses the stacking context of `#cbt-hud`. The new card rail, living inside `#cbt-hud`, must ensure its z-index layer is the correct interactive target.

- **No turn-order DOM strip exists today.** `_buildTurnOrder()` produces `this._turnOrder` (array of combatant refs) but nothing renders it visually. Phase 04 (grid/camera) and phase 06 (card rail) need to agree on where the strip goes before `_buildTurnOrder` can feed it.

---

## 8. Implementation Budget Estimate

**Rough milestones: M387 – M394 (7–8 milestones)**

| Milestone | Scope | Rationale |
|---|---|---|
| M387 | Background regen + 2.5D grid math prototype | Phase 05 prompt work + phase 04 grid-cell layout math, perspective-square rendering. Canvas-only; no HUD changes. |
| M388 | Turn-order strip DOM + card rail skeleton | New HTML structure replacing `.hud-members`, portrait slot, HP/MP bars per card. No spell rail yet. |
| M389 | Spell rail per character (manual mode core) | Per-hero spell buttons, estimated damage, MP/CD display, click-to-cast wired to `_executeSkill`. Phase 06 deliverable. |
| M390 | Loop-pause player input model | Replace `_openManualActionPanel` with `_awaitingInput` flag; consolidate extra-attack turns; companions auto-resolve cleanly. Phase 02 deliverable. |
| M391 | SVG border + corner-ornament token system | Phase 07 deliverable. Purely visual; can ship independently of the game logic changes. |
| M392 | Spell-icon SVG language + tooltips | Phase 08+09 deliverable. Placeholder icon set wired into card rail buttons. |
| M393 | Mobile fit + turn-order collapse (iPhone 14 Pro) | Phase 10 deliverable. Portrait-lock, 44px touch targets, turn-strip collapse under menu. |
| M394 | Review + QA pass | Phase 12 roast pass, accessibility audit, combat replay regression against old formulas. |

**Why 8 milestones:** The canvas layout (2.5D grid), the DOM replacement (card rail), the game-loop change (player-input pause model), and the visual polish (SVG borders, icons) are all independent axes that can overlap but each carry risk of regressing the currently-stable auto-battle path. Tight milestones let the user accept or reject each axis before the next one stacks on top.

---

## Handoff to Phases 2 & 4

**Lifecycle anchors:**
1. Turn loop fires every `TURN_SPEED = 0.5s` in `update(dt)` at `CombatScreen.js:2438-2441`.
2. Actor dispatch at `CombatScreen.js:2477`; gate for player input at `CombatScreen.js:2585`.
3. Round boundary (status tick, mana regen, barrier regen, new initiative rolls) at `CombatScreen.js:2445-2473`.
4. `_buildTurnOrder()` re-runs every round; the sorted `this._turnOrder` array is the canonical initiative order for the new turn-order strip.

**Multi-attack flow (load-bearing for phase 02):**
- Mechanism A (`extraAction`, skill/haste-granted): seeded by `_executeSkill` + Haste status; consumed at `CombatScreen.js:2549`; splice-back is immediate.
- Mechanism B (`_speedExtraRemaining`, weapon tier): seeded at `CombatScreen.js:527` + reset at `CombatScreen.js:652`; consumed at `CombatScreen.js:2559`; splice-back is immediate.
- Both must be collapsed to auto-fire within one logical player turn (no second prompt) with no formula changes.

**Companion AI handoff:** Already gated at `CombatScreen.js:2585`. Correct as-is. Only risk: `partyMember` lookup missing a companion — audit `CombatScreen.js:2575`.

**DOM shape for phase 06:** Canvas = scene; `manager.uiOverlay` = all HTML controls. The `.hm` card is the unit to replace. Turn-order strip has no DOM yet — phase 04 must propose where it lives (above canvas, inside overlay).

**Formulas contract:** Keep `formulas.js` entirely. Keep `_applyDamage()`, `_executeSkill()`, `_basicAttack()`, `_processStatusEffects()`, `_regenMana()`. All refactor targets are in the input/output layer (UI, turn-loop control flow), not the math.

**Refactor budget:** ~8 milestones (M387–M394), with canvas grid and game-loop change as the highest-risk items. Background regen can slip to M388 without blocking the loop changes.
