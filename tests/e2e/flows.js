'use strict';
// Run:  NODE_PATH=$(npm root -g) node tests/e2e/flows.js
const { chromium } = require('playwright');
const { create } = require('./mock-server');

const mock = create();
let passed = 0; const failures = [];
function check(name, cond, extra) {
  if (cond) { passed++; console.log('  ✓ ' + name); } else { failures.push(name); console.log('  ✗ ' + name + (extra ? '  → ' + extra : '')); }
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function until(fn, ms = 6000) { const t = Date.now(); while (Date.now() - t < ms) { if (await fn()) return true; await sleep(100); } return false; }

(async () => {
  await new Promise((r) => mock.server.listen(0, r));
  const base = 'http://localhost:' + mock.server.address().port;
  const browser = await chromium.launch();
  const newPage = async () => { const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } }); const page = await ctx.newPage(); page.errors = []; page.on('pageerror', (e) => page.errors.push(e.message)); return { ctx, page }; };

  /* ---------- A. logged-out visitor ---------- */
  console.log('\nA. Logged-out visitor: public pages, hidden auth');
  let { ctx, page } = await newPage();
  for (const p of ['/index.html', '/templates.html']) {
    await page.goto(base + p);
    await page.waitForLoadState('networkidle');
    const text = (await page.locator('header, main, footer').allInnerTexts()).join(' ').toLowerCase();
    check(p + ' shows no Login / Sign up / Register / Log out', !/(log ?in|sign ?up|sign in|register|log ?out|create account)/.test(text), text.match(/(log ?in|sign ?up|sign in|register|log ?out|create account)/)?.[0]);
  }
  await page.goto(base + '/templates.html');
  check('gallery renders 10 template cards', (await page.locator('.template-card').count()) === 10);
  await page.locator('.template-card[data-template-id="midnight-premium"] [data-action="preview"]').click();
  check('preview works without an account', await page.locator('#preview-modal[open]').count() === 1);
  await page.keyboard.press('Escape');

  /* direct hits on protected files */
  let r = await page.request.get(base + '/builder.html', { maxRedirects: 0 });
  check('GET /builder.html logged out → 302 to /auth.html?next=', r.status() === 302 && /\/auth\.html\?next=%2Fbuilder\.html/.test(r.headers().location || ''), r.status() + ' ' + r.headers().location);
  for (const f of ['/js/builder.js', '/js/pdf-download.js', '/js/vendor/jspdf.umd.min.js', '/js/cloud-sync.js', '/js/admin.js']) {
    r = await page.request.get(base + f, { maxRedirects: 0 });
    check('GET ' + f + ' logged out → 401', r.status() === 401, String(r.status()));
  }
  r = await page.request.get(base + '/BUILDER.HTML', { maxRedirects: 0 });
  check('case trick /BUILDER.HTML still gated', r.status() === 302);
  r = await page.request.get(base + '/api/resumes');
  check('GET /api/resumes logged out → 401', r.status() === 401);
  r = await page.request.get(base + '/api/admin/users');
  check('GET /api/admin/users logged out → 401', r.status() === 401);

  /* ---------- B. Use Template → auth → back to that exact template ---------- */
  console.log('\nB. Use Template while logged out → /auth.html → exact template');
  await page.goto(base + '/templates.html');
  await page.locator('.template-card[data-template-id="midnight-premium"] a[data-template-link]').click();
  await page.waitForURL(/\/auth\.html/);
  const u = new URL(page.url());
  check('lands on /auth.html with ?next= carrying the template', u.pathname === '/auth.html' && u.searchParams.get('next') === '/builder.html?template=midnight-premium', page.url());
  check('sessionStorage keeps the intended template', (await page.evaluate(() => sessionStorage.getItem('luxcv:intended-template'))) === 'midnight-premium');
  check('auth page names the chosen template', /Midnight Premium/.test(await page.locator('#intent').innerText()));
  check('Login tab is shown first, Create Account tab exists', (await page.locator('#tab-login').getAttribute('aria-selected')) === 'true' && (await page.locator('#tab-register').count()) === 1);

  // validation
  await page.locator('#tab-register').click();
  await page.locator('#register-form button[type=submit]').click();
  check('empty registration shows field errors', (await page.locator('#register-form .field__error:not([hidden])').count()) >= 4);
  await page.fill('#register-name', 'Ada Lovelace');
  await page.fill('#register-email', 'ada@example.com');
  await page.fill('#register-password', 'password1');
  await page.fill('#register-confirm', 'password2');
  await page.locator('#register-form button[type=submit]').click();
  check('mismatched confirm → "Passwords do not match."', /do not match/i.test(await page.locator('#register-confirm-error').innerText()));
  await page.fill('#register-password', 'short');
  await page.locator('#register-form button[type=submit]').click();
  check('weak password message', /at least 8/i.test(await page.locator('#register-password-error').innerText()));
  await page.fill('#register-password', 'password1'); await page.fill('#register-confirm', 'password1');
  await page.locator('#register-form button[type=submit]').click();
  await page.waitForURL(/\/builder\.html/);
  check('after registering → builder with the SAME template (?template=midnight-premium)', new URL(page.url()).searchParams.get('template') === 'midnight-premium', page.url());
  await page.waitForSelector('#resume-form .editor-section, #resume-form details, #resume-form fieldset', { timeout: 8000 }).catch(() => {});
  check('builder shows "Midnight Premium"', await until(async () => (await page.locator('[data-selected-template]').textContent()) === 'Midnight Premium'));
  check('builder has NO logout button or link', (await page.locator('button:has-text("Log out"), a:has-text("Log out")').count()) === 0);
  check('builder has a My Account link', (await page.locator('a[href="dashboard.html"]').count()) >= 1);
  check('intent cleared after success', (await page.evaluate(() => sessionStorage.getItem('luxcv:intended-template'))) === null);
  const cookies = await ctx.cookies();
  const c = cookies.find((x) => x.name === 'luxcv_token');
  check('session cookie is httpOnly + SameSite=Lax', !!c && c.httpOnly && c.sameSite === 'Lax');
  check('token not readable from JS (document.cookie / storage)', !/luxcv_token/.test(await page.evaluate(() => document.cookie + JSON.stringify(localStorage) + JSON.stringify(sessionStorage))));

  /* ---------- C. builder saves to the account ---------- */
  console.log('\nC. Builder saves to the account and restores from it');
  await page.fill('#f-personal-fullName', 'Ada Lovelace');
  await page.fill('#f-personal-email', 'ada@example.com');
  const saved = await until(() => mock.resumes.some((x) => x.data?.personal?.fullName === 'Ada Lovelace'));
  check('autosave reached the server (POST /api/resumes)', saved);
  check('resume stored with owner + template', mock.resumes[0]?.templateId === 'midnight-premium' && mock.resumes[0].owner === mock.users.find((x) => x.email === 'ada@example.com').id);
  check('save status mentions the account', /saved to your account/i.test(await page.locator('[data-save-status]').innerText()));
  // wipe the browser cache; the server copy must come back
  await page.evaluate(() => { Object.keys(localStorage).filter((k) => k.startsWith('luxcv:u:')).forEach((k) => localStorage.removeItem(k)); });
  await page.goto(base + '/builder.html?template=executive-gold');
  await page.waitForSelector('#f-personal-fullName', { timeout: 8000 });
  check('after clearing local cache, name is restored from the server', (await page.inputValue('#f-personal-fullName')) === 'Ada Lovelace');
  check('picking another template applies it to the saved content', await until(async () => (await page.locator('[data-selected-template]').textContent()) === 'Executive Gold'));
  await page.fill('#f-personal-fullName', 'Ada King');
  check('edit updates the SAME server resume (PUT, no duplicate)', await until(() => mock.resumes.length === 1 && mock.resumes[0].data.personal.fullName === 'Ada King' && mock.resumes[0].templateId === 'executive-gold'));

  /* PDF export re-checks session */
  const before = mock.log.filter((l) => l === 'GET /api/auth/me').length;
  await page.fill('#f-personal-email', 'ada@example.com');
  await page.locator('[data-action="download-pdf"]').click();
  await until(() => mock.log.filter((l) => l === 'GET /api/auth/me').length > before);
  check('Download PDF re-verifies the session with the server first', mock.log.filter((l) => l === 'GET /api/auth/me').length > before);

  /* ---------- D. dashboard + logout ---------- */
  console.log('\nD. Dashboard, logout');
  await page.goto(base + '/dashboard.html');
  await page.waitForSelector('.resume-row');
  check('dashboard lists the saved resume', (await page.locator('.resume-row').count()) === 1);
  check('dashboard has Log out', (await page.locator('[data-action="logout"]').count()) >= 1);
  check('no admin link for a normal user', await page.locator('[data-admin-link]').isHidden());
  await page.locator('.resume-row a:has-text("Open")').click();
  await page.waitForURL(/builder\.html\?template=executive-gold&resume=/);
  check('Open from dashboard loads that resume in the builder', await until(async () => (await page.inputValue('#f-personal-fullName').catch(() => '')) === 'Ada King'));
  await page.goto(base + '/dashboard.html');
  await page.locator('header [data-action="logout"]').click();
  await page.waitForURL(/\/index\.html$|\/$/);
  check('logout returns to the public home page', true);
  check('logout cleared the session on the server', mock.sessions.size === 0 || ![...mock.sessions.values()].includes(mock.users.find((x) => x.email === 'ada@example.com').id));
  check('logout removed the cached draft from the browser', (await page.evaluate(() => Object.keys(localStorage).filter((k) => /^luxcv:u:.*:(resume|cloud)$/.test(k)).length)) === 0);
  r = await page.request.get(base + '/builder.html', { maxRedirects: 0 });
  check('builder is gated again after logout', r.status() === 302);
  r = await page.request.get(base + '/api/resumes');
  check('API is 401 again after logout', r.status() === 401);
  await page.goto(base + '/index.html');
  check('public home still shows no logout/login', !/log ?out|log ?in|sign ?up/i.test(await page.locator('body').innerText()));
  await ctx.close();

  /* ---------- E. logged-in click skips auth; login errors; open redirect ---------- */
  console.log('\nE. Logged-in Use Template, login errors, open-redirect');
  ({ ctx, page } = await newPage());
  await page.goto(base + '/auth.html');
  await page.fill('#login-email', 'ada@example.com'); await page.fill('#login-password', 'wrongpass1');
  await page.locator('#login-form button[type=submit]').click();
  check('wrong password → "Incorrect email or password."', await page.locator('#login-alert:not([hidden])').innerText().then((t) => /incorrect email or password/i.test(t)));
  await page.fill('#login-email', 'nobody@example.com');
  await page.locator('#login-form button[type=submit]').click();
  check('unknown email gives the same message (no account enumeration)', await until(async () => /incorrect email or password/i.test(await page.locator('#login-alert').innerText())));
  await page.fill('#login-email', 'bad-email'); await page.locator('#login-form button[type=submit]').click();
  check('malformed email caught client-side', /valid email/i.test(await page.locator('#login-email-error').innerText()));
  await page.locator('[data-switch="register"]').click();
  check('link switches to the register tab', (await page.locator('#tab-register').getAttribute('aria-selected')) === 'true');
  await page.fill('#register-name', 'Dup'); await page.fill('#register-email', 'ada@example.com'); await page.fill('#register-password', 'password1'); await page.fill('#register-confirm', 'password1');
  await page.locator('#register-form button[type=submit]').click();
  check('duplicate email → helpful error', await page.locator('#register-alert:not([hidden])').innerText().then((t) => /already exists/i.test(t)));

  await page.goto(base + '/auth.html?next=' + encodeURIComponent('https://evil.example/phish'));
  await page.fill('#login-email', 'ada@example.com'); await page.fill('#login-password', 'password1');
  await page.locator('#login-form button[type=submit]').click();
  await page.waitForURL(/\/dashboard\.html/);
  check('?next=https://evil… is ignored → dashboard (no open redirect)', new URL(page.url()).origin === base);
  for (const bad of ['//evil.example', '/\\evil.example', 'javascript:alert(1)']) {
    const safe = await page.evaluate((b) => window.LuxCV.Auth && window.LuxCV.Auth.safeNext ? window.LuxCV.Auth.safeNext(b) : 'n/a', bad);
    if (safe === 'n/a') { await page.goto(base + '/auth.html'); }
  }
  await page.goto(base + '/auth.html');
  await page.waitForURL(/\/dashboard\.html/);
  check('visiting /auth.html while signed in skips the form', true);
  const unsafe = await page.evaluate(() => ['//evil.example', '/\\evil.example', 'javascript:alert(1)', 'https://evil.example', '/auth.html'].map((b) => LuxCV.Auth.safeNext(b)));
  check('safeNext rejects //host, backslash, javascript:, absolute, /auth.html loops', unsafe.every((x) => x === ''), JSON.stringify(unsafe));

  await page.goto(base + '/templates.html');
  const reqsBefore = mock.log.length;
  await page.locator('.template-card[data-template-id="tech-specialist"] a[data-template-link]').click();
  await page.waitForURL(/\/builder\.html/);
  check('logged-in Use Template → builder directly with that template', new URL(page.url()).searchParams.get('template') === 'tech-specialist' && !mock.log.slice(reqsBefore).some((l) => l.includes('auth.html')));
  r = await page.request.get(base + '/admin.html', { maxRedirects: 0 });
  check('normal user GET /admin.html → redirected away', r.status() === 302 && /dashboard/.test(r.headers().location));
  r = await page.request.get(base + '/js/admin.js', { maxRedirects: 0 });
  check('normal user GET /js/admin.js → 403', r.status() === 403);
  r = await page.request.get(base + '/api/admin/users');
  check('normal user GET /api/admin/users → 403', r.status() === 403);
  r = await page.request.post(base + '/api/resumes', { data: { templateId: 'x', data: {} } });
  check('POST without CSRF header → 403', r.status() === 403);
  await ctx.close();

  /* ---------- F. admin ---------- */
  console.log('\nF. Admin dashboard');
  mock.addUser('Bob Builder', 'bob@example.com', 'password1', 'user');
  const bob = mock.users.find((x) => x.email === 'bob@example.com');
  mock.resumes.push({ id: 'rbob', owner: bob.id, title: 'Bob - resume', templateId: 'compact-ats', data: { personal: { fullName: 'Bob' } }, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
  const bobCtx = await browser.newContext(); const bobPage = await bobCtx.newPage();
  await bobPage.goto(base + '/auth.html'); await bobPage.fill('#login-email', 'bob@example.com'); await bobPage.fill('#login-password', 'password1');
  await bobPage.locator('#login-form button[type=submit]').click(); await bobPage.waitForURL(/dashboard/);

  ({ ctx, page } = await newPage());
  await page.goto(base + '/auth.html'); await page.fill('#login-email', 'admin@luxcv.test'); await page.fill('#login-password', 'Admin12345');
  await page.locator('#login-form button[type=submit]').click();
  await page.waitForURL(/\/admin\.html/);
  check('admin login (no ?next) lands on /admin.html', true);
  await page.waitForSelector('#users-body tr td.cell-name');
  const rows = await page.locator('#users-body tr').count();
  check('users table lists all users (username, email, created, status)', rows === mock.users.length && (await page.locator('#users-body').innerText()).includes('bob@example.com'));
  check('stat cards filled', (await page.locator('[data-stat="total"]').innerText()) === String(mock.users.length));
  check('admin page has its own logout', (await page.locator('[data-action="logout"]').count()) >= 1);
  const adminRow = page.locator('#users-body tr', { hasText: 'admin@luxcv.test' });
  check('own row has no deactivate/delete buttons', (await adminRow.locator('button').count()) === 0);

  const bobRow = page.locator('#users-body tr', { hasText: 'bob@example.com' });
  await bobRow.locator('button:has-text("Deactivate")').click();
  check('Deactivate → server flag false', await until(() => bob.isActive === false));
  await page.waitForSelector('#users-body tr:has-text("bob@example.com") .badge--inactive');
  check('row shows Inactive + Activate button', await bobRow.locator('button:has-text("Activate")').count() === 1);
  r = await bobPage.request.get(base + '/api/auth/me');
  check('deactivated user is locked out on their very next request (401)', r.status() === 401);
  const bobLogin = await (async () => { const c2 = await browser.newContext(); const p2 = await c2.newPage(); await p2.goto(base + '/auth.html'); await p2.fill('#login-email', 'bob@example.com'); await p2.fill('#login-password', 'password1'); await p2.locator('#login-form button[type=submit]').click(); const t = await p2.locator('#login-alert:not([hidden])').innerText(); await c2.close(); return t; })();
  check('deactivated user trying to log in sees a clear message', /deactivated/i.test(bobLogin), bobLogin);
  await bobRow.locator('button:has-text("Activate")').click();
  check('Activate → flag true again', await until(() => bob.isActive === true));

  await page.fill('#filter-q', 'bob'); await page.locator('#filter-form button[type=submit]').click();
  check('search filters the table', await until(async () => (await page.locator('#users-body tr').count()) === 1));

  await page.locator('#users-body tr', { hasText: 'bob@example.com' }).locator('button:has-text("Delete")').click();
  check('delete asks for confirmation naming the cascade', /all of their saved resumes/i.test(await page.locator('#admin-confirm-text').innerText()));
  await page.locator('#admin-confirm-ok').click();
  check('Delete → user removed AND their resumes cascade-deleted', await until(() => !mock.users.some((x) => x.id === bob.id) && !mock.resumes.some((x) => x.owner === bob.id)));
  await ctx.close(); await bobCtx.close();

  /* ---------- H. offline edits are not lost ---------- */
  console.log('\nH. Edits made offline are delivered later');
  ({ ctx, page } = await newPage());
  await page.goto(base + '/auth.html'); await page.fill('#login-email', 'ada@example.com'); await page.fill('#login-password', 'password1');
  await page.locator('#login-form button[type=submit]').click(); await page.waitForURL(/dashboard/);
  await page.goto(base + '/builder.html?template=executive-gold');
  await page.waitForSelector('#f-personal-fullName');
  await until(async () => (await page.inputValue('#f-personal-fullName')) === 'Ada King');
  await ctx.setOffline(true);
  await page.fill('#f-personal-fullName', 'Ada Offline');
  await sleep(2500);
  check('while offline the server copy is unchanged', mock.resumes.find((x) => x.data.personal) && mock.resumes.find((x) => x.data.personal).data.personal.fullName === 'Ada King');
  check('status says not synced', /not synced/i.test(await page.locator('[data-save-status]').innerText()));
  await ctx.setOffline(false);
  await page.reload();
  await page.waitForSelector('#f-personal-fullName');
  check('after reconnecting + reload the offline edit is kept (not overwritten by the older server copy)', await until(async () => (await page.inputValue('#f-personal-fullName')) === 'Ada Offline'));
  check('and it is delivered to the server', await until(() => mock.resumes.some((x) => x.data.personal && x.data.personal.fullName === 'Ada Offline')));
  await ctx.close();

  /* ---------- G. responsive + JS errors ---------- */
  console.log('\nG. Responsive and console errors');
  ({ ctx, page } = await newPage());
  for (const w of [320, 375, 768, 1280]) {
    await page.setViewportSize({ width: w, height: 800 });
    await page.goto(base + '/auth.html');
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    check('auth.html has no horizontal scroll at ' + w + 'px', overflow <= 0, 'overflow ' + overflow);
  }
  await page.goto(base + '/index.html'); await page.goto(base + '/templates.html'); await page.goto(base + '/auth.html');
  check('no uncaught JS errors on public pages', page.errors.length === 0, page.errors.join('; '));
  await ctx.close();

  await browser.close(); mock.server.close();
  console.log('\n' + passed + ' passed, ' + failures.length + ' failed');
  if (failures.length) { console.log('FAILED:\n - ' + failures.join('\n - ')); process.exit(1); }
})().catch((e) => { console.error(e); process.exit(1); });
