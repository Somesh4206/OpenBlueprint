import { test, expect, Page } from '@playwright/test';

const errors: string[] = [];
function watch(page: Page, tag: string) {
  page.on('pageerror', (e) => errors.push(`[${tag}] PAGEERROR: ${String(e).slice(0, 300)}`));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(`[${tag}] CONSOLE: ${m.text().slice(0, 300)}`);
  });
}

test('full flow: landing → wizard → generate → workspace 2D/3D', async ({ page }) => {
  test.setTimeout(600000);
  watch(page, 'app');

  // ---- Landing ----
  await page.goto('/');
  await expect(page.getByRole('button', { name: /create blueprint/i }).first()).toBeVisible({ timeout: 30000 });
  await page.screenshot({ path: 'e2e/shots/01-landing.png' });

  // ---- Wizard step 1: plot ----
  await page.getByRole('button', { name: /create blueprint/i }).first().click();
  await expect(page.getByText('Your land, exactly as it is')).toBeVisible({ timeout: 20000 });
  await page.getByRole('button', { name: /30 × 40/ }).click();
  await page.screenshot({ path: 'e2e/shots/02-plot.png' });
  // Continue via header button (top) to prove it works
  await page.locator('header').getByRole('button', { name: /continue/i }).click();

  // ---- Wizard step 2: rooms (1 BHK keeps the AI call fast) ----
  await expect(page.getByText('What should your home hold?')).toBeVisible({ timeout: 20000 });
  await page.getByRole('button', { name: /1 BHK/ }).click();
  await expect(page.getByText('Your list (')).toBeVisible();
  await page.screenshot({ path: 'e2e/shots/03-rooms.png' });
  await page.locator('header').getByRole('button', { name: /continue/i }).click();

  // ---- Wizard step 3: preferences ----
  await expect(page.getByText('How should it feel?')).toBeVisible({ timeout: 20000 });
  await page.getByRole('button', { name: /open-plan living/i }).click();
  await page.screenshot({ path: 'e2e/shots/04-preferences.png' });
  await page.locator('header').getByRole('button', { name: /continue/i }).click();

  // ---- Wizard step 4: review + generate ----
  await expect(page.getByText('Ready when you are')).toBeVisible({ timeout: 20000 });
  await page.screenshot({ path: 'e2e/shots/05-review.png' });
  await page.getByRole('button', { name: /generate my blueprints/i }).click();

  // ---- Floor distribution dialog (2 floors from 3BHK? floors default 2) ----
  const dialog = page.getByText('Confirm Floor Distribution');
  if (await dialog.isVisible({ timeout: 8000 }).catch(() => false)) {
    await page.screenshot({ path: 'e2e/shots/06-floor-dialog.png' });
    await page.getByRole('button', { name: /confirm & generate/i }).click();
  }

  // ---- Design options: AI run or offline fallback ----
  await expect(page.getByText('Choose a design concept')).toBeVisible({ timeout: 30000 });
  // Three possible states: designs ready, AI doubts (clarify), or error (offline fallback)
  const openBtn = page.getByRole('button', { name: /^open design$/i }).first();
  const offlineBtn = page.getByRole('button', { name: /continue without ai/i });
  const planBtn = page.getByRole('button', { name: /plan with my answers/i });
  let gotDesigns = false;
  for (let i = 0; i < 100; i++) {
    if ((await openBtn.count()) > 0) { gotDesigns = true; break; }
    if ((await planBtn.count()) > 0) {
      await page.screenshot({ path: 'e2e/shots/06b-clarify.png' });
      await planBtn.click(); // accept defaults, continue planning
      continue;
    }
    if ((await offlineBtn.count()) > 0) {
      await offlineBtn.click();
      break;
    }
    await page.waitForTimeout(5000);
  }
  if (!gotDesigns) gotDesigns = ((await openBtn.count().catch(() => 0)) as number) > 0;
  expect(gotDesigns).toBe(true);
  await expect(openBtn).toBeVisible({ timeout: 60000 });
  const cardCount = await page.getByRole('button', { name: /^open design$/i }).count();
  console.log(`DESIGN CARDS: ${cardCount}`);
  await page.screenshot({ path: 'e2e/shots/07-design-options.png', fullPage: true });

  // ---- Workspace 2D ----
  await openBtn.click();
  const canvas = page.locator('svg').first();
  await expect(canvas).toBeVisible({ timeout: 30000 });
  await page.waitForTimeout(2000);
  // rooms rendered as SVG groups with data-room-id
  const roomCount = await page.locator('[data-room-id]').count();
  console.log(`2D ROOM NODES: ${roomCount}`);
  expect(roomCount).toBeGreaterThan(0);
  await page.screenshot({ path: 'e2e/shots/08-workspace-2d.png' });

  // ---- Floor switch: Ground -> First, rooms must change, no overlay ----
  // NOTE: [data-room-id] matches fill + warning overlays + handles per room,
  // so compare distinct room-name labels instead (each instance lives on
  // exactly one floor).
  const names = () =>
    page.locator('svg text').evaluateAll((els) =>
      els.map((e) => (e.textContent || '').trim()).filter((t) => /bedroom|bathroom|kitchen|living|dining|parking|pooja|office|foyer|balcony|store|utility/i.test(t)),
    );
  const beforeNames = [...new Set(await names())];
  await page.getByRole('button', { name: /^first$/i }).click();
  await page.waitForTimeout(1500);
  const afterNames = [...new Set(await names())];
  console.log(`GROUND: ${beforeNames.join(' | ')}`);
  console.log(`FIRST: ${afterNames.join(' | ')}`);
  expect(afterNames.length).toBeGreaterThan(0);
  const shared = beforeNames.filter((n) => afterNames.includes(n));
  expect(shared).toEqual([]); // no room instance visible on both floors
  await page.screenshot({ path: 'e2e/shots/09-workspace-first-floor.png' });

  // ---- 3D view ----
  await page.getByRole('button', { name: /^3d$/i }).click();
  await page.waitForTimeout(6000);
  await page.screenshot({ path: 'e2e/shots/10-workspace-3d.png' });

  // ---- Console/page errors ----
  const realErrors = errors.filter(
    (e) =>
      !e.includes('favicon') &&
      !e.includes('Three.js') &&
      !e.includes('THREE') &&
      // handled API states: 422 = AI doubts (clarify screen), 502 = model
      // error (error screen with retry/offline). Both are designed UX.
      !(e.includes('Failed to load resource') && e.includes('422')) &&
      !(e.includes('Failed to load resource') && e.includes('502')),
  );
  console.log(`JS ERRORS (${realErrors.length}):\n${realErrors.join('\n') || '(none)'}`);
  expect(realErrors).toEqual([]);
});
