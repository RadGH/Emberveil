#!/usr/bin/env node
/**
 * build-story-quest-graph.cjs
 *
 * Reads all quest-line JSON files from data/story/quest-lines/ and
 * side-quest-templates.json, then emits public/assets/data/story/quest-graph.json
 * in the format consumed by public/assets/quest-graph.html.
 *
 * Schema emitted per quest:
 * {
 *   questId: string,
 *   title: string,
 *   act: number,
 *   type: 'primary' | 'secondary' | 'companion' | 'side',
 *   phases: [{ id, label, completeCondition, effects:[], nextPhase }],
 *   outcomes: [{ id, label, type:'success'|'fail'|'branch', effects:[] }]
 * }
 *
 * Run: node scripts/build-story-quest-graph.cjs
 */

'use strict';

const fs   = require('fs');
const path = require('path');

const ROOT         = path.resolve(__dirname, '..');
const QUEST_DIR    = path.join(ROOT, 'data', 'story', 'quest-lines');
const SIDE_QUEST   = path.join(ROOT, 'data', 'story', 'side-quest-templates.json');
const OUT_DIR      = path.join(ROOT, 'public', 'assets', 'data', 'story');
const OUT_FILE     = path.join(OUT_DIR, 'quest-graph.json');

function loadJson(fp) {
  try { return JSON.parse(fs.readFileSync(fp, 'utf8')); } catch (_) { return null; }
}

function humanLabel(id) {
  return String(id || '').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function processQuestFile(filePath, type) {
  const data = loadJson(filePath);
  if (!data) return null;

  const questId = data.id || path.basename(filePath, '.json');
  const phases  = [];
  const outcomes = [];

  // Walk phases array (primary structure) or flat keys
  const phaseList = Array.isArray(data.phases)
    ? data.phases
    : Object.entries(data).filter(([k]) => k.startsWith('phase')).map(([,v]) => v);

  for (const ph of phaseList) {
    if (!ph || typeof ph !== 'object') continue;
    const phId = ph.id || ph.phaseId || `phase_${phases.length + 1}`;
    phases.push({
      id:                phId,
      label:             ph.label || humanLabel(phId),
      completeCondition: ph.completeCondition || ph.condition || null,
      onComplete:        Array.isArray(ph.onComplete) ? ph.onComplete : [],
      nextPhase:         ph.nextPhase || ph.next || null,
    });
  }

  // Walk outcomes
  const outList = Array.isArray(data.outcomes)
    ? data.outcomes
    : Object.entries(data).filter(([k]) => k.startsWith('outcome')).map(([,v]) => v);

  for (const out of outList) {
    if (!out || typeof out !== 'object') continue;
    const outId = out.id || out.outcomeId || `outcome_${outcomes.length + 1}`;
    outcomes.push({
      id:      outId,
      label:   out.label || humanLabel(outId),
      type:    out.type || (outId.includes('fail') ? 'fail' : outId.includes('branch') ? 'branch' : 'success'),
      effects: Array.isArray(out.effects) ? out.effects : [],
    });
  }

  return {
    questId,
    title:    data.title || humanLabel(questId),
    act:      data.act || (questId.includes('act1') ? 1 : questId.includes('act2') ? 2 : questId.includes('act3') ? 3 : 0),
    type,
    phases,
    outcomes,
  };
}

function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const graph = [];

  // Primary / secondary quests from quest-lines/
  if (fs.existsSync(QUEST_DIR)) {
    const files = fs.readdirSync(QUEST_DIR).filter(f => f.endsWith('.json') && !f.startsWith('_'));
    for (const f of files) {
      const type = f.startsWith('primary') ? 'primary' : f.startsWith('secondary') ? 'secondary' : 'companion';
      const entry = processQuestFile(path.join(QUEST_DIR, f), type);
      if (entry) graph.push(entry);
    }
  }

  // Side quests
  if (fs.existsSync(SIDE_QUEST)) {
    const data = loadJson(SIDE_QUEST);
    const list = Array.isArray(data) ? data : (data?.quests || []);
    for (const q of list) {
      if (!q || typeof q !== 'object') continue;
      const questId = q.id || `side_${graph.length}`;
      graph.push({
        questId,
        title:    q.title || humanLabel(questId),
        act:      q.act || 0,
        type:     'side',
        phases:   (q.phases || []).map((ph, i) => ({
          id:                ph.id || `phase_${i+1}`,
          label:             ph.label || humanLabel(ph.id || `phase_${i+1}`),
          completeCondition: ph.completeCondition || null,
          onComplete:        ph.onComplete || [],
          nextPhase:         ph.nextPhase || null,
        })),
        outcomes: (q.outcomes || []).map((out, i) => ({
          id:      out.id || `outcome_${i+1}`,
          label:   out.label || humanLabel(out.id || `outcome_${i+1}`),
          type:    out.type || 'success',
          effects: out.effects || [],
        })),
      });
    }
  }

  // Sort by act then type
  graph.sort((a, b) => a.act - b.act || a.type.localeCompare(b.type));

  const out = {
    generatedAt: new Date().toISOString(),
    questCount: graph.length,
    quests: graph,
  };

  fs.writeFileSync(OUT_FILE, JSON.stringify(out, null, 2));
  console.log(`[quest-graph] Wrote ${graph.length} quests to ${OUT_FILE}`);
}

main();
