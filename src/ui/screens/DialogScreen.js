/**
 * DialogScreen — NPC dialog with choices, skill checks, and outcomes
 * Accepts a dialog event object from mapData.DIALOG_EVENTS
 */
import { createEl, removeEl, injectStyles } from '../../utils/dom.js';
import { mount as kbMount, unmount as kbUnmount } from '../../utils/keyboardNav.js';
import { GameState } from '../../game/gameState.js';
import { getSpritePath } from '../../game/spriteUtils.js';
import { generateItem, RARITY_COLORS } from '../../game/items.js';
import { isReducedMotion } from '../../utils/motion.js';
import { TAP_ALL } from '../../game/tapWeapons.js';
import { awardXp } from '../../game/xp.js';
import { classHasTag } from '../../game/classes.js';
import { getBuild as getBuildPreset } from '../../game/buildPresets.js';

export class DialogScreen {
  constructor(manager, audio, dialogEvent, onComplete) {
    this.manager = manager;
    this.audio = audio;
    this.event = dialogEvent;
    this.onComplete = onComplete; // callback(outcome)
    this._el = null;
    this._lineIdx = 0;
    this._phase = 'LINES'; // LINES | CHOICES | OUTCOME
    this._choiceResult = null;
    this._revealTimer = 0;
    this._revealed = 0;
    this._currentText = '';
    // Branching support: if event.nodes exists, we walk a node graph.
    // Starting node id defaults to event.start || 'start'. Current node
    // is resolved lazily so linear dialogs (no .nodes) keep working.
    this._nodeId = dialogEvent.nodes ? (dialogEvent.start || 'start') : null;
  }

  _currentNode() {
    if (!this.event.nodes) return null;
    return this.event.nodes[this._nodeId] || null;
  }

  _activeLines() {
    const node = this._currentNode();
    return (node ? node.lines : this.event.lines) || [];
  }

  _activeChoices() {
    const node = this._currentNode();
    return (node ? node.choices : this.event.choices) || [];
  }

  _activeOutcomes() {
    const node = this._currentNode();
    return (node ? node.outcomes : this.event.outcomes) || {};
  }

  onEnter() { this._build(); }

  _build() {
    injectStyles('dialog-styles', DIALOG_STYLES);
    this._el = createEl('div', 'dialog-screen');
    this.manager.uiOverlay.appendChild(this._el);
    this._render();
  }

  _render() {
    const bgKey = this.event.bg || 'dungeon';
    const bgUrl = `${__APP_BASE__}images/dialog_bg/${bgKey}.jpg`;
    // M399 — when the dialog event sets showPartyOnGrid, render the party
    // sprites on the left (east-facing) and the NPC sprite on the right
    // (mirrored) above the dialog panel — like a combat staging shot. Falls
    // back to the legacy portrait card otherwise.
    const onGrid = !!this.event.showPartyOnGrid;
    const gridHtml = onGrid ? this._renderConversationGrid() : '';
    this._el.innerHTML = `
      <div class="dlg-bg-image" style="background-image:url('${bgUrl}')"></div>
      <div class="dlg-backdrop"></div>
      ${gridHtml}
      <div class="dlg-panel${onGrid ? ' dlg-panel--with-grid' : ''}">
        <div class="dlg-npc-area"${onGrid ? ' style="display:none"' : ''}>
          <div class="dlg-portrait" id="dlg-portrait">
            ${(() => {
              const sprite = this._resolveNpcPortraitSprite();
              if (sprite) {
                const src = getSpritePath(sprite, 'portrait');
                return `<img class="dlg-portrait-img" src="${src}" alt="${this.event.npcName} portrait" loading="lazy" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">
                        <div class="dlg-portrait-placeholder" style="display:none">${this._npcInitials()}</div>`;
              }
              return `<div class="dlg-portrait-placeholder">${this._npcInitials()}</div>`;
            })()}
          </div>
          <div class="dlg-npc-name">${this.event.npcName}</div>
        </div>
        ${onGrid ? `
          <div class="dlg-npc-name dlg-npc-name--grid dlg-name-banner--npc" id="dlg-name-banner-npc">${this.event.npcName}</div>
          <div class="dlg-npc-name dlg-npc-name--grid dlg-name-banner--hero" id="dlg-name-banner-hero" style="display:none"></div>
        ` : ''}
        <div class="dlg-bubble" id="dlg-bubble">
          <div class="dlg-text" id="dlg-text"></div>
          <div class="dlg-cursor" id="dlg-cursor">▼</div>
        </div>
        <div class="dlg-choices" id="dlg-choices"></div>
        <div class="dlg-skip" id="dlg-skip">Tap here or on the text to continue</div>
      </div>
    `;

    this._el.querySelector('#dlg-skip').addEventListener('click', () => {
      if (this._phase === 'LINES') this._advance();
    });

    // Tap anywhere on the bubble to advance lines
    this._el.querySelector('#dlg-bubble').addEventListener('click', () => {
      if (this._phase === 'LINES') this._advance();
    });

    this._showCurrentLine();

    // M297: keyboard navigation.
    // Space/Enter advance lines during LINES phase; when choices appear the
    // choice buttons become focusable and Enter activates the focused one.
    // Escape pops the screen (finishes the dialog).
    kbMount(this._el, {
      layout: 'vertical',
      focusFirst: false,
      onEscape: () => { this._finish(null); },
    });
    this._dlgKeyHandler = (e) => {
      if (e.key === ' ' || e.key === 'Enter') {
        if (this._phase === 'LINES') {
          // Only intercept when focus is not on a button
          if (document.activeElement && document.activeElement.tagName === 'BUTTON') return;
          e.preventDefault();
          this._advance();
        }
      }
    };
    document.addEventListener('keydown', this._dlgKeyHandler);
  }

  _npcInitials() {
    return this.event.npcName.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
  }

  /**
   * M344 — Resolve a sprite key for the NPC portrait. Priority:
   *   1. event.npcPortrait — explicit override (string sprite id).
   *   2. NAME_TO_SPRITE — hand-curated mapping for the most common named
   *      NPCs to existing class / NPC portraits.
   *   3. Slugified npcName → check NPC sprite list (silas_veilward etc).
   *   4. Class-name fallback (e.g. NPC named "Forest Warden" → druid or
   *      ranger portrait via keyword match).
   *   5. null → placeholder initials.
   */
  _resolveNpcPortraitSprite() {
    if (!this.event) return null;
    if (typeof this.event.npcPortrait === 'string' && this.event.npcPortrait) return this.event.npcPortrait;
    const name = (this.event.npcName || '').trim();
    if (!name) return null;
    // Hand-curated map. Keep stable; new entries can be added freely.
    const NAME_TO_SPRITE = {
      'Silas Veilward':   'silas_veilward',
      'Kaela Thorne':     'kaela_thorne',
      'Marek Greel':      'marek_greel',
      'Mira the Seer':    'mira_seer',
      'The Seer':         'mira_seer',
      'Forest Warden':    'druid',
      'Faded Shade':      'necromancer',
      'Hedge-Mage':       'mage',
      'Mossy Cairn':      'mage',
      'Garrison Lieutenant': 'knight',
      'Wounded Soldier':  'warrior',
      'The Guildmaster':  'paladin',
    };
    if (NAME_TO_SPRITE[name]) return NAME_TO_SPRITE[name];
    // Slug fallback — try the lowercased name with non-alphanumerics → '_'.
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
    if (slug) return slug; // file resolution handles 404s via onerror
    return null;
  }

  // M467 — resolve a line's speaker + text. Handles:
  //   - speaker:'companion' with companionIndex (party slot, default 1)
  //   - $name templating against the resolved member's name
  //   - $hero templating against party[0]
  // Falls back to NPC speaker when the requested companion slot is empty so
  // the dialog still flows in solo runs.
  _resolveLine(line) {
    const speaker = line.speaker || 'npc';
    const text = line.text || '';
    let resolved = { speaker, text, speakerName: null };
    let gs = null;
    try { gs = GameState.get(); } catch (_) {}
    const party = (gs?.party) || [];
    const heroName = party[0]?.name || 'Hero';
    let memberName = heroName;
    if (speaker === 'companion') {
      const idx = Math.max(1, line.companionIndex || 1);
      const member = party[idx];
      if (member) {
        memberName = member.name || `Companion ${idx}`;
        resolved.speaker = 'companion';
        resolved.speakerName = memberName;
      } else {
        // No companion in that slot — surface as a hero aside so the line
        // still reads naturally.
        resolved.speaker = 'hero';
        resolved.speakerName = heroName;
        memberName = heroName;
      }
    } else if (speaker === 'hero') {
      resolved.speakerName = heroName;
    } else {
      resolved.speakerName = this.event?.npcName || null;
    }
    // Template substitution
    resolved.text = text
      .replace(/\$name/g, memberName)
      .replace(/\$hero/g, heroName);
    return resolved;
  }

  _showCurrentLine() {
    const lines = this._activeLines();
    if (this._lineIdx >= lines.length) {
      this._showChoices();
      return;
    }
    const line = lines[this._lineIdx];
    // M467 — companion-speaker support and $name templating. A line with
    // speaker:'companion' resolves to party[companionIndex] (default index 1
    // — the first companion behind the hero). $name in the text is replaced
    // with the resolved member's name. If there is no member at that slot,
    // the line falls back to a generic NPC line so the dialog still flows.
    const resolved = this._resolveLine(line);
    this._currentText = resolved.text;
    this._currentSpeaker = resolved.speaker;
    this._currentSpeakerName = resolved.speakerName;
    this._revealed = 0;
    this._revealTimer = 0;

    const bubble = this._el.querySelector('#dlg-bubble');
    const cursor = this._el.querySelector('#dlg-cursor');
    if (resolved.speaker === 'hero' || resolved.speaker === 'companion') {
      bubble.classList.add('hero-bubble');
    } else {
      bubble.classList.remove('hero-bubble');
    }
    // M404+ — swap the name banner to follow the active speaker.
    // M467 — companion speaker uses the hero-side banner with the companion's
    // own name so party members feel like distinct voices.
    const npcBanner = this._el.querySelector('#dlg-name-banner-npc');
    const heroBanner = this._el.querySelector('#dlg-name-banner-hero');
    if (npcBanner && heroBanner) {
      if (resolved.speaker === 'hero' || resolved.speaker === 'companion') {
        heroBanner.textContent = resolved.speakerName || 'Hero';
        heroBanner.style.display = '';
        npcBanner.style.display = 'none';
      } else {
        npcBanner.style.display = '';
        heroBanner.style.display = 'none';
      }
    }
    cursor.style.opacity = '0';
    this._phase = 'LINES';
  }

  update(dt) {
    if (this._phase !== 'LINES') return;
    const lines = this._activeLines();
    if (this._lineIdx >= lines.length) return;

    const charsPerSec = 45;
    this._revealTimer += dt;
    const targetReveal = Math.floor(this._revealTimer * charsPerSec);
    if (targetReveal > this._revealed) {
      this._revealed = Math.min(targetReveal, this._currentText.length);
      const textEl = this._el?.querySelector('#dlg-text');
      if (textEl) textEl.textContent = this._currentText.slice(0, this._revealed);
    }

    if (this._revealed >= this._currentText.length) {
      const cursor = this._el?.querySelector('#dlg-cursor');
      if (cursor) cursor.style.opacity = '1';
    }
  }

  _advance() {
    if (this._revealed < this._currentText.length) {
      // Snap to full text
      this._revealed = this._currentText.length;
      const textEl = this._el?.querySelector('#dlg-text');
      if (textEl) textEl.textContent = this._currentText;
      const cursor = this._el?.querySelector('#dlg-cursor');
      if (cursor) cursor.style.opacity = '1';
      return;
    }
    this._lineIdx++;
    this._showCurrentLine();
  }

  _showChoices() {
    this._phase = 'CHOICES';
    const skip = this._el.querySelector('#dlg-skip');
    if (skip) skip.style.display = 'none';

    const bubble = this._el.querySelector('#dlg-bubble');
    if (bubble) bubble.style.display = 'none';
    const skip2 = this._el.querySelector('#dlg-skip');
    if (skip2) skip2.style.display = 'none';

    const choices = this._activeChoices();
    // If the current node has no choices at all, auto-finish (terminal node).
    if (!choices.length) { this._finish(null); return; }
    const gs = GameState.get();
    const partyOnly = gs.party || []; // exclude companions from skill checks
    const choicesEl = this._el.querySelector('#dlg-choices');
    // M229: skill-check rating formula. Internally the roll is attr + 1d10;
    // `pct` is the probability of the d10 beating (dc - attr). This surfaces
    // as "DC (pct%)" on the button so players can read the risk up front.
    // <= 0% stays disabled; >= 100% is guaranteed.
    const _checkPct = (attr, dc) => {
      const needed = dc - attr;
      if (needed <= 1) return 100;
      if (needed > 10) return 0;
      return (11 - needed) * 10;
    };

    choicesEl.innerHTML = choices.map((c, i) => {
      let disabled = false;
      let scPct = null;
      if (c.skillCheck) {
        const stat = c.skillCheck.stat.toUpperCase();
        const maxStat = Math.max(0, ...partyOnly.map(m => m?.attrs?.[stat] || 0));
        scPct = _checkPct(maxStat, c.skillCheck.dc);
        if (scPct <= 0) disabled = true;
      }
      // `requires` — hard gate. Supports stat mins (e.g. charisma: 5),
      // gold thresholds (gold: 10), a game-state flag (flag: 'name'),
      // M304: partyClass (class name), inventoryItem (baseKey), nested stat object,
      // and flag2 (second flag requirement).
      // M343 — capture the reason for being disabled so the rendered button
      // can show a small "Requires: …" hint instead of being silently
      // greyed out (the user reported clicking Veil Crack's "Look through
      // the lens" with no idea why it was disabled).
      let disabledReason = '';
      if (c.requires) {
        for (const [k, v] of Object.entries(c.requires)) {
          if (k === 'flag' || k === 'flag2') {
            if (!gs.storyFlags?.[v]) { disabled = true; disabledReason = `Requires: story flag '${v}'`; }
          } else if (k === 'gold') {
            if ((gs.gold || 0) < v) { disabled = true; disabledReason = `Requires: ${v} gold`; }
          } else if (k === 'partyClass') {
            const allMems = [...(gs.party || []), ...(gs.companions || [])];
            const has = allMems.some(m => (m?.class || m?.cls || '').toLowerCase() === v.toLowerCase());
            if (!has) { disabled = true; disabledReason = `Requires: a ${v} in the party`; }
          } else if (k === 'partyTag') {
            // M399 — gate by class tag (e.g. "healer", "arcane", "holy") so
            // every flavor of healer can tend the wounded soldier rather
            // than only Cleric. Accepts a single tag or an OR-list.
            const allMems = [...(gs.party || []), ...(gs.companions || [])];
            const wanted = Array.isArray(v) ? v : [v];
            const has = allMems.some(m => classHasTag(m?.class || m?.cls, wanted));
            if (!has) {
              const label = wanted.length === 1 ? wanted[0] : wanted.join(' or ');
              disabled = true; disabledReason = `Requires: a ${label} in the party`;
            }
          } else if (k === 'inventoryItem') {
            // Check loose inventory AND any equipped slot — quest items often
            // auto-equip (e.g. warden_charm into a ring slot) and the chain
            // dialog should still find them.
            const matches = it => it && (it.questKey || it.baseKey || it.type) === v;
            const inv = gs.inventory || [];
            let hasIt = inv.some(matches);
            if (!hasIt) {
              const allMems = [...(gs.party || []), ...(gs.companions || [])];
              hasIt = allMems.some(m => Object.values(m?.equipment || {}).some(matches));
            }
            if (!hasIt) { disabled = true; disabledReason = `Requires: '${v}' in inventory`; }
          } else if (k === 'stat' && v && typeof v === 'object') {
            const statKey = (v.stat || '').toUpperCase();
            const minVal = v.min || 0;
            const maxStat = Math.max(0, ...partyOnly.map(m => m?.attrs?.[statKey] || 0));
            if (maxStat < minVal) { disabled = true; disabledReason = `Requires: ${statKey} ${minVal}+`; }
          } else {
            const stat = k.toUpperCase();
            const maxStat = Math.max(0, ...partyOnly.map(m => m?.attrs?.[stat] || 0));
            if (maxStat < v) { disabled = true; disabledReason = `Requires: ${stat} ${v}+`; }
          }
        }
      }
      return `
      <button type="button" class="dlg-choice${c.skillCheck ? ' skill-check' : ''}${disabled ? ' disabled' : ''}" data-idx="${i}"${disabled ? ' disabled' : ''}>
        ${c.skillCheck ? `<span class="sc-badge">${c.skillCheck.stat.toUpperCase()} ${c.skillCheck.dc} (${scPct}%)</span>` : ''}
        ${c.text}
        ${disabled && disabledReason ? `<div class="dlg-req">${disabledReason}</div>` : ''}
      </button>
    `;}).join('');

    choicesEl.querySelectorAll('.dlg-choice').forEach(btn => {
      btn.addEventListener('click', () => {
        if (btn.disabled) return;
        this.audio.playSfx('click');
        const idx = parseInt(btn.dataset.idx);
        this._selectChoice(idx);
      });
    });

    // M297: auto-focus the first enabled choice button so keyboard users can
    // immediately press Enter or Arrow to navigate.
    const firstEnabled = choicesEl.querySelector('.dlg-choice:not([disabled])');
    if (firstEnabled) requestAnimationFrame(() => firstEnabled.focus({ preventScroll: true }));
  }

  _selectChoice(idx) {
    const choice = this._activeChoices()[idx];
    const gs = GameState.get();
    const hero = gs.party[0];

    let outcomeKey = choice.outcome;

    // Handle skill check — use HIGHEST party-member stat (companions excluded)
    let _skillCheckPass = null;
    if (choice.skillCheck) {
      const stat = choice.skillCheck.stat.toUpperCase(); // DEX, STR, INT
      const dc = choice.skillCheck.dc;
      const partyOnly = gs.party || [];
      const attrVal = Math.max(0, ...partyOnly.map(m => m?.attrs?.[stat] || 0)) || 8;
      const roll = attrVal + Math.floor(Math.random() * 10) + 1;
      _skillCheckPass = roll >= dc;
      outcomeKey = _skillCheckPass ? choice.outcomes.pass : choice.outcomes.fail;
    }

    // Apply immediate effects
    if (choice.effect) {
      if (choice.effect.gold) GameState.addGold(choice.effect.gold);
    }

    // M236: skill-check roll animation. Flash PASS (green) or FAIL (red)
    // over the dialog, then continue to the outcome. 650ms — long enough
    // to register, short enough to not slow down the flow.
    if (_skillCheckPass !== null) {
      this._flashSkillCheckResult(_skillCheckPass);
    }

    // Branching: if the choice has a `next` node and no outcome text,
    // apply its inline reward and jump directly to the next node.
    if (choice.next && !outcomeKey) {
      this._applyReward(choice.reward);
      if (choice.setFlag) GameState.setFlag(choice.setFlag, true);
      this._gotoNode(choice.next);
      return;
    }

    this._showOutcome(outcomeKey, choice);
  }

  // M236: skill-check roll result flash. Adds an absolute-positioned banner
  // with PASS / FAIL text that fades in + pops. Removed after 650ms.
  _flashSkillCheckResult(pass) {
    const host = this._el || document.body;
    const el = document.createElement('div');
    el.className = 'sc-flash';
    el.textContent = pass ? 'PASS' : 'FAIL';
    const _rm = isReducedMotion();
    el.style.cssText = [
      'position:absolute;top:40%;left:50%;transform:translate(-50%,-50%) scale(1)',
      'font-family:Cinzel,serif;font-size:3rem;font-weight:900;letter-spacing:0.1em',
      `color:${pass ? '#8cff8c' : '#ff7060'};text-shadow:0 0 18px ${pass ? '#40c870' : '#c04030'}`,
      'z-index:2000;pointer-events:none;opacity:0',
      _rm ? '' : 'transition:opacity 0.18s ease-out, transform 0.3s cubic-bezier(0.25,1.6,0.4,1)'
    ].join(';');
    host.appendChild(el);
    requestAnimationFrame(() => {
      el.style.opacity = '1';
      if (!_rm) el.style.transform = 'translate(-50%,-50%) scale(1)';
    });
    setTimeout(() => {
      el.style.opacity = '0';
      setTimeout(() => el.remove(), 200);
    }, 650);
  }

  _applyReward(reward) {
    if (!reward) return [];
    const out = [];
    if (reward.gold) {
      GameState.addGold(reward.gold);
      out.push(`${reward.gold > 0 ? '+' : ''}${reward.gold} Gold`);
    }
    // M399 — buildLoot: 'jewelry' | 'weapon' | 'armor'. Resolves at apply time
    // against the player's chosen build preset so the prologue gift fits the
    // role they're building toward.
    // Bug fix: was doing gs.inventory.push(built) which bypassed addToInventory
    // and skipped auto-equip. Now calls addToInventory so auto-equip fires for
    // Easy-mode players. For weapon gifts (prologue starting weapon), also
    // explicitly equip to the weapon slot if no weapon is currently equipped —
    // this handles Normal/Hard mode where autoEquip is false.
    if (reward.buildLoot) {
      try {
        const gs = GameState.get();
        const hero = gs.party?.[0];
        const built = this._buildLootItem(reward.buildLoot, hero);
        if (built) {
          GameState.addToInventory(built);
          // Prologue weapon gift: equip immediately if the hero's weapon slot is empty.
          if (reward.buildLoot === 'weapon' && hero) {
            const eqp = hero.equipment || {};
            if (!eqp.weapon) {
              eqp.weapon = built;
              hero.equipment = eqp;
              // Remove from inventory since it's now equipped.
              GameState.removeFromInventory(built.id);
            }
          }
          // M478b — color the name by actual rarity, same as the regular
          // reward.item path (line 583). Previously every buildLoot gift
          // rendered in the default .dlg-reward-line gold, which read as
          // "rare" even when the item was magic/blue. The prologue Silas
          // bow surfaced this.
          const color = `var(--rarity-${built.rarity || 'magic'}, #f0e8d8)`;
          out.push(`+<span style="color:${color}">${built.name}</span>`);
        }
      } catch (e) { console.warn('[buildLoot] failed:', e); }
    }
    if (reward.xp) {
      // M256: route through awardXp so dialog rewards honor the global
      // baseline multiplier + cheat multiplier + trigger level-up checks.
      const gs = GameState.get();
      awardXp(gs.party, reward.xp);
      out.push(`+${reward.xp} XP`);
    }
    if (reward.companion) {
      const gs = GameState.get();
      const partyLevel = Math.max(1, Math.round(
        gs.party.reduce((s, m) => s + (m.level || 1), 0) / Math.max(1, gs.party.length)
      ));
      const tpl = reward.companion;
      const attrs = { ...(tpl.attrs || { STR: 8, DEX: 8, INT: 8, CON: 8 }) };
      const member = {
        ...tpl,
        id: tpl.id + '_' + Date.now(),
        templateId: tpl.id,
        class: 'companion',
        className: tpl.className || 'Companion',
        isCompanion: true,
        level: tpl.level || partyLevel,
        attrs,
        hp: 50 + attrs.CON * 10,
        maxHp: 50 + attrs.CON * 10,
        mp: 30 + attrs.INT * 8,
        maxMp: 30 + attrs.INT * 8,
        xp: 0,
        pendingAttrPoints: 0,
        pendingSkillPoints: 0,
        pendingPassivePoints: 0,
        equipment: {},
        skills: [],
      };
      if (!GameState.addToCompanions(member)) {
        GameState.addToBench(member);
        out.push(`Companion roster full — <span style="color:#c090ff">${member.name}</span> sent to reserves`);
      } else {
        out.push(`New companion: <span style="color:#c090ff">${member.name}</span>`);
      }
    }
    if (reward.tapItem) {
      const def = TAP_ALL[reward.tapItem];
      GameState.addTapItem(reward.tapItem);
      // Auto-equip if slot is empty
      if (def?.type === 'weapon' && !GameState.getEquippedTapWeapon()) GameState.equipTapWeapon(reward.tapItem);
      if (def?.type === 'utility' && !GameState.getEquippedTapUtility()) GameState.equipTapUtility(reward.tapItem);
      out.push(`Acquired Tap Item: <span style="color:${def?.effectColor || '#e8a040'}">${def?.name || reward.tapItem}</span>`);
    }
    if (reward.item) {
      // M400+: respect the requested base key instead of hard-coding 'ring'.
      // Caller can pass either a base key string ('healing_potion', 'sword'...)
      // or use itemName / itemDesc to override the generated label/desc.
      const baseKey = typeof reward.item === 'string' ? reward.item : 'ring';
      let rewardItem = generateItem(baseKey, reward.itemRarity || 'magic', 'medium', undefined);
      const fellBackToRing = !rewardItem;
      if (!rewardItem) rewardItem = generateItem('ring', 'magic', 'medium', undefined);
      if (rewardItem) {
        rewardItem.name = reward.itemName || rewardItem.name;
        if (reward.itemDesc) rewardItem.description = reward.itemDesc;
        // Quest items use a logical key (e.g. 'warden_charm') that isn't a real
        // base. Tag the generated item so `requires.inventoryItem` checks find
        // it even when we fell back to a generic 'ring' base.
        if (fellBackToRing) rewardItem.questKey = baseKey;
        GameState.addToInventory(rewardItem);
        const color = `var(--rarity-${rewardItem.rarity}, #f0e8d8)`;
        out.push(`Acquired: <span style="color:${color}">${rewardItem.name}</span>`);
      }
    }
    // M400+: heal/damage rewards from randomEvents.js (was previously lost
    // because _applyReward only handled gold/xp/item paths).
    if (reward.heal) {
      const gs = GameState.get();
      for (const m of (gs.party || [])) {
        if (m && (m.hp || 0) > 0) m.hp = Math.min(m.maxHp || m.hp, (m.hp || 0) + reward.heal);
      }
      out.push(`<span style="color:#a0e0b0">+${reward.heal} HP</span>`);
    }
    if (reward.damage) {
      const gs = GameState.get();
      for (const m of (gs.party || [])) {
        if (m && (m.hp || 0) > 0) m.hp = Math.max(1, (m.hp || 0) - reward.damage);
      }
      out.push(`<span style="color:#e07060">-${reward.damage} HP</span>`);
    }
    if (reward.setFlag) {
      try { GameState.setFlag(reward.setFlag, true); } catch (_) {}
    }
    return out;
  }

  _gotoNode(nodeId) {
    this._nodeId = nodeId;
    this._lineIdx = 0;
    this._phase = 'LINES';
    // Optional per-node speaker override
    const node = this._currentNode();
    if (node?.npcName) {
      const nameEl = this._el?.querySelector('.dlg-npc-name');
      if (nameEl) nameEl.textContent = node.npcName;
    }
    // Re-show bubble and skip prompt in case they were hidden.
    const bubble = this._el?.querySelector('#dlg-bubble');
    if (bubble) bubble.style.display = '';
    const skip = this._el?.querySelector('#dlg-skip');
    if (skip) skip.style.display = '';
    const choicesEl = this._el?.querySelector('#dlg-choices');
    if (choicesEl) choicesEl.innerHTML = '';
    this._showCurrentLine();
  }

  // M399 — render a conversation staging grid: party portraits left
  // (east-facing) + NPC right (mirrored). Approximates the combat 2.5D
  // grid framing without bringing in the EvBattlefield engine. The
  // sprite paths fall back to the SVG portrait if the spritecook png
  // doesn't exist for a given character.
  _renderConversationGrid() {
    const gs = GameState.get?.() || {};
    const party = (gs.party || []).slice(0, 4);
    const npcSprite = this.event.npcAppearance || this._resolveNpcPortraitSprite() || 'silas_veilward';
    const heroTile = (m, idx) => {
      const sprite = m.appearance || m.class || 'warrior';
      return `<div class="dlg-conv-tile dlg-conv-tile--hero" style="--idx:${idx}">
        <img class="dlg-conv-sprite" src="${getSpritePath(sprite, 'east')}"
             alt="${m.name}" loading="lazy"
             onerror="this.onerror=null;this.src='${__APP_BASE__}images/sprites/fallback_portrait.svg'">
        <div class="dlg-conv-name">${m.name}</div>
      </div>`;
    };
    return `
      <div class="dlg-conv-grid">
        <div class="dlg-conv-side dlg-conv-side--left">
          ${party.map(heroTile).join('')}
        </div>
        <div class="dlg-conv-side dlg-conv-side--right">
          <div class="dlg-conv-tile dlg-conv-tile--npc">
            <img class="dlg-conv-sprite dlg-conv-sprite--mirror"
                 src="${getSpritePath(npcSprite, 'east')}"
                 alt="${this.event.npcName}" loading="lazy"
                 onerror="this.onerror=null;this.src='${getSpritePath(npcSprite, 'south')}';this.onerror=function(){this.src='${__APP_BASE__}images/sprites/fallback_portrait.svg'}">
            <div class="dlg-conv-name">${this.event.npcName}</div>
          </div>
        </div>
      </div>
    `;
  }

  // M399 — synthesize a build-aware loot item for prologue gifts.
  _buildLootItem(kind, hero) {
    if (!hero) return null;
    const build = getBuildPreset(hero.class, hero.build);
    if (kind === 'jewelry') {
      // Pick whichever caster trinket fits the build's INT weight.
      // M400+: 'amulet' is NOT a valid base key — ARMOR_BASES uses 'necklace'
      // (or 'silver_amulet'). Casters previously got a silently-null reward
      // because generateItem() returned null on the unknown base key.
      const isCaster = (build?.targetAttrs?.INT || 0) >= 30;
      const baseKey = isCaster ? 'silver_amulet' : 'ring';
      let item = generateItem(baseKey, 'magic', 'medium');
      // Final safety net — fall back to a plain ring if anything went wrong.
      if (!item) item = generateItem('ring', 'magic', 'medium');
      if (item) item.name = isCaster ? "Veil-Touched Amulet" : "Sigil Ring of the Lost Scout";
      return item;
    }
    if (kind === 'weapon') {
      // M442 — Walk the build's weapon preference list in order. Stop at the
      // first base that actually resolves to a real WEAPON_BASES entry. Map
      // the legacy preset keys ('2h_sword' / '2h_axe') to their canonical
      // WEAPON_BASES keys ('sword2h' / 'axe2h') so the prologue Silas gift
      // (and any other reward { buildLoot: 'weapon' }) returns a fitting
      // weapon for the character's chosen build instead of silently null'ing
      // and dropping just the XP. Add a shield when the build prefers one.
      const KEY_ALIAS = {
        '2h_sword': 'sword2h',
        '2h_axe':   'axe2h',
        'two_handed_sword': 'sword2h',
        'two_handed_axe':   'axe2h',
        'mace':     'iron_mace',
      };
      const SKIP_KEYS = new Set(['unarmed']); // monk preference; no item drop
      const tryKeys = [];
      for (const k of (build?.weapons || [])) {
        if (!k || SKIP_KEYS.has(k)) continue;
        tryKeys.push(KEY_ALIAS[k] || k);
      }
      // Final fallbacks: the hero's currently-equipped weapon, then a sword.
      const equippedKey = hero?.equipment?.weapon?.baseKey;
      if (equippedKey) tryKeys.push(equippedKey);
      tryKeys.push('sword');
      let w = null;
      for (const k of tryKeys) {
        w = generateItem(k, 'magic', 'medium');
        if (w) break;
      }
      if (w) w.name = `Reliquary ${w.name}`;
      try {
        if (build?.shieldPref === 'always' || build?.shieldPref === 'sometimes') {
          // Shields only fit one-handed weapons. If the resolved weapon is
          // two-handed (e.g. greatsword build), skip the shield drop —
          // otherwise the player gets a useless shield they can't equip.
          if (!w || !w.twoHanded) {
            const sh = generateItem('buckler', 'magic', 'medium');
            if (sh) {
              sh.name = `Reliquary ${sh.name}`;
              const gs = GameState.get();
              gs.inventory = gs.inventory || [];
              gs.inventory.push(sh);
            }
          }
        }
      } catch (_) {}
      return w;
    }
    return null;
  }

  _showOutcome(outcomeKey, choice) {
    this._phase = 'OUTCOME';
    const outcome = this._activeOutcomes()?.[outcomeKey];
    if (!outcome) {
      // M473 — skill-check / requires choices in multi-node dialogs put a
      // NODE ID into outcomeKey (e.g. outcomes: { pass: 'spot_trap', fail:
      // 'walk_in' }). If that id matches a node, navigate there instead of
      // ending the dialog. This is why the Krix INT 14 check exited to the
      // map silently — the lookup missed the node-id case.
      if (outcomeKey && this.event.nodes && this.event.nodes[outcomeKey]) {
        if (choice?.setFlag) GameState.setFlag(choice.setFlag, true);
        this._applyReward(choice?.reward);
        this._gotoNode(outcomeKey);
        return;
      }
      // No outcome prose — if the choice has a next node, jump to it.
      if (choice?.next) { this._applyReward(choice.reward); this._gotoNode(choice.next); return; }
      this._finish(outcomeKey);
      return;
    }

    // Apply outcome rewards (and any choice-level reward attached to the pick)
    if (outcome.setFlag) GameState.setFlag(outcome.setFlag, true);
    if (choice?.setFlag) GameState.setFlag(choice.setFlag, true);
    const rewards = [
      ...this._applyReward(outcome.reward),
      ...this._applyReward(choice?.reward),
    ];

    // Re-show the bubble (it was hidden during choices phase)
    const bubble = this._el?.querySelector('#dlg-bubble');
    if (bubble) bubble.style.display = '';

    const textEl = this._el?.querySelector('#dlg-text');
    if (textEl) textEl.textContent = outcome.text;
    const cursor = this._el?.querySelector('#dlg-cursor');
    if (cursor) cursor.style.opacity = '0';

    const choicesEl = this._el.querySelector('#dlg-choices');
    choicesEl.innerHTML = `
      ${rewards.length ? `<div class="dlg-rewards">${rewards.map(r => `<div class="dlg-reward-line">${r}</div>`).join('')}</div>` : ''}
      <button type="button" class="dlg-choice dlg-continue" id="dlg-done">Continue</button>
    `;
    this._el.querySelector('#dlg-done')?.addEventListener('click', () => {
      this.audio.playSfx('click');
      const nextId = outcome.next || choice?.next;
      if (nextId && this.event.nodes && this.event.nodes[nextId]) {
        this._gotoNode(nextId);
        return;
      }
      this._finish(outcomeKey, outcome);
    });
  }

  _finish(outcomeKey, outcome) {
    // Pop dialog first, THEN fire callback (so callback can push new screens correctly)
    this.manager.pop();
    if (this.onComplete) this.onComplete(outcomeKey, outcome);
  }

  draw() {}
  onExit() {
    if (this._dlgKeyHandler) { document.removeEventListener('keydown', this._dlgKeyHandler); this._dlgKeyHandler = null; }
    if (this._el) kbUnmount(this._el);
    removeEl(this._el); this._el = null;
  }
  destroy() {
    if (this._dlgKeyHandler) { document.removeEventListener('keydown', this._dlgKeyHandler); this._dlgKeyHandler = null; }
    if (this._el) kbUnmount(this._el);
    removeEl(this._el); this._el = null;
  }
}

const DIALOG_STYLES = `
.dialog-screen {
  position: absolute; inset: 0; display: flex; align-items: flex-end;
  font-family: 'Inter', sans-serif; color: #f0e8d8;
  background: #000;
}
.dlg-bg-image {
  position: absolute; inset: 0; background-size: cover; background-position: center;
  pointer-events: none;
}
.dlg-backdrop {
  position: absolute; inset: 0; background: linear-gradient(to top, rgba(5,2,8,0.48) 0%, rgba(5,2,8,0.36) 30%, rgba(5,2,8,0) 50%, rgba(5,2,8,0) 100%);
  pointer-events: none;
}
.dlg-panel {
  /* M494b — was z-index:2, BELOW the conversation grid (z5) + name banners
     (z6), so long dialog text rendered behind the character sprites and
     their name labels overlapped it. Panel now sits above the grid; the
     opaque bubble cleanly covers sprites where they'd overlap while the
     transparent panel gutters still let the sprites show through. */
  position: relative; z-index: 8; width: 100%; padding: 0 0 2rem 0;
  display: flex; flex-direction: column; gap: 0;
  max-width: 600px; margin: 0 auto;
}
.dlg-npc-area {
  display: flex; align-items: center; gap: 0.75rem; padding: 0 1.25rem 0.5rem;
}
.dlg-portrait {
  width: 64px; height: 64px; border-radius: 50%; border: 2px solid rgba(232,160,32,0.4);
  background: rgba(26,18,24,0.9); overflow: hidden; flex-shrink: 0;
  display: flex; align-items: center; justify-content: center;
}
/* M344 — actual NPC art when available; falls back to initials placeholder. */
.dlg-portrait-img {
  width: 100%; height: 100%; object-fit: cover;
  image-rendering: auto;
}
.dlg-portrait-placeholder {
  font-family: 'Cinzel', serif; font-size: 1.15rem; font-weight: 700;
  color: #e8a020; letter-spacing: 0.05em;
  display: flex; align-items: center; justify-content: center;
  width: 100%; height: 100%;
}
.dlg-npc-name {
  font-family: 'Cinzel', serif; font-size: 0.85rem; font-weight: 700;
  color: #e8a020; letter-spacing: 0.08em;
}
.dlg-bubble {
  /* M494b — fully opaque so character sprites never bleed through the
     dialog text on long passages. */
  background: rgb(12,8,14); border: 1px solid rgba(232,160,32,0.2);
  border-radius: 12px 12px 4px 4px; padding: 1rem 1.25rem 0.75rem;
  margin: 0 0.75rem; min-height: 80px; position: relative;
  transition: border-color 0.2s; cursor: pointer;
}
.dlg-bubble.hero-bubble {
  background: rgb(8,12,22); border-color: rgba(64,120,200,0.3);
}
.dlg-text {
  font-size: 0.88rem; line-height: 1.65; color: #e8e0d0;
  min-height: 3.3em;
}
.dlg-cursor {
  position: absolute; bottom: 0.4rem; right: 0.75rem;
  font-size: 0.6rem; color: #e8a020; opacity: 0;
  animation: blink 1s step-end infinite;
}
@keyframes blink { 0%,100%{opacity:1} 50%{opacity:0} }
.dlg-choices {
  display: flex; flex-direction: column; gap: 0.4rem;
  padding: 0.5rem 0.75rem 0; margin-top: 0.4rem;
}
.dlg-choice {
  background: rgba(20,14,18,0.92); border: 1px solid rgba(232,160,32,0.18);
  border-radius: 8px; padding: 0.65rem 1rem; color: #e8e0d0;
  font-size: 0.82rem; font-family: 'Inter', sans-serif;
  text-align: left; cursor: pointer; min-height: 44px;
  transition: background 0.15s, border-color 0.15s;
  display: flex; align-items: center; gap: 0.6rem;
}
.dlg-choice:hover:not(.disabled) { background: rgba(232,160,32,0.1); border-color: rgba(232,160,32,0.35); }
/* M343 — disabled choices keep readable opacity + show the requirement
   reason so the player knows WHY they can't pick the option. */
.dlg-choice.disabled { opacity: 0.6; cursor: not-allowed; filter: grayscale(0.4); }
.dlg-choice .dlg-req {
  display: block; margin-top: 0.35rem; padding: 0.2rem 0.45rem;
  background: rgba(192,64,48,0.12); border: 1px solid rgba(192,64,48,0.35);
  border-radius: 4px; color: #f0a090;
  font-size: 0.7rem; letter-spacing: 0.04em; font-style: italic;
}
.dlg-choice.skill-check { border-color: rgba(64,120,200,0.3); }
.dlg-choice.skill-check:hover { background: rgba(64,120,200,0.1); border-color: rgba(64,120,200,0.5); }
.sc-badge {
  background: rgba(64,120,200,0.25); border: 1px solid rgba(64,120,200,0.4);
  border-radius: 4px; padding: 0.1rem 0.4rem; font-size: 0.65rem; font-weight: 700;
  color: #80b0f0; flex-shrink: 0; letter-spacing: 0.08em; text-transform: uppercase;
  white-space: nowrap;
}
.dlg-rewards {
  background: rgba(232,160,32,0.08); border: 1px solid rgba(232,160,32,0.25);
  border-radius: 8px; padding: 0.5rem 0.75rem; margin-bottom: 0.3rem;
}
.dlg-reward-line {
  font-size: 0.78rem; color: #e8c840; font-weight: 600;
  padding: 0.15rem 0; font-family: 'Cinzel', serif;
}
.dlg-continue { color: #e8a020; border-color: rgba(232,160,32,0.3); }
.dlg-continue:hover { background: rgba(232,160,32,0.12); border-color: rgba(232,160,32,0.5); }
.dlg-skip {
  text-align: center; font-size: 0.75rem; color: rgba(240,232,216,0.55);
  padding: 0.75rem 1rem; cursor: pointer; letter-spacing: 0.08em;
  min-height: 44px; display: flex; align-items: center; justify-content: center;
  background: rgba(232,160,32,0.06); border-radius: 8px; margin: 0.25rem 0.75rem 0;
  border: 1px solid rgba(232,160,32,0.12);
}
.dlg-skip:hover { color: rgba(240,232,216,0.9); background: rgba(232,160,32,0.12); }

/* M399 — Conversation grid: party left, NPC right (mirrored).
   M402 — center the two sides with a fixed gap and bump the desktop sprite
   sizes 2x; the previous space-between layout pushed party + NPC to the
   far edges of the screen and read as disconnected. */
.dlg-conv-grid {
  position: absolute; top: 8%; left: 0; right: 0; bottom: 42%;
  display: flex; justify-content: center; align-items: flex-end;
  gap: 100px; padding: 0 4%; pointer-events: none; z-index: 5;
}
.dlg-conv-side {
  display: flex; align-items: flex-end; gap: 0.75rem;
}
.dlg-conv-side--left { justify-content: flex-end; }
.dlg-conv-side--right { justify-content: flex-start; }
.dlg-conv-tile {
  position: relative; display: flex; flex-direction: column; align-items: center;
}
/* Desktop default — 2x the previous size so sprites read clearly with the
   centered + gap layout. Mobile breakpoint below shrinks them back down. */
.dlg-conv-sprite {
  width: 168px; height: 336px;
  object-fit: contain; object-position: bottom center;
  image-rendering: pixelated; image-rendering: crisp-edges;
  filter: drop-shadow(0 6px 10px rgba(0,0,0,0.55));
}
.dlg-conv-sprite--mirror { transform: scaleX(-1); }
.dlg-conv-tile--npc .dlg-conv-sprite { width: 200px; height: 400px; }
.dlg-conv-name {
  font-family: 'Cinzel', serif; font-size: 0.78rem; color: #f0e8d8;
  background: rgba(8, 4, 16, 0.7); padding: 2px 8px; border-radius: 3px;
  margin-top: 4px; white-space: nowrap;
  text-shadow: 0 1px 2px rgba(0,0,0,0.8);
}
/* M402 — NPC name lives in a dedicated banner above the dialog bubble so it
   no longer overlaps the line text. The bubble below pushes down a touch
   to make room. */
.dlg-npc-name--grid {
  position: absolute;
  bottom: 100%;
  top: auto;
  margin-bottom: -22px;
  transform: none;
  right: 14px;
  left: auto;
  font-family: 'Cinzel', serif;
  color: #e8c840; font-size: 1rem; letter-spacing: 0.08em;
  background: linear-gradient(180deg, rgba(40,28,8,0.95), rgba(20,14,4,0.95));
  padding: 0.35rem 1.2rem; border: 1px solid rgba(232,200,64,0.45);
  border-radius: 5px; z-index: 6; pointer-events: none;
  box-shadow: 0 2px 8px rgba(0,0,0,0.6);
}
.dlg-npc-name--grid.dlg-name-banner--hero {
  left: 14px;
  right: auto;
}
.dlg-panel--with-grid { padding-top: 1.6rem; }
@media (max-width: 700px) {
  .dlg-conv-grid { gap: 24px; }
  .dlg-conv-sprite { width: 80px; height: 160px; }
  .dlg-conv-tile--npc .dlg-conv-sprite { width: 96px; height: 192px; }
  .dlg-conv-name { font-size: 0.65rem; }
  .dlg-npc-name--grid { font-size: 0.85rem; padding: 0.25rem 0.7rem; }
}
`;
