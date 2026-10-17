const { test, expect } = require('@playwright/test');
const { writeFile } = require('node:fs/promises');
const { startServer } = require('./test-server.cjs');

test.skip(!process.env.MIXER_LIVE, 'Set MIXER_LIVE=1 to contact the official demo');

const target = 'https://www.soundcraft.com/ui24-software-demo/mixer.html';
let server;
let parentUrl;

async function waitForMixer(frame) {
  let readinessError;
  await frame.waitForFunction(() => window.guiReady === true, undefined, { timeout: 20000 }).catch(error => { readinessError = error.message; });
  return frame.evaluate(error => ({
    readinessError: error,
    readyState: document.readyState,
    guiReady: window.guiReady,
    resourcesReady: window.RES_LOADED,
    loadedResourceCount: window.resReadyNum,
    resourceCount: Object.keys(window.res || {}).length,
    widgetCount: window.widgets?.length,
    dataCount: Object.keys(window.dataValue || {}).length,
    screenWidth: window.screenWidth,
    screenHeight: window.screenHeight,
    onload: String(window.onload).slice(0, 400),
    initParameters: { noData: window.noData, WEBSITE_MODE: window.WEBSITE_MODE, EMULATE: window.EMULATE },
  }), readinessError);
}

test.beforeAll(async () => {
  const started = await startServer();
  server = started.server;
  parentUrl = started.url;
});

test.afterAll(async () => {
  if (server) await new Promise(resolve => server.close(resolve));
});

test('official demo renders directly and inside a cross-origin iframe', async ({ page }, testInfo) => {
  const evidence = {
    checkedAt: new Date().toISOString(),
    target,
    project: testInfo.project.name,
    parentUrl,
    console: [],
    pageErrors: [],
    requestsFailed: [],
    responses: [],
  };
  page.on('console', message => evidence.console.push({ type: message.type(), text: message.text() }));
  page.on('pageerror', error => evidence.pageErrors.push(error.message));
  page.on('requestfailed', request => evidence.requestsFailed.push({ url: request.url(), error: request.failure() }));
  page.on('response', response => {
    if (response.request().isNavigationRequest() || response.status() >= 400) {
      evidence.responses.push({ url: response.url(), status: response.status(), headers: response.headers() });
    }
  });

  try {
    try {
      const response = await page.goto(target, { waitUntil: 'load', timeout: 30000 });
      evidence.direct = {
        url: page.url(),
        status: response?.status(),
        headers: await response?.allHeaders(),
        title: await page.title(),
        bodyText: (await page.locator('body').innerText()).slice(0, 3000),
        canvases: await page.locator('canvas').count(),
      };
      if (response?.status() === 200) evidence.direct.runtime = await waitForMixer(page);
      await page.screenshot({ path: testInfo.outputPath('direct.png') });
    } catch (error) {
      evidence.direct = { error: error.message, url: page.url() };
    }

    await page.goto(parentUrl, { waitUntil: 'load', timeout: 35000 });
    const frame = page.frames().find(candidate => candidate.parentFrame());
    if (frame && await frame.locator('canvas').count()) evidence.embeddedRuntime = await waitForMixer(frame);
    evidence.embedded = {
      url: frame?.url(),
      title: await frame?.title().catch(() => null),
      bodyText: await frame?.locator('body').innerText({ timeout: 5000 }).then(text => text.slice(0, 3000)).catch(() => null),
      canvases: await frame?.locator('canvas').count().catch(() => 0),
      frameSize: await page.locator('iframe:visible').boundingBox(),
    };
    await page.screenshot({ path: testInfo.outputPath('iframe.png') });

    if (evidence.embeddedRuntime?.guiReady && testInfo.project.name === 'android-landscape-emulation') {
      const before = await frame.evaluate(() => window.getValue('i.0.mute'));
      // Position observed in the live 915 x 412 mixer canvas, not a synthetic click handler.
      await frame.locator('canvas').tap({ position: { x: 18, y: 100 } });
      const after = await frame.evaluate(() => window.getValue('i.0.mute'));
      evidence.interaction = { action: 'tap CH1 MUTE', key: 'i.0.mute', before, after };
      await page.screenshot({ path: testInfo.outputPath('mute.png') });
    }

    await page.getByRole('button', { name: '開啟分頁選單', exact: true }).click();
    await page.screenshot({ path: testInfo.outputPath('floating-menu.png') });
    await page.getByRole('button', { name: '進入全螢幕', exact: true }).click();
    await expect.poll(() => page.evaluate(() => Boolean(document.fullscreenElement)), { timeout: 3000 }).toBe(true).catch(() => {});
    evidence.fullscreen = await page.evaluate(() => ({
      active: Boolean(document.fullscreenElement),
      error: document.getElementById('notice').hidden ? '' : document.getElementById('notice').textContent,
    }));
    await page.screenshot({ path: testInfo.outputPath('fullscreen.png') });

    evidence.embeddingPolicyErrors = evidence.console.filter(entry =>
      /refused to (frame|display)|frame-ancestors|x-frame-options/i.test(entry.text));
    evidence.conclusion = evidence.direct?.status !== 200
      ? 'unverified: official demo is unavailable even as a top-level page'
      : evidence.embeddingPolicyErrors.length
        ? 'blocked by browser framing policy'
        : evidence.embeddedRuntime?.guiReady && evidence.interaction?.before !== evidence.interaction?.after && evidence.fullscreen.active
          ? 'mixer GUI initialized inside iframe; CH1 MUTE tap and parent fullscreen succeeded'
          : 'unverified: no mixer canvas found in iframe';
  } finally {
    await writeFile(testInfo.outputPath('evidence.json'), JSON.stringify(evidence, null, 2) + '\n');
    console.log(JSON.stringify({ project: evidence.project, directStatus: evidence.direct?.status, embedded: evidence.embedded, interaction: evidence.interaction, fullscreen: evidence.fullscreen, conclusion: evidence.conclusion }));
  }

  expect(evidence.direct?.status, 'Official demo must work directly before embedding can be assessed').toBe(200);
  expect(evidence.embeddingPolicyErrors).toEqual([]);
  expect(evidence.embedded?.canvases, 'Mixer canvas must render inside iframe').toBeGreaterThan(0);
  expect(evidence.embeddedRuntime?.guiReady, 'Mixer GUI must finish initializing inside iframe').toBe(true);
  if (testInfo.project.name === 'android-landscape-emulation') {
    expect(evidence.interaction?.before, 'CH1 MUTE must have an initialized value').not.toBeNull();
    expect(evidence.interaction?.after, 'Tapping CH1 MUTE must change the mixer state').toBe(1 - evidence.interaction.before);
  }
  expect(evidence.fullscreen.active, 'Parent Fullscreen API must activate').toBe(true);
});
