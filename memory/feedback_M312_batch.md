# Feedback batch posted on M302 (received during M307→M308 work, 2026-04-27)

User said: "Continue releasing milestones and use sub agents and aim to have the checklist and wishlist completed. Do not shelve items unless there is a meaningful blocker, not because of priority, time, or scale."

Schedule: finish original-plan M308 (number rounding + fame) — DONE as release index 311/312.
Finish original-plan M309 (news/archive/release tags) — NEXT.
Then assign feedback items below to fresh milestones M310-M313 (label-wise; actual indexes will be ~313+).

## Feedback items (bug fixes + UX)

### Combat / dungeon flow (HIGH priority — gameplay-blocking)
1. After dungeon completed, `.dg-screen` doesn't go away properly.
2. Combat screen sometimes becomes 0px height (height: 100% fixes it). May relate to dungeon UI. Mid-combat UI disappears. No JS errors.
3. Victory screen can go off-screen with many rewards; can't scroll to top.
4. Boss treasure currently drops 3 items at once — should be 3 to PICK from (one only). Pick-dialog items should NOT have character-suggestion borders (green); just rarity color.
5. After boss treasure pick dialog: filters should be rarity, not class suggestion.
6. Achievement screen during combat: doesn't pause; victory screen pops up over achievement screen.
7. Boss intro splash: old intro text still visible underneath new one; need to hide. Splash should wait for click — no countdown.
8. After defeating boss, moving to next map node, quit to main menu — got 500-fame guildmaster popup saying "got a sword" but no longer in game (popup persisted across teardown).

### Map / nav
9. First-node back-arrow popup ("← The Dust Roads") covers map nodes. Should be a floating box below the node: "Travel back to {X} [OK]". Box must not go off-screen or cover nodes.
10. From Map 2 first node clicking back arrow puts player at random node, not the boss node where they ended Map 1.
11. Hidden map items (fog-of-war hidden) still hoverable to reveal type/position. Should be uninteractable when hidden.
12. Change fog-of-war to be active by default.

### UI consistency / styling
13. Hire Custom Hero UI — 2nd page is missing CSS (used to work). Class select cards: text getting cut off, "chronomancer" wrapping. Make cards wider, use more screen space, don't let text get cut off. Flex layouts impose weird heights.
14. Inventory/Skills consistency update is "not great" — review.
15. Combat report "TOTAL HEAL 0.38999999999998636" — too many digits. Apply rounding throughout this menu (M308 did the helper but missed combat report).
16. Settings: remove difficulty (now under pause menu). Change-difficulty menu cannot be closed; cancel + apply don't work but background menus get changed.
17. Title screen: remove slide-down intro effect, fade-in immediately. No delays.
18. Title screen: frontmost cloud layer overlaps by ~1px.
19. Save menu busted — fixed-height cards don't fit content. Remove max-height from `.ls-slots`, let page scroll. `.ls-slot` → `flex: 0 1 auto` (the "1" matters). Make "Back" an actual floating button at bottom of screen.
20. Statistics menu: pressing Esc should close it, not open a menu.
21. After playing + reloading the page, statistics lost. Persist statistics if possible.
22. `input[type=checkbox]:checked:before` size off after global tap-target rule. Approximately `left:15px; width:13px; height:33px;` is close but doesn't look right — needs visual tuning.
23. Skills/Passives/Attributes: remove "Recommend" + "Auto" line that appears on all 3 tabs. Keep the green-background "Auto" checkbox per section (it works better). Remove "On"/"Off" text — checkmark icon suffices.
24. Skills/Passives/Attributes: "Base" checkbox → "Show Base Attributes". Apply to Inventory screen too.
25. Spells menu `.skill-header` has a useless bar (looks like a non-working close button) — hide it.
26. Spells menu `.skill-panel-head .panel-label` — remove "Skills - " prefix; just show class name.
27. Auto-skills/auto-attributes confirmation: replace browser default `confirm()` with custom modal.
28. Crafting/shop auto-equip: show toast "Equipped X to Y" matching combat-loot toast.
29. Blacksmith: add bottom margin beneath "Salvage All" button.
30. Enchanter tab: way too long; "?" buttons too big; each property on new row. Redesign — pick item first → property → type.
31. Tavern: Inventory + Party buttons go to OLD screens. Both should use new PartyPanelScreen and auto-navigate to corresponding tab.
32. PartyPanelScreen: redesign for gold/brown tones from old Character menu. Use Inter more than Cinzel except for certain labels. Top tabs should mirror town interface tabs (horizontal). 
33. PartyPanelScreen: clicking hero then Inventory/Skills opens OLD tabs not the new Party→Inventory subtabs. Since tabs are at top of page, the select menu may be unnecessary.
34. PartyPanelScreen: hide portrait inside `.equip-panel` because already shown in `.pps-char-row`.
35. PartyPanelScreen: change "Auto-Equip Upgrades" checkbox to match green-background style of Spells/Passives/Attributes Auto.
36. PartyPanelScreen: "Auto-equip upgrades" — when ON and an upgrade is available, AUTOMATICALLY equip it (not just notify).
37. Add 0.6rem bottom margin to `.inv-char-class` to match `.panel-label`.
38. Settings → Party menu great — should be reused on more screens.
39. Combat: replace big "E" button (enemy/secondary toggle) with "Combat Settings" pause-menu. Inside: show/hide DPS meter + Combat Log; if shown, DPS-meter offers "show enemies"; combat-log offers "show secondary effects". Move "Combat Captions" toggle from Settings here too.
40. Combat captions overlap bottom HP bar — move captions up slightly.
41. Settings → What's New → "release notes unavailable". Full History link goes to https://radgh.github.io/assets/changelog.html (404) instead of https://radgh.github.io/RSG-Demos/game13/assets/changelog.html. Use base path.

### XP / progression
42. XP gains: add catch-up mechanic for characters lower than party-average level.
43. In-game codex: many sections out of date. Especially Armor section says "curve rating coming soon" — but it's been implemented? Add all current formulas to codex.

## Distribution to milestones (proposed)
- **M310 (label) — Combat / dungeon flow critical bugs**: items 1, 2, 3, 4, 5, 6, 7, 8, 15, 39, 40
- **M311 (label) — Map / fog of war fixes**: 9, 10, 11, 12
- **M312 (label) — Settings / Title / Save UI fixes + party-menu unification**: 13, 14, 16, 17, 18, 19, 20, 21, 22, 27, 31, 32, 33, 34, 35, 36, 37, 38
- **M313 (label) — Skills/Spells/Inventory consistency + shop toasts + codex**: 23, 24, 25, 26, 28, 29, 30, 41, 42, 43

NOTE: actual release indices will be ~M313-M316 since previous releases drifted (M308 plan released as index 311/312 due to agent over-releasing).

## Additional feedback (received during M309 work, 2026-04-27 evening)

### Critical balance + persistence bugs
44. **Combat-sim reliability + level progression balance:**
    - Current Abyssal Depths combat is trivial — one-shotting bosses with full party. Example save: `/home/radgh/claude/assets/references/emberveil/saves/emberveil-save-rouge_the_rogue-2026-04-27.json`. Recent combat log shows party demolishing Genesis Worm + Reality Shards in 1 round each (153 / 289 / 45 dmg crits, 0 retaliation).
    - Run automated combat sim AND actual gameplay sim (M301 playthrough-sim) cross-reference. Verify sim reflects real-game outcomes.
    - Rebalance with the assumption that players will be a FULL PARTY equipping items + learning skills. Each act must get more difficult as the player gains loot and level-ups.
    - **Benchmark: damage dealt vs damage received**, not rounds-to-kill. Players should TAKE more damage. Adjust enemy hit chance + crit + damage formulas as needed.
    - Deep analysis required. Findings into wishlist or brainstorm doc.

45. **Achievement persistence bug:** Every new game shows a wall of achievement-unlock toasts. Achievements should be persistent across runs/saves (account-wide), not re-unlocked per playthrough.

User instruction: "Continue releasing milestones in the meantime until all wishlist items are completed and only shelve if there is an important blocker."

## Updated milestone distribution
- **M310 (label) — Critical combat/dungeon UI bugs** (items 1, 2, 3, 4, 5, 6, 7, 8, 15, 39, 40)
- **M311 (label) — Map / fog of war** (9, 10, 11, 12)
- **M312 (label) — Settings/Title/Save/Party UI unification** (13, 14, 16, 17, 18, 19, 20, 21, 22, 27, 31, 32, 33, 34, 35, 36, 37, 38)
- **M313 (label) — Skills/Spells/Inventory consistency + shop toasts + codex + News fix** (23, 24, 25, 26, 28, 29, 30, 41, 43)
- **M314 (label) — XP catch-up + achievement persistence** (42, 45)
- **M315 (label) — Balance analysis + rebalance pass** (44 — heavy task; deep simulation + adjustments + findings doc)
