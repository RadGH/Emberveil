/**
 * storyContent.js — Runtime content registry for Story Mode.
 *
 * Lazy-loads quest-lines, dialogue-pools, and banter-pools from
 * data/story/<category>/<id>.json.
 *
 * Browser: uses fetch() against the path under public/assets/data/story/.
 * Node (tests): uses fs.readFileSync against the resolved file path.
 *
 * The module only abstracts the load. Heavy content authoring lands in M-S19+.
 * For now the registry acts as a cache so each file is fetched at most once.
 */

// ---------------------------------------------------------------------------
// Caches — simple object maps so there are no Sets in the story system.
// ---------------------------------------------------------------------------
const _questCache    = {}; // questId -> parsed JSON
const _dialogCache   = {}; // poolId  -> parsed JSON
const _banterCache   = {}; // pairKey -> parsed JSON

// ---------------------------------------------------------------------------
// Path resolution helpers
// ---------------------------------------------------------------------------

function _isNode() {
  return typeof process !== 'undefined' && process.versions?.node;
}

/**
 * Resolve the file path (Node) or fetch URL (browser) for a content asset.
 * Base segment is relative to the repo root data/story/ for Node,
 * or public/assets/data/story/ for browser (served via Vite / static host).
 */
// (Path resolution is handled per-environment in _readNode / _fetchBrowser; no
// shared helper needed.)

/**
 * Synchronous Node.js read. Resolves path relative to this source file.
 * Returns parsed JSON or throws.
 */
function _readNode(category, filename) {
  // Dynamic require of 'path' and 'fs' — available in Node, absent in browser bundles.
  // Using globalThis to avoid Vite static analysis of require() calls.
  const nodePath = globalThis.require?.('path');
  const nodeFs   = globalThis.require?.('fs');
  if (!nodePath || !nodeFs) {
    throw new Error('[storyContent] Node require not available');
  }
  // In ESM (Vitest node env), __dirname is not defined. Use process.cwd() path instead.
  const dir = nodePath.join(process.cwd(), 'src', 'story');
  const filePath = nodePath.join(dir, '..', '..', 'data', 'story', category, filename);
  const raw = nodeFs.readFileSync(filePath, 'utf8');
  return JSON.parse(raw);
}

/**
 * Async browser fetch. Returns parsed JSON or throws.
 */
async function _fetchBrowser(category, filename) {
  const base = (typeof import.meta !== 'undefined' && __APP_BASE__) || '/';
  const url  = `${base}assets/data/story/${category}/${filename}`;
  const res  = await fetch(url);
  if (!res.ok) throw new Error(`[storyContent] fetch failed ${res.status}: ${url}`);
  return res.json();
}

/**
 * Unified load — sync in Node, async in browser.
 * Returns the parsed JSON (or a Promise<parsed JSON> in browser).
 */
function _load(category, filename) {
  if (_isNode()) {
    return _readNode(category, filename);
  }
  return _fetchBrowser(category, filename);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Load and cache a quest-line definition by id.
 * Returns the parsed definition (sync in Node, Promise in browser).
 */
export function loadQuestLine(id) {
  if (_questCache[id]) return _questCache[id];
  const result = _load('quest-lines', `${id}.json`);
  if (result && typeof result.then === 'function') {
    return result.then(data => { _questCache[id] = data; return data; });
  }
  _questCache[id] = result;
  return result;
}

/**
 * Load and cache a dialogue pool by id.
 * Returns the parsed pool (sync in Node, Promise in browser).
 */
export function loadDialoguePool(id) {
  if (_dialogCache[id]) return _dialogCache[id];
  const result = _load('dialogue-pools', `${id}.json`);
  if (result && typeof result.then === 'function') {
    return result.then(data => { _dialogCache[id] = data; return data; });
  }
  _dialogCache[id] = result;
  return result;
}

/**
 * Load and cache a banter pool for a companion pair.
 * Pair key is `<idA>_<idB>` (alphabetical, so order doesn't matter).
 * Returns the parsed pool (sync in Node, Promise in browser).
 */
export function loadBanterPool(idA, idB) {
  const key = [idA, idB].sort().join('_');
  if (_banterCache[key]) return _banterCache[key];
  const result = _load('banter-pools', `${key}.json`);
  if (result && typeof result.then === 'function') {
    return result
      .then(data => { _banterCache[key] = data; return data; })
      .catch(() => {
        // No pool for this pair is normal — return empty array.
        _banterCache[key] = [];
        return [];
      });
  }
  _banterCache[key] = result;
  return result;
}

/**
 * Manually register a quest definition (used in tests / headless sim to
 * inject content without hitting the filesystem).
 */
export function registerQuestLine(def) {
  if (!def?.id) throw new Error('[storyContent] registerQuestLine: def.id required');
  _questCache[def.id] = def;
}

/**
 * Manually register a dialogue pool (tests / headless sim).
 */
export function registerDialoguePool(id, data) {
  _dialogCache[id] = data;
}

/**
 * Manually register a banter pool (tests / headless sim).
 */
export function registerBanterPool(idA, idB, data) {
  const key = [idA, idB].sort().join('_');
  _banterCache[key] = data;
}

/**
 * Clear all caches. Useful in tests to reset state between cases.
 */
export function clearContentCaches() {
  for (const k of Object.keys(_questCache))  delete _questCache[k];
  for (const k of Object.keys(_dialogCache)) delete _dialogCache[k];
  for (const k of Object.keys(_banterCache)) delete _banterCache[k];
}

/**
 * Build a __storyContent registry object suitable for attaching to gs
 * in the headless sim / test harness.
 *
 * In production this is populated by the campaign runner as quest-lines
 * are loaded. In tests, call loadQuestLine/registerQuestLine then
 * buildContentRegistry(gs) to wire up gs.__storyContent.
 */
export function buildContentRegistry(loadedQuests = {}) {
  return {
    quests: { ...loadedQuests },
  };
}
