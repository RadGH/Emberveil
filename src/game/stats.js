/**
 * stats — per-character + global statistics tracker.
 *
 * Two scopes:
 *   - run:  per-current-game; lives on GameState.stats and resets on new game
 *   - life: cross-session totals; mirrored to localStorage so they outlive
 *           save deletion / hardcore RIP
 *
 * Per-character keys: damageDealt, damageTaken, kills, heals, healsReceived,
 *   nearDeaths (HP dropped to ≤25% in a round), assists, fightsWon, fightsLost,
 *   crits, dodges, blocks, mostDamageHit (single hit), longestKillStreak,
 *   currentKillStreak, deaths, revives.
 *
 * Per-character story log: array of { ts, type, summary, zoneId, npc, item }.
 *
 * Global keys (in stats.global): totalKills, totalDamage, totalHeals,
 *   totalGoldEarned, totalGoldSpent, totalXp, fightsWon, fightsLost, runsStarted,
 *   runsCompleted, hardcoreDeaths, perfectVictories (fight won with no losses).
 *
 * DPS series: stats.dpsSeries[charId] = [{ t (game-time seconds), dpsRolling }]
 *   capped to last 600 samples per character. Sampled by CombatScreen each
 *   resolved damage event.
 */

import { GameState } from './gameState.js';
import { checkAchievements } from './achievements.js';

const LIFE_KEY = 'emberveil_life_stats_v1';
// M312 #21: run-stats cache key — periodically flushed so reloading the page
// doesn't wipe per-session statistics. Cleared when a new run starts.
const RUN_STATS_KEY = 'emberveil_run_stats_cache_v1';
const MAX_LOG = 200;
const MAX_DPS_SAMPLES = 600;

// Throttled flush — write run stats at most once per 5 seconds during combat.
let _flushTimer = null;
function _scheduleRunStatsFlush() {
  if (_flushTimer) return;
  _flushTimer = setTimeout(() => {
    _flushTimer = null;
    _flushRunStatsNow();
  }, 5000);
}

/** Immediately write gs.stats to the localStorage cache. Safe to call any time. */
function _flushRunStatsNow() {
  try {
    const gs = GameState.get();
    if (gs.stats) localStorage.setItem(RUN_STATS_KEY, JSON.stringify(gs.stats));
  } catch (_) {}
}

/** Load cached run stats from localStorage (used on page reload). */
function loadCachedRunStats() {
  try {
    const raw = JSON.parse(localStorage.getItem(RUN_STATS_KEY) || 'null');
    if (raw && typeof raw === 'object' && raw.startedAt) return raw;
  } catch (_) {}
  return null;
}

/** Clear the run-stats cache (call when starting a new game). */
export function clearRunStatsCache() {
  try { localStorage.removeItem(RUN_STATS_KEY); } catch (_) {}
}

/**
 * Flush the current run stats to the localStorage cache immediately.
 * Call this at fight-end so the cache is always fresh — the throttled
 * _scheduleRunStatsFlush only fires 5 s after the LAST damage event,
 * which can miss kills that happen at the very end of combat.
 */
export function flushRunStatsCache() {
  _flushRunStatsNow();
}

function emptyCharStats() {
  return {
    damageDealt: 0, damageTaken: 0, kills: 0, heals: 0, healsReceived: 0,
    nearDeaths: 0, assists: 0, fightsWon: 0, fightsLost: 0, crits: 0,
    dodges: 0, blocks: 0, mostDamageHit: 0, longestKillStreak: 0,
    currentKillStreak: 0, deaths: 0, revives: 0,
  };
}

function emptyGlobal() {
  return {
    totalKills: 0, totalDamage: 0, totalHeals: 0,
    totalGoldEarned: 0, totalGoldSpent: 0, totalXp: 0,
    fightsWon: 0, fightsLost: 0, runsStarted: 0, runsCompleted: 0,
    hardcoreDeaths: 0, perfectVictories: 0,
  };
}

function emptyRunStats() {
  return {
    startedAt: Date.now(),
    perChar: {},      // charId -> emptyCharStats()
    log: {},          // charId -> [logEntry...]
    global: emptyGlobal(),
    dpsSeries: {},    // charId -> [{ t, dps }]
    fightTotals: { fights: 0, totalDamage: 0, totalHeals: 0 },
    // M285-M289 — extended tracking
    drops: [],                    // [{ ts, t, itemId, name, rarity, category, zoneId, magicFind }]
    damageBySkill: {},            // skillId -> { label, value, byChar: { charId -> value } }
    damageByElement: {},          // element -> total
    damageTakenBySource: {},      // sourceKey -> total ('enemy:goblin_scout' | 'status:burn')
    powerSeries: {},              // charId -> [{ t, power }]
    skillCastCounts: {},          // charId -> { skillId -> count }
    fightLog: [],                 // [{ ts, kind: 'regular'|'boss'|'dungeon', zoneId, durationSec, won }]
    // M415 — per-combat per-character summary, persisted across reload + cloud
    combatHistory: [],            // [{ ts, startedAt, durationSec, won, zoneId, kind, perChar: [{id,name,class,dmgDealt,dmgTaken,heals,kills,deaths,mvp}], totals }]
    _fightSnapshot: null,         // transient: { startedAt, partyIds, snap: { charId -> {dmg,taken,heals,kills,deaths} } }
  };
}

const MAX_COMBAT_HISTORY = 200;

function loadLife() {
  try {
    const raw = JSON.parse(localStorage.getItem(LIFE_KEY) || 'null');
    if (raw && typeof raw === 'object') return { global: { ...emptyGlobal(), ...(raw.global || {}) }, runHistory: raw.runHistory || [] };
  } catch (_) {}
  return { global: emptyGlobal(), runHistory: [] };
}
function saveLife(life) {
  // M402: stamp savedAt on every write so the Stats screen can surface
  // "Last saved: …" feedback. Helps debug "my stats vanished on refresh"
  // reports — if the timestamp is recent, persistence is working.
  try { life.savedAt = Date.now(); } catch (_) {}
  try { localStorage.setItem(LIFE_KEY, JSON.stringify(life)); } catch (_) {}
  // M400 — also push lifetime stats to supabase when signed in. Cap the
  // payload at 200 KB after JSON.stringify; if larger, trim runHistory
  // (oldest first) until under cap. Fire-and-forget; failure never blocks
  // the local write. The cloud key matches LIFE_KEY so the same record
  // round-trips on next sign-in via cloudSaves.readCloud.
  try {
    if (typeof window !== 'undefined' && window.__cloudSaves?.isAvailable) {
      let payload = life;
      const MAX = 200 * 1024;
      let json = JSON.stringify(payload);
      if (json.length > MAX && Array.isArray(payload.runHistory)) {
        const trimmed = { global: payload.global, runHistory: payload.runHistory.slice() };
        while (JSON.stringify(trimmed).length > MAX && trimmed.runHistory.length > 1) {
          trimmed.runHistory.shift();
        }
        payload = trimmed;
      }
      window.__cloudSaves.pushSave(LIFE_KEY, payload);
    }
  } catch (_) {}
}

/**
 * M400 — pull lifetime stats from supabase on sign-in / app boot. Merges with
 * the local copy by taking the larger global counters (max-merge) and
 * concatenating any cloud-only run history entries. Idempotent.
 */
export async function pullLifeFromCloud() {
  try {
    if (typeof window === 'undefined' || !window.__cloudSaves?.isAvailable) return false;
    const row = await window.__cloudSaves.readCloud(LIFE_KEY);
    if (!row || !row.state) return false;
    const cloud = row.state;
    if (!cloud.global) return false;
    const local = loadLife();
    const merged = { global: {}, runHistory: [] };
    // Max-merge each numeric counter so a stale device never overwrites a
    // newer one. Object/array fields fall back to "non-empty wins" with
    // cloud preferred when the local entry is empty.
    const allKeys = new Set([...Object.keys(local.global || {}), ...Object.keys(cloud.global || {})]);
    for (const k of allKeys) {
      const a = local.global?.[k]; const b = cloud.global?.[k];
      if (typeof a === 'number' || typeof b === 'number') merged.global[k] = Math.max(+a || 0, +b || 0);
      else if (a && typeof a === 'object' && b && typeof b === 'object') merged.global[k] = { ...a, ...b };
      else merged.global[k] = b ?? a ?? null;
    }
    // Run history: concat + dedupe by timestamp. Cap at 200 entries.
    const seen = new Set();
    const combined = [...(local.runHistory || []), ...(cloud.runHistory || [])];
    for (const r of combined) {
      const key = r?.startedAt || r?.endedAt || JSON.stringify(r).slice(0, 64);
      if (seen.has(key)) continue;
      seen.add(key);
      merged.runHistory.push(r);
    }
    merged.runHistory = merged.runHistory.slice(-200);
    saveLife(merged);
    _life = merged;
    return true;
  } catch (e) {
    try { console.warn('[stats] pullLifeFromCloud failed:', e); } catch (_) {}
    return false;
  }
}

let _life = null;

export function ensureStats() {
  const gs = GameState.get();
  if (!gs.stats) {
    // M312 #21: try to restore run stats from the localStorage cache first
    // (survives a page reload mid-session without a manual save).
    const cached = loadCachedRunStats();
    gs.stats = cached || emptyRunStats();
  } else {
    // M385: the save may have been written mid-run. The throttled RUN_STATS_KEY
    // cache may hold newer data for the same run (e.g. combat that happened
    // after the last manual save). If the cache is for the same run AND has
    // higher total damage (proxy for "more accumulated"), prefer the cache.
    const cached = loadCachedRunStats();
    if (cached && cached.startedAt === gs.stats.startedAt &&
        (cached.global?.totalDamage ?? 0) > (gs.stats.global?.totalDamage ?? 0)) {
      gs.stats = cached;
    }
  }
  // M385: backfill any extended fields that may be absent on stats objects
  // restored from saves that predate M285-M289 extended tracking additions.
  const s = gs.stats;
  const blank = emptyRunStats();
  for (const key of Object.keys(blank)) {
    if (!(key in s)) s[key] = blank[key];
  }
  if (!_life) _life = loadLife();
  return gs.stats;
}

export function getLifeStats() {
  if (!_life) _life = loadLife();
  return _life;
}

function _charStats(charId) {
  const s = ensureStats();
  if (!s.perChar[charId]) s.perChar[charId] = emptyCharStats();
  return s.perChar[charId];
}
function _charLog(charId) {
  const s = ensureStats();
  if (!s.log[charId]) s.log[charId] = [];
  return s.log[charId];
}

export function appendLog(charId, type, summary, extras = {}) {
  if (!charId) return;
  const log = _charLog(charId);
  log.push({ ts: Date.now(), type, summary, ...extras });
  if (log.length > MAX_LOG) log.splice(0, log.length - MAX_LOG);
}

// ── Event ingestion ────────────────────────────────────────────────────────

export function recordDamageDealt(attacker, target, amount, opts = {}) {
  // M312 #21: schedule a throttled flush so stats survive page reload.
  _scheduleRunStatsFlush();
  if (!attacker || !target || amount <= 0) return;
  const a = _charStats(attacker.id);
  a.damageDealt += amount;
  if (amount > a.mostDamageHit) a.mostDamageHit = amount;
  if (opts.crit) a.crits++;
  const s = ensureStats();
  s.global.totalDamage += amount;
  s.fightTotals.totalDamage += amount;
  // DPS sample
  const series = s.dpsSeries[attacker.id] || (s.dpsSeries[attacker.id] = []);
  const t = Math.floor((Date.now() - s.startedAt) / 1000);
  series.push({ t, dps: amount });
  if (series.length > MAX_DPS_SAMPLES) series.splice(0, series.length - MAX_DPS_SAMPLES);
  // Lifetime
  if (!_life) _life = loadLife();
  _life.global.totalDamage += amount;
  saveLife(_life);
  // Mark target damageTaken (only if target is a hero)
  if (!target.enemyId) {
    const t2 = _charStats(target.id);
    t2.damageTaken += amount;
    const max = target.maxHp || target.hp || 1;
    if (target.hp - amount <= max * 0.25 && target.hp - amount > 0) {
      t2.nearDeaths++;
      appendLog(target.id, 'near_death', `Survived a hit at ${Math.max(0, target.hp - amount)}/${max} HP.`, { zoneId: GameState.get().zoneId });
    }
  }
}

export function recordKill(attacker, target, opts = {}) {
  if (!attacker) return;
  const a = _charStats(attacker.id);
  a.kills++;
  a.currentKillStreak++;
  if (a.currentKillStreak > a.longestKillStreak) a.longestKillStreak = a.currentKillStreak;
  const s = ensureStats();
  s.global.totalKills++;
  if (!_life) _life = loadLife();
  _life.global.totalKills++;
  saveLife(_life);
  // Major kill log entry
  if (target?.isBoss || target?.tier === 'boss' || opts.boss) {
    appendLog(attacker.id, 'major_kill', `Slew ${target?.name || 'a boss'}.`, { zoneId: GameState.get().zoneId, npc: target?.name });
  } else if (target?.tier === 'elite' || opts.elite) {
    appendLog(attacker.id, 'elite_kill', `Defeated ${target?.name || 'an elite'}.`, { zoneId: GameState.get().zoneId, npc: target?.name });
  }
  checkAchievements();
}

export function recordHeal(healer, target, amount) {
  if (!healer || amount <= 0) return;
  const h = _charStats(healer.id);
  h.heals += amount;
  if (target && target.id !== healer.id && !target.enemyId) {
    const t = _charStats(target.id);
    t.healsReceived += amount;
  }
  const s = ensureStats();
  s.global.totalHeals += amount;
  s.fightTotals.totalHeals += amount;
  if (!_life) _life = loadLife();
  _life.global.totalHeals += amount;
  saveLife(_life);
}

export function recordDodge(target) {
  if (!target || target.enemyId) return;
  const t = _charStats(target.id);
  t.dodges++;
}

export function recordBlock(target) {
  if (!target || target.enemyId) return;
  const t = _charStats(target.id);
  t.blocks++;
}

export function recordDeath(char) {
  if (!char || char.enemyId) return;
  const c = _charStats(char.id);
  c.deaths++;
  c.currentKillStreak = 0;
  appendLog(char.id, 'death', `Fell in battle.`, { zoneId: GameState.get().zoneId });
}

export function recordRevive(char) {
  if (!char) return;
  _charStats(char.id).revives++;
}

export function recordFightStart(party = null) {
  const s = ensureStats();
  s.fightTotals = { fights: (s.fightTotals.fights || 0), totalDamage: 0, totalHeals: 0 };
  // M415 — snapshot per-character counters so recordFightEnd can compute deltas.
  const partyList = Array.isArray(party) && party.length
    ? party
    : [...(GameState.get().party || []), ...(GameState.get().companions || [])];
  const snap = {};
  for (const p of partyList) {
    if (!p?.id) continue;
    const c = _charStats(p.id);
    snap[p.id] = {
      dmg: c.damageDealt || 0,
      taken: c.damageTaken || 0,
      heals: c.heals || 0,
      kills: c.kills || 0,
      deaths: c.deaths || 0,
    };
  }
  s._fightSnapshot = {
    startedAt: Date.now(),
    partyIds: partyList.filter(p => p?.id).map(p => ({ id: p.id, name: p.name, class: p.class })),
    snap,
    zoneId: GameState.get().zoneId || null,
  };
}
export function recordFightEnd(victory, party = []) {
  const s = ensureStats();
  s.fightTotals.fights = (s.fightTotals.fights || 0) + 1;
  for (const p of party) {
    if (!p) continue;
    const c = _charStats(p.id);
    if (victory) c.fightsWon++; else c.fightsLost++;
  }
  if (victory) s.global.fightsWon++;
  else s.global.fightsLost++;
  if (!_life) _life = loadLife();
  if (victory) _life.global.fightsWon++;
  else _life.global.fightsLost++;
  // M415 — emit per-combat summary (delta from start snapshot) into combatHistory.
  try {
    const fs = s._fightSnapshot;
    if (fs) {
      const perChar = [];
      let totalDmg = 0, totalHeals = 0;
      const idMeta = new Map(fs.partyIds.map(p => [p.id, p]));
      const allIds = new Set([...Object.keys(fs.snap), ...party.map(p => p?.id).filter(Boolean)]);
      for (const id of allIds) {
        const c = _charStats(id);
        const before = fs.snap[id] || { dmg: 0, taken: 0, heals: 0, kills: 0, deaths: 0 };
        const dmg = Math.max(0, (c.damageDealt || 0) - before.dmg);
        const taken = Math.max(0, (c.damageTaken || 0) - before.taken);
        const heals = Math.max(0, (c.heals || 0) - before.heals);
        const kills = Math.max(0, (c.kills || 0) - before.kills);
        const deaths = Math.max(0, (c.deaths || 0) - before.deaths);
        if (dmg + taken + heals + kills + deaths === 0) continue;
        const meta = idMeta.get(id) || party.find(p => p?.id === id) || { id };
        perChar.push({
          id, name: meta.name || id, class: meta.class || null,
          dmgDealt: Math.round(dmg), dmgTaken: Math.round(taken),
          heals: Math.round(heals), kills, deaths,
        });
        totalDmg += dmg;
        totalHeals += heals;
      }
      // MVP = highest dmgDealt + heals*0.6
      if (perChar.length) {
        let bestId = perChar[0].id, bestScore = -1;
        for (const r of perChar) {
          const score = r.dmgDealt + (r.heals * 0.6);
          if (score > bestScore) { bestScore = score; bestId = r.id; }
        }
        for (const r of perChar) r.mvp = (r.id === bestId);
      }
      const entry = {
        ts: Date.now(),
        startedAt: fs.startedAt,
        durationSec: Math.max(0, Math.round((Date.now() - fs.startedAt) / 1000)),
        won: !!victory,
        zoneId: fs.zoneId,
        kind: 'regular',
        perChar,
        totals: { damage: Math.round(totalDmg), heals: Math.round(totalHeals) },
      };
      if (!Array.isArray(s.combatHistory)) s.combatHistory = [];
      s.combatHistory.push(entry);
      if (s.combatHistory.length > MAX_COMBAT_HISTORY) {
        s.combatHistory.splice(0, s.combatHistory.length - MAX_COMBAT_HISTORY);
      }
    }
    s._fightSnapshot = null;
  } catch (_) {}
  // Perfect victory: every party hero alive at end
  if (victory && party.length && party.every(p => p && p.alive !== false && (p.hp ?? 1) > 0)) {
    s.global.perfectVictories++;
    _life.global.perfectVictories++;
  }
  saveLife(_life);
  checkAchievements();
  // M288 — sample power score for each party hero on fight end so the
  // Power growth chart updates automatically as the run progresses.
  try {
    import('./powerScore.js').then(m => {
      for (const p of party) {
        if (p && !(p.isCompanion || p.class === 'companion')) {
          recordPowerSnapshot(p.id, m.computePowerScore(p));
        }
      }
    });
  } catch (_) {}
  // Immediately flush perChar + global to the RUN_STATS_KEY cache so that
  // a page reload right after combat restores the complete picture.
  // The throttled _scheduleRunStatsFlush only fires 5 s after the last
  // damage event and can miss kills/damage accumulated at the very end.
  _flushRunStatsNow();
  // M469 fix — push combatHistory to Supabase after EVERY fight, not just at
  // run-end. Previously, flushRunStatsToCloud() was exported but never called,
  // so combat_history in the run_stats table was only written on recordRunCompleted()
  // / recordHardcoreDeath(). Any run that was still in progress at page-refresh
  // would show an empty combat log on the Stats screen.
  _pushCombatHistoryToCloud();
}

/** Fire-and-forget: push the current combatHistory to Supabase run_stats.upsert().
 *  M474 — also passes hero metadata so the row gets created on first push if
 *  it doesn't exist (e.g. loading a save without ever calling recordRunStarted).
 *  Previously this silently no-op'd because the underlying call was UPDATE
 *  without WHERE matching anything. */
function _pushCombatHistoryToCloud() {
  try {
    const gs = GameState.get();
    if (!gs?.stats) return;
    const runId = _ensureRunId();
    const hero = gs?.party?.[0];
    const maxLevel = Math.max(1, ...((gs?.party || []).map(m => m.level || 1)));
    let difficulty = 'normal';
    try { difficulty = localStorage.getItem('emberveil_difficulty') || 'normal'; } catch (_) {}
    const payload = {
      heroName: hero?.name,
      heroClass: hero?.class,
      heroAppearance: hero?.appearance,
      difficulty,
      hardcore: !!gs?.hardcore,
      totals: gs.stats.global || {},
      perChar: gs.stats.perChar || {},
      combatHistory: (gs.stats.combatHistory || []).slice(-50),
      maxLevel,
      zonesCleared: (gs?.unlockedZones || []).length,
    };
    if (window.__statsDebug) {
      console.log('[stats] _pushCombatHistoryToCloud', {
        runId,
        combatHistoryLen: payload.combatHistory.length,
        maxLevel,
        hero: hero?.name,
      });
    }
    _cloudSafe(c => c.update(runId, payload));
  } catch (_) {}
}

export function recordGold(delta) {
  const s = ensureStats();
  if (!_life) _life = loadLife();
  if (delta > 0) { s.global.totalGoldEarned += delta; _life.global.totalGoldEarned += delta; }
  else if (delta < 0) { s.global.totalGoldSpent += -delta; _life.global.totalGoldSpent += -delta; }
  saveLife(_life);
}
export function recordXp(amount) {
  const s = ensureStats();
  s.global.totalXp += amount;
  if (!_life) _life = loadLife();
  _life.global.totalXp += amount;
  saveLife(_life);
}
/** M325: synthetic per-run id, persisted on the active GameState so a single
 * run reports under one row across update/finish calls. */
function _ensureRunId() {
  const gs = GameState.get();
  if (!gs._runStatsId) {
    gs._runStatsId = (typeof crypto !== 'undefined' && crypto.randomUUID)
      ? crypto.randomUUID()
      : `run-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }
  return gs._runStatsId;
}

/** Fire-and-forget: push to Supabase if signed in; never throws. */
function _cloudSafe(fn) {
  try {
    import('../auth/runStatsClient.js').then(({ runStatsClient }) => {
      try { fn(runStatsClient); } catch (_) {}
    }).catch(() => {});
  } catch (_) {}
}

/** M330 — fire a Google Analytics event if consent is granted. */
function _gaEvent(name, props) {
  try {
    if (typeof window !== 'undefined' && typeof window.__rsgPushEvent === 'function') {
      window.__rsgPushEvent(name, props || {});
    }
  } catch (_) {}
}

export function recordRunStarted() {
  if (!_life) _life = loadLife();
  _life.global.runsStarted++;
  saveLife(_life);
  // M325: mirror to Supabase if available.
  try {
    const gs = GameState.get();
    const hero = gs?.party?.[0];
    const runId = _ensureRunId();
    let difficulty = 'normal';
    try { difficulty = localStorage.getItem('emberveil_difficulty') || 'normal'; } catch (_) {}
    _cloudSafe(c => c.start({
      runId,
      heroName: hero?.name,
      heroClass: hero?.class,
      heroAppearance: hero?.appearance,
      difficulty,
      hardcore: !!gs?.hardcore,
    }));
    _gaEvent('run_started', {
      hero_class: hero?.class,
      difficulty,
      hardcore: !!gs?.hardcore,
    });
  } catch (_) {}
}
export function recordRunCompleted() {
  if (!_life) _life = loadLife();
  _life.global.runsCompleted++;
  saveLife(_life);
  // M325: cloud finish.
  try {
    const gs = GameState.get();
    const runId = _ensureRunId();
    const maxLevel = Math.max(1, ...((gs?.party || []).map(m => m.level || 1)));
    _cloudSafe(c => c.finish(runId, {
      outcome: 'win',
      totals: gs?.stats?.global || {},
      perChar: gs?.stats?.perChar || {},
      combatHistory: (gs?.stats?.combatHistory || []).slice(-50),
      maxLevel,
      zonesCleared: (gs?.unlockedZones || []).length,
    }));
    _gaEvent('run_completed_win', {
      max_level: maxLevel,
      zones_cleared: (gs?.unlockedZones || []).length,
    });
  } catch (_) {}
}
export function recordHardcoreDeath() {
  if (!_life) _life = loadLife();
  _life.global.hardcoreDeaths++;
  saveLife(_life);
  // M325: cloud finish (died).
  try {
    const gs = GameState.get();
    const runId = _ensureRunId();
    const maxLevel = Math.max(1, ...((gs?.party || []).map(m => m.level || 1)));
    _cloudSafe(c => c.finish(runId, {
      outcome: 'died',
      totals: gs?.stats?.global || {},
      perChar: gs?.stats?.perChar || {},
      combatHistory: (gs?.stats?.combatHistory || []).slice(-50),
      maxLevel,
      zonesCleared: (gs?.unlockedZones || []).length,
    }));
    _gaEvent('run_completed_death', {
      max_level: maxLevel,
      zones_cleared: (gs?.unlockedZones || []).length,
    });
  } catch (_) {}
}

/** M325 — periodic background sync. Call this at most every ~30s. */
let _lastCloudFlush = 0;
export function flushRunStatsToCloud() {
  const now = Date.now();
  if (now - _lastCloudFlush < 30_000) return;
  _lastCloudFlush = now;
  try {
    const gs = GameState.get();
    if (!gs?.stats) return;
    const runId = _ensureRunId();
    const maxLevel = Math.max(1, ...((gs?.party || []).map(m => m.level || 1)));
    _cloudSafe(c => c.update(runId, {
      totals: gs.stats.global || {},
      perChar: gs.stats.perChar || {},
      combatHistory: (gs.stats.combatHistory || []).slice(-50),
      maxLevel,
      zonesCleared: (gs?.unlockedZones || []).length,
    }));
  } catch (_) {}
}

export function recordStoryEvent(charIds, summary, npcName) {
  for (const id of (Array.isArray(charIds) ? charIds : [charIds])) {
    if (!id) continue;
    appendLog(id, 'story', summary, { npc: npcName, zoneId: GameState.get().zoneId });
  }
}

// ── Read helpers ───────────────────────────────────────────────────────────

export function getCharStats(charId) { return _charStats(charId); }
export function getCharLog(charId) { return [..._charLog(charId)].reverse(); }

export function getDpsSeries(charId, windowSec = 5) {
  const s = ensureStats();
  const raw = s.dpsSeries[charId] || [];
  // Aggregate into rolling buckets
  const buckets = [];
  let cursor = 0;
  if (!raw.length) return buckets;
  const tMin = raw[0].t;
  const tMax = raw[raw.length - 1].t;
  for (let t = tMin; t <= tMax; t += windowSec) {
    let sum = 0;
    while (cursor < raw.length && raw[cursor].t < t + windowSec) {
      if (raw[cursor].t >= t) sum += raw[cursor].dps;
      cursor++;
    }
    buckets.push({ t, dps: sum / windowSec });
  }
  return buckets;
}

export function getRunSummary() {
  const s = ensureStats();
  const partyIds = [...(GameState.get().party || []), ...(GameState.get().companions || [])].map(p => p.id);
  return {
    startedAt: s.startedAt,
    perChar: partyIds.map(id => ({ id, stats: _charStats(id) })),
    global: s.global,
  };
}

// ── M285-M289 — Extended tracking events ───────────────────────────────────

const MAX_DROPS = 500;
const MAX_POWER_SAMPLES = 300;
const MAX_FIGHT_LOG = 200;

/**
 * Record a loot drop. Called from combat-victory drop pipeline,
 * treasure nodes, dungeon-clear chests.
 *   item       — generated item object (from generateItem)
 *   ctx        — { zoneId, magicFind, source: 'combat'|'treasure'|'chest'|'quest' }
 */
export function recordDrop(item, ctx = {}) {
  if (!item) return;
  const s = ensureStats();
  if (!Array.isArray(s.drops)) s.drops = [];
  const entry = {
    ts: Date.now(),
    t: Math.floor((Date.now() - s.startedAt) / 1000),
    itemId: item.baseId || item.id || null,
    name: item.name || null,
    rarity: item.rarity || 'normal',
    category: item.category || item.type || null,
    zoneId: ctx.zoneId || GameState.get().zoneId || null,
    magicFind: typeof ctx.magicFind === 'number' ? Math.round(ctx.magicFind) : null,
    source: ctx.source || null,
  };
  s.drops.push(entry);
  if (s.drops.length > MAX_DROPS) s.drops.splice(0, s.drops.length - MAX_DROPS);
}

/**
 * Record damage attributed to a skill (M289).
 * If skillName/skill not provided, treats as 'attack' (basic).
 */
export function recordDamageBySkill(attacker, amount, skill = null, element = null) {
  if (!attacker || amount <= 0) return;
  const s = ensureStats();
  const id = skill?.id || 'attack';
  const label = skill?.name || 'Basic Attack';
  if (!s.damageBySkill[id]) s.damageBySkill[id] = { label, value: 0, byChar: {} };
  s.damageBySkill[id].value += amount;
  if (!s.damageBySkill[id].byChar[attacker.id]) s.damageBySkill[id].byChar[attacker.id] = 0;
  s.damageBySkill[id].byChar[attacker.id] += amount;
  if (element) {
    s.damageByElement[element] = (s.damageByElement[element] || 0) + amount;
  }
  // Cast count
  if (!s.skillCastCounts[attacker.id]) s.skillCastCounts[attacker.id] = {};
  s.skillCastCounts[attacker.id][id] = (s.skillCastCounts[attacker.id][id] || 0) + 1;
}

/**
 * Record damage taken from a source (M289).
 * sourceKey examples: 'enemy:goblin_scout', 'status:burn', 'trap:pit'.
 */
/** M475c — increment a hero's per-character damageTaken counter directly
 *  (no attacker side-effects). Used when an enemy hits a hero; the enemy
 *  attack path otherwise skipped per-hero damageTaken accumulation, so
 *  combatHistory entries always shipped dmgTaken: 0 and the Lifetime
 *  "Damage Taken by Hero" chart was permanently blank. */
export function recordDamageTakenByHero(hero, amount) {
  if (!hero || !hero.id || !(amount > 0)) return;
  if (hero.enemyId) return; // safety: never record enemy taking damage as a hero
  const t = _charStats(hero.id);
  t.damageTaken += amount;
  const max = hero.maxHp || hero.hp || 1;
  if (hero.hp - amount <= max * 0.25 && hero.hp - amount > 0) {
    t.nearDeaths++;
  }
}

export function recordDamageTakenBySource(amount, sourceKey) {
  if (amount <= 0 || !sourceKey) return;
  const s = ensureStats();
  s.damageTakenBySource[sourceKey] = (s.damageTakenBySource[sourceKey] || 0) + amount;
}

/**
 * Record a snapshot of a hero's power score (M288).
 * Called at fight end + level-up.
 */
export function recordPowerSnapshot(charId, power) {
  if (!charId || typeof power !== 'number') return;
  const s = ensureStats();
  if (!s.powerSeries[charId]) s.powerSeries[charId] = [];
  const t = Math.floor((Date.now() - s.startedAt) / 1000);
  const arr = s.powerSeries[charId];
  // Coalesce: if last sample within 2s and similar value, replace it
  if (arr.length && t - arr[arr.length - 1].t < 2 && Math.abs(arr[arr.length - 1].power - power) < 5) {
    arr[arr.length - 1] = { t, power };
  } else {
    arr.push({ t, power });
  }
  if (arr.length > MAX_POWER_SAMPLES) arr.splice(0, arr.length - MAX_POWER_SAMPLES);
}

/**
 * Record fight metadata (M289). Used for filter filtering by fight kind.
 */
export function recordFightLog({ kind, zoneId, durationSec, won }) {
  const s = ensureStats();
  if (!Array.isArray(s.fightLog)) s.fightLog = [];
  s.fightLog.push({ ts: Date.now(), kind: kind || 'regular', zoneId: zoneId || null, durationSec: durationSec || 0, won: !!won });
  if (s.fightLog.length > MAX_FIGHT_LOG) s.fightLog.splice(0, s.fightLog.length - MAX_FIGHT_LOG);
}

// ── Filter-aware view helpers ──────────────────────────────────────────────

function _windowSeconds(filters) {
  const s = ensureStats();
  const nowSec = Math.floor((Date.now() - s.startedAt) / 1000);
  switch (filters?.timeRange) {
    case 'fight':    return Math.max(0, nowSec - 90);
    case '5min':     return Math.max(0, nowSec - 300);
    case 'zone':     return Math.max(0, nowSec - 600); // approximate; zone change tracking later
    case 'run':      return 0;
    case 'lifetime': return 0; // lifetime drops aren't kept; falls back to run
    default:         return 0;
  }
}

export function getDropsForView(filters) {
  const s = ensureStats();
  const cutoff = _windowSeconds(filters);
  return (s.drops || []).filter(d => d.t >= cutoff);
}

export function getPowerSeriesForView(charId, filters) {
  const s = ensureStats();
  const arr = s.powerSeries?.[charId] || [];
  const cutoff = _windowSeconds(filters);
  return arr.filter(p => p.t >= cutoff);
}

export function getDamageBySkillForView(filters) {
  const s = ensureStats();
  const memberId = filters?.memberId;
  const out = [];
  for (const [id, rec] of Object.entries(s.damageBySkill || {})) {
    let value;
    if (memberId && memberId !== 'all') value = rec.byChar?.[memberId] || 0;
    else value = rec.value || 0;
    if (value > 0) out.push({ id, label: rec.label || id, value });
  }
  return out.sort((a, b) => b.value - a.value);
}

export function getDamageByElementForView(filters) {
  const s = ensureStats();
  // Filters don't yet partition element data per character — global only.
  return Object.entries(s.damageByElement || {})
    .map(([k, v]) => ({ label: k, value: v }))
    .filter(r => r.value > 0)
    .sort((a, b) => b.value - a.value);
}

export function getDamageTakenBySourceForView(filters) {
  const s = ensureStats();
  return Object.entries(s.damageTakenBySource || {})
    .map(([k, v]) => ({ label: k.replace(/^[^:]+:/, ''), value: v, key: k }))
    .filter(r => r.value > 0)
    .sort((a, b) => b.value - a.value)
    .slice(0, 12);
}

// (existing archiveCurrentRun follows)

export function archiveCurrentRun(label) {
  const gs = GameState.get();
  if (!gs.stats) return;
  if (!_life) _life = loadLife();
  _life.runHistory = _life.runHistory || [];
  // M286 — enrich the archived run with class composition + drop summary +
  // power peaks so the Cross-Run tab can compute richer trends without
  // having the live state.
  const heroes = (gs.party || []).filter(p => p && !(p.isCompanion || p.class === 'companion'));
  const classes = heroes.map(h => h.class).filter(Boolean);
  const dropsByRarity = {};
  for (const d of (gs.stats.drops || [])) {
    dropsByRarity[d.rarity || 'normal'] = (dropsByRarity[d.rarity || 'normal'] || 0) + 1;
  }
  const powerPeaks = {};
  for (const [cid, arr] of Object.entries(gs.stats.powerSeries || {})) {
    if (arr.length) powerPeaks[cid] = Math.max(...arr.map(p => p.power));
  }
  _life.runHistory.unshift({
    label: label || `Run ${new Date(gs.stats.startedAt).toISOString().slice(0,10)}`,
    startedAt: gs.stats.startedAt,
    endedAt: Date.now(),
    global: gs.stats.global,
    perChar: gs.stats.perChar,
    // M286 enrichments
    classes,
    heroNames: heroes.map(h => h.name),
    dropsByRarity,
    powerPeaks,
    finalAct: gs.act || 0,
    finalZone: gs.zoneId || null,
    hardcore: !!gs.hardcore,
    completed: !!gs.storyFlags?.game_complete,
  });
  if (_life.runHistory.length > 50) _life.runHistory.length = 50;
  saveLife(_life);
}
