/**
 * CLASS_PETS — class-specific pet companions unlocked via skill talents.
 * Each pet is a companion template keyed by pet ID.
 *
 * Companion sprite schema (wishlist M151):
 *   sprite        — base key under public/images/spritecook/. Optional; if
 *                   unset the runtime falls back to the companion id.
 *   portrait      — `{sprite}_portrait.png` (spriteUtils resolves automatically)
 *   south         — `{sprite}_south.png`   (standing/idle)
 *   east          — `{sprite}_east.png`    (facing right, in combat lineup)
 *   east_attack   — `{sprite}_east_attack.png` (attack pose)
 *   east_ko       — `{sprite}_east_ko.png`     (knocked-out pose)
 *
 * A companion may supply only south (current vanilla behaviour) — the 4-frame
 * set above unlocks richer combat visuals when present.
 *
 * Block view: companions CAN block — blockChance/blockPower come from the
 * shared `getCharacterBlockStats` helper (src/game/formulas.js), fed by any
 * shield they carry. A dedicated `east_block` frame is therefore a valid
 * optional frame mirroring heroes.
 *
 * Spell view: companions do NOT cast class skills — they're stat blocks
 * only, with no mpCost skill list. `east_spell` is intentionally omitted
 * from the companion schema.
 */

// M496+ canonical-data migration (Phase 2 step 8): CLASS_PETS and
// COMPANION_POWER are no longer inline literals. They are sourced from the
// single canonical JSON `public/data/entities/companions.json` via the
// centralized dataLoader.js (same pattern as ENEMIES / BOSS_PHASES / drop
// tables). The resolved objects are byte-identical to the legacy literals
// (id, name, class, ownerClass, attrs, description, sprite, power tiers all
// preserved verbatim — SAVE-COMPAT: a renamed/dropped pet/companion id would
// orphan a saved companion). Key/iteration order is not load-bearing here:
// CLASS_PETS is accessed by `CLASS_PETS[petId]` and COMPANION_POWER by id.
import { CLASS_PETS_CANONICAL, COMPANION_POWER_CANONICAL } from './dataLoader.js';

export const CLASS_PETS = CLASS_PETS_CANONICAL;

// M427 — companion power tiers (1-5). Used by tavern UI for cost + star
// rating, AND now by the simulator/combat to actually scale companion HP and
// damage. Power 3 is the baseline (1.0× scaling); each tier above/below
// shifts the per-level stat bonus by ±33%.
export const COMPANION_POWER = COMPANION_POWER_CANONICAL;

export function getCompanionPower(member) {
  if (typeof member?.power === 'number') return member.power;
  const id = member?.templateId || member?.id || '';
  if (COMPANION_POWER[id] != null) return COMPANION_POWER[id];
  // Strip the "_<timestamp>" suffix tavern hires append to runtime IDs.
  const baseId = String(id).replace(/_\d+$/, '');
  if (COMPANION_POWER[baseId] != null) return COMPANION_POWER[baseId];
  if (id.startsWith('pet_')) return 2;
  return 2;
}

// Multiplier applied on top of the per-level companion stat bonus so power
// tier translates into a meaningful damage spread. Power 3 = 1.0×, P1 = 0.33×,
// P5 = 1.67× — at level 20 a Power-5 dragon ends up with ~5× the per-level
// stat gain of a Power-1 War Dog.
export function companionPowerMult(power) {
  const p = Math.max(1, Math.min(5, power || 2));
  return p / 3;
}

