// Browser test: drops the made-up export into the app, fixes it to a ZIP, and saves the result. Then does the
// same with a larger made-up export (143 memories) from demo-video/fixtures/make-memories.py.
// Run (with day-09-memories-fixer/app served on :8791): node day-09-memories-fixer/test/e2e.mjs OUT_DIR
import { createRequire } from 'node:module';
import path from 'node:path';
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const here = path.dirname(new URL(import.meta.url).pathname);
const out = process.argv[2];
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true, timezoneId: 'America/Los_Angeles' });
const p = await ctx.newPage();
const errors = [];
p.on('pageerror', (e) => errors.push(e.message));
await p.goto('http://127.0.0.1:8791/');
await p.setInputFiles('#pick', [path.join(here, 'fixtures/mydata~1730550000000.zip'), path.join(here, 'fixtures/mydata~1730550000000-2.zip')]);
await p.waitForSelector('[data-fix]');
await p.selectOption('#zone', 'Europe/Berlin');
await p.waitForSelector('[data-fix]');
const preview = await p.$$eval('.preview tbody tr', (rows) => rows.map((r) => r.innerText.replace(/\s+/g, ' ').trim()));
console.log('preview:\n  ' + preview.join('\n  '));
await p.screenshot({ path: out + '/summary.png', fullPage: true });
const folder = await p.$('#to-folder');
if (folder) await folder.uncheck();
await p.click('[data-fix]');
await p.waitForSelector('a[download]', { timeout: 30000 });
await p.screenshot({ path: out + '/done.png', fullPage: true });
const [dl] = await Promise.all([p.waitForEvent('download'), p.click('a[download]')]);
await dl.saveAs(out + '/memories-fixed.zip');

// A larger export, whose ZIPs arrive in several reads: the first streaming build stopped for good on these.
const big = path.join(out, 'big');
const made = spawnSync('python3', [path.join(here, '../../demo-video/fixtures/make-memories.py'), big], { encoding: 'utf8' });
if (made.status) throw new Error(made.stderr);
await p.goto('http://127.0.0.1:8791/');
await p.setInputFiles('#pick', fs.readdirSync(big).filter((f) => f.endsWith('.zip')).sort().map((f) => path.join(big, f)));
await p.waitForSelector('[data-fix]');
const bigFolder = await p.$('#to-folder');
if (bigFolder) await bigFolder.uncheck();
await p.click('[data-fix]');
await p.waitForSelector('a[download]', { timeout: 30000 });
const doneText = (await p.innerText('#work')).replace(/\s+/g, ' ');
console.log('large export:', doneText.match(/\d+ photos dated \d+ videos dated \d+ captions merged/)[0]);
const [bigDl] = await Promise.all([p.waitForEvent('download'), p.click('a[download]')]);
await bigDl.saveAs(out + '/big-fixed.zip');
console.log(errors.length ? 'page errors: ' + errors.join(' / ') : 'no page errors');
await b.close();
