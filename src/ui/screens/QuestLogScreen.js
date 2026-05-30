/**
 * QuestLogScreen — Shows active/completed quests and story progress
 * Reads from GameState.storyFlags to determine completion
 */
import { createEl, removeEl, injectStyles } from '../../utils/dom.js';
import { GameState } from '../../game/gameState.js';

// Quest definitions — show/hide based on story flags
const QUESTS = [
  {
    id: 'q_border_roads',
    title: 'Dangerous Roads',
    act: 1,
    description: 'The Border Roads are overrun with goblin patrols. Clear a path through to reach the Goblin Frontier.',
    objectives: [
      { text: 'Reach the Border Roads', flagCheck: () => true },
      { text: 'Defeat the Warlord\'s Vanguard', flagCheck: gs => (gs.completedBosses || []).includes('border_boss') },
    ],
    reward: 'Access to Thornwood Forest',
    goldReward: 150, fameReward: 2,
  },
  {
    id: 'q_thornwood',
    title: 'Into the Thornwood',
    act: 1,
    description: 'The forest has been corrupted by Veil energy. Seek out Mira the Seer and defeat the Veil Wardens.',
    objectives: [
      { text: 'Reach Thornwood Forest', flagCheck: gs => (gs.unlockedZones || []).includes('thornwood') },
      { text: 'Meet Mira the Seer', flagCheck: gs => gs.storyFlags?.seer_met },
      { text: 'Defeat the Veil Wardens', flagCheck: gs => (gs.completedBosses || []).includes('thornwood_boss') },
    ],
    reward: 'The Ashen Wastes opened (Act 2)',
    goldReward: 250, fameReward: 3,
  },
  {
    id: 'q_seer_warning',
    title: 'The Seer\'s Warning',
    act: 1,
    description: 'Mira the Seer spoke of an ancient rift in the Thornwood — a tear between realms pouring corruption into your world.',
    objectives: [
      { text: 'Learn of the rift\'s origin', flagCheck: gs => gs.storyFlags?.knows_rift_origin },
      { text: 'Speak with the Seer', flagCheck: gs => gs.storyFlags?.seer_met },
    ],
    reward: 'Lore: Understanding the Emberveil',
    isLore: true,
  },
  {
    id: 'q_ashen_wastes',
    title: 'Through the Ashen Wastes',
    act: 2,
    description: 'The Ashen Wastes stretch south — volcanic flats controlled by Veil cultists and their summoned creatures. The cult is preparing a ritual.',
    objectives: [
      { text: 'Reach the Ashen Wastes', flagCheck: gs => (gs.unlockedZones || []).includes('dust_roads') },
      { text: 'Defeat the Lava Titan', flagCheck: gs => (gs.completedBosses || []).includes('dust_boss') },
      { text: 'Reach the Ember Plateau', flagCheck: gs => (gs.unlockedZones || []).includes('ember_plateau') },
      { text: 'Defeat the Veil High Priest', flagCheck: gs => (gs.completedBosses || []).includes('plateau_boss') },
    ],
    reward: 'Act 3: The Shattered Hell',
    goldReward: 400, fameReward: 4,
  },
  {
    id: 'q_cult_of_the_veil',
    title: 'The Veil Cultists\' Purpose',
    act: 2,
    description: 'You have encountered Veil cultists throughout the Wastes. They speak of a "Convergence" — an event that will tear the boundary between realms forever.',
    objectives: [
      { text: 'Encounter first Veil Cultist', flagCheck: gs => (gs.completedBosses || []).some(b => b.includes('dust')) },
      { text: 'Find evidence of the ritual site', flagCheck: gs => gs.storyFlags?.ritual_site_found },
      { text: 'Disrupt the Convergence ritual', flagCheck: gs => (gs.completedBosses || []).includes('plateau_boss') },
    ],
    reward: 'Lore: The Nature of the Emberveil',
    isLore: true,
  },
  {
    id: 'q_descent_to_hell',
    title: 'Descent into the Shattered Hell',
    act: 3,
    description: 'Beyond the Ember Plateau lies the Hell Breach — a torn rift into the demonic realm of the Shattered Hell. The corruption\'s source lies within.',
    objectives: [
      { text: 'Find the Hell Breach', flagCheck: gs => (gs.unlockedZones || []).includes('hell_breach') },
      { text: 'Survive the demon patrols', flagCheck: gs => (gs.completedBosses || []).some(b => b.includes('hell')) },
      { text: 'Confront Archfiend Malgrath', flagCheck: gs => (gs.completedBosses || []).includes('malgrath') },
      { text: 'Reach the Shattered Core', flagCheck: gs => (gs.unlockedZones || []).includes('shattered_core') },
    ],
    reward: 'The path to the Emberveil Sovereign',
    goldReward: 600, fameReward: 5,
  },
  {
    id: 'q_end_of_worlds',
    title: 'The Emberveil Sovereign',
    act: 3,
    description: 'At the heart of the Shattered Core sits the Emberveil Sovereign — the ancient entity tearing worlds apart. Only your party stands between it and total annihilation.',
    objectives: [
      { text: 'Reach the Shattered Core', flagCheck: gs => (gs.unlockedZones || []).includes('shattered_core') },
      { text: 'Defeat the Sovereign\'s Vanguard', flagCheck: gs => (gs.completedBosses || []).some(b => b.includes('shattered')) },
      { text: 'Defeat the Emberveil Sovereign', flagCheck: gs => (gs.completedBosses || []).includes('sovereign') },
    ],
    reward: 'Victory — the Emberveil is sealed',
  },
];

export class QuestLogScreen {
  constructor(manager, audio) {
    this.manager = manager;
    this.audio = audio;
    this._el = null;
  }

  onEnter() { this._build(); }

  _build() {
    injectStyles('quest-styles', QUEST_STYLES);
    this._el = createEl('div', 'quest-screen');
    this.manager.uiOverlay.appendChild(this._el);
    this._render();
  }

  _render() {
    const gs = GameState.get();

    const questsHtml = QUESTS.map(q => {
      const completedObjectives = q.objectives.filter(o => o.flagCheck(gs)).length;
      const totalObjectives = q.objectives.length;
      const isComplete = completedObjectives === totalObjectives;
      const isActive = completedObjectives > 0 && !isComplete;
      const isAvailable = q.objectives[0].flagCheck(gs);

      if (!isAvailable && !isComplete) return ''; // Hidden

      const status = isComplete ? 'complete' : isActive ? 'active' : 'available';
      const statusLabel = isComplete ? 'Complete' : isActive ? 'In Progress' : 'Available';
      const actColors = { 1: '#e8a020', 2: '#c06020', 3: '#a02080' };

      return `
        <div class="ql-quest ${status}">
          <div class="ql-q-header">
            <div class="ql-q-title">${q.title}</div>
            <div class="ql-q-badges">
              <span class="ql-act-badge" style="color:${actColors[q.act]||'#8a7a6a'}">Act ${q.act}</span>
              <span class="ql-status-badge ${status}">${statusLabel}</span>
              ${q.isLore ? '<span class="ql-lore-badge">Lore</span>' : ''}
            </div>
          </div>
          <div class="ql-q-desc">${q.description}</div>
          <div class="ql-objectives">
            ${q.objectives.map(o => {
              const done = o.flagCheck(gs);
              return `<div class="ql-obj ${done ? 'done' : ''}">
                <div class="ql-obj-check">${done ? '✓' : '○'}</div>
                <div class="ql-obj-text">${o.text}</div>
              </div>`;
            }).join('')}
          </div>
          <div class="ql-reward">Reward: <span>${q.reward}${q.goldReward ? ` · ${q.goldReward}g` : ''}${q.fameReward ? ` · +${q.fameReward} fame` : ''}</span></div>
          <div class="ql-progress-bar">
            <div class="ql-progress-fill" style="width:${(completedObjectives/totalObjectives)*100}%"></div>
          </div>
          ${isComplete && !(gs.turnedInQuests || []).includes(q.id) && (q.goldReward || q.fameReward) ? `<button type="button" class="ql-turnin" data-qid="${q.id}">Turn In</button>` : ((gs.turnedInQuests || []).includes(q.id) ? '<div class="ql-turnin-done">Rewards claimed</div>' : '')}
        </div>
      `;
    }).join('');

    this._el.innerHTML = `
      <div class="ql-panel">
        <div class="ql-header">
          <div class="ql-title">Quest Log</div>
          <button type="button" class="ql-close" id="ql-close">✕</button>
        </div>
        <div class="ql-list">
          ${questsHtml || '<div class="ql-empty">No quests available yet. Explore to begin your journey.</div>'}
        </div>
      </div>
    `;

    this._el.querySelector('#ql-close').addEventListener('click', () => {
      this.audio.playSfx('click');
      this.manager.pop();
    });
    this._el.querySelectorAll('.ql-turnin').forEach(btn => {
      btn.addEventListener('click', () => {
        const qid = btn.dataset.qid;
        const q = QUESTS.find(x => x.id === qid);
        if (!q) return;
        const gs2 = GameState.get();
        gs2.turnedInQuests = gs2.turnedInQuests || [];
        if (gs2.turnedInQuests.includes(qid)) return;
        if (q.goldReward) GameState.addGold(q.goldReward);
        if (q.fameReward && typeof GameState.addFame === 'function') GameState.addFame(q.fameReward);
        gs2.turnedInQuests.push(qid);
        this.audio.playSfx('victory');
        this._render();
      });
    });
  }

  static getCompletedCount() {
    const gs = GameState.get();
    const turned = new Set(gs.turnedInQuests || []);
    let n = 0;
    for (const q of QUESTS) {
      if (turned.has(q.id)) continue;
      if (!(q.goldReward || q.fameReward)) continue;
      const done = q.objectives.every(o => o.flagCheck(gs));
      if (done) n++;
    }
    return n;
  }

  onPause() { if (this._el) this._el.style.display = 'none'; }
  onResume() { if (this._el) this._el.style.display = ''; }
  update() {}
  draw() {}
  onExit() { removeEl(this._el); this._el = null; }
  destroy() { removeEl(this._el); this._el = null; }
}

const QUEST_STYLES = `
.quest-screen {
  position: absolute; inset: 0; display: flex; align-items: center; justify-content: center;
  background: rgba(5,2,8,0.96); font-family: 'Inter', sans-serif; color: #f0e8d8;
}
.ql-panel {
  width: 100%; max-width: 540px; height: 100%; max-height: 700px;
  display: flex; flex-direction: column; padding: 0;
  border: 1px solid rgba(232,160,32,0.2); border-radius: 12px;
  background: rgba(14,10,18,0.98); overflow: hidden;
}
.ql-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 1.25rem 1.5rem; border-bottom: 1px solid rgba(255,255,255,0.07);
  flex-shrink: 0;
}
.ql-title { font-family: 'Cinzel', serif; font-size: 1.1rem; font-weight: 700; color: #e8a020; }
.ql-close {
  background: none; border: 1px solid rgba(255,255,255,0.1); border-radius: 6px;
  color: #8a7a6a; font-size: 0.85rem; cursor: pointer; width: 32px; height: 32px;
  display: flex; align-items: center; justify-content: center;
}
.ql-close:hover { color: #f0e8d8; border-color: rgba(255,255,255,0.25); }
.ql-list { overflow-y: auto; padding: 1rem 1.25rem; display: flex; flex-direction: column; gap: 0.75rem; }
.ql-quest {
  background: rgba(20,14,22,0.8); border: 1px solid rgba(255,255,255,0.06);
  border-radius: 8px; padding: 1rem; display: flex; flex-direction: column; gap: 0.55rem;
}
.ql-quest.complete { border-color: rgba(64,200,96,0.2); opacity: 0.7; }
.ql-quest.active { border-color: rgba(232,160,32,0.3); }
.ql-q-header { display: flex; justify-content: space-between; align-items: flex-start; gap: 0.5rem; }
.ql-q-title { font-family: 'Cinzel', serif; font-size: 0.88rem; font-weight: 700; color: #f0e8d8; }
.ql-q-badges { display: flex; gap: 0.4rem; flex-wrap: wrap; justify-content: flex-end; }
.ql-act-badge { font-size: 0.62rem; font-weight: 700; letter-spacing: 0.1em; }
.ql-status-badge { font-size: 0.62rem; font-weight: 600; padding: 0.12rem 0.4rem; border-radius: 3px; }
.ql-status-badge.complete { background: rgba(64,200,96,0.15); color: #60e880; }
.ql-turnin { margin-top: 0.5rem; background: rgba(64,200,96,0.18); border: 1px solid rgba(64,200,96,0.6); color: #60e880; padding: 0.55rem 1rem; border-radius: 6px; font-weight: 700; cursor: pointer; font-family: inherit; }
.ql-turnin:hover { background: rgba(64,200,96,0.28); }
.ql-turnin-done { margin-top: 0.5rem; font-size: 0.72rem; color: #60a060; font-style: italic; }
.ql-status-badge.active { background: rgba(232,160,32,0.15); color: #e8a020; }
.ql-status-badge.available { background: rgba(100,100,100,0.15); color: #8a7a6a; }
.ql-lore-badge { font-size: 0.62rem; font-weight: 600; padding: 0.12rem 0.4rem; border-radius: 3px; background: rgba(100,60,200,0.15); color: #c080ff; }
.ql-q-desc { font-size: 0.78rem; color: #a09080; line-height: 1.5; }
.ql-objectives { display: flex; flex-direction: column; gap: 0.3rem; }
.ql-obj { display: flex; align-items: flex-start; gap: 0.5rem; font-size: 0.76rem; }
.ql-obj-check { color: #4a3a32; font-size: 0.72rem; min-width: 14px; margin-top: 1px; }
.ql-obj.done .ql-obj-check { color: #60e880; }
.ql-obj-text { color: #8a7a6a; }
.ql-obj.done .ql-obj-text { color: #c0b090; text-decoration: line-through; text-decoration-color: #4a3a32; }
.ql-reward { font-size: 0.72rem; color: #6a5a52; }
.ql-reward span { color: #e8a020; }
.ql-progress-bar { height: 2px; background: rgba(255,255,255,0.06); border-radius: 2px; overflow: hidden; }
.ql-progress-fill { height: 100%; background: #e8a020; border-radius: 2px; transition: width 0.4s; }
.ql-empty { text-align: center; padding: 3rem 2rem; color: #4a3a32; font-size: 0.85rem; }
`;
