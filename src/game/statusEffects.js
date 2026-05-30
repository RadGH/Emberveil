/**
 * statusEffects.js — Shared status effect metadata.
 *
 * Single source of truth for STATUS_META used by CombatScreen, the Status
 * Effect Catalog (M299), and any other screen that names a status.
 *
 * Each entry:
 *   glyph  — single character shown in the HUD icon badge
 *   color  — CSS color for the icon ring and glyph
 *   name   — display name (title case, jargon-free)
 *   plain  — one sentence in player-friendly English (no DoT / buff / debuff)
 *
 * M497 canonical-data migration: STATUS_META is now loaded via the
 * centralized dataLoader (public/data/combat/status-effects.json).
 */

import { STATUS_META_CANONICAL } from './dataLoader.js';

export const STATUS_META = STATUS_META_CANONICAL;

