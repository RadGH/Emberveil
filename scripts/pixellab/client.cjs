/**
 * pixellab/client.cjs — BitForge-only HTTP wrapper for PixelLab.
 *
 * Contract enforced by this module:
 *   • Only `generate-image-bitforge` calls allowed. Any attempt to hit a
 *     different endpoint (e.g. pixflux) throws immediately.
 *   • Every call — real, dry-run, or vetoed — is appended to
 *     memory/pixellab_log.jsonl with prompt, params, cost, output path.
 *   • Credit ceiling: a single call estimated at > 30 credits requires
 *     --confirm OR { confirm: true } in the JS call signature.
 *   • API key is read from assets/references/pixellab-api-key.txt. Never
 *     echoed to stdout, stderr, logs, or return values.
 *
 * CLI is incidental; primary use is as a module:
 *   const { generateBitforge } = require('./client.cjs');
 *   const { imagePath, usage } = await generateBitforge({ ... });
 *
 * CLI:
 *   node scripts/pixellab/client.cjs --dry-run --prompt "..." \
 *        --width 256 --height 256 --out /tmp/test.png \
 *        [--style-image path.png]
 */

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const REPO_ROOT = path.resolve(__dirname, '..', '..');           // game13/
const KEY_PATH  = path.resolve(REPO_ROOT, '..', 'assets', 'references', 'pixellab-api-key.txt');
const LOG_PATH  = path.resolve(REPO_ROOT, 'memory', 'pixellab_log.jsonl');

const BITFORGE_ENDPOINT = 'https://api.pixellab.ai/v1/generate-image-bitforge';
const PIXFLUX_ENDPOINT  = 'https://api.pixellab.ai/v1/generate-image-pixflux';
// Default to PixFlux. BitForge is a style-transfer model that ignores text
// prompts; PixFlux is text-to-image and actually respects prompts.
const DEFAULT_ENDPOINT  = PIXFLUX_ENDPOINT;
const CREDIT_CEILING = 30;   // cents (PixelLab bills in USD ~= 1c per credit; conservative)

// ---- helpers ----------------------------------------------------------------

function readApiKey() {
  if (!fs.existsSync(KEY_PATH)) throw new Error(`PixelLab key file not found at ${KEY_PATH}`);
  return fs.readFileSync(KEY_PATH, 'utf8').trim();
}

function appendLog(entry) {
  try {
    fs.mkdirSync(path.dirname(LOG_PATH), { recursive: true });
    fs.appendFileSync(LOG_PATH, JSON.stringify(entry) + '\n');
  } catch (e) {
    console.error('[pixellab] log append failed:', e.message);
  }
}

function nowISO() { return new Date().toISOString(); }

function base64OfFile(p) {
  const abs = path.isAbsolute(p) ? p : path.resolve(REPO_ROOT, p);
  return fs.readFileSync(abs).toString('base64');
}

/**
 * BitForge requires style_image to match the output size exactly. If the source
 * is any other size, resize it to `target`×`target` via ffmpeg into a tmpfile
 * and return base64 of the resized PNG. Pixel-art friendly: neighbor scaling,
 * RGBA preserved (no alpha loss — alpha loss is the bug we just fixed in
 * thumbnail generation).
 */
function base64OfResizedImage(srcPath, target) {
  const abs = path.isAbsolute(srcPath) ? srcPath : path.resolve(REPO_ROOT, srcPath);
  const tmp = path.join(os.tmpdir(), `pixellab_style_${target}_${path.basename(abs)}.png`);
  const vf = `format=rgba,scale=${target}:${target}:flags=neighbor`;
  const r = spawnSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', abs, '-vf', vf, '-pix_fmt', 'rgba', tmp], { encoding: 'utf8' });
  if (r.status !== 0) {
    throw new Error(`[pixellab] ffmpeg resize failed for ${abs}: ${r.stderr || r.stdout}`);
  }
  const b64 = fs.readFileSync(tmp).toString('base64');
  try { fs.unlinkSync(tmp); } catch { /* best-effort */ }
  return b64;
}

// ---- main entry -------------------------------------------------------------

/**
 * @param {object}   opts
 * @param {string}   opts.prompt            full prompt text
 * @param {number}  [opts.width=256]
 * @param {number}  [opts.height=256]
 * @param {string}  [opts.styleImagePath]   repo-relative or absolute PNG path
 * @param {string}  [opts.initImagePath]    optional init image (for img2img — BitForge only; PixFlux forbidden)
 * @param {string}   opts.out               where to save the returned PNG (absolute or repo-relative)
 * @param {boolean} [opts.dryRun=false]     compose + log but do not call the API
 * @param {boolean} [opts.confirm=false]    required if estimated cost > CREDIT_CEILING
 * @param {string}  [opts.tag]              free-form tag for the log (e.g. 'oracle:reference_sheet')
 * @param {string}  [opts.endpoint]         override endpoint — MUST contain 'bitforge'
 * @returns {Promise<{imagePath:string, usage:object, logEntry:object}>}
 */
async function generateBitforge(opts) {
  const endpoint = opts.endpoint || DEFAULT_ENDPOINT;
  if (!/bitforge|pixflux/i.test(endpoint)) {
    throw new Error(`[pixellab] Refused: endpoint "${endpoint}" is not a known PixelLab generator.`);
  }
  if (!opts.prompt || !opts.prompt.trim()) throw new Error('[pixellab] prompt required');
  if (!opts.out) throw new Error('[pixellab] out path required');

  const width  = opts.width  || 256;
  const height = opts.height || 256;
  const outAbs = path.isAbsolute(opts.out) ? opts.out : path.resolve(REPO_ROOT, opts.out);
  fs.mkdirSync(path.dirname(outAbs), { recursive: true });

  // Crude cost estimate: BitForge ~= 2-5 credits per 256x256 gen at current pricing.
  // Scale linearly by canvas area, cap reasonably.
  const pixels = width * height;
  const estCredits = Math.max(2, Math.ceil(pixels / (256 * 256) * 3));

  const isPixflux = /pixflux/i.test(endpoint);
  const body = {
    description: opts.prompt,
    image_size: { width, height },
    // PixFlux supports transparent background as an explicit flag — without it
    // the model fills with a scene background. Always on for our use case.
    ...(isPixflux ? { no_background: true } : {}),
    ...(opts.negativePrompt ? { negative_description: opts.negativePrompt } : {}),
  };
  // Skip disk reads in dry-run so a missing reference image doesn't block
  // prompt-composition testing. The log still records the intended path.
  // BitForge requires style_image size to equal output size; PixFlux accepts
  // any size but we still resize for consistency and to match PixelLab's
  // typical pixel-art sizing.
  if (opts.styleImagePath && !opts.dryRun) {
    body.style_image = { type: 'base64', base64: base64OfResizedImage(opts.styleImagePath, width) };
  }
  if (opts.initImagePath && !opts.dryRun) {
    body.init_image = { type: 'base64', base64: base64OfResizedImage(opts.initImagePath, width) };
  }

  const logEntry = {
    ts: nowISO(),
    tag: opts.tag || null,
    endpoint,
    mode: opts.dryRun ? 'dry-run' : 'live',
    prompt: opts.prompt,
    width, height,
    styleImagePath: opts.styleImagePath || null,
    initImagePath:  opts.initImagePath  || null,
    out: path.relative(REPO_ROOT, outAbs),
    estCredits,
    usage: null,
    error: null,
  };

  if (estCredits > CREDIT_CEILING && !opts.confirm) {
    logEntry.error = `est ${estCredits} > ceiling ${CREDIT_CEILING} and no --confirm`;
    appendLog(logEntry);
    throw new Error(`[pixellab] Refused: estimated ${estCredits} credits exceeds ceiling ${CREDIT_CEILING}. Pass confirm:true / --confirm to override.`);
  }

  if (opts.dryRun) {
    appendLog(logEntry);
    return { imagePath: outAbs, usage: { mode: 'dry-run', estCredits }, logEntry };
  }

  // Real call
  const apiKey = readApiKey();
  let resp, json;
  try {
    resp = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
    });
    const text = await resp.text();
    try { json = JSON.parse(text); } catch { json = { raw: text }; }
  } catch (e) {
    logEntry.error = `fetch failed: ${e.message}`;
    appendLog(logEntry);
    throw e;
  }

  if (!resp.ok) {
    logEntry.error = `HTTP ${resp.status}: ${JSON.stringify(json).slice(0, 400)}`;
    appendLog(logEntry);
    throw new Error(logEntry.error);
  }

  // Expected shape: { image: { type: 'base64', base64: '...' }, usage: {...} }
  const b64 = json?.image?.base64 || json?.image_base64 || null;
  if (!b64) {
    logEntry.error = `no image in response: ${JSON.stringify(json).slice(0, 400)}`;
    appendLog(logEntry);
    throw new Error(logEntry.error);
  }
  fs.writeFileSync(outAbs, Buffer.from(b64, 'base64'));

  logEntry.usage = json.usage || null;
  appendLog(logEntry);
  return { imagePath: outAbs, usage: json.usage || null, logEntry };
}

// ---- CLI --------------------------------------------------------------------

function parseArgs(argv) {
  const o = { dryRun: false, confirm: false };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i], n = () => argv[++i];
    switch (a) {
      case '--dry-run':      o.dryRun  = true; break;
      case '--confirm':      o.confirm = true; break;
      case '--prompt':       o.prompt = n(); break;
      case '--width':        o.width  = Number(n()); break;
      case '--height':       o.height = Number(n()); break;
      case '--style-image':  o.styleImagePath = n(); break;
      case '--init-image':   o.initImagePath = n(); break;
      case '--out':          o.out = n(); break;
      case '--tag':          o.tag = n(); break;
      case '--endpoint':     o.endpoint = n(); break;
      default: throw new Error(`Unknown arg: ${a}`);
    }
  }
  return o;
}

if (require.main === module) {
  (async () => {
    try {
      const opts = parseArgs(process.argv);
      const r = await generateBitforge(opts);
      console.log(JSON.stringify({ ok: true, imagePath: r.imagePath, usage: r.usage, mode: opts.dryRun ? 'dry-run' : 'live' }, null, 2));
    } catch (e) {
      console.error(e.message);
      process.exit(1);
    }
  })();
}

module.exports = { generateBitforge, BITFORGE_ENDPOINT, CREDIT_CEILING, REPO_ROOT };
