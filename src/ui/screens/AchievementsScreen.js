/**
 * AchievementsScreen — tracks and displays player milestones
 * Achievements unlock based on GameState flags, fame, bosses defeated, etc.
 */
import { createEl, removeEl, injectStyles } from '../../utils/dom.js';
import { mount as kbMount, unmount as kbUnmount } from '../../utils/keyboardNav.js';
import { GameState } from '../../game/gameState.js';
import { syncFromGameState as syncClassUnlocks } from '../../game/classUnlocks.js';
import { newBadgeIfRecent } from '../../game/featureRegistry.js';
import { ACHIEVEMENTS as REGISTRY_ACHIEVEMENTS } from '../../game/achievements.js';

import { showToast } from '../components/toast.js';

// M314: read global (account-wide) achievement unlock state for display.
const _GLOBAL_ACH_KEY = 'emberveil_life_achievements_v1';
function _loadGlobalAchForScreen() {
  try { return JSON.parse(localStorage.getItem(_GLOBAL_ACH_KEY) || '{}'); } catch (_) { return {}; }
}
function _saveGlobalAchForScreen(data) {
  try { localStorage.setItem(_GLOBAL_ACH_KEY, JSON.stringify(data)); } catch (_) {}
}

const ACHIEVEMENTS = [
  // Combat
  { id: 'first_blood',     name: 'First Blood',         tier: 'bronze', icon: '⚔️',  desc: 'Win your first combat encounter.',             check: gs => (gs.completedBosses?.length > 0 || gs.storyFlags?.first_combat_won) },
  { id: 'boss_slayer',     name: 'Boss Slayer',          tier: 'bronze', icon: '💀',  desc: 'Defeat your first zone boss.',                 check: gs => gs.completedBosses?.length >= 1 },
  { id: 'act2_clear',      name: 'Into the Wastes',      tier: 'bronze', icon: '🔥',  desc: 'Reach the Ashen Wastes.',                      check: gs => gs.unlockedZones?.includes('dust_roads') },
  { id: 'act3_clear',      name: 'Hell Descends',        tier: 'silver', icon: '👹',  desc: 'Enter The Hell Breach.',                       check: gs => gs.unlockedZones?.includes('hell_breach') },
  { id: 'sovereign',       name: 'World Savior',         tier: 'gold',   icon: '🌟',  desc: 'Defeat the Emberveil Sovereign.',              check: gs => gs.completedBosses?.includes('core_boss') },
  // Party
  { id: 'full_party',      name: 'Strength in Numbers',  tier: 'bronze', icon: '🛡️',  desc: 'Have a party of 4 heroes.',                    check: gs => gs.party?.length >= 4 },
  { id: 'companions',      name: 'Trusty Companions',    tier: 'bronze', icon: '🐾',  desc: 'Hire your first companion.',                   check: gs => gs.companions?.length >= 1 },
  { id: 'full_roster',     name: 'Full Retinue',         tier: 'gold',   icon: '👥',  desc: 'Have 4 heroes and 4 companions at once.',      check: gs => gs.party?.length >= 4 && gs.companions?.length >= 4 },
  // Economy
  { id: 'rich',            name: 'Golden Touch',         tier: 'bronze', icon: '💰',  desc: 'Accumulate 1,000 gold.',                       check: gs => (gs.gold || 0) >= 1000 },
  { id: 'legendary_item',  name: 'Legendary Find',       tier: 'gold',   icon: '✨',  desc: 'Obtain a Legendary rarity item.',              check: gs => gs.inventory?.some(i => i.rarity === 'legendary') },
  { id: 'enchanted',       name: 'Enchanter\'s Patron',  tier: 'bronze', icon: '🔮',  desc: 'Use the Enchanter service.',                   check: gs => gs.storyFlags?.used_enchanter },
  { id: 'blacksmith',      name: 'Fine Craftsmanship',   tier: 'bronze', icon: '🔨',  desc: 'Upgrade an item at the Blacksmith.',           check: gs => gs.storyFlags?.used_blacksmith },
  // Fame
  { id: 'noticed',         name: 'Making a Name',        tier: 'bronze', icon: '⭐',  desc: 'Reach 20 Fame.',                               check: gs => (gs.fame || 0) >= 20 },
  { id: 'renowned',        name: 'Renowned Hero',        tier: 'silver', icon: '🌠',  desc: 'Reach 250 Fame.',                              check: gs => (gs.fame || 0) >= 250 },
  { id: 'legendary_fame',  name: 'Living Legend',        tier: 'gold',   icon: '👑',  desc: 'Reach 500 Fame.',                              check: gs => (gs.fame || 0) >= 500 },
  // Quests
  { id: 'first_quest',     name: 'Quest Seeker',         tier: 'bronze', icon: '📜',  desc: 'Open the Quest Log.',                          check: gs => gs.storyFlags?.opened_quest_log },
  { id: 'seer_met',        name: 'Seeker of Truth',      tier: 'bronze', icon: '🔭',  desc: 'Meet Mira the Seer.',                          check: gs => gs.storyFlags?.seer_met },
  // Survival
  { id: 'survived_defeat', name: 'Brush with Death',     tier: 'bronze', icon: '💔',  desc: 'Be defeated in combat and live to tell the tale.', check: gs => gs.storyFlags?.survived_defeat },
  { id: 'level_10',        name: 'Seasoned Veteran',     tier: 'silver', icon: '🎖️',  desc: 'Reach hero level 10.',                         check: gs => gs.party?.some(m => (m.level || 1) >= 10) },
  // Act 4 / NG+
  { id: 'act4_enter',      name: 'Cosmic Voyager',       tier: 'silver', icon: '🌌',  desc: 'Enter the Cosmic Rift.',                       check: gs => gs.unlockedZones?.includes('cosmic_rift') },
  { id: 'void_boss',       name: 'The Unraveler Falls',  tier: 'gold',   icon: '✦',   desc: 'Defeat The Unraveler and seal the Eternal Void.',check: gs => gs.completedBosses?.includes('void_boss') },
  { id: 'ng_plus',         name: 'New Game+',            tier: 'gold',   icon: '♾️',  desc: 'Begin a New Game+ run.',                       check: gs => (gs.ngPlus || 0) >= 1 },
  { id: 'ng_plus_2',       name: 'Twice-Born Legend',    tier: 'gold',   icon: '⚡',  desc: 'Complete New Game+ twice.',                    check: gs => (gs.ngPlus || 0) >= 2 },
  // Lore
  { id: 'codex_opened',    name: 'Lore Seeker',          tier: 'bronze', icon: '📖',  desc: 'Open the Codex.',                              check: gs => gs.storyFlags?.opened_codex },
  { id: 'forge_used',      name: 'The Forge Calls',      tier: 'bronze', icon: '⚒️',  desc: 'Salvage or craft an item at the Forge.',       check: gs => gs.storyFlags?.used_forge },
  { id: 'challenge_done',  name: 'Daily Champion',       tier: 'silver', icon: '⚡',  desc: 'Complete the Daily Challenge.',                check: gs => gs.storyFlags?.challenge_complete },
];

/**
 * Check GameState-based achievements (party size, companions, fame, etc.)
 * and fire toast notifications for newly unlocked ones. Call after any
 * action that could satisfy an achievement (hire, loot, boss kill, etc.).
 */
export function checkGameStateAchievements() {
  try {
    const gs = GameState.get();
    if (!gs) return;
    const global = _loadGlobalAchForScreen();
    const gsAch = gs.achievements || {};
    if (!gs.achievements) gs.achievements = {};
    const TIER_LABEL = { bronze: 'Bronze', silver: 'Silver', gold: 'Gold' };
    for (const a of ACHIEVEMENTS) {
      const id = a.id;
      if (global[id]?.unlocked || gsAch[id]?.unlocked) continue;
      let pass = false;
      try { pass = !!a.check(gs); } catch (_) {}
      if (!pass) continue;
      const now = Date.now();
      gs.achievements[id] = { unlocked: true, date: now };
      global[id] = { unlocked: true, date: now };
      _saveGlobalAchForScreen(global);
      // Fire toast
      try {
        const tier = TIER_LABEL[a.tier] || '';
        const msg = `<strong style="color:#f8d860">Achievement Unlocked</strong><br>${a.name}${tier ? ` <span style="color:#c8a840;font-size:0.72em">(${tier})</span>` : ''}<br><span style="font-size:0.78em;color:#c0b090">${a.desc}</span>`;
        showToast(msg, {
          duration: 6000,
          variant: 'achievement',
          onClick: () => { if (typeof window._emberveilOpenAchievements === 'function') window._emberveilOpenAchievements(id); },
        });
      } catch (_) {}
      if (typeof window !== 'undefined' && window.dispatchEvent) {
        window.dispatchEvent(new CustomEvent('emberveil-achievement-unlocked', { detail: [a] }));
      }
    }
  } catch (_) {}
}

const ACH_STYLES = `
.ach-screen {
  position: absolute; inset: 0; background: rgba(5,2,8,0.96);
  display: flex; flex-direction: column; overflow: hidden;
  font-family: 'Inter', sans-serif; color: #f0e8d8;
}
.ach-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 1rem 1.2rem 0.8rem; border-bottom: 1px solid rgba(232,160,32,0.2);
  background: rgba(232,160,32,0.05);
}
.ach-title { font-family: 'Cinzel', serif; font-size: 1.3rem; color: #e8a020; }
.ach-subtitle { font-size: 0.72rem; color: #8a7a6a; margin-top: 0.15rem; }
.ach-close { background: transparent; border: 1px solid rgba(240,232,216,0.2); color: #f0e8d8; padding: 0.5rem 1rem; border-radius: 6px; cursor: pointer; font-size: 0.78rem; min-height: 44px; }
.ach-progress-bar { height: 4px; background: rgba(232,160,32,0.12); }
.ach-progress-fill { height: 100%; background: #e8a020; transition: width 0.4s; }
.ach-grid { flex: 1; overflow-y: auto; padding: 1rem; display: grid; grid-template-columns: 1fr 1fr; gap: 0.7rem; }
.ach-card {
  background: rgba(20,14,8,0.8); border: 1px solid rgba(232,160,32,0.15);
  border-radius: 10px; padding: 0.75rem; display: flex; gap: 0.6rem; align-items: flex-start;
  transition: border-color 0.2s;
}
.ach-card.unlocked { border-color: rgba(232,160,32,0.5); background: rgba(232,160,32,0.07); }
.ach-card.locked { opacity: 0.45; }
.ach-icon { font-size: 1.6rem; flex-shrink: 0; line-height: 1; }
.ach-card.locked .ach-icon { filter: grayscale(1); }
.ach-info { min-width: 0; }
/* M337 — bumped fonts on the achievements grid for desktop legibility. */
.ach-name { font-size: 0.95rem; font-weight: 700; color: #f0e8d8; margin-bottom: 0.25rem; }
.ach-card.unlocked .ach-name { color: #e8a020; }
.ach-desc { font-size: 0.78rem; color: #a89788; line-height: 1.4; }
.ach-badge { font-size: 0.72rem; color: #60d080; margin-top: 0.35rem; }
`;

export class AchievementsScreen {
  constructor(manager, audio) {
    this.manager = manager;
    this.audio = audio;
    this._el = null;
  }

  onEnter() { this._build(); }
  onPause() { if (this._el) this._el.style.display = 'none'; }
  onResume() { if (this._el) this._el.style.display = ''; }
  onExit() { if (this._el) kbUnmount(this._el); removeEl(this._el); this._el = null; }

  _build() {
    injectStyles('ach-styles', ACH_STYLES);
    this._el = createEl('div', 'ach-screen');
    this.manager.uiOverlay.appendChild(this._el);

    const gs = GameState.get();
    // Mark quest log opened
    if (!gs.storyFlags.opened_quest_log) gs.storyFlags.opened_quest_log = true;
    // Sync any newly-satisfied class unlocks from current GameState.
    try { syncClassUnlocks(gs); } catch {}

    // M396 — merge stat-driven registry achievements (achievements.js) into
    // the display list so toasts that fire from there (Untouchable, Hard
    // Hitter, Centurion, etc.) actually show up on this screen.
    const TIER_ICONS = { bronze: '\u{1F949}', silver: '\u{1F948}', gold: '\u{1F947}' };
    const screenIds = new Set(ACHIEVEMENTS.map(a => a.id));
    const merged = ACHIEVEMENTS.slice();
    for (const r of REGISTRY_ACHIEVEMENTS) {
      if (screenIds.has(r.id)) continue;
      merged.push({
        id: r.id,
        name: r.name,
        icon: TIER_ICONS[r.tier] || '★',
        desc: r.desc,
        // Display-only check — registry unlocks come through globalUnlocked
        // / gsAch via the isUnlocked() lookup, so the check here is a no-op.
        check: () => false,
      });
    }
    const DISPLAY_ACHIEVEMENTS = merged;

    // M314: use the global (account-wide) store for display so achievements
    // earned across any run are shown as unlocked on this screen.
    const globalUnlocked = _loadGlobalAchForScreen();
    // An achievement is shown as unlocked if either the global store has it
    // OR the current run's gs.achievements has it.
    const gsAch = gs.achievements || {};
    const isUnlocked = (id) => !!(globalUnlocked[id]?.unlocked || gsAch[id]?.unlocked);

    const unlockedCount = DISPLAY_ACHIEVEMENTS.filter(a => isUnlocked(a.id)).length;
    const total = DISPLAY_ACHIEVEMENTS.length;
    const pct = Math.round(unlockedCount / total * 100);

    this._el.innerHTML = `
      <div class="ach-header">
        <div>
          <div class="ach-title">Achievements${newBadgeIfRecent('achievement_toasts')}</div>
          <div class="ach-subtitle">${unlockedCount} / ${total} unlocked (${pct}%)</div>
        </div>
        <button type="button" class="ach-close" id="ach-close">&#10005; Close</button>
      </div>
      <div class="ach-progress-bar">
        <div class="ach-progress-fill" style="width:${pct}%"></div>
      </div>
      <div class="ach-grid">
        ${DISPLAY_ACHIEVEMENTS.map(a => {
          const done = isUnlocked(a.id);
          return `
            <div class="ach-card ${done ? 'unlocked' : 'locked'}">
              <div class="ach-icon">${a.icon}</div>
              <div class="ach-info">
                <div class="ach-name">${a.name}</div>
                <div class="ach-desc">${a.desc}</div>
                ${done ? '<div class="ach-badge">&#10003; Unlocked</div>' : ''}
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `;

    this._el.querySelector('#ach-close').addEventListener('click', () => {
      this.audio.playSfx('click');
      this.manager.pop();
    });

    // M297: keyboard navigation — focus close button, Escape pops screen.
    kbMount(this._el, {
      layout: 'vertical',
      focusFirst: true,
      onEscape: () => { this.audio.playSfx('click'); this.manager.pop(); },
    });
  }
}
