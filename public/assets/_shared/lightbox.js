/**
 * lightbox.js — Shared lightbox / image-detail popup for Emberveil gallery pages.
 *
 * Used by both images.html and image-review-v2.html. Same DOM, same CSS, same
 * keyboard + click behaviour. Review-specific features (flag controls,
 * old/new comparison, prompt panel, asset IDs) are surfaced only when the
 * caller supplies the relevant fields or opts in via options.
 *
 * Public API (window.SharedLightbox):
 *   const lb = SharedLightbox.create(opts);
 *   lb.setItems(items)         — replace the navigation list.
 *   lb.openById(id)            — open at the entry whose .id matches.
 *   lb.openByIndex(i)          — open at index i.
 *   lb.openSingle(item)        — open with one ad-hoc item (no prev/next).
 *   lb.close()
 *   lb.isOpen()
 *
 * Item shape (all fields optional except `src` for image display):
 *   {
 *     id, src, title, subtitle, isBg,
 *     oldSrc, newSrc,                 // if both present → comparison view
 *     prompt, oldPrompt, newPrompt,   // long-form prompt text
 *     reason,                         // short string above prompt
 *     assetId, referenceAssetId,      // SpriteCook asset IDs
 *     meta,                           // { label: value } generic rows for simple use
 *   }
 *
 * Options:
 *   enableFlags         (bool, default false) — show the flag controls panel
 *   flagAdapter         ({ get(id), set(id, prio, text) }) — required if enableFlags
 *   enableLayoutToggle  (bool, default true)  — show the "Toggle layout" button
 *   showSidePanel       (bool, default true)  — if false, lb-body fills with stage only
 *   onAfterRender       (fn(item, controller)) — hook after each render (e.g. refresh card flag dots)
 *
 * Keyboard:
 *   Esc            close
 *   Arrow Left     prev (wraps)
 *   Arrow Right    next (wraps)
 * Click on backdrop (outside the toolbar/body) closes.
 */
(function() {
  'use strict';

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
  function escAttr(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  /**
   * Build the lightbox DOM once and append to <body>.
   * Returns the root element. Idempotent — calling twice returns the existing node.
   */
  function buildDom() {
    let root = document.querySelector('.shared-lightbox');
    if (root) return root;

    root = document.createElement('div');
    root.className = 'shared-lightbox';
    root.setAttribute('role', 'dialog');
    root.setAttribute('aria-modal', 'true');
    root.innerHTML = [
      '<button class="lb-close-x" data-lb-action="close" aria-label="Close lightbox">×</button>',
      '<div class="lb-toolbar">',
      '  <div>',
      '    <button data-lb-action="prev" type="button">← Prev</button>',
      '    <button data-lb-action="next" type="button">Next →</button>',
      '    <span class="lb-counter"></span>',
      '  </div>',
      '  <div>',
      '    <button data-lb-action="toggle-layout" type="button" data-lb-feature="layout-toggle">Toggle layout</button>',
      '    <button data-lb-action="close" type="button">× Close</button>',
      '  </div>',
      '</div>',
      '<div class="lb-body">',
      '  <div class="lb-stage"><img alt=""></div>',
      '  <div class="lb-side"></div>',
      '</div>',
    ].join('');
    document.body.appendChild(root);
    return root;
  }

  function create(opts) {
    opts = opts || {};
    const enableFlags        = !!opts.enableFlags;
    const flagAdapter        = opts.flagAdapter || null;
    const enableLayoutToggle = opts.enableLayoutToggle !== false;
    const showSidePanel      = opts.showSidePanel !== false;
    const onAfterRender      = typeof opts.onAfterRender === 'function' ? opts.onAfterRender : null;

    if (enableFlags && !flagAdapter) {
      // Soft warning — flag UI will render but won't persist anywhere.
      console.warn('[SharedLightbox] enableFlags=true but no flagAdapter provided');
    }

    const root = buildDom();
    const toolbar  = root.querySelector('.lb-toolbar');
    const body     = root.querySelector('.lb-body');
    const stageEl  = root.querySelector('.lb-stage');
    const imgEl    = stageEl.querySelector('img');
    const sideEl   = root.querySelector('.lb-side');
    const counterEl = root.querySelector('.lb-counter');

    // Toggle layout button — hide if disabled.
    const toggleBtn = toolbar.querySelector('[data-lb-feature="layout-toggle"]');
    if (toggleBtn && !enableLayoutToggle) toggleBtn.style.display = 'none';

    if (!showSidePanel) body.classList.add('no-side');

    let items = [];
    let idx = 0;
    let stacked = false;
    // Single-shot mode: when openSingle() is used, prev/next are disabled
    // regardless of `items`.
    let singleMode = false;

    function isOpen() { return root.classList.contains('open'); }

    function setItems(next) {
      items = Array.isArray(next) ? next.slice() : [];
      singleMode = false;
    }

    function findIndexById(id) {
      for (let i = 0; i < items.length; i++) {
        if (items[i] && items[i].id === id) return i;
      }
      return -1;
    }

    function openByIndex(i) {
      if (i < 0 || i >= items.length) return;
      idx = i;
      singleMode = false;
      render();
      root.classList.add('open');
    }
    function openById(id) {
      const i = findIndexById(id);
      if (i < 0) return;
      openByIndex(i);
    }
    function openSingle(item) {
      if (!item) return;
      items = [item];
      idx = 0;
      singleMode = true;
      render();
      root.classList.add('open');
    }
    function close() { root.classList.remove('open'); }
    function step(delta) {
      if (singleMode || items.length < 2) return;
      idx = (idx + delta + items.length) % items.length;
      render();
    }

    /**
     * Render the current item into the stage + side panel.
     */
    function render() {
      const it = items[idx];
      if (!it) return;

      stageEl.classList.toggle('bg', !!it.isBg);
      imgEl.src = it.src || '';
      imgEl.alt = it.title || '';

      const nav = !singleMode && items.length > 1;
      counterEl.textContent = nav ? `${idx + 1} / ${items.length}` : '';
      toolbar.querySelector('[data-lb-action="prev"]').disabled = !nav;
      toolbar.querySelector('[data-lb-action="next"]').disabled = !nav;

      if (showSidePanel) {
        sideEl.innerHTML = renderSideHtml(it);
        wireSideEvents(it);
      }

      if (onAfterRender) {
        try { onAfterRender(it, controller); } catch (e) { console.error(e); }
      }
    }

    function renderSideHtml(it) {
      let html = '';
      if (it.title) html += `<h3>${esc(it.title)}</h3>`;
      if (it.subtitle) html += `<div class="meta">${esc(it.subtitle)}</div>`;

      if (it.reason) {
        html += `<div class="lb-reason-row"><strong>Reason:</strong> ${esc(it.reason)}</div>`;
      }
      if (it.oldSrc && it.newSrc) {
        html += `<div class="lb-comparison">
          <div><div class="lbl">Original</div><img src="${escAttr(it.oldSrc)}" alt="old"></div>
          <div><div class="lbl new">Candidate</div><img src="${escAttr(it.newSrc)}" alt="new"></div>
        </div>`;
        if (it.oldPrompt) {
          html += `<div class="lb-prompt-block"><div class="meta">Original prompt</div><div class="prompt">${esc(it.oldPrompt)}</div></div>`;
        }
        if (it.newPrompt) {
          html += `<div class="lb-prompt-block prompt-sub"><div class="meta">Candidate prompt</div><div class="prompt">${esc(it.newPrompt)}</div></div>`;
        }
      }
      if (!it.oldSrc && it.prompt) {
        html += `<div class="lb-prompt-block"><div class="meta">Prompt</div><div class="prompt">${esc(it.prompt)}</div></div>`;
      }
      if (it.assetId) {
        html += `<div class="lb-asset-line"><span class="meta">SpriteCook asset:</span> <code>${esc(it.assetId)}</code></div>`;
      }
      if (it.referenceAssetId) {
        html += `<div class="lb-asset-line sub"><span class="meta">Reference:</span> <code>${esc(it.referenceAssetId)}</code></div>`;
      }
      // Generic key/value rows (simple openers, e.g. images.html — { File: '…', Usage: '…' }).
      if (it.meta && typeof it.meta === 'object') {
        for (const [label, val] of Object.entries(it.meta)) {
          if (val == null || val === '') continue;
          const isFile = label === 'File';
          html += `<div class="lb-kv${isFile ? ' lb-kv-file' : ''}">
            <div class="lb-kv-label">${esc(label)}</div>
            <div class="lb-kv-value">${esc(val)}</div>
          </div>`;
        }
      }
      if (enableFlags) {
        const f = flagAdapter ? flagAdapter.get(it.id) : null;
        html += `<div class="lb-flag-row">
          <div class="meta">Flag</div>
          <div class="lb-flag-btns">
            <button data-flag-prio=""        class="lb-flag-btn${!f ? ' active' : ''}">none</button>
            <button data-flag-prio="info"    class="lb-flag-btn${f && f.prio === 'info' ? ' active' : ''}">info</button>
            <button data-flag-prio="warning" class="lb-flag-btn${f && f.prio === 'warning' ? ' active' : ''}">warn</button>
            <button data-flag-prio="error"   class="lb-flag-btn${f && f.prio === 'error' ? ' active' : ''}">error</button>
          </div>
          <input type="text" class="lb-flag-text" value="${escAttr(f && f.text || '')}" placeholder="Flag note (optional)">
        </div>`;
      }
      return html;
    }

    function wireSideEvents(it) {
      if (!enableFlags || !flagAdapter) return;
      sideEl.querySelectorAll('.lb-flag-btn').forEach(b => {
        b.onclick = () => {
          const prio = b.dataset.flagPrio || '';
          const txt  = sideEl.querySelector('.lb-flag-text')?.value || '';
          flagAdapter.set(it.id, prio || null, txt);
          render(); // refresh active state
        };
      });
      const ti = sideEl.querySelector('.lb-flag-text');
      if (ti) ti.oninput = () => {
        const cur = flagAdapter.get(it.id);
        if (cur) flagAdapter.set(it.id, cur.prio, ti.value);
      };
    }

    // Wire toolbar + backdrop (event delegation — survives any later DOM change).
    root.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-lb-action]');
      if (!btn) {
        // Click on the root background (not on any child) closes.
        if (e.target === root) close();
        return;
      }
      const action = btn.dataset.lbAction;
      if (action === 'close') close();
      else if (action === 'prev') step(-1);
      else if (action === 'next') step(1);
      else if (action === 'toggle-layout') {
        stacked = !stacked;
        body.classList.toggle('stacked', stacked);
      }
    });

    document.addEventListener('keydown', (e) => {
      if (!isOpen()) return;
      if (e.key === 'Escape') close();
      else if (e.key === 'ArrowLeft')  step(-1);
      else if (e.key === 'ArrowRight') step(1);
    });

    const controller = {
      setItems,
      openById,
      openByIndex,
      openSingle,
      close,
      isOpen,
      findIndexById,
      // Expose for callers that need to react to flag changes (e.g. refresh card dots)
      rerender: render,
    };
    return controller;
  }

  window.SharedLightbox = { create: create };
})();
