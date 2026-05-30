/**
 * GameState — shared mutable game state
 * Centralized so all screens read from the same source
 */
import { computeItemScores, setLootNgPlus } from './items.js';
import { recalcPassiveStats } from './passives.js';

// M314 — Achievement persistence: pre-seed the per-run achievements mirror from the
// global localStorage store so new-game / load never re-fires unlock toasts.
// We read the global key directly here to avoid a circular import
// (achievements.js -> GameState -> achievements.js).
const _GLOBAL_ACH_KEY = 'emberveil_life_achievements_v1';
function _loadGlobalAchievements() {
  try { return JSON.parse(localStorage.getItem(_GLOBAL_ACH_KEY) || '{}'); } catch (_) { return {}; }
}

// M327: fame moved from per-save to global. Single source of truth is
// localStorage; everything else (in-state .fame, Supabase mirror) follows.
const _GLOBAL_FAME_KEY = 'emberveil_fame_global_v1';
function _readGlobalFame() {
  try {
    const raw = localStorage.getItem(_GLOBAL_FAME_KEY);
    const n = raw == null ? 0 : Number(raw);
    return Number.isFinite(n) ? n : 0;
  } catch (_) { return 0; }
}
function _writeGlobalFame(n) {
  try { localStorage.setItem(_GLOBAL_FAME_KEY, String(Math.max(0, Math.floor(n)))); } catch (_) {}
  // Mirror to Supabase via the existing cloudSaves helper if available.
  try {
    if (typeof window !== 'undefined' && window.__cloudSaves?.isAvailable) {
      window.__cloudSaves.pushSave(_GLOBAL_FAME_KEY, { fame: n });
    }
  } catch (_) {}
}
/**
 * Merge saved achievements with the global (account-wide) unlock set.
 * Returns an object keyed by achievement id where every globally-unlocked
 * achievement is pre-marked so checkAchievements() skips the toast.
 */
function _buildAchievementsSync(savedAchievements) {
  const life = _loadGlobalAchievements();
  const merged = {};
  // Seed from global first.
  for (const id of Object.keys(life)) {
    if (life[id]?.unlocked) merged[id] = { ...life[id] };
  }
  // Layer save-specific data on top (preserves local timestamps, progress).
  if (savedAchievements && typeof savedAchievements === 'object') {
    for (const [id, val] of Object.entries(savedAchievements)) {
      if (val?.unlocked) merged[id] = { ...merged[id], ...val };
    }
  }
  return merged;
}

const DEFAULT_STATE = {
  version: 1,
  gameMode: 'classic',
  hero: null,
  party: [],       // up to 4 heroes
  companions: [],  // up to 4 companions/pets
  bench: [],       // heroes/companions not in party
  gold: 150,
  inventory: [],   // array of item objects
  materials: {},  // crafting materials { iron_scrap: N, magic_essence: N, ... }
  storyFlags: {},
  quests: [],
  act: 1,
  zoneId: 'border_roads',
  nodeId: 'start',
  zoneNodeIds: { border_roads: 'start' }, // per-zone remembered party position
  sneakedNodes: new Set(),                 // M56: revisited combat nodes sneaked past
  visitedNodes: new Set(),
  usedShrines: new Set(),                  // M406: shrines the player has actually activated (distinct from visited/skipped)
  shrineBuffs: [],                         // M406: active timed buffs from shrines [{ type, combatsLeft, ...params }]
  unlockedZones: ['border_roads'], // zones the party can access
  completedBosses: [],             // boss node IDs defeated
  portal: null,                     // active town portal: { nodeId, zoneId } or null
  seenEvents: [],                   // IDs of random dialog events already seen
  assignedRandomEvents: {},         // M76: zoneId:nodeId -> randomEvent.id (stable map labels)
  fame: 0,                         // M327: in-state mirror only. Source of truth = _GLOBAL_FAME_KEY in localStorage.
  fameEncountersSeen: { 100: false, 250: false, 500: false }, // M71 fame reward encounters
  guildHallUnlocked: false,        // M71: unlocked by 500-fame encounter
  ngPlus: 0,                       // New Game+ tier (0 = normal, 1+ = NG+)
  playTimeSeconds: 0,
  currentSaveKey: null,
  settings: {
    disableTextures: false,
  },
  // M72 — Tap Weapons
  tapInventory: ['blade'],
  equippedTapWeapon: 'blade',
  equippedTapUtility: null,
  tapCooldown: 0,
  tapCooldownMax: 0,
  tapCooldownUnit: null, // 'turns' | 'rounds'
  tapUsedThisTurn: false,
  // M276 D14 — Difficulty advanced options. Consumers wired in later batches;
  // these fields just persist for now.
  mapSeed: '',     // free-text seed used by future deterministic zone generation
  fogOfWar: true,  // M279: default ON for all difficulties (user request)
  hardcore: false, // future permadeath / restricted-load consumer
  // M384 — combat speed persists per-save (was global localStorage). Valid
  // values: 0.25, 0.5, 1, 2, 4. The 0/pause state is intentionally not
  // persisted — pause is a per-fight transient.
  combatSpeed: 1,
  // M384 — once the player has confirmed the auto-skill prompt for a given
  // tab in this save, never ask again. Per-tab so attrs/passive/active are
  // independent. Persists with the save.
  autoSkillConfirmed: { active: false, passive: false, attrs: false },
  // M406 — single save-level flag: once the player accepts *any* auto-mode
  // prompt (Spells, Passives, Attributes, or Inventory), all four operate
  // without further confirmation dialogs. Set to true on first accept;
  // never reset by declining (decline = don't save, prompt again next time).
  autoModeAccepted: false,
  // M276 B4/U9 — pre-rolled boss chest items. Set in CombatScreen._victory()
  // when a first-time boss falls; consumed by MapScreen onEnter/onResume.
  // Persisting the rolled items prevents save-scum reroll abuse.
  _bossChestItems: null,
  _bossChestNodeId: null,
  // M276 U10 — auto-equip blocklist. Item ids the user has manually
  // unequipped or refused; never auto-equip these even if a member has
  // autoEquip=true. Stored as Set in memory, serialized as array.
  manuallyUnequipped: new Set(),
  // M280 — Statistics. `stats.run` is per-run (resets on new game), `stats.life`
  // is cross-session lifetime totals. Kept on this state object so saves carry
  // it; lifetime stats are also mirrored to localStorage by stats.js so they
  // outlive a save delete.
  stats: null, // initialized lazily by stats.js
  // M280 — Achievements. Object keyed by achievement id with { unlocked, date, progress }.
  achievements: {},
  // M280 — Hardcore RIP marker. When set, the run is locked: load this save
  // and you'll go to RipViewScreen instead of resuming play. Field shape:
  //   { date, zoneId, nodeId, finalParty: [{ id, name, level, class, appearance }], finalGold }
  rip: null,
  // M280 — Fog of War revealed set per zone (only when fogOfWar=true).
  fogRevealed: {}, // zoneId -> [nodeId, ...]
  // M279 — Tavern fixed 3-hero pool. Each town offers a fixed roster of 3
  // heroes generated deterministically per game seed. When the player hires
  // one, the slot DEPLETES (no reroll) — pool shrinks 3→2→1→0. To restock,
  // they must travel to other towns. The set tracks which hire IDs have been
  // claimed from each town so they never reappear there.
  tavernHired: {}, // townId -> [hireId, hireId, ...]
  // M279 — Manual (FF-style) combat. When true, CombatScreen pauses on each
  // friendly hero's turn and surfaces a UI to pick Attack / specific spell,
  // showing cooldowns, mana cost, and a calculated damage preview. When
  // false (default), the existing 0.5s/turn auto-loop keeps running.
  manualCombat: false,
  // Manual Characters — when true, hides Auto toggles for inventory, skills,
  // passives, and attribute management. Independent from difficulty.
  manualCharacters: false,
  // M396 — Weapon Scaling mode. Always true — skill damage is driven by
  // weapon category (heavy/light/magic) and the equipped weapon's damage
  // range + spell power, NOT by the caster's STR/DEX/INT statVal. INT spells
  // still get the +spellPower bonus from gear/passives, but the raw INT * mult
  // term goes to zero. Goal: spells stop dwarfing basic attacks because their
  // core scalar is the same weapon roll basic attacks use.
  weaponScaling: true,
  // M388 — flips the new manual-mode UI on. Off by default during dev. M389+ wires it into CombatScreen.
  uiOverhaul: false,
  // M279 — Cleared dungeons. Set of dungeon ids the player has finished.
  // Cleared dungeons display dimmed and refuse re-entry on the world map.
  completedDungeons: [],
  // M302 — Node overlays. zoneId -> [{ id, nodeId, type, consumed, stock? }]
  // Seeded per zone on first visit; persisted so they don't reroll on revisit.
  nodeOverlays: {},
  // M306 — Infinite Depths run state. Null when no run is active.
  // Shape: { active, floor, runDeaths, runLoot, runStartedAt, anchors, seed }
  infiniteRun: null,
  // M307 — Crafting recipe unlocks. Set of recipe ids (common) and uniqueIds
  // (unique recipes). Populated on first access via recipes.js migration helper.
  // Serialized as array in toSaveData; restored as Set in load().
  craftingRecipesUnlocked: null, // null = not yet initialized; lazy-init on first access
};

/**
 * Reset every per-run progression slot on the given state. Used when the
 * player rolls into New Game+: heroes / inventory / fame / achievements /
 * saved hires / lifetime stats / settings persist, but the map, story
 * flags, one-time dialog flags, random-event picks, fog reveal, pre-rolled
 * boss chests, sneaks, shrines, dungeons, and active infinite-depths run
 * all start fresh.
 *
 * IMPORTANT: every container is replaced with a brand-new object/Set/array
 * — no in-place mutation of a shared reference, so cloned/aliased state
 * (e.g. from save-round-trips) cannot leak.
 *
 * @param {object} s - mutable gameState object (the live _state).
 */
export function resetRunProgression(s) {
  if (!s || typeof s !== 'object') return;
  // Map position: NG+ restarts in the prologue per M276/M20 spec.
  s.act = 0;
  s.zoneId = 'prologue';
  s.nodeId = 'start';
  s.zoneNodeIds = { prologue: 'start' };
  s.unlockedZones = ['prologue'];
  // Per-run node + boss completion. Fresh containers (no shared refs).
  s.completedBosses = [];
  s.visitedNodes = new Set(['start']);
  s.sneakedNodes = new Set();
  s.usedShrines = new Set();
  s.shrineBuffs = [];
  s.skillChecksAttempted = new Set();
  s.completedDungeons = [];
  // Story / event flags. storyFlags drives one-time dialogs (cleared_*,
  // *_warned, *_started, *_seen, recurring-NPC arc flags). Wipe it.
  s.storyFlags = {};
  s.seenEvents = [];
  s.assignedRandomEvents = {};
  // Map overlays (per-zone, per-run loot/event seeds) and fog reveal.
  s.nodeOverlays = {};
  s.fogRevealed = {};
  // Pre-rolled boss-chest cache from the previous run.
  s._bossChestItems = null;
  s._bossChestNodeId = null;
  // Active town portal + infinite-depths run are run-local.
  s.portal = null;
  s.infiniteRun = null;
  // Per-run stats — keep lifetime, reset the run slice. stats.js owns the
  // exact shape; replacing the run sub-object is enough.
  if (s.stats && typeof s.stats === 'object' && s.stats.run) {
    s.stats.run = {};
  }
  // Bump run counter so per-run code paths can branch.
  s.runCount = (s.runCount || 1) + 1;
}

// M414 — fresh empty containers per init/load (factory) so the module-init
// _state never shares references with DEFAULT_STATE. The init() and load()
// branches override below; this initial assignment is only used if any code
// path reads GameState.get() before init/load runs (rare but defensive).
function _freshEmpties() {
  return {
    party: [], companions: [], bench: [], inventory: [],
    materials: {}, storyFlags: {}, quests: [], unlockedZones: ['border_roads'],
    completedBosses: [], seenEvents: [], assignedRandomEvents: {},
    tavernHired: {}, fogRevealed: {}, achievements: {},
    sneakedNodes: new Set(), visitedNodes: new Set(), usedShrines: new Set(),
    shrineBuffs: [], manuallyUnequipped: new Set(),
    zoneNodeIds: { border_roads: 'start' },
    autoSkillConfirmed: { active: false, passive: false, attrs: false },
  };
}
let _state = { ...DEFAULT_STATE, ..._freshEmpties() };

export const GameState = {
  get() { return _state; },

  init(hero) {
    // M276 / M20: every freshly-created character starts in the prologue
    // zone. Prologue boss kill auto-unlocks border_roads via ZONE_UNLOCK_MAP.
    // M283: shallow-spreading DEFAULT_STATE shares mutable refs for arrays/
    // objects (companions, inventory, materials, achievements, ...). That
    // caused class pets like the Tinker's Clockwork Turret to leak across
    // new games. Fresh empties are constructed below so the next run starts
    // genuinely clean.
    // M295: ensure new heroes start with potionBelt = []
    if (!Array.isArray(hero.potionBelt)) hero.potionBelt = [];
    // M322: ensure freshly-created heroes have HP/MP populated. Without this,
    // PartyScreen renders "?/150" because hp/maxHp are undefined until the
    // first combat tick or save round-trip computes them.
    try { recalcPassiveStats(hero); } catch (_) {}
    // M327: seed fame from the global store (it persists across new games).
    const _globalFame = _readGlobalFame();
    _state = {
      ...DEFAULT_STATE,
      hero,
      party: [hero],
      companions: [],
      bench: [],
      inventory: [],
      materials: {},
      storyFlags: {},
      quests: [],
      assignedRandomEvents: {},
      seenEvents: [],
      completedBosses: [],
      fame: _globalFame,
      fameEncountersSeen: { 100: false, 250: false, 500: false },
      achievements: _buildAchievementsSync({}),
      stats: null,
      fogRevealed: {},
      gold: hero.gold ?? 150,
      act: 0,
      zoneId: 'prologue',
      nodeId: 'start',
      visitedNodes: new Set(['start']),
      usedShrines: new Set(),
      shrineBuffs: [],
      zoneNodeIds: { prologue: 'start' },
      unlockedZones: ['prologue'],
      sneakedNodes: new Set(),
      tapInventory: ['blade'],
      equippedTapWeapon: 'blade',
      equippedTapUtility: null,
      tapCooldown: 0,
      tapCooldownMax: 0,
      tapCooldownUnit: null,
      tapUsedThisTurn: false,
      manuallyUnequipped: new Set(),
      _bossChestItems: null,
      _bossChestNodeId: null,
      nodeOverlays: {},
      craftingRecipesUnlocked: null, // lazy-init on first access in recipes.js
    };
  },

  load(saved) {
    // Default gameMode to 'classic' for pre-existing saves that lack the field.
    if (!saved.gameMode) saved.gameMode = 'classic';

    _state = {
      ...DEFAULT_STATE,
      ...saved,
      visitedNodes: new Set(saved.visitedNodes || ['start']),
      usedShrines: new Set(saved.usedShrines || []),
      shrineBuffs: Array.isArray(saved.shrineBuffs) ? saved.shrineBuffs : [],
      sneakedNodes: new Set(saved.sneakedNodes || []),
      // M347 — skill checks attempted (separate from visitedNodes so a
      // walk-by doesn't lock out the node).
      skillChecksAttempted: new Set(saved.skillChecksAttempted || []),
      zoneNodeIds: saved.zoneNodeIds || { [saved.zoneId || 'border_roads']: saved.nodeId || 'start' },
      unlockedZones: saved.unlockedZones || ['border_roads'],
      completedBosses: saved.completedBosses || [],
      portal: saved.portal || null,
      // M327: fame is now global. Read the global counter and migrate any
      // legacy per-save fame by max-merging into the global store.
      fame: (() => {
        const merged = Math.max(_readGlobalFame(), Number(saved.fame || 0));
        if (merged > _readGlobalFame()) _writeGlobalFame(merged);
        return merged;
      })(),
      fameEncountersSeen: { 100:false, 250:false, 500:false, ...(saved.fameEncountersSeen || {}) },
      guildHallUnlocked: !!saved.guildHallUnlocked,
      ngPlus: saved.ngPlus || 0,
      materials: saved.materials || {},
      settings: { ...DEFAULT_STATE.settings, ...(saved.settings || {}) },
      tapInventory: saved.tapInventory || ['blade'],
      equippedTapWeapon: saved.equippedTapWeapon ?? 'blade',
      equippedTapUtility: saved.equippedTapUtility ?? null,
      tapCooldown: saved.tapCooldown || 0,
      tapCooldownMax: saved.tapCooldownMax || 0,
      tapCooldownUnit: saved.tapCooldownUnit || null,
      tapUsedThisTurn: false,
      // M276 D14 advanced options.
      mapSeed: typeof saved.mapSeed === 'string' ? saved.mapSeed : '',
      // M311: default to true for saves that predate the fogOfWar field.
      // Explicit false (player opted out) is respected; missing = on.
      fogOfWar: saved.fogOfWar !== false,
      hardcore: !!saved.hardcore,
      // M384 — combat speed per-save. Validate against the allowed set, fall
      // back to legacy localStorage, then 1×.
      autoSkillConfirmed: (saved.autoSkillConfirmed && typeof saved.autoSkillConfirmed === 'object')
        ? { active: !!saved.autoSkillConfirmed.active, passive: !!saved.autoSkillConfirmed.passive, attrs: !!saved.autoSkillConfirmed.attrs }
        : { active: false, passive: false, attrs: false },
      combatSpeed: (() => {
        const allowed = [0.25, 0.5, 1, 2, 4];
        const fromSave = Number(saved.combatSpeed);
        if (allowed.includes(fromSave)) return fromSave;
        try {
          const legacy = Number(localStorage.getItem('emberveil_combat_speed'));
          if (allowed.includes(legacy)) return legacy;
        } catch (_) {}
        return 1;
      })(),
      // M276 B4/U9
      _bossChestItems: Array.isArray(saved._bossChestItems) ? saved._bossChestItems : null,
      _bossChestNodeId: saved._bossChestNodeId || null,
      // M276 U10
      manuallyUnequipped: new Set(saved.manuallyUnequipped || []),
      // M280 stats + achievements + rip
      // M314: merge saved achievements with global store to avoid re-toasting on load.
      stats: saved.stats || null,
      achievements: _buildAchievementsSync(saved.achievements || {}),
      rip: saved.rip || null,
      fogRevealed: saved.fogRevealed || {},
      // M298 — lore compendium
      loreUnlocked: new Set(Array.isArray(saved.loreUnlocked) ? saved.loreUnlocked : []),
      // M302 — node overlays
      nodeOverlays: saved.nodeOverlays || {},
      // M306 — Infinite Depths active run (null if none)
      infiniteRun: saved.infiniteRun || null,
      // M307 — Crafting recipe unlocks (Set; null triggers lazy migration in recipes.js)
      craftingRecipesUnlocked: Array.isArray(saved.craftingRecipesUnlocked)
        ? new Set(saved.craftingRecipesUnlocked)
        : null,
      // M388 — UI overhaul preview flag. Rehydrate from localStorage shadow; save field mirrors it.
      uiOverhaul: !!saved.uiOverhaul,
    };
    // M393 — Hardcore forces Manual Combat on, regardless of saved value.
    // Phase 02 §1: hardcore is manual-only. Settings UI shows the toggle as
    // visibly locked; this mirror ensures runtime + reloads also enforce it.
    if (_state.hardcore) _state.manualCombat = true;
    // Manual Characters mode forces all auto-skill / auto-equip flags off
    // (replaces the prior Hard-difficulty lock — Hard no longer gates this).
    try {
      if (_state.manualCharacters) {
        const allChars = [
          ...(_state.party || []),
          ...(_state.companions || []),
          ...(_state.bench || []),
        ];
        for (const m of allChars) {
          if (!m) continue;
          if (m.autoBuild) {
            m.autoBuild.auto_active = false;
            m.autoBuild.auto_passive = false;
            m.autoBuild.auto_attrs = false;
          }
          m.autoEquip = false;
        }
      }
    } catch (_) {}
    // M295 — migrate existing party/companion members: add potionBelt if absent
    const allMembers = [
      ...(_state.party || []),
      ...(_state.companions || []),
      ...(_state.bench || []),
    ];
    for (const m of allMembers) {
      if (!Array.isArray(m.potionBelt)) m.potionBelt = [];
      // M450 — recompute maxHp/maxMp from the live formula and clamp the
      // current hp/mp to it. Saves persisted from older balance passes
      // sometimes carry an inflated maxHp (e.g. companion frost_wyrmling
      // showing 365/180 because the live formula now produces 180 but
      // the save still has hp=365). recalcPassiveStats handles both.
      try { recalcPassiveStats(m); } catch (_) {}
    }
    // M399 — publish ngPlus to the loot generator so item rolls upgrade tier.
    try { setLootNgPlus(_state.ngPlus || 0); } catch (_) {}
  },

  // ---------- M72 Tap Weapons ----------
  getTapInventory() { return _state.tapInventory || []; },
  hasTapItem(id) { return (_state.tapInventory || []).includes(id); },
  addTapItem(id) {
    if (!_state.tapInventory) _state.tapInventory = [];
    if (!_state.tapInventory.includes(id)) _state.tapInventory.push(id);
  },
  equipTapWeapon(id) { _state.equippedTapWeapon = id; },
  equipTapUtility(id) { _state.equippedTapUtility = id; },
  getEquippedTapWeapon() { return _state.equippedTapWeapon || null; },
  getEquippedTapUtility() { return _state.equippedTapUtility || null; },
  canTap() {
    if (_state.tapUsedThisTurn) return false;
    return (_state.tapCooldown || 0) <= 0;
  },
  useTap(cooldown) {
    _state.tapUsedThisTurn = true;
    _state.tapCooldown = cooldown.amount || 0;
    _state.tapCooldownMax = cooldown.amount || 0;
    _state.tapCooldownUnit = cooldown.unit || null;
  },
  tickTapCooldown(unit) {
    // unit is 'turn' or 'round'
    if (unit === 'turn') {
      _state.tapUsedThisTurn = false;
      if (_state.tapCooldownUnit === 'turns' && (_state.tapCooldown || 0) > 0) {
        _state.tapCooldown--;
        if (_state.tapCooldown <= 0) _state.tapCooldownUnit = null;
      }
    } else if (unit === 'round') {
      if (_state.tapCooldownUnit === 'rounds' && (_state.tapCooldown || 0) > 0) {
        _state.tapCooldown--;
        if (_state.tapCooldown <= 0) _state.tapCooldownUnit = null;
      }
    }
  },
  resetTapCombat() {
    _state.tapUsedThisTurn = false;
    _state.tapCooldown = 0;
    _state.tapCooldownMax = 0;
    _state.tapCooldownUnit = null;
  },

  // M298 — Lore compendium unlock tracking
  getLoreUnlocked() {
    if (!(_state.loreUnlocked instanceof Set)) {
      _state.loreUnlocked = new Set(Array.isArray(_state.loreUnlocked) ? _state.loreUnlocked : []);
    }
    return _state.loreUnlocked;
  },
  unlockLore(id) {
    const set = this.getLoreUnlocked();
    set.add(id);
  },
  isLoreUnlocked(id) { return this.getLoreUnlocked().has(id); },

  toSaveData() {
    return {
      ..._state,
      visitedNodes: [..._state.visitedNodes],
      usedShrines: [...(_state.usedShrines || [])],
      sneakedNodes: [...(_state.sneakedNodes || [])],
      skillChecksAttempted: [...(_state.skillChecksAttempted || [])],
      zoneNodeIds: { ..._state.zoneNodeIds },
      manuallyUnequipped: [...(_state.manuallyUnequipped || [])],
      loreUnlocked: [...(this.getLoreUnlocked())],
      // M307 — serialize Set as array; null means not yet initialized (migration on next load)
      craftingRecipesUnlocked: _state.craftingRecipesUnlocked instanceof Set
        ? [..._state.craftingRecipesUnlocked]
        : null,
    };
  },

  setZoneNode(zoneId, nodeId) {
    if (!_state.zoneNodeIds) _state.zoneNodeIds = {};
    _state.zoneNodeIds[zoneId] = nodeId;
  },
  getZoneNode(zoneId) { return _state.zoneNodeIds?.[zoneId] || null; },

  setFlag(key, value = true) { _state.storyFlags[key] = value; },
  getFlag(key) { return _state.storyFlags[key]; },
  hasFlag(key) {
    const v = _state.storyFlags[key];
    return v !== undefined && v !== null && v !== false && v !== 0;
  },
  /**
   * M133: flag ledger primitives for event chains + the mod DSL.
   * incrementFlag — numeric accumulator (missing/non-numeric resets to 0 first).
   * consumeFlag   — returns true + clears if set; returns false otherwise.
   * requireFlags  — AND over a list; each entry is either "key" (truthy check)
   *                 or "!key" (negated truthy check). Empty list returns true.
   */
  incrementFlag(key, delta = 1) {
    const cur = Number(_state.storyFlags[key]);
    const base = Number.isFinite(cur) ? cur : 0;
    _state.storyFlags[key] = base + delta;
    return _state.storyFlags[key];
  },
  consumeFlag(key) {
    if (!this.hasFlag(key)) return false;
    delete _state.storyFlags[key];
    return true;
  },
  requireFlags(keys) {
    if (!Array.isArray(keys) || keys.length === 0) return true;
    for (const entry of keys) {
      if (typeof entry !== 'string') continue;
      if (entry.startsWith('!')) {
        if (this.hasFlag(entry.slice(1))) return false;
      } else {
        if (!this.hasFlag(entry)) return false;
      }
    }
    return true;
  },

  addGold(amount) { _state.gold = Math.max(0, (_state.gold || 0) + amount); },
  getGold() { return _state.gold || 0; },

  addToInventory(item) {
    _state.inventory.push(item);
    // M455 — lifetime rare-item counter for the Scavenger unlock. The
    // current-inventory snapshot path missed any rare that was sold,
    // salvaged, or replaced before classUnlocks ran. Increment on every
    // rare/epic/legendary that lands in inventory; never decremented.
    if (item && (item.rarity === 'rare' || item.rarity === 'epic' || item.rarity === 'legendary')) {
      _state.lifetimeRareCount = (_state.lifetimeRareCount || 0) + 1;
    }
    // M276 U10 — try to auto-equip onto any party member with autoEquip=true.
    // Companions are skipped. Items previously manually-unequipped are skipped.
    // M293: capture result so _lastAutoEquip can be read by callers for toasts.
    this._lastAutoEquip = null;
    try {
      const res = this.tryAutoEquip(item);
      if (res && res.member) this._lastAutoEquip = res;
    } catch (_) { /* never block inventory add */ }
  },
  // M276 U10 — variant for sites that need to add WITHOUT triggering auto-equip
  // (e.g. unequip → put back into bag).
  addToInventoryRaw(item) { _state.inventory.push(item); },
  removeFromInventory(itemId) { _state.inventory = _state.inventory.filter(i => i.id !== itemId); },

  // M276 U10 — manual-unequip blocklist. When the user unequips an item, the
  // item id is added here so future auto-equip cycles ignore it. Cleared if
  // the item is sold/salvaged or manually re-equipped.
  markManuallyUnequipped(itemId) {
    if (!_state.manuallyUnequipped) _state.manuallyUnequipped = new Set();
    _state.manuallyUnequipped.add(itemId);
  },
  unmarkManuallyUnequipped(itemId) {
    if (_state.manuallyUnequipped) _state.manuallyUnequipped.delete(itemId);
  },
  isManuallyUnequipped(itemId) {
    return !!(_state.manuallyUnequipped && _state.manuallyUnequipped.has(itemId));
  },

  /**
   * M276 U10 — auto-equip helper. For an item just added to inventory,
   * find the best party member with `autoEquip=true` and equip it there if
   * it's an upgrade or fills an empty slot. Companions are skipped.
   * Returns true if an equip happened.
   *
   * Lazy imports items.js to avoid circular import (items doesn't import
   * gameState, but the helper is called from add-time which keeps the
   * dependency graph linear).
   */
  tryAutoEquip(item) {
    if (!item) return false;
    if (this.isManuallyUnequipped(item.id)) return false;
    // Only weapons/armor/accessories are equippable.
    const t = item.type;
    if (t !== 'weapon' && t !== 'armor' && t !== 'accessory') return false;

    // M279: pass member as hero context so weapon offense scales with the
    // wielder's primary attribute (caster favours staves over swords).
    const scoreOf = (it, hero) => (it ? computeItemScores(it, hero).total : 0);

    const candidates = (_state.party || []).filter(p =>
      p && p.autoEquip === true && !(p.isCompanion || p.class === 'companion')
    );
    if (candidates.length === 0) return false;

    // Determine candidate slot(s) for the item (mirrors InventoryScreen._slotsForItem).
    const slotsFor = (member, it) => {
      const slots = [];
      if (it.type === 'weapon') {
        slots.push('weapon');
        if (!it.twoHanded) slots.push('offhand');
        return slots;
      }
      if (it.subtype === 'ring' || it.slot === 'ring') return ['ring1', 'ring2'];
      if (it.slot) return [it.slot];
      if (it.subtype) return [it.subtype];
      return [];
    };

    let best = null; // { member, slot, delta, isEmpty }
    for (const member of candidates) {
      const eqp = member.equipment || {};
      const slots = slotsFor(member, item);
      for (const s of slots) {
        // Empty slot wins outright (treat as Infinity delta).
        if (!eqp[s]) {
          if (s === 'offhand' && eqp.weapon?.twoHanded) continue;
          const cand = { member, slot: s, delta: Infinity, isEmpty: true };
          if (!best || cand.delta > best.delta) best = cand;
          continue;
        }
        const cur = eqp[s];
        const delta = scoreOf(item, member) - scoreOf(cur, member);
        if (delta > 0 && (!best || delta > best.delta)) {
          best = { member, slot: s, delta, isEmpty: false };
        }
      }
    }
    if (!best) return false;

    // Perform the equip. Swap the existing item back to inventory.
    if (!best.member.equipment) best.member.equipment = {};
    // 2H weapons must clear offhand.
    if (item.twoHanded && item.type === 'weapon') {
      if (best.member.equipment.offhand) {
        _state.inventory.push(best.member.equipment.offhand);
        delete best.member.equipment.offhand;
      }
    }
    if (best.member.equipment[best.slot]) {
      _state.inventory.push(best.member.equipment[best.slot]);
    }
    best.member.equipment[best.slot] = item;
    // Remove from inventory (the just-pushed item).
    _state.inventory = _state.inventory.filter(i => i.id !== item.id);
    // M293: return the member so callers can show a toast.
    return { member: best.member };
  },

  /**
   * M293 — Check whether an item in inventory is a strict upgrade for any
   * party member (auto-equip OFF members included), without modifying state.
   * Returns { member } of the best candidate, or null.
   */
  findUpgradeCandidate(item) {
    if (!item) return null;
    const t = item.type;
    if (t !== 'weapon' && t !== 'armor' && t !== 'accessory') return null;
    const scoreOf = (it, hero) => (it ? computeItemScores(it, hero).total : 0);
    const slotsFor = (member, it) => {
      if (it.type === 'weapon') {
        const s = ['weapon'];
        if (!it.twoHanded) s.push('offhand');
        return s;
      }
      if (it.subtype === 'ring' || it.slot === 'ring') return ['ring1', 'ring2'];
      if (it.slot) return [it.slot];
      if (it.subtype) return [it.subtype];
      return [];
    };
    const candidates = (_state.party || []).filter(p =>
      p && !(p.isCompanion || p.class === 'companion')
    );
    let best = null;
    let bestDelta = 0;
    for (const member of candidates) {
      const eqp = member.equipment || {};
      for (const s of slotsFor(member, item)) {
        if (!eqp[s]) { return { member }; } // empty slot = upgrade
        const delta = scoreOf(item, member) - scoreOf(eqp[s], member);
        if (delta > bestDelta) { bestDelta = delta; best = { member }; }
      }
    }
    return best;
  },

  getMaterials() { return _state.materials || {}; },
  addMaterials(matObj) {
    if (!_state.materials) _state.materials = {};
    for (const [k, v] of Object.entries(matObj)) {
      _state.materials[k] = (_state.materials[k] || 0) + v;
    }
  },

  getParty() { return _state.party; },
  getCompanions() { return _state.companions; },
  getAllCombatants() { return [..._state.party, ..._state.companions]; },

  addToParty(hero) {
    if (_state.party.length < 4) { _state.party.push(hero); return true; }
    return false;
  },
  addToCompanions(companion) {
    if (!companion) return false;
    const isComp = companion.isCompanion || companion.class === 'companion';
    if (!isComp) return false;
    if (_state.companions.length < 4) {
      // M450: recompute maxHp/maxMp at hire time so the companion's display
      // matches the live formula (CON × conMult + base + passive + affix).
      // Without this, companions persisted with a stale higher maxHp from
      // an old balance pass would render "365/180".
      try { recalcPassiveStats(companion); } catch (_) {}
      _state.companions.push(companion);
      return true;
    }
    return false;
  },
  // M450: clamp every member's current hp/mp to ≤ their max. Called by
  // game loaders so persisted-but-stale hp values from earlier balance
  // passes (e.g. companion 365/180) auto-correct on first read.
  recomputeAndClampMembers() {
    const all = [..._state.party || [], ..._state.companions || [], ..._state.bench || []];
    for (const m of all) {
      try { recalcPassiveStats(m); } catch (_) { /* leave as-is on error */ }
    }
  },
  addToBench(member) { _state.bench.push(member); },

  // M57 hard invariant: companion slot must never hold a hero entity.
  sanitizeRoster() {
    const isComp = m => !!(m && (m.isCompanion || m.class === 'companion'));
    const misplaced = _state.companions.filter(m => !isComp(m));
    if (misplaced.length) {
      _state.companions = _state.companions.filter(isComp);
      _state.bench = _state.bench || [];
      for (const m of misplaced) if (!_state.bench.includes(m) && !_state.party.includes(m)) _state.bench.push(m);
    }
  },

  visitNode(nodeId) { _state.visitedNodes.add(nodeId); },
  hasVisited(nodeId) { return _state.visitedNodes.has(nodeId); },

  // M327: fame is GLOBAL — earned across every save and persists when you
  // start a new game. localStorage is authoritative; the per-state .fame
  // mirror is kept for in-flight UI that reads gs.fame, but is rewritten
  // from localStorage on every getFame()/addFame() to stay in sync.
  addFame(amount) {
    const before = _readGlobalFame();
    const cur = before + (Number(amount) || 0);
    _writeGlobalFame(cur);
    _state.fame = cur;
    // M330 — emit a milestone event when fame crosses a tier boundary.
    try {
      const TIERS = [100, 250, 500, 1000, 2000, 5000];
      for (const t of TIERS) {
        if (before < t && cur >= t) {
          if (typeof window !== 'undefined' && typeof window.__rsgPushEvent === 'function') {
            window.__rsgPushEvent('fame_threshold_reached', { threshold: t, total_fame: cur });
          }
        }
      }
    } catch (_) {}
  },
  getFame() {
    const cur = _readGlobalFame();
    _state.fame = cur;
    return cur;
  },

  getNgPlus() { return _state.ngPlus || 0; },
  startNgPlus() {
    const ng = (_state.ngPlus || 0) + 1;
    // Keep heroes/companions/inventory/fame, reset zones + per-run progression.
    _state.ngPlus = ng;
    try { setLootNgPlus(ng); } catch (_) {}
    // M### — clear ALL per-run progression (node completion, story flags,
    // one-time dialogs, random-event picks, sneaks, shrines, dungeons,
    // map overlays, fog reveal, pre-rolled boss chests, infinite-depths
    // run). Heroes / companions / inventory / fame / achievements / saved
    // hires / lifetime stats / settings persist.
    resetRunProgression(_state);
    _state.gold = Math.max(150, Math.floor((_state.gold || 0) * 0.5));
    // Level-cap boost: heroes keep their level but get 5 extra attr points
    [..._state.party, ..._state.companions].forEach(m => {
      m.pendingAttrPoints = (m.pendingAttrPoints || 0) + 5;
      m.hp = m.maxHp || 100;
      m.mp = m.maxMp || 80;
    });
  },
  openPortal(nodeId, zoneId) { _state.portal = { nodeId, zoneId }; },
  closePortal() { _state.portal = null; },
  getPortal() { return _state.portal; },

  getFameTitle() {
    const f = _state.fame || 0;
    if (f >= 500) return 'Legendary';
    if (f >= 250) return 'Renowned';
    if (f >= 100) return 'Respected';
    if (f >= 50)  return 'Known';
    if (f >= 20)  return 'Noticed';
    return 'Unknown';
  },
};
