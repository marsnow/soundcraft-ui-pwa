const { test, expect } = require('@playwright/test');
const { startServer } = require('./test-server.cjs');

const storageKey = 'mixer-pwa.tabs.v1';
test.setTimeout(30000);
let server;
let appUrl;

test.beforeAll(async () => {
  const started = await startServer();
  server = started.server;
  appUrl = started.url;
});
test.afterAll(async () => {
  if (server) await new Promise(resolve => server.close(resolve));
});

test.beforeEach(async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  page.__appErrors = errors;
  await page.route(url => ['www.soundcraft.com', '192.168.1.10', 'mixer-two.test'].includes(url.hostname), route => route.fulfill({
    contentType: 'text/html; charset=utf-8',
    body: '<!doctype html><html lang="zh-Hant"><head><meta charset="utf-8"><title>Test mixer fixture</title></head><body style="background:#20262c;color:white;font:20px system-ui"><h1>控制頁面測試</h1><button onclick="document.querySelector(\'output\').value=String(++window.count)">計數</button><output>0</output><script>window.count=0</script></body></html>',
  }));
});
test.afterEach(async ({ page }) => {
  expect(page.__appErrors, 'No JavaScript or console errors').toEqual([]);
});

async function openMenu(page) {
  if (await page.locator('#floating-panel').isHidden()) await page.getByRole('button', { name: '開啟分頁選單', exact: true }).click();
  await expect(page.locator('#floating-panel')).toBeVisible();
}

async function selectTab(page, name) {
  await openMenu(page);
  await page.getByRole('tab', { name, exact: true }).click();
  await expect(page.locator('#floating-panel')).toBeHidden();
}

async function openSettings(page) {
  await openMenu(page);
  await page.getByRole('button', { name: '分頁設定', exact: true }).click();
  await expect(page.getByRole('dialog', { name: '分頁設定' })).toBeVisible();
}

async function addTab(page, name, url) {
  await page.getByRole('button', { name: '＋ 新增分頁', exact: true }).click();
  const row = page.locator('.tab-entry').last();
  await row.getByRole('textbox', { name: '分頁名稱', exact: true }).fill(name);
  await row.getByRole('textbox', { name: '控制頁面網址', exact: true }).fill(url);
}

test('tabs save locally, retain live frames, and restore the selected tab', async ({ page }) => {
  await page.goto(appUrl);
  await expect(page).toHaveTitle('Mixer Tabs');
  await expect(page.locator('#floating-panel')).toBeHidden();
  await openMenu(page);
  await expect(page.getByRole('tab', { name: 'Ui24 Demo', exact: true })).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('a')).toHaveCount(0);
  await openSettings(page);
  await addTab(page, '主控台', '192.168.1.10/mixer.html');
  await addTab(page, '監聽', 'http://mixer-two.test/monitor.html');
  await page.getByRole('button', { name: '儲存設定', exact: true }).click();
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await expect(page.locator('iframe')).toHaveCount(1);

  await selectTab(page, '主控台');
  const main = page.frameLocator('iframe[title="主控台"]');
  await expect(main.locator('output')).toHaveText('0');
  await main.getByRole('button', { name: '計數', exact: true }).click();
  await expect(main.locator('output')).toHaveText('1');
  await selectTab(page, '監聽');
  await expect(page.frameLocator('iframe[title="監聽"]').locator('output')).toHaveText('0');
  await selectTab(page, '主控台');
  await expect(main.locator('output')).toHaveText('1');

  await openSettings(page);
  await page.getByRole('textbox', { name: '分頁名稱', exact: true }).nth(1).fill('FOH');
  await page.getByRole('button', { name: '儲存設定', exact: true }).click();
  await expect(page.frameLocator('iframe[title="FOH"]').locator('output')).toHaveText('1');
  const saved = await page.evaluate(key => JSON.parse(localStorage.getItem(key)), storageKey);
  expect(saved.tabs[1].url).toBe('http://192.168.1.10/mixer.html');
  await page.reload();
  await openMenu(page);
  await expect(page.getByRole('tab')).toHaveCount(3);
  await expect(page.getByRole('tab', { name: 'FOH', exact: true })).toHaveAttribute('aria-selected', 'true');
});

test('modal cancel, Escape, URL validation and removal behave correctly', async ({ page }) => {
  await page.goto(appUrl);
  await openSettings(page);
  await page.getByRole('textbox', { name: '分頁名稱', exact: true }).fill('未儲存');
  await page.getByRole('button', { name: '取消', exact: true }).click();
  await openMenu(page);
  await expect(page.getByRole('tab', { name: 'Ui24 Demo', exact: true })).toBeVisible();
  await openSettings(page);
  await expect(page.getByRole('textbox', { name: '分頁名稱', exact: true })).toHaveValue('Ui24 Demo');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).not.toBeVisible();

  await openSettings(page);
  await page.getByRole('textbox', { name: '分頁名稱', exact: true }).fill(' ');
  await page.getByRole('button', { name: '儲存設定', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('請填寫分頁名稱');
  await page.getByRole('textbox', { name: '分頁名稱', exact: true }).fill('主控台');
  await page.getByRole('textbox', { name: '控制頁面網址', exact: true }).fill('javascript:alert(1)');
  await page.getByRole('button', { name: '儲存設定', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('HTTP 或 HTTPS');
  await page.getByRole('textbox', { name: '控制頁面網址', exact: true }).fill('ftp://mixer-two.test/');
  await page.getByRole('button', { name: '儲存設定', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('HTTP 或 HTTPS');
  await page.getByRole('button', { name: '移除此分頁', exact: true }).click();
  await page.getByRole('button', { name: '儲存設定', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('至少新增一個');
  await addTab(page, '監聽', 'http://mixer-two.test/');
  await page.getByRole('button', { name: '儲存設定', exact: true }).click();
  await openMenu(page);
  await expect(page.getByRole('tab')).toHaveCount(1);
  await expect(page.getByRole('tab', { name: '監聽', exact: true })).toHaveAttribute('aria-selected', 'true');
});

test('storage failures keep the draft open and preserve the existing tabs', async ({ page }) => {
  await page.addInitScript(() => {
    Storage.prototype.setItem = () => { throw new DOMException('Storage blocked', 'QuotaExceededError'); };
  });
  await page.goto(appUrl);
  await openSettings(page);
  await page.getByRole('textbox', { name: '分頁名稱', exact: true }).fill('尚未儲存');
  await page.getByRole('button', { name: '儲存設定', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('無法儲存設定');
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByRole('textbox', { name: '分頁名稱', exact: true })).toHaveValue('尚未儲存');
  await page.getByRole('button', { name: '取消', exact: true }).click();
  await openMenu(page);
  await expect(page.getByRole('tab', { name: 'Ui24 Demo', exact: true })).toBeVisible();
});

test('invalid saved configuration falls back safely', async ({ page }) => {
  await page.addInitScript(key => localStorage.setItem(key, '{broken json'), storageKey);
  await page.goto(appUrl);
  await openMenu(page);
  await expect(page.getByRole('tab', { name: 'Ui24 Demo', exact: true })).toBeVisible();
  await expect(page.getByRole('status')).toContainText('無法讀取本機設定');
});

test('keyboard navigation, fullscreen and responsive dialog work', async ({ page }, testInfo) => {
  await page.goto(appUrl);
  await openSettings(page);
  await addTab(page, '舞台監聽', 'http://mixer-two.test/');
  await page.getByRole('button', { name: '儲存設定', exact: true }).click();
  await openMenu(page);
  await page.getByRole('tab', { name: 'Ui24 Demo', exact: true }).focus();
  await page.keyboard.press('ArrowDown');
  await expect(page.getByRole('tab', { name: '舞台監聽', exact: true })).toBeFocused();
  await expect(page.getByRole('tab', { name: '舞台監聽', exact: true })).toHaveAttribute('aria-selected', 'true');
  await page.keyboard.press('Home');
  await expect(page.getByRole('tab', { name: 'Ui24 Demo', exact: true })).toBeFocused();
  await page.getByRole('button', { name: '進入全螢幕', exact: true }).click();
  await expect.poll(() => page.evaluate(() => Boolean(document.fullscreenElement))).toBe(true);
  await openMenu(page);
  await page.getByRole('button', { name: '離開全螢幕', exact: true }).click();
  await expect.poll(() => page.evaluate(() => Boolean(document.fullscreenElement))).toBe(false);
  await openSettings(page);
  const box = await page.getByRole('dialog').boundingBox();
  const viewport = page.viewportSize();
  expect(box.width).toBeLessThanOrEqual(viewport.width);
  expect(box.height).toBeLessThanOrEqual(viewport.height);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('settings-modal.png') });
});

test('PWA manifest and shell cache support opening the app offline', async ({ page, context }) => {
  await page.goto(new URL('./', appUrl).href);
  await expect(page).toHaveURL(appUrl);
  await expect(page.locator('#floating-toggle')).toBeVisible();
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller));
  const manifest = await page.evaluate(async () => (await fetch(document.querySelector('link[rel="manifest"]').href)).json());
  expect(manifest.display).toBe('fullscreen');
  expect(manifest.icons.map(icon => icon.sizes)).toEqual(['192x192', '512x512']);
  expect(manifest.icons.map(icon => icon.src)).toEqual(['./icons/soundcraft-ui-192.png', './icons/soundcraft-ui-512.png']);
  const iconSizes = await page.evaluate(async icons => Promise.all(icons.map(async icon => {
    const image = new Image();
    image.src = icon.src;
    await image.decode();
    return [image.naturalWidth, image.naturalHeight];
  })), manifest.icons);
  expect(iconSizes).toEqual([[192, 192], [512, 512]]);
  const cacheUrls = await page.evaluate(async () => {
    const cache = await caches.open('mixer-tabs-shell-v2');
    return (await cache.keys()).map(request => request.url);
  });
  expect(cacheUrls).toHaveLength(7);
  expect(cacheUrls.every(url => new URL(url).origin === new URL(appUrl).origin)).toBe(true);
  await context.setOffline(true);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await openMenu(page);
  await expect(page.getByRole('tab', { name: 'Ui24 Demo', exact: true })).toBeVisible();
  await openSettings(page);
  await expect(page.getByRole('textbox', { name: '分頁名稱', exact: true })).toHaveValue('Ui24 Demo');
});

test('collapsed controls leave the mixer full size and the panel does not block other controls', async ({ page }, testInfo) => {
  await page.goto(appUrl);
  await expect(page.locator('#floating-panel')).toBeHidden();
  const frameBox = await page.locator('iframe:visible').boundingBox();
  expect(frameBox.x).toBe(0);
  expect(frameBox.y).toBe(0);
  expect(frameBox.width).toBe(page.viewportSize().width);
  expect(frameBox.height).toBe(page.viewportSize().height);
  const handle = await page.locator('#floating-toggle').boundingBox();
  expect(handle.width).toBe(48);
  expect(handle.height).toBe(48);
  await page.screenshot({ path: testInfo.outputPath('floating-collapsed.png') });
  await openMenu(page);
  await page.frameLocator('iframe[title="Ui24 Demo"]').getByRole('button', { name: '計數', exact: true }).click();
  await expect(page.frameLocator('iframe[title="Ui24 Demo"]').locator('output')).toHaveText('1');
  await expect(page.locator('#floating-panel')).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('floating-expanded.png') });
  await page.getByRole('button', { name: '收合分頁選單', exact: true }).click();
  await expect(page.locator('#floating-panel')).toBeHidden();
  await openMenu(page);
  await page.keyboard.press('Escape');
  await expect(page.locator('#floating-panel')).toBeHidden();
  await expect(page.locator('#floating-toggle')).toBeFocused();
});

test('dragging across the iframe docks, persists and stays reachable after rotation', async ({ page, context }, testInfo) => {
  await page.goto(appUrl);
  await openMenu(page);
  const handle = await page.locator('#floating-toggle').boundingBox();
  const viewport = page.viewportSize();
  const start = { x: handle.x + 24, y: handle.y + 24 };
  const end = { x: viewport.width * 0.25, y: viewport.height * 0.75 };
  if (testInfo.project.use.hasTouch) {
    const client = await context.newCDPSession(page);
    await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ ...start, id: 1 }] });
    for (let step = 1; step <= 10; step++) {
      await client.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: start.x + (end.x - start.x) * step / 10, y: start.y + (end.y - start.y) * step / 10, id: 1 }] });
    }
    await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await client.detach();
  } else {
    await page.mouse.move(start.x, start.y);
    await page.mouse.down();
    await page.mouse.move(end.x, end.y, { steps: 10 });
    await page.mouse.up();
  }
  await expect(page.locator('#floating-panel')).toBeHidden();
  const position = await page.evaluate(() => JSON.parse(localStorage.getItem('mixer-pwa.dock.v1')));
  expect(position.side).toBe('left');
  const moved = await page.locator('#floating-toggle').boundingBox();
  expect(moved.x).toBe(12);
  expect(moved.y).toBeGreaterThan(handle.y);
  await page.reload();
  const restored = await page.locator('#floating-toggle').boundingBox();
  expect(restored.x).toBe(12);
  expect(Math.abs(restored.y - moved.y)).toBeLessThan(1);
  await page.setViewportSize({ width: viewport.height, height: viewport.width });
  await expect.poll(async () => {
    const box = await page.locator('#floating-toggle').boundingBox();
    return box.x === 12 && box.y >= 12 && box.y + box.height <= page.viewportSize().height - 12;
  }).toBe(true);
  await openMenu(page);
  const panel = await page.locator('#floating-panel').boundingBox();
  expect(panel.x).toBeGreaterThanOrEqual(70);
  expect(panel.y).toBeGreaterThanOrEqual(12);
  expect(panel.x + panel.width).toBeLessThanOrEqual(page.viewportSize().width - 12);
  expect(panel.y + panel.height).toBeLessThanOrEqual(page.viewportSize().height - 12);
  await page.screenshot({ path: testInfo.outputPath('floating-rotated.png') });
});
