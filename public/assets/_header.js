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
 *   - After building, this script sets window.RSG_SITE_MENUS so footer.js can
 *     read the same data without duplication.
 *
 * Menu: Play Game | Assets (Images / Audio / Reports) | Game Info
 */
(function () {
  var SCRIPT = document.currentScript;
  // M376: nav-logo is locked to a per-game constant. Pages do NOT get to
  // override it (previously rsg-game meta could change it; that caused
  // "RSG GAME HUB" to leak through on pages that omitted the meta tag).
  // For game13 the brand is always "Emberveil".
  var pathForLabel = window.location.pathname;
  var labelKeyMatch = pathForLabel.match(/\/(game[0-9a-z_]+)\//i);
  var labelKey = labelKeyMatch ? labelKeyMatch[1].toLowerCase() : '';
  var GAME_LABELS_BY_KEY = { game13: 'Emberveil' };
  var GAME_LABEL =
    GAME_LABELS_BY_KEY[labelKey] ||
    (SCRIPT && SCRIPT.dataset.game) ||
    (document.querySelector('meta[name="rsg-game"]') || {}).content ||
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
  var rawLabel = String(GAME_LABEL).toLowerCase();
  // If the meta/label is already a gameNN key, use it directly.
  var metaKey = LABEL_TO_KEY[rawLabel] || (/^game[0-9a-z_]+$/.test(rawLabel) ? rawLabel : '');
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
      { href: ASSETS + 'image-review-v2.html', label: 'Image Review V2' },
      { href: ASSETS + 'sprite-adjust.html', label: 'Sprite Adjust' },
      { href: ASSETS + 'custom-content.html', label: 'Custom Content' },
      { href: ASSETS + 'skill-audit.html', label: 'Skill Audit' },
      { href: ASSETS + 'dialog-inspector.html', label: 'Dialog Inspector' }
    ]
  };
  var CATALOG_BY_GAME = {
    game13: [
      { href: ASSETS + 'class-catalog.html', label: 'Class Catalog' },
      { href: ASSETS + 'companion-catalog.html', label: 'Companion Catalog' },
      { href: ASSETS + 'dungeon-catalog.html', label: 'Dungeon Catalog' },
      { href: ASSETS + 'status-effect-catalog.html', label: 'Status Effect Catalog' },
      { href: ASSETS + 'achievement-roadmap.html', label: 'Achievement Roadmap' },
      { href: ASSETS + 'spell-catalog.html', label: 'Spell Catalog' },
      { href: ASSETS + 'enemy-catalog.html', label: 'Enemy Catalog' },
      { href: ASSETS + 'item-catalog.html', label: 'Item Catalog' }
    ]
  };
  var DOCS_BY_GAME = {
    game13: [
      { href: ASSETS + 'docs.html', label: 'Documentation' },
      { href: ASSETS + 'todo.html', label: 'Todo List' },
      { href: ASSETS + 'wishlist.html', label: 'Wishlist' },
      { href: ASSETS + 'brainstorm.html', label: 'Brainstorm' },
      { href: ASSETS + 'damage-report.html', label: 'Damage Report' },
      { href: ASSETS + 'balance-report.html', label: 'Balance Report' },
      { href: ASSETS + 'changelog.html', label: 'Changelog' }
    ]
  };
  var ARCHIVED_BY_GAME = {
    game13: [
      { href: ASSETS + 'deprecated-image-review.html', label: 'Image Review (deprecated)' },
      { href: ASSETS + 'character-redesign.html', label: 'Character Redesign (deprecated)' },
      { href: ASSETS + 'deprecated-affix-survey.html', label: 'Affix Survey (deprecated)' },
      { href: ASSETS + 'deprecated-enemy-audit.html', label: 'Enemy Audit (deprecated)' },
      { href: ASSETS + 'deprecated-redesign-survey.html', label: 'Redesign Survey (deprecated)' },
      { href: ASSETS + 'sprite-flip-review.html', label: 'Sprite Flip Review' },
      { href: ASSETS + 'rebalance.html', label: 'Rebalance' }
    ]
  };
  // News registry — populated by the migration pass. Sorted newest first.
  // The primary news landing page is news.html (paginated archive).
  var NEWS_ROOT = GAME_ROOT + 'news/';
  var NEWS_ARCHIVE = GAME_ROOT + 'news.html';
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
      { href: NEWS_ROOT + '2026-05-07-rebalance-and-grid.html', label: 'Battle Grid, Manual Mode & 100-Class Rebalance', date: '2026-05-07' },
      { href: NEWS_ROOT + 'post-overhaul-update.html', label: 'Cloud Saves, UI Unification & Balance Pass', date: '2026-04-28' },
      { href: NEWS_ROOT + '2026-04-26-m309-news-pipeline.html', label: 'M313 Dev Diary: News Pipeline & Release Tooling', date: '2026-04-26' },
      { href: NEWS_ROOT + '2026-04-25-sets-and-uniques.html', label: 'Sets and Uniques System: Full Item Tier Overhaul', date: '2026-04-25' },
      { href: NEWS_ROOT + '2026-04-25-infinite-depths.html', label: 'Infinite Depths: Endless Dungeon Mode', date: '2026-04-25' },
      { href: NEWS_ROOT + '2026-04-24-emberveil-m302-gameplay-batch.html', label: 'M302 Gameplay Batch: Companion Sync & New Skills', date: '2026-04-24' },
      { href: NEWS_ROOT + 'm220-m254-consolidation.html', label: 'Fast-Travel Overhaul, Questline & Difficulty', date: '2026-04-23' },
      { href: NEWS_ROOT + 'milestone-report.html',   label: '20 Classes, 84 Skills & Combat Rework', date: '2026-04-15' },
      { href: NEWS_ROOT + 're-redesign.html',        label: 'Character Art Pipeline & Consistency', date: '2026-04-14' },
      { href: NEWS_ROOT + 'm79-redesign.html',       label: 'OpenAI Pixel Art & SFX Loudness Pass', date: '2026-04-14' },
      { href: NEWS_ROOT + 'balance-report.html',     label: 'Combat DPS & Healing Analysis', date: '2026-04-14' },
      { href: NEWS_ROOT + 'tap-weapons.html',        label: 'Interactive Tap Combat System', date: '2026-04-13' },
      { href: NEWS_ROOT + 'simulation-overhaul.html',label: 'Monte Carlo Combat Testing', date: '2026-04-13' },
      { href: NEWS_ROOT + 'dragon-expansion.html',   label: 'Act VI Dragons: Bahamoth & Dragon Knight', date: '2026-04-13' },
      { href: NEWS_ROOT + 'milestone-53.html',       label: 'Deferred Resolution & Feature Completion', date: '2026-04-11' },
      { href: NEWS_ROOT + 'pre-game.html',           label: 'Emberveil Design Foundations', date: '2026-04-10' }
    ]
  };
  var TOOLS = TOOLS_BY_GAME[GAME_KEY] || [];
  var CATALOG = CATALOG_BY_GAME[GAME_KEY] || [];
  var DOCS = DOCS_BY_GAME[GAME_KEY] || [];
  var ARCHIVED = ARCHIVED_BY_GAME[GAME_KEY] || [];
  var NEWS = NEWS_BY_GAME[GAME_KEY] || [];

  // Expose shared menu data for footer.js (loaded after this script).
  // footer.js reads window.RSG_SITE_MENUS to build its columns dynamically.
  window.RSG_SITE_MENUS = {
    GAME_KEY: GAME_KEY,
    GAME_LABEL: GAME_LABEL,
    GAME_ROOT: GAME_ROOT,
    ASSETS: ASSETS,
    NEWS_ROOT: NEWS_ROOT,
    NEWS_ARCHIVE: NEWS_ARCHIVE,
    TOOLS: TOOLS,
    CATALOG: CATALOG,
    DOCS: DOCS,
    ARCHIVED: ARCHIVED,
    NEWS: NEWS
  };

  // Order: Play Game / Game Info / Assets / Tools / News / Send Feedback / Contact
  var PLAY_HREF = GAME_ROOT + 'play.html';
  var assetsItem = {
    href: ASSETS,
    label: 'Assets',
    children: [
      { href: ASSETS + 'images.html', label: 'Images' },
      { href: ASSETS + 'audio.html', label: 'Audio' },
      { href: ASSETS + 'milestones.html', label: 'Milestones' }
    ]
  };
  var toolsItem = TOOLS.length ? {
    href: TOOLS[0].href,
    label: 'Tools',
    children: TOOLS.slice()
  } : null;
  var catalogItem = CATALOG.length ? {
    href: CATALOG[0].href,
    label: 'Catalog',
    children: CATALOG.slice()
  } : null;
  var docsItem = DOCS.length ? {
    href: DOCS[0].href,
    label: 'Docs',
    children: DOCS.slice()
  } : null;
  var archivedItem = ARCHIVED.length ? {
    href: ARCHIVED[0].href,
    label: 'Archived',
    children: ARCHIVED.slice()
  } : null;
  // News dropdown: show top 8 article titles (no date, no archive footer).
  var newsItem = NEWS.length ? (function () {
    var top = NEWS.slice(0, 8);
    var children = top.map(function (n) {
      return { href: n.href, label: n.label };
    });
    return { href: NEWS_ARCHIVE, label: 'News', children: children, alignRight: true };
  })() : null;
  // M242: "Home" takes over the front-page role; "Game Info" still links
  // for any games that haven't consolidated yet. For Emberveil (game13)
  // the Game Info page will be deleted and the link drops out of the menu.
  var HOME_HREF = GAME_ROOT;
  var MENU = [
    { href: PLAY_HREF, label: 'Play Game', primary: true },
    { href: HOME_HREF, label: 'Home' }
  ];
  // Keep Game Info link for non-emberveil games. Once every game is
  // consolidated this branch can go.
  if (GAME_KEY !== 'game13') MENU.push({ href: GAME_INFO, label: 'Game Info' });
  MENU.push(assetsItem);
  if (toolsItem) MENU.push(toolsItem);
  if (catalogItem) MENU.push(catalogItem);
  if (docsItem) MENU.push(docsItem);
  if (newsItem) MENU.push(newsItem);
  // Archived moved to footer (M354). Send Feedback moved to Contact page only (M354).
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
        var subCls = m.alignRight ? ' sub-menu sub-menu-right' : ' sub-menu';
        var liCls = m.alignRight ? 'has-sub has-sub-right' : 'has-sub';
        return '<li class="' + liCls + '"><a href="' + m.href + '">' + m.label + ' ▾</a><ul class="' + subCls + '">' + sub + '</ul></li>';
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
      // M354 — canonical site-wide design tokens. Pages may override but should
      // prefer var(--name) over hardcoded values. Keep aligned with audit.
      ':root{' +
        '--rsg-bg:#0a0608;--rsg-surface:#12090d;--rsg-card:#1a1218;--rsg-card-h:#241a20;' +
        '--rsg-accent:#e8a020;--rsg-accent-b:#f0c060;--rsg-gold-bright:#f8d880;--rsg-ember:#c04030;' +
        '--rsg-text:#f0e8d8;--rsg-muted:#8a7a6a;--rsg-border:rgba(232,160,32,0.2);--rsg-border-hi:rgba(232,160,32,0.45);' +
        '--rsg-radius:10px;' +
        '--rsg-container-max:1200px;--rsg-narrow-max:860px;--rsg-reading-max:720px;' +
        '--rsg-font-display:"Cinzel",Georgia,serif;--rsg-font-ui:"Inter","Segoe UI",sans-serif;' +
      '}' +
      // M375: header restyled to match the new Ember design reference.
      // Same markup/links — only colors, typography, spacing.
      'nav.rsg-shared-nav{position:fixed;top:0;left:0;right:0;z-index:1000;background:linear-gradient(180deg,rgba(11,8,7,.92),rgba(11,8,7,.55));backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);border-bottom:1px solid transparent;height:72px;display:flex;align-items:center;padding:0 2rem;font-family:"Inter","Segoe UI",sans-serif;transition:background .3s ease,border-color .3s ease}' +
      'nav.rsg-shared-nav.scrolled{background:rgba(11,8,7,.96);border-bottom-color:#3a2e25}' +
      'nav.rsg-shared-nav .nav-inner{display:flex;align-items:center;justify-content:space-between;gap:1.25rem;width:min(1400px,96vw);margin:0 auto;min-width:0}' +
      'nav.rsg-shared-nav .nav-logo{font-family:"Cinzel",Georgia,serif;font-size:17px;font-weight:600;letter-spacing:0.32em;color:#f3e6d2;flex-shrink:0;text-decoration:none;text-transform:uppercase;display:inline-flex;align-items:center;gap:10px}' +
      'nav.rsg-shared-nav .nav-links{display:flex;align-items:center;gap:1.25rem;list-style:none;margin:0;padding:0;flex-wrap:nowrap;min-width:0}' +
      'nav.rsg-shared-nav .nav-burger{display:none;background:transparent;border:1px solid rgba(232,160,32,0.35);border-radius:4px;width:36px;height:32px;padding:0;cursor:pointer;flex-direction:column;align-items:center;justify-content:center;gap:4px;flex-shrink:0}' +
      'nav.rsg-shared-nav .nav-burger span{display:block;width:18px;height:2px;background:#e8a020;border-radius:1px;transition:transform .2s, opacity .2s}' +
      'nav.rsg-shared-nav .nav-burger[aria-expanded="true"] span:nth-child(1){transform:translateY(6px) rotate(45deg)}' +
      'nav.rsg-shared-nav .nav-burger[aria-expanded="true"] span:nth-child(2){opacity:0}' +
      'nav.rsg-shared-nav .nav-burger[aria-expanded="true"] span:nth-child(3){transform:translateY(-6px) rotate(-45deg)}' +
      'nav.rsg-shared-nav .nav-links > li{position:relative}' +
      // M375: link colors + typography from new design (mono caps, ink-2/ink-1).
      'nav.rsg-shared-nav .nav-links a{position:relative;color:#c9b89a;text-decoration:none;font-family:"JetBrains Mono",ui-monospace,monospace;font-size:12px;font-weight:500;letter-spacing:0.22em;text-transform:uppercase;transition:color .25s;white-space:nowrap;display:block;padding:8px 0}' +
      'nav.rsg-shared-nav .nav-links a:hover{color:#ffb066}' +
      'nav.rsg-shared-nav .nav-links a.nav-btn{color:#f3e6d2;background:linear-gradient(180deg,rgba(232,97,42,.18),rgba(232,97,42,.06));padding:11px 22px;border:1px solid #54402f;border-radius:2px;font-weight:500;letter-spacing:0.22em}' +
      'nav.rsg-shared-nav .nav-links a.nav-btn:hover{background:linear-gradient(180deg,rgba(232,97,42,.32),rgba(232,97,42,.14));color:#fff;border-color:#e8612a}' +
      'nav.rsg-shared-nav .sub-menu{display:none;position:absolute;top:100%;left:0;background:rgba(10,6,8,0.98);border:1px solid rgba(232,160,32,0.25);border-radius:6px;padding:0.4rem 0;list-style:none;margin:0;min-width:140px;max-width:calc(100vw - 16px);box-shadow:0 8px 24px rgba(0,0,0,0.5);margin-top:17px;border-top:none;border-top-left-radius:0;border-top-right-radius:0}' +
      'nav.rsg-shared-nav .sub-menu-right{left:auto;right:0}' +
      'nav.rsg-shared-nav .sub-menu::before{content:"";position:absolute;bottom:calc(100% + -1px);left:0;right:0;height:19px}' +
      'nav.rsg-shared-nav .has-sub:hover .sub-menu,nav.rsg-shared-nav .has-sub:focus-within .sub-menu,nav.rsg-shared-nav .has-sub.open .sub-menu{display:block}' +
      'nav.rsg-shared-nav .sub-menu a{padding:0.4rem 0.9rem;font-size:0.7rem}' +
      'nav.rsg-shared-nav .sub-menu .sub-sep{padding:0.45rem 0.9rem 0.2rem;margin-top:0.25rem;border-top:1px solid rgba(232,160,32,0.2)}' +
      'nav.rsg-shared-nav .sub-menu .sub-sep span{color:#e8a020;font-size:0.62rem;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;opacity:0.8}' +
      'body.rsg-nav-padded{padding-top:72px}' +
      '@media (max-width:720px){' +
        'nav.rsg-shared-nav{height:64px;padding:0 0.75rem}' +
        'nav.rsg-shared-nav .nav-inner{flex-direction:row;align-items:center;justify-content:space-between;gap:0.5rem}' +
        'nav.rsg-shared-nav .nav-logo{text-align:left;font-size:0.95rem;flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}' +
        'nav.rsg-shared-nav .nav-burger{display:flex}' +
        'nav.rsg-shared-nav .nav-links{display:none;position:absolute;top:64px;left:0;right:0;flex-direction:column;align-items:stretch;gap:0;background:rgba(10,6,8,0.98);border-top:1px solid rgba(232,160,32,0.25);border-bottom:1px solid rgba(232,160,32,0.25);padding:0.4rem 0;max-height:calc(100vh - 52px);overflow-y:auto;-webkit-overflow-scrolling:touch;box-shadow:0 8px 24px rgba(0,0,0,0.5)}' +
        'nav.rsg-shared-nav.open .nav-links{display:flex}' +
        'nav.rsg-shared-nav .nav-links > li{width:100%}' +
        'nav.rsg-shared-nav .nav-links > li > a{padding:0.7rem 1.25rem;font-size:0.78rem}' +
        'nav.rsg-shared-nav .nav-links a.nav-btn{margin:0.4rem 1rem;text-align:center;padding:0.55rem 0.9rem}' +
        'nav.rsg-shared-nav .sub-menu{position:static;display:none;background:rgba(0,0,0,0.35);border:none;box-shadow:none;padding:0.2rem 0;margin:0;border-radius:0;border-left:2px solid rgba(232,160,32,0.25);margin-left:1rem}' +
        'nav.rsg-shared-nav .sub-menu::before{display:none}' +
        'nav.rsg-shared-nav .has-sub.open .sub-menu{display:block}' +
        'nav.rsg-shared-nav .sub-menu a{padding:0.45rem 1rem;font-size:0.7rem;opacity:0.9}' +
        'body.rsg-nav-padded{padding-top:72px}' +
      '}';
    var style = document.createElement('style');
    style.id = 'rsg-shared-nav-style';
    style.textContent = css;
    document.head.appendChild(style);

    // M365 — inject the shared site theme stylesheet. The file is copied from
    // shared/site-theme.css to <game>/public/assets/_site-theme.css by
    // release.sh. Pages that opt in by adding `class="ev-themed"` to <body>
    // pick up the full theme; non-themed pages only see the :root tokens and
    // a few component classes (.cta, .hero, etc.) which are inert without
    // matching markup.
    if (!document.getElementById('rsg-site-theme-link')) {
      var link = document.createElement('link');
      link.id = 'rsg-site-theme-link';
      link.rel = 'stylesheet';
      link.href = ASSETS + '_site-theme.css';
      document.head.appendChild(link);
    }
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
    // M365 — themed pages opt into the rune cursor via body data-cursor.
    if (document.body.classList.contains('ev-themed') && !document.body.dataset.cursor) {
      document.body.dataset.cursor = 'rune';
    }
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
