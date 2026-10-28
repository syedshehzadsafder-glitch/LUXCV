'use strict';
// Existing features must still work behind login AND under the real CSP.
// Run:  NODE_PATH=$(npm root -g) node tests/e2e/regression.js
const { chromium } = require('playwright');
const { create } = require('./mock-server');
const fs = require('fs');
const mock = create();
let passed = 0; const failures = [];
const check = (n, c, x) => { if (c) { passed++; console.log('  ✓ ' + n); } else { failures.push(n); console.log('  ✗ ' + n + (x ? ' → ' + x : '')); } };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function until(fn, ms = 8000) { const t = Date.now(); while (Date.now() - t < ms) { if (await fn()) return true; await sleep(100); } return false; }
const IDS = ['executive-gold','modern-professional','minimalist-white','creative-portfolio','corporate-classic','tech-specialist','student-graduate','elegant-serif','compact-ats','midnight-premium'];

(async () => {
  await new Promise((r) => mock.server.listen(0, r));
  const base = 'http://localhost:' + mock.server.address().port;
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, acceptDownloads: true });
  const page = await ctx.newPage();
  const problems = [];
  page.on('pageerror', (e) => problems.push('pageerror: ' + e.message));
  page.on('console', (m) => {
    const t = m.text();
    if (/ERR_NAME_NOT_RESOLVED/.test(t)) return;                  // Google Fonts: no internet in the test sandbox
    if (/status of 401/.test(t)) return;                          // expected: auth page probes /api/auth/me while logged out
    if (m.type() === 'error' || /content security policy|refused to/i.test(t)) problems.push(m.type() + ': ' + t);
  });

  console.log('\nPublic pages under CSP');
  await page.goto(base + '/index.html'); await page.waitForLoadState('networkidle');
  check('home: hero visible, js class applied (inline script allowed by hash)', (await page.evaluate(() => document.documentElement.classList.contains('js'))) && await page.locator('.hero__title').isVisible());
  await page.goto(base + '/templates.html'); await page.waitForSelector('.template-card');
  check('gallery: 10 live miniatures render', (await page.locator('.template-card .resume-sheet').count()) === 10);
  await page.locator('.chip[data-filter="ats"]').click().catch(() => {});

  console.log('\nSign up, then every template in the builder');
  await page.goto(base + '/auth.html?mode=register');
  await page.fill('#register-name', 'Grace Hopper'); await page.fill('#register-email', 'grace@example.com'); await page.fill('#register-password', 'compiler1'); await page.fill('#register-confirm', 'compiler1');
  await page.locator('#register-form button[type=submit]').click(); await page.waitForURL(/dashboard/);
  for (const id of IDS) {
    await page.goto(base + '/builder.html?template=' + id);
    await page.waitForSelector('#f-personal-fullName');
    await until(async () => (await page.locator('[data-selected-template]').textContent()) !== '' );
    await page.fill('#f-personal-fullName', 'Grace Hopper');
    const ok = await until(async () => (await page.locator('[data-live-preview] .resume-sheet').count()) === 1 && /Grace Hopper/.test(await page.locator('[data-live-preview] .resume-sheet').textContent()));
    const cls = await page.locator('[data-live-preview] .resume-sheet').getAttribute('class');
    check(id + ': live preview renders with the right template class', ok && cls.includes('resume--' + id), cls);
  }

  console.log('\nBuilder features');
  await page.goto(base + '/builder.html?template=executive-gold');
  await page.waitForSelector('#f-personal-fullName');
  await page.fill('#f-personal-fullName', 'Grace Hopper'); await page.fill('#f-personal-email', 'grace@example.com');
  check('validation still runs: bad email message', await (async () => { await page.fill('#f-personal-email', 'abc'); await page.locator('#f-personal-fullName').focus(); return until(async () => (await page.locator('#resume-form .field__error:not([hidden])').count()) > 0); })());
  await page.fill('#f-personal-email', 'grace@example.com');
  const dl = page.waitForEvent('download', { timeout: 30000 }).catch(() => null);
  await page.locator('[data-action="download-pdf"]').click();
  const download = await dl;
  check('Download PDF works while logged in (jsPDF + html2canvas load from gated /js/vendor, under CSP)', !!download, 'no download event');
  if (download) {
    const f = await download.path(); const buf = fs.readFileSync(f);
    check('downloaded file is a real PDF', buf.slice(0, 5).toString() === '%PDF-' && buf.length > 5000, buf.length + ' bytes');
  }
  await page.locator('[data-action="print-version"]').isHidden();
  await page.evaluate(() => { window.__printed = 0; window.print = () => { window.__printed++; }; });
  await page.locator('[data-action="print"]').click();
  check('Print Resume still reaches window.print()', await until(async () => (await page.evaluate(() => window.__printed)) >= 1));
  await page.locator('[data-action="clear"]').first().click();
  await page.locator('#clear-dialog [data-dialog-close="confirm"]').click();
  check('Clear Resume empties the form AND deletes the account copy', await until(async () => (await page.inputValue('#f-personal-fullName')) === '') && await until(() => mock.resumes.filter((r) => r.data.personal && r.data.personal.fullName).length === 0 && mock.resumes.length === 0));

  console.log('\nResponsive builder');
  for (const w of [320, 768, 1024]) {
    await page.setViewportSize({ width: w, height: 800 });
    await page.goto(base + '/builder.html?template=modern-professional'); await page.waitForSelector('#f-personal-fullName');
    const ov = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    check('builder: no horizontal scroll at ' + w + 'px', ov <= 0, 'overflow ' + ov);
  }
  for (const p of ['/dashboard.html']) for (const w of [320, 768]) {
    await page.setViewportSize({ width: w, height: 800 }); await page.goto(base + p); await page.waitForLoadState('networkidle');
    const ov = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    check('dashboard: no horizontal scroll at ' + w + 'px', ov <= 0, 'overflow ' + ov);
  }
  check('no JS errors / CSP violations anywhere', problems.length === 0, problems.slice(0, 4).join(' | '));
  await browser.close(); mock.server.close();
  console.log('\n' + passed + ' passed, ' + failures.length + ' failed');
  if (failures.length) { console.log(' - ' + failures.join('\n - ')); process.exit(1); }
})().catch((e) => { console.error(e); process.exit(1); });
