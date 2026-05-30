import { test, expect } from '@playwright/test';

async function startNewGame(page) {
  await page.goto('/');
  await page.waitForSelector('.title-menu', { timeout: 10000 });
  await page.locator('button, .btn, .title-btn').filter({ hasText: /new game/i }).first().click();
  await page.waitForTimeout(800);
  await page.locator('.hb-class-card, .cb-class-card').first().click();
  await page.waitForTimeout(300);
  const nextBtn = page.locator('button, .btn').filter({ hasText: /next/i }).first();
  if (await nextBtn.count() > 0 && await nextBtn.isVisible()) {
    await nextBtn.click();
    await page.waitForTimeout(800);
  }
  const beginBtn = page.locator('button, .btn').filter({ hasText: /begin/i }).first();
  if (await beginBtn.count() > 0 && await beginBtn.isVisible()) {
    await beginBtn.click();
    await page.waitForTimeout(1500);
  }
  // Skip intro cinematic
  for (let i = 0; i < 5; i++) {
    const skipEl = page.getByText(/tap to skip/i).first();
    if (await skipEl.count() > 0) {
      await skipEl.click();
      await page.waitForTimeout(300);
      break;
    }
    await page.click('body');
    await page.waitForTimeout(400);
  }
  // Keep clicking through any remaining cinematic text
  for (let i = 0; i < 20; i++) {
    const townIndicator = page.locator('text=/welcome to|merchant|tavern/i').first();
    if (await townIndicator.count() > 0) break;
    await page.click('body');
    await page.waitForTimeout(300);
  }
  await page.waitForTimeout(1000);
}

test('town screen: tavern shows portraits', async ({ page }) => {
  await startNewGame(page);

  // Click Tavern
  const tavern = page.locator('button, .town-btn, .service-card, div').filter({ hasText: /tavern/i }).first();
  await tavern.click();
  await page.waitForTimeout(800);
  await page.screenshot({ path: 'e2e/screenshots/20-tavern.png' });

  // Check for portraits in hire list
  const portraits = page.locator('img.char-portrait');
  const count = await portraits.count();
  console.log(`Tavern portraits: ${count}`);

  if (count > 0) {
    for (let i = 0; i < Math.min(count, 4); i++) {
      const img = portraits.nth(i);
      const src = await img.getAttribute('src');
      const natural = await img.evaluate(el => ({ w: el.naturalWidth, display: el.style.display }));
      console.log(`  [${i}] src=${src} w=${natural.w} display=${natural.display}`);
    }
  }
});

test('inventory screen: portrait shows for equipped character', async ({ page }) => {
  await startNewGame(page);

  const invTab = page.locator('button, .nav-tab').filter({ hasText: /inventory/i }).first();
  if (await invTab.count() > 0) {
    await invTab.click();
    await page.waitForTimeout(800);
    await page.screenshot({ path: 'e2e/screenshots/21-inventory.png' });

    const portraits = page.locator('img.char-portrait');
    const count = await portraits.count();
    console.log(`Inventory portraits: ${count}`);
  }
});

test('skills screen: portraits in tab buttons', async ({ page }) => {
  await startNewGame(page);

  const skillsTab = page.locator('button, .nav-tab').filter({ hasText: /skills/i }).first();
  if (await skillsTab.count() > 0) {
    await skillsTab.click();
    await page.waitForTimeout(800);
    await page.screenshot({ path: 'e2e/screenshots/22-skills.png' });

    const portraits = page.locator('img.char-portrait');
    const count = await portraits.count();
    console.log(`Skills portraits: ${count}`);
  }
});

test('map screen: can travel to first node', async ({ page }) => {
  await startNewGame(page);

  const mapTab = page.locator('button, .nav-tab').filter({ hasText: /map|view map/i }).first();
  if (await mapTab.count() > 0) {
    await mapTab.click();
    await page.waitForTimeout(800);
    await page.screenshot({ path: 'e2e/screenshots/23-map.png' });

    // Click a node
    const node = page.locator('.map-node, .node-marker, [data-node]').first();
    if (await node.count() > 0) {
      await node.click();
      await page.waitForTimeout(500);

      const travelBtn = page.locator('button, .btn').filter({ hasText: /travel|go|enter|explore/i }).first();
      if (await travelBtn.count() > 0 && await travelBtn.isVisible()) {
        await travelBtn.click();
        await page.waitForTimeout(2000);
        await page.screenshot({ path: 'e2e/screenshots/24-encounter.png' });
      }
    }
  }
});
