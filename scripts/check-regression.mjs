#!/usr/bin/env node
/**
 * scripts/check-regression.mjs — M301 Task 3
 *
 * Reads the 2 most-recent rebalance snapshots from public/assets/rebalance_snapshots/.
 * For each act, compares win rates against:
 *   1. The per-act floor defined in scripts/regression-thresholds.json.
 *   2. A relative drop of alertOnDropPct percentage points vs. the prior snapshot.
 *
 * Writes public/assets/data/regression-alerts.json (empty array = no issues).
 * Exits with code 1 if any alerts are present so it can gate CI/CD pipelines.
 *
 * Usage:
 *   node scripts/check-regression.mjs
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);
const GAME_ROOT  = path.resolve(__dirname, '../');

const SNAP_DIR    = path.join(GAME_ROOT, 'public/assets/rebalance_snapshots');
const THRESH_FILE = path.join(__dirname, 'regression-thresholds.json');
const OUT_FILE    = path.join(GAME_ROOT, 'public/assets/data/regression-alerts.json');

// Ensure output dir exists
fs.mkdirSync(path.dirname(OUT_FILE), { recursive: true });

// Load thresholds
if (!fs.existsSync(THRESH_FILE)) {
  console.error('Missing regression-thresholds.json:', THRESH_FILE);
  process.exit(1);
}
const thresholds = JSON.parse(fs.readFileSync(THRESH_FILE, 'utf8'));
const floors     = thresholds.actWinRateFloors || {};
const dropLimit  = thresholds.alertOnDropPct   ?? 10;

// Find the 2 most-recent snapshots
if (!fs.existsSync(SNAP_DIR)) {
  console.warn('No snapshot dir found; writing empty alerts.');
  fs.writeFileSync(OUT_FILE, JSON.stringify([], null, 2));
  process.exit(0);
}

const snapFiles = fs.readdirSync(SNAP_DIR)
  .filter(f => f.endsWith('.json'))
  .sort()  // ISO date-stamped names sort chronologically
  .slice(-2);

if (snapFiles.length === 0) {
  console.log('No snapshots found — nothing to check.');
  fs.writeFileSync(OUT_FILE, JSON.stringify([], null, 2));
  process.exit(0);
}

if (snapFiles.length === 1) {
  console.log(`Only one snapshot (${snapFiles[0]}) — floor checks only (no prior to compare).`);
}

function loadSnapshot(file) {
  const raw = JSON.parse(fs.readFileSync(path.join(SNAP_DIR, file), 'utf8'));
  // Aggregate per-act win rates: average winRate of all results for each act
  const byAct = {};
  for (const r of (raw.results || [])) {
    const act = String(r.act);
    if (!byAct[act]) byAct[act] = [];
    byAct[act].push(r.winRate);
  }
  const actWinRates = {};
  for (const [act, rates] of Object.entries(byAct)) {
    actWinRates[act] = rates.reduce((s, v) => s + v, 0) / rates.length;
  }
  return { file, generated: raw.generated, actWinRates };
}

const snapshots = snapFiles.map(loadSnapshot);
const latest    = snapshots[snapshots.length - 1];
const prior     = snapshots.length >= 2 ? snapshots[snapshots.length - 2] : null;

const alerts = [];

for (const [act, floor] of Object.entries(floors)) {
  const current = latest.actWinRates[act];
  if (current == null) continue;  // no data for this act in this snapshot

  // Floor check
  if (current < floor) {
    alerts.push({
      type:    'floor_breach',
      act:     parseInt(act, 10),
      message: `Act ${act} win-rate ${(current * 100).toFixed(1)}% is below configured floor ${(floor * 100).toFixed(1)}%`,
      current: current,
      floor:   floor,
      snapshot: latest.file,
    });
  }

  // Relative drop check
  if (prior) {
    const prev = prior.actWinRates[act];
    if (prev != null) {
      const dropPct = (prev - current) * 100;
      if (dropPct >= dropLimit) {
        alerts.push({
          type:     'relative_drop',
          act:      parseInt(act, 10),
          message:  `Act ${act} win-rate dropped ${dropPct.toFixed(1)}pp (${(prev * 100).toFixed(1)}% -> ${(current * 100).toFixed(1)}%) vs. prior snapshot`,
          current,
          previous: prev,
          dropPct,
          threshold: dropLimit,
          priorSnapshot:   prior.file,
          currentSnapshot: latest.file,
        });
      }
    }
  }
}

fs.writeFileSync(OUT_FILE, JSON.stringify(alerts, null, 2));

if (alerts.length === 0) {
  console.log('check-regression: OK — no regression alerts.');
  process.exit(0);
} else {
  console.warn(`\ncheck-regression: ${alerts.length} ALERT(S):`);
  for (const a of alerts) console.warn(` [${a.type.toUpperCase()}]  ${a.message}`);
  console.warn(`\nWrote ${OUT_FILE}`);
  process.exit(1);
}
