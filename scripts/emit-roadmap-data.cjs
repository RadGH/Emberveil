/**
 * emit-roadmap-data.cjs
 *
 * Parses public/assets/wishlist.html and extracts items from the
 * #approved-brainstorm section, groups them by milestone, computes
 * status counts, and writes public/assets/roadmap.json for roadmap.html.
 *
 * Run:  node scripts/emit-roadmap-data.cjs
 * Wired via "prebuild" in package.json.
 */

'use strict';

const fs   = require('fs');
const path = require('path');

const wishlistPath = path.resolve(__dirname, '../public/assets/wishlist.html');
const metaPath     = path.resolve(__dirname, '../../game13_releases/game_meta.json');
const outPath      = path.resolve(__dirname, '../public/assets/roadmap.json');

// ── Helpers ───────────────────────────────────────────────────────────────

function stripHtml(html) {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, ' ');
}

// ── Parse wishlist HTML ───────────────────────────────────────────────────

let html;
try {
  html = fs.readFileSync(wishlistPath, 'utf8');
} catch (e) {
  console.warn('[emit-roadmap-data] Could not read wishlist.html:', e.message);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify({ milestones: [], generated: new Date().toISOString() }), 'utf8');
  process.exit(0);
}

// Extract #approved-brainstorm section
const sectionMatch = html.match(/id="approved-brainstorm"[^>]*>([\s\S]*?)(?=<section\b|$)/i);
const sectionHtml = sectionMatch ? sectionMatch[1] : html;

// Extract milestone group blocks: <div class="wl-group">...</div>
const groupRe = /<div[^>]*class="wl-group"[^>]*>([\s\S]*?)<\/div>\s*(?=<div[^>]*class="wl-(?:group|section|item)"|<\/section|$)/gi;
const groups = [];
let gm;
while ((gm = groupRe.exec(sectionHtml)) !== null) {
  groups.push(gm[1]);
}

// For each group, extract heading and items
const milestones = [];
for (const groupHtml of groups) {
  // Extract h3 heading
  const h3m = groupHtml.match(/<h3[^>]*>([\s\S]*?)<\/h3>/i);
  const heading = h3m ? stripHtml(h3m[1]) : '';
  if (!heading) continue;

  // Parse milestone number and title from heading
  const milNumMatch = heading.match(/^M(\d+)\s*[—\-–:]\s*(.*)/);
  const isFutureClaude = /future claude/i.test(heading);
  const isWorkflow = !milNumMatch && !isFutureClaude;

  let milNum = milNumMatch ? parseInt(milNumMatch[1], 10) : null;
  let milTitle = milNumMatch ? milNumMatch[2].trim() : heading;

  if (isFutureClaude || isWorkflow) continue; // skip meta-groups

  // Extract wl-item entries
  const itemRe = /<div[^>]*class="wl-item([^"]*)"[^>]*>([\s\S]*?)(?=<div[^>]*class="wl-item|$)/gi;
  const items = [];
  let im;
  while ((im = itemRe.exec(groupHtml)) !== null) {
    const itemClasses = im[1] || '';
    const itemHtml = im[2];

    // Determine status
    let status = 'todo';
    if (/\bdone\b/.test(itemClasses)) status = 'done';
    else if (/\bdropped\b/.test(itemClasses)) status = 'dropped';
    else if (/\bwip\b/.test(itemClasses)) status = 'wip';

    // Extract label
    const labelm = itemHtml.match(/<span[^>]*class="label"[^>]*>([\s\S]*?)<\/span>/i);
    const label = labelm ? stripHtml(labelm[1]) : '';

    // Extract tag (e.g. "done — m293")
    const tagm = itemHtml.match(/<span[^>]*class="tag[^"]*"[^>]*>([\s\S]*?)<\/span>/i);
    const tag = tagm ? stripHtml(tagm[1]) : '';

    // Extract desc
    const descm = itemHtml.match(/<div[^>]*class="desc"[^>]*>([\s\S]*?)<\/div>/i);
    const desc = descm ? stripHtml(descm[1]) : '';

    if (!label) continue;

    items.push({ label, status, tag, desc });
  }

  const doneCount = items.filter(i => i.status === 'done').length;
  const total = items.length;

  milestones.push({
    milestone: milNum,
    title: milTitle,
    items,
    doneCount,
    total,
    shipped: doneCount === total && total > 0,
  });
}

// Sort: shipped milestones first (newest first), then upcoming (ascending)
milestones.sort((a, b) => {
  if (a.shipped && !b.shipped) return -1;
  if (!a.shipped && b.shipped) return 1;
  if (a.shipped && b.shipped) return (b.milestone || 0) - (a.milestone || 0);
  return (a.milestone || 9999) - (b.milestone || 9999);
});

// Grab current milestone from game_meta.json
let currentMilestone = 0;
try {
  const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
  const keys = Object.keys(meta.releases || {}).map(Number).filter(n => !isNaN(n));
  if (keys.length) currentMilestone = Math.max(...keys);
} catch (_) {}

const out = {
  generated: new Date().toISOString(),
  currentMilestone,
  milestones,
};

fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(out, null, 2), 'utf8');
console.log(`[emit-roadmap-data] ${milestones.length} milestones written to public/assets/roadmap.json`);
