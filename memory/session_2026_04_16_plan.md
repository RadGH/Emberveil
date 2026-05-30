---
name: Session Plan 2026-04-16
description: Mega-batch user request covering combat balance, UI overhaul, blacksmith, tooltips, menus, sim parity, sprite generation. Use to resume if session dies.
type: project
---

# Session 2026-04-16 — batch

User's single message contained the following items. NO SILENT SHELVING — every item must ship or be explicitly deferred.

## Item list (verbatim, numbered for audit)

1. **Return to Town on death** — button does not route to town.
2. **Spell damage is too high** — 40 INT mage one-shots Primordial Nexus packs; Fireball ×4 = 472 dmg. Stats panel shows Spell Power +3.95 while Skills>Attributes shows 35-66. Unify values with actual formula.
3. **Multi-target damage reduction** — 2 targets 80%, 3 targets 60%, 4+ 50% (suggested; tweak math). Apply to physical AOE too.
4. **Burning status** — verify it applies a DoT at start of enemy turn; may be masked by Fireball one-shotting.
5. **Merge Forge into Blacksmith** (keep name Blacksmith). Tabs: Salvage | Craft | Upgrade (new 3rd tab = existing blacksmith). Upgrade uses 2 materials of same quality → +1 affix of that quality. No gold.
6. **Larger hero portraits on town** — `.hc-portrait` 80×80, image 5px padding → 70×70. Apply to Party Management and other screens with similar style.
7. **Hero portraits on Town top-left** too.
8. **Hero icon next to name on more screens** — Town top-left party window, Party Management, Inventory tab.
9. **Town right menu order** (bottom on mobile): View Map, Inventory, Skills, Tap Items, Quests, Menu.
10. **In-game menu mobile scroll** — should match main menu behavior. `.gm-overlay` align-items flex-start, add margin top/bottom. Restyle with standard game colors (match html pages).
11. **Codex Combat Math tab** — <ul> for melee heavy/light/magic has bad margins: buttons off-left, no line spacing, no bottom margin.
12. **Crit Chance + Crit Damage as AFFIXES** (not derived from DEX or attrs). Already exist as passives. Add formula to Codex. Enforce in simulator. Enemies have small crit chance too.
13. **Healer/shield AI priority** — Oracle used Fate Weave while mage at 30% HP instead of Foresight shield. Prioritize heal/shield when allies taking significant damage.
14. **Character Stats panel** — "Atts: (8/10/46/8)" split into STR/DEX/INT/CON rows under an "Attributes" group. Add "Other Effects" group for any non-zero extras (gold find, crit chance, etc). Same treatment on Party > Attributes.
15. **Item tooltips** — don't go off-screen on mobile. Mobile close button top-right. Wider tooltip window (up to browser width).
16. **More weapons + off-hands** — 4+ shields across acts. Higher base damage/armor; shields get block chance/power. Add more chest/legs/hands/feet. Skip rings/necklaces.
17. **Sharp affix physical-only** — applies to heavy+light attacks only (not magic). Add **Potency** (or similar) affix for spell power (e.g. "Potency: +2.1 SPELL"). Tooltip wider to prevent "of Regeneration: +1.61\n MANA_REGEN"-style line wraps (keep wraps between properties).
17b. **Weapon tooltip** — line for `Type: STR|DEX|INT`. Line for `Base Damage: 7-17` and `Total Damage: 10-24` (factoring equip bonus/attr). If equal, show single "Damage" line. Total is display-only but should match runtime calc.
18. **Tooltip persistence bug** — in Character Stats panel, last opened tooltip stays on desktop when hovering other things. Item tooltips close correctly — mimic.
19. **Base checkbox** in Character Stats scrolls to top — fix.
20. **Main Menu confirm dialog** — use custom prompt styled like in-game options, OK/Cancel. Skip warning if saved in last 60 s (or state unchanged).
21. **Settings > Save Backup** — add "Export Save / Import Save" (single save file w/ pick dialog; on import ask overwrite vs new for same party). Rename existing bulk to "Export Game Data / Import Game Data" with description.
22. **Combat Simulator** next to "Load from save" add "Load from file" (single save file, not bulk).
23. **Combat Simulator AI parity** — use same AI/spells/equipment/skills/passives as live. Auto-assign stats by class+level for manual chars (mage=INT+CON, warrior=STR+CON, etc.).
24. **Combat Simulator header** — change `"← Return to Game"` link to styled "Main Menu" button, vertically centered next to header.
25. **Sprite + BG generation continuation** — see `memory/next_session_checklist.md`. Add new images to `public/news/re-redesign.html` with prompts. Wire new combat BGs. Refresh Assets > Images, remove unused old graphics.

## Agent assignments (in-flight)
- A: Combat balance, AI, burning, multi-target, crit affixes, spell power display  (items 2,3,4,12,13,17-Sharp-Potency)
- B: Blacksmith merge + item variety  (items 5,16)
- C: Town UI + portraits + menu order + hero icons  (items 6,7,8,9)
- D: Tooltips + Character Stats split + weapon tooltip + base-checkbox-scroll  (items 14,15,17b,18,19, plus 17 cooperating)
- E: Return to town + in-game menu + main-menu confirm + save import/export + sim file load + sim main-menu-button  (items 1,10,20,21,22,24)
- F: Combat Simulator AI parity  (item 23)
- G: Codex Combat Math + crit formula doc  (item 11, part of 12)
- H: Sprite + BG generation (background)  (item 25)

Shared file coordination:
- `InventoryScreen.js` — Agent D (stats split + weapon tooltip + item tooltip lifecycle) owns. Agent C adds hero icon only in specific named region; coordinate if overlap.
- `CombatScreen.js` — Agent A owns combat logic (items 1 return-to-town, 2 spell dmg, 3 multi-target, 4 burning, 12 crit, 13 AI).
- `CombatSimulatorScreen.js` — Agent F owns (item 23); Agent E adds Main Menu button + Load from file (24, 22).
- `TownScreen.js` — Agent C owns.
- `ForgeScreen.js` → becomes Blacksmith — Agent B owns.
- `items.js` — Agent B owns content, Agent A adds Sharp/Potency affix logic.
- `SettingsScreen.js` / `GameMenuScreen.js` — Agent E owns.
- `FormulaCodexScreen.js` / `CodexScreen.js` — Agent G owns.

## Resume protocol
1. Check this file + `TaskList` for progress.
2. Re-run failing tests (`balance.test.js`) and inspect open items.
3. If any numbered item is unfinished, list it under a "DEFERRED" section here with reason, before releasing.
