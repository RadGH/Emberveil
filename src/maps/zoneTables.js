/**
 * Zone-keyed loot / fame / unlock / name maps + act-boss zone table
 * (extracted from mapData.js — refactor #2). Pure structural extraction.
 *
 * BOSS_TAP_DROPS is still resolved from the canonical JSON via dataLoader.js
 * (Phase 2 step 6) and re-exported here unchanged so the wiring is preserved.
 * Parity gate: scripts/verify-drop-tables-parity.mjs.
 */
import { BOSS_TAP_DROPS as BOSS_TAP_DROPS_CANONICAL } from '../game/dataLoader.js';

// M419 — zone-keyed loot/fame/unlock/name maps. Authoritative source;
// previously duplicated inside CombatScreen.js. Add a zone here only.
export const ZONE_DROP_CHANCE = { border_roads: 0.15, thornwood: 0.17, dust_roads: 0.18, ember_plateau: 0.20, hell_breach: 0.22, shattered_core: 0.23, cosmic_rift: 0.24, eternal_void: 0.25 };
export const ZONE_FAME_MULT = { border_roads: 1, thornwood: 1.5, dust_roads: 2, ember_plateau: 2.5, hell_breach: 3, shattered_core: 4, cosmic_rift: 5, eternal_void: 6 };
export const ZONE_UNLOCK_MAP = {
  prologue: 'border_roads',
  border_roads: 'thornwood', thornwood: 'dust_roads',
  dust_roads: 'ember_plateau', ember_plateau: 'hell_breach',
  hell_breach: 'shattered_core', shattered_core: 'cosmic_rift',
  cosmic_rift: 'eternal_void', eternal_void: 'abyssal_depths',
  abyssal_depths: 'primordial_nexus', primordial_nexus: 'dragons_reach',
  dragons_reach: 'dragon_throne', dragon_throne: null,
};
export const ZONE_NAMES = {
  border_roads: 'The Border Roads',
  thornwood: 'Thornwood Forest', dust_roads: 'The Dust Roads',
  ember_plateau: 'The Ember Plateau', hell_breach: 'The Hell Breach',
  shattered_core: 'The Shattered Core', cosmic_rift: 'The Cosmic Rift',
  eternal_void: 'The Eternal Void', abyssal_depths: 'The Abyssal Depths',
  primordial_nexus: 'The Primordial Nexus',
  dragons_reach: "The Dragon's Reach",
  dragon_throne: 'The Dragon Throne',
};
export const ACT_BOSS_ZONES = {
  prologue: 1, thornwood: 2, ember_plateau: 3, shattered_core: 4, eternal_void: 5, primordial_nexus: 6, dragon_throne: null,
};
export const BOSS_TAP_DROPS = BOSS_TAP_DROPS_CANONICAL;
