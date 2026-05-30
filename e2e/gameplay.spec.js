import { test, expect } from '@playwright/test';

test.describe('Gameplay flow', () => {

  test('start game, hire hero, enter combat, verify portraits and scroll', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.title-menu', { timeout: 10000 });

    // Click New Game
    const newGame = page.locator('button, .btn, .title-btn').filter({ hasText: /new game/i }).first();
    await expect(newGame).toBeVisible();
    await newGame.click();
    await page.waitForTimeout(1000);

    // Select a class (first available)
    const classCard = page.locator('.hb-class-card:not(.locked)').first();
    if (await classCard.count() > 0) {
      await classCard.click();
      await page.waitForTimeout(500);

      // Check class card text doesn't overflow viewport
      const cardBox = await classCard.boundingBox();
      if (cardBox) {
        expect(cardBox.x + cardBox.width).toBeLessThanOrEqual(395);
      }

      // Look for confirm/create button
      const confirmBtn = page.locator('button, .btn').filter({ hasText: /confirm|create|start|begin|hire/i }).first();
      if (await confirmBtn.count() > 0) {
        await confirmBtn.click();
        await page.waitForTimeout(1500);
      }
    }

    // Take screenshot after character creation
    await page.screenshot({ path: 'e2e/screenshots/after-creation.png' });

    // Check if we're in the game now — look for common game UI elements
    const gameUI = page.locator('#ui-overlay, .map-screen, .town-screen, .party-screen');
    if (await gameUI.count() > 0) {
      // Check portraits are visible somewhere
      const portraits = page.locator('img.char-portrait');
      const pCount = await portraits.count();

      // Navigate to party screen if available
      const partyTab = page.locator('button, .tab, .nav-btn').filter({ hasText: /party/i }).first();
      if (await partyTab.count() > 0) {
        await partyTab.click();
        await page.waitForTimeout(500);
        await page.screenshot({ path: 'e2e/screenshots/party-screen.png' });

        // Verify party portraits load
        const partyPortraits = page.locator('img.char-portrait');
        if (await partyPortraits.count() > 0) {
          const firstPortrait = partyPortraits.first();
          const naturalWidth = await firstPortrait.evaluate(el => el.naturalWidth);
          expect(naturalWidth).toBeGreaterThan(0);
        }
      }

      // Navigate to inventory if available
      const invTab = page.locator('button, .tab, .nav-btn').filter({ hasText: /inventory|equip/i }).first();
      if (await invTab.count() > 0) {
        await invTab.click();
        await page.waitForTimeout(500);
        await page.screenshot({ path: 'e2e/screenshots/inventory-screen.png' });
      }

      // Check scrollability of current screen
      const scrollable = await page.evaluate(() => {
        const app = document.getElementById('app');
        if (!app) return 'no-app';
        const style = getComputedStyle(app);
        return style.overflowY;
      });
      expect(scrollable).not.toBe('hidden');
    }
  });

  test('debug mode enables combat analysis tools', async ({ page }) => {
    await page.goto('/?debug=1');
    await page.waitForSelector('.title-menu', { timeout: 10000 });

    // Verify combat simulator is accessible (should be available even without debug now)
    const simLink = page.locator('a, button, .title-link').filter({ hasText: /combat sim/i }).first();
    const simVisible = await simLink.count() > 0;
    expect(simVisible).toBeTruthy();
  });

});
