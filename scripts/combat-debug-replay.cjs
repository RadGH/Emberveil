#!/usr/bin/env node
/**
 * combat-debug-replay.cjs — M377 Combat Debug Playtester (read-only)
 *
 * Drives the headless simulator (src/game/simulator.js) over a fixed list of
 * representative encounters, then synthesizes structured combat-debug events
 * from the sim's log array so we can run the same parity cross-checks that
 * CombatScreen.js's combatDebug instrumentation produces in the browser.
 *
 * IMPORTANT GAP (also a finding, captured in _findings.json):
 *   - simulator.js does NOT import combatDebug. The instrumentation only
 *     exists in CombatScreen.js, which is heavily DOM/canvas coupled
 *     (this._spawnDmgNumber, this._flashMap, this._el, etc.) and cannot
 *     be driven headlessly without a non-trivial refactor.
 *   - This harness therefore CANNOT capture true `meter_add` /
 *     `legendary_proc` / `status_apply` events from the live UI path.
 *     What it CAN do: synthesize equivalent events from the simulator's
 *     `log` array and detect *internal* simulator inconsistencies, plus
 *     document divergence between simulator and CombatScreen by category.
 *
 *   To capture true UI-path events, run a combat in the browser with
 *   `localStorage.emberveil_combat_debug_log = '1'` and inspect
 *   `window.__combatDebug.buffer`. See README block at the bottom.
 *
 * Output:
 *   public/assets/data/combat-debug/<encounter_id>.json    per-encounter buffer + analysis
 *   public/assets/data/combat-debug/_findings.json         aggregate findings
 */
'use strict';

const fs  = require('fs');
const path = require('path');

const RUNS_PER_ENCOUNTER = 5;          // multiple seeds for signal
const BASE_SEED = 1337;
const PARTY_LEVEL = 12;

const ENCOUNTERS_TO_TEST = [
  { key: 'goblin_camp',         act: 1, label: 'early Act 1' },
  { key: 'corrupted_outpost',   act: 1, label: 'mid Act 1'   },
  { key: 'obsidian_garrison',   act: 2, label: 'Act 2'       },
  { key: 'archfiend_malgrath',  act: 3, label: 'Act 3 boss'  },
  { key: 'dragon_king_fight',   act: 6, label: 'Act 6 boss'  },
];

async function loadModules() {
  const sim = await import('../src/game/simulator.js');
  const map = await import('../src/maps/mapData.js');
  const cdb = await import('../src/utils/combatDebug.js');
  return { sim, map, cdb };
}

// Build a representative party — warrior + cleric + mage + ranger at L12.
function makeParty() {
  const lvl = PARTY_LEVEL;
  const attrPool = lvl * 2;
  const attrs = (sw, dw, iw, cw) => {
    const t = sw + dw + iw + cw;
    return {
      STR: 8 + Math.round(attrPool * sw / t),
      DEX: 8 + Math.round(attrPool * dw / t),
      INT: 8 + Math.round(attrPool * iw / t),
      CON: 8 + Math.round(attrPool * cw / t),
    };
  };
  const wMin = 4 + 3 * 2, wMax = 8 + 5 * 2; // act-2-ish gear scaling
  const armorBase = 2 + 3 * 2;
  const eq = (primary) => ({
    weapon: { name: 'wpn', dmg: [wMin, wMax], affixes: [{ stat: primary, value: 4 }] },
    chest:  { armor: armorBase + 2 },
    legs:   { armor: armorBase },
    helm:   { armor: Math.max(1, armorBase - 1) },
    hands:  { armor: 1, affixes: [{ stat: primary, value: 1 }] },
    feet:   { armor: 1 },
    ring1:  { affixes: [{ stat: primary, value: 1 }] },
  });
  // M378 — equip warrior with 2 pieces of Dragon-Lord's Aspect so the
  // dragon_fury_breath legendary fires; mage with 2-piece Iron Weave so
  // mage_missile_aoe (Arcane Bounce) fires on Magic Missile / Fire Bolt.
  const warriorEq = eq('STR');
  warriorEq.weapon.setId = 'dragon_lords_aspect';
  warriorEq.helm.setId = 'dragon_lords_aspect';
  const mageEq = eq('INT');
  mageEq.weapon.setId = 'apprentice_initiation';
  mageEq.helm.setId = 'apprentice_initiation';
  return [
    { id: 'h-w', name: 'War', class: 'warrior', level: lvl, attrs: attrs(3,1,0,2), equipment: warriorEq },
    { id: 'h-c', name: 'Clr', class: 'cleric',  level: lvl, attrs: attrs(0,0,2,2), equipment: eq('INT') },
    { id: 'h-m', name: 'Mag', class: 'mage',    level: lvl, attrs: attrs(0,0,3,1), equipment: mageEq },
    { id: 'h-r', name: 'Rng', class: 'ranger',  level: lvl, attrs: attrs(0,3,0,1), equipment: eq('DEX') },
  ];
}

/**
 * Synthesize combat-debug-style events from a sim result. Each sim log
 * entry maps to:
 *   - hit  → meter_add (kind:dmg, source: skill||'Attack') + damage_apply
 *   - miss → hit_check (rolled > chance)
 *   - heal → meter_add (kind:heal)
 *   - revive/buff/skill_other → ai_decision audit only
 */
function synthesizeEvents(simResult, party, encounterName) {
  const events = [];
  events.push({ kind: 'combat_start', data: { encounter: encounterName, party: party.map(p=>p.name) } });
  let curRound = 0;
  for (const e of simResult.log) {
    if (e.round !== curRound) {
      curRound = e.round;
      events.push({ kind: 'round_start', round: curRound, data: { round: curRound } });
    }
    const base = { round: e.round, actor: e.actor };
    if (e.type === 'hit') {
      const source = e.skill || 'Attack';
      events.push({ ...base, kind: 'meter_add', data: {
        actor: e.actor, kind: 'dmg', amount: e.dmg, source,
        target: e.target, crit: false, overkill: 0,
      }});
      events.push({ ...base, kind: 'damage_apply', data: {
        actor: e.actor, target: e.target,
        raw: e.raw || e.dmg, final: e.dmg,
        source, hpAfter: e.targetHpAfter,
      }});
      // Mirror the in-screen log line — what the player sees.
      const msg = e.skill
        ? `${e.actor} → ${e.target}: ${e.dmg} dmg (${e.skill})`
        : `${e.actor} → ${e.target}: ${e.dmg} dmg`;
      events.push({ ...base, kind: 'log_line', data: { msg, type: 'hero', dmg: e.dmg } });
      if (e.lifeSteal) {
        events.push({ ...base, kind: 'meter_add', data: { actor: e.actor, kind: 'heal', amount: e.lifeSteal, source: 'Lifesteal' } });
      }
    } else if (e.type === 'miss') {
      events.push({ ...base, kind: 'hit_check', data: { actor: e.actor, target: e.target, hit: false } });
      events.push({ ...base, kind: 'log_line', data: { msg: `${e.actor} misses ${e.target}.`, type: 'hero', dmg: null } });
    } else if (e.type === 'heal') {
      events.push({ ...base, kind: 'meter_add', data: {
        actor: e.actor, kind: 'heal', amount: e.heal, source: e.skill,
        target: e.target,
      }});
      events.push({ ...base, kind: 'log_line', data: { msg: `${e.actor} heals ${e.target} for ${e.heal}`, type: 'hero', dmg: null } });
    } else if (e.type === 'revive') {
      events.push({ ...base, kind: 'status_apply', data: { actor: e.actor, target: e.target, status: 'revived', skill: e.skill } });
    } else if (e.type === 'buff') {
      events.push({ ...base, kind: 'status_apply', data: { actor: e.actor, status: 'buff', skill: e.skill, targets: e.targets } });
    } else if (e.type === 'skill_other') {
      events.push({ ...base, kind: 'ai_decision', data: { actor: e.actor, picked: e.skill, type: e.skillType } });
    }
  }
  events.push({ kind: 'combat_end', data: { winner: simResult.winner, rounds: simResult.rounds } });
  return events;
}

/**
 * Cross-check the three views the user cares about:
 *   meter_add totals, damage_apply totals, parsed log_line totals.
 * Returns per-actor breakdown and aggregate diffs.
 */
function crossCheck(events) {
  const meterByActorSource = new Map();    // `${actor}::${source}` -> sum
  const damageApplyByActor = new Map();    // actor -> sum(final)
  const logByActor = new Map();            // actor -> parsed dmg sum
  const sourcesSeen = new Set();
  for (const ev of events) {
    if (ev.kind === 'meter_add' && ev.data.kind === 'dmg') {
      const k = `${ev.data.actor}::${ev.data.source}`;
      meterByActorSource.set(k, (meterByActorSource.get(k) || 0) + (ev.data.amount || 0));
      sourcesSeen.add(ev.data.source);
    } else if (ev.kind === 'damage_apply') {
      damageApplyByActor.set(ev.data.actor, (damageApplyByActor.get(ev.data.actor) || 0) + (ev.data.final || 0));
    } else if (ev.kind === 'log_line') {
      // Mirror parseDamageFromLogLine
      let n = null;
      const msg = ev.data.msg || '';
      let m = msg.match(/:\s*(-?\d+)\s*dmg\b/i);
      if (m) n = parseInt(m[1], 10);
      else { m = msg.match(/\bfor\s+(-?\d+)\s+(?:damage|dmg)\b/i); if (m) n = parseInt(m[1], 10); }
      if (n != null && ev.data.type === 'hero' && n > 0) {
        // Heuristic: log lines from heals have "heals" text; skip those
        if (!/heals/i.test(msg)) {
          logByActor.set(ev.actor, (logByActor.get(ev.actor) || 0) + n);
        }
      }
    }
  }
  // Per-actor meter totals
  const meterByActor = new Map();
  for (const [k, v] of meterByActorSource) {
    const actor = k.split('::')[0];
    meterByActor.set(actor, (meterByActor.get(actor) || 0) + v);
  }
  const allActors = new Set([...meterByActor.keys(), ...damageApplyByActor.keys(), ...logByActor.keys()]);
  const perActor = [];
  let totalMeter = 0, totalApply = 0, totalLog = 0;
  for (const a of allActors) {
    const m = meterByActor.get(a) || 0;
    const d = damageApplyByActor.get(a) || 0;
    const l = logByActor.get(a) || 0;
    totalMeter += m; totalApply += d; totalLog += l;
    perActor.push({
      actor: a,
      meter: m, damageApply: d, logParsed: l,
      diffMeterApply: m - d,
      diffMeterLog:   m - l,
    });
  }
  return {
    perActor,
    totals: { meter: totalMeter, damageApply: totalApply, logParsed: totalLog },
    diffs: {
      meter_vs_apply: totalMeter - totalApply,
      meter_vs_log:   totalMeter - totalLog,
      apply_vs_log:   totalApply - totalLog,
    },
    sourcesSeen: [...sourcesSeen].sort(),
    meterByActorSource: Object.fromEntries(meterByActorSource),
  };
}

/**
 * Heuristic checks for the bug patterns the playtester is asked to find.
 */
function findBugPatterns(events, simResult, encounterKey) {
  const findings = [];
  // a) Source attribution mismatch — if any meter_add for a "hit" with skill
  //    landed under source 'Attack' while the same actor's prior log_line
  //    referenced a skill, that's a bucketing bug. In sim, source is set
  //    directly from log entry's e.skill, so this can ONLY be flagged
  //    via the "live UI path not instrumented in this run" finding.
  //
  // b) Per-skill total drift — sum meter_add per skill vs damage_apply.
  //    In sim, damage_apply.final === meter_add.amount for every hit
  //    (synthesized from same log entry), so they MUST match. If not,
  //    something in synth is broken — log it.
  const meterPerSkill = new Map();
  const applyPerActor = new Map();
  for (const ev of events) {
    if (ev.kind === 'meter_add' && ev.data.kind === 'dmg') {
      meterPerSkill.set(ev.data.source, (meterPerSkill.get(ev.data.source) || 0) + ev.data.amount);
    }
    if (ev.kind === 'damage_apply') {
      applyPerActor.set(ev.data.actor, (applyPerActor.get(ev.data.actor) || 0) + ev.data.final);
    }
  }
  // c) Hit/crit math drift — in sim, miss==e.type==='miss', hit math is
  //    encoded inside simulator. We can't audit the dice rolls without
  //    recreating the RNG. Note as a structural gap.
  // d) Status application gaps — sim doesn't model status ticks (statuses
  //    are evaluated per-round but no tick events surface in `log`).
  //    Findings flag this absence.
  let statusApplies = 0, statusTicks = 0;
  for (const ev of events) {
    if (ev.kind === 'status_apply') statusApplies++;
    if (ev.kind === 'status_tick')  statusTicks++;
  }
  if (statusApplies > 0 && statusTicks === 0) {
    findings.push({
      kind: 'status_no_ticks',
      severity: 'high',
      detail: `${statusApplies} status_apply events in ${encounterKey} but 0 status_tick events. Simulator does not emit per-round tick events even though buff durations decrement; UI parity therefore cannot be verified through sim. CombatScreen does push status_tick — only sim is silent.`,
    });
  }
  // e) AI rationality — find any sim turn where actor cast offensive while
  //    an ally was at <30% HP, when actor had a heal skill available.
  //    sim's AI mirrors CombatScreen's selection logic (per simHeroAI),
  //    so this is largely covered, but a quick audit is informative.
  let badHealerCalls = 0;
  // Scan log to detect: cleric casting non-heal while another hero earlier
  // in the same round took damage that put them <30% maxHp.
  // (Approximation — sim doesn't expose ally HP at decision time, so we
  //  just count rounds where Clr casted with the team in trouble.)
  const roundsWithCriticalAlly = new Set();
  // Track rough HP per hero across rounds via damage taken (best-effort).
  for (const ev of events) {
    if (ev.kind === 'damage_apply' && simResult.party?.find(p => p.name === ev.data.target)) {
      // hero took damage — flag the round.
    }
  }
  // Simpler: count cleric heal vs damage casts as a sanity ratio.
  let clericHeals = 0, clericAttacks = 0;
  for (const ev of events) {
    if (ev.kind === 'meter_add' && ev.actor === 'Clr') {
      if (ev.data.kind === 'heal') clericHeals++;
      else if (ev.data.kind === 'dmg') clericAttacks++;
    }
  }
  // f) Parity warnings — replicate combatDebug.checkParity.
  const cc = crossCheck(events);
  const parityWarnings = [];
  const totals = cc.totals;
  const max = Math.max(totals.meter, totals.damageApply, totals.logParsed, 1);
  const tolerance = Math.max(5, max * 0.05);
  const checks = [
    ['meter_vs_apply', totals.meter, totals.damageApply],
    ['meter_vs_log',   totals.meter, totals.logParsed],
    ['apply_vs_log',   totals.damageApply, totals.logParsed],
  ];
  for (const [tag, a, b] of checks) {
    if (Math.abs(a - b) > tolerance) {
      parityWarnings.push({ pair: tag, a, b, delta: a - b, tolerance });
    }
  }
  return { findings, parityWarnings, perSkill: Object.fromEntries(meterPerSkill), clericHeals, clericAttacks, crossCheck: cc };
}

async function main() {
  const { sim, map, cdb } = await loadModules();
  const ENCOUNTERS = map.ENCOUNTERS;
  // M378 — turn on real combatDebug instrumentation now that simulator emits.
  cdb.combatDebug.setEnabled(true);
  // Silence the per-event console.debug stream the harness doesn't need.
  // eslint-disable-next-line no-console
  const _origDebug = console.debug;
  console.debug = () => {};
  const outDir = path.join(__dirname, '..', 'public/assets/data/combat-debug');
  fs.mkdirSync(outDir, { recursive: true });

  const aggregate = {
    generatedAt: new Date().toISOString(),
    runsPerEncounter: RUNS_PER_ENCOUNTER,
    baseSeed: BASE_SEED,
    party: makeParty().map(p => ({ id: p.id, name: p.name, class: p.class, level: p.level })),
    structuralGaps: [
      {
        id: 'sim-not-instrumented',
        severity: 'critical',
        detail: 'src/game/simulator.js does not import or call combatDebug. All M377 instrumentation lives only in src/ui/screens/CombatScreen.js. Therefore (a) headless playtests via this harness CANNOT capture authentic events from the same code path the player sees, and (b) any divergence between simulator output and CombatScreen output is invisible to the parity check. Running the same {party, encounter, seed} through both produces independent results because the simulator reimplements the loop. To diagnose user-visible UI bugs this harness is necessarily a proxy — the next agent should either (1) extract a shared combat core both call into, or (2) instrument simulator.js with the same combatDebug.push call sites.',
        evidence: 'grep -n "combatDebug" src/game/simulator.js → no matches',
      },
      {
        id: 'simulator-no-status-ticks',
        severity: 'high',
        detail: 'Simulator decrements status durations at round start (see simulator.js:507-516) but never emits per-tick events. CombatScreen DOES push status_tick events. Status-DoT parity (poison, burn, bleed) cannot be audited from sim runs alone.',
      },
      {
        id: 'simulator-no-legendary-procs',
        severity: 'high',
        detail: 'Simulator does not invoke legendaryEffects.js dispatch hooks at all. CombatScreen pushes a legendary_proc event for every onAttack/onHit/onCrit/onKill firing. Legendary attribution bugs (the M369 Dragon Breath class of bug) are therefore undetectable from sim runs — they require browser playtest with localStorage emberveil_combat_debug_log = 1.',
      },
      {
        id: 'simulator-no-meter-mit-dodge',
        severity: 'medium',
        detail: 'Simulator never produces meter_add{kind:mit} or meter_add{kind:dodge} events. CombatScreen does. This means barrier/DR/dodge parity between Combat Log and Damage Meter cannot be tested headlessly.',
      },
      {
        id: 'simulator-no-crit-bucketing',
        severity: 'medium',
        detail: 'Simulator computes crits inline but does NOT mark hit log entries as crit (no e.crit field on the log push at simulator.js:468-471). CombatScreen pushes crit_check events with the roll vs threshold. Audit pattern (c) "crit fired but rolled above threshold" is therefore unprovable without UI data.',
      },
    ],
    encounters: {},
    aggregateBugs: [],
    parityWarningsAcrossAll: [],
  };

  let totalEvents = 0;
  let totalRuns = 0;

  for (const ent of ENCOUNTERS_TO_TEST) {
    const enc = ENCOUNTERS[ent.key];
    if (!enc) {
      console.warn(`encounter ${ent.key} missing — skipping`);
      continue;
    }
    const perRun = [];
    let combinedEvents = [];
    let aggMeter = 0, aggApply = 0, aggLog = 0;
    let wins = 0, totalRounds = 0;
    let aggParityWarnings = [];
    for (let i = 0; i < RUNS_PER_ENCOUNTER; i++) {
      const seed = BASE_SEED + i;
      const party = makeParty();
      // M378 — clear buffer per run so we can count emitted events.
      cdb.combatDebug.clear();
      const res = sim.runSimulation({ heroes: party, encounter: enc, act: ent.act, seed });
      // Snapshot the real instrumentation buffer.
      const realBuffer = cdb.combatDebug.buffer.slice();
      const counts = realBuffer.reduce((acc, e) => { acc[e.kind] = (acc[e.kind] || 0) + 1; return acc; }, {});
      const events = synthesizeEvents(res, party, enc.name || ent.key);
      // Append the real instrumentation kinds we care about (legendary, ticks)
      // to the synthesized event list so the existing parity counters pick them up.
      for (const e of realBuffer) {
        if (e.kind === 'legendary_proc' || e.kind === 'status_tick' || e.kind === 'status_apply') {
          events.push({ kind: e.kind, round: e.round, actor: e.actor, data: e.data });
        }
      }
      const bugs   = findBugPatterns(events, res, ent.key);
      bugs.realCounts = counts;
      perRun.push({
        seed,
        winner: res.winner,
        rounds: res.rounds,
        eventCount: events.length,
        totals: bugs.crossCheck.totals,
        diffs: bugs.crossCheck.diffs,
        parityWarnings: bugs.parityWarnings,
        perSkillMeter: bugs.perSkill,
        clericHeals: bugs.clericHeals,
        clericAttacks: bugs.clericAttacks,
        sourcesSeen: bugs.crossCheck.sourcesSeen,
        realCounts: bugs.realCounts,
        damageBySource: res.stats?.damageBySource || {},
      });
      combinedEvents = combinedEvents.concat(events);
      aggMeter += bugs.crossCheck.totals.meter;
      aggApply += bugs.crossCheck.totals.damageApply;
      aggLog   += bugs.crossCheck.totals.logParsed;
      if (res.winner === 'party') wins++;
      totalRounds += res.rounds;
      aggParityWarnings = aggParityWarnings.concat(bugs.parityWarnings.map(w => ({ ...w, seed })));
      totalEvents += events.length;
      totalRuns++;
      // Add findings for high-severity stuff
      for (const f of bugs.findings) {
        aggregate.aggregateBugs.push({ encounter: ent.key, seed, ...f });
      }
    }
    // Per-encounter file
    const encOut = {
      key: ent.key,
      label: ent.label,
      act: ent.act,
      runs: perRun.length,
      winRate: wins / Math.max(1, perRun.length),
      avgRounds: totalRounds / Math.max(1, perRun.length),
      aggregate: {
        meter: aggMeter,
        damageApply: aggApply,
        logParsed: aggLog,
        meter_vs_apply: aggMeter - aggApply,
        meter_vs_log:   aggMeter - aggLog,
        apply_vs_log:   aggApply - aggLog,
      },
      parityWarnings: aggParityWarnings,
      perRun,
      // Sample of last run's events (truncate; full buffer is huge)
      sampleEvents: combinedEvents.slice(-200),
    };
    const encPath = path.join(outDir, `${ent.key}.json`);
    fs.writeFileSync(encPath, JSON.stringify(encOut, null, 2));
    aggregate.encounters[ent.key] = {
      label: ent.label,
      act: ent.act,
      winRate: encOut.winRate,
      avgRounds: encOut.avgRounds,
      aggregate: encOut.aggregate,
      parityWarningCount: aggParityWarnings.length,
    };
    aggregate.parityWarningsAcrossAll = aggregate.parityWarningsAcrossAll.concat(aggParityWarnings.map(w => ({ ...w, encounter: ent.key })));
    console.log(`[${ent.key}] ${perRun.length} runs, winRate=${(encOut.winRate * 100).toFixed(0)}%, avgRounds=${encOut.avgRounds.toFixed(1)}, parity warnings: ${aggParityWarnings.length}`);
  }
  aggregate.totalEvents = totalEvents;
  aggregate.totalRuns = totalRuns;
  fs.writeFileSync(path.join(outDir, '_findings.json'), JSON.stringify(aggregate, null, 2));
  console.log(`\nWrote ${Object.keys(aggregate.encounters).length} encounter files + _findings.json to ${outDir}`);
  console.log(`Total runs: ${totalRuns}, total events synthesized: ${totalEvents}`);
}

main().catch(err => { console.error('combat-debug-replay failed:', err); process.exit(1); });

/* ============================================================================
 * BROWSER COMPANION SCRIPT — paste into DevTools console after a combat ends
 * ============================================================================
 *
 * This harness only drives the simulator. To capture true CombatScreen
 * events, run a fight live with logging enabled, then dump the buffer:
 *
 *   // 1. Enable structured logging (one-time, persisted in localStorage)
 *   localStorage.setItem('emberveil_combat_debug_log', '1');
 *   location.reload();
 *
 *   // 2. Play a combat to completion.
 *
 *   // 3. After the combat report appears, copy the buffer:
 *   copy(JSON.stringify(window.__combatDebug.buffer, null, 2));
 *
 *   // 4. Save the JSON next to this script:
 *   //    public/assets/data/combat-debug/live-<encounter>.json
 *   //    Then cross-reference with the simulator-derived files.
 *
 * What the live buffer captures that this harness CANNOT:
 *   - meter_add events from _meterAddDamage (real source attribution)
 *   - legendary_proc events
 *   - status_apply / status_tick / status_expire (real durations)
 *   - hit_check + crit_check with actual rolls
 *   - damage_apply_enter (pre-mitigation) + damage_apply (post-mitigation)
 *   - parity_warning events from the end-of-combat checkParity call
 * ============================================================================
 */
