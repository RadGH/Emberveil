/**
 * rgs client — a small stand-in for the parts of supabase-js that Emberveil uses,
 * talking to Radley's own game server (rgs-api) instead of Supabase.
 *
 * The server contract lives in ~/claude/rads-game-server/docs/API.md.
 *
 * Covered (and nothing else):
 *   auth.getSession / getUser / onAuthStateChange / signUp / signInWithPassword /
 *   signInWithOAuth({ provider: 'google' }) / signOut / resend
 *   from(table).select / insert / upsert / update / delete
 *              .eq / order / limit / single / maybeSingle   (awaitable, like supabase-js)
 *
 * Rules kept from supabase-js so the game code did not have to change:
 *   - every call resolves to { data, error } and never throws (a network failure is an `error`);
 *   - the session is kept in localStorage and survives a reload;
 *   - after a sign-in redirect (email confirm link or Google) the server sends us back with
 *     `#access_token=…&expires_at=…` in the URL; we read it, store it, tidy the URL and
 *     announce SIGNED_IN, the same way supabase-js does with `detectSessionInUrl`.
 *
 * Everything the browser provides (fetch, storage, location, history) can be passed in,
 * which is how the unit tests run it in Node.
 */

const SESSION_KEY = 'rgs.session';
// The server extends a token's life every time it is used (30 days). We mirror that
// locally so a player who keeps playing is not signed out by a stale expiry date.
const SESSION_LIFE_SECONDS = 30 * 24 * 60 * 60;

/** Build the error object the game reads (`error.message`, sometimes `error.code`). */
function makeError(message, code = 'unknown', status = 0) {
  const err = new Error(message || 'Request failed');
  err.name = 'RgsError';
  err.code = code;
  err.status = status;
  return err;
}

/**
 * Read `#access_token=…` / `#error=…` out of a URL hash.
 * Returns null when the hash is not a sign-in redirect.
 */
export function parseAuthHash(hash) {
  if (!hash || hash.length < 2) return null;
  const params = new URLSearchParams(hash.replace(/^#/, ''));
  if (params.get('error') || params.get('error_description')) {
    return {
      error: makeError(params.get('error_description') || params.get('error'), params.get('error') || 'auth_error'),
    };
  }
  const token = params.get('access_token');
  if (!token) return null;
  return {
    session: {
      access_token: token,
      token_type: params.get('token_type') || 'bearer',
      expires_at: Number(params.get('expires_at')) || Math.floor(Date.now() / 1000) + SESSION_LIFE_SECONDS,
      user: null, // filled in from GET /auth/user
    },
    type: params.get('type') || null,
  };
}

export function createRgsClient({
  baseUrl = '/api',
  game = 'emberveil',
  fetch: fetchImpl = (typeof fetch !== 'undefined' ? fetch.bind(globalThis) : null),
  storage = (typeof window !== 'undefined' ? window.localStorage : null),
  location = (typeof window !== 'undefined' ? window.location : null),
  history = (typeof window !== 'undefined' ? window.history : null),
} = {}) {
  const base = String(baseUrl).replace(/\/+$/, '');
  const listeners = new Set();
  let session = loadSession();

  // ---------- session storage ----------

  function loadSession() {
    try {
      const raw = storage?.getItem(SESSION_KEY);
      if (!raw) return null;
      const s = JSON.parse(raw);
      if (!s?.access_token) return null;
      if (s.expires_at && s.expires_at * 1000 < Date.now()) {
        storage?.removeItem(SESSION_KEY);
        return null;
      }
      return s;
    } catch (_) {
      return null;
    }
  }

  function saveSession(s) {
    session = s;
    try {
      if (s) storage?.setItem(SESSION_KEY, JSON.stringify(s));
      else storage?.removeItem(SESSION_KEY);
    } catch (_) { /* private mode / storage full — keep it in memory only */ }
  }

  /** The server extended the token's life when we used it; mirror that locally. */
  function touchSession() {
    if (!session) return;
    const extended = Math.floor(Date.now() / 1000) + SESSION_LIFE_SECONDS;
    if (!session.expires_at || session.expires_at < extended) saveSession({ ...session, expires_at: extended });
  }

  function emit(event) {
    for (const cb of [...listeners]) {
      try { cb(event, session); } catch (e) { console.error('[rgs] auth listener error:', e); }
    }
  }

  /** The server says our token is no good any more: forget it and tell the game. */
  function dropSession() {
    if (!session) return;
    saveSession(null);
    emit('SIGNED_OUT');
  }

  // ---------- HTTP ----------

  /** One request. Always resolves to { data, error, status }. */
  async function request(method, path, body, { auth = false } = {}) {
    if (!fetchImpl) return { data: null, error: makeError('No network available', 'network_error') };
    const headers = { Accept: 'application/json' };
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    if (auth && session?.access_token) headers.Authorization = `Bearer ${session.access_token}`;
    let res;
    try {
      res = await fetchImpl(base + path, {
        method,
        headers,
        body: body !== undefined ? JSON.stringify(body) : undefined,
      });
    } catch (e) {
      return { data: null, error: makeError(`Could not reach the game server: ${e?.message || e}`, 'network_error'), status: 0 };
    }
    let json = null;
    try { json = await res.json(); } catch (_) { /* empty or non-JSON body */ }
    if (!res.ok) {
      const e = json?.error || {};
      if (res.status === 401 && auth) dropSession();
      return { data: null, error: makeError(e.message || `HTTP ${res.status}`, e.code || `http_${res.status}`, res.status), status: res.status };
    }
    if (auth) touchSession();
    return { data: json, error: null, status: res.status };
  }

  // ---------- sign-in redirect (#access_token=…) ----------

  let hashError = null;
  let signedInFromHash = false;

  async function readHashOnLoad() {
    const parsed = location ? parseAuthHash(location.hash) : null;
    if (!parsed) return;
    // Tidy the address bar so the token is not left in history or bookmarks.
    try { history?.replaceState(history.state, '', location.pathname + location.search); } catch (_) {}
    if (parsed.error) { hashError = parsed.error; return; }
    saveSession(parsed.session);
    const { data, error } = await request('GET', '/auth/user', undefined, { auth: true });
    if (data?.user) {
      saveSession({ ...session, user: data.user });
      signedInFromHash = true;
    } else if (error && error.status !== 401) {
      // Server unreachable: keep the token, the user is fetched again on the next getUser().
      signedInFromHash = true;
    }
  }

  // Like supabase-js, every auth call waits for the URL check to finish first.
  const ready = readHashOnLoad().then(() => {
    if (signedInFromHash) emit('SIGNED_IN');
  });

  // ---------- auth ----------

  const auth = {
    async getSession() {
      await ready;
      if (hashError) {
        const error = hashError;
        hashError = null; // report it once
        return { data: { session }, error };
      }
      if (session?.expires_at && session.expires_at * 1000 < Date.now()) saveSession(null);
      return { data: { session }, error: null };
    },

    /** Asks the server who we are (like supabase-js, this is a network call). */
    async getUser() {
      await ready;
      if (!session) return { data: { user: null }, error: makeError('Auth session missing!', 'session_missing', 400) };
      const { data, error } = await request('GET', '/auth/user', undefined, { auth: true });
      if (error) return { data: { user: null }, error };
      const user = data?.user || null;
      if (user && session && JSON.stringify(user) !== JSON.stringify(session.user)) {
        const hadUser = !!session.user;
        saveSession({ ...session, user });
        if (hadUser) emit('USER_UPDATED');
      }
      return { data: { user }, error: null };
    },

    onAuthStateChange(cb) {
      listeners.add(cb);
      // supabase-js tells a new listener the current state straight away.
      ready.then(() => {
        if (listeners.has(cb)) {
          try { cb('INITIAL_SESSION', session); } catch (e) { console.error('[rgs] auth listener error:', e); }
        }
      });
      return { data: { subscription: { unsubscribe: () => listeners.delete(cb) } } };
    },

    async signUp({ email, password, options = {} } = {}) {
      await ready;
      const { data, error } = await request('POST', '/auth/signup', {
        email, password, redirect_to: options.emailRedirectTo || undefined,
      });
      if (error) return { data: { user: null, session: null }, error };
      // When the server cannot send email it confirms the account at once and signs us in.
      if (data?.session) { saveSession(data.session); emit('SIGNED_IN'); }
      return { data: { user: data?.user || null, session: data?.session || null }, error: null };
    },

    async signInWithPassword({ email, password } = {}) {
      await ready;
      const { data, error } = await request('POST', '/auth/token', { email, password });
      if (error) return { data: { user: null, session: null }, error };
      saveSession(data.session);
      emit('SIGNED_IN');
      return { data: { user: data.session?.user || null, session: data.session }, error: null };
    },

    /** Leaves the page: the server sends the player to Google and back with #access_token=…. */
    async signInWithOAuth({ provider, options = {} } = {}) {
      if (provider !== 'google') return { data: null, error: makeError(`Unsupported provider: ${provider}`, 'bad_provider') };
      const redirectTo = options.redirectTo || location?.href || '';
      const url = `${base}/auth/google?redirect_to=${encodeURIComponent(redirectTo)}`;
      try { location?.assign(url); } catch (e) { return { data: null, error: makeError(e?.message, 'redirect_failed') }; }
      return { data: { provider, url }, error: null };
    },

    /** Always signs out locally, even if the server cannot be reached. */
    async signOut() {
      await ready;
      if (session) await request('POST', '/auth/logout', {}, { auth: true });
      const had = !!session;
      saveSession(null);
      if (had) emit('SIGNED_OUT');
      return { error: null };
    },

    async resend({ email, options = {} } = {}) {
      const { error } = await request('POST', '/auth/resend', {
        email, redirect_to: options.emailRedirectTo || undefined,
      });
      return { data: error ? null : {}, error };
    },
  };

  // ---------- data: from(table)… ----------

  /**
   * Collects the chained calls into one body for POST /db/<game>, and sends it
   * when awaited. Same chaining order as supabase-js.
   */
  class Query {
    constructor(table) {
      this.body = { table, op: 'select', filters: [] };
    }
    select(columns = '*') {
      this.body.columns = columns;
      if (this.body.op !== 'select') this.body.returning = true; // a write followed by .select()
      return this;
    }
    insert(rows) { this.body.op = 'insert'; this.body.rows = Array.isArray(rows) ? rows : [rows]; return this; }
    upsert(rows, { onConflict } = {}) {
      this.body.op = 'upsert';
      this.body.rows = Array.isArray(rows) ? rows : [rows];
      if (onConflict) this.body.onConflict = onConflict;
      return this;
    }
    update(row) { this.body.op = 'update'; this.body.rows = row; return this; }
    delete() { this.body.op = 'delete'; return this; }
    eq(column, value) { this.body.filters.push([column, 'eq', value]); return this; }
    order(column, { ascending = true } = {}) { this.body.order = { column, ascending }; return this; }
    limit(n) { this.body.limit = n; return this; }
    single() { this.body.single = 'single'; return this; }
    maybeSingle() { this.body.single = 'maybeSingle'; return this; }

    async run() {
      await ready;
      if (!session) return { data: null, error: makeError('Not signed in', 'not_signed_in', 401) };
      const { data, error } = await request('POST', `/db/${encodeURIComponent(game)}`, this.body, { auth: true });
      if (error) return { data: null, error };
      // The server answers in supabase-js shape: { data, error } (row-level errors come back with HTTP 200).
      const rowError = data?.error ? makeError(data.error.message, data.error.code, 200) : null;
      return { data: rowError ? null : (data?.data ?? null), error: rowError };
    }

    then(resolve, reject) { return this.run().then(resolve, reject); }
  }

  return {
    auth,
    from: (table) => new Query(table),
    /** For tests: resolves once the URL check on load is done. */
    ready,
  };
}
