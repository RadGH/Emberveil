/**
 * CodexScreen — World-building codex / lore compendium
 * Entries unlock when the player encounters relevant content
 * (zones entered, bosses defeated, story flags set)
 */
import { createEl, removeEl, injectStyles } from '../../utils/dom.js';
import { GameState } from '../../game/gameState.js';

const CODEX_ENTRIES = [
  // World
  {
    id: 'the_emberveil',
    category: 'World',
    title: 'The Emberveil',
    icon: '🌋',
    unlock: () => true, // always available
    body: `The Emberveil is a vast, interconnected weave of ley lines — invisible channels of raw magical energy that flow through the earth, the sky, and the space between worlds. For millennia it kept the world in balance, feeding life into the soil and binding the planes together.\n\nSomething has begun tearing it apart. The corruption spreads outward from a wound at the center of the world, unraveling the Veil thread by thread. If it is not stopped, the planes will collapse into one another — and then into nothing.`,
  },
  {
    id: 'border_roads_lore',
    category: 'World',
    title: 'The Border Roads',
    icon: '🛤️',
    unlock: gs => gs.unlockedZones?.includes('border_roads'),
    body: `The Border Roads mark the edge of the last stable frontier. Once prosperous trade routes connecting the eastern cities to the western mines, they have been overrun by goblin war bands emboldened by the growing darkness.\n\nLocal scouts call this region "the scar" — a place where the Emberveil's corruption first began to show.`,
  },
  {
    id: 'thornwood_lore',
    category: 'World',
    title: 'The Thornwood Forest',
    icon: '🌲',
    unlock: gs => gs.unlockedZones?.includes('thornwood'),
    body: `The Thornwood is an ancient forest that predates human civilization. Its oldest trees have names, though no one living knows how to pronounce them. In recent seasons, the forest has grown hostile — animals corrupted, spirits turned aggressive.\n\nThe Veil Wardens claim the forest is "dreaming badly," caught in a nightmare it cannot wake from.`,
  },
  {
    id: 'ashen_wastes_lore',
    category: 'World',
    title: 'The Ashen Wastes',
    icon: '🌋',
    unlock: gs => gs.unlockedZones?.includes('dust_roads'),
    body: `Once volcanic highlands rich with rare minerals, the Ashen Wastes are now a devastated stretch of ash dunes and sulfur springs. The Ember Plateau — its highest region — still burns with slow-moving lava flows that the locals call "the old blood."\n\nThe Veil Cultists have made this region their stronghold, drawn to the raw, unfiltered magical energy that pours from volcanic vents.`,
  },
  {
    id: 'shattered_hell_lore',
    category: 'World',
    title: 'The Shattered Hell',
    icon: '👹',
    unlock: gs => gs.unlockedZones?.includes('hell_breach'),
    body: `A fracture in the boundary between worlds tore open beneath the Ashen Wastes, creating the Hell Breach — a wound that bleeds demonic energy into the material plane. The deeper one descends, the stranger reality becomes.\n\nAt the Shattered Core, the wound is widest. This is where the Emberveil Sovereign was born: a being that is neither demon nor human, but something the corruption made from both.`,
  },
  {
    id: 'cosmic_void_lore',
    category: 'World',
    title: 'The Cosmic Void',
    icon: '🌌',
    unlock: gs => gs.unlockedZones?.includes('cosmic_rift'),
    body: `Beyond the edge of every plane lies the Cosmic Void — not a place, but an absence. The Cosmic Rift is a doorway into that void, torn open by The Unraveler as it works to dismantle the fabric of existence.\n\nTime moves strangely here. Stars that burned out a billion years ago still shine. Stars that have not yet ignited cast warm light. In the Eternal Void, even the concept of an ending has been unmade.`,
  },
  // Factions
  {
    id: 'veil_wardens',
    category: 'Factions',
    title: 'The Veil Wardens',
    icon: '🔯',
    unlock: gs => gs.storyFlags?.seer_met || gs.unlockedZones?.includes('thornwood'),
    body: `The Veil Wardens are an ancient order of mages and scholars dedicated to maintaining the Emberveil. They were the first to detect the corruption and the first to be dismissed when they raised the alarm.\n\nNow scattered, the Wardens operate in small cells across the frontier, sharing fragments of research through a hidden network of trusted messengers. Mira the Seer is one of the last Wardens still working openly.`,
  },
  {
    id: 'veil_cultists',
    category: 'Factions',
    title: 'The Veil Cult',
    icon: '👁️',
    unlock: gs => gs.unlockedZones?.includes('dust_roads'),
    body: `Where the Wardens fear the corruption, the Cult worships it. They believe the unraveling of the Emberveil is not a disaster but a transcendence — that destroying the barrier between planes will free all conscious beings from the prison of individual existence.\n\nTheir rituals involve exposure to raw ley line energy, which eventually "burns away the self." Survivors report visions of absolute unity. Most survivors do not remain survivors for long.`,
  },
  // Enemies
  {
    id: 'goblins_lore',
    category: 'Bestiary',
    title: 'Goblin Clans',
    icon: '👺',
    unlock: () => true,
    body: `The goblins of the Border Roads are not mindless savages — they are a feudal culture with complex clan hierarchies, a rich oral tradition, and an exceptionally pragmatic view of survival. When the corruption began pushing predators out of the eastern forests, the goblins simply redirected into the roads.\n\nGoblin Shamans can detect ley line fluctuations, which is why their war bands often follow the paths of corruption more accurately than trained scouts.`,
  },
  {
    id: 'demons_lore',
    category: 'Bestiary',
    title: 'Hell Demons',
    icon: '😈',
    unlock: gs => gs.unlockedZones?.includes('hell_breach'),
    body: `Demons are not creatures from another world — they are the result of intelligent beings being fully consumed by raw chaotic energy. What emerges is a being with the shape of its former self and none of the self.\n\nImps are the youngest demons, still carrying residual personality as aggression. Hell Knights were once warriors. The Demon Brutes were something else entirely, something for which no records exist.`,
  },
  {
    id: 'void_entities_lore',
    category: 'Bestiary',
    title: 'Void Entities',
    icon: '✦',
    unlock: gs => gs.unlockedZones?.includes('cosmic_rift'),
    body: `Unlike demons, Void entities were never anything else. They are not corrupted — they are what exists in the absence of existence. A Void Wraith is a consciousness that has never had a body. A Star Horror is a thought that formed in the space between dying stars.\n\nThe Unraveler is their sovereign: not a king, but a process. It does not lead the void entities — it is what they are working toward.`,
  },
  // Heroes
  {
    id: 'the_hero_classes',
    category: 'Lore',
    title: 'The Fourteen Orders',
    icon: '⚔️',
    unlock: () => true,
    body: `In the age before the corruption, fourteen martial and magical orders maintained the peace across the known world. Warriors, Mages, Paladins, Rangers, Rogues, Clerics, Bards, Necromancers, Druids, Monks, Berserkers, Warlocks, Shamans, and Hell Knights each held a portion of the world's defense.\n\nWhen the Emberveil began to fail, most orders fractured or scattered. Individual practitioners still walk the roads — many finding their way to the frontier where the need is greatest.`,
  },
];

const STYLES = `
.codex-screen {
  position: absolute; inset: 0; background: rgba(4,2,10,0.97);
  display: flex; flex-direction: column; overflow: hidden; color: #e8e0d0;
  font-family: 'Cinzel', Georgia, serif;
}
.codex-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 1rem 1rem 0.5rem; border-bottom: 1px solid rgba(255,200,80,0.25);
  flex-shrink: 0;
}
.codex-title { font-size: 1.1rem; color: #e8c840; letter-spacing: 0.1em; }
.codex-close {
  background: none; border: 1px solid rgba(255,200,80,0.4); color: #e8c840;
  padding: 0.35rem 0.8rem; border-radius: 4px; cursor: pointer; font-size: 0.85rem;
  font-family: inherit;
}
.codex-tabs {
  display: flex; gap: 0; overflow-x: auto; flex-shrink: 0;
  border-bottom: 1px solid rgba(255,200,80,0.15);
}
.codex-tab {
  padding: 0.5rem 0.9rem; font-size: 0.72rem; text-transform: uppercase;
  letter-spacing: 0.1em; cursor: pointer; color: rgba(200,180,140,0.6);
  border-bottom: 2px solid transparent; white-space: nowrap; background: none; border: none;
  font-family: inherit; transition: color 0.15s;
}
.codex-tab.active { color: #e8c840; border-bottom: 2px solid #e8c840; }

/* M328 — Mobile: replace the horizontal scroll-tab bar with a real select
   dropdown. The horizontal bar required users to side-scroll on iPhone to
   reach later categories, which they couldn't see existed. */
.codex-tab-select {
  display: none; width: 100%;
  padding: 0.6rem 0.8rem; min-height: 44px;
  background: rgba(20,12,28,0.85);
  border: 1px solid rgba(255,200,80,0.3);
  border-radius: 6px; color: #e8c840;
  font-family: inherit; font-size: 0.85rem;
  letter-spacing: 0.08em;
  margin: 0.4rem 0.6rem;
}
@media (max-width: 600px) {
  .codex-tabs { display: none; }
  .codex-tab-select { display: block; }
  /* Stack list + detail vertically on mobile so the entry list isn't crushed
     into a 38%-width column. List on top, detail below. */
  .codex-body { flex-direction: column !important; }
  .codex-list { width: 100% !important; min-width: 0 !important;
                max-height: 38vh; border-right: none;
                border-bottom: 1px solid rgba(255,200,80,0.12); }
  .codex-detail { padding: 0.85rem 1rem; }
}
.codex-body {
  flex: 1; overflow-y: auto; padding: 0;
  display: flex; flex-direction: row;
}
.codex-list {
  width: 38%; min-width: 120px; border-right: 1px solid rgba(255,200,80,0.12);
  overflow-y: auto;
}
.codex-entry-row {
  display: flex; align-items: center; gap: 0.5rem;
  padding: 0.6rem 0.75rem; cursor: pointer; border-bottom: 1px solid rgba(255,255,255,0.05);
  transition: background 0.1s;
}
.codex-entry-row:hover { background: rgba(255,200,80,0.06); }
.codex-entry-row.active { background: rgba(232,200,64,0.12); }
.codex-entry-row.locked { opacity: 0.3; cursor: default; }
.codex-entry-icon { font-size: 1.1rem; flex-shrink: 0; }
.codex-entry-name { font-size: 0.78rem; color: #e0d8c8; }
.codex-detail {
  flex: 1; padding: 1rem; overflow-y: auto;
}
.codex-detail-title { font-size: 1rem; color: #e8c840; margin-bottom: 0.5rem; }
.codex-detail-category { font-size: 0.65rem; text-transform: uppercase; letter-spacing: 0.15em; color: rgba(200,180,140,0.5); margin-bottom: 0.75rem; }
.codex-detail-body {
  font-size: 0.78rem; line-height: 1.65; color: rgba(220,210,190,0.85);
  font-family: Georgia, serif; white-space: pre-wrap;
}
.codex-locked-msg {
  color: rgba(200,180,140,0.4); font-size: 0.8rem; text-align: center;
  padding: 2rem 1rem; font-style: italic; font-family: Georgia, serif;
}
.codex-progress {
  font-size: 0.7rem; color: rgba(200,180,140,0.5); text-align: center;
  padding: 0.4rem; border-top: 1px solid rgba(255,200,80,0.1); flex-shrink: 0;
  font-family: sans-serif;
}
`;

const ALL_CATEGORIES = ['All', ...new Set(CODEX_ENTRIES.map(e => e.category))];

export class CodexScreen {
  constructor(manager, audio) {
    this.manager = manager;
    this.audio = audio;
    this._el = null;
    this._activeCategory = 'All';
    this._selectedId = null;
  }

  onEnter() { this._build(); GameState.setFlag('opened_codex', true); }
  onPause() { if (this._el) this._el.style.display = 'none'; }
  onResume() { if (this._el) this._el.style.display = 'flex'; }
  onExit() { removeEl(this._el); this._el = null; }

  _build() {
    injectStyles('codex-screen-styles', STYLES);
    this._el = createEl('div', 'codex-screen');
    this.manager.uiOverlay.appendChild(this._el);
    this._render();
  }

  _render() {
    const gs = GameState.get();
    const filtered = CODEX_ENTRIES.filter(e => this._activeCategory === 'All' || e.category === this._activeCategory);
    const unlocked = filtered.filter(e => e.unlock(gs));
    const selected = this._selectedId ? CODEX_ENTRIES.find(e => e.id === this._selectedId) : null;
    const isUnlocked = selected && selected.unlock(gs);
    const totalUnlocked = CODEX_ENTRIES.filter(e => e.unlock(gs)).length;

    this._el.innerHTML = `
      <div class="codex-header">
        <div class="codex-title">✦ Lore</div>
        <button type="button" class="codex-close" id="cod-close">✕ Close</button>
      </div>
      <div class="codex-tabs">
        ${ALL_CATEGORIES.map(c => `<button type="button" class="codex-tab${this._activeCategory === c ? ' active' : ''}" data-cat="${c}">${c}</button>`).join('')}
      </div>
      <select class="codex-tab-select" id="cod-cat-select" aria-label="Codex category">
        ${ALL_CATEGORIES.map(c => `<option value="${c}"${this._activeCategory === c ? ' selected' : ''}>${c}</option>`).join('')}
      </select>
      <div class="codex-body">
        <div class="codex-list">
          ${filtered.map(e => {
            const locked = !e.unlock(gs);
            return `<div class="codex-entry-row${locked ? ' locked' : ''}${this._selectedId === e.id ? ' active' : ''}" data-id="${e.id}">
              <div class="codex-entry-icon">${locked ? '🔒' : e.icon}</div>
              <div class="codex-entry-name">${locked ? '???' : e.title}</div>
            </div>`;
          }).join('')}
        </div>
        <div class="codex-detail">
          ${selected && isUnlocked ? `
            <div class="codex-detail-category">${selected.category}</div>
            <div class="codex-detail-title">${selected.icon} ${selected.title}</div>
            <div class="codex-detail-body">${selected.body}</div>
          ` : selected && !isUnlocked ? `
            <div class="codex-locked-msg">🔒 This entry has not yet been unlocked.<br>Continue your journey to discover more.</div>
          ` : `
            <div class="codex-locked-msg">Select an entry from the list to read it.</div>
          `}
        </div>
      </div>
      <div class="codex-progress">${totalUnlocked} / ${CODEX_ENTRIES.length} entries unlocked</div>
    `;

    this._el.querySelector('#cod-close').addEventListener('click', () => {
      this.audio.playSfx('click');
      this.manager.pop();
    });
    this._el.querySelectorAll('.codex-tab').forEach(btn => {
      btn.addEventListener('click', () => {
        this._activeCategory = btn.dataset.cat;
        this._render();
      });
    });
    // M328 — mobile select mirror.
    const sel = this._el.querySelector('#cod-cat-select');
    if (sel) sel.addEventListener('change', () => {
      this._activeCategory = sel.value;
      this._render();
    });
    this._el.querySelectorAll('.codex-entry-row:not(.locked)').forEach(row => {
      row.addEventListener('click', () => {
        this._selectedId = row.dataset.id;
        this._render();
      });
    });
  }
}
