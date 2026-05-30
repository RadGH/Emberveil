/**
 * achievements — registry + check function.
 *
 * Achievements unlock based on lifetime + per-run stat thresholds. Persistence
 * lives in GameState.achievements (per save) AND a lifetime mirror keyed off
 * localStorage so unlocks survive save deletion / hardcore RIP.
 */

import { GameState } from './gameState.js';
import { getLifeStats } from './stats.js';
import { showToast } from '../ui/components/toast.js';

const LIFE_KEY = 'emberveil_life_achievements_v1';
let _lifeUnlocked = null;

function loadLifeUnlocked() {
  try { return JSON.parse(localStorage.getItem(LIFE_KEY) || '{}'); } catch (_) { return {}; }
}
function saveLifeUnlocked() {
  try { localStorage.setItem(LIFE_KEY, JSON.stringify(_lifeUnlocked)); } catch (_) {}
}

// Each achievement: { id, name, desc, tier, check(life, run) -> bool }.
// `life` is the lifetime totals object; `run` is the per-run snapshot.
export const ACHIEVEMENTS = [
  { id: 'first_blood',     name: 'First Blood',      desc: 'Score your first kill.',                  tier: 'bronze', check: (l) => l.totalKills >= 1 },
  { id: 'hundred_kills',   name: 'Centurion',        desc: 'Defeat 100 enemies.',                      tier: 'silver', check: (l) => l.totalKills >= 100 },
  { id: 'thousand_kills',  name: 'Slayer',           desc: 'Defeat 1,000 enemies.',                    tier: 'gold',   check: (l) => l.totalKills >= 1000 },
  { id: 'damage_10k',      name: 'Hard Hitter',      desc: 'Deal 10,000 total damage.',                tier: 'bronze', check: (l) => l.totalDamage >= 10000 },
  { id: 'damage_100k',     name: 'Wrath of Embers',  desc: 'Deal 100,000 total damage.',               tier: 'silver', check: (l) => l.totalDamage >= 100000 },
  { id: 'heal_10k',        name: 'Field Medic',      desc: 'Heal 10,000 HP across your career.',       tier: 'bronze', check: (l) => l.totalHeals >= 10000 },
  { id: 'heal_100k',       name: 'Lifebringer',      desc: 'Heal 100,000 HP.',                          tier: 'silver', check: (l) => l.totalHeals >= 100000 },
  { id: 'gold_10k',        name: 'Pouch Heavy',      desc: 'Earn 10,000 gold lifetime.',                tier: 'silver', check: (l) => l.totalGoldEarned >= 10000 },
  { id: 'fight_100',       name: 'Veteran',          desc: 'Win 100 fights.',                           tier: 'silver', check: (l) => l.fightsWon >= 100 },
  { id: 'perfect_10',      name: 'Untouchable',      desc: 'Win 10 fights with zero KOs.',              tier: 'gold',   check: (l) => l.perfectVictories >= 10 },
  { id: 'run_complete_1',  name: 'Vigil Ended',      desc: 'Complete your first run.',                  tier: 'gold',   check: (l) => l.runsCompleted >= 1 },
  { id: 'hardcore_die_1',  name: 'Mortal Oath',      desc: 'Fall in Hardcore mode (RIP screen).',       tier: 'bronze', check: (l) => l.hardcoreDeaths >= 1 },
  { id: 'big_hit_500',     name: 'Heavy Strike',     desc: 'Deal 500 damage in a single hit.',          tier: 'silver', check: (_, r) => r.perChar.some(c => c.stats.mostDamageHit >= 500) },
  { id: 'big_hit_2000',    name: 'Cataclysm',        desc: 'Deal 2,000 damage in a single hit.',        tier: 'gold',   check: (_, r) => r.perChar.some(c => c.stats.mostDamageHit >= 2000) },
  { id: 'streak_10',       name: 'Bloodstreak',      desc: 'Land a 10-kill streak in one run.',         tier: 'silver', check: (_, r) => r.perChar.some(c => c.stats.longestKillStreak >= 10) },
  { id: 'no_death_run',    name: 'Flawless March',   desc: 'Win 25 fights this run with zero deaths.',  tier: 'gold',   check: (_, r) => {
      const totalFights = r.perChar.reduce((a, c) => a + c.stats.fightsWon, 0) / Math.max(1, r.perChar.length);
      const deaths = r.perChar.reduce((a, c) => a + c.stats.deaths, 0);
      return totalFights >= 25 && deaths === 0;
    } },
];

export function getAchievementsState() {
  const gs = GameState.get();
  if (!gs.achievements) gs.achievements = {};
  if (!_lifeUnlocked) _lifeUnlocked = loadLifeUnlocked();
  return { current: gs.achievements, life: _lifeUnlocked };
}

/**
 * Build an achievements object pre-seeded from the global localStorage set so
 * that new-game / load never re-fires toasts for already-unlocked achievements.
 * Called by GameState.init() and GameState.load() (M314).
 */
export function buildInitialAchievements(savedAchievements) {
  if (!_lifeUnlocked) _lifeUnlocked = loadLifeUnlocked();
  // Merge: start with the global life set, then layer the save's own data on top
  // so per-save timestamps are preserved where available.
  const merged = {};
  for (const id of Object.keys(_lifeUnlocked)) {
    if (_lifeUnlocked[id]?.unlocked) {
      merged[id] = { ..._lifeUnlocked[id] };
    }
  }
  if (savedAchievements && typeof savedAchievements === 'object') {
    for (const [id, val] of Object.entries(savedAchievements)) {
      if (val?.unlocked) {
        merged[id] = { ...merged[id], ...val };
        // Also push back into life set if the save had something the global set missed.
        if (!_lifeUnlocked[id]?.unlocked) {
          _lifeUnlocked[id] = { unlocked: true, date: val.date || Date.now() };
        }
      }
    }
  }
  saveLifeUnlocked();
  return merged;
}

/**
 * Reset the global achievement store (account-wide). Clears localStorage.
 * The in-memory _lifeUnlocked cache is also cleared so subsequent
 * calls to loadLifeUnlocked() start fresh. Does NOT clear the current
 * GameState.achievements mirror — caller must handle that if needed.
 * M314 — used by Settings "Reset Achievements" button.
 */
export function resetGlobalAchievements() {
  _lifeUnlocked = {};
  try { localStorage.removeItem(LIFE_KEY); } catch (_) {}
}

let _toastQueue = [];
let _toastFlushScheduled = false;

function _queueToast(achievement) {
  _toastQueue.push(achievement);
  if (_toastFlushScheduled) return;
  _toastFlushScheduled = true;
  // Deferred so multiple unlocks in one tick can stack
  setTimeout(() => {
    const list = _toastQueue.slice();
    _toastQueue = [];
    _toastFlushScheduled = false;
    if (typeof window !== 'undefined' && window.dispatchEvent) {
      window.dispatchEvent(new CustomEvent('emberveil-achievement-unlocked', { detail: list }));
    }
    // M295: fire a gold-border toast for each newly unlocked achievement.
    for (const a of list) {
      _fireAchievementToast(a);
    }
  }, 0);
}

// M295 — Achievement unlock toast. Gold border, 6s dismiss.
// Tap opens the Achievements screen via a global hook set by the screen manager.
function _fireAchievementToast(a) {
  try {
    const TIER_LABEL = { bronze: 'Bronze', silver: 'Silver', gold: 'Gold' };
    const tier = TIER_LABEL[a.tier] || a.tier || '';
    const msg = `<strong style="color:#f8d860">Achievement Unlocked</strong><br>${a.name}${tier ? ` <span style="color:#c8a840;font-size:0.72em">(${tier})</span>` : ''}<br><span style="font-size:0.78em;color:#c0b090">${a.desc}</span>`;
    showToast(msg, {
      duration: 6000,
      variant: 'achievement',
      onClick: () => {
        // If the screen manager registered a hook to open achievements, call it.
        if (typeof window._emberveilOpenAchievements === 'function') {
          window._emberveilOpenAchievements(a.id);
        }
      },
    });
  } catch (_) {}
}

export function checkAchievements() {
  const { current, life } = getAchievementsState();
  // Build a lightweight run summary inline to avoid a circular import.
  const gs = GameState.get();
  const ids = [...(gs.party || []), ...(gs.companions || [])].map(p => p.id);
  const runSnap = {
    perChar: ids.map(id => ({ id, stats: gs.stats?.perChar?.[id] || {} })),
    global: gs.stats?.global || {},
  };
  const lifeGlobal = getLifeStats().global;
  const newly = [];
  for (const a of ACHIEVEMENTS) {
    if (current[a.id]?.unlocked) continue;
    let pass = false;
    try { pass = !!a.check(lifeGlobal, runSnap, gs); } catch (_) {}
    if (pass) {
      current[a.id] = { unlocked: true, date: Date.now() };
      life[a.id] = { unlocked: true, date: life[a.id]?.date || Date.now() };
      newly.push(a);
    }
  }
  if (newly.length) {
    _lifeUnlocked = life;
    saveLifeUnlocked();
    for (const a of newly) _queueToast(a);
  }
  return newly;
}
