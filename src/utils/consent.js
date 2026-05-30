/**
 * consent.js — M330 cross-property GDPR consent + Google Analytics gating.
 *
 * Stores consent in `localStorage.rsg_consent_v1` so it carries over between
 * any pages served from the same origin (game13 + RSG-Demos hub both live on
 * radgh.github.io). Emberveil's vanity domain (emberveil.radgh.com) is a
 * different origin and would need its own consent prompt — deliberately not
 * cross-shared because GDPR consent is per-controller.
 *
 * Until the user picks Accept or Reject, no analytics scripts load and no
 * events fire. Picking Reject also blocks future loads. Picking Accept boots
 * gtag and exposes pushEvent(name, props).
 *
 * Public API:
 *   - showConsentBannerIfNeeded(opts)  — render banner when consent unknown
 *   - getConsent() → 'granted' | 'denied' | null
 *   - setConsent(state)
 *   - pushEvent(name, props)            — no-op when not granted
 *   - isAnalyticsEnabled()
 *
 * GA setup: pass the measurement id (e.g. 'G-XXXXXXX') via opts.gaId.
 */

const KEY = 'rsg_consent_v1';
const DEFAULT_GA_ID = (typeof window !== 'undefined' && window.__RSG_GA_ID) || null;

let _gaId = DEFAULT_GA_ID;
let _gaLoaded = false;
let _bannerEl = null;
let _onChangeListeners = [];

export function getConsent() {
  try { return localStorage.getItem(KEY); } catch (_) { return null; }
}

export function isAnalyticsEnabled() {
  return getConsent() === 'granted';
}

export function setConsent(state) {
  if (state !== 'granted' && state !== 'denied') return;
  try { localStorage.setItem(KEY, state); } catch (_) {}
  if (state === 'granted') _ensureGaLoaded();
  // Mirror to a cookie for cross-subdomain reads (if you later add
  // emberveil.radgh.com you'd still want the user to opt in there too —
  // GDPR consent is per-controller — but a cookie helps soft-default the
  // banner state).
  try {
    document.cookie = `${KEY}=${state}; path=/; max-age=31536000; samesite=lax`;
  } catch (_) {}
  for (const cb of _onChangeListeners) {
    try { cb(state); } catch (_) {}
  }
}

export function onConsentChange(cb) {
  _onChangeListeners.push(cb);
  return () => {
    _onChangeListeners = _onChangeListeners.filter(c => c !== cb);
  };
}

function _ensureGaLoaded() {
  if (_gaLoaded || !_gaId) return;
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  // Only load when consent granted.
  if (getConsent() !== 'granted') return;
  _gaLoaded = true;
  // Standard GA4 snippet, deferred so it never blocks first paint.
  const s = document.createElement('script');
  s.async = true;
  s.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(_gaId)}`;
  document.head.appendChild(s);
  window.dataLayer = window.dataLayer || [];
  function gtag(){ window.dataLayer.push(arguments); }
  window.gtag = gtag;
  gtag('js', new Date());
  gtag('config', _gaId, { anonymize_ip: true });
}

/**
 * Push a custom event. Two destinations:
 *   1. Google Analytics 4 — only when consent is granted (legal gate).
 *   2. Supabase telemetry_events — only when consent is granted AND
 *      the optional table exists. Fire-and-forget; failures swallowed.
 *
 * Silent no-op when consent isn't granted; user-facing analytics never
 * happen without consent.
 */
export function pushEvent(name, props = {}) {
  if (!isAnalyticsEnabled()) return;
  _ensureGaLoaded();
  try {
    if (typeof window !== 'undefined' && typeof window.gtag === 'function') {
      window.gtag('event', name, props || {});
    }
  } catch (_) {}
  // M333 — first-party Supabase mirror. Lazy import so consent.js stays
  // dependency-free for the demos hub (the hub only uses the inline
  // banner; no Supabase).
  try {
    import('../auth/telemetryEventsClient.js').then(({ recordEvent }) => {
      try { recordEvent(name, props || {}); } catch (_) {}
    }).catch(() => {});
  } catch (_) {}
}

/**
 * Render the consent banner if the user hasn't decided yet.
 * @param {object} opts
 * @param {string} opts.gaId           — GA4 measurement id, eg 'G-XXXXXXX'
 * @param {string} [opts.privacyHref]  — href to a privacy policy page
 * @param {boolean} [opts.force]       — show even if a decision exists
 */
export function showConsentBannerIfNeeded(opts = {}) {
  if (typeof document === 'undefined') return;
  if (opts.gaId) _gaId = opts.gaId;
  // If already decided and not forced, just (maybe) load GA and bail.
  const state = getConsent();
  if (state && !opts.force) {
    if (state === 'granted') _ensureGaLoaded();
    return;
  }
  if (_bannerEl) return; // already showing
  const privacyHref = opts.privacyHref || 'privacy.html';
  const bg = '#0a0608';
  const fg = '#f0e8d8';
  const accent = '#e8a020';
  const el = document.createElement('div');
  el.id = 'rsg-consent-banner';
  el.setAttribute('role', 'dialog');
  el.setAttribute('aria-label', 'Cookie consent');
  el.style.cssText = `
    position:fixed; left:0; right:0; bottom:0; z-index:99000;
    background:${bg}; color:${fg};
    border-top:1px solid rgba(232,160,32,0.4);
    box-shadow:0 -4px 20px rgba(0,0,0,0.6);
    font-family:'Inter',system-ui,sans-serif; font-size:0.78rem; line-height:1.4;
    padding:0.9rem 1rem calc(0.9rem + env(safe-area-inset-bottom,0px));
  `;
  el.innerHTML = `
    <div style="max-width:760px;margin:0 auto;display:flex;flex-wrap:wrap;align-items:center;gap:0.85rem">
      <div style="flex:1 1 240px;min-width:200px">
        <strong style="color:${accent};font-family:'Cinzel',serif;letter-spacing:0.05em">Cookies &amp; analytics</strong><br>
        We use Google Analytics to understand how the demo is used. No personal data is sold.
        <a href="${privacyHref}" style="color:${accent};text-decoration:underline">Privacy policy</a>.
      </div>
      <div style="display:flex;gap:0.45rem;flex-wrap:wrap">
        <button type="button" id="rsg-consent-deny"
          style="min-height:40px;padding:0.5rem 0.9rem;background:transparent;border:1px solid rgba(232,160,32,0.4);color:#c8b89c;border-radius:4px;font:inherit;font-size:0.78rem;cursor:pointer">
          Reject
        </button>
        <button type="button" id="rsg-consent-accept"
          style="min-height:40px;padding:0.5rem 1rem;background:${accent};border:1px solid ${accent};color:#1a0a04;border-radius:4px;font:inherit;font-size:0.78rem;font-weight:700;cursor:pointer">
          Accept analytics
        </button>
      </div>
    </div>
  `;
  document.body.appendChild(el);
  _bannerEl = el;
  el.querySelector('#rsg-consent-accept').addEventListener('click', () => {
    setConsent('granted');
    el.remove();
    _bannerEl = null;
  });
  el.querySelector('#rsg-consent-deny').addEventListener('click', () => {
    setConsent('denied');
    el.remove();
    _bannerEl = null;
  });
}

/** Re-open the banner so the user can change their mind (settings link). */
export function reopenConsentBanner(opts = {}) {
  showConsentBannerIfNeeded({ ...opts, force: true });
}
