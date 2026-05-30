/**
 * StatsScreen — full-screen statistics viewer.
 *
 * Tabs:
 *   Party      — per-character stats + per-character story log + DPS chart
 *   Lifetime   — cross-session totals + run history
 *   Achievements — registry with unlock state
 *
 * Reachable from PartyScreen (button), MapScreen pause menu, and TitleScreen
 * for cross-session view.
 */

import { createEl, removeEl, injectStyles } from '../../utils/dom.js';
import { mount as kbMount, unmount as kbUnmount } from '../../utils/keyboardNav.js';
import { GameState } from '../../game/gameState.js';
import { ensureStats, getCharStats, getCharLog, getDpsSeries, getLifeStats } from '../../game/stats.js';
import { ACHIEVEMENTS, getAchievementsState } from '../../game/achievements.js';
import { drawLineChart } from '../components/LineChart.js';
import { portraitImg } from '../../game/spriteUtils.js';

export class StatsScreen {
  constructor(manager, audio, opts = {}) {
    this.manager = manager;
    this.audio = audio;
    // M312 #20: opt out of global ESC→GameMenu; handle Escape ourselves (pop).
    this.noGameMenuEsc = true;
    this._tab = opts.tab || 'party';
    this._selectedCharId = null;
    this._filterLog = 'all';
    this._lifetimeOnly = !!opts.lifetimeOnly; // when launched from TitleScreen
  }

  onEnter() {
    ensureStats();
    injectStyles('stats-styles', STATS_STYLES);
    this._el = createEl('div', 'stats-screen');
    document.body.appendChild(this._el);
    if (this._lifetimeOnly) this._tab = 'lifetime';
    this._render();
  }
  onExit() { if (this._el) kbUnmount(this._el); removeEl(this._el); this._el = null; }
  destroy() { if (this._el) kbUnmount(this._el); removeEl(this._el); this._el = null; }
  update() {} draw() {}

  _render() {
    const tabs = this._lifetimeOnly
      ? [['lifetime','Lifetime'],['achievements','Achievements']]
      : [['party','Party'],['lifetime','Lifetime'],['achievements','Achievements']];
    // M402 — surface persistence health: show when lifetime stats were last
    // written to localStorage. If this is empty or stale, the user knows
    // their stats aren't being saved (instead of silently losing them).
    const life = getLifeStats();
    let savedLine = 'Last saved: never';
    if (life?.savedAt) {
      const d = new Date(life.savedAt);
      const hh = String(d.getHours()).padStart(2, '0');
      const mm = String(d.getMinutes()).padStart(2, '0');
      const ss = String(d.getSeconds()).padStart(2, '0');
      savedLine = `Last saved: ${d.toISOString().slice(0,10)} ${hh}:${mm}:${ss}`;
    }
    this._el.innerHTML = `
      <div class="st-header">
        <div class="st-title">Statistics</div>
        <div class="st-tabs">
          ${tabs.map(([k,l]) => `<button class="st-tab${this._tab===k?' active':''}" data-tab="${k}">${l}</button>`).join('')}
        </div>
        <button class="st-close" id="st-close">✕ Close</button>
      </div>
      <div class="st-saved-at" style="font-size:11px;opacity:0.6;padding:2px 12px;text-align:right;">${savedLine}</div>
      <div class="st-body" id="st-body">${this._renderTab()}</div>
    `;
    this._el.querySelector('#st-close').addEventListener('click', () => { this.audio.playSfx('click'); this.manager.pop(); });
    this._el.querySelectorAll('.st-tab').forEach(b => b.addEventListener('click', () => {
      this.audio.playSfx('click'); this._tab = b.dataset.tab; this._render();
    }));
    this._postRender();

    // M297: keyboard navigation.
    kbUnmount(this._el);
    kbMount(this._el, {
      layout: 'vertical',
      focusFirst: false,
      onEscape: () => { this.audio.playSfx('click'); this.manager.pop(); },
    });
  }

  _renderTab() {
    if (this._tab === 'party') return this._renderParty();
    if (this._tab === 'lifetime') return this._renderLifetime();
    if (this._tab === 'achievements') return this._renderAchievements();
    return '';
  }

  _renderParty() {
    const gs = GameState.get();
    const members = [...(gs.party || []), ...(gs.companions || [])];
    if (!members.length) return `<div class="st-empty">No party members yet.</div>`;
    if (!this._selectedCharId || !members.find(m => m.id === this._selectedCharId)) {
      this._selectedCharId = members[0].id;
    }
    const sel = members.find(m => m.id === this._selectedCharId);
    const cs = getCharStats(sel.id);
    const log = getCharLog(sel.id);
    const filtered = this._filterLog === 'all' ? log : log.filter(e => e.type === this._filterLog);
    // M415 — recent combats this character was in (newest first, last 15).
    const allCombats = (ensureStats().combatHistory || []);
    const myCombats = allCombats
      .filter(c => (c.perChar || []).some(r => r.id === sel.id))
      .slice(-15).reverse();

    return `
      <div class="st-party-grid">
        <div class="st-roster">
          ${members.map(m => `
            <button class="st-roster-row${m.id===this._selectedCharId?' active':''}" data-char="${m.id}">
              <span class="st-roster-portrait">${portraitImg(m, 36, 'st-portrait')}</span>
              <span class="st-roster-name">
                <span class="rn">${m.name}</span>
                <span class="rc">${m.cls || m.class || 'companion'} · L${m.level || 1}</span>
              </span>
              <span class="st-roster-kills">${getCharStats(m.id).kills}<span class="lk">k</span></span>
            </button>
          `).join('')}
        </div>
        <div class="st-detail">
          <div class="st-detail-head">
            <div class="st-detail-name">${sel.name} <span class="st-detail-class">— ${sel.cls || sel.class || ''} L${sel.level || 1}</span></div>
          </div>
          <div class="st-stat-grid">
            ${this._statCell('Damage Dealt', cs.damageDealt)}
            ${this._statCell('Damage Taken', cs.damageTaken)}
            ${this._statCell('Kills', cs.kills)}
            ${this._statCell('Crits', cs.crits)}
            ${this._statCell('Heals Given', cs.heals)}
            ${this._statCell('Heals Received', cs.healsReceived)}
            ${this._statCell('Most Damage Hit', cs.mostDamageHit)}
            ${this._statCell('Longest Streak', cs.longestKillStreak)}
            ${this._statCell('Near-Deaths', cs.nearDeaths)}
            ${this._statCell('Deaths', cs.deaths)}
            ${this._statCell('Dodges', cs.dodges)}
            ${this._statCell('Blocks', cs.blocks)}
            ${this._statCell('Fights Won', cs.fightsWon)}
            ${this._statCell('Fights Lost', cs.fightsLost)}
          </div>
          <div class="st-section-title">DPS over time (this run)</div>
          <div class="st-chart-wrap"><canvas id="st-dps-chart" class="st-chart"></canvas></div>
          <div class="st-section-title">Recent Combats (this run)</div>
          <div class="st-combat-history">
            ${myCombats.length ? myCombats.map(c => {
              const me = (c.perChar || []).find(r => r.id === sel.id);
              if (!me) return '';
              const when = new Date(c.ts).toLocaleString();
              const result = c.won ? '<span class="ch-win">Win</span>' : '<span class="ch-loss">Loss</span>';
              const mvpTag = me.mvp ? '<span class="ch-mvp">MVP</span>' : '';
              return `
                <div class="st-ch-row">
                  <div class="ch-meta">${result}${mvpTag}<span class="ch-zone">${c.zoneId || '—'}</span><span class="ch-time">${when} · ${c.durationSec}s</span></div>
                  <div class="ch-stats">
                    <span><b>${this._fmt(me.dmgDealt)}</b> dmg</span>
                    <span><b>${this._fmt(me.dmgTaken)}</b> taken</span>
                    <span><b>${this._fmt(me.heals)}</b> healed</span>
                    <span><b>${me.kills}</b> kills</span>
                    ${me.deaths ? `<span class="ch-died">died ${me.deaths}×</span>` : ''}
                  </div>
                </div>`;
            }).join('') : '<div class="st-empty">No combats logged yet.</div>'}
          </div>
          <div class="st-section-title">Story Log
            <select class="st-filter" id="st-log-filter">
              <option value="all"${this._filterLog==='all'?' selected':''}>all</option>
              <option value="major_kill"${this._filterLog==='major_kill'?' selected':''}>major kills</option>
              <option value="elite_kill"${this._filterLog==='elite_kill'?' selected':''}>elites</option>
              <option value="near_death"${this._filterLog==='near_death'?' selected':''}>near-deaths</option>
              <option value="death"${this._filterLog==='death'?' selected':''}>deaths</option>
              <option value="story"${this._filterLog==='story'?' selected':''}>story</option>
            </select>
          </div>
          <div class="st-log">
            ${filtered.length ? filtered.map(e => `
              <div class="st-log-row" data-type="${e.type}">
                <span class="st-log-tag">${this._logTagLabel(e.type)}</span>
                <span class="st-log-text">${e.summary}</span>
                <span class="st-log-meta">${e.zoneId || ''}</span>
              </div>
            `).join('') : `<div class="st-empty">No entries.</div>`}
          </div>
        </div>
      </div>
    `;
  }

  _statCell(label, value) {
    return `<div class="st-cell"><div class="st-cell-label">${label}</div><div class="st-cell-value">${this._fmt(value)}</div></div>`;
  }
  _fmt(v) {
    if (typeof v !== 'number') return String(v);
    if (v >= 1000000) return (v / 1000000).toFixed(1) + 'M';
    if (v >= 1000) return (v / 1000).toFixed(1) + 'k';
    return Math.round(v).toString();
  }
  _logTagLabel(t) {
    if (t === 'major_kill') return 'Boss';
    if (t === 'elite_kill') return 'Elite';
    if (t === 'near_death') return 'Near Death';
    if (t === 'death') return 'Fell';
    if (t === 'story') return 'Story';
    return t;
  }

  _renderLifetime() {
    const life = getLifeStats();
    const g = life.global || {};
    const history = (life.runHistory || []).slice(0, 20);
    return `
      <div class="st-lifetime">
        <div class="st-section-title">Lifetime totals (across all runs)</div>
        <div class="st-stat-grid">
          ${this._statCell('Total Kills', g.totalKills || 0)}
          ${this._statCell('Total Damage', g.totalDamage || 0)}
          ${this._statCell('Total Heals', g.totalHeals || 0)}
          ${this._statCell('Fights Won', g.fightsWon || 0)}
          ${this._statCell('Fights Lost', g.fightsLost || 0)}
          ${this._statCell('Perfect Wins', g.perfectVictories || 0)}
          ${this._statCell('Gold Earned', g.totalGoldEarned || 0)}
          ${this._statCell('Gold Spent', g.totalGoldSpent || 0)}
          ${this._statCell('XP Gained', g.totalXp || 0)}
          ${this._statCell('Runs Started', g.runsStarted || 0)}
          ${this._statCell('Runs Completed', g.runsCompleted || 0)}
          ${this._statCell('Hardcore Deaths', g.hardcoreDeaths || 0)}
        </div>
        <div class="st-section-title">Run history</div>
        ${history.length ? `
          <div class="st-runlist">
            ${history.map(r => `
              <div class="st-run-row">
                <span class="st-run-date">${new Date(r.startedAt).toISOString().slice(0,10)}</span>
                <span class="st-run-label">${r.label || 'Run'}</span>
                <span class="st-run-kpi">${(r.global?.totalKills || 0)} kills</span>
                <span class="st-run-kpi">${this._fmt(r.global?.totalDamage || 0)} dmg</span>
                <span class="st-run-kpi">${(r.global?.fightsWon || 0)}-${(r.global?.fightsLost || 0)}</span>
              </div>
            `).join('')}
          </div>
        ` : `<div class="st-empty">No completed runs archived yet.</div>`}
      </div>
    `;
  }

  _renderAchievements() {
    const { current, life } = getAchievementsState();
    const total = ACHIEVEMENTS.length;
    const unlocked = ACHIEVEMENTS.filter(a => current[a.id]?.unlocked || life[a.id]?.unlocked).length;
    return `
      <div class="st-ach">
        <div class="st-section-title">Achievements <span class="st-progress">${unlocked} / ${total}</span></div>
        <div class="st-ach-grid">
          ${ACHIEVEMENTS.map(a => {
            const lifeUn = !!life[a.id]?.unlocked;
            const runUn = !!current[a.id]?.unlocked;
            const un = lifeUn || runUn;
            return `
              <div class="st-ach-card${un?' un':''} t-${a.tier}">
                <div class="st-ach-tier">${a.tier.toUpperCase()}</div>
                <div class="st-ach-name">${a.name}</div>
                <div class="st-ach-desc">${a.desc}</div>
                <div class="st-ach-status">${un ? '★ Unlocked' : 'Locked'}</div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;
  }

  _postRender() {
    if (this._tab === 'party') {
      // Roster click
      this._el.querySelectorAll('.st-roster-row').forEach(b => b.addEventListener('click', () => {
        this.audio.playSfx('click'); this._selectedCharId = b.dataset.char; this._render();
      }));
      const filt = this._el.querySelector('#st-log-filter');
      if (filt) filt.addEventListener('change', () => { this._filterLog = filt.value; this._render(); });
      // Chart
      const canvas = this._el.querySelector('#st-dps-chart');
      if (canvas && this._selectedCharId) {
        // Wait a frame so the canvas has its layout box.
        requestAnimationFrame(() => {
          const series = getDpsSeries(this._selectedCharId, 5);
          drawLineChart(canvas, series, { xKey: 't', yKey: 'dps', color: '#e8a020', emptyLabel: 'No combat damage logged this run.' });
        });
      }
    }
  }
}

const STATS_STYLES = `
.stats-screen { position: absolute; inset: 0; display: flex; flex-direction: column; background: linear-gradient(180deg,#0a0608,#120a10); color: #f0e8d8; font-family: 'Inter', sans-serif; z-index: 100; }
.st-header { display: flex; align-items: center; gap: 0.75rem; padding: 0.6rem 1rem; border-bottom: 1px solid rgba(232,160,32,0.18); background: rgba(0,0,0,0.35); flex-shrink: 0; }
.st-title { font-family: 'Cinzel', serif; font-weight: 900; letter-spacing: 0.15em; color: #e8a020; font-size: 1rem; text-transform: uppercase; flex-shrink: 0; }
.st-tabs { display: flex; gap: 0.4rem; flex: 1; flex-wrap: wrap; }
.st-tab { background: transparent; border: 1px solid rgba(232,160,32,0.2); color: #8a7a6a; padding: 0.35rem 0.75rem; font-size: 0.72rem; letter-spacing: 0.08em; text-transform: uppercase; border-radius: 4px; cursor: pointer; min-height: 36px; }
.st-tab.active { background: rgba(232,160,32,0.14); color: #e8a020; border-color: rgba(232,160,32,0.5); }
.st-close { background: none; border: none; color: #8a7a6a; cursor: pointer; font-size: 0.78rem; padding: 0.4rem 0.6rem; min-height: 36px; }
.st-close:hover { color: #f0e8d8; }
.st-body { flex: 1; overflow-y: auto; padding: 0.75rem 1rem; }
.st-empty { padding: 2rem; text-align: center; color: #4a3a32; font-size: 0.85rem; }
.st-section-title { font-family: 'Cinzel', serif; color: #c0a070; font-size: 0.78rem; letter-spacing: 0.12em; text-transform: uppercase; margin: 1rem 0 0.5rem; display: flex; justify-content: space-between; align-items: center; }
.st-progress { color: #8a7a6a; font-weight: 400; font-family: 'JetBrains Mono', monospace; }
.st-filter { background: #0a0608; border: 1px solid rgba(232,160,32,0.25); color: #f0e8d8; font-size: 0.72rem; padding: 2px 6px; border-radius: 3px; }

/* Party tab */
.st-party-grid { display: grid; grid-template-columns: 240px 1fr; gap: 0.75rem; }
@media (max-width: 720px) { .st-party-grid { grid-template-columns: 1fr; } }
.st-roster { display: flex; flex-direction: column; gap: 4px; }
.st-roster-row { display: flex; align-items: center; gap: 0.5rem; padding: 0.4rem 0.5rem; background: rgba(26,18,24,0.6); border: 1px solid rgba(232,160,32,0.1); border-radius: 6px; cursor: pointer; min-height: 50px; text-align: left; color: #c0b090; }
.st-roster-row.active { border-color: rgba(232,160,32,0.5); background: rgba(232,160,32,0.08); }
.st-roster-portrait { width: 36px; height: 36px; flex-shrink: 0; display: inline-flex; align-items: center; justify-content: center; border-radius: 4px; overflow: hidden; background: rgba(255,255,255,0.04); }
.st-roster-name { flex: 1; min-width: 0; display: flex; flex-direction: column; line-height: 1.1; }
.st-roster-name .rn { font-size: 0.78rem; font-weight: 600; color: #f0e8d8; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.st-roster-name .rc { font-size: 0.62rem; color: #8a7a6a; text-transform: uppercase; letter-spacing: 0.06em; }
.st-roster-kills { color: #e8a020; font-family: 'JetBrains Mono', monospace; font-size: 0.85rem; font-weight: 700; }
.st-roster-kills .lk { color: #8a7a6a; font-size: 0.65rem; margin-left: 1px; }
.st-detail { background: rgba(26,18,24,0.55); border: 1px solid rgba(232,160,32,0.12); border-radius: 8px; padding: 0.75rem 1rem; }
.st-detail-name { font-family: 'Cinzel', serif; font-size: 1rem; font-weight: 700; color: #e8a020; }
.st-detail-class { color: #8a7a6a; font-weight: 400; font-family: 'Inter', sans-serif; font-size: 0.78rem; letter-spacing: 0.06em; text-transform: uppercase; }
.st-stat-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(120px, 1fr)); gap: 6px; margin-top: 0.5rem; }
.st-cell { background: rgba(0,0,0,0.3); border: 1px solid rgba(232,160,32,0.08); border-radius: 4px; padding: 6px 8px; }
.st-cell-label { font-size: 0.62rem; color: #8a7a6a; text-transform: uppercase; letter-spacing: 0.08em; }
.st-cell-value { font-family: 'JetBrains Mono', monospace; font-size: 1rem; color: #f0e8d8; font-weight: 600; }
.st-chart-wrap { background: #0a0608; border: 1px solid rgba(232,160,32,0.12); border-radius: 6px; height: 200px; padding: 4px; }
.st-chart { width: 100%; height: 100%; display: block; }
.st-log { display: flex; flex-direction: column; gap: 4px; max-height: 360px; overflow-y: auto; }
.st-log-row { display: flex; align-items: center; gap: 0.5rem; padding: 0.4rem 0.6rem; background: rgba(0,0,0,0.25); border-radius: 4px; font-size: 0.78rem; }
.st-log-row[data-type="major_kill"] { border-left: 3px solid #e8a020; }
.st-log-row[data-type="elite_kill"] { border-left: 3px solid #c060c0; }
.st-log-row[data-type="near_death"] { border-left: 3px solid #c08040; }
.st-log-row[data-type="death"] { border-left: 3px solid #c04030; }
.st-log-row[data-type="story"] { border-left: 3px solid #60a8e8; }
.st-log-tag { font-size: 0.62rem; color: #8a7a6a; text-transform: uppercase; letter-spacing: 0.08em; min-width: 70px; }
.st-log-text { flex: 1; }
.st-log-meta { color: #4a3a32; font-size: 0.7rem; font-style: italic; }

/* Lifetime tab */
.st-runlist { display: flex; flex-direction: column; gap: 4px; }
.st-run-row { display: flex; align-items: center; gap: 0.6rem; padding: 0.4rem 0.6rem; background: rgba(0,0,0,0.25); border-radius: 4px; font-size: 0.78rem; }
.st-run-date { color: #8a7a6a; font-family: 'JetBrains Mono', monospace; min-width: 92px; }
.st-run-label { flex: 1; color: #f0e8d8; }
.st-run-kpi { font-family: 'JetBrains Mono', monospace; color: #c0a070; }

/* Achievements */
.st-ach-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 8px; }
.st-ach-card { background: rgba(0,0,0,0.3); border: 1px solid rgba(232,160,32,0.08); border-radius: 6px; padding: 0.6rem 0.75rem; opacity: 0.5; }
.st-ach-card.un { opacity: 1; border-color: rgba(232,160,32,0.45); background: rgba(232,160,32,0.05); }
.st-ach-card.t-bronze.un { border-color: #b87a40; }
.st-ach-card.t-silver.un { border-color: #c0c0c8; }
.st-ach-card.t-gold.un { border-color: #f0c060; box-shadow: 0 0 10px rgba(240,192,96,0.25); }
.st-ach-tier { font-size: 0.6rem; letter-spacing: 0.14em; color: #8a7a6a; }
.st-ach-name { font-family: 'Cinzel', serif; font-size: 0.95rem; color: #e8a020; margin: 2px 0 4px; }
.st-ach-desc { font-size: 0.74rem; color: #c0b090; line-height: 1.4; }
.st-ach-status { font-size: 0.7rem; color: #8a7a6a; margin-top: 4px; }
.st-ach-card.un .st-ach-status { color: #e8a020; }

/* M415 Recent Combats */
.st-combat-history { display: flex; flex-direction: column; gap: 4px; max-height: 280px; overflow-y: auto; }
.st-ch-row { padding: 6px 8px; background: rgba(0,0,0,0.25); border-radius: 4px; font-size: 0.78rem; }
.st-ch-row .ch-meta { display: flex; align-items: center; gap: 8px; font-size: 0.72rem; color: #8a7a6a; margin-bottom: 3px; }
.st-ch-row .ch-meta .ch-zone { color: #c0a070; }
.st-ch-row .ch-meta .ch-time { margin-left: auto; font-style: italic; }
.st-ch-row .ch-stats { display: flex; flex-wrap: wrap; gap: 10px; color: #c0b090; }
.st-ch-row .ch-stats b { color: #f0e8d8; }
.ch-win { color: #60c080; font-weight: 700; }
.ch-loss { color: #c08060; font-weight: 700; }
.ch-mvp { color: #ffd060; font-weight: 700; font-size: 0.68rem; padding: 1px 5px; background: rgba(232,160,32,0.18); border-radius: 3px; }
.ch-died { color: #c04030; }
`;
