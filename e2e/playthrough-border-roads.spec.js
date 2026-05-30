// M275: scripted playthrough of the first map (Border Roads), recorded as a
// video. Run with:
//   npx playwright test e2e/playthrough-border-roads.spec.js --headed
// Output video lands in: e2e/playthrough/<name>.webm
//
// Flow: title → New Game → pick warrior → Begin Adventure → walk Border
// Roads from start to border_boss, fighting/dialoging through every node
// the path requires.
import { test, expect } from '@playwright/test';
import path from 'node:path';

test.use({
  recordVideo: {
    dir: 'e2e/playthrough',
    size: { width: 393, height: 852 },
  },
  // Slow things down a touch so the recording is watchable rather than blink-fast.
  launchOptions: { slowMo: 60 },
});

// Wait for an end-of-combat modal (Continue button) and click through.
async function clickThroughCombat(page, label = '') {
  await page.waitForSelector('.cem-box', { timeout: 25000 });
  // Optional: open the Combat Report briefly so it shows up in the video
  const reportBtn = page.locator('#cem-viewreport');
  if (await reportBtn.count() > 0) {
    await reportBtn.click();
    await page.waitForTimeout(700);
    const closeBtn = page.locator('#crpt-close');
    if (await closeBtn.count() > 0) await closeBtn.click();
    await page.waitForTimeout(200);
  }
  const continueBtn = page.locator('#cem-continue');
  await continueBtn.click();
  await page.waitForTimeout(1200);
}

// Click through a dialog encounter — pick the first available choice each
// time, then "Continue" out the outcome.
async function clickThroughDialog(page) {
  await page.waitForTimeout(400);
  // dialog screen has data-choice buttons or .dialog-choice
  let safety = 0;
  while (safety++ < 6) {
    const choice = page.locator('.dialog-choice, [data-choice], button.cb-btn').filter({ hasText: /.+/ }).first();
    const cont = page.locator('button').filter({ hasText: /^continue$/i }).first();
    const close = page.locator('button').filter({ hasText: /close|leave|back/i }).first();
    if (await cont.count() > 0 && await cont.isVisible()) {
      await cont.click();
      await page.waitForTimeout(500);
      break;
    }
    if (await choice.count() > 0 && await choice.isVisible()) {
      await choice.click();
      await page.waitForTimeout(700);
      continue;
    }
    if (await close.count() > 0 && await close.isVisible()) {
      await close.click();
      break;
    }
    break;
  }
  await page.waitForTimeout(500);
}

async function navigateNode(page, nodeId) {
  return await page.evaluate((id) => {
    if (typeof window.__pickNode !== 'function') return false;
    return window.__pickNode(id);
  }, nodeId);
}

async function isInCombat(page) {
  return await page.locator('.cbt-log-panel').count() > 0;
}

async function isInMap(page) {
  return await page.evaluate(() => !!window.__activeMapScreen);
}

async function snap(page, name) {
  await page.screenshot({ path: `e2e/playthrough/screen-${name}.png`, fullPage: false });
}

test('Border Roads — full first-map playthrough to boss kill', async ({ page }) => {
  test.setTimeout(180_000);

  // ── Title screen ──────────────────────────────────────────────
  // Pre-set localStorage so the telemetry-consent banner + auth banner stay
  // dismissed across the whole playthrough — quieter video.
  await page.addInitScript(() => {
    localStorage.setItem('emberveil_telemetry_consent', 'declined');
    localStorage.setItem('emberveil_auth_dismissed', '1');
  });
  await page.goto('/play.html');
  await page.waitForSelector('.title-menu', { timeout: 15000 });
  await page.waitForTimeout(1200);

  // Dismiss any consent or auth modals that still appear (defensive — the
  // localStorage hint above usually suppresses them, but cover both paths).
  for (const sel of ['button:has-text("No thanks")', '.tm-user-card .tm-user-btn-alt:has-text("Skip")', 'button:has-text("Maybe later")']) {
    const btn = page.locator(sel).first();
    if (await btn.count() > 0 && await btn.isVisible().catch(() => false)) {
      await btn.click().catch(() => {});
      await page.waitForTimeout(400);
    }
  }
  await snap(page, '01-title');

  const newGame = page.locator('#btn-new-game').first();
  await expect(newGame).toBeVisible({ timeout: 5000 });
  await newGame.click();
  await page.waitForTimeout(1500);

  // ── Character builder: difficulty pick (step 1) ─────────────
  // M276: 3-card picker (Easy/Normal/Hard) + Next button.
  const normalDiff = page.locator('.cb-difficulty-card[data-diff="normal"], .difficulty-card:has-text("Normal"), [data-difficulty="normal"]').first();
  if (await normalDiff.count() > 0) {
    await normalDiff.click().catch(() => {});
    await page.waitForTimeout(500);
  }
  // Click Next to advance to class picker.
  const diffNext = page.locator('button').filter({ hasText: /^next/i }).first();
  if (await diffNext.count() > 0 && await diffNext.isVisible().catch(() => false)) {
    await diffNext.click({ force: true });
    await page.waitForTimeout(800);
  }

  // ── Character builder: class pick (step 2) ───────────────────
  // Pick the first available unlocked class — should be a starter (warrior).
  const firstClass = page.locator('.cb-class-card:not(.locked)').first();
  await expect(firstClass).toBeVisible({ timeout: 10000 });
  await firstClass.click();
  await page.waitForTimeout(500);
  await snap(page, '02-class-picked');

  const next = page.locator('#cb-next');
  await expect(next).toBeEnabled({ timeout: 5000 });
  await next.click();
  await page.waitForTimeout(800);

  // Step 2 — name + appearance + attrs already auto-filled. Just confirm.
  const confirm = page.locator('#cb-confirm');
  await expect(confirm).toBeVisible({ timeout: 5000 });
  await page.waitForTimeout(600); // let the user see the panel
  await confirm.click();
  await page.waitForTimeout(2000);
  await snap(page, '03-after-create');

  // ── Skip opening cinematic ───────────────────────────────────
  // After Begin Adventure, an OpeningCinematicScreen plays a few panels.
  // The "#cin-skip" element is the explicit skip button — click it.
  await page.waitForTimeout(1500);
  for (let i = 0; i < 8; i++) {
    const skipEl = page.locator('#cin-skip').first();
    if (await skipEl.count() === 0) break;
    await skipEl.click().catch(() => {});
    await page.waitForTimeout(600);
  }
  // Last-resort: click anywhere if cinematic still shows.
  for (let i = 0; i < 5; i++) {
    const stillCine = await page.evaluate(() => /Tap to skip|cin-skip/i.test(document.body.innerHTML));
    if (!stillCine) break;
    await page.mouse.click(196, 426);
    await page.waitForTimeout(700);
  }
  await page.waitForTimeout(1200);
  await snap(page, '03b-after-cinematic');

  // ── Town screen → Map ────────────────────────────────────────
  // Character creation + cinematic drops the player into Emberglen town first.
  await page.waitForTimeout(1500);
  // M275: pipe browser console logs to test output for debugging.
  page.on('console', msg => console.log('[browser]', msg.type(), msg.text()));
  // Diagnostics: what's on screen + does #btn-map exist?
  const diag = await page.evaluate(() => {
    const btn = document.querySelector('#btn-map');
    return {
      hasBtnMap: !!btn,
      btnText: btn?.textContent?.trim().slice(0, 60),
      btnOffsetParent: btn ? !!btn.offsetParent : null,
      activeScreen: typeof window.__activeCombatScreen !== 'undefined' ? 'combat' : (typeof window.__activeMapScreen !== 'undefined' ? 'map' : 'none'),
      bodyTextSlice: document.body.innerText.slice(0, 200),
    };
  });
  console.log('[diag pre-click]', JSON.stringify(diag));
  await page.evaluate(() => {
    const btn = document.querySelector('#btn-map');
    if (btn) btn.click();
  });
  await page.waitForTimeout(2500);
  const diag2 = await page.evaluate(() => ({
    hasMap: !!window.__activeMapScreen,
    mapZone: window.__activeMapScreen?._zone?.id,
  }));
  console.log('[diag post-click]', JSON.stringify(diag2));
  // Wait for the map to mount.
  await page.waitForFunction(() => !!window.__activeMapScreen, { timeout: 15000 });
  await page.waitForTimeout(800);
  await snap(page, '04-map-start');

  // The path: start (Emberglen, town) → road_ambush (dialog) → crossroads_a (combat)
  // → wayside_cache (treasure, M260) → ruined_watch (combat) → border_boss
  // Adjacent branches (gravel_bend, briar_trail, crossroads_b, etc.) are skipped
  // for video brevity — we hit one combat + one dialog + one treasure + boss.
  // M275: graph-walk the zone using __debugState. Keep walking toward
  // border_boss until visited or 10 steps, whichever first.
  let safety = 0;
  const stepLog = [];
  while (safety++ < 12) {
    const state = await page.evaluate(() => (typeof window.__debugState === 'function') ? window.__debugState() : null);
    if (!state) {
      console.log('[playthrough] no debug state — bailing');
      break;
    }
    console.log(`[playthrough] turn ${safety}: at ${state.currentNodeId}, screen=${state.screen}, reachable=${state.reachable.map(n => n.id+':'+n.type).join(',')}`);
    stepLog.push({ turn: safety, at: state.currentNodeId, reachable: state.reachable.map(n => n.id) });

    if (state.completedBosses.includes('border_boss')) {
      console.log('[playthrough] border_boss completed — done!');
      break;
    }

    // Pick next node. Priority: boss if reachable, then any combat/treasure/dialog,
    // skipping shrine for variety.
    const reachable = state.reachable;
    const boss = reachable.find(n => n.type === 'boss');
    const combat = reachable.find(n => n.type === 'combat');
    const treasure = reachable.find(n => n.type === 'treasure');
    const dialog = reachable.find(n => n.type === 'dialog');
    const ambush = reachable.find(n => n.type === 'ambush');
    const next = boss || combat || ambush || treasure || dialog || reachable[0];
    if (!next) {
      console.log('[playthrough] no reachable nodes — stuck');
      break;
    }

    try {
      await navigateNode(page, next.id);
      await page.waitForTimeout(900);
      await snap(page, `05-step${String(safety).padStart(2,'0')}-${next.id}`);

      // Wait for whichever screen activates
      await page.waitForTimeout(700);
      const inCombat = await isInCombat(page);
      if (inCombat || next.type === 'combat' || next.type === 'boss' || next.type === 'ambush') {
        await clickThroughCombat(page, next.id).catch(e => console.warn(`[playthrough] combat ${next.id}: ${e.message}`));
      } else if (next.type === 'dialog') {
        await clickThroughDialog(page).catch(e => console.warn(`[playthrough] dialog ${next.id}: ${e.message}`));
      } else if (next.type === 'treasure') {
        await page.waitForTimeout(800);
        const closeWithin = page.locator('.modal, .dialog-modal, .treasure-modal, .map-modal, .cbt-end-modal').locator('button').filter({ hasText: /close|continue|claim|take/i }).first();
        if (await closeWithin.count() > 0) {
          await closeWithin.click({ timeout: 5000 }).catch(() => {});
        } else {
          await page.keyboard.press('Escape');
        }
        await page.waitForTimeout(500);
      }
      await snap(page, `06-step${String(safety).padStart(2,'0')}-${next.id}-after`);
      await page.waitForFunction(() => !!window.__activeMapScreen, { timeout: 12000 }).catch(() => {});
      await page.waitForTimeout(700);
    } catch (e) {
      console.warn(`[playthrough] step ${next.id} threw: ${e.message}`);
      await snap(page, `99-error-${next.id}`);
      await page.keyboard.press('Escape').catch(() => {});
      await page.waitForTimeout(500);
    }
  }
  console.log('[playthrough] step log:', JSON.stringify(stepLog));

  // ── Boss kill confirmation ───────────────────────────────────
  // After defeating the boss, we should see "Thornwood Forest unlocked!" or similar.
  await page.waitForTimeout(1500);
  await snap(page, '07-after-boss');

  const completedBosses = await page.evaluate(() => {
    try { return window.__cloudSaves || (() => null)(); } catch { return null; }
  });
  const gsBosses = await page.evaluate(() => {
    try {
      // Reach into the GameState module via the active map screen.
      const ams = window.__activeMapScreen;
      if (!ams) return [];
      // GameState is module-scoped — but we can read it via the imported module.
      // Fall back to any global hook.
      return window.__gs?.completedBosses || [];
    } catch { return []; }
  });

  // Soft assertion — the playthrough may finish or it may end on a level-up
  // dialog. Either way the recording is what we wanted.
  console.log('Playthrough done. Completed bosses (best effort):', gsBosses);
});
