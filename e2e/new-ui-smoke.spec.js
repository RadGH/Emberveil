// M392 — smoke test for the new UI (uiOverhaul=true). Verifies:
//   1. Settings toggling New UI doesn't leak the prior panel.
//   2. CombatScreen mounted with uiOverhaul=true gets EvBattlefield (sibling
//      of canvas) + EvCardRail without console 404s on sprite paths.
//
// Bypasses title → class → map by pushing CombatScreen directly via
// window.__screenManager (exposed in main.js for tests).
//
// Run: npx playwright test e2e/new-ui-smoke.spec.js
import { test, expect } from '@playwright/test';

test.describe('New UI smoke (uiOverhaul)', () => {
  test('settings back-button after toggling New UI does not leak prior panel', async ({ page }) => {
    const errors = [];
    page.on('pageerror', e => errors.push(String(e)));

    await page.addInitScript(() => {
      localStorage.setItem('rsg_telemetryOptIn', 'false');
      localStorage.setItem('emberveil_auth_dismissed', '1');
      localStorage.setItem('rsg_consent_v1', 'reject');
    });

    await page.goto('/play.html');
    await page.waitForSelector('.title-menu', { timeout: 15000 });
    await page.waitForTimeout(800);

    const settingsBtn = page.locator('button, .title-btn').filter({ hasText: /settings/i }).first();
    await settingsBtn.click({ force: true });
    await page.waitForSelector('.settings-screen', { timeout: 5000 });

    const overhaulToggle = page.locator('#ui-overhaul-toggle');
    if (await overhaulToggle.count() > 0) {
      // Toggle twice — exercises _build re-render. Without the M390 fix this
      // leaves two .settings-screen panels in the DOM.
      await overhaulToggle.click({ force: true });
      await page.waitForTimeout(300);
      await overhaulToggle.click({ force: true });
      await page.waitForTimeout(300);
      expect(await page.locator('.settings-screen').count()).toBe(1);
    }

    const backBtn = page.locator('#settings-back');
    await backBtn.scrollIntoViewIfNeeded().catch(() => {});
    await backBtn.click({ force: true });
    await page.waitForTimeout(400);
    expect(await page.locator('.settings-screen').count()).toBe(0);

    expect(errors).toEqual([]);
  });

  test('combat screen with uiOverhaul mounts EvBattlefield + EvCardRail and avoids broken sprite paths', async ({ page }) => {
    test.setTimeout(60_000);

    const errors = [];
    const fourOhFours = [];
    page.on('pageerror', e => errors.push(String(e)));
    page.on('response', r => {
      if (r.status() === 404) fourOhFours.push(r.url());
    });

    await page.addInitScript(() => {
      localStorage.setItem('rsg_telemetryOptIn', 'false');
      localStorage.setItem('emberveil_auth_dismissed', '1');
      localStorage.setItem('rsg_consent_v1', 'reject');
      localStorage.setItem('emberveil_ui_overhaul', '1');
    });

    await page.goto('/play.html');
    await page.waitForFunction(() => !!window.__screenManager, { timeout: 15000 });

    // Push CombatScreen directly with a synthetic encounter against a 1-hero
    // party. Skips the entire intro flow — just want to know the screen
    // mounts with new-UI machinery wired up.
    const launched = await page.evaluate(async () => {
      const m = window.__screenManager;
      if (!m) return { ok: false, reason: 'no screen manager' };

      // Build a minimal party so CombatScreen has heroes to draw.
      const gs = await import('/src/game/gameState.js').then(x => x.GameState);
      const state = gs.get();
      if (!state.party || !state.party.length) {
        // Seed a single warrior — every install ships warrior unlocked.
        const { createParty } = await import('/src/game/party.js').catch(() => ({}));
        if (typeof createParty === 'function') {
          state.party = [createParty('Tester', 'warrior')];
        } else {
          state.party = [{
            id: 'p_test',
            name: 'Tester',
            class: 'warrior',
            level: 1,
            attrs: { STR: 10, DEX: 8, INT: 6, WIS: 6, CON: 10, CHA: 6 },
            hp: 50, maxHp: 50, mp: 10, maxMp: 10,
            equipment: {},
            potionBelt: [],
            statuses: [],
            skillCooldowns: {},
            alive: true,
          }];
        }
        state.companions = [];
      }

      const { CombatScreen } = await import('/src/ui/screens/CombatScreen.js');
      const { ENEMIES } = await import('/src/maps/mapData.js');
      const encounter = {
        id: 'smoke',
        name: 'Smoke Test',
        zoneId: 'border_roads',
        act: 1,
        // Encounters spread a full ENEMIES[id] entry (hp, dmg, armor, hit,
        // dodge, spritePrefix, etc.) plus a count.
        enemies: [
          { ...ENEMIES.goblin_scout, count: 2 },
        ],
      };
      try {
        m.push(new CombatScreen(m, m.audio, null, encounter));
      } catch (e) {
        return { ok: false, reason: String(e), stack: e?.stack };
      }
      return { ok: true };
    });

    if (!launched.ok) console.warn('[smoke] launch failed:', launched);
    expect(launched.ok, launched.reason || '').toBe(true);

    // Wait for combat HUD to mount (legacy and new UI co-exist; both must
    // be in the DOM for combat to be playable).
    await page.waitForSelector('.cbt-log-panel', { timeout: 15000 });
    // Allow the dynamic imports of EvBattlefield/EvCardRail to resolve.
    await page.waitForTimeout(800);

    // EvBattlefield must mount as a sibling of #game-canvas (M391 fix).
    const battlefieldOK = await page.evaluate(() => {
      const ev = document.querySelector('.ev-battlefield');
      const canvas = document.getElementById('game-canvas');
      return {
        hasEv: !!ev,
        hasCanvas: !!canvas,
        sibling: !!ev && !!canvas && ev.parentNode === canvas.parentNode,
        precedesCanvas: !!ev && !!canvas && ev.compareDocumentPosition(canvas) & Node.DOCUMENT_POSITION_FOLLOWING,
      };
    });
    expect(battlefieldOK.hasEv).toBe(true);
    expect(battlefieldOK.sibling).toBe(true);

    // Card rail mounted with at least one hero card.
    const heroCards = await page.locator('.ev-char-card').count();
    expect(heroCards).toBeGreaterThan(0);

    // Spell rail icons populated for all cards (cold or hot).
    const icons = await page.locator('.ev-char-card .spell-icon').count();
    expect(icons).toBeGreaterThan(0);

    // No 404s on sprite/portrait paths.
    const broken = fourOhFours.filter(u =>
      /\/images\/spritecook\//.test(u) || /fallback_portrait\.svg/.test(u)
    );
    if (broken.length) {
      console.warn('[smoke] sprite 404s:', broken.slice(0, 5));
    }
    expect(broken).toEqual([]);

    expect(errors).toEqual([]);

    // Diagnostic: who is actually painting at the tile coordinates? Read
    // back pixels from canvas at a known tile center.
    const stack = await page.evaluate(() => {
      const ev = document.querySelector('.ev-battlefield');
      const canvas = document.getElementById('game-canvas');
      const tile = ev?.querySelector('.ev-tile.tile-occupied');
      const tileBox = tile ? tile.getBoundingClientRect() : null;
      // Hit-test what's under the tile center via document.elementsFromPoint.
      let stackedAt = null;
      if (tileBox) {
        const cx = tileBox.left + tileBox.width / 2;
        const cy = tileBox.top + tileBox.height / 2;
        stackedAt = document.elementsFromPoint(cx, cy).map(el => ({
          tag: el.tagName,
          cls: el.className?.baseVal || el.className || '',
          id: el.id || '',
        }));
      }
      // Computed CSS for ev-battlefield + canvas
      const cs = (el) => {
        if (!el) return null;
        const s = getComputedStyle(el);
        return { zIndex: s.zIndex, position: s.position, opacity: s.opacity, mixBlendMode: s.mixBlendMode };
      };
      return {
        evCss: cs(ev),
        canvasCss: cs(canvas),
        stackedAt,
        canvasParent: canvas?.parentNode?.tagName,
        evParent: ev?.parentNode?.tagName,
        sameParent: !!ev && !!canvas && ev.parentNode === canvas.parentNode,
      };
    });
    console.log('[smoke] stack diagnostic:', JSON.stringify(stack, null, 2));

    // Diagnostic: how many tiles are marked occupied? What's the layout?
    const diag = await page.evaluate(() => {
      const ev = document.querySelector('.ev-battlefield');
      const polys = ev ? Array.from(ev.querySelectorAll('.ev-tile')) : [];
      const occupied = polys.filter(p => p.classList.contains('tile-occupied'));
      const ally = polys.filter(p => p.classList.contains('tile-side-ally'));
      const enemy = polys.filter(p => p.classList.contains('tile-side-enemy'));
      const sample = occupied.slice(0, 4).map(p => ({
        col: p.dataset.col,
        row: p.dataset.row,
        points: p.getAttribute('points'),
        side: p.classList.contains('tile-side-ally') ? 'ally' :
              p.classList.contains('tile-side-enemy') ? 'enemy' : 'none',
      }));
      const canvas = document.getElementById('game-canvas');
      const evRect = ev ? ev.getBoundingClientRect() : null;
      const canvasRect = canvas ? canvas.getBoundingClientRect() : null;
      return {
        polyCount: polys.length,
        occupiedCount: occupied.length,
        allyCount: ally.length,
        enemyCount: enemy.length,
        sample,
        evRect,
        canvasRect,
      };
    });
    console.log('[smoke] tile diagnostic:', JSON.stringify(diag, null, 2));

    // Visual artifact for manual review (committed to e2e/screenshots/).
    await page.screenshot({ path: 'e2e/screenshots/new-ui-combat.png', fullPage: false });
  });
});
