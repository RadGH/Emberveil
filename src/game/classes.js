/**
 * classes.js — class data accessor + derivation logic.
 *
 * Canonical data now lives in public/data/classes.json (the `classes` array
 * = the former CLASSES base literal, and `classTags` = the former CLASS_TAGS
 * literal), loaded via dataLoader.js. This file owns ALL class LOGIC:
 *   - deep-cloning the base entries and attaching the derived
 *     `unlockRequirement` + `tags` keys (the post-definition mutation),
 *   - the classHasTag() helper.
 *
 * The exported `CLASSES` / `CLASS_TAGS` are byte-identical to the
 * pre-migration inline literals (proven by
 * scripts/verify-builds-classes-parity.mjs).
 */
import { CLASSES_CANONICAL, CLASS_TAGS_CANONICAL } from './dataLoader.js';
import { STARTING_CLASS_IDS, UNLOCK_REQUIREMENTS } from './classUnlocks.js';

/**
 * All playable classes with base data. Deep-cloned from the canonical JSON so
 * the mutation loops below can attach derived keys without mutating the shared
 * imported document.
 */
export const CLASSES = CLASSES_CANONICAL.map((c) => ({ ...c }));

/**
 * M399 — class tags. Drives encounter/quest/event gating ("any healer in
 * party can tend the wounded soldier") instead of hard-coding specific
 * class ids on every dialog choice. Tags are flat strings; multiple tags
 * are matched OR-style.
 *
 * Tag vocabulary:
 *   archetype: heavy | light | melee | ranged | stealth | tank
 *   role:      healer | reviver | support | tracker | leader | hunter
 *   element:   holy | dark | shadow | fire | ice | storm | nature | arcane
 *   theme:     enchant | charm | craft | clockwork | draconic | time | prophetic | martial | duel
 *
 * Canonical source: public/data/classes.json → classTags.
 */
export const CLASS_TAGS = CLASS_TAGS_CANONICAL;

// Attach unlockRequirement to each class entry. Null = always available
// (starter). See src/game/classUnlocks.js for the authoritative map.
for (const cls of CLASSES) {
  cls.unlockRequirement = STARTING_CLASS_IDS.includes(cls.id)
    ? null
    : (UNLOCK_REQUIREMENTS[cls.id] || null);
}

for (const cls of CLASSES) {
  cls.tags = CLASS_TAGS[cls.id] || [];
}

/** Returns true when classId carries any of the given tag(s). */
export function classHasTag(classId, tagOrTags) {
  if (!classId) return false;
  const tags = CLASS_TAGS[classId] || [];
  if (Array.isArray(tagOrTags)) return tagOrTags.some(t => tags.includes(t));
  return tags.includes(tagOrTags);
}
