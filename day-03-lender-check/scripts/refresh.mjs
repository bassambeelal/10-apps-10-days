#!/usr/bin/env node
// Refreshes app/data/lenders.js from the FCCPC's public register of digital money lenders.
// It is written as a script (window.LENDERS = ...) so the app also works when opened straight from a file.
// Usage: node scripts/refresh.mjs        (Node 18 or newer, no dependencies)
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SOURCE = 'https://fccpc.gov.ng/registration-of-digital-money-lenders/approvals-of-dmls/';
const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'app', 'data', 'lenders.js');

// Section headings on the page, mapped to the status the app shows.
const SECTIONS = [
  { match: /^approval$/i, status: 'approved' },
  { match: /conditional/i, status: 'conditional' },
  { match: /watch\s*list/i, status: 'watchlist' },
  { match: /delisted/i, status: 'delisted' },
  { match: /waiver|licensed by cbn/i, status: 'cbn' },
];

const decode = (s) => s
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&#8217;|&rsquo;/g, "'").replace(/&#8211;|&ndash;/g, '-')
  .replace(/&quot;/g, '"').replace(/&#0?39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>')
  .replace(/\s+/g, ' ').trim();

const res = await fetch(SOURCE, { headers: { 'user-agent': 'LenderCheck/1.0 (+https://github.com)' } });
if (!res.ok) throw new Error(`FCCPC page returned HTTP ${res.status}`);
const html = await res.text();

const tokens = [...html.matchAll(/<h[1-6][^>]*>([\s\S]*?)<\/h[1-6]>|<table[\s\S]*?<\/table>/gi)];
let current = null;
const seen = new Set();
const entries = [];
for (const t of tokens) {
  if (t[1] !== undefined) {
    const text = decode(t[1]);
    const s = SECTIONS.find((x) => x.match.test(text));
    if (s) current = s.status;
    continue;
  }
  if (!current) continue;
  const rows = [...t[0].matchAll(/<tr[\s\S]*?<\/tr>/gi)].map((r) => [...r[0].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)].map((c) => decode(c[1])));
  const head = (rows.shift() || []).map((h) => h.toUpperCase());
  const col = (name) => head.findIndex((h) => h.includes(name));
  const ci = col('COMPANY'), ai = col('APP'), ri = col('REMARK');
  const key = current + JSON.stringify(rows.slice(0, 3)) + rows.length;
  if (seen.has(key)) continue; // the page repeats each table
  seen.add(key);
  for (const r of rows) {
    const company = ci >= 0 ? r[ci] || '' : '';
    const apps = ai >= 0 ? r[ai] || '' : '';
    if (!company && !apps) continue;
    if (/^NAME OF/i.test(apps) || /^NAME OF/i.test(company)) continue; // the table footer repeats the header
    entries.push({ status: current, company, apps, remark: ri >= 0 ? r[ri] || '' : '' });
  }
}

const counts = Object.fromEntries(SECTIONS.map((s) => [s.status, entries.filter((e) => e.status === s.status).length]));
if (entries.length < 100) throw new Error(`Only ${entries.length} entries found. The page layout may have changed; nothing was written.`);
mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, `// FCCPC register of digital money lenders, copied by scripts/refresh.mjs. Do not edit by hand.\nwindow.LENDERS = ${JSON.stringify({ source: SOURCE, fetched: new Date().toISOString(), counts, entries })};\n`);
console.log(`Wrote ${entries.length} entries to ${OUT}`);
console.log(counts);
