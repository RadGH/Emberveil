/**
 * combatMeterUI.js — extracted from CombatScreen (structural refactor).
 *
 * DPS/Heal/Mitigation meter DOM rendering and the Combat Report overlay.
 * All functions take `screen` (the CombatScreen instance) as the first
 * argument. Pure DOM and data-reads — no simulation state side-effects.
 *
 * Extracted methods:
 *   _renderMeter, _toggleMeterMode, _scheduleMeterRender, _toggleMeterVisible,
 *   _showCombatReportOverlay, _buildCombatReportHtml
 */
import { formatStat } from '../../../utils/numberFormat.js';

// ── Meter panel ──────────────────────────────────────────────────────────────

/** Re-render the live DPS/Heal/Mit meter bar rows. */
export function renderMeter(screen) {
  const panel = screen._el?.querySelector('#cbt-meter');
  if (!panel) return;
  const mode = screen._meterMode;
  const valFor = (d) => mode === 'damage' ? d.damage : mode === 'heal' ? d.heal : d.mitigation;
  const showEnemies = !!screen._meterShowEnemies;
  const rows = [...screen._meterData.values()]
    .filter(d => showEnemies || d.side !== 'enemy')
    .map(d => ({ name: d.name, val: valFor(d), side: d.side }))
    .filter(r => r.val > 0)
    .sort((a, b) => b.val - a.val);
  const max = rows.length ? rows[0].val : 1;
  const body = panel.querySelector('.meter-body');
  if (!body) return;
  if (!rows.length) {
    body.innerHTML = `<div style="opacity:0.5;font-size:11px;padding:6px 8px;">No ${mode} yet</div>`;
    return;
  }
  const baseTint = mode === 'damage' ? 'rgba(200,80,80,0.28)' : mode === 'heal' ? 'rgba(80,200,120,0.28)' : 'rgba(120,160,220,0.28)';
  const enemyTint = 'rgba(180,80,160,0.32)';
  // M272: escape r.name — hero/enemy names are player-authorable (Create Hero)
  // so an unescaped interpolation is an XSS vector. Numeric values are safe.
  const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  body.innerHTML = rows.map(r => {
    const tint = r.side === 'enemy' ? enemyTint : baseTint;
    const nameStyle = r.side === 'enemy' ? 'color:#e080c0' : '';
    const prefix = r.side === 'enemy' ? '<span style="opacity:0.75;margin-right:3px;">e:</span>' : '';
    return `<div class="meter-row"><div class="meter-bar" style="width:${Math.round(100 * r.val / max)}%;background:${tint}"></div><span class="meter-name" style="${nameStyle}">${prefix}${esc(r.name)}</span><span class="meter-val">${formatStat(r.val, 'int')}</span></div>`;
  }).join('');
}

/** M267: cycle DMG → HEAL → MIT → DMG. */
export function toggleMeterMode(screen) {
  const next = screen._meterMode === 'damage' ? 'heal' : screen._meterMode === 'heal' ? 'mitigation' : 'damage';
  screen._meterMode = next;
  const btn = screen._el?.querySelector('#cbt-meter-mode');
  if (btn) btn.textContent = next === 'damage' ? 'DMG' : next === 'heal' ? 'HEAL' : 'MIT';
  renderMeter(screen);
}

/**
 * M272: coalesce per-event meter renders to once per frame.
 * Called from _meterAdd{Damage,Heal,Mit,Dodge}; user-triggered renders
 * (mode toggle) stay synchronous via direct renderMeter() call.
 */
export function scheduleMeterRender(screen) {
  if (screen._meterRenderPending) return;
  screen._meterRenderPending = true;
  const run = () => { screen._meterRenderPending = false; renderMeter(screen); };
  if (typeof requestAnimationFrame === 'function') requestAnimationFrame(run);
  else setTimeout(run, 16);
}

/** Toggle the meter panel between visible and hidden. */
export function toggleMeterVisible(screen) {
  const panel = screen._el?.querySelector('#cbt-meter');
  if (!panel) return;
  panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
}

// ── Combat Report overlay ────────────────────────────────────────────────────

/**
 * M268: reusable Combat Report overlay — used by both Victory and Defeat.
 * Includes a "Show enemies" checkbox that re-renders the panes with
 * enemy rows interleaved (enemies appear with a small 'e:' prefix + a
 * purple-tinted bar so they're visually distinct from ally rows).
 */
export function showCombatReportOverlay(screen) {
  screen.audio.playSfx('click');
  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.9);z-index:2000;display:flex;align-items:center;justify-content:center;';
  const box = document.createElement('div');
  box.style.cssText = 'background:#140a18;border:1px solid rgba(184,127,255,0.35);border-radius:8px;padding:1.2rem;max-width:560px;width:92%;max-height:82vh;overflow-y:auto;color:#f0e8d8;';

  const rerender = (showEnemies) => {
    const body = buildCombatReportHtml(screen, { showEnemies }) || '<em>No combat data.</em>';
    box.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.8rem;gap:10px;">
        <span style="font-family:'Cinzel',serif;font-size:1rem;color:#b87fff;">Combat Report</span>
        <label style="font-size:11px;color:#e080c0;cursor:pointer;display:inline-flex;align-items:center;gap:4px;margin-left:auto;">
          <input type="checkbox" id="crpt-enemies" ${showEnemies ? 'checked' : ''} style="accent-color:#e080c0;width:13px;height:13px;margin:0;">
          Show enemies
        </label>
        <button type="button" id="crpt-download" title="Download combat report + trace" aria-label="Download combat report" style="background:none;border:1px solid rgba(240,232,216,0.3);color:#c0b090;padding:0.3rem 0.5rem;border-radius:4px;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;min-width:32px;min-height:32px;"><svg viewBox="0 0 448 512" width="14" height="14" fill="currentColor" aria-hidden="true"><path d="M64 32C28.7 32 0 60.7 0 96L0 416c0 35.3 28.7 64 64 64l320 0c35.3 0 64-28.7 64-64l0-242.7c0-17-6.7-33.3-18.7-45.3L352 50.7C340 38.7 323.7 32 306.7 32L64 32zm0 96c0-17.7 14.3-32 32-32l192 0c17.7 0 32 14.3 32 32l0 64c0 17.7-14.3 32-32 32L96 224c-17.7 0-32-14.3-32-32l0-64zM224 288a64 64 0 1 1 0 128 64 64 0 1 1 0-128z"/></svg></button>
        <button type="button" id="crpt-close" style="background:none;border:1px solid rgba(240,232,216,0.3);color:#c0b090;padding:0.25rem 0.6rem;border-radius:4px;cursor:pointer">Close</button>
      </div>
      ${body}
    `;
    box.querySelector('#crpt-close').onclick = () => overlay.remove();
    // M419 — download button: same payload as Save Trace, plus per-actor meter rows
    box.querySelector('#crpt-download').onclick = () => {
      try {
        const meter = [...screen._meterData.values()].map(d => ({
          name: d.name, side: d.side, damage: d.damage, heal: d.heal, mitigation: d.mitigation, hits: d.hits || 0,
          bySource: d.bySource || null,
        }));
        const trace = {
          version: 1,
          generated: new Date().toISOString(),
          encounter: screen.encounter ? { id: screen.encounter.id, name: screen.encounter.name } : null,
          rounds: screen._round || 1,
          log: screen._log,
          meter,
          party: (screen._allies || []).map(a => ({ name: a.name, cls: a.cls || a.class, level: a.level, maxHp: a.maxHp })),
          enemies: (screen._enemies || []).map(e => ({ name: e.name, maxHp: e.maxHp || e.hp })),
        };
        const blob = new Blob([JSON.stringify(trace, null, 2)], { type: 'application/json' });
        const url  = URL.createObjectURL(blob);
        const a    = document.createElement('a');
        a.href = url;
        a.download = `combat-report-${Date.now()}.json`;
        a.click();
        URL.revokeObjectURL(url);
      } catch (err) { console.error('[CombatScreen] Combat report download failed:', err); }
    };
    box.querySelector('#crpt-enemies').addEventListener('change', (e) => rerender(e.target.checked));
    // Tab switching for DAMAGE / HEALS / MITIGATION panes.
    const tabs = box.querySelectorAll('.crpt-tab');
    const panes = box.querySelectorAll('.crpt-pane');
    tabs.forEach(t => t.addEventListener('click', () => {
      const mode = t.dataset.crptTab;
      tabs.forEach(tb => {
        const active = tb.dataset.crptTab === mode;
        tb.classList.toggle('active', active);
        const color = tb.dataset.crptTab === 'damage' ? 'rgba(200,80,80' : tb.dataset.crptTab === 'heal' ? 'rgba(80,200,120' : 'rgba(120,160,220';
        tb.style.background = `${color},${active ? '0.15' : '0.08'})`;
        tb.style.borderColor = `${color},${active ? '0.4' : '0.25'})`;
      });
      panes.forEach(p => { p.style.display = p.dataset.crptPane === mode ? 'block' : 'none'; });
    }));
  };

  rerender(false);
  overlay.appendChild(box);
  document.body.appendChild(overlay);
}

/** Build the inner HTML for the Combat Report overlay. */
export function buildCombatReportHtml(screen, { showEnemies = false } = {}) {
  // M272: shared HTML-escape — names, skill sources, and targets are all
  // potentially player-authorable (hero names, companion names) and must
  // be escaped before innerHTML interpolation below.
  const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const all = [...screen._meterData.values()];
  const rows = all.filter(d => showEnemies || d.side !== 'enemy').sort((a, b) => b.damage - a.damage);
  if (!rows.length) return '';
  const totalDmg  = rows.reduce((s, d) => s + d.damage, 0);
  const totalHeal = rows.reduce((s, d) => s + d.heal, 0);
  const totalMit  = rows.reduce((s, d) => s + d.mitigation, 0);
  const rounds = screen._round || 1;

  const topSummary = `
    <div style="display:grid;grid-template-columns:repeat(5,1fr);gap:10px;background:rgba(160,80,255,0.08);border:1px solid rgba(160,80,255,0.2);border-radius:6px;padding:10px 12px;margin-bottom:14px;">
      <div><div style="font-size:10px;opacity:0.7;">ROUNDS</div><div style="font-weight:700;color:#ffd060;font-size:18px;">${rounds}</div></div>
      <div><div style="font-size:10px;opacity:0.7;">TOTAL DMG</div><div style="font-weight:700;color:#ff8060;font-size:18px;">${formatStat(totalDmg, 'int')}</div></div>
      <div><div style="font-size:10px;opacity:0.7;">TOTAL HEAL</div><div style="font-weight:700;color:#60e880;font-size:18px;">${formatStat(totalHeal, 'int')}</div></div>
      <div><div style="font-size:10px;opacity:0.7;">MITIGATED</div><div style="font-weight:700;color:#80a0e0;font-size:18px;">${formatStat(totalMit, 'int')}</div></div>
      <div><div style="font-size:10px;opacity:0.7;">AVG DPS</div><div style="font-weight:700;color:#ffd060;font-size:18px;">${formatStat(totalDmg / rounds, 'int')}</div></div>
    </div>`;

  const tabBar = `
    <div style="display:flex;gap:6px;margin-bottom:10px;border-bottom:1px solid rgba(184,127,255,0.2);padding-bottom:6px;">
      <button type="button" class="crpt-tab active" data-crpt-tab="damage" style="background:rgba(200,80,80,0.15);border:1px solid rgba(200,80,80,0.4);color:#ff8060;padding:4px 12px;border-radius:4px;cursor:pointer;font-size:11px;font-weight:700;letter-spacing:0.08em;">DAMAGE</button>
      <button type="button" class="crpt-tab" data-crpt-tab="heal" style="background:rgba(80,200,120,0.08);border:1px solid rgba(80,200,120,0.25);color:#60e880;padding:4px 12px;border-radius:4px;cursor:pointer;font-size:11px;font-weight:700;letter-spacing:0.08em;">HEALS</button>
      <button type="button" class="crpt-tab" data-crpt-tab="mitigation" style="background:rgba(120,160,220,0.08);border:1px solid rgba(120,160,220,0.25);color:#80a0e0;padding:4px 12px;border-radius:4px;cursor:pointer;font-size:11px;font-weight:700;letter-spacing:0.08em;">MITIGATION</button>
    </div>`;

  const buildPaneFor = (mode) => {
    const rowsForMode = all
      .filter(d => showEnemies || d.side !== 'enemy')
      .map(d => ({
        name: d.name,
        side: d.side,
        total: mode === 'damage' ? d.damage : mode === 'heal' ? d.heal : d.mitigation,
        sources: mode === 'damage' ? d.sources : mode === 'heal' ? d.healSources : d.mitSources,
        hits: d.hits,
      }))
      .sort((a, b) => b.total - a.total);
    const grand = rowsForMode.reduce((s, r) => s + r.total, 0) || 1;
    const color = mode === 'damage' ? '#ff8060' : mode === 'heal' ? '#60e880' : '#80a0e0';
    const barTint = mode === 'damage' ? 'rgba(200,80,80,0.2)' : mode === 'heal' ? 'rgba(80,200,120,0.2)' : 'rgba(120,160,220,0.2)';

    const charRows = rowsForMode.map((r, idx) => {
      if (r.total <= 0 && Object.keys(r.sources).length === 0) {
        return `<details style="margin-bottom:6px;background:rgba(0,0,0,0.2);border:1px solid rgba(240,232,216,0.06);border-radius:6px;">
          <summary style="padding:7px 12px;cursor:pointer;list-style:none;display:flex;align-items:center;gap:10px;opacity:0.5;">
            <span style="flex:1;font-weight:600;font-size:12px;">${esc(r.name)}</span>
            <span style="font-size:11px;">no ${mode}</span>
          </summary>
        </details>`;
      }
      const pctGrand = Math.round(100 * r.total / grand);
      const sources = Object.entries(r.sources).sort((a, b) => b[1] - a[1]);
      const sourcesHtml = sources.map(([srcName, srcVal]) => {
        const pctSelf = r.total ? Math.round(100 * srcVal / r.total) : 0;
        const srcHits = (r.hits || []).filter(h => {
          const matchKind = mode === 'damage' ? h.kind === 'dmg' : mode === 'heal' ? h.kind === 'heal' : (h.kind === 'mit' || h.kind === 'dodge');
          return matchKind && h.source === srcName;
        });
        const isCount = srcName === 'Dodge (count)';
        const displayVal = isCount ? `${srcVal}x` : formatStat(srcVal, 'int');
        const hitRowsHtml = srcHits.slice(-40).reverse().map(h => {
          const isCritEv = h.crit;
          const critTag = isCritEv ? ` <span style="color:#ffd060;font-weight:700;">CRIT</span>` : '';
          const overTag = h.overkill > 0 ? ` <span style="opacity:0.7;color:#ff8060;">+${h.overkill} overkill</span>` : '';
          const ohTag = h.overheal > 0 ? ` <span style="opacity:0.6;">(${h.overheal} overheal)</span>` : '';
          const mitTag = h.mitigated > 0 ? ` <span style="opacity:0.6;">(${h.mitigated} also mitigated)</span>` : '';
          const prefix = mode === 'heal' ? '+' : '';
          const amtCell = h.kind === 'dodge' ? 'DODGE' : `${prefix}${formatStat(h.amt, 'int')}`;
          return `<tr>
            <td style="padding:2px 6px;opacity:0.6;width:36px;">R${h.round ?? '?'}</td>
            <td style="padding:2px 6px;opacity:0.8;">→ ${esc(h.target || '—')}</td>
            <td style="padding:2px 6px;text-align:right;color:${color};font-weight:700;white-space:nowrap;">${amtCell}${critTag}${overTag}${ohTag}${mitTag}</td>
          </tr>`;
        }).join('');
        return `
          <details class="crpt-src" style="margin-bottom:4px;background:rgba(0,0,0,0.2);border-radius:4px;">
            <summary style="padding:5px 10px;cursor:pointer;list-style:none;display:flex;align-items:center;gap:8px;font-size:11px;">
              <span style="flex:1;color:${color};">${esc(srcName)}</span>
              <span style="opacity:0.6;">${srcHits.length} hit${srcHits.length === 1 ? '' : 's'}</span>
              <span style="font-weight:700;color:${color};min-width:55px;text-align:right;">${displayVal}</span>
              <span style="opacity:0.6;font-size:10px;min-width:32px;text-align:right;">${pctSelf}%</span>
            </summary>
            <div style="padding:4px 10px 8px;">
              <table style="width:100%;font-size:10.5px;">
                ${hitRowsHtml || '<tr><td style="padding:4px;opacity:0.5;">no individual hit records</td></tr>'}
              </table>
            </div>
          </details>`;
      }).join('');

      const nameColor = r.side === 'enemy' ? '#e080c0' : '#ffd060';
      const enemyPrefix = r.side === 'enemy' ? '<span style="font-size:10px;opacity:0.75;margin-right:5px;background:rgba(180,80,160,0.25);padding:1px 5px;border-radius:3px;letter-spacing:0.1em;">ENEMY</span>' : '';
      const rowBarTint = r.side === 'enemy' ? 'rgba(180,80,160,0.22)' : barTint;
      return `
        <details ${idx === 0 ? 'open' : ''} style="margin-bottom:8px;background:rgba(0,0,0,0.28);border:1px solid rgba(240,232,216,0.08);border-radius:6px;">
          <summary style="padding:8px 12px;cursor:pointer;list-style:none;display:flex;align-items:center;gap:10px;position:relative;">
            <div style="position:absolute;left:0;top:0;bottom:0;width:${pctGrand}%;background:${rowBarTint};border-radius:6px;pointer-events:none;"></div>
            <span style="position:relative;flex:1;font-weight:700;color:${nameColor};font-size:13px;">${enemyPrefix}${esc(r.name)}</span>
            <span style="position:relative;color:${color};font-weight:700;font-size:13px;">${formatStat(r.total, 'int')}</span>
            <span style="position:relative;opacity:0.6;font-size:11px;min-width:36px;text-align:right;">${pctGrand}%</span>
          </summary>
          <div style="padding:0 10px 10px;">${sourcesHtml || '<div style="padding:6px;opacity:0.5;font-size:11px;">—</div>'}</div>
        </details>`;
    }).join('');

    return `<div class="crpt-pane" data-crpt-pane="${mode}" style="display:${mode === 'damage' ? 'block' : 'none'};">${charRows}</div>`;
  };

  const damagePane = buildPaneFor('damage');
  const healPane   = buildPaneFor('heal');
  const mitPane    = buildPaneFor('mitigation');

  return topSummary + tabBar + damagePane + healPane + mitPane;
}
