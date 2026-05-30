/**
 * cloudSaves — thin sync layer between SaveManager (localStorage) and the
 * Supabase `saves` table. Fire-and-forget from game code: every local save
 * push triggers a background cloud upsert when signed in. Failures are
 * logged but never block gameplay.
 *
 * slot_name in the cloud = the localStorage key (e.g. emberveil_save_hero_abc123),
 * so a round-trip preserves identity.
 */
import { savesClient, SavesClientError } from './savesClient.js';
import { authManager } from './authManager.js';
import { debug } from '../utils/debug.js';

const SAVE_KEY_PREFIX = 'emberveil_save_';
// M272: "meta" keys that are NOT per-hero saves but still belong to the
// account and should sync across devices. Each lives in the same Supabase
// `saves` table under a reserved slot_name, keyed 1:1 with its localStorage
// key. Class-unlock persistence was the motivating case — it shipped with
// `emberveil_unlocks` and was silently dropped by the save-prefix filter.
// M400 — stats persistence: lifetime stats + run stats sync to cloud so the
// player's character/run survives a hard refresh (the user reported losing
// "current character" from the in-game stats panel after a browser reload).
const META_KEYS = ['emberveil_unlocks', 'emberveil_life_stats_v1', 'emberveil_run_stats_v1', 'emberveil_telemetry_errors_v1'];
const isMetaKey = (k) => META_KEYS.includes(k);
const isSyncableKey = (k) => !!k && (k.startsWith(SAVE_KEY_PREFIX) || isMetaKey(k));

let inflight = new Map(); // key → Promise, to coalesce rapid successive saves
let pendingPushes = new Map(); // key → record, deferred while window.__inCombat is true

export const cloudSaves = {
  /** Is the user signed in right now? */
  get isAvailable() { return authManager.isSignedIn && authManager.configured; },

  /**
   * Push a single save record to the cloud. Fire-and-forget.
   * Returns a promise that resolves with { ok, error? } — callers can await
   * it if they care about completion (rare), or ignore it (common).
   */
  async pushSave(key, record, opts = {}) {
    if (!this.isAvailable) { debug.saves('push skipped (signed out)', { key }); return { ok: false, skipped: true }; }
    // M272: accept meta keys (emberveil_unlocks etc.) alongside save keys.
    if (!isSyncableKey(key)) { debug.saves('push skipped (bad key)', { key }); return { ok: false, skipped: true }; }
    // M472 — defer cloud writes during combat. One encounter against 3 enemies
    // was firing 27 PATCHes; combat state churns every turn so each save was
    // pushing the entire run record. The user explicitly accepted that combat
    // interruption loses progress, so we cache the latest record per key and
    // flush at combat end (CombatScreen → flushPendingPushes()).
    if (typeof window !== 'undefined' && window.__inCombat && !opts.force) {
      pendingPushes.set(key, record);
      debug.saves('push deferred (combat)', { key, queued: pendingPushes.size });
      return { ok: true, deferred: true };
    }
    // Coalesce: if a push for this key is in flight, overwrite the promise so
    // the latest state always wins.
    const task = (async () => {
      try {
        const res = await savesClient.write(key, record);
        debug.saves('push ok', { key, updated_at: res?.updated_at });
        return { ok: true };
      } catch (e) {
        const msg = e instanceof SavesClientError ? e.message : (e.message || String(e));
        debug.saves('push error', { key, error: msg });
        return { ok: false, error: msg };
      } finally {
        inflight.delete(key);
      }
    })();
    inflight.set(key, task);
    return task;
  },

  async deleteSave(key) {
    if (!this.isAvailable) { debug.saves('delete skipped (signed out)', { key }); return { ok: false, skipped: true }; }
    if (!key) return { ok: false };
    try {
      await savesClient.remove(key);
      debug.saves('delete ok', { key });
      return { ok: true };
    } catch (e) {
      const msg = e instanceof SavesClientError ? e.message : (e.message || String(e));
      debug.saves('delete error', { key, error: msg });
      return { ok: false, error: msg };
    }
  },

  async listCloud() {
    if (!this.isAvailable) return { ok: false, items: [] };
    try {
      const items = await savesClient.list();
      debug.saves('list ok', { count: items.length });
      return { ok: true, items };
    } catch (e) {
      const msg = e instanceof SavesClientError ? e.message : (e.message || String(e));
      debug.saves('list error', { error: msg });
      return { ok: false, error: msg, items: [] };
    }
  },

  async readCloud(key) {
    if (!this.isAvailable) return null;
    try {
      const row = await savesClient.read(key);
      debug.saves('read ok', { key, hit: !!row });
      return row; // { slot_name, state, updated_at, created_at } | null
    } catch (e) {
      const msg = e instanceof SavesClientError ? e.message : (e.message || String(e));
      debug.saves('read error', { key, error: msg });
      return null;
    }
  },

  /**
   * Find local saves that are not yet in the cloud. Returns an array of
   * { key, record } pairs the caller can choose to upload.
   */
  async findLocalSavesNotInCloud() {
    if (!this.isAvailable) return [];
    const cloudRes = await this.listCloud();
    if (!cloudRes.ok) return [];
    const cloudKeys = new Set(cloudRes.items.map(r => r.slot_name));
    const localPairs = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!isSyncableKey(key)) continue;
      if (cloudKeys.has(key)) continue;
      try {
        const raw = localStorage.getItem(key);
        if (!raw) continue;
        const record = JSON.parse(raw);
        localPairs.push({ key, record });
      } catch (_) {}
    }
    debug.saves('diff: local not in cloud', { count: localPairs.length });
    return localPairs;
  },

  /**
   * Upload every local save not yet in the cloud. Returns counts.
   */
  async uploadAllMissing() {
    const pairs = await this.findLocalSavesNotInCloud();
    let ok = 0, fail = 0;
    for (const { key, record } of pairs) {
      const r = await this.pushSave(key, record);
      if (r.ok) ok++; else fail++;
    }
    debug.saves('uploadAllMissing done', { ok, fail });
    return { attempted: pairs.length, ok, fail };
  },

  /**
   * M213 — Merge cloud saves with local, using a stable per-save `fingerprint`
   * (UUID stored inside the save record) to reconcile records that exist on
   * both sides. Latest `createdAt` wins on conflict. Saves unique to either
   * side are preserved. Never deletes anything.
   *
   * Returns { downloaded, uploaded, conflicts, localNewer, cloudNewer, fail }.
   */
  async mergeWithCloud() {
    const res = { downloaded: 0, uploaded: 0, conflicts: 0, localNewer: 0, cloudNewer: 0, fail: 0 };
    if (!this.isAvailable) return res;

    // Build local index: fingerprint → { key, record, mtime }. If a record has
    // no fingerprint (legacy), fall back to slot_name match on the cloud side.
    const localByFp = new Map();
    const localByKey = new Map();
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!isSyncableKey(k)) continue;
      try {
        const r = JSON.parse(localStorage.getItem(k));
        const mtime = r?.createdAt || 0;
        const entry = { key: k, record: r, mtime };
        localByKey.set(k, entry);
        if (r?.fingerprint) localByFp.set(r.fingerprint, entry);
      } catch (_) {}
    }

    // Fetch ALL cloud records (slot_name + state) in a single query instead of
    // N individual readCloud() calls. This was the source of the ~184-request
    // burst: one auth.getUser() + one SELECT per save row.
    let cloudSavesFull;
    try {
      cloudSavesFull = await savesClient.listFull();
    } catch (e) {
      const msg = e instanceof SavesClientError ? e.message : (e.message || String(e));
      debug.saves('mergeWithCloud listFull error', { error: msg });
      return res;
    }

    const handledLocalKeys = new Set();

    for (const row of cloudSavesFull) {
      const slot = row.slot_name;
      const state = row.state || {};
      const cloudFp = state.fingerprint || null;
      const cloudMtime = state.createdAt || Date.parse(row.updated_at || 0) || 0;

      // Match by fingerprint first, then by slot key as legacy fallback.
      let match = (cloudFp && localByFp.get(cloudFp)) || localByKey.get(slot) || null;

      if (!match) {
        try {
          localStorage.setItem(slot, JSON.stringify(state));
          res.downloaded++;
        } catch (e) { res.fail++; debug.saves('merge write-local error', { slot, error: e.message }); }
        continue;
      }
      handledLocalKeys.add(match.key);
      const localMtime = match.mtime || 0;
      if (cloudMtime > localMtime) {
        try {
          // Write cloud state under its own slot to keep the canonical key.
          // If the local copy lived under a different key (different device),
          // remove the stale local key afterwards so it isn't duplicated.
          localStorage.setItem(slot, JSON.stringify(state));
          if (match.key !== slot) {
            try { localStorage.removeItem(match.key); } catch (_) {}
          }
          res.downloaded++; res.cloudNewer++; res.conflicts++;
        } catch (e) { res.fail++; }
      } else if (cloudMtime < localMtime) {
        // Push local over the cloud record (under the cloud's slot so future
        // merges stay aligned on the key).
        try {
          await this.pushSave(match.key, match.record);
          res.uploaded++; res.localNewer++; res.conflicts++;
        } catch (e) { res.fail++; }
      }
      // equal → no-op
    }

    // Upload local saves that aren't present in the cloud at all.
    for (const [k, entry] of localByKey) {
      if (handledLocalKeys.has(k)) continue;
      // Skip saves already covered by fingerprint match above.
      if (entry.record?.fingerprint && cloudSavesFull.some(r => r.state?.fingerprint === entry.record.fingerprint)) continue;
      try {
        const r = await this.pushSave(k, entry.record);
        if (r.ok) res.uploaded++; else res.fail++;
      } catch (_) { res.fail++; }
    }

    debug.saves('mergeWithCloud done', res);
    return res;
  },

  /**
   * Download every cloud save into localStorage, skipping ones that already
   * exist locally. Returns counts.
   */
  async downloadAllMissing() {
    if (!this.isAvailable) return { attempted: 0, ok: 0, fail: 0 };
    // Use listFull() to fetch all saves including state in one query instead of
    // N individual readCloud() calls (same N+1 bug as mergeWithCloud).
    let rows;
    try {
      rows = await savesClient.listFull();
    } catch (e) {
      const msg = e instanceof SavesClientError ? e.message : (e.message || String(e));
      debug.saves('downloadAllMissing listFull error', { error: msg });
      return { attempted: 0, ok: 0, fail: 0, error: msg };
    }
    let ok = 0, fail = 0;
    for (const row of rows) {
      const key = row.slot_name;
      if (localStorage.getItem(key)) continue;
      try {
        localStorage.setItem(key, JSON.stringify(row.state));
        ok++;
      } catch (e) { fail++; debug.saves('write-local error', { key, error: e.message }); }
    }
    debug.saves('downloadAllMissing done', { ok, fail });
    return { attempted: rows.length, ok, fail };
  },

  /**
   * Flush any pushes that were deferred while window.__inCombat was true.
   * Called from CombatScreen at combat end (victory + defeat). Each key
   * fires once with the latest cached record so we never spam the API.
   */
  async flushPendingPushes() {
    if (pendingPushes.size === 0) {
      debug.saves('flush triggered (0 pending)', { reason: 'combat-end' });
      return { flushed: 0 };
    }
    const entries = Array.from(pendingPushes.entries());
    pendingPushes.clear();
    debug.saves('flush triggered', { reason: 'combat-end', keys: entries.map(([k]) => k), total: entries.length });
    let ok = 0, fail = 0;
    for (const [key, record] of entries) {
      const res = await this.pushSave(key, record, { force: true });
      if (res.ok) ok++; else fail++;
    }
    debug.saves('flush combat pushes done', { ok, fail, total: entries.length });
    return { flushed: entries.length, ok, fail };
  },
};

if (typeof window !== 'undefined') window.__cloudSaves = cloudSaves;
