/**
 * featureRegistry.js — M298
 *
 * Maps feature keys to metadata including which milestone they shipped in.
 * Used by newBadgeIfRecent() to render "NEW" pills near recently-added features.
 * Extend this map every milestone to track newly shipped features.
 */

import { MILESTONE } from '../version.js';

// Feature map: key -> { name, shippedIn }
// shippedIn is a milestone number (integer). Keep newest entries at the top.
export const FEATURE_REGISTRY = {
  // M298 — current milestone features
  lore_compendium:    { name: 'Lore Compendium',   shippedIn: 298 },
  changelog_page:     { name: 'Changelog',          shippedIn: 298 },
  roadmap_page:       { name: 'Roadmap',            shippedIn: 298 },
  whats_new_splash:   { name: "What's New",         shippedIn: 298 },
  hardcore_monument:  { name: 'Monument',           shippedIn: 298 },

  // M295 features
  potion_belt:        { name: 'Potion Belt',        shippedIn: 295 },
  whats_new_button:   { name: "What's New",         shippedIn: 295 },
  achievement_toasts: { name: 'Achievement Toasts', shippedIn: 295 },

  // M294 features
  party_panel:        { name: 'Party Panel',        shippedIn: 294 },

  // M64 features
  black_market:       { name: 'Black Market',       shippedIn: 64  },
  forge:              { name: 'Forge',              shippedIn: 120 },
  achievements:       { name: 'Achievements',       shippedIn: 280 },

  // Role badges (PartyPanelScreen) — M293
  role_badges:        { name: 'Role Badges',        shippedIn: 293 },
};

/**
 * Returns a small "NEW" HTML pill string if the feature shipped within the
 * last RECENT_WINDOW milestones from the current build. Returns empty string
 * otherwise. Safe to call in any context — never throws.
 *
 * @param {string} featureKey  Key from FEATURE_REGISTRY
 * @param {number} [windowSize=3]  How many past milestones count as "new"
 * @returns {string}  HTML snippet or empty string
 */
export function newBadgeIfRecent(featureKey, windowSize = 3) {
  try {
    const entry = FEATURE_REGISTRY[featureKey];
    if (!entry) return '';
    const current = typeof MILESTONE === 'number' ? MILESTONE : parseInt(MILESTONE, 10);
    if (isNaN(current)) return '';
    if ((current - entry.shippedIn) <= windowSize) {
      return `<span class="feature-new-badge" aria-label="New in M${entry.shippedIn}" title="New in M${entry.shippedIn}" style="display:inline-flex;align-items:center;margin-left:5px;padding:1px 5px;background:rgba(64,168,96,0.2);border:1px solid rgba(64,168,96,0.45);border-radius:10px;font-size:10px;font-weight:700;color:#40c870;letter-spacing:0.05em;line-height:1.4;vertical-align:middle;font-family:var(--font-ui,'Inter',sans-serif)">NEW</span>`;
    }
    return '';
  } catch (_) {
    return '';
  }
}
