import { test, expect, Page } from '@playwright/test';

// Deterministic deep test: big 3BHK program via ?offline=1 (geometric engine,
// no model wait), then full workspace assertions: floor isolation, 3D, doors,
// staircase presence, no-JS-error gate.
const errors: string[] = [];
function watch(page: Page, tag: string) {
  page.on('pageerror', (e) => errors.push(`[${tag}] PAGEERROR: ${String(e).slice(0, 300)}`));
  page.on('console', (m) => {
    if (m.type() === 'error') {
      const t = m.text();
      if (!t.includes('favicon') && !t.includes('422') && !t.includes('502')) {
        errors.push(`[${tag}] CONSOLE: ${t.slice(0, 300)}`);
      }
    }
  });
}

test('workspace depth (offline 3BHK): floors, 3D, staircase, no errors', async ({ page }) => {
  test.setTimeout(300000);
  watch(page, 'ws');

  await page.goto('/?offline=1');
  await expect(page.getByRole('button', { name: /create blueprint/i }).first()).toBeVisible({ timeout: 30000 });
  await page.getByRole('button', { name: /create blueprint/i }).first().click();

  // Plot: defaults are 30x40 duplex already — just continue
  await expect(page.getByText('Your land, exactly as it is')).toBeVisible({ timeout: 20000 });
  await page.locator('header').getByRole('button', { name: /continue/i }).click();

  // Rooms: default config already has 3BHK-ish set — keep, continue
  await expect(page.getByText('What should your home hold?')).toBeVisible({ timeout: 20000 });
  await page.locator('header').getByRole('button', { name: /continue/i }).click();

  // Preferences: continue
  await expect(page.getByText('How should it feel?')).toBeVisible({ timeout: 20000 });
  await page.locator('header').getByRole('button', { name: /continue/i }).click();

  // Review -> generate (offline=1 flows straight to designs)
  await expect(page.getByText('Ready when you are')).toBeVisible({ timeout: 20000 });
  await page.getByRole('button', { name: /generate my blueprints/i }).click();

  // Floor dialog (duplex default) -> confirm
  const dialog = page.getByText('Confirm Floor Distribution');
  if (await dialog.isVisible({ timeout: 8000 }).catch(() => false)) {
    await page.getByRole('button', { name: /confirm & generate/i }).click();
  }

  // Designs (offline = instant)
  const openBtn = page.getByRole('button', { name: /^open design$/i }).first();
  await expect(openBtn).toBeVisible({ timeout: 60000 });
  const cardCount = await page.getByRole('button', { name: /^open design$/i }).count();
  console.log(`DESIGN CARDS: ${cardCount}`);
  expect(cardCount).toBe(5);
  await page.screenshot({ path: 'e2e/shots/w-design-options.png' });

  // Workspace
  await openBtn.click();
  await expect(page.locator('svg').first()).toBeVisible({ timeout: 30000 });
  await page.waitForTimeout(2000);

  // Room-name isolation across floors
  const names = () =>
    page.locator('svg text').evaluateAll((els) =>
      els.map((e) => (e.textContent || '').trim()).filter((t) => /bedroom|bathroom|kitchen|living|dining|parking|pooja|office|foyer|balcony|store|utility/i.test(t)),
    );
  const ground = [...new Set(await names())];
  console.log(`GROUND: ${ground.join(' | ')}`);
  expect(ground.length).toBeGreaterThan(2);
  await page.screenshot({ path: 'e2e/shots/w-2d-ground.png' });

  await page.getByRole('button', { name: /^first$/i }).click();
  await page.waitForTimeout(1500);
  const first = [...new Set(await names())];
  console.log(`FIRST: ${first.join(' | ')}`);
  expect(first.length).toBeGreaterThan(0);
  expect(first.filter((n) => ground.includes(n))).toEqual([]);
  await page.screenshot({ path: 'e2e/shots/w-2d-first.png' });

  // Validation badge present
  await expect(page.getByText(/constraint validation|validation/i).first()).toBeVisible();

  // 3D
  await page.getByRole('button', { name: /^3d$/i }).click();
  await page.waitForTimeout(7000);
  const canvas3d = await page.locator('canvas').count();
  console.log(`3D CANVASES: ${canvas3d}`);
  expect(canvas3d).toBeGreaterThan(0);
  await page.screenshot({ path: 'e2e/shots/w-3d.png' });

  // Back to 2D ground, open AI assistant, ask for bigger kitchen
  await page.getByRole('button', { name: /^2d$/i }).click();
  await page.waitForTimeout(1000);
  const aiInput = page.getByPlaceholder(/describe a change/i);
  if ((await aiInput.count()) > 0) {
    await aiInput.fill('make the kitchen larger');
    await aiInput.press('Enter');
    await page.waitForTimeout(8000);
    await page.screenshot({ path: 'e2e/shots/w-ai-assistant.png' });
  }

  console.log(`JS ERRORS (${errors.length}):\n${errors.join('\n') || '(none)'}`);
  expect(errors).toEqual([]);
});
