/**
 * parse-changelog-categories.cjs
 *
 * Reads game13_releases/game_meta.json changelog string, detects categories
 * per line via keyword heuristics, and writes
 * public/assets/changelog-structured.json for changelog.html.
 *
 * Categories: BugFix | Balance | QoL | Art | Feature
 *
 * Run:  node scripts/parse-changelog-categories.cjs
 * Wired via "prebuild" in package.json (runs before every build).
 */

'use strict';

const fs   = require('fs');
const path = require('path');

const metaPath = path.resolve(__dirname, '../../game13_releases/game_meta.json');
const outPath  = path.resolve(__dirname, '../public/assets/changelog-structured.json');

// ─── Category detection ────────────────────────────────────────────────────

const CATEGORY_RULES = [
  {
    id: 'BugFix',
    label: 'Bug Fix',
    patterns: [/\bfix(ed|es)?\b/i, /\bbug\b/i, /\bcorrect(ed|s)?\b/i, /\bpatch\b/i, /\brepair(ed)?\b/i, /\bcrash\b/i, /\bsoftlock\b/i, /\bregress/i, /\bbroke(n)?\b/i],
  },
  {
    id: 'Balance',
    label: 'Balance',
    patterns: [/\bbalanc/i, /\bbuff(ed|s)?\b/i, /\bnerf(ed|s)?\b/i, /\bdamage\b/i, /\bscal(e|ing)\b/i, /\brebalance\b/i, /\bdr\b/i, /\bcooldown\b/i, /\barmor\b/i, /\bstats?\b.*tweaked?\b/i, /\btuned?\b/i, /\boverpower/i, /\bunderpower/i],
  },
  {
    id: 'QoL',
    label: 'QoL',
    patterns: [/\bQoL\b/i, /\bpolish\b/i, /\btoast\b/i, /\btooltip\b/i, /\bUI\b/i, /\bUX\b/i, /\bquality.of.life\b/i, /\bresponsive\b/i, /\baccessib/i, /\bscrollbar\b/i, /\bconvenience\b/i, /\blayout\b/i, /\bbadge\b/i, /\bstyle\b/i, /\bvisual\b.*tweak/i],
  },
  {
    id: 'Art',
    label: 'Art',
    patterns: [/\bsprite\b/i, /\bart\b/i, /\bimage\b/i, /\bpixellab\b/i, /\bportrait\b/i, /\bspritecook\b/i, /\banimation\b/i, /\bbackground\b/i, /\baudio\b/i, /\bsfx\b/i, /\bmusic\b/i, /\bgenerated\b.*image/i, /\bopened?\b.*ai\b/i, /\bfont\b/i],
  },
];

function detectCategories(line) {
  const cats = [];
  for (const rule of CATEGORY_RULES) {
    if (rule.patterns.some(p => p.test(line))) {
      cats.push(rule.id);
    }
  }
  if (cats.length === 0) cats.push('Feature');
  return cats;
}

// ─── Parse milestone blocks from flat changelog string ────────────────────

function parseChangelog(flatStr) {
  // Split on lines. Group by milestone header (M### prefix, bullet lines under it).
  // Format tends to be:
  //   M297 (2026-04-26): Summary sentence.
  //   - Item one
  //   - Item two
  // OR simply flat bullets: "- M297: thing"
  const lines = flatStr.split('\n').map(l => l.trim()).filter(Boolean);
  const entries = [];
  let current = null;

  for (const line of lines) {
    // Milestone header patterns:
    //   "M297 — " or "M297: " or "M297 (date):"
    const headerMatch = line.match(/^M(\d+)\b[\s—:–-]*(.*)/);
    if (headerMatch) {
      const mNum = parseInt(headerMatch[1], 10);
      const rest = headerMatch[2].trim();
      // Try to pull a date from the rest
      const dateMatch = rest.match(/\((\d{4}-\d{2}-\d{2})\)/);
      const date = dateMatch ? dateMatch[1] : '';
      const summary = rest.replace(/\(\d{4}-\d{2}-\d{2}\)/, '').replace(/^:\s*/, '').trim();
      if (current) entries.push(current);
      current = { milestone: mNum, date, summary, items: [] };
      if (summary) {
        current.items.push({ text: summary, categories: detectCategories(summary) });
      }
    } else if (current && (line.startsWith('-') || line.startsWith('*') || line.startsWith('•'))) {
      const text = line.replace(/^[-*•]\s*/, '').trim();
      if (text) current.items.push({ text, categories: detectCategories(text) });
    } else if (current && line.length > 0 && !line.startsWith('#')) {
      // Continuation line under current milestone
      current.items.push({ text: line, categories: detectCategories(line) });
    }
  }
  if (current) entries.push(current);

  // Sort newest first by milestone number
  entries.sort((a, b) => b.milestone - a.milestone);
  return entries;
}

// ─── Main ─────────────────────────────────────────────────────────────────

let meta;
try {
  meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
} catch (e) {
  console.warn('[parse-changelog-categories] Could not read game_meta.json:', e.message);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify({ entries: [], categories: [], generated: new Date().toISOString() }), 'utf8');
  process.exit(0);
}

const flatChangelog = meta.changelog || '';
const structuredEntries = parseChangelog(flatChangelog);

// Also pull changelogEntries if already present (future structured data wins)
const existingStructured = Array.isArray(meta.changelogEntries) ? meta.changelogEntries : [];
// Merge: existing structured takes precedence; parsed fills gaps
const byMilestone = {};
for (const e of structuredEntries) byMilestone[e.milestone] = e;
for (const e of existingStructured) {
  byMilestone[e.milestone] = {
    milestone: e.milestone,
    date: e.date || '',
    summary: e.summary || '',
    items: (e.items || []).map(it =>
      typeof it === 'string'
        ? { text: it, categories: detectCategories(it) }
        : { text: it.text || '', categories: it.categories || detectCategories(it.text || '') }
    ),
  };
}

// ─── M374: Fold in every release that has a summary in releases[N] ────────
// Previously only milestones present in the flat changelog text made it into
// the structured output, so M303–M373 (300+ releases) were missing. Each
// release entry has { date, summary, categories } already; promote them to
// changelog entries when not already present.
{
  const rels = meta.releases || {};
  for (const [numStr, rel] of Object.entries(rels)) {
    const mNum = parseInt(numStr, 10);
    if (!Number.isFinite(mNum)) continue;
    if (byMilestone[mNum]) continue; // already covered by flat changelog
    const summary = (rel.summary || '').trim();
    if (!summary) continue;
    byMilestone[mNum] = {
      milestone: mNum,
      date: rel.date || '',
      summary,
      items: [{ text: summary, categories: detectCategories(summary) }],
    };
  }
}

// ─── Merge explicit release.sh categories when present ────────────────────
// game_meta.json releases[N].categories is a string[] written by release.sh.
// Map release.sh lowercase ids to canonical display ids.
const EXPLICIT_CAT_MAP = {
  'feature':        'Feature',
  'balance':        'Balance',
  'bugfix':         'BugFix',
  'qol':            'QoL',
  'art':            'Art',
  'infrastructure': 'Feature', // map to Feature for changelog display
};

const releases = meta.releases || {};
for (const [numStr, rel] of Object.entries(releases)) {
  const mNum = parseInt(numStr, 10);
  if (!byMilestone[mNum]) continue;
  const explicitCats = Array.isArray(rel.categories) ? rel.categories : [];
  if (!explicitCats.length) continue;
  // Override heuristic categories on each item in this milestone with the
  // explicit set. Items keep their own heuristic unless the milestone has
  // explicit tags, in which case those tags are unioned in.
  const mappedCats = explicitCats
    .map(c => EXPLICIT_CAT_MAP[c.toLowerCase()])
    .filter(Boolean);
  if (!mappedCats.length) continue;
  const entry = byMilestone[mNum];
  entry.items = entry.items.map(item => {
    const merged = Array.from(new Set([...mappedCats, ...item.categories]));
    return { ...item, categories: merged };
  });
}

const allEntries = Object.values(byMilestone).sort((a, b) => b.milestone - a.milestone);

const out = {
  generated: new Date().toISOString(),
  categories: [
    { id: 'Feature', label: 'Feature',  color: '#5080e0' },
    { id: 'BugFix',  label: 'Bug Fix',  color: '#c04030' },
    { id: 'Balance', label: 'Balance',  color: '#e08020' },
    { id: 'QoL',     label: 'QoL',      color: '#40a860' },
    { id: 'Art',     label: 'Art',      color: '#a040c0' },
  ],
  entries: allEntries,
};

fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(out, null, 2), 'utf8');
console.log(`[parse-changelog-categories] ${allEntries.length} milestone entries written to public/assets/changelog-structured.json`);
