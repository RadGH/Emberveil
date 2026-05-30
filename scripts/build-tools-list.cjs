#!/usr/bin/env node
/**
 * build-tools-list.cjs
 *
 * Scans public/assets/*.html and produces a fresh tools list at
 *   public/assets/data/tools.json
 *
 * Each entry: { name, href, desc, tag, milestone, updated, deprecated }
 *
 * `name` and `desc` come from a curated sidecar:
 *   public/assets/data/tools-meta.json   (hand-edited; preserved across rebuilds)
 *
 * Anything not in the sidecar gets best-effort defaults from the page <title>
 * and a placeholder description; new tools surface immediately so they never
 * get forgotten.
 *
 * Re-run from CI / release.sh; the file is idempotent.
 */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const ASSETS = path.join(ROOT, 'public', 'assets');
const META = path.join(ASSETS, 'data', 'tools-meta.json');
const OUT = path.join(ASSETS, 'data', 'tools.json');

// Pages we never list as tools (game pages, partials, infrastructure).
const SKIP = new Set([
  'play.html',
  'index.html',         // catalog landing — listed under tools-meta as "Asset Gallery"
  'contact.html',
  'privacy.html',
  '_header.js',          // not html anyway
  'changelog.html',      // listed via meta
]);

function listHtml(dir) {
  return fs.readdirSync(dir).filter(f => f.endsWith('.html') && !SKIP.has(f));
}

function extractTitle(file) {
  const html = fs.readFileSync(file, 'utf8');
  const m = html.match(/<title>([^<]+)<\/title>/i);
  if (!m) return path.basename(file, '.html');
  return m[1].split(/[—|–-]/)[0].trim();
}

function loadMeta() {
  if (!fs.existsSync(META)) return {};
  return JSON.parse(fs.readFileSync(META, 'utf8'));
}

function fileMtime(p) {
  try { return fs.statSync(p).mtime.toISOString().slice(0, 10); }
  catch (_) { return null; }
}

function classify(name) {
  // Heuristic tag based on filename prefix/keywords. Sidecar can override.
  if (name.startsWith('deprecated-')) return 'archived';
  if (/catalog|roadmap/.test(name)) return 'catalog';
  if (/wishlist|brainstorm|docs|news-archive/.test(name)) return 'docs';
  if (/balance|rebalance|combat-replay|enemy-audit|skill-audit|affix|mod-system|asset-pipeline|infinite-dungeon|sprite-flip-review/.test(name)) return 'devtool';
  if (/sprite-adjust|custom-content|image-review|character-redesign|bg-remove|ai-content-gen|data-overrides/.test(name)) return 'devtool';
  if (/menu_bg|tools|index|changelog/.test(name)) return 'admin';
  return 'devtool';
}

function main() {
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  const meta = loadMeta();
  const files = listHtml(ASSETS);
  const out = [];
  for (const f of files) {
    const full = path.join(ASSETS, f);
    const m = meta[f] || {};
    const name = m.name || extractTitle(full);
    const desc = m.desc || '(no description — add one in tools-meta.json)';
    const tag = m.tag || classify(f);
    const updated = m.updated || fileMtime(full);
    const milestone = m.milestone || '';
    const deprecated = f.startsWith('deprecated-');
    out.push({ name, href: f, desc, tag, milestone, updated, deprecated });
  }
  // Sort: non-deprecated first, then alphabetical by name.
  out.sort((a, b) => {
    if (a.deprecated !== b.deprecated) return a.deprecated ? 1 : -1;
    return a.name.localeCompare(b.name);
  });
  fs.writeFileSync(OUT, JSON.stringify({ _meta: { generated: new Date().toISOString() }, tools: out }, null, 2) + '\n');
  console.log(`wrote ${OUT} (${out.length} tools, ${out.filter(t => t.deprecated).length} deprecated)`);
}

main();
