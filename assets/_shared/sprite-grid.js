/**
 * sprite-grid.js — Shared sprite-grid utilities for images.html and image-review-v2.html
 *
 * Exports (all on window.SpriteGrid):
 *   mountBgFilter(containerEl)  — renders the bg-toggle toolbar into containerEl
 *   applySpriteBg(mode)         — applies a bg mode to body[data-sprite-bg]
 *   BG_LS_KEY                   — localStorage key (shared so both pages stay in sync)
 *   resolveAppearanceCategory   — map appearances-manifest kind → charCat filter value
 */
(function() {
  'use strict';

  /** localStorage key — same key means both pages share the user's preference. */
  const BG_LS_KEY = 'evImgReview_spriteBg';

  /**
   * Apply a sprite-background mode to the page.
   * Sets body[data-sprite-bg] which is read by the CSS rules in sprite-grid.css.
   * Updates active class on all .bg-filter-btn elements in every .bg-filter-bar.
   * Persists to localStorage.
   *
   * @param {string} mode  One of: 'checker' | 'none' | 'white' | 'black' | 'green'
   */
  function applySpriteBg(mode) {
    const valid = ['checker', 'none', 'white', 'black', 'green'];
    if (!valid.includes(mode)) mode = 'checker';
    // 'checker' = remove the override so the .checker-bg class handles it naturally.
    document.body.dataset.spriteBg = (mode === 'checker') ? '' : mode;
    // Sync active state on ALL bg-filter-bars (both pages may have multiple mount points)
    document.querySelectorAll('.bg-filter-bar .bg-filter-btn').forEach(function(b) {
      b.classList.toggle('active', b.dataset.bg === mode);
    });
    try { localStorage.setItem(BG_LS_KEY, mode); } catch (_) {}
  }

  /**
   * Mount a background-filter toolbar inside `containerEl`.
   * Reads the current preference from localStorage and applies it immediately.
   * Safe to call multiple times (idempotent per container).
   *
   * @param {HTMLElement} containerEl  Where to inject the toolbar.
   */
  function mountBgFilter(containerEl) {
    if (!containerEl) return;

    var bar = document.createElement('div');
    bar.className = 'bg-filter-bar';
    bar.setAttribute('role', 'group');
    bar.setAttribute('aria-label', 'Sprite background');

    var label = document.createElement('span');
    label.className = 'bg-filter-label';
    label.textContent = 'BG:';
    bar.appendChild(label);

    var options = [
      { bg: 'checker', icon: '☑', title: 'Transparency grid (checker)' },
      { bg: 'none',    icon: '∅', title: 'No background (transparent)' },
      { bg: 'white',   icon: 'W',      title: 'Solid white' },
      { bg: 'black',   icon: 'B',      title: 'Solid black' },
      { bg: 'green',   icon: 'G',      title: 'Chroma green #00FF00' },
    ];

    options.forEach(function(opt) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'bg-filter-btn';
      btn.dataset.bg = opt.bg;
      btn.title = opt.title;
      btn.setAttribute('aria-label', opt.title);
      btn.textContent = opt.icon;
      btn.addEventListener('click', function() { applySpriteBg(opt.bg); });
      bar.appendChild(btn);
    });

    containerEl.appendChild(bar);

    // Read preference and apply (also syncs the active state on the new buttons)
    var saved = 'checker';
    try { saved = localStorage.getItem(BG_LS_KEY) || 'checker'; } catch (_) {}
    applySpriteBg(saved);
  }

  /**
   * Map an appearances-manifest entry's kind/category to the filter category
   * used by image-review-v2.html's charCats filter set.
   *
   * appearances-manifest kinds:
   *   'class'      → 'hero'     (player-controlled classes)
   *   'companion'  → 'companion'
   *   'enemy'      → 'enemy'
   *   'boss'       → 'boss'
   *   'npc'        → null       (not shown in charCat-filtered views)
   *   'deprecated' → null
   *   'appearance' → 'hero'     (fallback for older entries)
   *
   * Also respects the direct category field (from image-review-v2.json entries
   * which already use 'hero'/'companion'/'boss'/'enemy').
   *
   * @param {Object} app  An entry from appearances-manifest.json
   * @returns {string|null}  The charCat value, or null to exclude from filtered views
   */
  function resolveAppearanceCategory(app) {
    // image-review-v2.json entries already carry the right category value
    if (app.category && ['hero','companion','boss','enemy'].includes(app.category)) {
      return app.category;
    }
    // appearances-manifest entries use 'kind'
    var kind = app.kind || app.category || '';
    switch (kind) {
      case 'class':
      case 'appearance': return 'hero';
      case 'companion':  return 'companion';
      case 'enemy':      return 'enemy';
      case 'boss':       return 'boss';
      default:           return null;  // 'npc', 'deprecated', unknown
    }
  }

  // ---------------------------------------------------------------------------
  // Unified single-row character renderer (M464 / M471)
  // Layout per character:
  //   <name>
  //   [portrait][south][east][east_attack][east_spell][east_block][east_ko]
  // One row per character, equal-size 96px tiles, no card frame.
  //
  // Used by image-review-v2.html (with selection / flag / generator badges) and
  // images.html (plain click-to-open). The renderer is pure — callers supply
  // characters + tile sources + tile-click handler, and the renderer wires up
  // the DOM. Page-specific decorations (flag dots, generator badges, selection
  // state, bulk-select checkbox) are opt-in via the `decorateTile` callback.
  // ---------------------------------------------------------------------------

  /**
   * @typedef CharRecord
   * @property {string}        id         Group id (e.g. "warrior", "dire_wolf").
   * @property {string}        name       Display name. Falls back to id if blank.
   * @property {string|null}   subtitle   Optional id row (e.g. "warrior").
   * @property {Array<TileSpec>} tiles    Tile descriptors in render order.
   */
  /**
   * @typedef TileSpec
   * @property {string}        id         Tile-level id (entry id or synthetic pose id).
   * @property {string|null}   src        Image src; null = missing-tile glyph.
   * @property {string|null}   pose       Pose key (used for the small label).
   * @property {string|null}   poseLabel  Override label text (e.g. "atk").
   * @property {string|null}   subtitle   Extra alt-text qualifier.
   * @property {any}           data       Caller-defined payload forwarded to onTileClick / decorateTile.
   */

  /**
   * Render a unified-character section into `container`.
   *
   * @param {HTMLElement}  container
   * @param {CharRecord[]} characters
   * @param {Object}       [opts]
   * @param {Function}     [opts.onTileClick]   (tile, charRecord, event) — click handler. If omitted, tiles are non-interactive.
   * @param {Function}     [opts.decorateTile]  (tileEl, tile, charRecord) — page-specific decorations after the base tile is built.
   * @param {Function}     [opts.decorateHead]  (headEl, charRecord) — page-specific header content (bulk checkbox, badges).
   */
  function renderUnifiedCharacters(container, characters, opts) {
    opts = opts || {};
    // M478 — APPEND-only. Callers that need to clear (e.g. image-review-v2
    // batch re-renders) own that responsibility. Previously this wiped the
    // container on every call, which broke images.html where the page calls
    // the renderer once per appearance in a loop — only the LAST appearance
    // survived (made "Classes" filter show only clockwork_turret).
    if (opts.clear) container.innerHTML = '';

    for (const c of characters) {
      const section = document.createElement('div');
      section.className = 'unified-char';

      const head = document.createElement('div');
      head.className = 'uc-head';

      if (typeof opts.decorateHead === 'function') {
        try { opts.decorateHead(head, c); } catch (e) { console.error(e); }
      }

      const nameEl = document.createElement('div');
      nameEl.className = 'uc-name';
      nameEl.textContent = c.name || (c.id || '').replace(/_/g, ' ').replace(/\b\w/g, ch => ch.toUpperCase());
      head.appendChild(nameEl);

      if (c.subtitle || c.id) {
        const idEl = document.createElement('div');
        idEl.className = 'uc-id';
        idEl.textContent = c.subtitle || c.id;
        head.appendChild(idEl);
      }
      section.appendChild(head);

      const row = document.createElement('div');
      row.className = 'uc-row';

      for (const t of (c.tiles || [])) {
        const tile = document.createElement('div');
        tile.className = 'uc-tile checker-bg';
        if (t.id) tile.dataset.id = t.id;

        if (!t.src) {
          tile.classList.add('tile-missing');
          tile.innerHTML = '<span class="uc-missing-glyph">&#x2717;</span>';
          if (t.poseLabel || t.pose) {
            const lbl = document.createElement('div');
            lbl.className = 'uc-pose-label';
            lbl.textContent = t.poseLabel || t.pose;
            tile.appendChild(lbl);
          }
          row.appendChild(tile);
          continue;
        }

        const img = document.createElement('img');
        img.src = t.src;
        img.alt = (c.name || c.id || '') + ' ' + (t.pose || '');
        img.loading = 'lazy';
        tile.appendChild(img);

        if (t.poseLabel || t.pose) {
          const lbl = document.createElement('div');
          lbl.className = 'uc-pose-label';
          lbl.textContent = t.poseLabel || t.pose;
          tile.appendChild(lbl);
        }

        if (typeof opts.decorateTile === 'function') {
          try { opts.decorateTile(tile, t, c); } catch (e) { console.error(e); }
        }

        if (typeof opts.onTileClick === 'function') {
          tile.addEventListener('click', (ev) => opts.onTileClick(t, c, ev));
        }
        row.appendChild(tile);
      }
      section.appendChild(row);
      container.appendChild(section);
    }
  }

  // Expose on window
  window.SpriteGrid = {
    BG_LS_KEY:                   BG_LS_KEY,
    applySpriteBg:               applySpriteBg,
    mountBgFilter:               mountBgFilter,
    resolveAppearanceCategory:   resolveAppearanceCategory,
    renderUnifiedCharacters:     renderUnifiedCharacters,
  };
})();
