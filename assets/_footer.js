/*
 * RSG Game Hub — Shared Footer
 * ==========================================================================
 * Single source of truth for the site footer. Loaded by every page that
 * loads _header.js. release.sh copies this into <game>/public/assets/_footer.js
 * (and a sibling copy into news/, etc. via the same mechanism). Pages then
 * include `<script src="./_footer.js" defer></script>` (or "../assets/_footer.js"
 * from news/, game-info/, etc).
 *
 * The footer mirrors the same GAME_KEY derivation logic as nav-header.js so
 * relative links resolve correctly under any sub-path.
 */
(function () {
  var path = window.location.pathname;
  var gameKeyMatch = path.match(/\/(game[0-9a-z_]+)\//i);
  var GAME_LABEL = (document.querySelector('meta[name="rsg-game"]') || {}).content || 'Emberveil';
  var GAME_KEY;
  var GAME_ROOT;
  if (gameKeyMatch) {
    GAME_KEY = gameKeyMatch[1].toLowerCase();
    GAME_ROOT = path.slice(0, path.indexOf('/' + gameKeyMatch[1] + '/') + gameKeyMatch[1].length + 2);
  } else {
    GAME_KEY = 'game13';
    var inSub = /\/(assets|news|game-info)\//.test(path);
    GAME_ROOT = inSub ? '../' : './';
  }
  var ASSETS = GAME_ROOT + 'assets/';
  var NEWS = GAME_ROOT + 'news/';

  // Per-game footer config. Keep sections short — 4-6 links each.
  var FOOTER_BY_GAME = {
    game13: {
      sections: [
        {
          title: 'Game',
          links: [
            { href: GAME_ROOT, label: 'Home' },
            { href: GAME_ROOT + 'play.html', label: 'Play' },
            { href: ASSETS + 'changelog.html', label: 'Changelog' },
            { href: NEWS + 'm220-m254-consolidation.html', label: 'Latest News' },
          ]
        },
        {
          title: 'Tools',
          links: [
            { href: ASSETS + 'tools.html', label: 'All Tools' },
            { href: ASSETS + 'image-review-v2.html', label: 'Image Review V2' },
            { href: ASSETS + 'class-catalog.html', label: 'Class Catalog' },
            { href: ASSETS + 'enemy-catalog.html', label: 'Enemy Catalog' },
          ]
        },
        {
          title: 'Docs',
          links: [
            { href: ASSETS + 'docs.html', label: 'Documentation' },
            { href: ASSETS + 'wishlist.html', label: 'Wishlist' },
            { href: ASSETS + 'brainstorm.html', label: 'Brainstorm' },
          ]
        },
        {
          title: 'Archived',
          links: [
            { href: ASSETS + 'deprecated-image-review.html', label: 'Image Review (old)' },
            { href: ASSETS + 'character-redesign.html', label: 'Character Redesign (old)' },
            { href: ASSETS + 'deprecated-affix-survey.html', label: 'Affix Survey' },
            { href: ASSETS + 'deprecated-enemy-audit.html', label: 'Enemy Audit' },
            { href: ASSETS + 'deprecated-redesign-survey.html', label: 'Redesign Survey' },
            { href: ASSETS + 'sprite-flip-review.html', label: 'Sprite Flip Review' },
            { href: ASSETS + 'rebalance.html', label: 'Rebalance' },
          ]
        },
        {
          title: 'About',
          links: [
            { href: GAME_ROOT + 'contact.html', label: 'Contact' },
            { href: GAME_ROOT + 'privacy.html', label: 'Privacy & Telemetry' },
            { href: GAME_ROOT + 'accessibility.html', label: 'Accessibility' },
          ]
        }
      ]
    }
  };
  var CFG = FOOTER_BY_GAME[GAME_KEY] || { sections: [] };

  function inject() {
    if (document.getElementById('rsg-shared-footer')) return;
    if (!CFG.sections.length) return;

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
    var sectionsHtml = CFG.sections.map(function (s) {
      var liHtml = s.links.map(function (l) {
        return '<li><a href="' + l.href + '">' + l.label + '</a></li>';
      }).join('');
      return '<div class="ftr-section"><h4>' + s.title + '</h4><ul>' + liHtml + '</ul></div>';
    }).join('');
    footer.innerHTML =
      '<div class="ftr-inner">' + sectionsHtml + '</div>' +
      '<div class="ftr-bottom">' + GAME_LABEL + ' · in development · &copy; 2026 RSG</div>';
    document.body.appendChild(footer);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', inject);
  } else {
    inject();
  }
})();
