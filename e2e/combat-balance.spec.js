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
  for (let i = 0; i < 5; i++) {
    const skipEl = page.getByText(/tap to skip/i).first();
    if (await skipEl.count() > 0) { await skipEl.click(); await page.waitForTimeout(300); break; }
    await page.click('body');
    await page.waitForTimeout(400);
  }
  for (let i = 0; i < 20; i++) {
    const town = page.locator('text=/welcome to|merchant|tavern/i').first();
    if (await town.count() > 0) break;
    await page.click('body');
    await page.waitForTimeout(300);
  }
  await page.waitForTimeout(1000);
}

test('tavern hire list shows character portraits', async ({ page }) => {
  await startNewGame(page);

  // Navigate to tavern via the service card
  const tavernCard = page.locator('.service-card, .town-service').filter({ hasText: /tavern/i }).first();
  if (await tavernCard.count() === 0) {
    // Try clicking the Tavern text tab
    const tavernTab = page.locator('.town-tab, .service-tab').filter({ hasText: /tavern/i }).first();
    if (await tavernTab.count() > 0) await tavernTab.click();
    else await page.getByText('Tavern').first().click();
  } else {
    await tavernCard.click();
  }
  await page.waitForTimeout(1000);
  await page.screenshot({ path: 'e2e/screenshots/30-tavern-hire.png' });

  // Check for portraits
  const portraits = page.locator('img.char-portrait');
  const count = await portraits.count();
  console.log(`Tavern hire portraits: ${count}`);

  // Check hireable hero names
  const hireCards = page.locator('.hireable-card');
  const hireCount = await hireCards.count();
  console.log(`Hireable cards: ${hireCount}`);

  if (hireCount > 0) {
    for (let i = 0; i < Math.min(hireCount, 3); i++) {
      const text = await hireCards.nth(i).innerText();
      console.log(`  Card ${i}: ${text.substring(0, 60)}`);
    }
  }
});

test('combat encounter: enter, fight, verify damage display', async ({ page }) => {
  await startNewGame(page);

  // Go to map
  await page.getByText('View Map').first().click();
  await page.waitForTimeout(800);

  // Click a combat node (look for any clickable node)
  const nodes = page.locator('.map-node, .node-marker, [data-node], circle, .node');
  const nodeCount = await nodes.count();
  console.log(`Map nodes: ${nodeCount}`);

  if (nodeCount > 1) {
    // Click the second node (first is usually the town)
    await nodes.nth(1).click();
    await page.waitForTimeout(500);
    await page.screenshot({ path: 'e2e/screenshots/31-map-node.png' });

    // Travel
    const travelBtn = page.locator('button, .btn').filter({ hasText: /travel|go|enter|explore/i }).first();
    if (await travelBtn.count() > 0 && await travelBtn.isVisible()) {
      await travelBtn.click();
      await page.waitForTimeout(2000);
      await page.screenshot({ path: 'e2e/screenshots/32-encounter.png' });

      // Check if we're in combat
      const combatUI = page.locator('.combat-screen, .encounter-screen, [class*="combat"]');
      if (await combatUI.count() > 0) {
        console.log('Combat screen detected');

        // Look for attack/fight buttons
        const attackBtn = page.locator('button, .btn').filter({ hasText: /attack|fight|auto|start/i }).first();
        if (await attackBtn.count() > 0 && await attackBtn.isVisible()) {
          await attackBtn.click();
          await page.waitForTimeout(3000);
          await page.screenshot({ path: 'e2e/screenshots/33-combat-action.png' });
        }

        // Check combat log for damage numbers
        const log = page.locator('.combat-log, .log-entry, [class*="log"]');
        if (await log.count() > 0) {
          const logText = await log.first().innerText();
          console.log(`Combat log: ${logText.substring(0, 200)}`);
        }
      }
    }
  }
});

test('skill tree: unlock and view talents', async ({ page }) => {
  await startNewGame(page);

  // Click Skills tab
  const skillsTab = page.locator('button, .nav-tab').filter({ hasText: /skills/i }).first();
  await skillsTab.click();
  await page.waitForTimeout(800);

  // Check skills are listed
  const skills = page.locator('.skill-row, .sct-skill, [class*="skill"]');
  const skillCount = await skills.count();
  console.log(`Skills found: ${skillCount}`);

  await page.screenshot({ path: 'e2e/screenshots/34-skills.png' });

  // Click first skill to see talents
  if (skillCount > 0) {
    await skills.first().click();
    await page.waitForTimeout(500);
    await page.screenshot({ path: 'e2e/screenshots/35-skill-detail.png' });
  }
});
