/**
 * StoryNewGameScreen — Mode picker + Storyteller selector + option sliders.
 *
 * Flow:
 *   TitleScreen "New Game" -> this screen
 *   Classic tab  -> CharacterBuilderScreen (existing path)
 *   Story tab    -> shows storyteller buttons + 5 option groups
 *                -> "Start" calls storyMode.newGame(opts) -> StoryMapScreen
 *
 * Mobile target: 393×852 portrait, all tap targets >= 44x44.
 * No inline CSS for static values (CLAUDE.md rule).
 */
import { createEl, removeEl, injectStyles } from '../../utils/dom.js';
import { mount as kbMount, unmount as kbUnmount } from '../../utils/keyboardNav.js';
import { CharacterBuilderScreen } from './CharacterBuilderScreen.js';
import { StorySettingsScreen } from './StorySettingsScreen.js';
import { StoryOpeningCinematicScreen } from './StoryOpeningCinematicScreen.js';

// ---------------------------------------------------------------------------
// Static data — storytellers and option groups
// ---------------------------------------------------------------------------
const STORYTELLERS = [
  { id: 'chronicler',   label: 'The Chronicler',   bio: 'Weaves consistent narrative threads, rewards investigation and lore-seeking.',    portrait: 'images/openai_v2/storyteller_chronicler_portrait.png' },
  { id: 'ash_prophet',  label: 'The Ash Prophet',  bio: 'Foretells doom; high story pressure, world corruption events, cryptic clues.',    portrait: 'images/openai_v2/storyteller_ash_prophet_portrait.png' },
  { id: 'warbringer',   label: 'The Warbringer',   bio: 'Drives relentless combat density; champion enemies, multi-wave encounters.',       portrait: 'images/openai_v2/storyteller_warbringer_portrait.png' },
  { id: 'trickster',    label: 'The Trickster',    bio: 'Subverts expectations; hidden paths, unreliable narrators, surprise reversals.',   portrait: 'images/openai_v2/storyteller_trickster_portrait.png' },
  { id: 'pilgrim',      label: 'The Pilgrim',      bio: 'Focuses on companions and faction relationships; slow burn, high approval stakes.', portrait: 'images/openai_v2/storyteller_pilgrim_portrait.png' },
  { id: 'iron_judge',   label: 'The Iron Judge',   bio: 'Strict moral ledger; every choice tracked, factions remember everything.',         portrait: 'images/openai_v2/storyteller_iron_judge_portrait.png' },
];

const OPTION_GROUPS = [
  {
    id: 'difficulty',
    label: 'Difficulty',
    options: [
      { value: 'relaxed', label: 'Relaxed' },
      { value: 'normal',  label: 'Normal' },
      { value: 'hard',    label: 'Hard' },
      { value: 'nightmare', label: 'Nightmare' },
    ],
    default: 'normal',
  },
  {
    id: 'thematicConsistency',
    label: 'Thematic Consistency',
    options: [
      { value: 'loose',    label: 'Loose' },
      { value: 'balanced', label: 'Balanced' },
      { value: 'strict',   label: 'Strict' },
    ],
    default: 'balanced',
  },
  {
    id: 'sideEventFrequency',
    label: 'Side Events',
    options: [
      { value: 'low',    label: 'Low' },
      { value: 'normal', label: 'Normal' },
      { value: 'high',   label: 'High' },
      { value: 'wild',   label: 'Wild' },
    ],
    default: 'normal',
  },
  {
    id: 'combatDensity',
    label: 'Combat Density',
    options: [
      { value: 'low',    label: 'Low' },
      { value: 'normal', label: 'Normal' },
      { value: 'high',   label: 'High' },
    ],
    default: 'normal',
  },
  {
    id: 'storyPressure',
    label: 'Story Pressure',
    options: [
      { value: 'low',    label: 'Low' },
      { value: 'normal', label: 'Normal' },
      { value: 'high',   label: 'High' },
    ],
    default: 'normal',
  },
];

// ---------------------------------------------------------------------------
// Screen class
// ---------------------------------------------------------------------------
export class StoryNewGameScreen {
  constructor(manager, audio) {
    this.manager = manager;
    this.audio   = audio;
    this._el     = null;
    // State
    this._mode             = 'classic';   // 'classic' | 'story'
    this._storytellerId    = 'chronicler';
    this._carouselIdx      = 0;           // current storyteller in carousel
    this._customSeed       = '';          // optional seed override
    this._opts             = {};
    // Seed defaults
    for (const g of OPTION_GROUPS) this._opts[g.id] = g.default;
  }

  onEnter() { this._build(); }
  onResume() {}
  onPause()  {}

  _build() {
    injectStyles('sng-styles', STYLES);
    this._el = createEl('div', 'sng-screen');
    this.manager.uiOverlay.appendChild(this._el);
    this._render();
  }

  _render() {
    const isStory = this._mode === 'story';
    this._el.innerHTML = `
      <div class="sng-panel">
        <div class="sng-title">New Game</div>

        <!-- Mode tabs -->
        <div class="sng-tabs" role="tablist" aria-label="Game mode">
          <button type="button"
                  class="sng-tab${!isStory ? ' sng-tab--active' : ''}"
                  data-mode="classic"
                  role="tab"
                  aria-selected="${!isStory}">Classic</button>
          <button type="button"
                  class="sng-tab${isStory ? ' sng-tab--active' : ''}"
                  data-mode="story"
                  role="tab"
                  aria-selected="${isStory}">Story Mode</button>
        </div>

        <!-- Classic pane -->
        <div class="sng-pane${!isStory ? ' sng-pane--active' : ''}" id="sng-pane-classic">
          <p class="sng-classic-desc">The original Emberveil experience: build your party, explore the world, conquer the rift.</p>
          <button type="button" class="sng-start sng-start--classic" id="sng-classic-start">
            Create Hero
          </button>
        </div>

        <!-- Story pane -->
        <div class="sng-pane${isStory ? ' sng-pane--active' : ''}" id="sng-pane-story">
          <p class="sng-section-label">Choose a Storyteller</p>

          <!-- Storyteller card carousel -->
          <div class="sng-carousel" aria-label="Storyteller carousel" role="region">
            <button type="button" class="sng-carousel-arrow sng-carousel-prev" id="sng-prev" aria-label="Previous storyteller">&#8592;</button>
            <div class="sng-carousel-track" id="sng-carousel-track">
              ${STORYTELLERS.map((st, i) => `
                <div class="sng-card${i === this._carouselIdx ? ' sng-card--active' : ''}" data-idx="${i}" aria-hidden="${i !== this._carouselIdx}">
                  <img class="sng-card-portrait" src="${st.portrait}" alt="${st.label}" loading="lazy">
                  <span class="sng-card-name">${st.label}</span>
                  <span class="sng-card-bio">${st.bio}</span>
                  <span class="sng-card-idx">${i + 1} / ${STORYTELLERS.length}</span>
                </div>
              `).join('')}
            </div>
            <button type="button" class="sng-carousel-arrow sng-carousel-next" id="sng-next" aria-label="Next storyteller">&#8594;</button>
          </div>

          <!-- Carousel dot indicators -->
          <div class="sng-carousel-dots" aria-hidden="true">
            ${STORYTELLERS.map((_, i) => `<span class="sng-dot${i === this._carouselIdx ? ' sng-dot--active' : ''}"></span>`).join('')}
          </div>

          <div class="sng-options">
            ${OPTION_GROUPS.map(g => `
              <div class="sng-opt-group" data-group="${g.id}">
                <span class="sng-opt-label">${g.label}</span>
                <div class="sng-opt-pills">
                  ${g.options.map(o => `
                    <button type="button"
                            class="sng-pill${this._opts[g.id] === o.value ? ' sng-pill--active' : ''}"
                            data-group="${g.id}"
                            data-value="${o.value}">
                      ${o.label}
                    </button>
                  `).join('')}
                </div>
              </div>
            `).join('')}
          </div>

          <!-- Custom seed + party preview -->
          <div class="sng-extra-row">
            <div class="sng-seed-group">
              <label class="sng-opt-label" for="sng-seed-input">Custom Seed <span class="sng-seed-hint">(optional)</span></label>
              <input type="text"
                     id="sng-seed-input"
                     class="sng-seed-input"
                     placeholder="Leave blank for random"
                     maxlength="20"
                     value="${this._customSeed}"
                     autocomplete="off"
                     spellcheck="false">
            </div>
            <button type="button" class="sng-preview-btn" id="sng-party-preview" aria-label="Preview party">
              Party Preview
            </button>
          </div>

          <button type="button" class="sng-start" id="sng-story-start">
            Continue to Character Creation
          </button>
        </div>

        <button type="button" class="sng-back" id="sng-back">← Back</button>
      </div>
    `;

    // --- Wire events ---
    // Mode tabs
    this._el.querySelectorAll('.sng-tab').forEach(btn => {
      btn.addEventListener('click', () => {
        this.audio?.playSfx('click');
        this._mode = btn.dataset.mode;
        this._render();
      });
    });

    // Carousel arrows
    this._el.querySelector('#sng-prev')?.addEventListener('click', () => {
      this.audio?.playSfx('click');
      this._carouselIdx = (this._carouselIdx - 1 + STORYTELLERS.length) % STORYTELLERS.length;
      this._storytellerId = STORYTELLERS[this._carouselIdx].id;
      this._render();
    });
    this._el.querySelector('#sng-next')?.addEventListener('click', () => {
      this.audio?.playSfx('click');
      this._carouselIdx = (this._carouselIdx + 1) % STORYTELLERS.length;
      this._storytellerId = STORYTELLERS[this._carouselIdx].id;
      this._render();
    });

    // Seed input — persist across re-renders
    const seedInput = this._el.querySelector('#sng-seed-input');
    if (seedInput) {
      seedInput.addEventListener('input', e => { this._customSeed = e.target.value; });
    }

    // Party preview
    this._el.querySelector('#sng-party-preview')?.addEventListener('click', () => {
      this.audio?.playSfx('click');
      this.manager.push(new CharacterBuilderScreen(this.manager, this.audio));
    });

    // Option pills
    this._el.querySelectorAll('.sng-pill').forEach(btn => {
      btn.addEventListener('click', () => {
        this.audio?.playSfx('click');
        this._opts[btn.dataset.group] = btn.dataset.value;
        this._render();
      });
    });

    // Classic start
    const classicStart = this._el.querySelector('#sng-classic-start');
    if (classicStart) {
      classicStart.addEventListener('click', () => {
        this.audio?.playSfx('click');
        this.manager.replace(new CharacterBuilderScreen(this.manager, this.audio));
      });
    }

    // Story start — push StoryCharBuilderScreen; save created only after accept (fix #1).
    const storyStart = this._el.querySelector('#sng-story-start');
    if (storyStart) {
      storyStart.addEventListener('click', () => {
        this.audio?.playSfx('click');
        const storyOpts = {
          storytellerId:       this._storytellerId,
          difficulty:          this._opts.difficulty,
          thematicConsistency: this._opts.thematicConsistency,
          sideEventFrequency:  this._opts.sideEventFrequency,
          combatDensity:       this._opts.combatDensity,
          storyPressure:       this._opts.storyPressure,
          customSeed:          this._customSeed.trim() || null,
        };
        this.manager.push(new StoryCharBuilderScreen(this.manager, this.audio, storyOpts));
      });
    }

    // Back
    this._el.querySelector('#sng-back')?.addEventListener('click', () => {
      this.audio?.playSfx('click');
      this.manager.pop();
    });

    kbUnmount(this._el);
    kbMount(this._el, { layout: 'mixed', focusFirst: true, onEscape: () => this.manager.pop() });
  }

  update() {}
  draw()   {}

  onExit()  { kbUnmount(this._el); removeEl(this._el); this._el = null; }
  destroy() { kbUnmount(this._el); removeEl(this._el); this._el = null; }
}

// ---------------------------------------------------------------------------
// StoryCharBuilderScreen — thin CharacterBuilderScreen subclass (fix #1, #2).
//
// Overrides _confirm() to:
//   1. Call storyMode.newGameSetup() (creates ledger + save + map).
//   2. Replace stack with StoryOpeningCinematicScreen (per-storyteller text).
//   3. Cinematic onComplete pushes StoryMapScreen.
//
// The save is NOT created until _confirm runs, so back-out leaves no orphan.
// ---------------------------------------------------------------------------

class StoryCharBuilderScreen extends CharacterBuilderScreen {
  constructor(manager, audio, storyOpts) {
    super(manager, audio);
    this._storyOpts = storyOpts || {};
    // Skip the difficulty step — Story Mode has its own difficulty picker.
    this._step = 'class';
    // Map story difficulty to CB difficulty for stat scaling.
    const d = storyOpts?.difficulty || 'normal';
    this._difficulty = d === 'relaxed' ? 'easy' : d === 'nightmare' ? 'hard' : (d || 'normal');
  }

  /** Override the final accept handler to route into Story Mode flow. */
  async _confirm() {
    if (!this._class) return; // guard: no class selected yet
    const { GameState } = await import('../../game/gameState.js');

    const isEasy = this._difficulty === 'easy';
    const hero = {
      id:          (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : `hero_${Date.now()}`,
      name:        this._name || 'Hero',
      class:       this._class.id,
      className:   this._class.name,
      appearance:  this._appearance?.id || this._class.id,
      level:       1,
      xp:          0,
      attrs:       { ...this._attrs },
      skills:      [this._class.skills[0]],
      build:       null,
      equipment:   [],
      gold:        50,
      pendingAttrPoints:   Math.max(0, this._pointsLeft),
      pendingSkillPoints:  0,
      pendingPassivePoints: 0,
      autoBuild: {
        auto_attrs:   !this._manualCharacters && (isEasy || this._autoAttrs),
        auto_passive: !this._manualCharacters && (isEasy || this._autoPassive),
        auto_active:  !this._manualCharacters && (isEasy || this._autoActive),
      },
      autoEquip: !this._manualCharacters && (isEasy || this._autoEquip),
    };

    try { (await import('../../game/items.js')).buildStartingEquipment; } catch (_) {}

    // Stats hooks.
    try { (await import('../../game/stats.js')).clearRunStatsCache(); } catch (_) {}
    try { (await import('../../game/stats.js')).recordRunStarted(); } catch (_) {}

    // Create story save via newGameSetup (ledger + map + persist).
    const { storyMode } = await import('../../story/storyMode.js');
    await storyMode.newGameSetup({
      ...this._storyOpts,
      manager: this.manager,
      audio:   this.audio,
      party:   [hero],
    });

    // Push per-storyteller cinematic → on complete → StoryMapScreen (fix #2).
    const storytellerId = this._storyOpts.storytellerId || 'chronicler';
    const cinematic = new StoryOpeningCinematicScreen(
      this.manager,
      this.audio,
      storytellerId,
      () => {
        import('./StoryMapScreen.js').then(({ StoryMapScreen }) => {
          this.manager.replace(new StoryMapScreen(this.manager, this.audio));
        });
      }
    );
    this.manager.replace(cinematic);
  }
}

// ---------------------------------------------------------------------------
// Styles — no inline CSS for static values (CLAUDE.md)
// ---------------------------------------------------------------------------
const STYLES = `
.sng-screen {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  background: rgba(5, 2, 8, 0.97);
  font-family: 'Inter', sans-serif;
  color: #f0e8d8;
  overflow-y: auto;
  padding: 1.5rem 0 6rem;
}
.sng-panel {
  width: 100%;
  max-width: 440px;
  padding: 0 1.25rem;
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}
.sng-title {
  font-family: 'Cinzel', serif;
  font-size: 1.4rem;
  font-weight: 700;
  color: #e8a020;
  text-align: center;
  letter-spacing: 0.1em;
}
/* Mode tabs */
.sng-tabs {
  display: flex;
  gap: 0;
  border: 1px solid rgba(232, 160, 32, 0.25);
  border-radius: 6px;
  overflow: hidden;
}
.sng-tab {
  flex: 1;
  padding: 0.6rem 1rem;
  min-height: 44px;
  border: none;
  background: transparent;
  color: #8a7a6a;
  font-family: 'Cinzel', serif;
  font-size: 0.8rem;
  font-weight: 600;
  letter-spacing: 0.06em;
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
}
.sng-tab--active {
  background: rgba(232, 160, 32, 0.18);
  color: #e8a020;
}
.sng-tab:hover:not(.sng-tab--active) {
  background: rgba(255, 255, 255, 0.04);
  color: #c8b89c;
}
/* Panes */
.sng-pane {
  display: none;
  flex-direction: column;
  gap: 1rem;
}
.sng-pane--active {
  display: flex;
}
.sng-classic-desc {
  font-size: 0.85rem;
  color: #8a7a6a;
  text-align: center;
  line-height: 1.5;
  margin: 0;
}
/* Section label */
.sng-section-label {
  font-family: 'Cinzel', serif;
  font-size: 0.75rem;
  color: #8a7a6a;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  margin: 0;
}
/* Storyteller grid — 2 columns on mobile */
.sng-storyteller-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.5rem;
}
.sng-st {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  padding: 0.65rem 0.6rem;
  min-height: 64px;
  border-radius: 6px;
  border: 1px solid rgba(232, 160, 32, 0.15);
  background: rgba(26, 18, 24, 0.9);
  color: #c8b89c;
  text-align: left;
  cursor: pointer;
  transition: border-color 0.15s, background 0.15s;
}
.sng-st--active {
  border-color: #e8a020;
  background: rgba(232, 160, 32, 0.14);
}
.sng-st:hover:not(.sng-st--active) {
  border-color: rgba(232, 160, 32, 0.4);
  background: rgba(232, 160, 32, 0.06);
}
.sng-st-label {
  font-family: 'Cinzel', serif;
  font-size: 0.72rem;
  font-weight: 700;
  color: #e8a020;
  line-height: 1.2;
}
.sng-st-bio {
  font-size: 0.62rem;
  color: #6a5a52;
  line-height: 1.35;
}
/* Option groups */
.sng-options {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}
.sng-opt-group {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}
.sng-opt-label {
  font-size: 0.72rem;
  color: #8a7a6a;
  letter-spacing: 0.05em;
}
.sng-opt-pills {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
}
.sng-pill {
  padding: 0.35rem 0.75rem;
  min-height: 36px;
  border-radius: 4px;
  border: 1px solid rgba(232, 160, 32, 0.2);
  background: transparent;
  color: #8a7a6a;
  font-size: 0.72rem;
  font-weight: 500;
  cursor: pointer;
  transition: border-color 0.15s, background 0.15s, color 0.15s;
}
.sng-pill--active {
  border-color: rgba(232, 160, 32, 0.7);
  background: rgba(232, 160, 32, 0.15);
  color: #e8a020;
}
.sng-pill:hover:not(.sng-pill--active) {
  border-color: rgba(232, 160, 32, 0.35);
  color: #c8b89c;
}
/* Start button */
.sng-start {
  padding: 0.85rem 1.5rem;
  min-height: 52px;
  border-radius: 7px;
  border: 1px solid rgba(232, 160, 32, 0.55);
  background: rgba(232, 160, 32, 0.16);
  color: #e8d090;
  font-family: 'Cinzel', serif;
  font-size: 0.95rem;
  font-weight: 700;
  letter-spacing: 0.1em;
  cursor: pointer;
  transition: background 0.15s;
  text-align: center;
}
.sng-start:hover {
  background: rgba(232, 160, 32, 0.3);
}
.sng-start--classic {
  margin-top: 0.5rem;
}
/* Back button (fixed bottom) */
.sng-back {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  padding: 0.85rem 1rem;
  padding-bottom: calc(0.85rem + env(safe-area-inset-bottom, 0px));
  background: rgba(5, 2, 8, 0.97);
  border-top: 1px solid rgba(232, 160, 32, 0.15);
  border-left: none;
  border-right: none;
  border-radius: 0;
  color: #8a7a6a;
  font-size: 0.85rem;
  cursor: pointer;
  text-align: center;
  z-index: 10;
  min-height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: 'Inter', sans-serif;
}
.sng-back:hover {
  color: #f0e8d8;
}

/* --- Carousel --- */
.sng-carousel {
  display: flex;
  align-items: center;
  gap: 6px;
}
.sng-carousel-arrow {
  width: 44px;
  height: 44px;
  min-width: 44px;
  min-height: 44px;
  border-radius: 6px;
  border: 1px solid rgba(232,160,32,0.2);
  background: rgba(26,18,24,0.7);
  color: #c8a060;
  font-size: 1.1rem;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.12s;
  flex-shrink: 0;
}
.sng-carousel-arrow:hover,
.sng-carousel-arrow:active { background: rgba(232,160,32,0.15); }
.sng-carousel-track {
  flex: 1;
  overflow: hidden;
  position: relative;
  min-height: 140px;
}
.sng-card {
  display: none;
  flex-direction: column;
  gap: 0.5rem;
  padding: 1rem;
  border-radius: 8px;
  border: 1px solid rgba(232,160,32,0.15);
  background: rgba(26,18,24,0.9);
  text-align: center;
  min-height: 140px;
  justify-content: center;
}
.sng-card--active {
  display: flex;
}
.sng-card-name {
  font-family: Cinzel, serif;
  font-size: 1rem;
  font-weight: 700;
  color: #e8a020;
  letter-spacing: 0.06em;
}
.sng-card-portrait {
  width: 80px;
  height: 106px;
  object-fit: cover;
  border-radius: 4px;
  margin-bottom: 0.5rem;
  align-self: center;
  display: block;
}
.sng-card-bio {
  font-size: 0.78rem;
  color: #a09080;
  line-height: 1.5;
}
.sng-card-idx {
  font-size: 11px;
  color: #5a4a3a;
}

/* Carousel dots */
.sng-carousel-dots {
  display: flex;
  gap: 6px;
  justify-content: center;
  padding: 4px 0;
}
.sng-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: rgba(200,160,80,0.2);
  transition: background 0.15s;
}
.sng-dot--active {
  background: #e8a020;
}

/* Seed + preview row */
.sng-extra-row {
  display: flex;
  gap: 0.75rem;
  align-items: flex-end;
}
.sng-seed-group {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
}
.sng-seed-hint {
  font-size: 11px;
  color: #5a4a3a;
}
.sng-seed-input {
  background: rgba(20,12,28,0.8);
  border: 1px solid rgba(232,160,32,0.2);
  border-radius: 6px;
  color: #e0d0b0;
  font-size: 14px;
  padding: 0.5rem 0.75rem;
  min-height: 44px;
  width: 100%;
  font-family: 'Courier New', monospace;
}
.sng-seed-input:focus {
  outline: 2px solid rgba(232,160,32,0.4);
  border-color: rgba(232,160,32,0.5);
}
.sng-seed-input::placeholder { color: #4a3a2a; }

.sng-preview-btn {
  padding: 0.5rem 0.75rem;
  min-height: 44px;
  border-radius: 6px;
  border: 1px solid rgba(232,160,32,0.2);
  background: rgba(26,18,24,0.8);
  color: #a09070;
  font-size: 0.78rem;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.12s;
  white-space: nowrap;
  flex-shrink: 0;
}
.sng-preview-btn:hover { background: rgba(232,160,32,0.1); color: #e8a020; }
`;
