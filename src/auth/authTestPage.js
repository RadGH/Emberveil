import { supabase, supabaseConfigured } from './supabaseClient.js';
import { savesClient, SavesClientError } from './savesClient.js';

const $ = (id) => document.getElementById(id);
const logEl = $('log');
const sessionJsonEl = $('sessionJson');
const sessionStatusEl = $('sessionStatus');
const configEl = $('configStatus');

const logLines = [];
function log(msg, data) {
  const stamp = new Date().toISOString().slice(11, 19);
  const line = data !== undefined ? `[${stamp}] ${msg} ${JSON.stringify(data)}` : `[${stamp}] ${msg}`;
  logLines.unshift(line);
  if (logLines.length > 40) logLines.length = 40;
  logEl.textContent = logLines.join('\n');
}

function setStatus(el, text, kind) {
  el.textContent = text;
  el.className = kind ? `status ${kind}` : 'muted';
}

function renderSession(session) {
  if (!session) {
    sessionStatusEl.textContent = 'Signed out.';
    sessionJsonEl.textContent = '(none)';
    return;
  }
  sessionStatusEl.textContent = `Signed in as ${session.user.email || session.user.id} (provider: ${session.user.app_metadata?.provider || 'unknown'})`;
  sessionJsonEl.textContent = JSON.stringify({
    user: {
      id: session.user.id,
      email: session.user.email,
      email_confirmed_at: session.user.email_confirmed_at,
      provider: session.user.app_metadata?.provider,
      providers: session.user.app_metadata?.providers,
      created_at: session.user.created_at,
    },
    expires_at: session.expires_at,
    token_type: session.token_type,
  }, null, 2);
}

if (!supabaseConfigured) {
  setStatus(configEl, 'Supabase not configured — missing keys at build time. Check assets/references/emberveil/supabase-*.txt and rebuild.', 'err');
  log('config missing — client not initialized');
} else {
  setStatus(configEl, 'Supabase client initialized.', 'ok');
  log('config loaded');

  supabase.auth.getSession().then(({ data, error }) => {
    if (error) log('getSession error', { error: error.message });
    else renderSession(data.session);
  });

  supabase.auth.onAuthStateChange((event, session) => {
    log(`auth event: ${event}`, session ? { user: session.user.email || session.user.id } : null);
    renderSession(session);
  });

  $('btnRefresh').onclick = async () => {
    const { data, error } = await supabase.auth.getSession();
    if (error) log('refresh error', { error: error.message });
    else { renderSession(data.session); log('session refreshed'); }
  };

  $('btnSignOut').onclick = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) log('signOut error', { error: error.message });
    else log('signed out');
  };

  $('btnSignUp').onclick = async () => {
    const email = $('email').value.trim();
    const password = $('password').value;
    const statusEl = $('emailStatus');
    if (!email || !password) { setStatus(statusEl, 'Enter email and password first.'); return; }
    setStatus(statusEl, 'Signing up…');
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: `${window.location.origin}${window.location.pathname}` },
    });
    if (error) { setStatus(statusEl, `Error: ${error.message}`); log('signUp error', { error: error.message }); return; }
    if (data.user && !data.session) {
      setStatus(statusEl, `Check your inbox (${email}) — confirmation email sent.`);
      log('signUp: confirmation email sent', { email });
    } else {
      setStatus(statusEl, 'Signed up and logged in.');
      log('signUp: immediate session', { email });
    }
  };

  $('btnSignIn').onclick = async () => {
    const email = $('email').value.trim();
    const password = $('password').value;
    const statusEl = $('emailStatus');
    if (!email || !password) { setStatus(statusEl, 'Enter email and password first.'); return; }
    setStatus(statusEl, 'Signing in…');
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) { setStatus(statusEl, `Error: ${error.message}`); log('signIn error', { error: error.message }); return; }
    setStatus(statusEl, 'Signed in.');
    log('signIn ok', { email });
  };

  $('btnResend').onclick = async () => {
    const email = $('email').value.trim();
    const statusEl = $('emailStatus');
    if (!email) { setStatus(statusEl, 'Enter email first.'); return; }
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email,
      options: { emailRedirectTo: `${window.location.origin}${window.location.pathname}` },
    });
    if (error) { setStatus(statusEl, `Error: ${error.message}`); log('resend error', { error: error.message }); return; }
    setStatus(statusEl, `Resent — check ${email}.`);
    log('resend ok', { email });
  };

  $('btnGoogle').onclick = async () => {
    const statusEl = $('googleStatus');
    setStatus(statusEl, 'Redirecting to Google…');
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}${window.location.pathname}`,
      },
    });
    if (error) { setStatus(statusEl, `Error: ${error.message}`); log('google error', { error: error.message }); }
  };

  $('btnClearLog').onclick = () => { logLines.length = 0; logEl.textContent = '(no events yet)'; };

  // ---------- Phase 2: Saves CRUD ----------
  const savesStatus = $('savesStatus');
  const savesOutput = $('savesOutput');

  function parseStateInput(raw) {
    const trimmed = (raw || '').trim();
    if (!trimmed) return { level: 1, hp: 10, at: new Date().toISOString() };
    try { return JSON.parse(trimmed); }
    catch (e) { throw new Error(`Invalid JSON: ${e.message}`); }
  }

  async function runSaves(label, fn) {
    setStatus(savesStatus, `${label}…`);
    try {
      const result = await fn();
      setStatus(savesStatus, `${label} ok`);
      savesOutput.textContent = result === undefined ? '(done)' : JSON.stringify(result, null, 2);
      log(`saves: ${label} ok`);
    } catch (err) {
      const msg = err instanceof SavesClientError ? err.message : (err.message || String(err));
      setStatus(savesStatus, `${label} error: ${msg}`);
      savesOutput.textContent = `ERROR: ${msg}`;
      log(`saves: ${label} error`, { error: msg });
    }
  }

  $('btnSaveWrite').onclick = () => {
    const slot = $('slotName').value.trim();
    if (!slot) { setStatus(savesStatus, 'Enter a slot name first.'); return; }
    let state;
    try { state = parseStateInput($('slotState').value); }
    catch (e) { setStatus(savesStatus, e.message); return; }
    runSaves('write', () => savesClient.write(slot, state));
  };

  $('btnSaveRead').onclick = () => {
    const slot = $('slotName').value.trim();
    if (!slot) { setStatus(savesStatus, 'Enter a slot name first.'); return; }
    runSaves('read', () => savesClient.read(slot));
  };

  $('btnSaveList').onclick = () => runSaves('list', () => savesClient.list());

  $('btnSaveDelete').onclick = () => {
    const slot = $('slotName').value.trim();
    if (!slot) { setStatus(savesStatus, 'Enter a slot name first.'); return; }
    if (!confirm(`Delete slot "${slot}"?`)) return;
    runSaves('delete', () => savesClient.remove(slot));
  };

  $('btnSaveDeleteAll').onclick = () => {
    if (!confirm('Delete ALL of your saves? (RLS still prevents touching other users.)')) return;
    runSaves('deleteAll', () => savesClient.removeAll());
  };
}
