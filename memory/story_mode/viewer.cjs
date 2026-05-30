#!/usr/bin/env node
// Tiny markdown viewer for the Story Mode planning docs.
// Serves 1-roast.md, 2-brainstorm.md, 3-refined-plan.md as rendered HTML.
// Run: node viewer.js  (defaults to port 5288)
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');

const PORT = parseInt(process.env.PORT || '5288', 10);
const DOCS_DIR = __dirname;

const FILES = [
  { slug: 'handoff', file: 'HANDOFF.md', title: 'Handoff' },
  { slug: 'checklist', file: 'CHECKLIST.md', title: 'Checklist' },
  { slug: 'roast', file: '1-roast.md', title: '1. Roast' },
  { slug: 'brainstorm', file: '2-brainstorm.md', title: '2. Brainstorm' },
  { slug: 'plan', file: '3-refined-plan.md', title: '3. Refined Plan' },
];

function esc(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// Minimal markdown -> HTML. Good enough for review; not GFM-perfect.
function mdToHtml(md) {
  const lines = md.split('\n');
  let html = '';
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    // fenced code
    if (/^```/.test(line)) {
      const lang = line.replace(/^```/, '').trim();
      i++;
      let body = '';
      while (i < lines.length && !/^```/.test(lines[i])) {
        body += lines[i] + '\n';
        i++;
      }
      i++;
      html += `<pre class="code" data-lang="${esc(lang)}"><code>${esc(body)}</code></pre>\n`;
      continue;
    }
    // table
    if (/^\s*\|.*\|\s*$/.test(line) && i + 1 < lines.length && /^\s*\|[\s\-:|]+\|\s*$/.test(lines[i + 1])) {
      const head = line.trim().slice(1, -1).split('|').map(s => s.trim());
      i += 2;
      let rows = [];
      while (i < lines.length && /^\s*\|.*\|\s*$/.test(lines[i])) {
        rows.push(lines[i].trim().slice(1, -1).split('|').map(s => s.trim()));
        i++;
      }
      html += '<table><thead><tr>' + head.map(h => `<th>${inline(h)}</th>`).join('') + '</tr></thead><tbody>';
      for (const r of rows) html += '<tr>' + r.map(c => `<td>${inline(c)}</td>`).join('') + '</tr>';
      html += '</tbody></table>\n';
      continue;
    }
    // heading
    const h = /^(#{1,6})\s+(.*)$/.exec(line);
    if (h) {
      const level = h[1].length;
      const text = h[2];
      const id = text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      html += `<h${level} id="${id}">${inline(text)}</h${level}>\n`;
      i++;
      continue;
    }
    // hr
    if (/^---+$/.test(line.trim())) { html += '<hr>\n'; i++; continue; }
    // list
    if (/^\s*[-*]\s+/.test(line)) {
      html += '<ul>\n';
      while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) {
        const item = lines[i].replace(/^\s*[-*]\s+/, '');
        html += `<li>${inline(item)}</li>\n`;
        i++;
      }
      html += '</ul>\n';
      continue;
    }
    if (/^\s*\d+\.\s+/.test(line)) {
      html += '<ol>\n';
      while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) {
        const item = lines[i].replace(/^\s*\d+\.\s+/, '');
        html += `<li>${inline(item)}</li>\n`;
        i++;
      }
      html += '</ol>\n';
      continue;
    }
    // blockquote
    if (/^>\s?/.test(line)) {
      let body = '';
      while (i < lines.length && /^>\s?/.test(lines[i])) {
        body += lines[i].replace(/^>\s?/, '') + '\n';
        i++;
      }
      html += `<blockquote>${inline(body).replace(/\n/g, '<br>')}</blockquote>\n`;
      continue;
    }
    // blank
    if (line.trim() === '') { html += '\n'; i++; continue; }
    // paragraph
    let para = line;
    i++;
    while (i < lines.length && lines[i].trim() !== '' && !/^(#{1,6}\s|```|>\s|\s*[-*]\s|\s*\d+\.\s|---+$|\s*\|)/.test(lines[i])) {
      para += '\n' + lines[i];
      i++;
    }
    html += `<p>${inline(para).replace(/\n/g, '<br>')}</p>\n`;
  }
  return html;
}

function inline(s) {
  s = esc(s);
  // inline code
  s = s.replace(/`([^`]+)`/g, (m, c) => `<code>${c}</code>`);
  // bold
  s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  // italics
  s = s.replace(/(^|\W)_([^_]+)_(?=\W|$)/g, '$1<em>$2</em>');
  // links [t](u)
  s = s.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
  // checkbox
  s = s.replace(/^\[ \]/, '<span class="cb cb-off">☐</span>');
  s = s.replace(/^\[x\]/i, '<span class="cb cb-on">☑</span>');
  return s;
}

const STYLE = `
  :root { color-scheme: dark light; }
  body { margin: 0; font: 16px/1.55 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: #0f1115; color: #e7e9ee; }
  .wrap { max-width: 920px; margin: 0 auto; padding: 24px 18px 80px; }
  nav.top { position: sticky; top: 0; background: #14171d; padding: 12px 18px; border-bottom: 1px solid #2a2f38; display: flex; gap: 14px; flex-wrap: wrap; z-index: 9; }
  nav.top a { color: #7fb1ff; text-decoration: none; font-size: 14px; padding: 4px 8px; border-radius: 6px; }
  nav.top a.active { background: #1c2230; color: #fff; }
  h1, h2, h3, h4, h5 { line-height: 1.25; margin: 1.6em 0 0.5em; }
  h1 { font-size: 28px; border-bottom: 1px solid #2a2f38; padding-bottom: 8px; }
  h2 { font-size: 22px; }
  h3 { font-size: 18px; color: #c7d0e0; }
  h4 { font-size: 16px; color: #9aa6bd; }
  p, li { font-size: 15px; }
  code { background: #1b2028; padding: 2px 6px; border-radius: 4px; font: 13px/1.4 "SF Mono", Menlo, monospace; }
  pre.code { background: #0a0c10; border: 1px solid #1f242d; border-radius: 8px; padding: 12px 14px; overflow-x: auto; font: 12.5px/1.5 "SF Mono", Menlo, monospace; }
  pre.code code { background: transparent; padding: 0; }
  blockquote { border-left: 3px solid #4a7bd6; margin: 1em 0; padding: 0.4em 1em; background: #141a24; border-radius: 0 6px 6px 0; }
  table { border-collapse: collapse; margin: 1em 0; font-size: 14px; }
  th, td { border: 1px solid #2a2f38; padding: 6px 10px; text-align: left; vertical-align: top; }
  th { background: #1b2028; }
  hr { border: 0; border-top: 1px solid #2a2f38; margin: 2em 0; }
  a { color: #7fb1ff; }
  .cb { display: inline-block; width: 1.1em; }
  .cb-on { color: #4adf7a; }
  .cb-off { color: #7a8294; }
  @media (max-width: 600px) {
    .wrap { padding: 14px; }
    h1 { font-size: 22px; }
    h2 { font-size: 19px; }
    pre.code { font-size: 11.5px; }
  }
`;

function shellHtml(activeSlug, title, body) {
  const tabs = FILES.map(f =>
    `<a href="/${f.slug}" class="${f.slug === activeSlug ? 'active' : ''}">${f.title}</a>`
  ).join('');
  return `<!doctype html>
<html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)} — Story Mode docs</title>
<style>${STYLE}</style>
</head><body>
<nav class="top">${tabs}</nav>
<div class="wrap">${body}</div>
</body></html>`;
}

function getLocalIPs() {
  const ifaces = os.networkInterfaces();
  const ips = [];
  for (const name of Object.keys(ifaces)) {
    for (const iface of ifaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) ips.push(iface.address);
    }
  }
  return ips;
}

const server = http.createServer((req, res) => {
  const url = req.url.replace(/\/$/, '') || '/';
  if (url === '/' || url === '/index') {
    res.writeHead(302, { Location: '/plan' });
    return res.end();
  }
  const slug = url.slice(1).split('?')[0];
  const entry = FILES.find(f => f.slug === slug);
  if (!entry) {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    return res.end('Not found. Try one of: ' + FILES.map(f => '/' + f.slug).join(', '));
  }
  const fp = path.join(DOCS_DIR, entry.file);
  if (!fs.existsSync(fp)) {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    return res.end(`File ${entry.file} not found yet.`);
  }
  const md = fs.readFileSync(fp, 'utf8');
  const html = mdToHtml(md);
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(shellHtml(slug, entry.title, html));
});

server.listen(PORT, '0.0.0.0', () => {
  const ips = getLocalIPs();
  console.log(`Story Mode docs viewer listening on:`);
  console.log(`  http://localhost:${PORT}/`);
  for (const ip of ips) console.log(`  http://${ip}:${PORT}/`);
});
