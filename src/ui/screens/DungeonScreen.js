/**
 * DungeonScreen — M279 / M406 rebalance
 *
 * Sequential mini-dungeon runner. All stages are either combat or skill checks
 * that affect combat (lore/shrine fluff removed). Persistent HP/MP — no
 * healing between floors. Enemies are scaled +35% HP and +30% damage vs
 * overworld. At least 4 enemies per fight, average 6. Skill checks stun
 * all enemies round 1 on pass, deal party damage on fail. Victory and
 * level-up dialogs must both be dismissed before the "Return to Surface"
 * prompt appears.
 */
import { createEl, removeEl, injectStyles } from '../../utils/dom.js';
import { GameState } from '../../game/gameState.js';
import { DUNGEONS, ENCOUNTERS, DUNGEON_SKILL_CHECKS } from '../../maps/mapData.js';
import { CombatScreen } from './CombatScreen.js';
import { LevelUpScreen } from './LevelUpScreen.js';
import { generateItem } from '../../game/items.js';

// ─── Dungeon difficulty multipliers (item 7) ─────────────────────────────────
const DUNGEON_HP_MULT   = 1.35;
const DUNGEON_DMG_MULT  = 1.30;
// Minimum enemies per dungeon combat encounter (item 3)
const MIN_ENEMIES       = 4;
const TARGET_ENEMIES    = 6;

const STYLES = `
.dg-screen { position: absolute; inset: 0; background: #0b0810;
  display: flex; flex-direction: column; color: #f0e8d8;
  font-family: 'Inter', system-ui, sans-serif; overflow: hidden; }
.dg-header { padding: 0.75rem 1rem; display: flex; align-items: center; gap: 0.5rem;
  border-bottom: 1px solid rgba(232,160,32,0.25); background: rgba(20,16,12,0.65); }
.dg-title { font-family: 'Cinzel', serif; color: #e8a020; font-size: 1rem;
  font-weight: 800; letter-spacing: 0.08em; text-transform: uppercase; flex: 1; }
.dg-progress { display: flex; gap: 0.25rem; padding: 0.5rem 1rem;
  background: rgba(0,0,0,0.4); flex-shrink: 0; }
.dg-progress .pip { flex: 1; height: 4px; background: #2a1f30; border-radius: 2px; }
.dg-progress .pip.done   { background: #40a060; }
.dg-progress .pip.active { background: #e8a020; box-shadow: 0 0 6px rgba(232,160,32,0.6); }
.dg-body { flex: 1; overflow-y: auto; padding: 1rem; display: flex; flex-direction: column; align-items: center; gap: 0.75rem; }
.dg-card { background: rgba(20,16,12,0.85); border: 1px solid rgba(232,160,32,0.4);
  border-radius: 6px; padding: 1rem; max-width: 460px; width: 100%; }
.dg-card h2 { margin: 0 0 0.5rem; font-family: 'Cinzel', serif; color: #e8a020;
  font-size: 1.1rem; letter-spacing: 0.06em; }
.dg-card p { margin: 0 0 0.75rem; color: #c0b090; font-size: 0.85rem; line-height: 1.5; }
.dg-buttons { display: flex; gap: 0.5rem; flex-wrap: wrap; }
.dg-btn { background: rgba(20,16,12,0.85); border: 1px solid rgba(232,160,32,0.4);
  color: #e8d090; padding: 0.55rem 0.9rem; border-radius: 4px; cursor: pointer;
  font-weight: 600; min-height: 44px; flex: 1; min-width: 140px; }
.dg-btn.primary { background: rgba(232,160,32,0.25); color: #f8e0a0; border-color: #e8a020; }
.dg-btn.danger  { background: rgba(192,64,48,0.18); color: #e88880; border-color: rgba(192,64,48,0.5); }
.dg-btn.pass    { background: rgba(64,160,96,0.22); color: #80e0a0; border-color: rgba(64,160,96,0.6); }
.dg-btn.fail    { background: rgba(192,64,48,0.22); color: #e88080; border-color: rgba(192,64,48,0.6); }
.dg-btn:hover { filter: brightness(1.15); }
.dg-info { font-size: 0.7rem; color: #8a7a6a; text-align: center; margin-top: 0.5rem; }
.dg-stage-tag { display: inline-block; background: rgba(232,160,32,0.18); color: #e8a020;
  padding: 0.15rem 0.5rem; border-radius: 10px; font-size: 0.65rem; letter-spacing: 0.08em;
  text-transform: uppercase; margin-bottom: 0.5rem; }
.dg-buff-badge { display:inline-block; background:rgba(64,160,96,0.18); color:#80e0a0;
  border:1px solid rgba(64,160,96,0.4); border-radius:4px; font-size:0.72rem;
  padding:0.2rem 0.5rem; margin-top:0.4rem; }
.dg-skill-result { padding:0.75rem; border-radius:4px; margin-bottom:0.5rem; font-size:0.85rem; line-height:1.5; }
.dg-skill-result.pass { background:rgba(64,160,96,0.12); border:1px solid rgba(64,160,96,0.35); color:#a0e8b0; }
.dg-skill-result.fail { background:rgba(192,64,48,0.12); border:1px solid rgba(192,64,48,0.35); color:#e8a0a0; }
`;

export class DungeonScreen {
  constructor(manager, audio, dungeonId, anchorNodeId, anchorZoneId) {
    this.manager = manager;
    this.audio = audio;
    this._dungeonId = dungeonId;
    this._anchorNodeId = anchorNodeId;
    this._anchorZoneId = anchorZoneId;
    this._dungeon = DUNGEONS[dungeonId];
    this._stageIdx = 0;
    this._el = null;
    // Pre-combat buff from a passed skill check — applied as stun_round1
    this._pendingStunBuff = false;
    // Victory + level-up sequencing (item 6)
    this._victoryPending = false;
  }

  onEnter() {
    injectStyles('dg-styles', STYLES);
    if (!this._dungeon) {
      console.warn('[DungeonScreen] unknown dungeonId', this._dungeonId);
      this.manager.pop(); return;
    }
    this._build();
  }

  onResume() {
    // Restore the dungeon UI hidden during combat (see _engageCombat).
    if (this._el) this._el.style.display = '';

    // Item 6: if we are returning from a LevelUpScreen that was pushed after
    // victory, now show the "Return to Surface" final card.
    if (this._victoryPending) {
      this._victoryPending = false;
      this._showVictoryCard();
      return;
    }

    // Item 6: if we are returning from a LevelUpScreen that was pushed after
    // a mid-dungeon combat, now advance to the next stage.
    if (this._nextStagePending) {
      this._nextStagePending = false;
      this._stageIdx++;
      if (this._stageIdx >= this._dungeon.stages.length) {
        this._doVictorySequence(); return;
      }
      this._build();
      return;
    }

    // Returning from CombatScreen — advance to next stage if combat won.
    if (this._lastCombatVictory) {
      this._lastCombatVictory = false;
      // Item 6: check if CombatScreen pushed a LevelUpScreen on top of us.
      // If level-ups are pending, CombatScreen will push LevelUpScreen right
      // after popping itself. We detect this by checking _lastLevelUp flags
      // and deferring the next-stage advance until the second onResume.
      const gs = GameState.get();
      const hasPendingLevelUp = [...(gs.party || []), ...(gs.companions || [])].some(m => m && m._lastLevelUp);
      if (hasPendingLevelUp) {
        // LevelUpScreen will be pushed by CombatScreen next; defer advance
        this._nextStagePending = true;
        return;
      }
      this._stageIdx++;
      if (this._stageIdx >= this._dungeon.stages.length) {
        this._doVictorySequence(); return;
      }
    } else if (this._lastCombatDefeat) {
      this._lastCombatDefeat = false;
      this.manager.pop(); return;
    }
    this._build();
  }

  onLeave() { this._purgeDom(); }
  onExit()  { this._purgeDom(); }
  destroy() { this._purgeDom(); }
  // M412 — paranoid: scrub every .dg-screen node from the DOM, not just
  // this._el. Edge cases (rebuilds, victory cards, skill checks) can orphan
  // sibling elements that share the class. Without this, a stale dungeon
  // panel lingered behind later screens (e.g. "Iron Barricade" under a boss
  // fight after dungeon→town→boss).
  _purgeDom() {
    try { removeEl(this._el); } catch (_) {}
    try { document.querySelectorAll('.dg-screen').forEach(el => el.remove()); } catch (_) {}
    this._el = null;
  }

  _build() {
    if (this._el) removeEl(this._el);
    this._el = createEl('div', 'dg-screen');
    // Guard against stageIdx going past the end of the dungeon.
    if (this._stageIdx >= this._dungeon.stages.length) { this._doVictorySequence(); return; }
    const stage = this._dungeon.stages[this._stageIdx];
    const total = this._dungeon.stages.length;
    const pips = Array.from({ length: total }, (_, i) => {
      if (i < this._stageIdx) return '<div class="pip done"></div>';
      if (i === this._stageIdx) return '<div class="pip active"></div>';
      return '<div class="pip"></div>';
    }).join('');
    const stageType = stage.type;
    const stageNum = `Stage ${this._stageIdx + 1} / ${total}`;
    let body = '';

    if (stageType === 'combat' || stageType === 'boss') {
      const enc = ENCOUNTERS[stage.encounter];
      const scaledEnemies = this._scaledEncounterEnemies(enc);
      const enemyCount = scaledEnemies.reduce((s, e) => s + (e.count || 1), 0);
      const isBoss = stageType === 'boss';
      const buffHtml = this._pendingStunBuff
        ? `<div class="dg-buff-badge">Enemies will start stunned (skill check bonus)</div>`
        : '';
      body = `
        <div class="dg-card">
          <span class="dg-stage-tag" style="${isBoss ? 'color:#c060e0;background:rgba(192,96,224,0.15)' : ''}">${stageNum} · ${isBoss ? 'Mini-Boss' : 'Combat'}</span>
          <h2>${stage.name || enc?.name || 'Hostile encounter'}</h2>
          <p>${enemyCount} ${enemyCount === 1 ? 'enemy' : 'enemies'} ahead. ${isBoss ? 'A mini-boss waits at the end of the run — defeat it to claim the chest.' : 'Cut through and press deeper.'}</p>
          ${buffHtml}
          <div class="dg-buttons">
            <button type="button" class="dg-btn danger" id="dg-giveup">Give Up</button>
            <button type="button" class="dg-btn primary" id="dg-fight">${isBoss ? 'Confront Boss' : 'Engage'}</button>
          </div>
        </div>`;
    } else if (stageType === 'skill_check') {
      // Item 4: render the skill check challenge card
      const check = DUNGEON_SKILL_CHECKS[stage.checkId] || {};
      body = `
        <div class="dg-card">
          <span class="dg-stage-tag" style="color:#60c0e0;background:rgba(96,192,224,0.15)">${stageNum} · Skill Check</span>
          <h2>${stage.name || 'Challenge Ahead'}</h2>
          <p>${check.flavor || 'Something blocks your path.'}</p>
          <p style="font-size:0.78rem;color:#a090c0">
            Roll ${check.stat || '?'} vs DC ${check.dc || '?'} &mdash;
            Pass: enemies start stunned next fight. Fail: party takes ~${Math.round((check.failDamagePct || 0.12) * 100)}% max HP damage.
          </p>
          <div class="dg-buttons">
            <button type="button" class="dg-btn danger" id="dg-giveup">Give Up</button>
            <button type="button" class="dg-btn primary" id="dg-attempt">Attempt (${check.stat || '?'} ${check.dc || '?'})</button>
          </div>
        </div>`;
    }

    this._el.innerHTML = `
      <div class="dg-header">
        <div class="dg-title">${this._dungeon.name}</div>
      </div>
      <div class="dg-progress">${pips}</div>
      <div class="dg-body">
        ${body}
        <div class="dg-info">No retreat to town inside a dungeon — only "Give Up" returns you to the surface (and forfeits the chest).</div>
      </div>
    `;
    this.manager.uiOverlay.appendChild(this._el);
    this._wire();
  }

  _wire() {
    const give = this._el.querySelector('#dg-giveup');
    if (give) give.addEventListener('click', () => this._giveUp());
    const fight = this._el.querySelector('#dg-fight');
    if (fight) fight.addEventListener('click', () => this._engageCombat());
    const attempt = this._el.querySelector('#dg-attempt');
    if (attempt) attempt.addEventListener('click', () => this._resolveSkillCheck());
  }

  // ─── Dungeon difficulty scaling (item 7) ─────────────────────────────────
  // Returns a new enemies array with HP/dmg boosted and count padded to MIN_ENEMIES.
  _scaledEncounterEnemies(enc) {
    if (!enc) return [];
    const baseEnemies = (enc.enemies || []).map(e => ({ ...e }));

    // Scale HP and damage
    const scaled = baseEnemies.map(e => ({
      ...e,
      hp:    Math.round((e.hp    || 1) * DUNGEON_HP_MULT),
      maxHp: Math.round((e.maxHp || e.hp || 1) * DUNGEON_HP_MULT),
      dmg:   Array.isArray(e.dmg)
        ? [Math.round(e.dmg[0] * DUNGEON_DMG_MULT), Math.round(e.dmg[1] * DUNGEON_DMG_MULT)]
        : e.dmg,
    }));

    // Pad total enemy count to at least MIN_ENEMIES, targeting TARGET_ENEMIES.
    const currentTotal = scaled.reduce((s, e) => s + (e.count || 1), 0);
    if (currentTotal < MIN_ENEMIES) {
      // Add to the last (weakest) group, or clone the first group
      const deficit = MIN_ENEMIES - currentTotal;
      if (scaled.length > 0) {
        scaled[scaled.length - 1] = {
          ...scaled[scaled.length - 1],
          count: (scaled[scaled.length - 1].count || 1) + deficit,
        };
      }
    }
    // Try to reach TARGET_ENEMIES average by bumping the first group
    const afterMin = scaled.reduce((s, e) => s + (e.count || 1), 0);
    if (afterMin < TARGET_ENEMIES && scaled.length > 0) {
      const bump = TARGET_ENEMIES - afterMin;
      scaled[0] = { ...scaled[0], count: (scaled[0].count || 1) + bump };
    }
    return scaled;
  }

  _engageCombat() {
    const stage = this._dungeon.stages[this._stageIdx];
    const enc = ENCOUNTERS[stage.encounter];
    if (!enc) { console.warn('[DungeonScreen] missing encounter', stage.encounter); this._advance(); return; }

    // Build scaled encounter (items 3 + 7)
    const scaledEnemies = this._scaledEncounterEnemies(enc);
    const wrapped = {
      ...enc,
      enemies: scaledEnemies,
      name: stage.name || enc.name,
      _zoneId: this._anchorZoneId,
      _dungeonStage: this._stageIdx,
    };

    // Item 4: if a skill check buff is pending, signal stun_round1 via
    // gs._pendingDungeonBuff so CombatScreen can drain it at fight start.
    if (this._pendingStunBuff) {
      this._pendingStunBuff = false;
      const gs = GameState.get();
      gs._pendingDungeonStunRound1 = true;
    }

    this.audio?.playSfx?.('click');
    this._lastCombatVictory = true;
    this._lastCombatDefeat = false;
    // Hide the dungeon UI while combat is active.
    if (this._el) this._el.style.display = 'none';
    this.manager.push(new CombatScreen(this.manager, this.audio, null, wrapped));
  }

  // ─── Skill check resolution (item 4) ─────────────────────────────────────
  _resolveSkillCheck() {
    this.audio?.playSfx?.('click');
    const stage = this._dungeon.stages[this._stageIdx];
    const check = DUNGEON_SKILL_CHECKS[stage.checkId] || {};
    const gs = GameState.get();
    const hero = gs.party?.[0];
    const stat = check.stat || 'STR';
    const dc = check.dc || 12;
    // Roll: hero attribute + d20
    const attrVal = hero?.attrs?.[stat] || 8;
    const roll = Math.floor(Math.random() * 20) + 1;
    const total = attrVal + roll;
    const passed = total >= dc;

    let resultHtml = '';
    if (passed) {
      this._pendingStunBuff = true;
      resultHtml = `
        <div class="dg-skill-result pass">
          <strong>Success!</strong> Rolled ${roll} + ${attrVal} (${stat}) = ${total} vs DC ${dc}.<br>
          ${check.passText || 'You succeed.'}
        </div>`;
    } else {
      // Fail: deal failDamagePct of max HP to every party member
      const pct = check.failDamagePct || 0.12;
      const victims = [...(gs.party || []), ...(gs.companions || [])].filter(m => m && m.hp > 0);
      for (const m of victims) {
        const dmg = Math.max(1, Math.round((m.maxHp || m.hp || 1) * pct));
        m.hp = Math.max(1, (m.hp || 1) - dmg);
      }
      resultHtml = `
        <div class="dg-skill-result fail">
          <strong>Failure.</strong> Rolled ${roll} + ${attrVal} (${stat}) = ${total} vs DC ${dc}.<br>
          ${check.failText || 'You fail.'}
        </div>`;
    }

    // Replace the card content with the result and a "Press On" button
    const card = this._el.querySelector('.dg-card');
    if (card) {
      card.innerHTML = `
        <span class="dg-stage-tag" style="color:#60c0e0;background:rgba(96,192,224,0.15)">Skill Check Result</span>
        <h2>${stage.name || 'Challenge'}</h2>
        ${resultHtml}
        <div class="dg-buttons" style="margin-top:0.5rem">
          <button type="button" class="dg-btn danger" id="dg-giveup-r">Give Up</button>
          <button type="button" class="dg-btn primary" id="dg-next-r">Press On</button>
        </div>
      `;
      card.querySelector('#dg-giveup-r')?.addEventListener('click', () => this._giveUp());
      card.querySelector('#dg-next-r')?.addEventListener('click', () => this._advance());
    }
  }

  _advance() {
    this.audio?.playSfx?.('click');
    this._stageIdx++;
    if (this._stageIdx >= this._dungeon.stages.length) { this._doVictorySequence(); return; }
    this._build();
  }

  _giveUp() {
    this.audio?.playSfx?.('click');
    const gs = GameState.get();
    if (this._anchorZoneId) gs.zoneId = this._anchorZoneId;
    if (this._anchorNodeId) {
      gs.nodeId = this._anchorNodeId;
      try { GameState.setZoneNode(this._anchorZoneId, this._anchorNodeId); } catch (_) {}
    }
    this.manager.pop();
  }

  // ─── Victory sequencing (item 6) ─────────────────────────────────────────
  // Called when the last stage is cleared. Distributes rewards, then checks
  // for pending level-ups. If any exist, pushes LevelUpScreen FIRST and defers
  // the "Return to Surface" card until onResume() fires after levelup is dismissed.
  _doVictorySequence() {
    const reward = this._dungeon.reward || {};
    const gs = GameState.get();

    // Mark dungeon cleared and distribute rewards
    if (!Array.isArray(gs.completedDungeons)) gs.completedDungeons = [];
    if (!gs.completedDungeons.includes(this._dungeon.id)) gs.completedDungeons.push(this._dungeon.id);
    if (reward.gold) GameState.addGold(reward.gold);

    this._rewardItem = null;
    try {
      if (reward.item) {
        this._rewardItem = generateItem(reward.item, 'rare', 'high');
        if (this._rewardItem) {
          GameState.addToInventory(this._rewardItem);
          import('../../game/stats.js').then(m => m.recordDrop(this._rewardItem, {
            zoneId: this._anchorZoneId,
            source: 'chest',
          })).catch(() => {});
        }
      }
    } catch (e) { console.warn('[DungeonScreen] reward item gen failed', e); }

    if (reward.xp) {
      const heroes = (gs.party || []).filter(p => p && !(p.isCompanion || p.class === 'companion'));
      if (heroes.length) {
        const per = Math.floor(reward.xp / heroes.length);
        heroes.forEach(h => { h.xp = (h.xp || 0) + per; });
      }
    }

    // Check for pending level-ups
    const hasPending = [...(gs.party || []), ...(gs.companions || [])].some(m => m && m._lastLevelUp);

    if (hasPending) {
      // Defer the victory card until levelup is dismissed (item 6)
      this._victoryPending = true;
      if (this._el) this._el.style.display = 'none';
      this.manager.push(new LevelUpScreen(this.manager, this.audio));
    } else {
      this._showVictoryCard();
    }
  }

  _showVictoryCard() {
    if (this._el) removeEl(this._el);
    this._el = createEl('div', 'dg-screen');
    const reward = this._dungeon.reward || {};
    const droppedItem = this._rewardItem;
    this._el.innerHTML = `
      <div class="dg-header"><div class="dg-title">Dungeon Cleared</div></div>
      <div class="dg-body">
        <div class="dg-card">
          <span class="dg-stage-tag" style="color:#40a060;background:rgba(64,160,96,0.15)">Victory</span>
          <h2>${this._dungeon.name}</h2>
          <p>You crack open the treasure chest. The dungeon settles, sealed behind you — never to be entered again.</p>
          <p style="color:#e8d090">
            +${reward.gold || 0} gold
            ${reward.xp ? `&middot; +${reward.xp} xp distributed` : ''}
            ${droppedItem ? `&middot; <span style="color:#60c0e0">${droppedItem.name}</span>` : ''}
          </p>
          <div class="dg-buttons">
            <button type="button" class="dg-btn primary" id="dg-leave">Return to Surface</button>
          </div>
        </div>
      </div>
    `;
    this.manager.uiOverlay.appendChild(this._el);
    this._el.querySelector('#dg-leave').addEventListener('click', () => this._giveUp());
  }
}
