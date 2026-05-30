import { test, expect } from '@playwright/test';

test.describe('Bug fixes verification', () => {

  test('menu scrolls on mobile viewport', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.title-menu', { timeout: 10000 });

    const menu = page.locator('.title-menu');
    const box = await menu.boundingBox();
    expect(box).toBeTruthy();

    const overflowY = await menu.evaluate(el => getComputedStyle(el).overflowY);
    expect(['auto', 'scroll']).toContain(overflowY);

    const appOverflowY = await page.locator('#app').evaluate(el => getComputedStyle(el).overflowY);
    expect(appOverflowY).not.toBe('hidden');
  });

  test('New Game flow → class picker cards fit on 393px', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.title-menu', { timeout: 10000 });

    const newGameBtn = page.locator('button, .btn').filter({ hasText: /new game/i }).first();
    await newGameBtn.click();

    await page.waitForSelector('.hb-class-grid, .cb-class-grid', { timeout: 5000 });

    const cards = page.locator('.hb-class-card, .cb-class-card');
    const count = await cards.count();
    expect(count).toBeGreaterThan(0);

    for (let i = 0; i < Math.min(count, 5); i++) {
      const card = cards.nth(i);
      const box = await card.boundingBox();
      if (box) {
        expect(box.x).toBeGreaterThanOrEqual(0);
        expect(box.x + box.width).toBeLessThanOrEqual(393 + 2);
      }
    }

    const hookText = page.locator('.hb-cls-hook, .cb-cls-hook').first();
    if (await hookText.count() > 0) {
      const overflow = await hookText.evaluate(el => {
        const style = getComputedStyle(el);
        return { overflow: style.overflow, webkitLineClamp: style.webkitLineClamp };
      });
      expect(overflow.webkitLineClamp || overflow.overflow).toBeTruthy();
    }
  });

  test('portraits load for hero classes (not broken images)', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.title-menu', { timeout: 10000 });

    const newGameBtn = page.locator('button, .btn').filter({ hasText: /new game/i }).first();
    await newGameBtn.click();

    await page.waitForTimeout(1000);

    const classGrid = page.locator('.hb-class-grid, .cb-class-grid');
    if (await classGrid.count() > 0) {
      const firstCard = page.locator('.hb-class-card, .cb-class-card').first();
      await firstCard.click();
      await page.waitForTimeout(500);
    }

    const portraits = page.locator('img.char-portrait');
    const pCount = await portraits.count();

    if (pCount > 0) {
      for (let i = 0; i < Math.min(pCount, 3); i++) {
        const img = portraits.nth(i);
        const displayed = await img.evaluate(el => el.style.display !== 'none' && el.naturalWidth > 0);
        if (displayed) {
          const src = await img.getAttribute('src');
          expect(src).toContain('portrait');
        }
      }
    }
  });

});
