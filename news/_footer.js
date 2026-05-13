/*
 * RSG Game Hub — Shared Footer
 * ==========================================================================
 * Single source of truth for the site footer. Loaded by every page that
 * loads _header.js. release.sh copies this into <game>/public/assets/_footer.js
 * (and a sibling copy into news/, etc. via the same mechanism). Pages then
 * include `<script src="./_footer.js" defer></script>` (or "../assets/_footer.js"
 * from news/, game-info/, etc).
 *
 * This footer reads from window.RSG_SITE_MENUS, which is set by nav-header.js
 * (loaded first via defer). It renders all nav sections dynamically so the
 * footer stays in sync with the header automatically — no duplicate lists.
 *
 * Columns rendered: Game | Assets | Tools | Catalog | Docs | News | About
 * (Archived is intentionally omitted from footer — it lives in the header only.)
 */
(function () {
  // ---------------------------------------------------------------------------
  // Path derivation — mirrors nav-header.js logic so footer works standalone
  // (e.g. when header fails to load or for non-game pages).
  // ---------------------------------------------------------------------------
  var path = window.location.pathname;
  var gameKeyMatch = path.match(/\/(game[0-9a-z_]+)\//i);
  var GAME_LABEL_META = (document.querySelector('meta[name="rsg-game"]') || {}).content || 'Emberveil';
  var GAME_KEY_FB, GAME_ROOT_FB;
  if (gameKeyMatch) {
    GAME_KEY_FB = gameKeyMatch[1].toLowerCase();
    GAME_ROOT_FB = path.slice(0, path.indexOf('/' + gameKeyMatch[1] + '/') + gameKeyMatch[1].length + 2);
  } else {
    GAME_KEY_FB = 'game13';
    var inSub = /\/(assets|news|game-info)\//.test(path);
    GAME_ROOT_FB = inSub ? '../' : './';
  }

  // ---------------------------------------------------------------------------
  // Prefer the shared data set by nav-header.js; fall back to local derivation.
  // ---------------------------------------------------------------------------
  function getMenus() {
    if (window.RSG_SITE_MENUS) return window.RSG_SITE_MENUS;
    // Fallback: minimal stub so footer still renders something useful.
    var ASSETS_FB = GAME_ROOT_FB + 'assets/';
    return {
      GAME_KEY: GAME_KEY_FB,
      GAME_LABEL: GAME_LABEL_META,
      GAME_ROOT: GAME_ROOT_FB,
      ASSETS: ASSETS_FB,
      NEWS_ROOT: GAME_ROOT_FB + 'news/',
      NEWS_ARCHIVE: GAME_ROOT_FB + 'news.html',
      TOOLS: [],
      CATALOG: [],
      DOCS: [],
      ARCHIVED: [],
      NEWS: []
    };
  }

  // ---------------------------------------------------------------------------
  // Build footer columns from shared menu data.
  // ---------------------------------------------------------------------------
  function buildSections(m) {
    var GAME_ROOT = m.GAME_ROOT;
    var ASSETS = m.ASSETS;
    var NEWS_ARCHIVE = m.NEWS_ARCHIVE;

    // --- Game column (primary entry points + About items) ---
    var gameLinks = [
      { href: GAME_ROOT, label: 'Home' },
      { href: GAME_ROOT + 'play.html', label: 'Play' },
      { href: ASSETS + 'changelog.html', label: 'Changelog' },
      { href: NEWS_ARCHIVE, label: 'Latest News' },
      { href: GAME_ROOT + 'contact.html', label: 'Contact' },
      { href: GAME_ROOT + 'privacy.html', label: 'Privacy & Telemetry' },
      { href: GAME_ROOT + 'accessibility.html', label: 'Accessibility' }
    ];

    var sections = [
      { title: 'Game', links: gameLinks }
    ];

    // --- Assets column (mirrors header Assets dropdown) ---
    sections.push({
      title: 'Assets',
      links: [
        { href: ASSETS + 'images.html', label: 'Images' },
        { href: ASSETS + 'audio.html', label: 'Audio' },
        { href: ASSETS + 'milestones.html', label: 'Milestones' }
      ]
    });

    // --- Tools column (auto-mirrors header Tools dropdown) ---
    if (m.TOOLS && m.TOOLS.length) {
      sections.push({ title: 'Tools', links: m.TOOLS.slice() });
    }

    // --- Catalog column (auto-mirrors header Catalog dropdown) ---
    if (m.CATALOG && m.CATALOG.length) {
      sections.push({ title: 'Catalog', links: m.CATALOG.slice() });
    }

    // --- Docs column (auto-mirrors header Docs dropdown) ---
    if (m.DOCS && m.DOCS.length) {
      sections.push({ title: 'Docs', links: m.DOCS.slice() });
    }

    return sections;
  }

  function inject() {
    if (document.getElementById('rsg-shared-footer')) return;

    var m = getMenus();
    var sections = buildSections(m);
    if (!sections.length) return;

    var style = document.createElement('style');
    style.id = 'rsg-shared-footer-style';
    style.textContent =
      'footer.rsg-shared-footer{background:rgba(8,5,8,0.92);border-top:1px solid var(--rsg-border-hi,rgba(232,160,32,0.45));padding:2rem 1.5rem 1.5rem;margin-top:3rem;font-family:var(--rsg-font-ui,"Inter",system-ui,sans-serif);color:var(--rsg-muted,#8a7a6a)}' +
      'footer.rsg-shared-footer .ftr-inner{max-width:var(--rsg-container-max,1200px);margin:0 auto;display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:1.5rem 1.25rem}' +
      'footer.rsg-shared-footer .ftr-section h4{font-family:var(--rsg-font-display,"Cinzel",serif);color:var(--rsg-accent,#e8a020);font-size:0.78rem;letter-spacing:0.16em;text-transform:uppercase;margin:0 0 0.6rem;font-weight:700}' +
      'footer.rsg-shared-footer .ftr-section ul{list-style:none;margin:0;padding:0}' +
      'footer.rsg-shared-footer .ftr-section li{margin-bottom:0.3rem}' +
      'footer.rsg-shared-footer .ftr-section a{color:#bcb19e;text-decoration:none;font-size:0.82rem;transition:color 0.15s}' +
      'footer.rsg-shared-footer .ftr-section a:hover{color:var(--rsg-accent,#e8a020)}' +
      'footer.rsg-shared-footer .ftr-bottom{max-width:var(--rsg-container-max,1200px);margin:1.5rem auto 0;padding-top:1rem;border-top:1px solid rgba(232,160,32,0.12);font-size:0.7rem;text-align:center;letter-spacing:0.06em;color:#6e6457}' +
      '@media (max-width:600px){footer.rsg-shared-footer{padding:1.5rem 1rem 1rem}footer.rsg-shared-footer .ftr-inner{grid-template-columns:repeat(2,1fr);gap:1rem 1rem}}';
    document.head.appendChild(style);

    var footer = document.createElement('footer');
    footer.className = 'rsg-shared-footer';
    footer.id = 'rsg-shared-footer';
    var sectionsHtml = sections.map(function (s) {
      var liHtml = s.links.map(function (l) {
        return '<li><a href="' + l.href + '">' + l.label + '</a></li>';
      }).join('');
      return '<div class="ftr-section"><h4>' + s.title + '</h4><ul>' + liHtml + '</ul></div>';
    }).join('');
    footer.innerHTML =
      '<div class="ftr-inner">' + sectionsHtml + '</div>' +
      '<div class="ftr-bottom">' + m.GAME_LABEL + ' · in development · &copy; 2026 RSG</div>';
    document.body.appendChild(footer);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', inject);
  } else {
    inject();
  }
})();
