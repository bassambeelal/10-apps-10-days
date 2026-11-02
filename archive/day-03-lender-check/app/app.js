'use strict';
// Lender Check: fuzzy lookup over a dated copy of the FCCPC register of digital money lenders.

const DATA = window.LENDERS;
const $ = (id) => document.getElementById(id);
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const fetchedOn = new Date(DATA.fetched).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

const STATUS = {
  approved: { label: 'Approved', pill: 'pos', list: 'Approval', say: 'The FCCPC lists this lender as approved.' },
  cbn: { label: 'Licensed by the CBN', pill: 'pos', list: 'Waivers (licensed by the CBN)', say: 'The Central Bank of Nigeria licenses this company, so the FCCPC lists it under waivers.' },
  conditional: { label: 'Conditional approval', pill: 'warn', list: 'Conditional approval', say: 'The FCCPC lists this lender under conditional approval.' },
  watchlist: { label: 'On the watchlist', pill: 'neg', list: 'Watchlist', say: 'The FCCPC has put this app on its watchlist. Be very careful before borrowing.' },
  delisted: { label: 'Delisted', pill: 'neg', list: 'Delisted apps', say: 'The FCCPC has removed this app from its approved list. Do not borrow from it.' },
};
const ORDER = ['approved', 'conditional', 'cbn', 'watchlist', 'delisted'];

// ---------- matching ----------
const STOP = new Set(['APP', 'APPS', 'LTD', 'LIMITED', 'PLC', 'NIGERIA', 'NIG', 'NG', 'THE', 'COMPANY', 'CO', 'INC', 'N', 'A']);
const norm = (s) => String(s).toUpperCase().replace(/&/g, ' AND ').replace(/[^A-Z0-9]+/g, ' ').trim();
const key = (s) => norm(s).split(' ').filter((w) => w && !STOP.has(w)).join('');
const splitApps = (s) => String(s).split(/,|\/|;|\bAND\b|&|\(|\)/i).map((x) => x.trim()).filter((x) => x && !/^N\/?A$/i.test(x));

function lev(a, b) {
  if (Math.abs(a.length - b.length) > 2) return 9;
  const prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let diag = prev[0]; prev[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const t = prev[j];
      prev[j] = Math.min(prev[j] + 1, prev[j - 1] + 1, diag + (a[i - 1] === b[j - 1] ? 0 : 1));
      diag = t;
    }
  }
  return prev[b.length];
}
function score(q, name) {
  const k = key(name);
  if (!k || !q) return 0;
  if (k === q) return 100;
  if (q.length >= 3 && k.startsWith(q)) return 88 - Math.min(10, k.length - q.length);
  if (q.length >= 4 && k.includes(q)) return 72;
  if (q.length >= 5 && q.includes(k) && k.length >= 4) return 66;
  if (q.length >= 4) { const d = lev(q, k); if (d === 1) return 64; if (d === 2 && q.length >= 7) return 54; }
  return 0;
}
const INDEX = DATA.entries.map((e, i) => ({ ...e, i, appList: splitApps(e.apps) }));
function search(raw) {
  const q = key(raw);
  if (!q) return [];
  const hits = [];
  for (const e of INDEX) {
    let best = 0; let via = null;
    for (const a of e.appList) { const s = score(q, a); if (s > best) { best = s; via = a; } }
    const sc = score(q, e.company) - 6;
    if (sc > best) { best = sc; via = null; }
    if (best >= 54) hits.push({ e, s: best, via });
  }
  return hits.sort((a, b) => b.s - a.s || ORDER.indexOf(a.e.status) - ORDER.indexOf(b.e.status));
}

// ---------- rendering ----------
const title = (s) => String(s).toLowerCase().replace(/\b([a-z])/g, (m) => m.toUpperCase()).replace(/\bApp(s)?\b/g, 'app$1');
function highlight(text, raw) {
  const words = norm(raw).split(' ').filter((w) => w.length >= 3 && !STOP.has(w));
  let out = esc(text);
  for (const w of words) out = out.replace(new RegExp(`(${w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'), '<mark>$1</mark>');
  return out;
}
function verdict(h, raw) {
  const st = STATUS[h.e.status];
  const name = h.via || h.e.appList[0] || h.e.company;
  const company = h.e.company ? `Run by <strong>${esc(title(h.e.company.replace(/,\s*$/, '')))}</strong>. ` : '';
  const next = h.e.status === 'approved' || h.e.status === 'cbn' || h.e.status === 'conditional'
    ? `Before you install it, open the app's Play Store page and check that the developer is ${h.e.company ? `<strong>${esc(title(h.e.company.replace(/,\s*$/, '')))}</strong>` : 'the company named here'}. Copycat apps borrow approved names.`
    : 'If you already took a loan from it and it threatens you or messages your contacts, report it to the FCCPC.';
  return `<article class="verdict">
    <div class="head"><span class="pill big ${st.pill}">${st.label}</span>${h.s < 100 ? `<span class="meta">Closest match to "${esc(raw)}"</span>` : ''}</div>
    <h2>${esc(title(name))}</h2>
    <p class="say">${company}${st.say}</p>
    <div class="line"><span class="k">FCCPC register, ${esc(st.list)}:</span> <span class="v">${h.e.company ? `${highlight(h.e.company, raw)} · ` : ''}${highlight(h.e.apps || '–', raw)}${h.e.remark ? ` · ${esc(h.e.remark)}` : ''}</span></div>
    <p class="next">${next}</p>
  </article>`;
}
function notFound(raw) {
  return `<header><h2 id="h-results" class="sr">Result</h2></header>
  <div class="notfound"><span class="pill big">Not on the register</span>
    <h2>${esc(raw)} isn't on the FCCPC's list</h2>
    <p class="say" style="margin-top:6px">No app or company close to that name is on the register copied on ${fetchedOn}. Approved digital lenders are listed there, so treat a loan app that isn't as a warning sign.</p>
    <ul class="steps">
      <li>Check the spelling, or search the company name from the app's Play Store page (under the developer name).</li>
      <li>Don't give an unlisted app access to your contacts, photos or messages.</li>
      <li>The FCCPC adds and removes lenders. Its own page is the final word: <a href="${esc(DATA.source)}" rel="noopener" style="text-decoration:underline">fccpc.gov.ng</a>.</li>
    </ul></div>`;
}
function intro() {
  return `<header><h2 id="h-results">Before you borrow from a loan app</h2></header>
  <ul class="steps" style="margin-top:0">
    <li>Type its name above. You'll see which FCCPC list it's on, and the exact line from the register.</li>
    <li>Then match the company to the developer name on its Play Store page, because fake apps copy approved names.</li>
    <li>Lenders on the watchlist or delisted, and apps not on the register at all, are the ones people report for threats and for messaging their contacts.</li>
  </ul>`;
}

function renderResults(raw) {
  const box = $('results');
  const q = raw.trim();
  if (!q) { box.innerHTML = intro(); return; }
  if (key(q).length < 2) { box.innerHTML = `<header><h2 id="h-results">Keep typing</h2></header><p class="meta">Type at least two letters of the app's name.</p>`; return; }
  const hits = search(q);
  if (!hits.length) { box.innerHTML = notFound(q); return; }
  const top = hits.filter((h) => h.s >= hits[0].s - 12).slice(0, 4);
  const exactStatuses = new Set(hits.filter((h) => h.s === 100).map((h) => h.e.status));
  const clash = exactStatuses.size > 1 && [...exactStatuses].some((s) => s === 'watchlist' || s === 'delisted');
  const warn = clash ? `<div class="warn-box">This name is on more than one FCCPC list. Check the company behind the app you have against each line below.</div>` : '';
  const rest = hits.length - top.length;
  box.innerHTML = `<header><h2 id="h-results" class="sr">Results</h2></header>${warn}<div class="verdicts ${top.length > 1 ? 'multi' : ''}">${top.map((h) => verdict(h, q)).join('')}</div>${rest > 0 ? `<p class="more">${rest} more ${rest === 1 ? 'name is' : 'names are'} similar. Type more of the name to narrow it down.</p>` : ''}`;
}

const generic = (s) => STATUS[s].say.replace('this lender', 'these lenders').replace('this app', 'these apps').replace('this company', 'each company').replace('The Central Bank of Nigeria licenses', 'The Central Bank of Nigeria licenses').replace(' Be very careful before borrowing.', '').replace(' Do not borrow from it.', '');
function renderLists() {
  $('source').innerHTML = `Copied from the <a href="${esc(DATA.source)}" rel="noopener" style="text-decoration:underline">FCCPC's register</a> on ${fetchedOn}. ${DATA.entries.length} lines in all.`;
  $('stamp').textContent = `FCCPC register copied ${fetchedOn}`;
}

let tab = 'approved';
let showAll = false;
function renderBrowse() {
  $('tabs').innerHTML = ORDER.map((s) => `<button type="button" role="tab" aria-selected="${s === tab}" data-tab="${s}">${STATUS[s].label}<span class="n">${DATA.counts[s]}</span></button>`).join('');
  const rows = INDEX.filter((e) => e.status === tab);
  const shown = showAll ? rows : rows.slice(0, 25);
  $('tab-say').innerHTML = `<span class="pill ${STATUS[tab].pill}" style="margin-right:8px">${STATUS[tab].label}</span>${generic(tab)}`;
  const hasCompany = rows.some((e) => e.company);
  $('browse-count').textContent = `${rows.length} ${rows.length === 1 ? 'line' : 'lines'}`;
  $('browse').innerHTML = `<div class="table-wrap"><table class="reg"><thead><tr><th>App(s)</th>${hasCompany ? '<th>Company</th>' : ''}${rows.some((e) => e.remark) ? '<th>Remark</th>' : ''}</tr></thead><tbody>
    ${shown.map((e) => `<tr><td class="apps-cell">${esc(title(e.apps || '–'))}</td>${hasCompany ? `<td>${esc(title(e.company || '–'))}</td>` : ''}${rows.some((x) => x.remark) ? `<td><span class="sub">${esc(e.remark ? title(e.remark) : '–')}</span></td>` : ''}</tr>`).join('')}
  </tbody></table></div>${rows.length > shown.length ? `<button class="btn show-all" type="button" data-all>Show all ${rows.length}</button>` : ''}`;
}

// ---------- events ----------
const input = $('q');
let t;
input.addEventListener('input', () => { clearTimeout(t); t = setTimeout(() => { renderResults(input.value); const u = new URL(location); if (input.value.trim()) u.searchParams.set('q', input.value.trim()); else u.searchParams.delete('q'); history.replaceState(null, '', u); }, 120); });
document.addEventListener('click', (ev) => {
  const tb = ev.target.closest('[data-tab]');
  if (tb) { tab = tb.dataset.tab; showAll = false; renderBrowse(); return; }
  if (ev.target.closest('[data-all]')) { showAll = true; renderBrowse(); return; }
  const tr = ev.target.closest('[data-try]');
  if (tr) { input.value = tr.dataset.try; renderResults(input.value); input.focus(); }
});

const examples = [INDEX.find((e) => e.status === 'approved' && e.appList.length > 1), INDEX.find((e) => e.status === 'watchlist'), INDEX.find((e) => e.status === 'delisted')]
  .filter(Boolean).map((e) => title(e.appList[0] || e.company).replace(/ app$/i, ''));
$('tries').innerHTML = `Try ${examples.map((x, i) => `${i === examples.length - 1 ? 'or ' : ''}<button type="button" data-try="${esc(x)}">${esc(x)}</button>`).join(examples.length > 2 ? ', ' : ' ')}.`;

renderLists();
const initial = new URLSearchParams(location.search).get('q') || '';
input.value = initial;
renderResults(initial);
renderBrowse();
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('sw.js').catch(() => {});
