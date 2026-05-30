/**
 * InfiniteDungeonScreen — M306
 *
 * Simplified MapScreen-style runner for the Infinite Depths post-game mode.
 * Each floor = 3-5 nodes (combat / treasure). Anchor floors every 5 add a
 * scaled boss. Floors never end until the player returns to town or dies.
 *
 * Run state lives at gs.infiniteRun and is saved with the game.
 */
import { createEl, removeEl, injectStyles } from '../../utils/dom.js';
import { GameState } from '../../game/gameState.js';
import {
  getInfiniteRun,
  startInfiniteRun,
  endInfiniteRun,
  advanceFloor,
  markAnchorCleared,
  addRunLoot,
  rollFloorEffects,
  buildFloorStages,
  pickEnemiesForFloor,
  getAnchorBossForFloor,
  scaleEnemy,
  scaleAnchorBoss,
  rollLootForFloor,
  formatRunTime,
  getLeaderboard,
} from '../../game/infiniteDungeon.js';
import { CombatScreen } from './CombatScreen.js';
import { TownScreen } from './TownScreen.js';
import { generateItem } from '../../game/items.js';

// ─── Styles ───────────────────────────────────────────────────────────────────
const STYLES = `
.id-screen {
  position: absolute; inset: 0; background: #080612;
  display: flex; flex-direction: column; color: #f0e8d8;
  font-family: 'Inter', system-ui, sans-serif; overflow: hidden;
}
.id-header {
  padding: 0.65rem 1rem; display: flex; align-items: center; gap: 0.75rem;
  border-bottom: 1px solid rgba(140,80,200,0.35);
  background: rgba(16,10,28,0.7); flex-shrink: 0;
}
.id-header-title {
  font-family: 'Cinzel', serif; color: #c080f0; font-size: 1rem;
  font-weight: 800; letter-spacing: 0.08em; text-transform: uppercase; flex: 1;
}
.id-floor-badge {
  background: rgba(160,80,240,0.2); border: 1px solid rgba(160,80,240,0.5);
  border-radius: 20px; padding: 0.2rem 0.75rem; font-size: 0.8rem;
  color: #d0a0ff; font-weight: 700; letter-spacing: 0.05em;
}
.id-timer {
  font-size: 0.72rem; color: #8a7090; letter-spacing: 0.04em;
}
.id-effects-bar {
  padding: 0.4rem 1rem; display: flex; gap: 0.4rem; flex-wrap: wrap; align-items: center;
  background: rgba(60,20,80,0.25); border-bottom: 1px solid rgba(140,80,200,0.2);
  flex-shrink: 0;
}
.id-effect-chip {
  display: inline-flex; align-items: center; gap: 0.25rem;
  padding: 0.15rem 0.5rem; border-radius: 10px; font-size: 0.68rem;
  font-weight: 600; letter-spacing: 0.05em; text-transform: uppercase;
  border: 1px solid;
}
.id-effects-label { font-size: 0.65rem; color: #7a6080; text-transform: uppercase; letter-spacing: 0.06em; }
.id-body {
  flex: 1; overflow-y: auto; padding: 1rem; display: flex;
  flex-direction: column; align-items: center; gap: 0.75rem;
}
.id-progress {
  display: flex; gap: 0.3rem; width: 100%; max-width: 460px;
  align-items: center; padding: 0.35rem 0;
}
.id-pip { flex: 1; height: 5px; border-radius: 3px; background: #201828; }
.id-pip.done   { background: #8040c0; }
.id-pip.active { background: #c080f0; box-shadow: 0 0 8px rgba(192,128,240,0.6); }
.id-card {
  background: rgba(16,10,28,0.85); border: 1px solid rgba(160,80,240,0.35);
  border-radius: 8px; padding: 1rem 1.25rem; max-width: 460px; width: 100%;
}
.id-card.anchor {
  border-color: rgba(240,192,32,0.5);
  background: rgba(30,20,8,0.9);
  box-shadow: 0 0 18px rgba(240,192,32,0.12);
}
.id-card-tag {
  display: inline-block; background: rgba(160,80,240,0.18); color: #c080f0;
  padding: 0.15rem 0.5rem; border-radius: 10px; font-size: 0.65rem;
  letter-spacing: 0.08em; text-transform: uppercase; margin-bottom: 0.5rem;
}
.id-card-tag.anchor { background: rgba(240,192,32,0.18); color: #f0c020; border-color: rgba(240,192,32,0.4); }
.id-card h2 {
  margin: 0 0 0.4rem; font-family: 'Cinzel', serif; font-size: 1.1rem;
  letter-spacing: 0.06em; color: #e8d0ff;
}
.id-card.anchor h2 { color: #f0d060; }
.id-card p { margin: 0 0 0.75rem; color: #b090c0; font-size: 0.85rem; line-height: 1.5; }
.id-btns { display: flex; gap: 0.5rem; flex-wrap: wrap; }
.id-btn {
  background: rgba(16,10,28,0.85); border: 1px solid rgba(160,80,240,0.4);
  color: #d0b0f0; padding: 0.55rem 0.9rem; border-radius: 5px; cursor: pointer;
  font-weight: 600; min-height: 44px; flex: 1; min-width: 130px;
  font-family: inherit; font-size: 0.85rem;
}
.id-btn.primary {
  background: rgba(160,80,240,0.25); color: #f0d0ff;
  border-color: rgba(160,80,240,0.7);
}
.id-btn.primary.anchor {
  background: rgba(240,192,32,0.2); color: #f0e080;
  border-color: rgba(240,192,32,0.6);
}
.id-btn.danger  {
  background: rgba(192,48,32,0.18); color: #e08880;
  border-color: rgba(192,48,32,0.5);
}
.id-btn:hover { filter: brightness(1.15); }
.id-floor-end {
  padding: 0.75rem 1rem; border-top: 1px solid rgba(140,80,200,0.25);
  background: rgba(14,10,22,0.8); display: flex; gap: 0.5rem;
  flex-shrink: 0; flex-wrap: wrap; justify-content: center;
}
.id-info { font-size: 0.7rem; color: #7a6090; text-align: center; margin-top: 0.25rem; }
.id-loot-result {
  background: rgba(20,16,30,0.9); border: 1px solid rgba(160,80,240,0.3);
  border-radius: 6px; padding: 0.6rem 0.9rem; max-width: 460px; width: 100%;
  font-size: 0.8rem; color: #d0b0f0;
}
.id-run-summary {
  background: rgba(20,16,30,0.9); border: 1px solid rgba(160,80,240,0.4);
  border-radius: 8px; padding: 1.25rem; max-width: 460px; width: 100%;
}
.id-run-summary h3 {
  font-family: 'Cinzel', serif; color: #c080f0; margin: 0 0 0.75rem;
  font-size: 1rem; letter-spacing: 0.06em;
}
.id-stat-row { display: flex; justify-content: space-between; padding: 0.25rem 0;
  font-size: 0.82rem; border-bottom: 1px solid rgba(160,80,240,0.1); }
.id-stat-row:last-child { border-bottom: none; }
.id-stat-row span { color: #8a7090; }
.id-stat-row strong { color: #d0b0f0; }
.id-lb-title {
  font-family: 'Cinzel', serif; color: #a060d0; font-size: 0.85rem;
  letter-spacing: 0.06em; text-transform: uppercase; margin-top: 1rem;
}
.id-lb-row { display: flex; gap: 0.5rem; font-size: 0.75rem; padding: 0.3rem 0;
  border-bottom: 1px solid rgba(160,80,240,0.08); color: #b090c0; }
.id-lb-row strong { color: #d0b0f0; }
.id-lb-row .id-lb-floor { color: #c080f0; font-weight: 700; min-width: 36px; }
.id-confirm-overlay {
  position: fixed; inset: 0; background: rgba(0,0,0,0.75); display: flex;
  align-items: center; justify-content: center; z-index: 9999;
}
.id-confirm-box {
  background: #120c20; border: 1px solid rgba(160,80,240,0.5); border-radius: 10px;
  padding: 1.5rem; max-width: 340px; width: 90%; text-align: center;
}
.id-confirm-box h2 {
  font-family: 'Cinzel', serif; color: #c080f0; margin: 0 0 0.75rem;
  font-size: 1.15rem; letter-spacing: 0.06em;
}
.id-confirm-box p { color: #c0a0e0; font-size: 0.85rem; line-height: 1.55; margin: 0 0 1rem; }
.id-confirm-btns { display: flex; gap: 0.5rem; }
`;

// ─── Screen ───────────────────────────────────────────────────────────────────
export class InfiniteDungeonScreen {
  constructor(manager, audio) {
    this.manager = manager;
    this.audio = audio;
    this._el = null;
    this._run = null;
    this._stages = [];         // current floor stages
    this._stageIdx = 0;        // current node in floor
    this._floorEffects = [];   // active effects for this floor
    this._floorCleared = false;
    this._lastLoot = null;     // text summary of loot from last node
    this._timerInterval = null;
  }

  // ─── Lifecycle ───────────────────────────────────────────────────────────
  onEnter() {
    injectStyles('id-styles', STYLES);
    this._run = getInfiniteRun();
    if (!this._run) {
      // New run
      this._run = startInfiniteRun();
    }
    this._prepareFloor();
    this._build();
    this._startTimer();
  }

  onResume() {
    if (this._el) this._el.style.display = '';
    // Returning from CombatScreen always means victory (defeat replaces the stack
    // with TownScreen, so onResume is never called after a defeat).
    if (this._pendingCombatResult === 'victory') {
      this._pendingCombatResult = null;
      this._onNodeCleared();
    } else {
      this._build();
    }
  }

  onPause() {
    if (this._el) this._el.style.display = 'none';
  }

  onExit() {
    this._stopTimer();
    removeEl(this._el);
    this._el = null;
  }

  destroy() {
    this._stopTimer();
    // If the screen is destroyed while a combat was pending, the party was defeated
    // (CombatScreen.replace() replaced the whole stack). End the run.
    if (this._pendingCombatResult === 'victory') {
      // Defeat path: run ends, loot is already in inventory.
      endInfiniteRun(false);
    }
    removeEl(this._el);
    this._el = null;
  }

  // ─── Floor preparation ────────────────────────────────────────────────────
  _prepareFloor() {
    if (!this._run) return;
    const floor = this._run.floor;
    this._floorEffects = rollFloorEffects(floor, this._run.seed || 0);
    this._stages = buildFloorStages(floor, this._floorEffects, this._run.seed || 0);
    this._stageIdx = 0;
    this._floorCleared = false;
    this._lastLoot = null;
  }

  // ─── Render ───────────────────────────────────────────────────────────────
  _build() {
    if (this._el) removeEl(this._el);
    this._el = createEl('div', 'id-screen');
    const run = this._run;
    if (!run) { this.manager.pop(); return; }
    const floor = run.floor;
    const isAnchor = floor % 5 === 0;
    const elapsed = Math.round((Date.now() - (run.runStartedAt || Date.now())) / 1000);

    // Header
    const effectChips = this._floorEffects.map(fx =>
      `<span class="id-effect-chip" style="color:${fx.color};border-color:${fx.color}40;background:${fx.color}15" title="${fx.desc}">${fx.icon} ${fx.name}</span>`
    ).join('');
    const effectsBar = this._floorEffects.length
      ? `<div class="id-effects-bar"><span class="id-effects-label">Floor effects</span>${effectChips}</div>`
      : '';

    // Progress pips for current floor stages
    const total = this._stages.length;
    const pips = Array.from({ length: total }, (_, i) => {
      if (i < this._stageIdx) return '<div class="id-pip done"></div>';
      if (i === this._stageIdx) return '<div class="id-pip active"></div>';
      return '<div class="id-pip"></div>';
    }).join('');

    // Current stage card
    let stageHTML = '';
    if (this._floorCleared) {
      stageHTML = this._renderFloorClearedCard(floor);
    } else {
      stageHTML = this._renderStageCard(floor, isAnchor);
    }

    // Loot notice
    const lootNotice = this._lastLoot
      ? `<div class="id-loot-result">${this._lastLoot}</div>`
      : '';

    this._el.innerHTML = `
      <div class="id-header">
        <div class="id-header-title">Infinite Depths</div>
        <span class="id-floor-badge">Floor ${floor}${isAnchor ? ' — Anchor' : ''}</span>
        <span class="id-timer" id="id-timer">${formatRunTime(elapsed)}</span>
      </div>
      ${effectsBar}
      <div class="id-body">
        <div class="id-progress">${pips}</div>
        ${stageHTML}
        ${lootNotice}
        <div class="id-info">Infinite Depths — survive as long as you can. Loot scales with depth. Die and you keep what you found.</div>
      </div>
      ${this._floorCleared ? `
        <div class="id-floor-end">
          <button type="button" class="id-btn danger" id="id-btn-town">Return to Town</button>
          <button type="button" class="id-btn primary" id="id-btn-descend">Descend to Floor ${floor + 1}</button>
        </div>
      ` : ''}
    `;

    this.manager.uiOverlay.appendChild(this._el);
    this._wireEvents();
  }

  _renderStageCard(floor, isAnchor) {
    if (this._stageIdx >= this._stages.length) return '';
    const stage = this._stages[this._stageIdx];
    const stageNum = `Node ${this._stageIdx + 1} / ${this._stages.length}`;

    if (stage.type === 'combat') {
      return `
        <div class="id-card${isAnchor ? ' anchor' : ''}">
          <span class="id-card-tag${isAnchor ? ' anchor' : ''}">${stageNum} · Combat</span>
          <h2>Hostile Encounter</h2>
          <p>Scaled enemies inhabit this level. Defeat them to press deeper.</p>
          <div class="id-btns">
            <button type="button" class="id-btn primary${isAnchor ? ' anchor' : ''}" id="id-btn-fight">Engage</button>
          </div>
        </div>`;
    }
    if (stage.type === 'anchor_boss') {
      const boss = getAnchorBossForFloor(floor);
      return `
        <div class="id-card anchor">
          <span class="id-card-tag anchor">${stageNum} · Anchor Boss</span>
          <h2>${boss.name}</h2>
          <p>A vastly empowered guardian blocks the anchor floor. A unique item awaits its defeat.</p>
          <div class="id-btns">
            <button type="button" class="id-btn primary anchor" id="id-btn-fight">Confront Boss</button>
          </div>
        </div>`;
    }
    if (stage.type === 'treasure') {
      return `
        <div class="id-card">
          <span class="id-card-tag">Treasure</span>
          <h2>A Rift Cache</h2>
          <p>A shimmering crack in reality spills loot from beyond the veil.</p>
          <div class="id-btns">
            <button type="button" class="id-btn primary" id="id-btn-loot">Claim Loot</button>
          </div>
        </div>`;
    }
    return '';
  }

  _renderFloorClearedCard(floor) {
    const run = this._run;
    const elapsed = Math.round((Date.now() - (run.runStartedAt || Date.now())) / 1000);
    return `
      <div class="id-card" style="border-color:rgba(160,80,240,0.5);background:rgba(30,16,50,0.9)">
        <span class="id-card-tag" style="color:#80e080;background:rgba(64,220,80,0.15)">Floor ${floor} Cleared</span>
        <h2>Depths Conquered</h2>
        <p>All nodes on this floor are clear. Descend to Floor ${floor + 1} or return to town with your spoils.</p>
        <div class="id-run-summary">
          <div class="id-stat-row"><span>Floor</span><strong>${floor}</strong></div>
          <div class="id-stat-row"><span>Anchors</span><strong>${(run.anchors || []).length}</strong></div>
          <div class="id-stat-row"><span>Items found</span><strong>${(run.runLoot || []).length}</strong></div>
          <div class="id-stat-row"><span>Time</span><strong>${formatRunTime(elapsed)}</strong></div>
        </div>
      </div>`;
  }

  // ─── Event wiring ─────────────────────────────────────────────────────────
  _wireEvents() {
    this._el.querySelector('#id-btn-fight')?.addEventListener('click', () => {
      this.audio.playSfx('click');
      this._engageCombat();
    });
    this._el.querySelector('#id-btn-loot')?.addEventListener('click', () => {
      this.audio.playSfx('click');
      this._claimTreasure();
    });
    this._el.querySelector('#id-btn-descend')?.addEventListener('click', () => {
      this.audio.playSfx('click');
      advanceFloor();
      this._run = getInfiniteRun();
      this._prepareFloor();
      this._build();
    });
    this._el.querySelector('#id-btn-town')?.addEventListener('click', () => {
      this.audio.playSfx('click');
      this._showReturnConfirm();
    });
  }

  // ─── Combat ───────────────────────────────────────────────────────────────
  _engageCombat() {
    const run = this._run;
    if (!run) return;
    const floor = run.floor;
    const stage = this._stages[this._stageIdx];
    const gs = GameState.get();
    const partyAvgLevel = Math.round(
      (gs.party || []).reduce((s, m) => s + (m.level || 1), 0) / Math.max(1, (gs.party || []).length)
    );

    let enemyGroups;
    let isAnchorBoss = false;

    if (stage.type === 'anchor_boss') {
      isAnchorBoss = true;
      const boss = getAnchorBossForFloor(floor);
      const scaled = scaleAnchorBoss(boss, floor, partyAvgLevel);
      enemyGroups = [{ ...scaled, count: 1 }];
    } else {
      const rawGroups = pickEnemiesForFloor(floor, this._floorEffects, run.seed || 0);
      enemyGroups = rawGroups.map(g => scaleEnemy(g, floor, partyAvgLevel));
    }

    // Build encounter object compatible with CombatScreen.
    const encounter = {
      id: `infinite_floor${floor}_node${this._stageIdx}`,
      name: isAnchorBoss ? `Anchor Boss — Floor ${floor}` : `Floor ${floor} — Node ${this._stageIdx + 1}`,
      enemies: enemyGroups,
      _zoneId: 'infinite_depths',
      _infiniteFloor: floor,
      _isAnchorBoss: isAnchorBoss,
      // Pass floor effects so CombatScreen can read them if needed
      _floorEffects: this._floorEffects,
      isBoss: isAnchorBoss,
    };

    // Hide this screen while combat runs
    if (this._el) this._el.style.display = 'none';
    this._pendingCombatResult = 'victory'; // optimistic; defeat triggers onRunEnd

    this.manager.push(new CombatScreen(this.manager, this.audio, null, encounter));
  }

  _onNodeCleared() {
    const run = this._run;
    if (!run) return;
    const stage = this._stages[this._stageIdx];

    // Award floor-appropriate loot after combat/treasure.
    const lootRoll = rollLootForFloor(run.floor, this._getLootMods());
    const dropChance = 0.45 + (run.floor * 0.01);
    const doubleDrop = this._floorEffects.some(e => e.id === 'double_damage');
    const claimedItems = [];
    const dropAttempts = doubleDrop ? 2 : 1;
    for (let i = 0; i < dropAttempts; i++) {
      if (Math.random() < dropChance * lootRoll.dropChanceMult) {
        const bases = ['sword','dagger','ring','necklace','medium_chest','heavy_chest','staff','wand','cloth_chest','heavy_helm'];
        const baseKey = bases[Math.floor(Math.random() * bases.length)];
        const item = generateItem(baseKey, lootRoll.rarity, lootRoll.quality);
        if (item) {
          GameState.addToInventory(item);
          addRunLoot(item);
          claimedItems.push(item);
        }
      }
    }

    // Anchor boss guarantees a unique/set item.
    if (stage.type === 'anchor_boss') {
      markAnchorCleared(run.floor);
      const anchorBases = ['ring','necklace','heavy_chest','staff','sword'];
      const anchorBase = anchorBases[Math.floor(Math.random() * anchorBases.length)];
      const anchorItem = generateItem(anchorBase, 'legendary', 'exotic');
      if (anchorItem) {
        GameState.addToInventory(anchorItem);
        addRunLoot(anchorItem);
        claimedItems.push(anchorItem);
      }
    }

    this._lastLoot = claimedItems.length
      ? `Loot: ${claimedItems.map(i => `<span style="color:var(--rarity-${i.rarity})">${i.name}</span>`).join(', ')}`
      : 'No loot dropped this node.';

    // Advance to next node.
    this._stageIdx++;
    if (this._stageIdx >= this._stages.length) {
      this._floorCleared = true;
    }
    if (this._el) this._el.style.display = '';
    this._build();
  }

  _getLootMods() {
    const mods = {};
    for (const fx of this._floorEffects) {
      if (fx.lootMod) Object.assign(mods, fx.lootMod);
    }
    return mods;
  }

  _claimTreasure() {
    // Treasure node = guaranteed item, no combat.
    this._pendingCombatResult = null;
    this._onNodeCleared();
  }

  // ─── Run end summary ──────────────────────────────────────────────────────
  // Called when the player voluntarily exits (town button) after the run ends.
  _showRunEndSummary() {
    const elapsed = this._run
      ? Math.round((Date.now() - (this._run.runStartedAt || Date.now())) / 1000)
      : 0;
    const floor = this._run?.floor || 1;
    const lootCount = (this._run?.runLoot || []).length;

    if (this._el) removeEl(this._el);
    this._el = createEl('div', 'id-screen');
    this._el.innerHTML = `
      <div class="id-header">
        <div class="id-header-title">Run Ended</div>
        <span class="id-floor-badge">Floor ${floor}</span>
      </div>
      <div class="id-body">
        <div class="id-run-summary">
          <h3>The Depths Claimed You</h3>
          <div class="id-stat-row"><span>Deepest floor</span><strong>${floor}</strong></div>
          <div class="id-stat-row"><span>Items claimed</span><strong>${lootCount}</strong></div>
          <div class="id-stat-row"><span>Run time</span><strong>${formatRunTime(elapsed)}</strong></div>
          <p style="margin:0.75rem 0 0;font-size:0.8rem;color:#9070a0">Your loot has been added to your inventory. A new run starts from the entrance.</p>
        </div>
        ${this._renderLeaderboardSnippet()}
        <div class="id-btns" style="max-width:460px;width:100%;margin-top:0.5rem">
          <button type="button" class="id-btn danger" id="id-btn-town-end">Return to Town</button>
        </div>
      </div>
    `;
    this.manager.uiOverlay.appendChild(this._el);
    this._el.querySelector('#id-btn-town-end')?.addEventListener('click', () => {
      this.audio.playSfx('click');
      this._returnToTown();
    });
  }

  _returnToTown() {
    if (this._run) {
      endInfiniteRun(false);
    }
    // Pop back to TownScreen (or previous town if stacked).
    // If TownScreen is not in the stack, push a new one.
    this.manager.pop();
    // Check if TownScreen is now visible; if not push it.
    const top = this.manager._stack?.[this.manager._stack.length - 1];
    if (!(top instanceof TownScreen)) {
      this.manager.push(new TownScreen(this.manager, this.audio, null));
    }
  }

  // ─── Return to town confirm ───────────────────────────────────────────────
  _showReturnConfirm() {
    const overlay = createEl('div', 'id-confirm-overlay');
    overlay.innerHTML = `
      <div class="id-confirm-box">
        <h2>Return to Town?</h2>
        <p>You will exit the Infinite Depths. All loot collected this run remains in your inventory. Your run will end and progress recorded.</p>
        <div class="id-confirm-btns">
          <button type="button" class="id-btn" id="id-cancel-town" style="flex:1">Stay</button>
          <button type="button" class="id-btn danger" id="id-confirm-town" style="flex:1">Return</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
    overlay.querySelector('#id-cancel-town').addEventListener('click', () => overlay.remove());
    overlay.querySelector('#id-confirm-town').addEventListener('click', () => {
      overlay.remove();
      this.audio.playSfx('click');
      this._returnToTown();
    });
  }

  // ─── Leaderboard snippet ──────────────────────────────────────────────────
  _renderLeaderboardSnippet() {
    const board = getLeaderboard().slice(0, 5);
    if (!board.length) return '';
    const rows = board.map((e, i) =>
      `<div class="id-lb-row">
        <span class="id-lb-floor">#${i + 1} F${e.deepestFloor}</span>
        <strong>${e.heroName}</strong>
        <span>${e.heroClass}</span>
        <span>${formatRunTime(e.runTime)}</span>
      </div>`
    ).join('');
    return `
      <div class="id-run-summary" style="max-width:460px;width:100%">
        <div class="id-lb-title">Top Runs</div>
        ${rows}
      </div>`;
  }

  // ─── Timer ────────────────────────────────────────────────────────────────
  _startTimer() {
    this._stopTimer();
    this._timerInterval = setInterval(() => {
      const timerEl = this._el?.querySelector('#id-timer');
      if (!timerEl || !this._run) return;
      const elapsed = Math.round((Date.now() - (this._run.runStartedAt || Date.now())) / 1000);
      timerEl.textContent = formatRunTime(elapsed);
    }, 1000);
  }

  _stopTimer() {
    if (this._timerInterval) {
      clearInterval(this._timerInterval);
      this._timerInterval = null;
    }
  }
}
