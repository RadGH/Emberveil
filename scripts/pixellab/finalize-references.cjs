/**
 * finalize-references.cjs — download all batch reference PNGs + update
 * state.json and art_direction JSONs with SpriteCook asset ids.
 *
 * Reads memory/spritecook_refs_batch{1,2,3}.txt (format: "id asset_id url").
 */
const fs = require('node:fs');
const path = require('node:path');
const https = require('node:https');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const AD_DIR    = path.join(REPO_ROOT, 'public', 'data', 'art_direction');
const STATE     = path.join(REPO_ROOT, 'public', 'data', 'pixellab_redesign_state.json');
const MEM       = path.join(REPO_ROOT, 'memory');

function download(url, dest) {
  return new Promise((resolve, reject) => {
    const f = fs.createWriteStream(dest);
    https.get(url, (res) => {
      if (res.statusCode !== 200) return reject(new Error(`HTTP ${res.statusCode} for ${url}`));
      res.pipe(f);
      f.on('finish', () => f.close(resolve));
    }).on('error', reject);
  });
}

async function main() {
  const files = ['spritecook_refs_batch1.txt','spritecook_refs_batch2.txt','spritecook_refs_batch3.txt'];
  const entries = [];
  for (const fn of files) {
    const p = path.join(MEM, fn);
    if (!fs.existsSync(p)) continue;
    const lines = fs.readFileSync(p, 'utf8').trim().split('\n');
    for (const line of lines) {
      const [id, assetId, ...urlParts] = line.split(' ');
      if (!id || !assetId) continue;
      entries.push({ id, assetId, url: urlParts.join(' ') });
    }
  }
  console.log(`[finalize] ${entries.length} references`);

  const state = JSON.parse(fs.readFileSync(STATE, 'utf8'));
  const now = new Date().toISOString();
  let creditsUsedThisBatch = 0;

  for (const { id, assetId, url } of entries) {
    const dir = path.join(REPO_ROOT, 'public', 'images', 'pixellab', id);
    fs.mkdirSync(dir, { recursive: true });
    const dest = path.join(dir, 'reference.png');
    if (fs.existsSync(dest) && fs.statSync(dest).size > 1000) {
      console.log(`[skip-download] ${id} (already on disk)`);
    } else {
      try {
        await download(url, dest);
        console.log(`[download] ${id}: ${dest}`);
      } catch (e) {
        console.error(`[error] ${id}: ${e.message}`);
        continue;
      }
    }

    // Update art-direction JSON
    const adPath = path.join(AD_DIR, `${id}.json`);
    if (fs.existsSync(adPath)) {
      const ad = JSON.parse(fs.readFileSync(adPath, 'utf8'));
      ad.referenceSheet = {
        ...(ad.referenceSheet || {}),
        path: `images/pixellab/${id}/reference.png`,
        spritecookAssetId: assetId,
        generatedAt: now,
        approvedAt: null,
      };
      fs.writeFileSync(adPath, JSON.stringify(ad, null, 2) + '\n');
    }

    // Update state.json
    if (state.characters[id]) {
      if (state.characters[id].referenceStatus !== 'approved') {
        state.characters[id].referenceStatus = 'reference_generated';
      }
      if (state.characters[id].status !== 'approved') {
        state.characters[id].status = 'reference_generated';
      }
      state.characters[id].creditsUsed = (state.characters[id].creditsUsed || 0) + 12;
      creditsUsedThisBatch += 12;
    }
  }

  state.creditsUsedTotal = (state.creditsUsedTotal || 0) + creditsUsedThisBatch;
  state.updatedAt = now;
  fs.writeFileSync(STATE, JSON.stringify(state, null, 2) + '\n');
  console.log(`[done] credits used: +${creditsUsedThisBatch} (total=${state.creditsUsedTotal})`);
}

main().catch(e => { console.error(e); process.exit(1); });
