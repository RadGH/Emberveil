/**
 * APPEARANCES — cosmetic character looks, decoupled from Class.
 *
 * A Class defines skills/talents/stats (src/game/classes.js).
 * An Appearance defines portrait + in-combat sprites (this file).
 *
 * A character stores BOTH a `class` and an `appearance`. This lets players
 * play a Cleric (class) with a Lightning-Mage look (appearance), or any
 * combination. Existing characters without an `appearance` field resolve
 * via `class` as a fallback for backwards compatibility.
 *
 * The `sprite` field is the filename prefix under public/images/spritecook/.
 * Every appearance is expected to have these 7 files:
 *   {sprite}_portrait.png
 *   {sprite}_south.png
 *   {sprite}_east.png
 *   {sprite}_east_attack.png
 *   {sprite}_east_spell.png
 *   {sprite}_east_block.png
 *   {sprite}_east_ko.png
 *
 * ## Gender field
 * Each entry carries `gender: 'male' | 'female'`.
 *
 * Resolution priority for future additions:
 *   1. Explicit `gender` field on the entry (authoritative).
 *   2. Suffix rule: id ends in `_female` → female; `_male` → male.
 *   3. `public/data/art_direction/<id>.json` → referenceSheet.prompt:
 *      "Human MAN" / "male" / "(male)" → male;
 *      "Human WOMAN" / "female" / "(female)" / "she/her" → female.
 *   4. Hard-coded fallback table in resolveGender() below.
 *
 * Use resolveGender(appearanceId) as the single resolution point so future
 * sprites "just work" as long as they follow the suffix convention or have an
 * art_direction JSON. Edit only resolveGender() to fix mis-assignments.
 *
 * ## Canonical data (Phase 2 step 9, M496+)
 * The inline APPEARANCES literal was migrated to canonical JSON:
 *   public/data/entities/heroes.json (62 playable) + npcs.json (22
 *   playable:false). APPEARANCES is now resolved by src/game/dataLoader.js
 *   (APPEARANCES_CANONICAL), which re-shapes the JSON into the legacy field
 *   order and reconstructs the legacy array sequence from an explicit ordered
 *   id manifest. resolveGender()'s fallback TABLE stays here — it is logic,
 *   not data. SAVE-COMPAT: every legacy appearance id is preserved verbatim
 *   (gated by scripts/verify-appearances-parity.mjs).
 */
import { APPEARANCES_CANONICAL } from './dataLoader.js';

/**
 * Resolve gender for any appearance id — single source of truth.
 *
 * Priority:
 *  1. Explicit `gender` field already on the APPEARANCES entry.
 *  2. Suffix: ends in `_female` or `_male`.
 *  3. Hard-coded fallback for known unsuffixed sids (verified from
 *     public/data/art_direction/<sid>.json referenceSheet.prompt).
 *
 * @param {string} id  - appearance sid
 * @param {string} [hint] - optional existing gender field (skip re-lookup)
 * @returns {'male'|'female'}
 */
export function resolveGender(id, hint) {
  if (hint === 'male' || hint === 'female') return hint;

  // Suffix rule (handles new sprites automatically)
  if (id.endsWith('_female')) return 'female';
  if (id.endsWith('_male'))   return 'male';

  // Hard-coded table for unsuffixed base sids.
  // Source: art_direction JSON prompts + user confirmation (2026-04-21).
  const TABLE = {
    warrior:      'male',
    fighter:      'male',
    paladin:      'male',
    ranger:       'female',
    rogue:        'female',   // art_direction/rogue.json: Human WOMAN
    mage:         'male',
    cleric:       'female',
    bard:         'male',     // art_direction/bard.json: Human MAN
    druid:        'female',
    necromancer:  'male',
    warlock:      'female',   // art_direction/warlock.json: Human WOMAN
    demon_hunter: 'male',     // art_direction/demon_hunter.json: Human MAN
    dragon_knight:'female',   // art_direction/dragon_knight.json: Human WOMAN
    pyromancer:   'female',
    stormcaller:  'male',     // art_direction/stormcaller.json: Human MAN
    oracle:       'female',   // art_direction/oracle.json: Young female seer
    swashbuckler: 'male',     // art_direction/swashbuckler.json: Human MAN
    scavenger:    'male',     // art_direction/scavenger.json: Human MAN
    tactician:    'male',     // art_direction/tactician.json: Human MAN
    chronomancer: 'male',     // art_direction/chronomancer.json: Human MAN (user-confirmed female variant is chronomancer_female)
    monk:         'male',     // art_direction/monk.json: Bald human male monk
    knight:       'female',   // art_direction/knight.json: Human WOMAN
    sorcerer:     'male',     // art_direction/sorcerer.json: Human male sorcerer
    shaman:       'female',   // art_direction/shaman.json: Tribal human female shaman
    witch_hunter: 'male',
    runesmith:    'male',     // art_direction/runesmith.json: Human MAN
    shadow_dancer:'female',   // art_direction/shadow_dancer.json: Human WOMAN
    // cleric_priestess has no art_direction JSON; name + classDefault imply female
    cleric_priestess: 'female',
  };
  return TABLE[id] ?? 'male'; // safe fallback
}

/**
 * APPEARANCES — resolved from canonical heroes.json + npcs.json via
 * dataLoader.js. Byte-identical (field-for-field, order-preserved) to the
 * legacy inline literal that lived here pre-M496. Do NOT re-introduce an
 * inline literal — edit the JSON + the order manifest in dataLoader.js.
 */
export const APPEARANCES = APPEARANCES_CANONICAL;


const APPEARANCE_BY_ID = new Map(APPEARANCES.map(a => [a.id, a]));

/** @returns {object|null} */
export function getAppearance(id) {
  return APPEARANCE_BY_ID.get(id) || null;
}

/** Default appearance for a given class id (falls back to matching id). */
export function getDefaultAppearance(classId) {
  return APPEARANCES.find(a => a.classDefault === classId && a.id === classId)
      || APPEARANCES.find(a => a.classDefault === classId)
      || APPEARANCE_BY_ID.get(classId)
      || null;
}

/** All appearances — unrestricted picker source. */
export function getAllAppearances() {
  return APPEARANCES.slice();
}

/**
 * Resolves the sprite prefix for a character, with graceful fallback to class.
 * @param {object} member
 * @returns {string|null} sprite prefix
 */
export function resolveSprite(member) {
  if (!member) return null;
  if (member.appearance) {
    const app = APPEARANCE_BY_ID.get(member.appearance);
    if (app) return app.sprite;
  }
  // Companions have class/cls === 'companion' (generic marker), so their real
  // sprite key lives in member.templateId (e.g. 'war_dog', 'dire_wolf') because
  // hired companions get a uniquified id like 'war_dog_1776409411678'. Prefer
  // templateId; fall back to id if none. Otherwise prefer class/template.
  const cls = member.class || member.cls;
  // Companions: templateId IS the sprite key (e.g. 'war_dog').
  if (cls === 'companion') return member.templateId || member.id || null;
  // Hires & player-created heroes: templateId is the character identity
  // ('borin', 'aela') which has no matching sprite file — the class-derived
  // sprite is the fallback. If the hire has an explicit appearance, the
  // `member.appearance` branch above already picked it up.
  return member.classId || cls || member.id || null;
}
