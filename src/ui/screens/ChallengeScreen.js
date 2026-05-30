/**
 * ChallengeScreen — Daily Challenge mode
 * Each day has a fixed seed that generates a gauntlet of 5 combat encounters.
 * Score is tracked locally. Leaderboard shows top scores for current day.
 */
import { createEl, removeEl, injectStyles } from '../../utils/dom.js';
import { GameState } from '../../game/gameState.js';
import { CombatScreen } from './CombatScreen.js';

const STYLES = `
.challenge-screen {
  position: absolute; inset: 0; background: rgba(2,4,10,0.97);
  display: flex; flex-direction: column; overflow: hidden; color: #e8e0d0;
  font-family: 'Cinzel', Georgia, serif;
}
.chal-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 1rem 1rem 0.5rem; border-bottom: 1px solid rgba(80,120,255,0.3); flex-shrink: 0;
}
.chal-title { font-size: 1.1rem; color: #80a0ff; letter-spacing: 0.1em; }
.chal-close {
  background: none; border: 1px solid rgba(80,120,255,0.4); color: #80a0ff;
  padding: 0.35rem 0.8rem; border-radius: 4px; cursor: pointer; font-size: 0.85rem;
  font-family: inherit;
}
.chal-body { flex: 1; overflow-y: auto; padding: 0.75rem; display: flex; flex-direction: column; gap: 0.75rem; }
.chal-card {
  background: rgba(80,120,255,0.06); border: 1px solid rgba(80,120,255,0.25);
  border-radius: 8px; padding: 0.9rem;
}
.chal-card-title { font-size: 0.9rem; color: #80a0ff; margin-bottom: 0.4rem; }
.chal-seed-label { font-size: 0.7rem; color: rgba(150,170,220,0.5); letter-spacing: 0.1em; }
.chal-waves {
  display: flex; flex-direction: column; gap: 0.3rem; margin: 0.6rem 0;
}
.chal-wave {
  display: flex; align-items: center; gap: 0.5rem;
  font-size: 0.78rem; color: rgba(200,190,220,0.8);
}
.chal-wave-num { color: #80a0ff; font-weight: 700; width: 1.5rem; }
.chal-wave.done { color: rgba(96,192,96,0.8); }
.chal-wave.done .chal-wave-num { color: #60c060; }
.chal-wave.current { color: #e8e040; }
.chal-wave.current .chal-wave-num { color: #e8e040; }
.chal-start-btn {
  width: 100%; padding: 0.65rem; border: 1px solid rgba(80,120,255,0.6);
  background: rgba(80,120,255,0.15); color: #80a0ff; font-family: inherit;
  font-size: 0.9rem; border-radius: 5px; cursor: pointer; letter-spacing: 0.05em;
}
.chal-start-btn:hover { background: rgba(80,120,255,0.25); }
.chal-start-btn:disabled { opacity: 0.35; cursor: not-allowed; }
.chal-score-row {
  display: flex; justify-content: space-between; align-items: center;
  padding: 0.35rem 0; border-bottom: 1px solid rgba(255,255,255,0.05);
  font-size: 0.78rem;
}
.chal-score-rank { color: #e8c840; width: 2rem; }
.chal-score-name { flex: 1; color: #e0d8c8; }
.chal-score-pts { color: #80a0ff; }
.chal-you { color: #60c060 !important; font-weight: 700; }
.chal-complete-banner {
  background: rgba(96,192,64,0.1); border: 1px solid rgba(96,192,64,0.4);
  border-radius: 6px; padding: 0.75rem; text-align: center;
  color: #80e060; font-size: 0.9rem;
}
.chal-info { font-size: 0.72rem; color: rgba(150,170,220,0.55); font-family: Georgia, serif; line-height: 1.5; }
`;

// Seeded PRNG (mulberry32)
function seededRng(seed) {
  let s = seed >>> 0;
  return () => {
    s += 0x6D2B79F5;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = t + Math.imul(t ^ (t >>> 7), 61 | t) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function getDailySeed() {
  const d = new Date();
  return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
}

function getTodayKey() {
  const d = new Date();
  return `emberveil_challenge_${d.getFullYear()}_${d.getMonth() + 1}_${d.getDate()}`;
}

const CHALLENGE_ENEMIES = [
  // Wave 1 — easy
  [{ id:'goblin_scout', name:'Goblin Scout', count:4, hp:20, maxHp:20, dmg:[4,8], armor:1, hit:70, dodge:12, xpValue:20, gold:[5,10] }],
  // Wave 2
  [{ id:'goblin_warrior', name:'Goblin Warrior', count:3, hp:35, maxHp:35, dmg:[8,16], armor:3, hit:75, dodge:8, xpValue:35, gold:[8,15] }, { id:'goblin_scout', name:'Goblin Scout', count:2, hp:20, maxHp:20, dmg:[4,8], armor:1, hit:70, dodge:12, xpValue:20, gold:[5,10] }],
  // Wave 3 — mid
  [{ id:'veil_cultist', name:'Veil Cultist', count:3, hp:55, maxHp:55, dmg:[12,22], armor:4, hit:78, dodge:10, xpValue:55, gold:[12,22] }],
  // Wave 4
  [{ id:'ash_wraith', name:'Ash Wraith', count:2, hp:70, maxHp:70, dmg:[18,30], armor:5, hit:80, dodge:15, xpValue:70, gold:[15,28] }, { id:'cinder_hound', name:'Cinder Hound', count:2, hp:60, maxHp:60, dmg:[14,24], armor:3, hit:82, dodge:10, xpValue:60, gold:[12,20] }],
  // Wave 5 — boss
  [{ id:'grax', name:'Grax the Warlord', count:1, hp:280, maxHp:280, dmg:[25,45], armor:12, hit:80, dodge:8, xpValue:300, gold:[60,120] }, { id:'goblin_warrior', name:'Goblin Warrior', count:2, hp:35, maxHp:35, dmg:[8,16], armor:3, hit:75, dodge:8, xpValue:35, gold:[8,15] }],
];

function generateChallenge(seed) {
  const rng = seededRng(seed);
  // Vary the challenge slightly based on seed
  return CHALLENGE_ENEMIES.map((wave, i) => {
    const scaled = wave.map(e => ({
      ...e,
      count: Math.max(1, e.count + (rng() > 0.7 ? 1 : 0)),
      hp: Math.round(e.hp * (0.9 + rng() * 0.25)),
      maxHp: Math.round(e.hp * (0.9 + rng() * 0.25)),
    }));
    return { wave: i + 1, enemies: scaled, name: ['The Opening Wave', 'Rising Tide', 'The Cult Strikes', 'Shadows and Flame', 'The Warlord\'s Last Stand'][i] };
  });
}

function loadLeaderboard() {
  try {
    return JSON.parse(localStorage.getItem(getTodayKey()) || '[]');
  } catch { return []; }
}

function saveScore(name, score, waves) {
  const board = loadLeaderboard();
  board.push({ name, score, waves, ts: Date.now() });
  board.sort((a, b) => b.score - a.score);
  localStorage.setItem(getTodayKey(), JSON.stringify(board.slice(0, 20)));
}

export class ChallengeScreen {
  constructor(manager, audio) {
    this.manager = manager;
    this.audio = audio;
    this._el = null;
    this._seed = getDailySeed();
    this._waves = generateChallenge(this._seed);
    this._currentWave = 0; // 0 = not started
    this._wavesCleared = 0;
    this._score = 0;
    this._running = false;
    this._done = false;
    // Check if already completed today
    const board = loadLeaderboard();
    const gs = GameState.get();
    const heroName = gs.hero?.name || 'Traveller';
    const myEntry = board.find(e => e.name === heroName);
    if (myEntry) { this._done = true; this._score = myEntry.score; this._wavesCleared = myEntry.waves; }
  }

  onEnter() { this._build(); }
  onPause() { if (this._el) this._el.style.display = 'none'; }
  onResume() {
    if (this._el) this._el.style.display = 'flex';
    // If we were running a wave and returned, check if it was won
    if (this._running && !this._resuming) {
      this._resuming = true;
      this._running = false;
      this._wavesCleared++;
      this._score += this._wavesCleared * 100;
      if (this._wavesCleared >= this._waves.length) {
        this._done = true;
        const gs = GameState.get();
        saveScore(gs.hero?.name || 'Traveller', this._score, this._wavesCleared);
        GameState.setFlag('challenge_complete', true);
        GameState.addFame(50);
      }
      this._render();
      this._resuming = false;
    }
  }
  onExit() { removeEl(this._el); this._el = null; }

  _build() {
    injectStyles('challenge-screen-styles', STYLES);
    this._el = createEl('div', 'challenge-screen');
    this.manager.uiOverlay.appendChild(this._el);
    this._render();
  }

  _render() {
    const board = loadLeaderboard();
    const seed = this._seed;
    const dateStr = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

    const wavesHTML = this._waves.map((w, i) => {
      const isDone = i < this._wavesCleared;
      const isCurrent = !this._done && i === this._wavesCleared;
      return `<div class="chal-wave${isDone ? ' done' : isCurrent ? ' current' : ''}">
        <div class="chal-wave-num">${isDone ? '✓' : isCurrent ? '▶' : i + 1}</div>
        <div>${w.name} — ${w.enemies.map(e => `${e.count}× ${e.name}`).join(', ')}</div>
      </div>`;
    }).join('');

    const boardHTML = board.length === 0
      ? `<div style="font-size:0.75rem;color:rgba(150,170,220,0.4);text-align:center;padding:1rem">No scores recorded today yet.</div>`
      : board.slice(0, 10).map((entry, i) => {
          const gs = GameState.get();
          const isMe = entry.name === (gs.hero?.name || 'Traveller');
          return `<div class="chal-score-row">
            <div class="chal-score-rank">#${i + 1}</div>
            <div class="chal-score-name${isMe ? ' chal-you' : ''}">${entry.name}</div>
            <div class="chal-score-pts${isMe ? ' chal-you' : ''}">${entry.score} pts · ${entry.waves}/${this._waves.length} waves</div>
          </div>`;
        }).join('');

    this._el.innerHTML = `
      <div class="chal-header">
        <div class="chal-title">⚡ Daily Challenge</div>
        <button type="button" class="chal-close" id="chal-close">✕ Close</button>
      </div>
      <div class="chal-body">
        <div class="chal-card">
          <div class="chal-card-title">Today's Gauntlet — ${dateStr}</div>
          <div class="chal-seed-label">SEED: ${seed}</div>
          <div class="chal-waves">${wavesHTML}</div>
          ${this._done
            ? `<div class="chal-complete-banner">✓ Challenge Complete! Score: ${this._score} pts (${this._wavesCleared}/${this._waves.length} waves)</div>`
            : `<button type="button" class="chal-start-btn" id="chal-start">${this._wavesCleared > 0 ? `⚡ Continue — Wave ${this._wavesCleared + 1}` : '⚡ Begin Challenge'}</button>`}
        </div>
        <div class="chal-card">
          <div class="chal-card-title">Today's Leaderboard</div>
          ${boardHTML}
          <div style="margin-top:0.4rem" class="chal-info">Scores are stored locally. +100 pts per wave cleared, ×wave multiplier.</div>
        </div>
        <div class="chal-info" style="text-align:center">Challenge resets daily at midnight. All local scores visible.</div>
      </div>
    `;

    this._el.querySelector('#chal-close').addEventListener('click', () => {
      this.audio.playSfx('click');
      this.manager.pop();
    });
    this._el.querySelector('#chal-start')?.addEventListener('click', () => this._startNextWave());
  }

  _startNextWave() {
    const waveData = this._waves[this._wavesCleared];
    if (!waveData) return;
    this._running = true;
    const encounter = {
      enemies: waveData.enemies,
      _zoneId: 'border_roads',
      _bossNodeId: this._wavesCleared === this._waves.length - 1 ? 'challenge_final' : null,
      isChallengeMode: true,
    };
    this.manager.push(new CombatScreen(this.manager, this.audio, encounter));
  }
}
