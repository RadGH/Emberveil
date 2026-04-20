// =============================================================================
// site-layout.js — Shared header + footer for every non-game web page in a game.
//
// Usage in any HTML page (index, branding, wishlist, docs, /assets/*.html):
//   <script src="/_layout.js" defer></script>           (root pages — recommended)
//   <script src="../_layout.js" defer></script>         (from public/assets/, public/docs/)
//
// `release.sh` syncs this file into <game>/public/_layout.js on every build.
// Edit THIS file to update the header/footer for every game at once.
//
// Looks for `public/branding.json` to read logo/colors/fonts. If absent, falls
// back to neutral defaults. Page label comes from <meta name="rsg-game"> or <title>.
// =============================================================================
(() => {
  if (window.__rsgLayoutInjected) return;
  window.__rsgLayoutInjected = true;

  const here = location.pathname.replace(/\/[^/]*$/, '/');
  // Game root = nearest ancestor that contains index.html. We approximate by
  // walking up until we find a path segment that looks like a game key
  // (matches /<gameKey>/ where the next segment is one of our well-known files).
  // Simpler: derive it from the script's own URL.
  const scriptEl = document.currentScript || [...document.scripts].find(s => /\b_layout\.js(\?|$)/.test(s.src));
  const scriptUrl = scriptEl ? new URL(scriptEl.src) : new URL(location.href);
  const root = scriptUrl.pathname.replace(/\/[^/]*$/, '/'); // dir containing _layout.js = game root

  const link = (p) => root + p.replace(/^\//, '');
  const meta = document.querySelector('meta[name="rsg-game"]');
  const gameLabel = (meta && meta.content) || document.title.split('—')[0].trim() || 'Game';

  // Pull branding tokens (synchronous default; async refine after fetch)
  const defaults = {
    logoText: gameLabel,
    accent: '#7aa2ff',
    accentBright: '#a8c4ff',
    bg: '#0a0a10',
    bgPanel: '#12121c',
    text: '#e6e8f2',
    muted: '#8088a0',
    border: 'rgba(122,162,255,0.25)',
    fontDisplay: '"Cinzel", Georgia, serif',
    fontUI: '"Inter", "Segoe UI", system-ui, sans-serif',
  };
  const tokens = { ...defaults };

  function applyTokens(t) {
    const r = document.documentElement.style;
    r.setProperty('--site-accent', t.accent);
    r.setProperty('--site-accent-bright', t.accentBright);
    r.setProperty('--site-bg', t.bg);
    r.setProperty('--site-bg-panel', t.bgPanel);
    r.setProperty('--site-text', t.text);
    r.setProperty('--site-muted', t.muted);
    r.setProperty('--site-border', t.border);
    r.setProperty('--site-font-display', t.fontDisplay);
    r.setProperty('--site-font-ui', t.fontUI);
  }

  function injectStyles() {
    if (document.getElementById('rsg-site-layout-css')) return;
    const css = `
      :root { color-scheme: dark; }
      body.rsg-layout { margin: 0; background: var(--site-bg); color: var(--site-text); font-family: var(--site-font-ui); min-height: 100vh; display: flex; flex-direction: column; }
      .rsg-header { position: sticky; top: 0; z-index: 100; background: rgba(10,10,16,0.92); backdrop-filter: blur(8px); border-bottom: 1px solid var(--site-border); }
      .rsg-header-inner { max-width: 1200px; margin: 0 auto; padding: 0.7rem 1rem; display: flex; align-items: center; gap: 1rem; }
      .rsg-logo { font-family: var(--site-font-display); font-weight: 900; letter-spacing: 0.08em; color: var(--site-accent-bright); text-decoration: none; font-size: 1.05rem; flex: 0 0 auto; }
      .rsg-logo:hover { color: var(--site-accent); }
      .rsg-nav { display: flex; gap: 0.25rem; flex: 1; flex-wrap: wrap; }
      .rsg-nav a { color: var(--site-text); text-decoration: none; padding: 0.45rem 0.8rem; border-radius: 6px; font-size: 0.92rem; transition: background 0.15s, color 0.15s; }
      .rsg-nav a:hover { background: rgba(255,255,255,0.05); color: var(--site-accent-bright); }
      .rsg-nav a.active { background: var(--site-accent); color: #0a0a10; font-weight: 600; }
      .rsg-play { background: var(--site-accent); color: #0a0a10 !important; padding: 0.45rem 1rem !important; border-radius: 6px; font-weight: 700; }
      .rsg-play:hover { background: var(--site-accent-bright); transform: translateY(-1px); }
      .rsg-main { flex: 1; max-width: 1200px; width: 100%; margin: 0 auto; padding: 1.4rem 1rem 2rem; }
      .rsg-footer { border-top: 1px solid var(--site-border); padding: 1rem; text-align: center; font-size: 0.8rem; color: var(--site-muted); background: var(--site-bg-panel); }
      .rsg-footer a { color: var(--site-muted); text-decoration: none; margin: 0 0.5rem; }
      .rsg-footer a:hover { color: var(--site-accent-bright); }
      @media (max-width: 600px) {
        .rsg-header-inner { flex-direction: column; align-items: flex-start; gap: 0.5rem; padding: 0.6rem 0.8rem; }
        .rsg-nav { width: 100%; justify-content: flex-start; overflow-x: auto; flex-wrap: nowrap; }
        .rsg-nav a { white-space: nowrap; padding: 0.4rem 0.65rem; font-size: 0.85rem; }
      }
    `;
    const style = document.createElement('style');
    style.id = 'rsg-site-layout-css';
    style.textContent = css;
    document.head.appendChild(style);
  }

  function buildHeader() {
    const here = location.pathname.split('/').pop() || 'index.html';
    const items = [
      { href: 'game.html', label: 'Play', cls: 'rsg-play' },
      { href: 'branding.html', label: 'Branding' },
      { href: 'docs.html', label: 'Docs' },
      { href: 'wishlist.html', label: 'Wishlist' },
      { href: 'assets/', label: 'Assets' },
    ];
    const nav = items.map(it => {
      const active = (here === it.href || (it.href === 'index.html' && here === '')) ? ' active' : '';
      return `<a href="${link(it.href)}" class="${(it.cls || '') + active}">${it.label}</a>`;
    }).join('');
    const html = `
      <header class="rsg-header">
        <div class="rsg-header-inner">
          <a class="rsg-logo" href="${link('index.html')}">${tokens.logoText}</a>
          <nav class="rsg-nav">${nav}</nav>
        </div>
      </header>
    `;
    return html;
  }

  function buildFooter() {
    return `
      <footer class="rsg-footer">
        <span>${tokens.logoText}</span> ·
        <a href="${link('branding.html')}">Branding</a>
        <a href="${link('docs.html')}">Docs</a>
        <a href="${link('wishlist.html')}">Wishlist</a>
      </footer>
    `;
  }

  function mount() {
    injectStyles();
    document.body.classList.add('rsg-layout');
    // Wrap existing children in <main class="rsg-main"> so they sit between header/footer.
    const existing = [...document.body.childNodes];
    const main = document.createElement('main');
    main.className = 'rsg-main';
    existing.forEach(n => main.appendChild(n));
    const headerWrap = document.createElement('div');
    headerWrap.innerHTML = buildHeader();
    const footerWrap = document.createElement('div');
    footerWrap.innerHTML = buildFooter();
    document.body.appendChild(headerWrap.firstElementChild);
    document.body.appendChild(main);
    document.body.appendChild(footerWrap.firstElementChild);
  }

  // Try to load branding.json for token overrides; mount regardless.
  applyTokens(tokens);
  fetch(link('branding.json'))
    .then(r => r.ok ? r.json() : null)
    .then(b => {
      if (!b) return;
      Object.assign(tokens, b);
      applyTokens(tokens);
      // If header already mounted, refresh logo text + footer label
      const logo = document.querySelector('.rsg-logo');
      if (logo && b.logoText) logo.textContent = b.logoText;
    })
    .catch(() => {});

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mount);
  } else {
    mount();
  }
})();
