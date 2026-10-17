const { defineConfig } = require('@playwright/test');
const { tmpdir } = require('node:os');
const path = require('node:path');

module.exports = defineConfig({
  testDir: __dirname,
  testMatch: '*.spec.cjs',
  outputDir: process.env.MIXER_QA_DIR || path.join(tmpdir(), `mixer-tabs-qa-${Date.now()}`),
  timeout: 90000,
  workers: 1,
  retries: 0,
  reporter: 'list',
  use: { browserName: 'chromium', headless: true },
  projects: [
    { name: 'desktop', use: { viewport: { width: 1280, height: 800 } } },
    { name: 'android-landscape-emulation', use: {
      viewport: { width: 915, height: 412 },
      deviceScaleFactor: 2.625,
      isMobile: true,
      hasTouch: true,
      userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Mobile Safari/537.36',
    } },
    { name: 'android-portrait-emulation', use: {
      viewport: { width: 412, height: 915 },
      deviceScaleFactor: 2,
      isMobile: true,
      hasTouch: true,
      userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Mobile Safari/537.36',
    } },
  ],
});
