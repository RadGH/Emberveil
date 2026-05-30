/**
 * bossDeathDialog.js — M307
 *
 * Cinematic death lines for each major boss.
 * Shown after boss defeat: fade + slow zoom overlay with 2-3 dialog lines
 * and a "Continue" button. Only fires for enemies with boss === true.
 *
 * Line schema: string, max ~80 chars each.
 * Three slots: bossLine, heroLine, narratorLine.
 */

/**
 * Phase 2 step 7 (canonical-data migration): the inline literal has been
 * deleted. BOSS_DEATH_DIALOG now comes from the single canonical source
 * `public/data/combat/boss-phases.json` via the centralized static-JSON
 * loader in dataLoader.js (`getBossDeathDialog()`). The resolved object is
 * value-identical to the former literal.
 */
import { getBossDeathDialog as _getBossDeathDialogMap } from './dataLoader.js';

export const BOSS_DEATH_DIALOG = _getBossDeathDialogMap();

/**
 * Get boss death dialog for a given enemy id.
 * Returns null if no dialog is defined (non-boss or unregistered boss).
 *
 * @param {string} enemyId
 * @returns {{ bossLine: string, heroLine: string, narratorLine: string }|null}
 */
export function getBossDeathDialog(enemyId) {
  return BOSS_DEATH_DIALOG[enemyId] || null;
}
