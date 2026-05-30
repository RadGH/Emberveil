/**
 * capture-maps.spec.mjs
 * Captures per-act map screenshots with fog of war disabled.
 * Output: game13/memory/manual-mode-overhaul/assets/maps/zone-{zoneId}.png
 *
 * Approach: pre-seed localStorage with a modified save (all zones unlocked,
 * fogOfWar=false) then navigate to play.html, dismiss any dialogs, click
 * Load Game, pick the seeded save, and screenshot the map canvas per zone.
 */
import { test, expect } from '@playwright/test';
import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const PLAY_URL = 'http://localhost:5247/game13/play.html';
const OUTPUT_DIR = path.join(__dirname, '../memory/manual-mode-overhaul/assets/maps');

// All act zones in order (skip prologue — minimal nodes)
const ZONES = [
  { id: 'border_roads',     label: 'Act I — Border Roads' },
  { id: 'dust_roads',       label: 'Act I — Dust Roads' },
  { id: 'ember_plateau',    label: 'Act II — Ember Plateau' },
  { id: 'hell_breach',      label: 'Act II — Hell Breach' },
  { id: 'shattered_core',   label: 'Act III — Shattered Core' },
  { id: 'cosmic_rift',      label: 'Act III — Cosmic Rift' },
  { id: 'eternal_void',     label: 'Act IV — Eternal Void' },
  { id: 'abyssal_depths',   label: 'Act IV — Abyssal Depths' },
  { id: 'primordial_nexus', label: 'Act V — Primordial Nexus' },
];

const ALL_ZONE_IDS = [
  'prologue', 'border_roads', 'thornwood', 'dust_roads', 'ember_plateau',
  'hell_breach', 'shattered_core', 'cosmic_rift', 'eternal_void',
  'abyssal_depths', 'primordial_nexus',
];

// Build a modified save record for the given target zone
function buildSaveRecord(targetZoneId) {
  const raw = readFileSync(
    path.join(__dirname, '../../assets/references/emberveil/saves/emberveil-save-rouge_the_rogue-2026-04-27.json'),
    'utf8'
  );
  const wrapper = JSON.parse(raw);
  const inner = JSON.parse(wrapper.data);

  inner.fogOfWar = false;
  inner.zoneId = targetZoneId;
  inner.nodeId = inner.zoneNodeIds?.[targetZoneId] || 'start';
  inner.unlockedZones = ALL_ZONE_IDS;
  // Clear revealed fog so all nodes are visible
  inner.fogRevealed = {};

  return inner;
}

test.describe('Map zone screenshots', () => {
  test.use({
    viewport: { width: 1280, height: 800 },
    deviceScaleFactor: 1,
    isMobile: false,
    hasTouch: false,
  });

  for (const zone of ZONES) {
    test(`capture zone: ${zone.id}`, async ({ page }) => {
      const saveRecord = buildSaveRecord(zone.id);
      const saveKey = saveRecord.key;

      // Seed localStorage before game JS executes
      await page.addInitScript(({ key, record }) => {
        localStorage.setItem(key, JSON.stringify(record));
        // Pre-dismiss all modal/banner blockers
        localStorage.setItem('rsg_telemetryOptIn', 'false');
        localStorage.setItem('rsg_consent_v1', 'denied');
        // Pre-dismiss "What's New" splash by marking a high milestone seen
        localStorage.setItem('emberveil.lastSeenMilestone', '999');
      }, { key: saveKey, record: saveRecord });

      await page.goto(PLAY_URL);

      // Wait for title menu buttons to appear
      await page.waitForSelector('.title-menu', { timeout: 15000 });
      await page.waitForTimeout(800);

      // Dismiss any "What's New" splash that may have appeared
      const wnsContinue = page.locator('#wns-continue');
      if (await wnsContinue.count() > 0 && await wnsContinue.isVisible()) {
        await wnsContinue.click();
        await page.waitForTimeout(500);
      }

      // Click Load Game
      const loadBtn = page.locator('#btn-load-game');
      await loadBtn.waitFor({ state: 'visible', timeout: 5000 });
      await loadBtn.click();
      await page.waitForTimeout(800);

      // Find and click the Load button for our seeded save key
      const loadSaveBtn = page.locator(`.lss-load[data-key="${saveKey}"]`);
      await loadSaveBtn.waitFor({ state: 'visible', timeout: 8000 });
      await loadSaveBtn.click();

      // Wait for map canvas to appear — loading the save should route directly
      // to MapScreen since the saved zone is an adventure zone (border_roads, etc.)
      await page.waitForSelector('#map-canvas', { timeout: 15000 });

      // Give canvas time to draw nodes
      await page.waitForTimeout(2000);

      // Check which zone tab is active; if different from target, switch
      const targetTab = page.locator(`#map-zone-tabs [data-zone="${zone.id}"]`).first();
      if (await targetTab.count() > 0) {
        const isActive = await targetTab.evaluate(el => el.classList.contains('active'));
        if (!isActive) {
          await targetTab.click();
          await page.waitForTimeout(1200);
        }
      }

      // Final render settle
      await page.waitForTimeout(500);

      const outPath = path.join(OUTPUT_DIR, `zone-${zone.id}.png`);
      await page.screenshot({ path: outPath, fullPage: false });
      console.log(`Captured: zone-${zone.id}.png`);
    });
  }
});
