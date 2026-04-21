/*
 * RSG Game Hub — Shared Navigation Header
 * ============================================================================
 * SINGLE SOURCE OF TRUTH. Edit this file, then re-run `./release.sh <game>` (or
 * `./deploy_pages.sh`) and every game picks up the change. Do NOT edit the
 * per-game copy at public/assets/_header.js — it is overwritten on every build
 * by release.sh.
 *
 * How it works:
 *   - Each game's public/assets/*.html and public/game-info/*.html loads this
 *     via `<script src="./_header.js" defer></script>` (or "../assets/_header.js"
 *     from game-info/).
 *   - The script injects a fixed top nav + padding class onto <body>.
 *   - Links use relative paths so they work identically in dev, on the local
 *     release server, and on GitHub Pages sub-paths.
 *
 * Menu: Play Game | Assets (Images / Audio / Reports) | Game Info
 */
(function () {
  var SCRIPT = document.currentScript;
  var GAME_LABEL =
    (SCRIPT && SCRIPT.dataset.game) ||
    (document.querySelector('meta[name="rsg-game"]') || {}).content ||
    document.title.split(/[—|-]/)[0].trim() ||
    'RSG GAME HUB';

  // ---------------------------------------------------------------------------
  // GAME ROOT DERIVATION — READ BEFORE EDITING
  // ---------------------------------------------------------------------------
  // Failure mode (has bitten TWICE — M79 News restructure, then again):
  //   Previous logic used a relative GAME_ROOT ("./" or "../") based on whether
  //   the URL contained "/assets/" or "/game-info/". This broke for any page
  //   under "/news/" (or any new subdirectory) because GAME_ROOT defaulted to
  //   "./", so clicking "Assets" from /game13/news/foo.html resolved to
  //   /game13/news/assets/ (404) — the /news/ segment got doubled into every
  //   subsequent menu href.
  //
  // Fix: anchor GAME_ROOT to an ABSOLUTE path derived from the /<gameKey>/
  //   segment in location.pathname. Every menu link then becomes
  //   "/<gameKey>/<target>" regardless of how deep the current page is, so no
  //   double-prefixing is possible for ANY subdirectory, present or future.
  //
  // If the path does not contain /<gameKey>/ (e.g. loaded from a bare file://
  // preview), fall back to the old relative heuristic as a last resort.
  // ---------------------------------------------------------------------------
  var path = window.location.pathname;
  var gameKeyMatch = path.match(/\/(game[0-9a-z_]+)\//i);
  // Fallback: map rsg-game meta → game key so bare-domain hosts (e.g. emberveil.radgh.com)
  // still populate Tools/News dropdowns.
  var LABEL_TO_KEY = { 'emberveil': 'game13' };
  var metaKey = LABEL_TO_KEY[String(GAME_LABEL).toLowerCase()] || '';
  var GAME_KEY = gameKeyMatch ? gameKeyMatch[1].toLowerCase() : metaKey;
  var GAME_ROOT;
  if (gameKeyMatch) {
    // Absolute anchor: everything up to and including /<gameKey>/
    GAME_ROOT = path.slice(0, path.indexOf('/' + gameKeyMatch[1] + '/') + gameKeyMatch[1].length + 2);
  } else {
    var inAssetsFb = /\/assets\//.test(path);
    var inGameInfoFb = /\/game-info\//.test(path);
    var inNewsFb = /\/news\//.test(path);
    GAME_ROOT = (inAssetsFb || inGameInfoFb || inNewsFb) ? '../' : './';
  }
  var ASSETS = GAME_ROOT + 'assets/';
  var GAME_INFO = GAME_ROOT + 'game-info/';

  // Per-game tool lists. Keyed by the game key derived from the URL path
  // (/gameNN/...). Keep hardcoded for now; generalize later.
  var TOOLS_BY_GAME = {
    game13: [
      { href: ASSETS + 'affix-survey.html', label: 'Affix Survey' },
      { href: ASSETS + 'enemy-audit.html', label: 'Enemy Audit' },
      { href: ASSETS + 'skill-audit.html', label: 'Skill Audit' },
      { href: ASSETS + 'redesign-survey.html', label: 'Redesign Survey' },
      { href: ASSETS + 'image-review.html', label: 'Image Review' },
      { href: ASSETS + 'custom-content.html', label: 'Custom Content' },
      { href: ASSETS + 'ai-content-gen.html', label: 'AI Content Generator' },
      { href: ASSETS + 'spell-catalog.html', label: 'Spell Catalog' },
      { href: ASSETS + 'enemy-catalog.html', label: 'Enemy Catalog' },
      { href: ASSETS + 'item-catalog.html', label: 'Item Catalog' },
      { href: ASSETS + 'docs.html', label: 'Documentation' },
      { href: ASSETS + 'wishlist.html', label: 'Wishlist' },
      { separator: true, label: 'Archived' },
      { href: ASSETS + 'sprite-flip-review.html', label: 'Sprite Flip Review' },
      { href: ASSETS + 'rebalance.html', label: 'Rebalance' }
    ]
  };
  // News registry — populated by the migration pass. Sorted newest first.
  var NEWS_ROOT = GAME_ROOT + 'news/';
  var NEWS_BY_GAME = {
    game8: [
      { href: NEWS_ROOT + 'report-5.html', label: 'Milestone Report 5', date: '2025-06-01' },
      { href: NEWS_ROOT + 'report-4.html', label: 'Milestone Report 4', date: '2025-05-01' },
      { href: NEWS_ROOT + 'report-3.html', label: 'Milestone Report 3', date: '2025-04-01' },
      { href: NEWS_ROOT + 'report-2.html', label: 'Milestone Report 2', date: '2025-03-01' },
      { href: NEWS_ROOT + 'report-1.html', label: 'Milestone Report 1', date: '2025-02-01' }
    ],
    game11: [
      { href: NEWS_ROOT + 'post-m25.html',    label: 'Post-M25 Report',        date: '2025-10-15' },
      { href: NEWS_ROOT + 'pre-m21.html',     label: 'Pre-M21 Planning',       date: '2025-09-20' },
      { href: NEWS_ROOT + 'final-m20.html',   label: 'M20 Final Report',       date: '2025-09-15' },
      { href: NEWS_ROOT + 'pre-m12.html',     label: 'Pre-M12 Planning',       date: '2025-08-05' },
      { href: NEWS_ROOT + 'post-m11.html',    label: 'Post-M11 Report',        date: '2025-08-01' },
      { href: NEWS_ROOT + 'pre-m7.html',      label: 'Pre-M7 Planning',        date: '2025-07-05' },
      { href: NEWS_ROOT + 'post-m6.html',     label: 'Post-M6 Report',         date: '2025-07-01' },
      { href: NEWS_ROOT + 'pre-m2.html',      label: 'Pre-M2 Planning',        date: '2025-06-10' },
      { href: NEWS_ROOT + 'pre-creation.html',label: 'Pre-Creation Brainstorm',date: '2025-06-01' }
    ],
    game12: [
      { href: NEWS_ROOT + 'pre-release.html', label: 'Pre-Release Report',  date: '2026-02-15' },
      { href: NEWS_ROOT + 'm25.html',         label: 'Milestone 25 Report', date: '2026-02-01' },
      { href: NEWS_ROOT + 'm20.html',         label: 'Milestone 20 Report', date: '2026-01-01' },
      { href: NEWS_ROOT + 'm15.html',         label: 'Milestone 15 Report', date: '2025-12-01' },
      { href: NEWS_ROOT + 'm10.html',         label: 'Milestone 10 Report', date: '2025-11-01' },
      { href: NEWS_ROOT + 'm5.html',          label: 'Milestone 5 Report',  date: '2025-10-01' }
    ],
    game13: [
      { href: NEWS_ROOT + 'milestone-report.html',   label: 'Major Milestone Report',date: '2026-04-15' },
      { href: NEWS_ROOT + 're-redesign.html',        label: 'Re-redesign — SpriteCook', date: '2026-04-14' },
      { href: NEWS_ROOT + 'm79-redesign.html',       label: 'M79 Redesign Report',   date: '2026-04-14' },
      { href: NEWS_ROOT + 'balance-report.html',     label: 'Balance Report',        date: '2026-04-14' },
      { href: NEWS_ROOT + 'tap-weapons.html',        label: 'Tap Weapons Design',    date: '2026-04-13' },
      { href: NEWS_ROOT + 'simulation-overhaul.html',label: 'Simulation Overhaul',   date: '2026-04-13' },
      { href: NEWS_ROOT + 'dragon-expansion.html',   label: 'Dragon Expansion',      date: '2026-04-13' },
      { href: NEWS_ROOT + 'milestone-53.html',       label: 'Milestone 53 Report',   date: '2026-04-11' },
      { href: NEWS_ROOT + 'pre-game.html',           label: 'Pre-Game Brainstorm',   date: '2026-04-10' }
    ]
  };
  var TOOLS = TOOLS_BY_GAME[GAME_KEY] || [];
  var NEWS = NEWS_BY_GAME[GAME_KEY] || [];

  // Order: Play Game / Game Info / Assets / Tools / News / Send Feedback / Contact
  var PLAY_HREF = GAME_ROOT + 'play.html';
  var assetsItem = {
    href: ASSETS,
    label: 'Assets',
    children: [
      { href: ASSETS + '#main', label: 'Images' },
      { href: ASSETS + '#audio-section', label: 'Audio' },
      { href: ASSETS + '#reports-section', label: 'Milestones' }
    ]
  };
  var toolsItem = TOOLS.length ? {
    href: TOOLS[0].href,
    label: 'Tools',
    children: TOOLS.slice()
  } : null;
  var newsItem = NEWS.length ? (function () {
    var children = NEWS.map(function (n) {
      var d = n.date || '2026-04-14';
      return { href: n.href, label: d + ' \u2014 ' + n.label };
    });
    return { href: children[0].href, label: 'News', children: children };
  })() : null;
  var MENU = [
    { href: PLAY_HREF, label: 'Play Game', primary: true },
    { href: GAME_INFO, label: 'Game Info' },
    assetsItem
  ];
  if (toolsItem) MENU.push(toolsItem);
  if (newsItem) MENU.push(newsItem);
  MENU.push({ href: 'https://docs.google.com/forms/d/e/1FAIpQLScWHFEQ8Kbxvsxg5nKerJOPqkYntAkRLCihqQchypNdqayvmA/viewform?usp=publish-editor', label: 'Send Feedback', external: true });
  MENU.push({ href: GAME_ROOT + 'contact.html', label: 'Contact' });

  function buildNav() {
    var nav = document.createElement('nav');
    nav.className = 'rsg-shared-nav';
    var links = MENU.map(function (m) {
      if (m.children) {
        var sub = m.children.map(function (c) {
          if (c.separator) {
            return '<li class="sub-sep"><span>' + c.label + '</span></li>';
          }
          return '<li><a href="' + c.href + '">' + c.label + '</a></li>';
        }).join('');
        return '<li class="has-sub"><a href="' + m.href + '">' + m.label + ' \u25BE</a><ul class="sub-menu">' + sub + '</ul></li>';
      }
      var attrs = m.external ? ' target="_blank" rel="noopener"' : '';
      var cls = m.primary ? ' class="nav-btn"' : '';
      return '<li><a href="' + m.href + '"' + attrs + cls + '>' + m.label + '</a></li>';
    }).join('');
    nav.innerHTML =
      '<div class="nav-inner">' +
        '<a class="nav-logo" href="' + GAME_ROOT + '">&#x2726; ' + GAME_LABEL + '</a>' +
        '<button class="nav-burger" type="button" aria-label="Toggle menu" aria-expanded="false">' +
          '<span></span><span></span><span></span>' +
        '</button>' +
        '<ul class="nav-links">' + links + '</ul>' +
      '</div>';
    return nav;
  }

  function injectStyle() {
    if (document.getElementById('rsg-shared-nav-style')) return;
    var css =
      '@import url("https://fonts.googleapis.com/css2?family=Cinzel:wght@400;700;900&family=Inter:wght@300;400;500;600&display=swap");' +
      'nav.rsg-shared-nav{position:fixed;top:0;left:0;right:0;z-index:1000;background:rgba(10,6,8,0.92);backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);border-bottom:1px solid rgba(232,160,32,0.2);height:52px;display:flex;align-items:center;padding:0 2rem;font-family:"Inter","Segoe UI",sans-serif}' +
      'nav.rsg-shared-nav .nav-inner{display:flex;align-items:center;gap:1.25rem;width:100%;max-width:840px;margin:0 auto;min-width:0}' +
      'nav.rsg-shared-nav .nav-logo{font-family:"Cinzel",Georgia,serif;font-size:1rem;font-weight:900;letter-spacing:0.15em;background:linear-gradient(180deg,#f8d880 0%,#e8a020 40%,#c04030 100%);-webkit-background-clip:text;background-clip:text;color:transparent;flex-shrink:0;text-decoration:none;text-transform:uppercase}' +
      'nav.rsg-shared-nav .nav-links{display:flex;align-items:center;gap:1.25rem;list-style:none;margin:0;padding:0;flex-wrap:nowrap;min-width:0}' +
      'nav.rsg-shared-nav .nav-burger{display:none;background:transparent;border:1px solid rgba(232,160,32,0.35);border-radius:4px;width:36px;height:32px;padding:0;cursor:pointer;flex-direction:column;align-items:center;justify-content:center;gap:4px;flex-shrink:0}' +
      'nav.rsg-shared-nav .nav-burger span{display:block;width:18px;height:2px;background:#e8a020;border-radius:1px;transition:transform .2s, opacity .2s}' +
      'nav.rsg-shared-nav .nav-burger[aria-expanded="true"] span:nth-child(1){transform:translateY(6px) rotate(45deg)}' +
      'nav.rsg-shared-nav .nav-burger[aria-expanded="true"] span:nth-child(2){opacity:0}' +
      'nav.rsg-shared-nav .nav-burger[aria-expanded="true"] span:nth-child(3){transform:translateY(-6px) rotate(-45deg)}' +
      'nav.rsg-shared-nav .nav-links > li{position:relative}' +
      'nav.rsg-shared-nav .nav-links a{color:#8a7a6a;text-decoration:none;font-size:0.72rem;font-weight:600;letter-spacing:0.1em;text-transform:uppercase;transition:color 0.2s;white-space:nowrap;display:block}' +
      'nav.rsg-shared-nav .nav-links a:hover{color:#e8a020}' +
      'nav.rsg-shared-nav .nav-links a.nav-btn{color:#ffd078;background:linear-gradient(135deg,#c04030 0%,#8a1a0a 100%);padding:0.35rem 0.9rem;border-radius:4px;border:1px solid rgba(192,64,48,0.55);font-weight:700;letter-spacing:0.08em}' +
      'nav.rsg-shared-nav .nav-links a.nav-btn:hover{background:linear-gradient(135deg,#d05040,#c04030);color:#fff}' +
      'nav.rsg-shared-nav .has-sub{padding-bottom:0.6rem;margin-bottom:-0.6rem}' +
      'nav.rsg-shared-nav .sub-menu{display:none;position:absolute;top:100%;left:0;background:rgba(10,6,8,0.98);border:1px solid rgba(232,160,32,0.25);border-radius:6px;padding:0.4rem 0;list-style:none;margin:0;min-width:140px;box-shadow:0 8px 24px rgba(0,0,0,0.5)}' +
      'nav.rsg-shared-nav .has-sub:hover .sub-menu,nav.rsg-shared-nav .has-sub:focus-within .sub-menu,nav.rsg-shared-nav .has-sub.open .sub-menu{display:block}' +
      'nav.rsg-shared-nav .sub-menu a{padding:0.4rem 0.9rem;font-size:0.7rem}' +
      'nav.rsg-shared-nav .sub-menu .sub-sep{padding:0.45rem 0.9rem 0.2rem;margin-top:0.25rem;border-top:1px solid rgba(232,160,32,0.2)}' +
      'nav.rsg-shared-nav .sub-menu .sub-sep span{color:#e8a020;font-size:0.62rem;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;opacity:0.8}' +
      'body.rsg-nav-padded{padding-top:52px}' +
      '@media (max-width:720px){' +
        'nav.rsg-shared-nav{height:52px;padding:0 0.75rem}' +
        'nav.rsg-shared-nav .nav-inner{flex-direction:row;align-items:center;justify-content:space-between;gap:0.5rem}' +
        'nav.rsg-shared-nav .nav-logo{text-align:left;font-size:0.95rem;flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}' +
        'nav.rsg-shared-nav .nav-burger{display:flex}' +
        'nav.rsg-shared-nav .nav-links{display:none;position:absolute;top:52px;left:0;right:0;flex-direction:column;align-items:stretch;gap:0;background:rgba(10,6,8,0.98);border-top:1px solid rgba(232,160,32,0.25);border-bottom:1px solid rgba(232,160,32,0.25);padding:0.4rem 0;max-height:calc(100vh - 52px);overflow-y:auto;-webkit-overflow-scrolling:touch;box-shadow:0 8px 24px rgba(0,0,0,0.5)}' +
        'nav.rsg-shared-nav.open .nav-links{display:flex}' +
        'nav.rsg-shared-nav .nav-links > li{width:100%}' +
        'nav.rsg-shared-nav .nav-links > li > a{padding:0.7rem 1.25rem;font-size:0.78rem}' +
        'nav.rsg-shared-nav .nav-links a.nav-btn{margin:0.4rem 1rem;text-align:center;padding:0.55rem 0.9rem}' +
        'nav.rsg-shared-nav .has-sub{padding-bottom:0;margin-bottom:0}' +
        'nav.rsg-shared-nav .sub-menu{position:static;display:none;background:rgba(0,0,0,0.35);border:none;box-shadow:none;padding:0.2rem 0;margin:0;border-radius:0;border-left:2px solid rgba(232,160,32,0.25);margin-left:1rem}' +
        'nav.rsg-shared-nav .has-sub.open .sub-menu{display:block}' +
        'nav.rsg-shared-nav .sub-menu a{padding:0.45rem 1rem;font-size:0.7rem;opacity:0.9}' +
        'body.rsg-nav-padded{padding-top:52px}' +
      '}';
    var style = document.createElement('style');
    style.id = 'rsg-shared-nav-style';
    style.textContent = css;
    document.head.appendChild(style);
  }

  function mount() {
    injectStyle();
    var legacy = document.querySelectorAll('nav:not(.rsg-shared-nav)');
    legacy.forEach(function (n) {
      if (n.querySelector && (n.querySelector('.nav-logo') || n.querySelector('.nav-links'))) n.remove();
    });
    if (!document.querySelector('nav.rsg-shared-nav')) {
      var nav = buildNav();
      document.body.insertBefore(nav, document.body.firstChild);
    }
    document.body.classList.add('rsg-nav-padded');
    var navEl = document.querySelector('nav.rsg-shared-nav');
    var burger = navEl && navEl.querySelector('.nav-burger');
    if (burger) {
      burger.addEventListener('click', function (e) {
        e.stopPropagation();
        var open = navEl.classList.toggle('open');
        burger.setAttribute('aria-expanded', open ? 'true' : 'false');
        if (!open) {
          navEl.querySelectorAll('.has-sub.open').forEach(function (o) { o.classList.remove('open'); });
        }
      });
    }
    document.querySelectorAll('nav.rsg-shared-nav .has-sub > a').forEach(function (a) {
      a.addEventListener('click', function (e) {
        var li = a.parentNode;
        var wasOpen = li.classList.contains('open');
        document.querySelectorAll('nav.rsg-shared-nav .has-sub.open').forEach(function (o) { o.classList.remove('open'); });
        if (!wasOpen) { li.classList.add('open'); e.preventDefault(); }
      });
    });
    document.addEventListener('click', function (e) {
      if (!e.target.closest || !e.target.closest('nav.rsg-shared-nav .has-sub')) {
        document.querySelectorAll('nav.rsg-shared-nav .has-sub.open').forEach(function (o) { o.classList.remove('open'); });
      }
      if (navEl && !e.target.closest('nav.rsg-shared-nav')) {
        navEl.classList.remove('open');
        if (burger) burger.setAttribute('aria-expanded', 'false');
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mount);
  } else {
    mount();
  }
})();
