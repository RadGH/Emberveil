/**
 * runStatsClient — M325 cloud-synced per-run statistics.
 *
 * Mirrors the per-run object that `src/game/stats.js` already keeps locally
 * (life-stats key) into a Supabase `run_stats` table. Account-bound — only
 * runs while the user is signed in. Local-only browsers keep their existing
 * localStorage-backed lifetime tally.
 *
 * Schema lives in `supabase/migrations/0002_run_stats.sql`. The migration
 * creates the table, RLS policies, an updated_at bump trigger, and an
 * after-insert trim trigger that caps each user to the latest 100 rows.
 *
 * Failure mode: every call swallows errors and degrades gracefully. The
 * stats UI continues to read from localStorage when the cloud is offline.
 */

import { supabase, supabaseConfigured } from './supabaseClient.js';

export class RunStatsClientError extends Error {
  constructor(message, cause) {
    super(message);
    this.name = 'RunStatsClientError';
    this.cause = cause;
  }
}

async function _user() {
  if (!supabaseConfigured || !supabase) return null;
  try {
    const { data } = await supabase.auth.getUser();
    return data?.user || null;
  } catch (_) { return null; }
}

export const runStatsClient = {
  /** True if the client could push (Supabase configured + signed in). */
  async isAvailable() {
    if (!supabaseConfigured || !supabase) return false;
    const u = await _user();
    return !!u;
  },

  /** Insert a fresh run row. Called by recordRunStarted(). */
  async start({ runId, heroName, heroClass, heroAppearance, difficulty, hardcore }) {
    const user = await _user();
    if (!user) return null;
    try {
      const { data, error } = await supabase
        .from('run_stats')
        .upsert({
          user_id: user.id,
          run_id: runId,
          hero_name: heroName || null,
          hero_class: heroClass || null,
          hero_appearance: heroAppearance || null,
          difficulty: difficulty || null,
          hardcore: !!hardcore,
        }, { onConflict: 'user_id,run_id' })
        .select('id')
        .single();
      if (error) throw error;
      return data;
    } catch (err) {
      console.warn('[runStats] start failed (non-fatal):', err?.message || err);
      return null;
    }
  },

  /** Patch an in-progress run (after each combat / level / zone clear).
   *  M474 — was UPDATE…WHERE which silently no-op'd if no row existed
   *  (loaded saves never called start(), so combat_history was dropped on
   *  the floor with no error). Now UPSERTs so the row is created on first
   *  push if missing. Includes hero metadata derived from the patch when
   *  available so the cloud row has labels even without a separate start(). */
  async update(runId, patch = {}) {
    const user = await _user();
    if (!user) return null;
    try {
      const row = {
        user_id: user.id,
        run_id:  runId,
        max_level:     patch.maxLevel,
        zones_cleared: patch.zonesCleared,
        totals:        patch.totals || {},
        per_char:      patch.perChar || {},
        combat_history: patch.combatHistory,
      };
      if (patch.heroName)       row.hero_name = patch.heroName;
      if (patch.heroClass)      row.hero_class = patch.heroClass;
      if (patch.heroAppearance) row.hero_appearance = patch.heroAppearance;
      if (patch.difficulty)     row.difficulty = patch.difficulty;
      if (typeof patch.hardcore === 'boolean') row.hardcore = patch.hardcore;
      // Only keep keys with defined values.
      Object.keys(row).forEach(k => row[k] === undefined && delete row[k]);
      const { error, data } = await supabase
        .from('run_stats')
        .upsert(row, { onConflict: 'user_id,run_id' })
        .select('id');
      if (error) throw error;
      if (window.__statsDebug) {
        console.log('[runStats] upsert ok', { runId, rowsAffected: data?.length || 0, combatHistoryLen: patch.combatHistory?.length });
      }
      return true;
    } catch (err) {
      console.warn('[runStats] update failed (non-fatal):', err?.message || err);
      return false;
    }
  },

  /** Mark a run finished. outcome ∈ 'win' | 'died' | 'abandoned'. */
  async finish(runId, { outcome, totals, perChar, combatHistory, maxLevel, zonesCleared }) {
    const user = await _user();
    if (!user) return null;
    try {
      const row = {
        ended_at: new Date().toISOString(),
        outcome: outcome || 'abandoned',
        totals: totals || {},
        per_char: perChar || {},
        max_level: maxLevel,
        zones_cleared: zonesCleared,
      };
      if (combatHistory !== undefined) row.combat_history = combatHistory;
      const { error } = await supabase
        .from('run_stats')
        .update(row)
        .eq('user_id', user.id)
        .eq('run_id', runId);
      if (error) throw error;
      return true;
    } catch (err) {
      console.warn('[runStats] finish failed (non-fatal):', err?.message || err);
      return false;
    }
  },

  /** Pull the latest N rows for the signed-in user. */
  async list({ limit = 100 } = {}) {
    const user = await _user();
    if (!user) return [];
    try {
      const { data, error } = await supabase
        .from('run_stats')
        .select('*')
        .eq('user_id', user.id)
        .order('started_at', { ascending: false })
        .limit(limit);
      if (error) throw error;
      return data || [];
    } catch (err) {
      console.warn('[runStats] list failed (non-fatal):', err?.message || err);
      return [];
    }
  },

  /**
   * Pull combat_history entries from the last N run rows and flatten into a
   * single chronological array (newest first). Used by the Statistics screen
   * to display per-combat damage stats across sessions.
   *
   * Returns an array of combatHistory entry objects:
   *   { ts, startedAt, durationSec, won, zoneId, kind, perChar, totals }
   *
   * Gracefully returns [] if the user is not signed in or the column doesn't
   * exist yet (table not yet migrated on this Supabase project).
   */
  async listCombatHistory({ limit = 50 } = {}) {
    const user = await _user();
    if (!user) return [];
    try {
      const { data, error } = await supabase
        .from('run_stats')
        .select('id, started_at, hero_name, hero_class, combat_history')
        .eq('user_id', user.id)
        .order('started_at', { ascending: false })
        .limit(limit);
      if (error) {
        // If the column doesn't exist yet (table not migrated), return [] silently.
        if (error.code === '42703') {
          console.warn('[runStats] combat_history column missing — run migration 0004. Stats page will show empty until setup.');
          return [];
        }
        throw error;
      }
      // Flatten: each row has an array of combat entries; concatenate newest-first.
      const all = [];
      for (const row of (data || [])) {
        const hist = Array.isArray(row.combat_history) ? row.combat_history : [];
        for (const entry of hist) {
          all.push({ ...entry, _runStartedAt: row.started_at, _heroName: row.hero_name, _heroClass: row.hero_class });
        }
      }
      // Sort newest first, cap at limit*10 entries to avoid unbounded lists.
      all.sort((a, b) => (b.ts || 0) - (a.ts || 0));
      return all.slice(0, limit * 10);
    } catch (err) {
      console.warn('[runStats] listCombatHistory failed (non-fatal):', err?.message || err);
      return [];
    }
  },
};
