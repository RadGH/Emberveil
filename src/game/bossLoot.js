/**
 * bossLoot.js — M304 per-boss themed loot tables
 *
 * Each entry defines:
 *   bases    {string[]}  item base keys (weighted by their position)
 *   rarity   {string}    default rarity for all drops ('magic'|'rare'|'legendary')
 *   quality  {string}    item quality tier ('medium'|'high'|'elite'|'exotic')
 *   rolls    {number}    how many loot rolls from this table (in addition to the generic chest)
 *   uniques  {string[]}  M305: unique item IDs that can drop (one rolled at uniqueChance)
 *   uniqueChance {number} probability (0–1) to attempt a unique drop per boss kill (default 0.15)
 *
 * The themed table OVERRIDES the generic act-rarity loot for the additional
 * rolls. The regular zone chest (pre-rolled in _victory) is still granted on
 * top of boss-specific drops.
 *
 * Boss loot is keyed by the encounter ENEMY id (the single boss creature),
 * NOT the encounter id. This lets dungeons that re-use boss creatures grant
 * the same themed items.
 *
 * Phase 2 step 6 (canonical-data migration): the inline literal was removed.
 * BOSS_LOOT_TABLES now resolves from public/data/combat/drop-tables.json via
 * dataLoader.js (all canonical JSON loading is centralized there — no
 * scattered imports). The re-export below keeps every existing
 * `import { BOSS_LOOT_TABLES } from '.../bossLoot.js'` call site working
 * unchanged. Parity gate: scripts/verify-drop-tables-parity.mjs.
 */
export { BOSS_LOOT_TABLES } from './dataLoader.js';
import { BOSS_LOOT_TABLES } from './dataLoader.js';

/**
 * rollBossLoot
 * Generates themed loot drops for a boss encounter.
 * Returns an array of item objects (may be empty if generateItem fails).
 *
 * M305: also rolls for unique item drops from the boss's unique table.
 *
 * @param {string}   enemyId       — the boss enemy id
 * @param {Function} generateItem  — imported from items.js
 * @param {Function} [generateUnique] — M305: imported from uniques.js (optional)
 * @returns {object[]}
 */
export function rollBossLoot(enemyId, generateItem, generateUnique) {
  const table = BOSS_LOOT_TABLES[enemyId];
  if (!table) return [];

  const drops = [];

  // M305: unique item roll (one attempt per boss kill).
  if (generateUnique && table.uniques && table.uniques.length) {
    const chance = table.uniqueChance ?? 0.15;
    if (Math.random() < chance) {
      const uid = table.uniques[Math.floor(Math.random() * table.uniques.length)];
      try {
        const unique = generateUnique(uid);
        if (unique) drops.push(unique);
      } catch (_) {}
    }
  }

  // Regular themed rolls.
  for (let i = 0; i < table.rolls; i++) {
    const baseKey = table.bases[Math.floor(Math.random() * table.bases.length)];
    try {
      const item = generateItem(baseKey, table.rarity, table.quality);
      if (item) drops.push(item);
    } catch (_) { /* generateItem is not guaranteed to succeed for every base/rarity */ }
  }
  return drops;
}
