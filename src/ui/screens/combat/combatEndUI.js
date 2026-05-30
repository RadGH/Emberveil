/**
 * combatEndUI.js — extracted from CombatScreen (structural refactor).
 *
 * Post-fight overlay helpers: combat log viewer and parity debug notice.
 * These are pure DOM builders — no simulation state side-effects.
 * All functions take `screen` (the CombatScreen instance) as the first argument.
 *
 * Extracted methods: _showCombatLogOverlay, _appendCombatDebugNotice
 *
 * NOTE: _victory, _showVictoryModal, _showBossDeathCinematic, _defeat remain
 * in CombatScreen.js — they carry complex GameState mutation flows whose
 * extraction risk exceeds the navigability benefit at this stage.
 */
import { combatDebug } from '../../../utils/combatDebug.js';
import { wrapMitigationTags, attachMitTooltips, attachDmgBreakdownTooltips } from '../../components/StatColors.js';

/**
 * M377 — Inserts a small parity-mismatch notice + Copy button into a
 * given combat end modal. Triggered when combatDebug fired any
 * parity_warning events at end of fight.
 */
export function appendCombatDebugNotice(modal) {
  const box = modal.querySelector('.cem-box') || modal;
  const notice = document.createElement('div');
  notice.style.cssText = 'margin-top:0.6rem;padding:0.5rem 0.6rem;background:rgba(192,64,48,0.18);border:1px solid rgba(192,64,48,0.55);border-radius:4px;color:#e8b090;font-size:0.7rem;line-height:1.35;text-align:left';
  notice.innerHTML = `
    <div style="font-weight:700;color:#e8a020;margin-bottom:0.25rem">&#9888; Combat parity mismatch</div>
    <div>Damage Meter, Combat Log, and Combat Report disagree by &gt;5%. Open the browser console for the full <code>cbt-dbg</code> trace.</div>
    <button type="button" id="cem-copy-debug" style="margin-top:0.4rem;width:100%;background:rgba(232,160,32,0.18);border:1px solid rgba(232,160,32,0.5);color:#e8a020;padding:0.4rem 0.6rem;border-radius:3px;font:inherit;font-size:0.7rem;letter-spacing:0.06em;text-transform:uppercase;cursor:pointer">Copy Debug Log</button>
    <span id="cem-copy-status" style="display:block;margin-top:0.3rem;font-size:0.65rem;color:#a08070"></span>
  `;
  box.appendChild(notice);
  const status = notice.querySelector('#cem-copy-status');
  notice.querySelector('#cem-copy-debug')?.addEventListener('click', () => {
    try {
      const text = JSON.stringify(combatDebug.buffer, null, 2);
      if (navigator?.clipboard?.writeText) {
        navigator.clipboard.writeText(text).then(
          () => { if (status) status.textContent = `Copied ${combatDebug.buffer.length} events to clipboard.`; },
          () => { if (status) status.textContent = 'Clipboard blocked — see window.__combatDebug.buffer'; },
        );
      } else {
        if (status) status.textContent = 'Clipboard unavailable — see window.__combatDebug.buffer';
      }
    } catch (e) {
      if (status) status.textContent = 'Copy failed — see console';
      // eslint-disable-next-line no-console
      console.warn('[combatDebug] copy failed', e);
    }
  });
}

/**
 * M268: extracted combat-log overlay so both victory and defeat can share it.
 */
export function showCombatLogOverlay(screen) {
  screen.audio.playSfx('click');
  const _escLog = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.9);z-index:2000;display:flex;align-items:center;justify-content:center;';
  const logContainer = document.createElement('div');
  logContainer.style.cssText = 'background:#140a18;border:1px solid rgba(240,232,216,0.2);border-radius:8px;padding:1.2rem;max-width:540px;width:90%;max-height:80vh;overflow-y:auto;font-family:monospace;font-size:0.78rem;color:#c0b090';
  const header = document.createElement('div');
  header.style.cssText = "display:flex;justify-content:space-between;margin-bottom:0.5rem;font-family:'Cinzel',serif;font-size:1rem;color:#e8a020";

  // M301 Task 9: "Save trace" button — serialises the in-memory log to JSON
  // and triggers a download via a blob URL. No repo persistence.
  // M419 — floppy-disk download icon, smaller, no text
  const saveTraceBtn = document.createElement('button');
  saveTraceBtn.type = 'button';
  saveTraceBtn.title = 'Download combat trace as JSON';
  saveTraceBtn.setAttribute('aria-label', 'Download combat trace');
  saveTraceBtn.innerHTML = '<svg viewBox="0 0 448 512" width="14" height="14" fill="currentColor" aria-hidden="true"><path d="M64 32C28.7 32 0 60.7 0 96L0 416c0 35.3 28.7 64 64 64l320 0c35.3 0 64-28.7 64-64l0-242.7c0-17-6.7-33.3-18.7-45.3L352 50.7C340 38.7 323.7 32 306.7 32L64 32zm0 96c0-17.7 14.3-32 32-32l192 0c17.7 0 32 14.3 32 32l0 64c0 17.7-14.3 32-32 32L96 224c-17.7 0-32-14.3-32-32l0-64zM224 288a64 64 0 1 1 0 128 64 64 0 1 1 0-128z"/></svg>';
  saveTraceBtn.style.cssText = 'background:none;border:1px solid rgba(240,232,216,0.3);color:#c0b090;padding:0.3rem 0.5rem;border-radius:4px;cursor:pointer;margin-right:0.5rem;display:inline-flex;align-items:center;justify-content:center;min-width:32px;min-height:32px;';
  saveTraceBtn.addEventListener('click', () => {
    try {
      const trace = {
        version: 1,
        generated: new Date().toISOString(),
        encounter: screen.encounter ? { id: screen.encounter.id, name: screen.encounter.name } : null,
        log: screen._log,
        party:   (screen._allies  || []).map(a => ({ name: a.name, cls: a.cls || a.class, level: a.level, maxHp: a.maxHp })),
        enemies: (screen._enemies || []).map(e => ({ name: e.name, maxHp: e.maxHp || e.hp })),
      };
      const blob = new Blob([JSON.stringify(trace, null, 2)], { type: 'application/json' });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href = url;
      a.download = `combat-trace-${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('[CombatScreen] Save trace failed:', err);
    }
  });

  header.innerHTML = '<span>Combat Log</span>';
  header.appendChild(saveTraceBtn);

  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.id = 'clog-close';
  closeBtn.textContent = 'Close';
  closeBtn.style.cssText = 'background:none;border:1px solid rgba(240,232,216,0.3);color:#c0b090;padding:0.25rem 0.6rem;border-radius:4px;cursor:pointer';
  header.appendChild(closeBtn);

  logContainer.appendChild(header);

  if (!screen._log.length) {
    logContainer.insertAdjacentHTML('beforeend', '<em>No entries.</em>');
  } else {
    for (const l of screen._log) {
      const color = l.type === 'death' ? '#e06040' : l.type === 'hero' ? '#80c0ff' : l.type === 'enemy' ? '#e0a060' : '#c0b090';
      const row = document.createElement('div');
      row.style.cssText = `margin:0.15rem 0;color:${color}`;
      row.innerHTML = wrapMitigationTags(_escLog(l.msg ?? l.text ?? ''));
      if (l.breakdown) {
        row.classList.add('has-breakdown');
        row.dataset.breakdown = JSON.stringify(l.breakdown);
      }
      logContainer.appendChild(row);
    }
  }

  overlay.appendChild(logContainer);
  overlay.querySelector('#clog-close').onclick = () => overlay.remove();
  document.body.appendChild(overlay);
  attachMitTooltips(overlay);
  attachDmgBreakdownTooltips(overlay);
}
