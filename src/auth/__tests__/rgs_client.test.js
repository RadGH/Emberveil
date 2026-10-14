// Unit tests for the rgs stand-in (src/auth/rgs/client.js) with fetch mocked.
// The request bodies are checked against ~/claude/rads-game-server/docs/API.md.
import { describe, it, expect, vi } from 'vitest';
import { createRgsClient, parseAuthHash } from '../rgs/client.js';

const USER = { id: 'u-1', email: 'a@b.c', created_at: '2026-01-01T00:00:00Z', email_confirmed_at: null, app_metadata: { provider: 'email' } };
const FUTURE = Math.floor(Date.now() / 1000) + 3600;

function memoryStorage(init = {}) {
  const m = new Map(Object.entries(init));
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, String(v)),
    removeItem: (k) => m.delete(k),
    _map: m,
  };
}

function jsonResponse(body, status = 200) {
  return { ok: status >= 200 && status < 300, status, json: async () => body };
}

/** fetch mock: `routes` maps "METHOD path" to a response body or a function(body) -> [status, body]. */
function mockFetch(routes) {
  const calls = [];
  const fn = vi.fn(async (url, init = {}) => {
    const path = url.replace(/^\/api/, '').split('?')[0];
    const key = `${init.method || 'GET'} ${path}`;
    const body = init.body ? JSON.parse(init.body) : undefined;
    calls.push({ url, key, body, headers: init.headers || {} });
    const r = routes[key];
    if (r === undefined) return jsonResponse({ error: { message: 'no route', code: 'not_found' } }, 404);
    if (typeof r === 'function') { const [status, b] = r(body); return jsonResponse(b, status); }
    return jsonResponse(r);
  });
  fn.calls = calls;
  return fn;
}

function client(opts = {}) {
  return createRgsClient({
    baseUrl: '/api',
    game: 'emberveil',
    storage: opts.storage || memoryStorage(),
    fetch: opts.fetch || mockFetch({}),
    location: opts.location || { hash: '', pathname: '/emberveil/play.html', search: '', href: 'https://games.radgh.com/emberveil/play.html', assign: vi.fn() },
    history: opts.history || { state: null, replaceState: vi.fn() },
  });
}

function signedInStorage() {
  return memoryStorage({ 'rgs.session': JSON.stringify({ access_token: 'tok', token_type: 'bearer', expires_at: FUTURE, user: USER }) });
}

describe('parseAuthHash', () => {
  it('reads a token and an error', () => {
    expect(parseAuthHash('#access_token=abc&expires_at=123&token_type=bearer&type=signup').session.access_token).toBe('abc');
    expect(parseAuthHash('#error=access_denied&error_description=Nope').error.message).toBe('Nope');
    expect(parseAuthHash('#settings')).toBe(null);
    expect(parseAuthHash('')).toBe(null);
  });
});

describe('session from the URL hash', () => {
  it('stores the token, fetches the user, cleans the URL and fires SIGNED_IN', async () => {
    const storage = memoryStorage();
    const history = { state: null, replaceState: vi.fn() };
    const fetch = mockFetch({ 'GET /auth/user': { user: USER } });
    const events = [];
    const c = client({
      storage, history, fetch,
      location: { hash: `#access_token=xyz&expires_at=${FUTURE}&token_type=bearer&type=signup`, pathname: '/emberveil/play.html', search: '?a=1', href: '', assign: vi.fn() },
    });
    c.auth.onAuthStateChange((e, s) => events.push([e, s?.user?.id]));
    const { data, error } = await c.auth.getSession();
    expect(error).toBe(null);
    expect(data.session.access_token).toBe('xyz');
    expect(data.session.expires_at).toBeGreaterThanOrEqual(FUTURE); // extended on use, like the server
    expect(data.session.user).toEqual(USER);
    expect(history.replaceState).toHaveBeenCalledWith(null, '', '/emberveil/play.html?a=1');
    expect(fetch.calls[0].headers.Authorization).toBe('Bearer xyz');
    expect(JSON.parse(storage.getItem('rgs.session')).access_token).toBe('xyz');
    await new Promise((r) => setTimeout(r, 0));
    expect(events.map((e) => e[0])).toEqual(['SIGNED_IN', 'INITIAL_SESSION']);
    expect(events[0][1]).toBe('u-1');
  });

  it('reports #error=… once through getSession and stays signed out', async () => {
    const c = client({ location: { hash: '#error=server_error&error_description=Google%20said%20no', pathname: '/', search: '', href: '', assign: vi.fn() } });
    const first = await c.auth.getSession();
    expect(first.error.message).toBe('Google said no');
    expect(first.data.session).toBe(null);
    expect((await c.auth.getSession()).error).toBe(null);
  });

  it('restores a stored session across reloads', async () => {
    const c = client({ storage: signedInStorage() });
    const { data } = await c.auth.getSession();
    expect(data.session.user.id).toBe('u-1');
  });
});

describe('sign in / sign out', () => {
  it('signInWithPassword posts to /auth/token, stores the session and fires SIGNED_IN', async () => {
    const session = { access_token: 'p1', token_type: 'bearer', expires_at: FUTURE, user: USER };
    const fetch = mockFetch({ 'POST /auth/token': { session } });
    const storage = memoryStorage();
    const c = client({ fetch, storage });
    const events = [];
    c.auth.onAuthStateChange((e) => events.push(e));
    await c.ready;
    const { data, error } = await c.auth.signInWithPassword({ email: 'a@b.c', password: 'secret123' });
    expect(error).toBe(null);
    expect(data.user.id).toBe('u-1');
    expect(fetch.calls[0].body).toEqual({ email: 'a@b.c', password: 'secret123' });
    expect(storage.getItem('rgs.session')).toContain('p1');
    await new Promise((r) => setTimeout(r, 0));
    expect(events).toContain('SIGNED_IN');
  });

  it('wrong login returns the server message in error', async () => {
    const fetch = mockFetch({ 'POST /auth/token': () => [400, { error: { message: 'Invalid login credentials', code: 'invalid_credentials' } }] });
    const { data, error } = await client({ fetch }).auth.signInWithPassword({ email: 'a@b.c', password: 'x' });
    expect(data.session).toBe(null);
    expect(error.message).toBe('Invalid login credentials');
    expect(error.code).toBe('invalid_credentials');
  });

  it('signOut calls /auth/logout with the token, clears storage, fires SIGNED_OUT', async () => {
    const fetch = mockFetch({ 'POST /auth/logout': {} });
    const storage = signedInStorage();
    const c = client({ fetch, storage });
    const events = [];
    c.auth.onAuthStateChange((e) => events.push(e));
    const { error } = await c.auth.signOut();
    expect(error).toBe(null);
    expect(fetch.calls[0].headers.Authorization).toBe('Bearer tok');
    expect(storage.getItem('rgs.session')).toBe(null);
    expect(events).toContain('SIGNED_OUT');
    expect((await c.auth.getSession()).data.session).toBe(null);
  });

  it('signUp sends emailRedirectTo as redirect_to', async () => {
    const fetch = mockFetch({ 'POST /auth/signup': { user: USER, session: null } });
    const { data, error } = await client({ fetch }).auth.signUp({ email: 'a@b.c', password: 'longenough', options: { emailRedirectTo: 'https://games.radgh.com/emberveil/' } });
    expect(error).toBe(null);
    expect(data).toEqual({ user: USER, session: null });
    expect(fetch.calls[0].body).toEqual({ email: 'a@b.c', password: 'longenough', redirect_to: 'https://games.radgh.com/emberveil/' });
  });

  it('signInWithOAuth sends the browser to /auth/google with redirect_to', async () => {
    const location = { hash: '', pathname: '/', search: '', href: 'https://games.radgh.com/emberveil/play.html', assign: vi.fn() };
    await client({ location }).auth.signInWithOAuth({ provider: 'google', options: { redirectTo: 'https://games.radgh.com/emberveil/play.html' } });
    expect(location.assign).toHaveBeenCalledWith('/api/auth/google?redirect_to=' + encodeURIComponent('https://games.radgh.com/emberveil/play.html'));
  });

  it('getUser with a dead token (401) signs out', async () => {
    const fetch = mockFetch({ 'GET /auth/user': () => [401, { error: { message: 'Unauthorized', code: 'unauthorized' } }] });
    const c = client({ fetch, storage: signedInStorage() });
    const events = [];
    c.auth.onAuthStateChange((e) => events.push(e));
    const { data, error } = await c.auth.getUser();
    expect(data.user).toBe(null);
    expect(error.status).toBe(401);
    expect(events).toContain('SIGNED_OUT');
  });
});

describe('data calls match API.md', () => {
  it('select with filter, order and maybeSingle', async () => {
    const row = { slot_name: 'slot1', state: { a: 1 }, updated_at: 'x', created_at: 'y' };
    const fetch = mockFetch({ 'POST /db/emberveil': { data: row, error: null } });
    const c = client({ fetch, storage: signedInStorage() });
    const { data, error } = await c.from('saves').select('slot_name, state, updated_at, created_at').eq('slot_name', 'slot1').maybeSingle();
    expect(error).toBe(null);
    expect(data).toEqual(row);
    expect(fetch.calls[0].url).toBe('/api/db/emberveil');
    expect(fetch.calls[0].headers.Authorization).toBe('Bearer tok');
    expect(fetch.calls[0].body).toEqual({
      table: 'saves', op: 'select', columns: 'slot_name, state, updated_at, created_at',
      filters: [['slot_name', 'eq', 'slot1']], single: 'maybeSingle',
    });
  });

  it('select * with order and limit', async () => {
    const fetch = mockFetch({ 'POST /db/emberveil': { data: [], error: null } });
    await client({ fetch, storage: signedInStorage() }).from('run_stats').select('*').eq('user_id', 'u-1').order('started_at', { ascending: false }).limit(50);
    expect(fetch.calls[0].body).toEqual({
      table: 'run_stats', op: 'select', columns: '*', filters: [['user_id', 'eq', 'u-1']],
      order: { column: 'started_at', ascending: false }, limit: 50,
    });
  });

  it('upsert followed by select().single()', async () => {
    const fetch = mockFetch({ 'POST /db/emberveil': { data: { slot_name: 'slot1', updated_at: 'now' }, error: null } });
    const row = { user_id: 'u-1', slot_name: 'slot1', state: { gold: 5 } };
    const { data } = await client({ fetch, storage: signedInStorage() }).from('saves').upsert(row, { onConflict: 'user_id,slot_name' }).select('slot_name, updated_at').single();
    expect(data).toEqual({ slot_name: 'slot1', updated_at: 'now' });
    expect(fetch.calls[0].body).toEqual({
      table: 'saves', op: 'upsert', rows: [row], onConflict: 'user_id,slot_name',
      columns: 'slot_name, updated_at', returning: true, filters: [], single: 'single',
    });
  });

  it('update with two filters, delete, insert', async () => {
    const fetch = mockFetch({ 'POST /db/emberveil': { data: null, error: null } });
    const c = client({ fetch, storage: signedInStorage() });
    await c.from('run_stats').update({ outcome: 'win' }).eq('user_id', 'u-1').eq('run_id', 'r1');
    await c.from('saves').delete().eq('slot_name', 'slot1');
    await c.from('telemetry_events').insert({ event: 'x' });
    expect(fetch.calls.map((x) => x.body)).toEqual([
      { table: 'run_stats', op: 'update', rows: { outcome: 'win' }, filters: [['user_id', 'eq', 'u-1'], ['run_id', 'eq', 'r1']] },
      { table: 'saves', op: 'delete', filters: [['slot_name', 'eq', 'slot1']] },
      { table: 'telemetry_events', op: 'insert', rows: [{ event: 'x' }], filters: [] },
    ]);
  });

  it('a row-level error in a 200 reply comes back as error', async () => {
    const fetch = mockFetch({ 'POST /db/emberveil': { data: null, error: { message: 'no rows', code: 'PGRST116' } } });
    const { data, error } = await client({ fetch, storage: signedInStorage() }).from('saves').select('*').single();
    expect(data).toBe(null);
    expect(error.code).toBe('PGRST116');
  });

  it('network failure resolves to { error } and never throws', async () => {
    const fetch = vi.fn(async () => { throw new TypeError('Failed to fetch'); });
    const c = client({ fetch, storage: signedInStorage() });
    const r = await c.from('saves').select('*');
    expect(r.data).toBe(null);
    expect(r.error.code).toBe('network_error');
    const u = await c.auth.getUser();
    expect(u.error.code).toBe('network_error');
    const s = await c.auth.signInWithPassword({ email: 'a', password: 'b' });
    expect(s.error.code).toBe('network_error');
    // A network failure must not sign the player out.
    expect((await c.auth.getSession()).data.session).not.toBe(null);
  });

  it('data calls while signed out return an error without a request', async () => {
    const fetch = mockFetch({});
    const r = await client({ fetch }).from('saves').select('*');
    expect(r.error.code).toBe('not_signed_in');
    expect(fetch).not.toHaveBeenCalled();
  });
});
