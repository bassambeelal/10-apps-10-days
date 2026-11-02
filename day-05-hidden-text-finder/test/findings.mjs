// Browser test: feeds the samples and fixtures through the app and checks what each reader finds.
// Run: node day-05-hidden-text-finder/test/findings.mjs   (serve day-05-hidden-text-finder/app on :8741 first)
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const here = path.dirname(new URL(import.meta.url).pathname);
const files = [
  ['../app/samples/maya-lindqvist-cv.pdf', 'application/pdf'],
  ['../app/samples/tomas-reyes-cv.pdf', 'application/pdf'],
  ['../app/samples/priya-raman-cv.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
  ['fixtures/kofi-mensah-cv.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
  ['fixtures/locked.pdf', 'application/pdf'],
  ['fixtures/scanned.pdf', 'application/pdf'],
  ['fixtures/not-a-cv.pdf', 'application/pdf'],
  ['fixtures/designed-cv.pdf', 'application/pdf'],
  ['fixtures/designed-cv.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
];
const b = await chromium.launch();
const p = await b.newPage();
const errors = [];
p.on('pageerror', (e) => errors.push(e.message));
p.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
await p.goto('http://127.0.0.1:8741/');
const payload = files.map(([f, type]) => ({ name: path.basename(f), type, b64: fs.readFileSync(path.join(here, f)).toString('base64') }));
await p.evaluate((list) => {
  const fl = list.map((x) => new File([Uint8Array.from(atob(x.b64), (c) => c.charCodeAt(0))], x.name, { type: x.type }));
  window.__htf.addFiles(fl);
}, payload);
await p.waitForFunction(() => window.__htf.files.every((f) => f.status === 'done' || f.status === 'error'), null, { timeout: 60000 });
const out = await p.evaluate(() => window.__htf.files.map((f) => ({ name: f.name, status: f.status, summary: f.summary && f.summary.title, error: f.result && f.result.error, findings: (f.result.findings || []).map((x) => x.kind + (x.ai ? '+AI' : '') + (x.keywords ? '+KW' : '') + ' | ' + x.text.slice(0, 70)) })));
let failed = 0;
const expect = (cond, msg) => { if (!cond) { failed++; console.log('  FAIL ' + msg); } };
for (const f of out) {
  console.log(f.name + ': ' + (f.error || f.summary));
  f.findings.forEach((x) => console.log('   ' + x));
}
const by = Object.fromEntries(out.map((f) => [f.name, f]));
const kinds = (n) => by[n].findings.map((x) => x.split(' | ')[0]);
expect(kinds('maya-lindqvist-cv.pdf').some((k) => k.startsWith('invisible+AI')), 'Maya: white AI instruction found');
expect(kinds('maya-lindqvist-cv.pdf').some((k) => k.startsWith('tiny')), 'Maya: tiny keyword list found');
expect(kinds('maya-lindqvist-cv.pdf').some((k) => k.startsWith('offpage+AI')), 'Maya: off-page text found');
expect(by['maya-lindqvist-cv.pdf'].findings.some((x) => x.includes('ChatGPT')), 'Maya: invisible render-mode text found');
expect(by['maya-lindqvist-cv.pdf'].findings.some((x) => x.includes('Ten years at Google')), 'Maya: text under a white box found');
expect(kinds('maya-lindqvist-cv.pdf').some((k) => k.startsWith('properties+AI')), 'Maya: instruction in the subject field found');
expect(by['tomas-reyes-cv.pdf'].findings.length === 0, 'Tomás: clean, grey footer and 7 pt footnote not flagged');
expect(kinds('priya-raman-cv.docx').some((k) => k.startsWith('vanish+AI')), 'Priya: Word Hidden text found');
expect(kinds('priya-raman-cv.docx').some((k) => k.startsWith('invisible')), 'Priya: white text found');
expect(kinds('priya-raman-cv.docx').some((k) => k.startsWith('tiny')), 'Priya: 1 pt text found');
expect(kinds('priya-raman-cv.docx').some((k) => k.startsWith('properties+AI')), 'Priya: keywords property instruction found');
expect(by['kofi-mensah-cv.docx'].findings.length === 0, 'Kofi: clean Word file, grey note not flagged');
expect(/password/.test(by['locked.pdf'].error || ''), 'Locked PDF explained');
expect(/No text/.test(by['scanned.pdf'].summary || ''), 'Scanned PDF explained');
expect(/isn’t a PDF/.test(by['not-a-cv.pdf'].error || ''), 'Fake PDF explained');
expect(by['designed-cv.pdf'].findings.length === 0, 'Designed PDF: white text on a dark band not flagged');
expect(by['designed-cv.docx'].findings.length === 0, 'Designed Word file: white text on a shaded paragraph not flagged');
expect(!errors.length, 'no page errors: ' + errors.join(' / '));
console.log(failed ? failed + ' check(s) failed' : 'all checks passed');
await b.close();
process.exit(failed ? 1 : 0);
