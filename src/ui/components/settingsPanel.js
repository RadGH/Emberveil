/**
 * settingsPanel — M312 #38 reusable settings panel component.
 *
 * Renders a themed scrollable settings panel that can be embedded
 * in any screen (SettingsScreen, GameMenuScreen, in-game panels, etc.)
 * without duplicating CSS or wiring code.
 *
 * Usage:
 *   import { createSettingsPanel } from '../components/settingsPanel.js';
 *
 *   const panel = createSettingsPanel({
 *     title: 'Audio',           // optional section title
 *     rows: [
 *       {
 *         type: 'toggle',
 *         id: 'my-toggle',
 *         label: 'Enable Feature',
 *         hint: 'Optional description',
 *         value: true,
 *         onChange: (val) => { ... },
 *       },
 *       {
 *         type: 'select',
 *         id: 'my-select',
 *         label: 'Pick One',
 *         options: [{ value: 'a', label: 'Option A' }, ...],
 *         value: 'a',
 *         onChange: (val) => { ... },
 *       },
 *       {
 *         type: 'slider',
 *         id: 'my-slider',
 *         label: 'Volume',
 *         min: 0, max: 1, step: 0.05,
 *         value: 0.8,
 *         onChange: (val) => { ... },
 *       },
 *     ],
 *   });
 *
 *   container.appendChild(panel.el);
 *   // panel.destroy() to tear down event listeners.
 */

import { injectStyles } from '../../utils/dom.js';

const SETTINGS_PANEL_STYLES = `
.rsg-settings-panel {
  display: flex; flex-direction: column; gap: 0;
  width: 100%;
}
.rsg-settings-panel-title {
  font-family: 'Cinzel', Georgia, serif;
  font-size: 0.72rem; font-weight: 700;
  letter-spacing: 0.12em; text-transform: uppercase;
  color: #8a7a6a; padding: 0.6rem 0 0.4rem;
  border-bottom: 1px solid rgba(232,160,32,0.12);
  margin-bottom: 0.25rem;
}
.rsg-settings-row {
  display: flex; flex-direction: column; gap: 0.4rem;
  padding: 0.6rem 0;
  border-bottom: 1px solid rgba(255,255,255,0.04);
}
.rsg-settings-row:last-child { border-bottom: none; }
.rsg-settings-row-label {
  font-size: 0.8rem; font-weight: 600;
  letter-spacing: 0.08em; text-transform: uppercase;
  color: #8a7a6a;
}
.rsg-settings-row-hint {
  font-size: 0.65rem; color: #6a5a52; line-height: 1.4;
}
.rsg-settings-toggle-row {
  display: grid; grid-template-columns: min-content 1fr;
  gap: 0.9rem; align-items: center;
}
.rsg-settings-toggle {
  width: 44px; height: 24px;
  background: rgba(255,255,255,0.1);
  border-radius: 12px; border: 1px solid rgba(255,255,255,0.2);
  cursor: pointer; position: relative; transition: background 0.2s;
  flex-shrink: 0;
}
.rsg-settings-toggle.on {
  background: rgba(232,160,32,0.4);
  border-color: rgba(232,160,32,0.6);
}
.rsg-settings-toggle::after {
  content: ''; position: absolute;
  top: 2px; left: 2px; width: 18px; height: 18px;
  background: #8a7a6a; border-radius: 50%;
  transition: transform 0.2s, background 0.2s;
}
.rsg-settings-toggle.on::after {
  transform: translateX(20px); background: #e8a020;
}
.rsg-settings-select {
  padding: 0.4rem 0.6rem;
  background: #1a0e14; border: 1px solid rgba(232,160,32,0.3);
  border-radius: 4px; color: #f0e8d8;
  font-family: inherit; font-size: 0.85rem;
  min-height: 44px; width: 100%;
}
.rsg-settings-slider {
  width: 100%; accent-color: #e8a020; height: 4px; cursor: pointer;
}
`;

export function createSettingsPanel({ title, rows = [] }) {
  injectStyles('rsg-settings-panel-styles', SETTINGS_PANEL_STYLES);

  const el = document.createElement('div');
  el.className = 'rsg-settings-panel';

  if (title) {
    const titleEl = document.createElement('div');
    titleEl.className = 'rsg-settings-panel-title';
    titleEl.textContent = title;
    el.appendChild(titleEl);
  }

  const cleanups = [];

  for (const row of rows) {
    const rowEl = document.createElement('div');
    rowEl.className = 'rsg-settings-row';

    if (row.type === 'toggle') {
      rowEl.innerHTML = `
        <div class="rsg-settings-toggle-row">
          <div class="rsg-settings-toggle${row.value ? ' on' : ''}" id="${row.id}"
            role="switch" aria-checked="${row.value ? 'true' : 'false'}"
            aria-label="${row.label}" tabindex="0"></div>
          <div>
            <div class="rsg-settings-row-label">${row.label}</div>
            ${row.hint ? `<div class="rsg-settings-row-hint">${row.hint}</div>` : ''}
          </div>
        </div>
      `;
      const sw = rowEl.querySelector(`#${row.id}`);
      const toggle = () => {
        const on = sw.classList.toggle('on');
        sw.setAttribute('aria-checked', on ? 'true' : 'false');
        row.onChange?.(on);
      };
      sw.addEventListener('click', toggle);
      sw.addEventListener('keydown', (e) => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); toggle(); } });
      cleanups.push(() => { sw.removeEventListener('click', toggle); });

    } else if (row.type === 'select') {
      rowEl.innerHTML = `
        <label class="rsg-settings-row-label" for="${row.id}">${row.label}</label>
        <select class="rsg-settings-select" id="${row.id}">
          ${(row.options || []).map(o => `<option value="${o.value}"${o.value === row.value ? ' selected' : ''}>${o.label}</option>`).join('')}
        </select>
        ${row.hint ? `<div class="rsg-settings-row-hint">${row.hint}</div>` : ''}
      `;
      const sel = rowEl.querySelector(`#${row.id}`);
      const handler = () => row.onChange?.(sel.value);
      sel.addEventListener('change', handler);
      cleanups.push(() => sel.removeEventListener('change', handler));

    } else if (row.type === 'slider') {
      rowEl.innerHTML = `
        <label class="rsg-settings-row-label" for="${row.id}">${row.label}</label>
        <input type="range" class="rsg-settings-slider" id="${row.id}"
          min="${row.min ?? 0}" max="${row.max ?? 1}" step="${row.step ?? 0.05}" value="${row.value ?? 0.5}">
        ${row.hint ? `<div class="rsg-settings-row-hint">${row.hint}</div>` : ''}
      `;
      const slider = rowEl.querySelector(`#${row.id}`);
      const handler = () => row.onChange?.(+slider.value);
      slider.addEventListener('input', handler);
      cleanups.push(() => slider.removeEventListener('input', handler));

    } else if (row.type === 'html') {
      rowEl.innerHTML = row.content || '';
    }

    el.appendChild(rowEl);
  }

  return {
    el,
    destroy() {
      for (const fn of cleanups) { try { fn(); } catch (_) {} }
      cleanups.length = 0;
    },
  };
}
