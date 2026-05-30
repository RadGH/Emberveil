/**
 * emit-news-index.cjs
 *
 * Scans public/news/*.md, parses YAML frontmatter from each file, and writes
 * public/news/index.json for the asset gallery Latest News widget and the
 * news archive page.
 *
 * Frontmatter fields expected:
 *   title:    string  (required)
 *   date:     YYYY-MM-DD (required)
 *   category: release | dev-diary | event  (required)
 *   summary:  string  (required)
 *
 * Run:  node scripts/emit-news-index.cjs
 * Wired via "prebuild" in package.json.
 */

'use strict';

const fs   = require('fs');
const path = require('path');

const NEWS_DIR = path.resolve(__dirname, '../public/news');
const OUT_PATH = path.join(NEWS_DIR, 'index.json');

/**
 * Parse YAML frontmatter from a markdown string.
 * Supports only simple key: value lines (no nested objects, no arrays).
 * Returns { meta, body } where meta is a plain object and body is the content
 * after the closing ---.
 */
function parseFrontmatter(src) {
  const meta = {};
  let body = src;

  if (!src.startsWith('---')) {
    return { meta, body };
  }

  const end = src.indexOf('\n---', 3);
  if (end === -1) {
    return { meta, body };
  }

  const frontBlock = src.slice(3, end).trim();
  body = src.slice(end + 4).trimStart();

  for (const line of frontBlock.split('\n')) {
    const colon = line.indexOf(':');
    if (colon === -1) continue;
    const key = line.slice(0, colon).trim();
    let val = line.slice(colon + 1).trim();
    // Strip optional surrounding quotes
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    meta[key] = val;
  }

  return { meta, body };
}

function slugFromFilename(filename) {
  return filename.replace(/\.md$/, '');
}

if (!fs.existsSync(NEWS_DIR)) {
  fs.mkdirSync(NEWS_DIR, { recursive: true });
}

const files = fs.readdirSync(NEWS_DIR)
  .filter(f => f.endsWith('.md'))
  .sort()
  .reverse(); // newest first (filename-date prefix YYYY-MM-DD sorts correctly)

const entries = [];

for (const file of files) {
  const src = fs.readFileSync(path.join(NEWS_DIR, file), 'utf8');
  const { meta } = parseFrontmatter(src);

  if (!meta.title || !meta.date) {
    console.warn(`[emit-news-index] Skipping ${file} — missing title or date`);
    continue;
  }

  entries.push({
    slug:     slugFromFilename(file),
    file:     file,
    title:    meta.title    || '',
    date:     meta.date     || '',
    category: meta.category || 'release',
    summary:  meta.summary  || '',
  });
}

// Sort by date descending (ISO date strings sort lexicographically)
entries.sort((a, b) => b.date.localeCompare(a.date) || b.slug.localeCompare(a.slug));

const out = {
  generated: new Date().toISOString(),
  entries,
};

fs.writeFileSync(OUT_PATH, JSON.stringify(out, null, 2), 'utf8');
console.log(`[emit-news-index] ${entries.length} news entries written to public/news/index.json`);
