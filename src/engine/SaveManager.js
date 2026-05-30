/**
 * SaveManager — M56: unlimited auto-named save keys.
 * Each save has a unique localStorage key. `New Game` always creates a new key
 * so starting a new game never overwrites an existing save.
 */
import { GameState } from '../game/gameState.js';
import { debug } from '../utils/debug.js';
import { cloudSaves } from '../auth/cloudSaves.js';

export const SAVE_VERSION = 6;
const PREFIX = 'emberveil_save_';
const LEGACY_SLOT_KEY = slot => `emberveil_save_${slot}`;

function _slug(s) {
  return String(s || 'hero').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 20) || 'hero';
}

function _makeKey(heroName) {
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 6);
  return `${PREFIX}${_slug(heroName)}_${ts}${rand}`;
}

function _makeFingerprint() {
  try { if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID(); } catch (_) {}
  return 'fp_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
}

function _isLegacySlotKey(key) {
  const tail = key.slice(PREFIX.length);
  return /^[0-9]+$/.test(tail);
}

export const SaveManager = {
  /** Create a brand-new save key for a freshly-built hero and persist the first snapshot. */
  startNewSave(heroName) {
    const key = _makeKey(heroName);
    GameState.get().currentSaveKey = key;
    return this.saveCurrentGame(key);
  },

  /** Save to the given key, or to the game's currentSaveKey, or mint a new one. */
  saveCurrentGame(key) {
    const gs = GameState.get();
    const heroName = gs.party?.[0]?.name || 'Unknown';
    const useKey = key || gs.currentSaveKey || _makeKey(heroName);
    gs.currentSaveKey = useKey;
    // M213: stable device-independent fingerprint for cross-device merge.
    if (!gs.saveFingerprint) {
      // Preserve pre-existing fingerprint from the on-disk record if any.
      try {
        const prior = localStorage.getItem(useKey);
        if (prior) { const p = JSON.parse(prior); if (p?.fingerprint) gs.saveFingerprint = p.fingerprint; }
      } catch (_) {}
      if (!gs.saveFingerprint) gs.saveFingerprint = _makeFingerprint();
    }

    const data = GameState.toSaveData();
    const record = {
      version: SAVE_VERSION,
      key: useKey,
      fingerprint: gs.saveFingerprint,
      timestamp: new Date().toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric', hour:'2-digit', minute:'2-digit' }),
      createdAt: Date.now(),
      heroName,
      class: data.party?.[0]?.className || data.party?.[0]?.class || 'Hero',
      act: data.act || 1,
      level: data.party?.[0]?.level || 1,
      ...data,
    };
    // Make sure level survives the spread even if data.level exists
    record.level = data.party?.[0]?.level || 1;
    localStorage.setItem(useKey, JSON.stringify(record));
    // Track last-save time so UIs (e.g. GameMenuScreen Main Menu confirm) can
    // skip the "lose unsaved progress" warning within a short cooldown window.
    try { if (typeof window !== 'undefined') window.__lastSavedAt = Date.now(); } catch (_) {}
    debug.state('save', { key: useKey, hero: heroName, level: record.level, act: record.act });
    // Fire-and-forget cloud sync when signed in. Failures are logged to the
    // diagnostic buffer but never block local gameplay.
    try { cloudSaves.pushSave(useKey, record); } catch (_) {}
    return record;
  },

  _readKey(key) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return null;
      const data = JSON.parse(raw);
      data.key = key;
      return this.migrate(data);
    } catch (_) { return null; }
  },

  loadKey(key) {
    debug.state('load', { key });
    const save = this._readKey(key);
    if (!save) return false;
    GameState.load(save);
    GameState.get().currentSaveKey = key;
    if (save.fingerprint) GameState.get().saveFingerprint = save.fingerprint;
    return true;
  },

  deleteKey(key) {
    localStorage.removeItem(key);
    try { cloudSaves.deleteSave(key); } catch (_) {}
    // M421: also prune any fallen-hero monument entry that referenced this
    // save slot so the title-screen monument and Load-Game RIP list stay in
    // sync. Match by savedSlot; tolerate corrupt/old entries that lack it.
    try {
      const all = JSON.parse(localStorage.getItem('emberveil.fallenHeroes') || '[]');
      const filtered = all.filter(h => h?.savedSlot !== key);
      if (filtered.length !== all.length) {
        localStorage.setItem('emberveil.fallenHeroes', JSON.stringify(filtered));
      }
    } catch (_) {}
  },

  /** Export every emberveil_* localStorage key as a versioned JSON blob. */
  exportAllSaves() {
    const saves = {};
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k || !k.startsWith('emberveil_')) continue;
      saves[k] = localStorage.getItem(k);
    }
    return {
      emberveil: 1,
      exportedAt: new Date().toISOString(),
      saveVersion: SAVE_VERSION,
      saves,
    };
  },

  /** Validate + write an imported blob back to localStorage. Returns count imported. */
  importAllSaves(blob) {
    let data = blob;
    if (typeof blob === 'string') {
      try { data = JSON.parse(blob); } catch (_) { throw new Error('Invalid JSON file.'); }
    }
    if (!data || typeof data !== 'object' || data.emberveil !== 1 || !data.saves || typeof data.saves !== 'object') {
      throw new Error('Not a valid Emberveil save backup.');
    }
    // M272 fix: validate EVERY save entry before wiping anything. Previously
    // we wiped existing emberveil_* keys first and then iterated the blob,
    // so a malformed import-halfway-through would leave the player with
    // zero saves. Now: parse-validate the full blob up front, THEN atomic
    // swap (wipe old + write new in one loop).
    const validated = [];
    for (const [k, v] of Object.entries(data.saves)) {
      if (!k.startsWith('emberveil_') || typeof v !== 'string') continue;
      try {
        // Each save value is a JSON string; must at least parse and carry a
        // `version` or recognizable shape. Don't care what version — just
        // that it isn't corrupted nonsense.
        const parsed = JSON.parse(v);
        if (!parsed || typeof parsed !== 'object') continue;
        validated.push([k, v]);
      } catch (_) {
        // Skip unparseable entries silently — we keep validated ones only.
      }
    }
    if (!validated.length) {
      throw new Error('Backup contains no readable save entries.');
    }
    // Now the wipe is safe: at least one entry is known-good.
    const toRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith('emberveil_')) toRemove.push(k);
    }
    toRemove.forEach(k => localStorage.removeItem(k));
    for (const [k, v] of validated) localStorage.setItem(k, v);
    return validated.length;
  },

  /** List all saves, newest first. */
  listSaves() {
    const out = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k || !k.startsWith(PREFIX)) continue;
      const save = this._readKey(k);
      if (save) out.push(save);
    }
    out.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    // One-time dedupe: if two saves share the same hero name and one is
    // level 1 while the other is higher, the L1 record is the leftover ghost
    // from the old character-creation auto-save. Discard it from disk.
    const bestByName = new Map();
    for (const s of out) {
      const name = (s.heroName || '').toLowerCase();
      if (!name) continue;
      const prev = bestByName.get(name);
      if (!prev || (s.level || 1) > (prev.level || 1)) bestByName.set(name, s);
    }
    const kept = [];
    for (const s of out) {
      const name = (s.heroName || '').toLowerCase();
      const best = bestByName.get(name);
      if (best && best.key !== s.key && (s.level || 1) === 1 && (best.level || 1) > 1) {
        try { localStorage.removeItem(s.key); } catch (_) {}
        continue;
      }
      kept.push(s);
    }
    return kept;
  },

  // ─── Backwards-compatibility shims (legacy numeric slot API) ───────────────
  getSlot(slot) { return this._readKey(LEGACY_SLOT_KEY(slot)); },
  loadSlot(slot) { return this.loadKey(LEGACY_SLOT_KEY(slot)); },
  deleteSlot(slot) { this.deleteKey(LEGACY_SLOT_KEY(slot)); },
  getAllSlots() { return this.listSaves(); },

  migrate(save) {
    if (!save.version || save.version < 2) {
      if (!save.visitedNodes) save.visitedNodes = ['start'];
      save.version = 2;
    }
    if (save.version < 3) {
      if (!save.seenEvents) save.seenEvents = [];
      if (!save.portals) save.portals = [];
      if (!save.claimedTreasures) save.claimedTreasures = [];
      if (!save.completedQuests) save.completedQuests = [];
      if (!save.turnedInQuests) save.turnedInQuests = [];
      for (const arr of [save.party, save.companions, save.bench]) {
        if (Array.isArray(arr)) {
          for (const m of arr) {
            if (m && m.pendingAttrPoints == null) m.pendingAttrPoints = 0;
            if (m && m.pendingSkillPoints == null) m.pendingSkillPoints = 0;
            if (m && m.pendingPassivePoints == null) m.pendingPassivePoints = 0;
            if (m && m.passiveRanks == null) m.passiveRanks = {};
          }
        }
      }
      save.version = 3;
    }
    if (save.version < 4) {
      // v4: per-zone node positions, sneaked nodes, unlimited save keys
      if (!save.zoneNodeIds) {
        save.zoneNodeIds = { [save.zoneId || 'border_roads']: save.nodeId || 'start' };
      }
      if (!save.sneakedNodes) save.sneakedNodes = [];
      if (save.level == null) save.level = save.party?.[0]?.level || 1;
      save.version = 4;
    }
    if (save.version < 5) {
      const TP_LVLS = [3, 8, 13, 18, 23, 28];
      const expected = (lvl) => TP_LVLS.filter(l => l <= (lvl || 1)).length;
      for (const arr of [save.party, save.companions, save.bench]) {
        if (Array.isArray(arr)) {
          for (const m of arr) {
            if (!m) continue;
            const spent = m.talentsPurchased ? Object.keys(m.talentsPurchased).filter(k => m.talentsPurchased[k]).length : 0;
            const exp = expected(m.level || 1);
            m.pendingSkillPoints = Math.max(0, exp - spent);
          }
        }
      }
      save.version = 5;
    }
    if (save.version < 6) {
      // M65: top up under-budgeted heroes from older saves where the creation
      // budget was smaller (or hero stats were below the current 8-base + 10-free
      // build budget). Mercs/companions are excluded — their stat totals are
      // intentional. Skip companions and any hero already at/above budget.
      const BUDGET = 4 * 8 + 10; // base 8 per attr, 10 free points = 42
      for (const arr of [save.party, save.bench]) {
        if (!Array.isArray(arr)) continue;
        for (const m of arr) {
          if (!m || m.isCompanion || m.class === 'companion') continue;
          const a = m.attrs || {};
          const sum = (a.STR||0) + (a.DEX||0) + (a.INT||0) + (a.CON||0);
          if (sum > 0 && sum < BUDGET) {
            m.pendingAttrPoints = (m.pendingAttrPoints || 0) + (BUDGET - sum);
          }
        }
      }
      save.version = 6;
    }
    return save;
  },
};
