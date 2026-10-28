'use strict';
// Run:  NODE_PATH=$(npm root -g) node tests/e2e/nav.js
const { chromium } = require('playwright');
const { create } = require('./mock-server');
const mock = create();
let passed = 0; const failures = [];
const check = (n, c, x) => { if (c) { passed++; console.log('  ✓ ' + n); } else { failures.push(n); console.log('  ✗ ' + n + (x ? ' → ' + x : '')); } };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function until(fn, ms = 6000) { const t = Date.now(); while (Date.now() - t < ms) { if (await fn()) return true; await sleep(100); } return false; }

(async () => {
  await new Promise((r) => mock.server.listen(0, r));
  const base = 'http://localhost:' + mock.server.address().port;
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  const errors = []; page.on('pageerror', (e) => errors.push(e.message));

  console.log('\nLogged out');
  for (const p of ['/index.html', '/templates.html']) {
    await page.goto(base + p); await page.waitForLoadState('networkidle'); await sleep(400);
    check(p + ': NO profile icon when logged out', (await page.locator('[data-nav-profile]').count()) === 0);
    check(p + ': Create Resume button still there', (await page.locator('.nav__cta').count()) === 1);
  }
  await page.locator('.template-card[data-template-id="elegant-serif"] [data-action="preview"]').click();
  check('can preview a template without login', (await page.locator('#preview-modal[open]').count()) === 1);
  await page.keyboard.press('Escape');
  const r1 = await page.request.get(base + '/builder.html', { maxRedirects: 0 });
  const r2 = await page.request.get(base + '/js/pdf-download.js', { maxRedirects: 0 });
  check('cannot open the editor (302 → login) or get the PDF code (401) without login', r1.status() === 302 && r2.status() === 401);

  console.log('\nSign up → icon appears');
  await page.goto(base + '/auth.html?mode=register');
  await page.fill('#register-name', 'Sara Khan'); await page.fill('#register-email', 'sara@example.com'); await page.fill('#register-password', 'password1'); await page.fill('#register-confirm', 'password1');
  await page.locator('#register-form button[type=submit]').click(); await page.waitForURL(/dashboard/);
  for (const p of ['/index.html', '/templates.html']) {
    await page.goto(base + p);
    check(p + ': profile icon appears when logged in', await until(async () => (await page.locator('[data-nav-profile]').count()) === 1));
    const cta = await page.locator('.nav__cta').boundingBox(); const prof = await page.locator('[data-nav-profile]').boundingBox();
    check(p + ': icon sits to the RIGHT of Create Resume, same row', prof.x >= cta.x + cta.width - 1 && Math.abs((prof.y + prof.height / 2) - (cta.y + cta.height / 2)) < 6, JSON.stringify({ cta, prof }));
    check(p + ': icon is a visible circle with an accessible name', prof.width > 30 && /dashboard/i.test(await page.locator('[data-nav-profile]').getAttribute('aria-label')));
  }
  await page.locator('[data-nav-profile]').click();
  await page.waitForURL(/\/dashboard\.html/);
  check('clicking the icon opens the user dashboard', true);

  console.log('\nMobile menu');
  await page.setViewportSize({ width: 375, height: 760 });
  await page.goto(base + '/index.html'); await until(async () => (await page.locator('[data-nav-profile]').count()) === 1);
  await page.locator('.nav__toggle').click(); await sleep(400);
  check('mobile: icon + "My Dashboard" shown inside the opened menu', await page.locator('[data-nav-profile]').isVisible() && /My Dashboard/.test(await page.locator('[data-nav-profile]').innerText()));
  const ov = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  check('mobile: no horizontal overflow', ov <= 0);
  await page.screenshot({ path: '/tmp/shots/nav-mobile.png' });
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto(base + '/index.html'); await until(async () => (await page.locator('[data-nav-profile]').count()) === 1);
  await page.screenshot({ path: '/tmp/shots/nav-desktop.png', clip: { x: 0, y: 0, width: 1280, height: 90 } });

  console.log('\nLogout → icon disappears');
  await page.goto(base + '/dashboard.html'); await page.locator('header [data-action="logout"]').click(); await page.waitForURL(/index\.html|\/$/);
  await sleep(600);
  check('after logout the icon is gone from the public navbar', (await page.locator('[data-nav-profile]').count()) === 0);
  await page.goto(base + '/templates.html'); await sleep(600);
  check('and stays gone on the gallery', (await page.locator('[data-nav-profile]').count()) === 0);
  check('no JS errors', errors.length === 0, errors.join('; '));

  await browser.close(); mock.server.close();
  console.log('\n' + passed + ' passed, ' + failures.length + ' failed');
  if (failures.length) { console.log(' - ' + failures.join('\n - ')); process.exit(1); }
})().catch((e) => { console.error(e); process.exit(1); });
