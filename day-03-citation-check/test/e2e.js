// Browser test: runs the sample list through the app, with Crossref and OpenAlex answered from
// fixtures in their documented response shapes (this test machine can't reach the live services).
// Run (with day-03-citation-check/app served on :8733): node day-03-citation-check/test/e2e.js OUT_DIR
const { chromium } = require('playwright');
const F = require('./fixtures.js');
const OUT = process.argv[2];
async function mock(ctx, log) {
  await ctx.route('https://api.crossref.org/**', (route) => {
    const u = new URL(route.request().url());
    log.push('crossref ' + u.pathname + (u.search ? '?' + (u.searchParams.get('query.bibliographic') || '').slice(0, 30) : ''));
    const m = u.pathname.match(/^\/works\/(.+)$/);
    if (m) {
      const item = F.works[decodeURIComponent(m[1]).toLowerCase()];
      return item ? route.fulfill({ json: { status: 'ok', 'message-type': 'work', message: item } }) : route.fulfill({ status: 404, body: 'Resource not found.' });
    }
    const q = u.searchParams.get('query.bibliographic') || '';
    const items = F.search.find(([re]) => re.test(q))[1];
    return route.fulfill({ json: { status: 'ok', 'message-type': 'work-list', message: { items, 'total-results': items.length } } });
  });
  await ctx.route('https://api.openalex.org/**', (route) => {
    const u = new URL(route.request().url());
    log.push('openalex ' + u.pathname);
    if (/^\/works\/doi:/.test(u.pathname)) return route.fulfill({ status: 404, json: { error: 'Not found' } });
    const q = u.searchParams.get('search') || '';
    const results = F.openalex.find(([re]) => re.test(q))[1];
    return route.fulfill({ json: { meta: { count: results.length }, results } });
  });
}
(async () => {
  const b = await chromium.launch();
  const log = [], errors = [];
  for (const [w, hgt, tag, scheme] of [[1440, 900, 'desktop', 'light'], [390, 844, 'phone', 'light'], [1440, 900, 'dark', 'dark']]) {
    const ctx = await b.newContext({ viewport: { width: w, height: hgt }, colorScheme: scheme, isMobile: w < 700, hasTouch: w < 700 });
    await mock(ctx, log);
    const p = await ctx.newPage();
    p.on('pageerror', (e) => errors.push(tag + ': ' + e.message));
    await p.goto('http://127.0.0.1:8733/');
    await p.waitForTimeout(300);
    await p.screenshot({ path: `${OUT}/${tag}-start.png`, fullPage: true });
    await p.click('button:has-text("Try a sample list")');
    console.log(tag, 'count:', await p.textContent('.paste-foot .count'));
    await p.click('.paste-foot .btn-primary');
    await p.waitForFunction(() => !document.querySelector('.spinner'), null, { timeout: 30000 });
    await p.waitForTimeout(400);
    await p.screenshot({ path: `${OUT}/${tag}-results.png`, fullPage: true });
    if (tag === 'desktop') {
      const res = await p.$$eval('.ref', (els) => els.map((e) => e.querySelector('.pill') ? e.querySelector('.pill').textContent : '?'));
      console.log('results:', res.join(' | '));
      console.log('verdict:', await p.textContent('#verdict'), '|', await p.textContent('#subline'));
      await p.click('.filters button:has-text("Problems")');
      await p.waitForTimeout(200);
      console.log('problems view:', await p.locator('.ref').count());
      await p.screenshot({ path: `${OUT}/${tag}-problems.png`, fullPage: true });
    }
    await ctx.close();
  }
  // offline: no answers at all
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
  await ctx.route('https://api.crossref.org/**', (r) => r.abort('internetdisconnected'));
  await ctx.route('https://api.openalex.org/**', (r) => r.abort('internetdisconnected'));
  const p = await ctx.newPage();
  await p.goto('http://127.0.0.1:8733/');
  await p.fill('#refs', 'LeCun, Y., Bengio, Y., & Hinton, G. (2015). Deep learning. Nature, 521, 436.');
  await p.click('.paste-foot .btn-primary');
  await p.waitForFunction(() => !document.querySelector('.spinner'), null, { timeout: 30000 });
  console.log('offline:', await p.textContent('.ref .pill'));
  await b.close();
  console.log(errors.length ? errors.join('\n') : 'no page errors');
})();
