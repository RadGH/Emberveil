/* Emberveil — Site bundle (vanilla JS port of the Ember/Rune React reference)
 *
 * Composes the front-page sections (Hero, Classes, Combat, Companions, Charts,
 * Acts, News) using DOM APIs only — no React, no Babel, no JSX. All copy + counts
 * come from live data files (assets/data/live.json + news/news.json), never
 * hardcoded.
 *
 * Loaded by index.html at the end of <body>. Each section is mounted into a
 * placeholder element by id (#hero-mount, #classes-mount, etc.).
 *
 * Effects:
 *   - Parallax hero clouds + mountains
 *   - Drifting ember particle layer (intensity 0.5)
 *   - Rune-circle custom cursor on desktop
 *   - Reveal-on-scroll for `.reveal` elements
 */
(function () {
  'use strict';

  // ────────────────────────────────────────────────────────────── DATA LOAD ──
  const DATA_URL = './assets/data/live.json';
  const NEWS_URL = './news/news.json';
  const CLASSES_URL = './assets/data/classes.json';
  const BUILDS_URL = './assets/data/builds.json';
  const COMPANIONS_URL = './assets/data/companions.json';
  const SKILLS_URL = './assets/data/skills.json';

  let LIVE = null;
  let NEWS = [];
  let CLASSES = [];
  let BUILDS = [];
  let COMPANIONS = [];
  let SKILLS = [];

  async function loadData() {
    try {
      const [live, news, classes, builds, companions, skills] = await Promise.all([
        fetch(DATA_URL, { cache: 'no-cache' }).then(r => r.ok ? r.json() : null),
        fetch(NEWS_URL, { cache: 'no-cache' }).then(r => r.ok ? r.json() : []),
        fetch(CLASSES_URL, { cache: 'no-cache' }).then(r => r.ok ? r.json() : []).catch(() => []),
        fetch(BUILDS_URL, { cache: 'no-cache' }).then(r => r.ok ? r.json() : []).catch(() => []),
        fetch(COMPANIONS_URL, { cache: 'no-cache' }).then(r => r.ok ? r.json() : []).catch(() => []),
        fetch(SKILLS_URL, { cache: 'no-cache' }).then(r => r.ok ? r.json() : []).catch(() => []),
      ]);
      LIVE = live;
      NEWS = Array.isArray(news) ? news : [];
      CLASSES = Array.isArray(classes) ? classes : (classes ? Object.values(classes) : []);
      BUILDS = Array.isArray(builds) ? builds : (builds ? Object.values(builds) : []);
      COMPANIONS = Array.isArray(companions) ? companions : (companions ? Object.values(companions) : []);
      SKILLS = Array.isArray(skills) ? skills : (skills ? Object.values(skills) : []);
    } catch (e) {
      console.error('[site] failed to load live data', e);
    }
  }

  // ────────────────────────────────────────────────── LIVE COUNTS ───
  // Recompute counts from authoritative data files so the page never
  // drifts from the live JSON.
  function liveClassCount() { return CLASSES.length || LIVE?.counts?.classes || 0; }
  function liveCompanionCount() { return COMPANIONS.length || LIVE?.counts?.companions || 0; }
  function liveArchetypeCounts() {
    // primaryAttr → archetype:
    //   STR → Melee, DEX → Ranged, INT → Caster
    // Hybrid is any class with at least one build tagged 'hybrid' in
    // builds.json (the second-builds-per-class pass in M476 added many
    // CON-tilted/hybrid alternates). Hybrid wins over the primaryAttr
    // bucket so the chart reflects build flexibility, not raw stats.
    const out = { Melee: 0, Ranged: 0, Caster: 0, Hybrid: 0 };
    const hybridClassIds = hybridClassIdSet();
    CLASSES.forEach(c => {
      if (hybridClassIds.has(c.id)) { out.Hybrid += 1; return; }
      if (c.primaryAttr === 'STR') out.Melee += 1;
      else if (c.primaryAttr === 'DEX') out.Ranged += 1;
      else if (c.primaryAttr === 'INT') out.Caster += 1;
      else out.Hybrid += 1;
    });
    return out;
  }
  function hybridClassIdSet() {
    const ids = new Set();
    BUILDS.forEach(b => {
      if (b && Array.isArray(b.tags) && b.tags.includes('hybrid') && b.classId) {
        ids.add(b.classId);
      }
    });
    return ids;
  }
  // Derive hybrid stat letters per class. Looks at any build tagged 'hybrid'
  // for that class; the two highest stats among STR/DEX/INT are surfaced as
  // the hybrid pair (e.g. STR/INT for a Dragon Knight Spellblade build).
  function hybridStatsForClass(classId) {
    const pairs = new Set();
    BUILDS.forEach(b => {
      if (!b || b.classId !== classId) return;
      if (!Array.isArray(b.tags) || !b.tags.includes('hybrid')) return;
      const ta = b.targetAttrs || {};
      const ranked = ['STR','DEX','INT']
        .map(k => [k, ta[k] || 0])
        .sort((a, b2) => b2[1] - a[1])
        .filter(p => p[1] > 0);
      if (ranked.length >= 2) {
        pairs.add(ranked[0][0] + '/' + ranked[1][0]);
      }
    });
    return Array.from(pairs);
  }

  // ───────────────────────────────────────────────────────────── HELPERS ────
  const el = (tag, attrs = {}, ...children) => {
    const n = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (k === 'class') n.className = v;
      else if (k === 'style' && typeof v === 'object') Object.assign(n.style, v);
      else if (k === 'html') n.innerHTML = v;
      else if (k.startsWith('on') && typeof v === 'function') n.addEventListener(k.slice(2).toLowerCase(), v);
      else if (k === 'dataset') Object.assign(n.dataset, v);
      else if (v != null) n.setAttribute(k, v);
    }
    for (const c of children.flat()) {
      if (c == null || c === false) continue;
      if (typeof c === 'string' || typeof c === 'number') n.appendChild(document.createTextNode(c));
      else n.appendChild(c);
    }
    return n;
  };

  // ───────────────────────────────────────────────────────────── HERO ───────
  function mountHero(root) {
    const counts = LIVE?.counts || {};
    const classCount = liveClassCount();
    const companionCount = liveCompanionCount();
    const tag = el('span', { class: 'hero-tag' },
      el('span', {}, `${counts.acts || 6} ACTS`),
      el('span', { class: 'sep' }),
      el('span', {}, `${classCount || 28} CLASSES`),
      el('span', { class: 'sep' }),
      el('span', {}, `${companionCount || 35} COMPANIONS`)
    );

    const bg = el('div', { class: 'hero-bg' });
    const mountains = el('div', { class: 'hero-mountains', id: 'hero-mountains' });
    const clouds1 = el('div', { class: 'hero-clouds layer-1', id: 'hero-clouds-1' });
    const clouds2 = el('div', { class: 'hero-clouds layer-2', id: 'hero-clouds-2' });
    const vignette = el('div', { class: 'hero-vignette' });

    const headline = el('div', { class: 'hero-headline' },
      el('div', { class: 'reveal in' }, tag),
      el('h1', { id: 'hero-title', class: 'hero-title reveal in delay-1' },
        el('span', {}, 'EMB'),
        el('span', { class: 'e-large' }, 'E'),
        el('span', {}, 'R'),
        el('span', { class: 'e-large' }, 'V'),
        el('span', {}, 'EIL'),
      ),
      el('p', { class: 'hero-blurb reveal in delay-2' },
        'A dark-fantasy party RPG. Auto-resolving rounds with a party-shared tap slot ',
        'that never idles. Build the party, time the taps, close the Veil.'
      ),
      el('div', { class: 'hero-ctas reveal in delay-3' },
        el('a', { class: 'cta primary', href: './play.html' }, 'Play for free →')
      )
    );

    // M375: hero portrait removed per user request — left the headline + ember
    // particles do all the visual work. The class portrait still appears in
    // the Classes section below the fold.
    const stats = el('div', { class: 'hero-stats' },
      el('div', { class: 'row' }, [
        { v: classCount || 28, l: 'Classes' },
        { v: companionCount || 35, l: 'Companions' },
        { v: counts.acts || 6, l: 'Acts' },
        { v: counts.zones || 12, l: 'Zones' },
        { v: counts.skills ? counts.skills + '+' : '180+', l: 'Skills' },
        { v: counts.enemies ? counts.enemies + '+' : '210+', l: 'Enemies' },
        { v: 'M' + (LIVE?.version?.milestone || 0), l: 'Build' },
      ].map(s => el('div', { class: 'cell' },
        el('div', { class: 'v num' }, String(s.v)),
        el('div', { class: 'l' }, s.l)
      )))
    );

    const section = el('section', { class: 'hero', 'aria-labelledby': 'hero-title' },
      bg, mountains, clouds1, clouds2, vignette,
      el('div', { class: 'container hero-content hero-no-portrait' }, headline),
      stats
    );

    root.replaceWith(section);

    // Parallax
    let raf;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const y = window.scrollY;
        clouds1.style.transform = `translate3d(${y * 0.18}px, ${y * 0.12}px, 0)`;
        clouds2.style.transform = `translate3d(${y * -0.08}px, ${y * 0.18}px, 0) scale(1.4)`;
        mountains.style.transform = `translate3d(0, ${y * 0.32}px, 0)`;
        // M375 removed the hero portrait; heroImg no longer exists. Guard
        // in case a future variant re-introduces it.
        if (typeof heroImg !== 'undefined' && heroImg) {
          heroImg.style.transform = `translate3d(0, ${y * -0.12}px, 0)`;
        }
      });
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  // ─────────────────────────────────────────────────────────── CLASSES ──────
  // M486 — Build a 10-class list from live data: the 5 starters from
  // live.json plus 5 marquee unlock classes pulled from classes.json +
  // skills.json. Unlock requirements come from a small map mirrored from
  // src/game/classUnlocks.js (the runtime data that gates these classes).
  // Skill rows are real Name + "Lv N" tiers — never invented.
  const UNLOCK_REQUIREMENTS = {
    paladin:       'Complete Act 1 to unlock',
    cleric:        'Complete Act 1 to unlock',
    pyromancer:    'Slay 50 enemies to unlock',
    necromancer:   'Complete Act 2 to unlock',
    warlock:       'Kill a boss below 20% HP',
    bard:          'Complete Act 2 to unlock',
    druid:         'Complete Act 2 to unlock',
    stormcaller:   'Reach hero level 20 to unlock',
    dragon_knight: 'Defeat the Dragon boss to unlock',
    demon_hunter:  'Complete Act 3 to unlock',
    chronomancer:  'Complete Act 4 to unlock',
    oracle:        'Complete the game to unlock',
    tactician:     'Complete Act 3 to unlock',
    swashbuckler:  'Accumulate 1,000 gold to unlock',
    scavenger:     'Find 10 rare items to unlock',
    monk:          'Reach hero level 10 to unlock',
    shaman:        'Complete Act 1 to unlock',
    witch_hunter:  'Complete Act 2 to unlock',
    knight:        'Complete Act 1 to unlock',
    sorcerer:      'Reach hero level 15 to unlock',
    runesmith:     'Find 5 rare items to unlock',
    shadow_dancer: 'Complete Act 2 to unlock',
    tinker:        'Complete Act 1 to unlock',
    enchanter:     'Complete Act 2 to unlock',
    priest:        'Complete Act 1 to unlock',
  };
  // Marquee unlock classes shown alongside the 5 starters on the front page.
  // Picked to span every primary attribute and surface the hybrid system.
  const FRONT_PAGE_UNLOCK_IDS = ['paladin', 'cleric', 'necromancer', 'pyromancer', 'dragon_knight'];

  function buildSkillRow(sid) {
    const s = SKILLS.find(x => x && x.id === sid);
    if (!s) return { name: sid, cost: '—', tier: '' };
    const cost = (s.mpCost > 0) ? (s.mpCost + ' MP') : '—';
    return { name: s.name || sid, cost, tier: 'Lv ' + (s.unlockLevel || 1) };
  }
  function buildUnlockClassEntry(id) {
    const c = CLASSES.find(x => x && x.id === id);
    if (!c) return null;
    return {
      id: c.id,
      name: c.name,
      role: c.role || '',
      primaryAttr: c.primaryAttr || '',
      portrait: './images/openai_v2/' + c.id + '_portrait.png',
      desc: c.hook || '',
      unlockHint: UNLOCK_REQUIREMENTS[c.id] || '',
      skills: (c.skills || []).slice(0, 4).map(buildSkillRow),
    };
  }

  function mountClasses(root) {
    const starters = (LIVE?.starterClasses || []).map(c => Object.assign({}, c));
    if (!starters.length) { root.remove(); return; }
    const unlockEntries = FRONT_PAGE_UNLOCK_IDS
      .map(buildUnlockClassEntry)
      .filter(Boolean);
    const classes = starters.concat(unlockEntries).slice(0, 10);

    let active = 0;

    // M371 — Keyboard-accessible class picker. Use real <button>s with
    // aria-selected + arrow-key nav so screen readers + keyboarders can
    // browse classes. Mouse-hover still previews via mouseenter.
    const list = el('div', { class: 'class-list reveal', role: 'tablist', 'aria-label': 'Hero classes' });
    const buttons = [];
    classes.forEach((c, i) => {
      const isUnlock = i >= starters.length;
      const item = el('button', {
        type: 'button',
        class: 'class-item' + (i === active ? ' active' : '') + (isUnlock ? ' is-unlock' : ''),
        'data-i': i,
        role: 'tab',
        'aria-selected': i === active ? 'true' : 'false',
        'aria-controls': 'class-detail',
        tabindex: i === active ? '0' : '-1',
      },
        el('span', { class: 'num' }, String(i + 1).padStart(2, '0')),
        el('span', { class: 'class-item-text' },
          el('span', { class: 'name' }, c.name),
          el('span', { class: 'role' }, isUnlock ? (c.unlockHint || c.role || '') : (c.role || ''))
        ),
        el('span', { class: 'num arrow' }, '→')
      );
      item.addEventListener('click', () => { setActive(i); item.focus(); });
      item.addEventListener('mouseenter', () => setActive(i));
      item.addEventListener('keydown', (e) => {
        let next = -1;
        if (e.key === 'ArrowDown' || e.key === 'ArrowRight') next = (i + 1) % classes.length;
        else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') next = (i - 1 + classes.length) % classes.length;
        else if (e.key === 'Home') next = 0;
        else if (e.key === 'End') next = classes.length - 1;
        if (next >= 0) {
          e.preventDefault();
          setActive(next);
          buttons[next]?.focus();
        }
      });
      buttons.push(item);
      list.appendChild(item);
    });

    // M486 — 11th tile: link to the full class catalog. Static link, not
    // a tab — keyboard-focus uses the same .class-item visual but lands
    // the user on a separate page so they can browse all 28+ classes.
    const viewAll = el('a', {
      href: './assets/class-catalog.html',
      class: 'class-item class-item-viewall',
    },
      el('span', { class: 'num' }, '11'),
      el('span', { class: 'class-item-text' },
        el('span', { class: 'name' }, 'View all classes'),
        el('span', { class: 'role' }, 'Full catalog · ' + (liveClassCount() || 28) + ' classes, every skill, every unlock')
      ),
      el('span', { class: 'num arrow' }, '→')
    );
    list.appendChild(viewAll);

    const detail = el('div', { class: 'class-detail reveal delay-1', id: 'class-detail' });

    function renderDetail() {
      const c = classes[active];
      if (!c) return;
      detail.innerHTML = '';
      const portrait = el('div', { class: 'class-portrait' },
        el('img', { src: (c.portrait || '').replace(/^\.\.\//, './'), alt: c.name + ' portrait', class: 'pixel',
          onerror: function () { this.style.opacity = 0.2; }
        })
      );
      // Prefer the canonical hook from classes.json (live source of truth)
      // so the description always reflects the current scaling system
      // (heavy/light/magic) rather than a stale "INT scales spell damage"
      // line baked into live.json.
      const fullClass = CLASSES.find(x => x.id === c.id) || {};
      const baseDesc = fullClass.hook || c.hook || c.desc || '';
      const description = c.unlockHint
        ? (baseDesc + ' · ' + c.unlockHint)
        : baseDesc;

      // Primary Attribute badge. If any skill on this class has a hybrid
      // damageStat (e.g. 'str_int'), render Hybrid (STR/INT) instead.
      const hybrids = hybridStatsForClass(c.id);
      const primaryAttr = fullClass.primaryAttr || c.primaryAttr || '';
      const attrLabel = hybrids.length
        ? 'Hybrid (' + hybrids.join(', ') + ')'
        : (primaryAttr || '—');

      const info = el('div', { class: 'class-info' },
        el('div', {},
          el('span', { class: 'eyebrow' }, c.role || ''),
          el('h3', { class: 'name-big' }, c.name)
        ),
        el('div', { class: 'class-primary-attr', style: {
          display: 'inline-flex', alignItems: 'center', gap: '8px',
          padding: '4px 10px', margin: '0 0 12px',
          border: '1px solid var(--line)', borderRadius: '4px',
          fontFamily: 'var(--font-mono)', fontSize: '11px', letterSpacing: '2px',
          color: 'var(--accent-bright)', textTransform: 'uppercase',
        } },
          el('span', { style: { color: 'var(--ink-3)' } }, 'Primary Attribute'),
          el('span', {}, attrLabel)
        ),
        el('p', { class: 'desc' }, description),
        el('div', { class: 'skills-list' }, (c.skills || []).map(s =>
          el('div', { class: 'skill-row' },
            el('div', { class: 'sk-name' }, s.name),
            el('div', { class: 'sk-cost' }, s.cost || '—'),
            el('div', { class: 'sk-tier' }, s.tier || '')
          )
        ))
      );
      detail.appendChild(portrait);
      detail.appendChild(info);
    }

    function setActive(i) {
      if (i === active) return;
      active = i;
      list.querySelectorAll('.class-item').forEach((n, idx) => {
        n.classList.toggle('active', idx === i);
        n.setAttribute('aria-selected', idx === i ? 'true' : 'false');
        n.setAttribute('tabindex', idx === i ? '0' : '-1');
      });
      renderDetail();
    }

    const counts = LIVE?.counts || {};
    const totalClasses = liveClassCount() || counts.classes || 28;
    const shownCount = classes.length;
    const remaining = Math.max(0, totalClasses - shownCount);
    const head = el('div', { class: 'section-head reveal' },
      el('span', { class: 'eyebrow' }, 'Heroes · Section 01'),
      el('h2', { html: `${totalClasses} classes.<br>One party of four.` }),
      el('p', { class: 'lede' },
        `${shownCount} classes shown below — ${remaining} more in the full catalog. `,
        'Mix utility and healing characters to build an effective team.'
      )
    );

    const section = el('section', { class: 'classes-section', id: 'classes' },
      el('div', { class: 'container' }, head,
        el('div', { class: 'classes-grid' }, list, detail)
      )
    );
    root.replaceWith(section);
    renderDetail();
  }

  // ─────────────────────────────────────────────────────────── COMBAT ───────
  function mountCombat(root) {
    let step = -1, paused = false, round = 1, turn = 1, tapCd = 0, acting = null;
    const hp = { h0: 100, h1: 100, h2: 100, e0: 100, e1: 100 };
    const hits = {};
    let logs = [];

    const heroes = [
      { id: 'h0', name: 'Stormcaller', img: './images/spritecook/stormcaller_portrait.png' },
      { id: 'h1', name: 'Cleric', img: './images/spritecook/cleric_portrait.png' },
      { id: 'h2', name: 'Knight', img: './images/spritecook/knight_portrait.png' },
    ];
    // M375 — per user direction: rename + reskin enemies. Goblin Scout was
    // showing a missing/wrong image; the user wants the slot to be a
    // Stormcaller, and the second slot a Goblin.
    const enemies = [
      { id: 'e0', name: 'Stormcaller', img: './images/spritecook/stormcaller_portrait.png' },
      { id: 'e1', name: 'Goblin', img: './images/spritecook/goblin_warrior_portrait.png' },
    ];

    const script = [
      { actor: 'h0', target: 'e0', dmg: 14, log: '<b>Stormcaller</b> casts Chain Lightning · 14 dmg' },
      { actor: 'e0', target: 'h0', dmg: 7, log: '<b>Goblin Scout</b> stabs Stormcaller · 7 dmg' },
      { actor: 'h1', target: 'h0', dmg: 12, heal: true, log: '<b>Cleric</b> casts Mend · +12 HP' },
      { actor: 'TAP', target: 'e1', dmg: 12, crit: true, kind: 'tap', log: '<span class="tag-tap"><b>TAP</b> · Ember Lance — 12 dmg</span>' },
      { actor: 'h2', target: 'e1', dmg: 10, log: '<b>Knight</b> shield-bashes Cultist · 10 dmg' },
      { actor: 'e1', target: 'h2', dmg: 5, log: '<b>Veil Cultist</b> hurls hex · 5 dmg' },
    ];

    const arenaEnemies = el('div', { class: 'arena-row enemies' });
    const arenaHeroes = el('div', { class: 'arena-row heroes' });
    const arenaLog = el('div', { class: 'arena-log', 'aria-live': 'polite' });
    const popsArena = el('div', { class: 'combat-arena' },
      el('div', { class: 'arena-floor' }, arenaEnemies, arenaHeroes),
      arenaLog
    );

    function makeCombatant(c, kind) {
      const node = el('div', { class: 'combatant ' + kind, 'data-id': c.id },
        el('img', { src: c.img, alt: c.name, class: 'pixel', onerror: function () { this.style.opacity = 0.15; } }),
        el('div', { class: 'hp' }, el('div', { class: 'fill' })),
        el('div', { class: 'label' }, c.name)
      );
      return node;
    }
    enemies.forEach(e => arenaEnemies.appendChild(makeCombatant(e, 'enemy')));
    heroes.forEach(h => arenaHeroes.appendChild(makeCombatant(h, 'hero')));

    let _lastLogsKey = '';
    function applyState() {
      [...heroes, ...enemies].forEach(c => {
        const node = popsArena.querySelector(`[data-id="${c.id}"]`);
        if (!node) return;
        node.classList.toggle('acting', acting === c.id);
        node.classList.toggle('hit', !!hits[c.id]);
        node.classList.toggle('dead', hp[c.id] <= 0);
        const fill = node.querySelector('.hp .fill');
        if (fill) fill.style.transform = `scaleX(${Math.max(0, hp[c.id]) / 100})`;
      });
      // M375: only re-render the log list when its contents actually change.
      // Previously we tore down + rebuilt every applyState() call (i.e. every
      // 100ms tap-cd tick), which caused the .arena-log to flicker visibly in
      // dev tools and triggered constant aria-live announcements. Now we only
      // touch the DOM when the log strings have changed.
      const key = logs.slice(0, 8).join('§');
      if (key !== _lastLogsKey) {
        _lastLogsKey = key;
        while (arenaLog.firstChild) arenaLog.removeChild(arenaLog.firstChild);
        logs.slice(0, 8).forEach(l => arenaLog.appendChild(el('div', { class: 'line', html: l })));
      }
      roundStat.textContent = String(round);
      turnStat.textContent = String(turn);
      tapCdFill.style.transform = `scaleX(${tapCd})`;
      tapPercent.textContent = Math.round(tapCd * 100) + '%';
      tapStatus.textContent = tapCd >= 1 ? '● Ready' : '○ Charging';
      tapBtn.disabled = tapCd < 1;
      tapSlot.classList.toggle('ready', tapCd >= 1);
      tapPercent.classList.toggle('ready-tag', tapCd >= 1);
      initRow.querySelectorAll('.init-pip').forEach((pip, i) => {
        pip.classList.toggle('now', pip.dataset.id === acting);
      });
    }

    function spawnPop(id, text, kind) {
      const target = popsArena.querySelector(`[data-id="${id}"]`);
      if (!target) return;
      const r = target.getBoundingClientRect();
      const ar = popsArena.getBoundingClientRect();
      const p = el('div', { class: 'dmg-pop ' + kind }, text);
      p.style.left = (r.left - ar.left + r.width / 2 - 16) + 'px';
      p.style.top = (r.top - ar.top + 8) + 'px';
      popsArena.appendChild(p);
      setTimeout(() => p.remove(), 1000);
    }

    function reset() {
      step = -1;
      Object.assign(hp, { h0: 100, h1: 100, h2: 100, e0: 100, e1: 100 });
      acting = null; for (const k in hits) delete hits[k];
      logs = []; tapCd = 0; turn = 1;
      applyState();
    }

    function runStep(idx) {
      const s = script[idx];
      step = idx; acting = s.actor; turn += 1;
      logs = [s.log, ...logs].slice(0, 8);
      if (s.kind === 'tap') tapCd = 0;
      if (s.target && s.dmg) {
        if (s.heal) {
          hp[s.target] = Math.min(100, hp[s.target] + s.dmg);
          spawnPop(s.target, '+' + s.dmg, 'heal');
        } else {
          hp[s.target] = Math.max(0, hp[s.target] - s.dmg);
          spawnPop(s.target, '-' + s.dmg, s.crit ? 'crit' : 'dmg');
          hits[s.target] = true;
          setTimeout(() => { delete hits[s.target]; applyState(); }, 350);
        }
      }
      applyState();
    }

    function fireTap() {
      if (tapCd < 1) return;
      tapCd = 0;
      const t = hp.e0 > 0 ? 'e0' : (hp.e1 > 0 ? 'e1' : null);
      if (!t) return applyState();
      hp[t] = Math.max(0, hp[t] - 12);
      spawnPop(t, '-12', 'crit');
      hits[t] = true;
      setTimeout(() => { delete hits[t]; applyState(); }, 350);
      logs = ['<span class="tag-tap"><b>TAP</b> · You fired Ember Lance — 12 dmg</span>', ...logs].slice(0, 8);
      acting = 'TAP';
      applyState();
    }

    const roundStat = el('div', { class: 'v num' }, '1');
    const turnStat = el('div', { class: 'v num' }, '1');
    const tapStatus = el('span', {}, '○ Charging');
    const tapCdFill = el('div', { class: 'cd-fill', style: { transformOrigin: 'left', height: '100%' } });
    const tapPercent = el('span', {}, '0%');
    const tapBtn = el('button', { class: 'tap-button' }, '⚡ Fire Tap →');
    tapBtn.disabled = true;
    tapBtn.addEventListener('click', fireTap);
    const tapSlot = el('div', { class: 'tap-slot' },
      el('div', { class: 'head' }, el('span', {}, 'Tap Weapon'), tapStatus),
      el('div', { class: 'name' }, 'Ember Lance'),
      el('div', { class: 'cd-track' }, tapCdFill),
      el('div', { class: 'meta' }, el('span', {}, 'CD · 4 turns'), tapPercent),
      tapBtn
    );

    const order = ['h0', 'e0', 'h1', 'TAP', 'h2', 'e1'];
    const initRow = el('div', { class: 'init-row' }, order.map(id =>
      el('div', { class: 'init-pip ' + (id.startsWith('h') || id === 'TAP' ? 'h' : 'e'), dataset: { id } }, id === 'TAP' ? 'TAP' : id.toUpperCase())
    ));

    const pauseBtn = el('button', {
      class: 'cta',
      type: 'button',
      'aria-pressed': 'false',
      'aria-label': 'Pause combat preview',
    }, '⏸ Pause');
    pauseBtn.addEventListener('click', () => {
      paused = !paused;
      pauseBtn.textContent = paused ? '▶ Resume' : '⏸ Pause';
      pauseBtn.setAttribute('aria-pressed', paused ? 'true' : 'false');
      pauseBtn.setAttribute('aria-label', paused ? 'Resume combat preview' : 'Pause combat preview');
    });

    const side = el('div', { class: 'combat-side' },
      el('div', { class: 'round-info' },
        el('div', { class: 'stat' }, el('div', { class: 'l' }, 'Round'), roundStat),
        el('div', { class: 'stat' }, el('div', { class: 'l' }, 'Turn'), turnStat)
      ),
      tapSlot,
      el('div', { class: 'initiative-track' },
        el('div', { class: 'init-head' }, 'Initiative · this round'), initRow
      ),
      pauseBtn
    );

    const head = el('div', { class: 'section-head reveal' },
      el('span', { class: 'eyebrow' }, 'Combat · Section 02'),
      el('h2', { html: 'Auto rounds.<br>Real decisions.' }),
      el('p', { class: 'lede' },
        'Initiative + d10 sets the order. Heroes pick skills by personality heuristic. ',
        'You ride the tap slot — one weapon, one utility, party-wide.'
      )
    );

    const section = el('section', { class: 'combat-section', id: 'combat' },
      el('div', { class: 'container' },
        head,
        el('div', { class: 'combat-frame reveal' }, popsArena, side)
      )
    );
    root.replaceWith(section);

    applyState();

    // M371 — Auto-advance only while page is visible. Tabbed-out users
    // shouldn't burn battery on a marketing combat preview, and reduced-motion
    // users get a static snapshot instead of a loop.
    const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const isVisible = () => document.visibilityState !== 'hidden' && !paused && !reducedMotion;
    const tick = () => {
      if (!isVisible()) return;
      const nxt = step + 1;
      if (nxt >= script.length) { round += 1; reset(); return; }
      runStep(nxt);
    };
    setInterval(tick, 1700);
    setInterval(() => {
      if (!isVisible()) return;
      tapCd = Math.min(1, tapCd + 0.02);
      applyState();
    }, 100);
  }

  // ──────────────────────────────────────────────────────── COMPANIONS ──────
  function mountCompanions(root) {
    const data = (LIVE?.companions || []).slice(0, 12);
    if (!data.length) { root.remove(); return; }

    // M486: companion sprites were regenerated in M468 under
    // public/images/openai_v2/<id>_portrait.png. Prefer that path; the
    // <img onerror> hook downgrades to the legacy spritecook path so any
    // companion not yet in the v2 set (e.g. war_dog) still renders.
    const v2Path = id => './images/openai_v2/' + id + '_portrait.png';

    const track = el('div', { class: 'carousel-track' });
    data.forEach(c => {
      const fallback = (c.portrait || '').replace(/^\.\.\//, './');
      const primary = c.id ? v2Path(c.id) : fallback;
      const img = el('img', {
        src: primary, alt: c.name, class: 'pixel',
        onerror: function () {
          if (this.dataset.fallbackTried) {
            this.replaceWith(document.createTextNode('[ portrait pending ]'));
            return;
          }
          this.dataset.fallbackTried = '1';
          if (fallback && fallback !== primary) {
            this.src = fallback;
          } else {
            this.replaceWith(document.createTextNode('[ portrait pending ]'));
          }
        }
      });
      const portrait = el('div', { class: 'companion-portrait' }, img);
      track.appendChild(el('article', { class: 'companion-card' },
        portrait,
        el('div', { class: 'companion-info' },
          el('div', { class: 'role' }, c.role || ''),
          el('div', { class: 'name' }, c.name),
          el('div', { class: 'desc' }, c.desc || ''),
          el('div', { class: 'meta' },
            el('span', {}, 'ACT', el('span', { class: 'v' }, ' ' + (c.meta?.ACT || '—')))
          )
        )
      ));
    });

    const head = el('div', { class: 'section-head reveal' },
      el('span', { class: 'eyebrow' }, 'Companions · Section 03'),
      el('h2', { html: `${liveCompanionCount() || data.length} allies.<br>Recruit, equip, farewell.` }),
      el('p', { class: 'lede' },
        'Recruited across acts. Companions can leave, fall in battle, or stick with you to the end — every party slot is a commitment.'
      )
    );

    const ind = el('div', { class: 'ind' });
    const progress = el('div', { class: 'car-progress' }, ind);
    const left = el('button', { class: 'car-arrow', 'aria-label': 'Previous' }, '←');
    const right = el('button', { class: 'car-arrow', 'aria-label': 'Next' }, '→');
    left.addEventListener('click', () => track.scrollBy({ left: -360, behavior: 'smooth' }));
    right.addEventListener('click', () => track.scrollBy({ left: 360, behavior: 'smooth' }));

    const updateProgress = () => {
      const max = track.scrollWidth - track.clientWidth;
      const ratio = max > 0 ? track.scrollLeft / max : 0;
      const w = (track.clientWidth / track.scrollWidth) * 100;
      ind.style.left = (ratio * (100 - w)) + '%';
      ind.style.width = w + '%';
    };
    track.addEventListener('scroll', updateProgress, { passive: true });
    window.addEventListener('resize', updateProgress);
    setTimeout(updateProgress, 50);

    const section = el('section', { class: 'companions-section', id: 'companions' },
      el('div', { class: 'container' }, head),
      el('div', { class: 'carousel-frame' }, track,
        el('div', { class: 'container' },
          el('div', { class: 'car-controls' }, left, progress, right)
        )
      )
    );
    root.replaceWith(section);
  }

  // ───────────────────────────────────────────────────────── CHARTS ─────────
  function mountCharts(root) {
    const tabs = [
      { id: 'classes', label: 'Class Distribution' },
      { id: 'difficulty', label: 'Difficulty Curve' },
      { id: 'drops', label: 'Drop Rarity by Act' },
    ];
    let active = tabs[0].id;

    const tabRow = el('div', { class: 'chart-tabs reveal' });
    tabs.forEach(t => {
      const b = el('button', { class: 'chart-tab', 'data-tab': t.id }, t.label);
      b.addEventListener('click', () => { active = t.id; render(); });
      tabRow.appendChild(b);
    });

    const canvasWrap = el('div', { class: 'chart-canvas-wrap' });
    const sideWrap = el('div', { class: 'chart-side' });

    function setTabActive() {
      tabRow.querySelectorAll('.chart-tab').forEach(b => b.classList.toggle('active', b.dataset.tab === active));
    }

    function render() {
      setTabActive();
      canvasWrap.innerHTML = '';
      sideWrap.innerHTML = '';
      if (active === 'classes') canvasWrap.appendChild(radarClasses());
      else if (active === 'difficulty') canvasWrap.appendChild(difficultyCurve());
      else if (active === 'drops') canvasWrap.appendChild(dropStack());
      sideWrap.appendChild(el('div', { class: 'lbl' }, 'Reading'));
      sideWrap.appendChild(el('h3', {}, tabs.find(t => t.id === active).label));
      const arch = liveArchetypeCounts();
      const text = {
        classes: `${liveClassCount() || 28} classes split across role archetypes. Casters lead at ${arch.Caster}, melee at ${arch.Melee}, ranged at ${arch.Ranged}${arch.Hybrid ? `, with ${arch.Hybrid} hybrids` : ''}.`,
        difficulty: 'Enemy power curve over six acts on Hard. Note the Act III spike — Malgrath forces a real party comp before Cosmic Void opens.',
        drops: 'Post-M350 rebalance. Border Roads settles at ~50% normal items; later acts shift toward magic and rare with diminishing junk drops.',
      };
      sideWrap.appendChild(el('p', {}, text[active]));
      sideWrap.appendChild(el('div', { style: { marginTop: '14px' } },
        el('a', { class: 'cta', href: './assets/balance-report.html' }, 'View Report →')
      ));
    }

    const head = el('div', { class: 'section-head reveal' },
      el('span', { class: 'eyebrow' }, 'Mechanics · Section 04'),
      el('h2', {}, 'By the numbers.'),
      el('p', { class: 'lede' },
        `Live numbers from build M${LIVE?.version?.milestone || 0} — these are the actual rosters and acts in the current ship, not concept art.`
      )
    );

    const section = el('section', { class: 'charts-section' },
      el('div', { class: 'container' },
        head, tabRow,
        el('div', { class: 'chart-frame reveal delay-1' }, canvasWrap, sideWrap)
      )
    );
    root.replaceWith(section);
    render();
  }

  // SVG chart helpers
  const SVGNS = 'http://www.w3.org/2000/svg';
  const svgEl = (tag, attrs = {}, ...children) => {
    const n = document.createElementNS(SVGNS, tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (v == null) continue;
      n.setAttribute(k, v);
    }
    for (const c of children.flat()) if (c) n.appendChild(c);
    return n;
  };

  function radarClasses() {
    const arch = liveArchetypeCounts();
    const data = [
      { label: 'Melee', v: arch.Melee || 0 },
      { label: 'Ranged', v: arch.Ranged || 0 },
      { label: 'Caster', v: arch.Caster || 0 },
      { label: 'Hybrid', v: arch.Hybrid || 0 },
    ];
    const cx = 200, cy = 200, R = 140;
    const max = Math.max(10, ...data.map(d => d.v));
    const angle = i => -Math.PI / 2 + (i / data.length) * Math.PI * 2;
    const pt = (i, v) => {
      const r = (v / max) * R;
      return [cx + Math.cos(angle(i)) * r, cy + Math.sin(angle(i)) * r];
    };
    const poly = data.map((d, i) => pt(i, d.v).join(',')).join(' ');
    const svg = svgEl('svg', { viewBox: '0 0 400 400', width: '100%', style: 'max-width: 480px', role: 'img', 'aria-label': 'Class distribution by role: ' + data.map(d => `${d.label} ${d.v}`).join(', ') });
    const defs = svgEl('defs');
    const grad = svgEl('radialGradient', { id: 'radarFill', cx: 200, cy: 200, r: 140, gradientUnits: 'userSpaceOnUse' });
    grad.appendChild(svgEl('stop', { offset: '0', 'stop-color': 'var(--accent)', 'stop-opacity': '.55' }));
    grad.appendChild(svgEl('stop', { offset: '1', 'stop-color': 'var(--accent)', 'stop-opacity': '.05' }));
    defs.appendChild(grad);
    svg.appendChild(defs);
    [1, .75, .5, .25].forEach(s => svg.appendChild(svgEl('polygon', {
      points: data.map((_, j) => [cx + Math.cos(angle(j)) * R * s, cy + Math.sin(angle(j)) * R * s].join(',')).join(' '),
      stroke: 'var(--line)', 'stroke-width': '1', fill: 'none'
    })));
    data.forEach((d, i) => {
      const [x, y] = [cx + Math.cos(angle(i)) * R, cy + Math.sin(angle(i)) * R];
      svg.appendChild(svgEl('line', { x1: cx, y1: cy, x2: x, y2: y, stroke: 'var(--line)', 'stroke-width': '.5' }));
    });
    svg.appendChild(svgEl('polygon', { points: poly, fill: 'url(#radarFill)', stroke: 'var(--accent)', 'stroke-width': '2', style: 'filter: drop-shadow(0 0 12px var(--accent-glow))' }));
    data.forEach((d, i) => {
      const [x, y] = pt(i, d.v);
      svg.appendChild(svgEl('circle', { cx: x, cy: y, r: '5', fill: 'var(--accent-bright)' }));
    });
    data.forEach((d, i) => {
      const [x, y] = [cx + Math.cos(angle(i)) * (R + 28), cy + Math.sin(angle(i)) * (R + 28)];
      const t1 = svgEl('text', { x, y: y - 6, 'text-anchor': 'middle', fill: 'var(--ink-2)', 'font-family': 'var(--font-mono)', 'font-size': '11', 'letter-spacing': '2' });
      t1.textContent = d.label.toUpperCase();
      const t2 = svgEl('text', { x, y: y + 12, 'text-anchor': 'middle', fill: 'var(--accent-bright)', 'font-family': 'var(--font-display)', 'font-size': '22' });
      t2.textContent = d.v;
      svg.appendChild(t1); svg.appendChild(t2);
    });
    return svg;
  }

  function difficultyCurve() {
    const data = [
      { act: 'I', normal: 12, hard: 22 },
      { act: 'II', normal: 22, hard: 38 },
      { act: 'III', normal: 40, hard: 70 },
      { act: 'IV', normal: 56, hard: 90 },
      { act: 'V', normal: 78, hard: 124 },
      { act: 'VI', normal: 96, hard: 158 },
    ];
    const W = 560, H = 360, P = 40, max = 170;
    const x = i => P + (i / (data.length - 1)) * (W - P * 2);
    const y = v => H - P - (v / max) * (H - P * 2);
    const linePath = key => data.map((d, i) => (i === 0 ? 'M' : 'L') + x(i) + ',' + y(d[key])).join(' ');
    const areaPath = key => 'M' + x(0) + ',' + y(0) + ' ' + data.map((d, i) => 'L' + x(i) + ',' + y(d[key])).join(' ') + ' L' + x(data.length - 1) + ',' + y(0) + ' Z';
    const svg = svgEl('svg', { viewBox: `0 0 ${W} ${H}`, width: '100%', style: 'max-width: 640px', role: 'img', 'aria-label': 'Difficulty curve across acts I-VI: hard mode tops at ' + data[data.length - 1].hard + ', normal at ' + data[data.length - 1].normal });
    const defs = svgEl('defs');
    const g1 = svgEl('linearGradient', { id: 'hardArea', x1: '0', x2: '0', y1: '0', y2: '1' });
    g1.appendChild(svgEl('stop', { offset: '0', 'stop-color': 'var(--accent)', 'stop-opacity': '.4' }));
    g1.appendChild(svgEl('stop', { offset: '1', 'stop-color': 'var(--accent)', 'stop-opacity': '0' }));
    defs.appendChild(g1);
    const g2 = svgEl('linearGradient', { id: 'normArea', x1: '0', x2: '0', y1: '0', y2: '1' });
    g2.appendChild(svgEl('stop', { offset: '0', 'stop-color': 'var(--ink-2)', 'stop-opacity': '.25' }));
    g2.appendChild(svgEl('stop', { offset: '1', 'stop-color': 'var(--ink-2)', 'stop-opacity': '0' }));
    defs.appendChild(g2);
    svg.appendChild(defs);
    [0, .25, .5, .75, 1].forEach(r => {
      const yy = P + r * (H - P * 2);
      svg.appendChild(svgEl('line', { x1: P, x2: W - P, y1: yy, y2: yy, stroke: 'var(--line)', 'stroke-width': '.5', 'stroke-dasharray': '2 4' }));
    });
    svg.appendChild(svgEl('path', { d: areaPath('normal'), fill: 'url(#normArea)' }));
    svg.appendChild(svgEl('path', { d: linePath('normal'), fill: 'none', stroke: 'var(--ink-2)', 'stroke-width': '1.5', 'stroke-dasharray': '4 4' }));
    svg.appendChild(svgEl('path', { d: areaPath('hard'), fill: 'url(#hardArea)' }));
    svg.appendChild(svgEl('path', { d: linePath('hard'), fill: 'none', stroke: 'var(--accent)', 'stroke-width': '2.5', style: 'filter: drop-shadow(0 0 8px var(--accent-glow))' }));
    data.forEach((d, i) => {
      svg.appendChild(svgEl('circle', { cx: x(i), cy: y(d.hard), r: '4', fill: 'var(--accent-bright)', stroke: 'var(--bg-1)', 'stroke-width': '2' }));
      svg.appendChild(svgEl('circle', { cx: x(i), cy: y(d.normal), r: '3', fill: 'var(--ink-2)' }));
      const t = svgEl('text', { x: x(i), y: H - 14, 'text-anchor': 'middle', 'font-family': 'var(--font-display)', 'font-size': '14', fill: 'var(--ink-2)' });
      t.textContent = d.act;
      svg.appendChild(t);
    });
    return svg;
  }

  function dropStack() {
    const data = [
      { act: 'I', normal: 50, magic: 32, rare: 14, set: 3, unique: 1 },
      { act: 'II', normal: 42, magic: 36, rare: 17, set: 4, unique: 1 },
      { act: 'III', normal: 35, magic: 38, rare: 21, set: 5, unique: 1 },
      { act: 'IV', normal: 28, magic: 36, rare: 26, set: 7, unique: 3 },
      { act: 'V', normal: 22, magic: 32, rare: 30, set: 11, unique: 5 },
      { act: 'VI', normal: 15, magic: 28, rare: 34, set: 14, unique: 9 },
    ];
    const colors = { normal: 'var(--ink-3)', magic: '#5b8fc7', rare: 'var(--gold)', set: '#6dd4a4', unique: 'var(--accent)' };
    const order = ['normal', 'magic', 'rare', 'set', 'unique'];
    const W = 560, H = 360, P = 40;
    const bw = (W - P * 2) / data.length * .65;
    const bx = i => P + i * ((W - P * 2) / data.length) + ((W - P * 2) / data.length - bw) / 2;
    const svg = svgEl('svg', { viewBox: `0 0 ${W} ${H}`, width: '100%', style: 'max-width: 640px', role: 'img', 'aria-label': 'Drop rarity by act — normal drops fall from ' + data[0].normal + '% in Act I to ' + data[data.length-1].normal + '% in Act VI as rare and unique loot increases' });
    [0, .25, .5, .75, 1].forEach(r => {
      const yy = P + r * (H - P * 2);
      svg.appendChild(svgEl('line', { x1: P, x2: W - P, y1: yy, y2: yy, stroke: 'var(--line)', 'stroke-width': '.5', 'stroke-dasharray': '2 4' }));
      const t = svgEl('text', { x: P - 8, y: yy + 4, 'text-anchor': 'end', 'font-family': 'var(--font-mono)', 'font-size': '10', fill: 'var(--ink-3)' });
      t.textContent = Math.round((1 - r) * 100) + '%';
      svg.appendChild(t);
    });
    data.forEach((d, i) => {
      let acc = 0;
      order.forEach(k => {
        const h = (d[k] / 100) * (H - P * 2);
        const yy = H - P - acc - h;
        acc += h;
        svg.appendChild(svgEl('rect', { x: bx(i), y: yy, width: bw, height: h, fill: colors[k], stroke: 'var(--bg-1)', 'stroke-width': '1' }));
      });
      const t = svgEl('text', { x: bx(i) + bw / 2, y: H - 14, 'text-anchor': 'middle', 'font-family': 'var(--font-display)', 'font-size': '14', fill: 'var(--ink-2)' });
      t.textContent = d.act;
      svg.appendChild(t);
    });
    return svg;
  }

  function initiativeBell() {
    const W = 560, H = 360, P = 40;
    const data = Array.from({ length: 21 }, (_, i) => {
      const x = (i - 10) / 5;
      return { v: i, count: Math.exp(-x * x / 1.6) * 100 };
    });
    const max = 100;
    const x = i => P + (i / (data.length - 1)) * (W - P * 2);
    const y = v => H - P - (v / max) * (H - P * 2);
    const path = data.map((d, i) => (i === 0 ? 'M' : 'L') + x(i) + ',' + y(d.count)).join(' ');
    const svg = svgEl('svg', { viewBox: `0 0 ${W} ${H}`, width: '100%', style: 'max-width: 640px', role: 'img', 'aria-label': 'Initiative roll distribution — bell curve centered on 10 with d10 + DEX modifier' });
    [0, .25, .5, .75, 1].forEach(r => {
      const yy = P + r * (H - P * 2);
      svg.appendChild(svgEl('line', { x1: P, x2: W - P, y1: yy, y2: yy, stroke: 'var(--line)', 'stroke-width': '.5', 'stroke-dasharray': '2 4' }));
    });
    svg.appendChild(svgEl('path', { d: path + ' L' + x(data.length - 1) + ',' + (H - P) + ' L' + x(0) + ',' + (H - P) + ' Z', fill: 'var(--accent)', 'fill-opacity': '.18' }));
    svg.appendChild(svgEl('path', { d: path, fill: 'none', stroke: 'var(--accent)', 'stroke-width': '2.5', style: 'filter: drop-shadow(0 0 8px var(--accent-glow))' }));
    return svg;
  }

  // ───────────────────────────────────────────────────────────── ACTS ───────
  function mountActs(root) {
    const acts = LIVE?.acts || [];
    const head = el('div', { class: 'section-head reveal' },
      el('span', { class: 'eyebrow' }, 'The Journey · Section 05'),
      el('h2', { html: `${LIVE?.counts?.acts || 6} acts.<br>${LIVE?.counts?.zones || 12} zones.` }),
      el('p', { class: 'lede' },
        'A 5-act main quest plus an optional Dragon\'s Reach epilogue. Each act gates the next with a boss; side-board bounties fill the gaps.'
      )
    );
    const rail = el('div', { class: 'acts-rail reveal' },
      acts.map(a => el('div', { class: 'act-tile' },
        el('div', { class: 'roman' }, a.roman),
        el('div', { class: 'name' }, a.name),
        el('div', { class: 'zones' }, a.zones || ''),
        el('div', { class: 'boss' }, '↳ ' + (a.boss || ''))
      ))
    );
    const section = el('section', { class: 'acts-section', id: 'acts' },
      el('div', { class: 'container' }, head),
      rail
    );
    root.replaceWith(section);
  }

  // ───────────────────────────────────────────────────────────── NEWS ───────
  function mountNews(root) {
    const items = (NEWS || []).slice(0, 6);
    const head = el('div', { class: 'section-head reveal', style: { display: 'flex', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', maxWidth: '100%' } },
      el('div', { style: { display: 'flex', flexDirection: 'column', gap: '14px' } },
        el('span', { class: 'eyebrow' }, 'Latest · Section 06'),
        el('h2', { html: 'Build notes &<br>milestone reports.' })
      ),
      el('a', { class: 'cta', href: './news/index.html' }, 'All news →')
    );
    const grid = el('div', { class: 'news-grid reveal' },
      items.map(n => el('a', { class: 'news-card', href: './news/' + n.slug + '.html' },
        el('div', { class: 'date' }, n.date || ''),
        el('div', { class: 'title' }, n.title || ''),
        el('div', { class: 'excerpt' }, n.summary || ''),
        el('div', { class: 'read' }, 'Read post →')
      ))
    );
    const section = el('section', { class: 'news-section', id: 'news' },
      el('div', { class: 'container' }, head, grid)
    );
    root.replaceWith(section);
  }

  // ─────────────────────────────────────────────────── EMBER LAYER ──────────
  function mountEmberLayer(intensity) {
    const layer = el('div', { class: 'ember-layer', 'aria-hidden': 'true' });
    document.body.appendChild(layer);
    const spawn = () => {
      if (!document.body.contains(layer)) return;
      const count = Math.max(1, Math.round(intensity * 2));
      for (let i = 0; i < count; i++) {
        const p = document.createElement('div');
        p.className = 'ember-particle live';
        const x = Math.random() * window.innerWidth;
        const dx = (Math.random() - 0.5) * 220;
        const size = 2 + Math.random() * 4;
        const dur = 9 + Math.random() * 8;
        p.style.left = x + 'px';
        p.style.bottom = (-20 + Math.random() * 80) + 'px';
        p.style.width = size + 'px';
        p.style.height = size + 'px';
        p.style.setProperty('--dx', dx + 'px');
        p.style.setProperty('--dur', dur + 's');
        p.style.opacity = '1';
        layer.appendChild(p);
        setTimeout(() => p.remove(), dur * 1000 + 200);
      }
      setTimeout(spawn, Math.max(140, 600 / Math.max(.4, intensity)));
    };
    spawn();
  }

  // ─────────────────────────────────────────────────── RUNE CURSOR ──────────
  // M375: disabled. The rune cursor was an accessibility issue (hid focus
  // indicators, hard to track on touch screens, decorative-only). Native
  // cursor + the :focus-visible rings carry all the affordance we need.
  function mountRuneCursor() { /* no-op */ }

  // ─────────────────────────────────────────────── REVEAL ON SCROLL ─────────
  function mountReveal() {
    const tick = () => {
      const els = document.querySelectorAll('.reveal:not(.in)');
      if (!('IntersectionObserver' in window)) {
        els.forEach(e => e.classList.add('in'));
        return;
      }
      const io = new IntersectionObserver((entries) => {
        entries.forEach(e => {
          if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
        });
      }, { threshold: 0.12, rootMargin: '0px 0px -10% 0px' });
      els.forEach(e => io.observe(e));
    };
    tick();
    // Re-scan after dynamic mounts
    setTimeout(tick, 250);
    setTimeout(tick, 1000);
  }

  // ───────────────────────────────────────────────────────── MAIN ───────────
  async function main() {
    document.body.classList.add('ev-themed');
    await loadData();
    const m = id => document.getElementById(id);
    if (m('hero-mount')) mountHero(m('hero-mount'));
    if (m('classes-mount')) mountClasses(m('classes-mount'));
    if (m('combat-mount')) mountCombat(m('combat-mount'));
    if (m('companions-mount')) mountCompanions(m('companions-mount'));
    if (m('charts-mount')) mountCharts(m('charts-mount'));
    if (m('acts-mount')) mountActs(m('acts-mount'));
    if (m('news-mount')) mountNews(m('news-mount'));
    mountEmberLayer(0.5);
    mountRuneCursor();
    mountReveal();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', main);
  } else {
    main();
  }
})();
