import { supabase, supabaseConfigured } from './supabaseClient.js';

export class SavesClientError extends Error {
  constructor(message, cause) {
    super(message);
    this.name = 'SavesClientError';
    this.cause = cause;
  }
}

function requireClient() {
  if (!supabaseConfigured || !supabase) {
    throw new SavesClientError('Supabase not configured.');
  }
  return supabase;
}

/**
 * Short-lived user cache — valid for 30 s. Prevents repeated auth.getUser()
 * round-trips when multiple savesClient calls happen in rapid succession
 * (e.g. mergeWithCloud iterating over N saves). Cache is invalidated on
 * any auth state change (sign-out, token refresh) or automatically after TTL.
 */
let _cachedUser = null;
let _cacheExpiry = 0;
let _authListenerRegistered = false;
const USER_CACHE_TTL_MS = 30_000;

function _ensureAuthListener(client) {
  if (_authListenerRegistered) return;
  _authListenerRegistered = true;
  try {
    client.auth.onAuthStateChange(() => {
      _cachedUser = null;
      _cacheExpiry = 0;
    });
  } catch (_) {}
}

async function requireUser() {
  const client = requireClient();
  _ensureAuthListener(client);
  const now = Date.now();
  if (_cachedUser && now < _cacheExpiry) return _cachedUser;
  const { data, error } = await client.auth.getUser();
  if (error) throw new SavesClientError('Not authenticated', error);
  if (!data?.user) throw new SavesClientError('Not authenticated');
  _cachedUser = data.user;
  _cacheExpiry = now + USER_CACHE_TTL_MS;
  return _cachedUser;
}

export const savesClient = {
  async list() {
    const client = requireClient();
    await requireUser();
    const { data, error } = await client
      .from('saves')
      .select('slot_name, updated_at, created_at')
      .order('updated_at', { ascending: false });
    if (error) throw new SavesClientError(`list failed: ${error.message}`, error);
    return data ?? [];
  },

  /**
   * Fetch ALL saves including the full `state` column in one query.
   * Used by mergeWithCloud() to avoid N per-row SELECT calls.
   */
  async listFull() {
    const client = requireClient();
    await requireUser();
    const { data, error } = await client
      .from('saves')
      .select('slot_name, state, updated_at, created_at')
      .order('updated_at', { ascending: false });
    if (error) throw new SavesClientError(`listFull failed: ${error.message}`, error);
    return data ?? [];
  },

  async read(slotName) {
    const client = requireClient();
    await requireUser();
    const { data, error } = await client
      .from('saves')
      .select('slot_name, state, updated_at, created_at')
      .eq('slot_name', slotName)
      .maybeSingle();
    if (error) throw new SavesClientError(`read failed: ${error.message}`, error);
    return data ?? null;
  },

  async write(slotName, state) {
    const client = requireClient();
    const user = await requireUser();
    const row = { user_id: user.id, slot_name: slotName, state };
    const { data, error } = await client
      .from('saves')
      .upsert(row, { onConflict: 'user_id,slot_name' })
      .select('slot_name, updated_at')
      .single();
    if (error) throw new SavesClientError(`write failed: ${error.message}`, error);
    return data;
  },

  async remove(slotName) {
    const client = requireClient();
    await requireUser();
    const { error } = await client
      .from('saves')
      .delete()
      .eq('slot_name', slotName);
    if (error) throw new SavesClientError(`delete failed: ${error.message}`, error);
  },

  async removeAll() {
    const client = requireClient();
    const user = await requireUser();
    const { error } = await client
      .from('saves')
      .delete()
      .eq('user_id', user.id);
    if (error) throw new SavesClientError(`removeAll failed: ${error.message}`, error);
  },
};
