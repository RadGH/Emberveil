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

  // Figure out where we are so relative links resolve cleanly.
  // Pages live under /<gameKey>/assets/… or /<gameKey>/game-info/…
  var path = window.location.pathname;
  var inAssets = /\/assets\//.test(path);
  var inGameInfo = /\/game-info\//.test(path);
  var GAME_ROOT = inAssets || inGameInfo ? '../' : './';
  var ASSETS = GAME_ROOT + 'assets/';
  var GAME_INFO = GAME_ROOT + 'game-info/';

  var MENU = [
    { href: GAME_ROOT, label: 'Play Game' },
    {
      href: ASSETS,
      label: 'Assets',
      children: [
        { href: ASSETS + '#main', label: 'Images' },
        { href: ASSETS + '#audio-section', label: 'Audio' },
        { href: ASSETS + '#reports-section', label: 'Reports' },
        { href: ASSETS + 'rebalance.html', label: 'Rebalance' }
      ]
    },
    { href: GAME_INFO, label: 'Game Info' },
    { href: 'https://docs.google.com/forms/d/e/1FAIpQLScWHFEQ8Kbxvsxg5nKerJOPqkYntAkRLCihqQchypNdqayvmA/viewform?usp=publish-editor', label: 'Send Feedback', external: true }
  ];

  function buildNav() {
    var nav = document.createElement('nav');
    nav.className = 'rsg-shared-nav';
    var links = MENU.map(function (m) {
      if (m.children) {
        var sub = m.children.map(function (c) {
          return '<li><a href="' + c.href + '">' + c.label + '</a></li>';
        }).join('');
        return '<li class="has-sub"><a href="' + m.href + '">' + m.label + ' \u25BE</a><ul class="sub-menu">' + sub + '</ul></li>';
      }
      var attrs = m.external ? ' target="_blank" rel="noopener"' : '';
      return '<li><a href="' + m.href + '"' + attrs + '>' + m.label + '</a></li>';
    }).join('');
    nav.innerHTML =
      '<div class="nav-inner">' +
        '<a class="nav-logo" href="' + GAME_ROOT + '">&#x2726; ' + GAME_LABEL + '</a>' +
        '<ul class="nav-links">' + links + '</ul>' +
      '</div>';
    return nav;
  }

  function injectStyle() {
    if (document.getElementById('rsg-shared-nav-style')) return;
    var css =
      '@import url("https://fonts.googleapis.com/css2?family=Cinzel:wght@400;700;900&family=Inter:wght@300;400;500;600&display=swap");' +
      'nav.rsg-shared-nav{position:fixed;top:0;left:0;right:0;z-index:1000;background:rgba(10,6,8,0.92);backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);border-bottom:1px solid rgba(232,160,32,0.2);height:52px;display:flex;align-items:center;padding:0 2rem;font-family:"Inter","Segoe UI",sans-serif}' +
      'nav.rsg-shared-nav .nav-inner{display:flex;align-items:center;gap:1.5rem;width:100%;max-width:1400px;margin:0 auto;min-width:0}' +
      'nav.rsg-shared-nav .nav-logo{font-family:"Cinzel",Georgia,serif;font-size:1rem;font-weight:900;letter-spacing:0.15em;background:linear-gradient(180deg,#f8d880 0%,#e8a020 40%,#c04030 100%);-webkit-background-clip:text;background-clip:text;color:transparent;flex-shrink:0;text-decoration:none;text-transform:uppercase}' +
      'nav.rsg-shared-nav .nav-links{display:flex;gap:1.25rem;list-style:none;margin:0;padding:0;flex-wrap:nowrap;min-width:0}' +
      'nav.rsg-shared-nav .nav-links > li{position:relative}' +
      'nav.rsg-shared-nav .nav-links a{color:#8a7a6a;text-decoration:none;font-size:0.72rem;font-weight:600;letter-spacing:0.1em;text-transform:uppercase;transition:color 0.2s;white-space:nowrap;display:block}' +
      'nav.rsg-shared-nav .nav-links a:hover{color:#e8a020}' +
      'nav.rsg-shared-nav .has-sub{padding-bottom:0.6rem;margin-bottom:-0.6rem}' +
      'nav.rsg-shared-nav .sub-menu{display:none;position:absolute;top:100%;left:0;background:rgba(10,6,8,0.98);border:1px solid rgba(232,160,32,0.25);border-radius:6px;padding:0.4rem 0;list-style:none;margin:0;min-width:140px;box-shadow:0 8px 24px rgba(0,0,0,0.5)}' +
      'nav.rsg-shared-nav .has-sub:hover .sub-menu,nav.rsg-shared-nav .has-sub:focus-within .sub-menu,nav.rsg-shared-nav .has-sub.open .sub-menu{display:block}' +
      'nav.rsg-shared-nav .sub-menu a{padding:0.4rem 0.9rem;font-size:0.7rem}' +
      'body.rsg-nav-padded{padding-top:52px}' +
      '@media (max-width:720px){' +
        'nav.rsg-shared-nav{height:auto;padding:0.4rem 0.75rem;align-items:stretch}' +
        'nav.rsg-shared-nav .nav-inner{flex-direction:column;align-items:stretch;gap:0.35rem}' +
        'nav.rsg-shared-nav .nav-logo{text-align:center;font-size:0.95rem}' +
        'nav.rsg-shared-nav .nav-links{overflow-x:auto;overflow-y:hidden;-webkit-overflow-scrolling:touch;gap:1rem;padding:0.15rem 0.25rem 0.35rem;scrollbar-width:none}' +
        'nav.rsg-shared-nav .nav-links::-webkit-scrollbar{display:none}' +
        'nav.rsg-shared-nav .nav-links li{flex:0 0 auto}' +
        'nav.rsg-shared-nav .sub-menu{position:static;display:none;background:transparent;border:none;box-shadow:none;padding:0;margin:0}' +
        'nav.rsg-shared-nav .has-sub.open .sub-menu{display:block}' +
        'nav.rsg-shared-nav .sub-menu a{padding:0.2rem 0.5rem;font-size:0.65rem;opacity:0.85}' +
        'body.rsg-nav-padded{padding-top:78px}' +
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
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mount);
  } else {
    mount();
  }
})();
