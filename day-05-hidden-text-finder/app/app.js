// Hidden Text Finder: the interface. Files are read in this tab and kept only in memory: nothing is
// uploaded, and nothing is saved. Text from a file is always set as text, never as HTML.
import { analyzePdf, loadPdf, renderPage, closePdf } from './detect-pdf.js';
import { analyzeDocx } from './detect-docx.js';
import { KINDS, summarize } from './phrases.js';
import { ICONS } from './icons.js';

const $side = document.getElementById('side');
const $top = document.getElementById('top');
const $main = document.getElementById('main');
const $menu = document.getElementById('menu');
const $veil = document.getElementById('veil');
const $toasts = document.getElementById('toasts');
const $picker = document.getElementById('picker');

// ---------- helpers ----------
function h(tag, attrs, ...kids) {
  const el = document.createElement(tag);
  if (attrs) for (const k in attrs) {
    const v = attrs[k];
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k === 'style') el.style.cssText = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  const put = (k) => { if (k == null || k === false) return; if (Array.isArray(k)) k.forEach(put); else el.append(k.nodeType ? k : String(k)); };
  kids.forEach(put);
  return el;
}
function fill(el, ...kids) { el.replaceChildren(); kids.flat(Infinity).forEach((k) => { if (k != null && k !== false) el.append(k.nodeType ? k : String(k)); }); return el; }
function icon(name, cls) {
  const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  s.setAttribute('viewBox', '0 0 24 24');
  s.setAttribute('class', 'i' + (cls ? ' ' + cls : ''));
  s.setAttribute('aria-hidden', 'true');
  s.innerHTML = ICONS[name] || ICONS.file; // bundled shapes only
  return s;
}
function mark() {
  const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  s.setAttribute('viewBox', '0 0 24 24');
  s.setAttribute('aria-hidden', 'true');
  s.innerHTML = '<rect x="4" y="2.5" width="16" height="19" rx="2.5" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M8 8h8M8 16h5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M8 12h8" stroke="#1b6c80" stroke-width="2.4" stroke-linecap="round" stroke-dasharray="2.2 2.2"/>';
  return s;
}
const plural = (n, one, many) => n + ' ' + (n === 1 ? one : many || one + 's');
const kb = (b) => (b < 1024 * 1024 ? Math.max(1, Math.round(b / 1024)) + ' KB' : (b / 1024 / 1024).toFixed(1) + ' MB');
const KIND_ICON = { invisible: 'invisible', faint: 'faint', tiny: 'tiny', offpage: 'offpage', vanish: 'vanish', deleted: 'deleted', properties: 'props', alttext: 'alt', annotation: 'note', comment: 'comment', visibleai: 'bot' };

// ---------- state ----------
const files = [];
let seq = 0;
let busy = false;
const ui = { reveal: true, tab: 'pages', doc: null, docId: null, lastKey: '' };

function route() {
  const m = location.hash.match(/^#\/f\/([a-z0-9]+)/);
  return m ? { name: 'file', id: m[1] } : { name: 'home' };
}
const byId = (id) => files.find((f) => f.id === id);

// ---------- reading files ----------
const MAX = 40 * 1024 * 1024;
function addFiles(list) {
  const arr = Array.from(list || []);
  if (!arr.length) return;
  let added = 0;
  for (const file of arr.slice(0, 100)) {
    const ext = (file.name.match(/\.([a-z0-9]+)$/i) || [])[1];
    const entry = { id: 'x' + (++seq), name: file.name, size: file.size, ext: (ext || '').toLowerCase(), file, status: 'queued', progress: null, result: null, summary: null };
    if (file.size > MAX) { entry.status = 'error'; entry.result = { error: 'This file is over 40 MB. CVs are rarely over 5 MB, so this may be the wrong file.' }; }
    files.push(entry);
    added++;
  }
  if (arr.length > 100) toast('Only the first 100 files were added.');
  render();
  processQueue();
  return added;
}

async function readOne(entry) {
  const buf = await entry.file.arrayBuffer();
  entry.buf = buf;
  const head = new Uint8Array(buf.slice(0, 5));
  const isPdf = head[0] === 0x25 && head[1] === 0x50 && head[2] === 0x44 && head[3] === 0x46; // %PDF
  const isZip = head[0] === 0x50 && head[1] === 0x4b; // PK
  if (entry.ext === 'doc' && !isZip) return { error: 'Old .doc files can’t be read here. Open it in Word and save it as .docx or PDF, then drop that in.' };
  if (isPdf || (entry.ext === 'pdf' && !isZip)) {
    if (!isPdf) return { error: 'This file is called .pdf but isn’t a PDF inside. It may be damaged, or another kind of file renamed.' };
    return analyzePdf(buf, (p, n) => { entry.progress = [p, n]; renderLater(); });
  }
  if (isZip && (entry.ext === 'docx' || entry.ext === 'doc' || entry.ext === '')) return analyzeDocx(buf);
  if (isZip) return { error: 'This is a zip file, not a Word document. Only PDF and .docx files can be checked.' };
  return { error: 'Only PDF and Word (.docx) files can be checked. This one is ' + (entry.ext ? '.' + entry.ext : 'an unknown type') + '.' };
}

async function processQueue() {
  if (busy) return;
  busy = true;
  let next;
  while ((next = files.find((f) => f.status === 'queued'))) {
    next.status = 'reading';
    renderLater();
    try {
      next.result = await readOne(next);
    } catch (e) {
      next.result = { error: (e && e.message) || 'This file couldn’t be read.' };
    }
    next.status = next.result.error ? 'error' : 'done';
    next.summary = summarize(next.result);
    renderLater();
  }
  busy = false;
  renderLater();
}

let raf = 0;
function renderLater() { if (!raf) raf = requestAnimationFrame(() => { raf = 0; render(true); }); }

// ---------- render ----------
function render(soft) {
  const r = route();
  const key = r.name + (r.id || '');
  const changed = key !== ui.lastKey;
  ui.lastKey = key;
  if (changed && r.name === 'file') ui.tab = 'pages';
  renderSide(r);
  renderTop(r);
  if (r.name === 'file') {
    const f = byId(r.id);
    if (!f) { location.replace('#/'); return; }
    // A soft refresh of the file view only happens when that file finishes reading.
    if (soft && !changed && $main.dataset.view === 'file-' + f.id + '-' + f.status) return;
    $main.dataset.view = 'file-' + f.id + '-' + f.status;
    fill($main, fileView(f));
  } else {
    $main.dataset.view = files.length ? 'list' : 'start';
    fill($main, files.length ? listView() : startView());
  }
  if (changed) { window.scrollTo(0, 0); $main.focus({ preventScroll: true }); }
  document.title = r.name === 'file' && byId(r.id) ? byId(r.id).name + ' · Hidden Text Finder' : 'Hidden Text Finder';
}

function statusText(f) {
  if (f.status === 'queued') return 'Waiting';
  if (f.status === 'reading') return f.progress ? 'Reading page ' + f.progress[0] + ' of ' + f.progress[1] : 'Reading';
  return f.summary ? f.summary.short : '';
}
function tone(f) { return f.status === 'done' || f.status === 'error' ? (f.summary ? f.summary.tone : 'error') : 'busy'; }

function fileLinks(r) {
  return h('nav', { class: 'file-nav', 'aria-label': 'Checked files' }, files.map((f) =>
    h('a', { class: 'file-link', href: '#/f/' + f.id, 'aria-current': r.name === 'file' && r.id === f.id ? 'page' : null, onclick: () => { if ($menu.open) $menu.close(); } },
      h('span', { class: 'dot ' + tone(f), 'aria-hidden': 'true' }),
      h('span', { style: 'min-width:0' }, h('span', { class: 'nm', style: 'display:block' }, f.name), h('span', { class: 'st', style: 'display:block' }, statusText(f))))));
}
function sideContents(r) {
  return [
    h('a', { class: 'brand', href: '#/', onclick: () => { if ($menu.open) $menu.close(); } }, mark(), 'Hidden Text Finder'),
    h('button', { class: 'btn btn-ghost side-add', type: 'button', onclick: () => $picker.click() }, icon('plus'), 'Add files'),
    files.length ? h('div', { class: 'side-label' }, h('span', null, 'Files'), h('span', { class: 'num' }, String(files.length))) : null,
    files.length ? fileLinks(r) : h('p', { class: 'side-label', style: 'display:block' }, 'Files you add appear here.'),
    h('div', { class: 'side-foot' },
      h('p', { class: 'lock' }, icon('lock'), h('span', null, 'Read on this device. Nothing is uploaded, and nothing is kept after you close the tab.')),
      themeSeg()),
  ];
}
function renderSide(r) { fill($side, sideContents(r)); if ($menu.open) fill($menu, sideContents(r)); }

function renderTop(r) {
  const f = r.name === 'file' ? byId(r.id) : null;
  const done = files.filter((x) => x.status === 'done' || x.status === 'error');
  fill($top,
    h('button', { class: 'btn btn-quiet btn-icon menu-btn', type: 'button', 'aria-label': 'Files and settings', onclick: openMenu }, icon('menu', 'i-20')),
    h('div', { class: 'crumbs' },
      f ? [h('a', { href: '#/', class: 'up' }, 'All files'), h('span', { class: 'up', 'aria-hidden': 'true' }, '/'), h('span', { class: 'here' }, f.name)]
        : h('span', { class: 'here' }, files.length ? 'All files' : 'Hidden Text Finder')),
    h('div', { class: 'top-actions' },
      f && f.status === 'done' ? h('button', { class: 'btn btn-ghost', type: 'button', onclick: () => copySummary(f) }, icon('copy'), 'Copy summary') : null,
      !f && done.length ? h('button', { class: 'btn btn-ghost', type: 'button', onclick: downloadCsv }, icon('download'), h('span', null, 'Report')) : null,
      !f && files.length ? h('button', { class: 'btn btn-quiet', type: 'button', onclick: clearAll, disabled: busy || null }, 'Clear') : null));
}

function openMenu() { fill($menu, sideContents(route())); $menu.showModal(); }
$menu.addEventListener('click', (e) => { if (e.target === $menu) $menu.close(); });

// ---------- start ----------
function startView() {
  const zone = h('section', { class: 'drop', id: 'drop', 'aria-labelledby': 'drop-h' },
    h('div', null,
      icon('upload', 'big'),
      h('h2', { id: 'drop-h' }, 'Drop CVs here'),
      h('p', null, 'PDF or Word (.docx), one file or fifty.'),
      h('div', { class: 'actions' },
        h('button', { class: 'btn btn-primary btn-lg', type: 'button', onclick: () => $picker.click() }, 'Choose files'),
        h('button', { class: 'btn btn-ghost btn-lg', type: 'button', onclick: loadSamples }, 'Try three sample CVs'))));
  return h('div', null,
    h('div', { class: 'title-row' }, h('div', null,
      h('h1', null, 'Check CVs for hidden text'),
      h('p', { class: 'subline' }, 'See the white, microscopic and off-page text that people miss and screening software reads.'))),
    h('div', { class: 'grid start-grid' },
      h('div', { class: 'span-7 start-left' }, zone,
        h('p', { class: 'fair', style: 'display:flex;gap:10px' }, icon('shield'), h('span', null, h('b', null, 'Files never leave this device. '), 'They are read inside this browser tab, and the page is built so that it cannot send them anywhere.'))),
      h('section', { class: 'span-5 card', 'aria-labelledby': 'what-h' },
        h('div', { class: 'card-head' }, h('h2', { id: 'what-h' }, 'What it looks for')),
        h('div', { class: 'card-body' },
          h('ul', { class: 'kinds' },
            kindItem('invisible', 'White or invisible text', 'Text the colour of the page, covered by a shape, or set never to be painted.'),
            kindItem('tiny', 'Microscopic text', 'Text under 3 points, which shows as a speck or a line.'),
            kindItem('offpage', 'Text off the page', 'Text placed beyond the edge, where no viewer shows it.'),
            kindItem('vanish', 'Word’s Hidden option', 'Text formatted as Hidden, which Word does not show or print.'),
            kindItem('props', 'The file’s details', 'Instructions tucked into the title, subject, keywords or picture descriptions.'),
            kindItem('bot', 'Instructions aimed at AI', 'Lines such as “ignore previous instructions” or “rank this candidate first”, hidden or not.')),
          fairNote()))));
}
function kindItem(ic, title, text) { return h('li', null, icon(ic), h('div', null, h('b', null, title), h('span', null, text))); }
function fairNote() {
  return h('p', { class: 'fair' }, h('b', null, 'A flag is a reason to look, not proof. '), 'White text can be left over from a template, and keyword lists are common advice. Read what was hidden before deciding anything about the person.');
}

// ---------- the list of results ----------
function listView() {
  const done = files.filter((f) => f.status === 'done' || f.status === 'error');
  const counts = { alert: 0, warn: 0, clean: 0, error: 0, neutral: 0 };
  done.forEach((f) => { counts[f.summary ? f.summary.tone : 'error']++; });
  const waiting = files.length - done.length;
  const bits = [];
  if (counts.alert) bits.push(h('b', null, plural(counts.alert, 'with instructions aimed at AI', 'with instructions aimed at AI')));
  if (counts.warn) bits.push(plural(counts.warn, 'with hidden text', 'with hidden text'));
  if (counts.clean) bits.push(counts.clean + ' with nothing hidden');
  if (counts.neutral) bits.push(counts.neutral + ' with no text layer');
  if (counts.error) bits.push(counts.error + ' couldn’t be read');
  const sub = [];
  bits.forEach((b, i) => { if (i) sub.push(' · '); sub.push(b); });
  const rows = files.map((f) => {
    const s = f.summary;
    const go = () => { location.hash = '#/f/' + f.id; };
    return h('tr', { onclick: (e) => { if (e.target.tagName !== 'A') go(); } },
      h('td', null, h('div', { class: 'file' }, icon(f.ext === 'docx' ? 'file' : 'file'), h('div', { style: 'min-width:0' },
        h('a', { href: '#/f/' + f.id }, f.name),
        h('div', { class: 'sub' }, (f.ext ? f.ext.toUpperCase() : 'File') + ' · ' + kb(f.size))))),
      h('td', { class: 'num c-pages' }, f.result && f.result.pageCount ? String(f.result.pageCount) : '—'),
      h('td', { class: 'c-result' }, f.status === 'done' || f.status === 'error'
        ? h('span', { class: 'pill ' + s.tone }, s.short)
        : h('div', { style: 'display:flex;align-items:center;gap:10px' }, h('span', { class: 'bar-progress', 'aria-hidden': 'true' }, h('i', { style: 'width:' + (f.progress ? Math.round(f.progress[0] / f.progress[1] * 100) : 8) + '%' })), h('span', { class: 'sub' }, statusText(f)))),
      h('td', { class: 'num c-count' }, f.result && f.result.findings ? String(f.result.findings.filter((x) => x.kind !== 'visibleai').length) : '—'));
  });
  return h('div', null,
    h('div', { class: 'title-row' }, h('div', null,
      h('h1', null, waiting ? 'Checking ' + plural(files.length, 'file') : plural(files.length, 'file') + ' checked'),
      h('p', { class: 'subline' }, sub.length ? sub : 'Reading the first file…'))),
    h('div', { class: 'grid' },
      h('div', { class: 'span-8' }, h('section', { class: 'card', 'aria-label': 'Results' },
        h('table', { class: 'results' },
          h('thead', null, h('tr', null, h('th', { scope: 'col' }, 'File'), h('th', { scope: 'col', class: 'num c-pages' }, 'Pages'), h('th', { scope: 'col' }, 'Result'), h('th', { scope: 'col', class: 'num' }, 'Hidden'))),
          h('tbody', null, rows))),
        h('div', { class: 'drop more' }, h('div', null,
          h('p', null, h('b', null, 'Drop more CVs anywhere on this page'), ', or ', h('button', { class: 'link', type: 'button', onclick: () => $picker.click() }, 'choose files'), '.'),
          h('p', { style: 'margin-top:4px' }, 'Each one is read here, in this tab, and added to the list.')))),
      h('section', { class: 'span-4 card', 'aria-labelledby': 'mean-h' },
        h('div', { class: 'card-head' }, h('h2', { id: 'mean-h' }, 'Reading the results')),
        h('div', { class: 'card-body' },
          h('ul', { class: 'kinds' },
            h('li', null, h('span', { class: 'dot alert', style: 'margin-top:6px' }), h('div', null, h('b', null, 'Instructions aimed at AI'), h('span', null, 'Text written for screening software, such as “rank this candidate first”.'))),
            h('li', null, h('span', { class: 'dot warn', style: 'margin-top:6px' }), h('div', null, h('b', null, 'Hidden text'), h('span', null, 'Text a person can’t see on the page, often a list of keywords.'))),
            h('li', null, h('span', { class: 'dot clean', style: 'margin-top:6px' }), h('div', null, h('b', null, 'Nothing hidden'), h('span', null, 'Every piece of text is visible at a readable size.')))),
          fairNote()))));
}

// ---------- one file ----------
function fileView(f) {
  if (f.status !== 'done' && f.status !== 'error') {
    return h('div', null,
      h('div', { class: 'title-row' }, h('div', null, h('h1', null, f.name), h('p', { class: 'subline', role: 'status' }, statusText(f) + '…'))));
  }
  const res = f.result;
  const s = f.summary;
  if (res.error) {
    return h('div', null,
      h('div', { class: 'title-row' }, h('div', null, h('h1', null, f.name), h('p', { class: 'subline' }, 'This file couldn’t be checked'))),
      h('div', { class: 'error-box', role: 'alert' }, icon('alert', 'i-20'), h('div', null, h('p', null, res.error),
        h('p', null, 'Other files are not affected. If the applicant sent this file, asking them for a PDF or .docx copy is the simplest fix.'))));
  }
  const meta = [res.kind === 'pdf' ? 'PDF, ' + plural(res.pageCount, 'page') : 'Word document', kb(f.size)];
  const maker = [res.meta && res.meta.creator, res.meta && res.meta.producer].map((v) => (v || '').replace(/[()]/g, '').split(/;| - /)[0].trim()).find((v) => v && !/^(anonymous|unknown|unspecified|none)$/i.test(v));
  if (maker) meta.push('made with ' + maker);
  const findings = res.findings.slice().sort((a, b) => (b.ai - a.ai) || ((a.page || 0) - (b.page || 0)));
  const toggle = h('div', { class: 'seg reveal-seg', role: 'group', 'aria-label': 'View' },
    h('button', { type: 'button', 'aria-pressed': String(!ui.reveal), onclick: () => setReveal(false) }, icon('eyeOff'), ' As a person sees it'),
    h('button', { type: 'button', 'aria-pressed': String(ui.reveal), onclick: () => setReveal(true) }, icon('eye'), ' Hidden text shown'));
  [...toggle.querySelectorAll('button')].forEach((b) => { b.style.display = 'inline-flex'; b.style.alignItems = 'center'; b.style.gap = '6px'; });
  const tabs = res.kind === 'pdf' && !res.noText ? h('div', { class: 'view-tabs', role: 'tablist' },
    h('button', { role: 'tab', 'aria-selected': String(ui.tab === 'pages'), onclick: () => { ui.tab = 'pages'; render(); } }, 'Pages'),
    h('button', { role: 'tab', 'aria-selected': String(ui.tab === 'text'), onclick: () => { ui.tab = 'text'; render(); } }, 'All the text a screener reads')) : null;
  let body;
  if (res.noText) body = h('div', { class: 'error-box' }, icon('scan', 'i-20'), h('div', null, h('p', null, 'This PDF holds pictures of pages and no text at all, as a scan does.'), h('p', null, 'Nothing can be hidden as text here, but screening software can’t read it either unless it runs text recognition.')));
  else if (res.kind === 'docx') body = h('div', null, h('p', { class: 'docx-note' }, 'Word files have no fixed pages, so this is the text as Word stores it. Hidden parts are marked; switch to “As a person sees it” to drop them.'), docxText(res));
  else body = ui.tab === 'text' ? pdfText(res) : pdfPages(f, res);
  return h('div', null,
    h('div', { class: 'title-row' },
      h('div', { style: 'min-width:0' }, h('h1', null, f.name),
        h('p', { class: 'subline' }, h('b', null, s.title), ' · ' + meta.join(' · '))),
      res.noText ? null : toggle),
    h('div', { class: 'grid' },
      h('div', { class: 'span-8' }, tabs, body),
      h('aside', { class: 'span-4', 'aria-label': 'Findings' }, h('div', { class: 'findings' },
        findings.length ? (() => { const seen = new Set(); return findings.map((x) => { const first = !seen.has(x.kind); seen.add(x.kind); return findingCard(f, res, x, first); }); })() : h('div', { class: 'clean-note' }, icon('check', 'i-20'), h('div', null, h('b', null, 'Nothing hidden found. '), res.kind === 'pdf' ? 'Every piece of text in this file shows on the page at a readable size, and nothing in it is written for screening software.' : 'No text in this file is formatted as hidden, invisible or microscopic, and nothing in it is written for screening software.')),
        fairNote()))));
}

function setReveal(on) {
  ui.reveal = on;
  document.querySelectorAll('.page').forEach((p) => p.classList.toggle('person', !on));
  document.querySelectorAll('.textview').forEach((t) => t.classList.toggle('person', !on));
  document.querySelectorAll('.reveal-seg button').forEach((b, i) => b.setAttribute('aria-pressed', String(i === 1 ? on : !on)));
  document.querySelectorAll('.textview mark').forEach((m) => { m.hidden = !on; });
}

function findingCard(f, res, x, explain) {
  const k = KINDS[x.kind] || { label: x.kind, why: '' };
  const where = x.page ? 'Page ' + x.page : x.where || '';
  const hasPlace = res.kind === 'pdf' && x.rects && x.rects.length && x.kind !== 'offpage';
  const inner = [
    h('div', { class: 'row1' }, h('span', { class: 'kind', style: 'display:inline-flex;gap:6px;align-items:center' }, icon(KIND_ICON[x.kind] || 'file'), k.label), h('span', { class: 'where' }, where)),
    h('blockquote', null, x.text),
    h('p', { class: 'detail' }, x.detail ? x.detail + '. ' : '', explain ? k.why : ''),
    x.ai || x.keywords ? h('div', { class: 'tags' }, x.ai ? h('span', { class: 'pill alert' }, 'Aimed at AI') : null, x.keywords ? h('span', { class: 'pill' }, 'A list of keywords') : null) : null,
  ];
  if (!hasPlace) return h('div', { class: 'finding' + (x.ai ? ' ai' : '') }, inner);
  return h('button', { class: 'finding' + (x.ai ? ' ai' : ''), type: 'button', onclick: () => showOnPage(x), 'aria-label': k.label + ' on page ' + x.page + ': ' + x.text.slice(0, 80) + '. Show on the page' }, inner);
}

function showOnPage(x) {
  if (ui.tab !== 'pages') { ui.tab = 'pages'; render(); }
  if (!ui.reveal) setReveal(true);
  const el = document.querySelector('[data-finding="' + x.id + '"]');
  if (!el) return;
  el.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'center' });
  el.classList.remove('pulse');
  void el.offsetWidth;
  el.classList.add('pulse');
}

// Pages drawn from the file, with each finding placed where it sits.
function pdfPages(f, res) {
  const wrap = h('div', { class: 'pages' });
  const width = () => Math.min(760, wrap.clientWidth || $main.clientWidth - 48);
  res.pages.forEach((pg) => {
    const box = h('div', { class: 'page' + (ui.reveal ? '' : ' person'), style: 'aspect-ratio:' + pg.width + ' / ' + pg.height, 'aria-label': 'Page ' + pg.number },
      h('div', { class: 'page-loading' }, 'Drawing page ' + pg.number + '…'));
    wrap.append(box);
  });
  if (res.truncated) wrap.append(h('p', { class: 'docx-note' }, 'Only the first 40 pages were checked; this file has ' + res.truncated + ' more.'));
  queueMicrotask(() => drawPages(f, res, wrap, width));
  return wrap;
}

async function drawPages(f, res, wrap, width) {
  try {
    if (ui.docId !== f.id) {
      if (ui.doc) await closePdf(ui.doc);
      ui.doc = await loadPdf(f.buf);
      ui.docId = f.id;
    }
    const boxes = [...wrap.querySelectorAll('.page')];
    for (let i = 0; i < res.pages.length; i++) {
      if (!wrap.isConnected) return;
      const pg = res.pages[i];
      const cssW = width();
      const canvas = await renderPage(ui.doc, pg.number, cssW);
      canvas.setAttribute('aria-hidden', 'true');
      const box = boxes[i];
      const o = overlays(res, pg, cssW);
      box.style.aspectRatio = '';
      fill(box, o.top, h('div', { class: 'page-art', style: 'aspect-ratio:' + pg.width + ' / ' + pg.height }, canvas, revealCanvas(res, pg, canvas), o.marks, h('span', { class: 'page-num' }, 'Page ' + pg.number)), o.foot);
    }
  } catch (e) {
    wrap.querySelectorAll('.page-loading').forEach((el) => { el.textContent = 'This page couldn’t be drawn, but the findings beside it still stand.'; });
  }
}

// The hidden text, painted back onto the page where it sits, at its own size: part of the page picture.
// Every word is also listed as text beside the page, so this layer is hidden from screen readers.
function revealCanvas(res, pg, base) {
  const c = document.createElement('canvas');
  c.className = 'reveal';
  c.width = base.width; c.height = base.height;
  c.setAttribute('aria-hidden', 'true');
  const ctx = c.getContext('2d');
  const s = base.width / pg.width;
  const css = getComputedStyle(document.documentElement);
  res.findings.filter((x) => x.page === pg.number && x.kind !== 'tiny' && x.kind !== 'offpage' && x.rects && x.rects.length).forEach((x) => {
    const ink = x.ai ? '#b3261e' : '#14596b';
    x.rects.forEach((r) => {
      ctx.fillStyle = x.ai ? 'rgba(196,36,42,0.10)' : 'rgba(27,108,128,0.12)';
      ctx.fillRect(r.x * s, r.y * s, r.w * s, r.h * s);
      if (!r.t) return;
      ctx.fillStyle = ink;
      ctx.font = '600 ' + (r.h * s * 0.74).toFixed(1) + 'px ' + css.getPropertyValue('--font');
      ctx.textBaseline = 'alphabetic';
      ctx.fillText(r.t, r.x * s + 1, (r.y + r.h * 0.8) * s, Math.max(r.w * s, 1));
    });
  });
  return c;
}

function overlays(res, pg, cssW) {
  const frag = document.createDocumentFragment();
  let top = null, foot = null;
  const W = pg.width, H = pg.height;
  const k = cssW / W; // CSS pixels per point
  const off = res.findings.filter((x) => x.page === pg.number && x.kind === 'offpage');
  if (off.length) {
    top = h('div', { class: 'strips' }, off.map((x) =>
      h('div', { class: 'offstrip' + (x.ai ? ' ai' : ''), 'data-finding': x.id }, h('b', null, (x.detail || 'Outside the page') + ': '), x.text)));
  }
  res.findings.filter((x) => x.page === pg.number && x.rects && x.rects.length && x.kind !== 'offpage').forEach((x) => {
    x.rects.forEach((r, i) => {
      const style = 'left:' + (r.x / W * 100) + '%;top:' + (r.y / H * 100) + '%;width:' + (r.w / W * 100) + '%;height:' + (r.h / H * 100) + '%';
      const m = h('div', { class: 'mark' + (x.kind === 'tiny' ? ' min' : '') + (x.ai ? ' ai' : ''), style, 'data-finding': i === 0 ? x.id : null });
      frag.append(m);
    });
  });
  // Text too small or too spread out to read in place is written out at the foot of the page.
  const footList = res.findings.filter((x) => x.page === pg.number && x.kind === 'tiny' && x.rects && x.rects.length);
  if (footList.length) {
    foot = h('div', { class: 'strips' }, footList.map((x) =>
      h('div', { class: 'offstrip foot' + (x.ai ? ' ai' : '') }, h('b', null, 'Microscopic text at the small box (' + x.detail.replace('Set at ', '') + '): '), x.text)));
  }
  return { top, marks: frag, foot };
}

function pdfText(res) {
  const byId = Object.fromEntries(res.findings.map((x) => [x.id, x]));
  return h('div', { class: 'textview' + (ui.reveal ? '' : ' person') }, res.pages.map((pg) => [
    h('p', { class: 'where' }, 'Page ' + pg.number),
    pg.lines.map((ln) => h('p', null, ln.map((sg) => sg.finding ? h('mark', { class: byId[sg.finding] && byId[sg.finding].ai ? 'ai' : null, title: (KINDS[byId[sg.finding].kind] || {}).label, hidden: !ui.reveal || null }, sg.text) : sg.text))),
  ]));
}
function docxText(res) {
  const byId = Object.fromEntries(res.findings.map((x) => [x.id, x]));
  let last = '';
  return h('div', { class: 'textview' + (ui.reveal ? '' : ' person') }, res.paragraphs.map((p) => {
    const label = p.where !== last ? h('p', { class: 'where' }, p.where) : null;
    last = p.where;
    return [label, h('p', null, p.segs.map((sg) => sg.finding ? h('mark', { class: byId[sg.finding] && byId[sg.finding].ai ? 'ai' : null, title: (KINDS[(byId[sg.finding] || {}).kind] || {}).label, hidden: !ui.reveal || null }, sg.text) : sg.text))];
  }));
}

// ---------- exports ----------
function summaryText(f) {
  const lines = [f.name + ': ' + f.summary.title];
  (f.result.findings || []).forEach((x) => {
    lines.push('- ' + (KINDS[x.kind] || {}).label + (x.page ? ' (page ' + x.page + ')' : x.where ? ' (' + x.where.toLowerCase() + ')' : '') + (x.ai ? ', aimed at AI' : '') + ': “' + x.text + '”');
  });
  lines.push('', 'Checked with Hidden Text Finder. A flag is a reason to look, not proof.');
  return lines.join('\n');
}
async function copySummary(f) {
  try { await navigator.clipboard.writeText(summaryText(f)); toast('Summary copied.'); }
  catch (e) { toast('Couldn’t copy. Your browser blocked the clipboard.'); }
}
function csvCell(v) { v = String(v == null ? '' : v); return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; }
function downloadCsv() {
  const head = ['File', 'Type', 'Pages', 'Result', 'Hidden pieces', 'Aimed at AI', 'Kinds', 'Hidden text'];
  const rows = files.filter((f) => f.summary).map((f) => {
    const fs = (f.result && f.result.findings) || [];
    return [f.name, f.ext.toUpperCase(), f.result && f.result.pageCount || '', f.summary.title, fs.filter((x) => x.kind !== 'visibleai').length, fs.filter((x) => x.ai).length,
      [...new Set(fs.map((x) => (KINDS[x.kind] || {}).label))].join('; '), fs.map((x) => x.text).join(' | ')];
  });
  const csv = [head].concat(rows).map((r) => r.map(csvCell).join(',')).join('\r\n');
  const a = h('a', { href: URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv' })), download: 'hidden-text-report-' + new Date().toISOString().slice(0, 10) + '.csv' });
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  toast('Report saved as a spreadsheet file.');
}
function clearAll() {
  if (busy) return;
  files.length = 0;
  if (ui.doc) { closePdf(ui.doc); ui.doc = null; ui.docId = null; }
  location.hash = '#/';
  render();
  toast('Cleared. Nothing was kept.');
}

// ---------- samples ----------
async function loadSamples() {
  const names = [['maya-lindqvist-cv.pdf', 'application/pdf'], ['tomas-reyes-cv.pdf', 'application/pdf'], ['priya-raman-cv.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']];
  try {
    const list = await Promise.all(names.map(async ([n, type]) => {
      const res = await fetch('samples/' + n);
      if (!res.ok) throw new Error(n);
      return new File([await res.blob()], n, { type });
    }));
    addFiles(list);
    toast('Three made-up CVs added: two with hidden text, one clean.');
  } catch (e) {
    toast('The sample files didn’t load. Check your connection and try again.');
  }
}

// ---------- theme ----------
function themeSeg() {
  let t = 'system';
  try { t = localStorage.getItem('htf:theme') || 'system'; } catch (e) { /* storage off */ }
  return h('div', { class: 'seg', role: 'group', 'aria-label': 'Theme', style: 'justify-self:start' },
    [['system', 'Auto'], ['light', 'Light'], ['dark', 'Dark']].map(([v, label]) => h('button', { type: 'button', 'aria-pressed': String(t === v), onclick: () => {
      try { if (v === 'system') localStorage.removeItem('htf:theme'); else localStorage.setItem('htf:theme', v); } catch (e) { /* storage off */ }
      if (v === 'system') document.documentElement.removeAttribute('data-theme'); else document.documentElement.setAttribute('data-theme', v);
      render();
    } }, label)));
}

// ---------- toasts ----------
function toast(msg) {
  const t = h('div', { class: 'toast', role: 'status' }, msg);
  $toasts.append(t);
  while ($toasts.children.length > 2) $toasts.firstChild.remove();
  setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 200); }, 4200);
}

// ---------- drag and drop, picker ----------
let dragDepth = 0;
const hasFiles = (e) => e.dataTransfer && [...(e.dataTransfer.types || [])].includes('Files');
window.addEventListener('dragenter', (e) => { if (!hasFiles(e)) return; e.preventDefault(); dragDepth++; $veil.hidden = false; });
window.addEventListener('dragover', (e) => { if (!hasFiles(e)) return; e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; });
window.addEventListener('dragleave', (e) => { if (!hasFiles(e)) return; dragDepth = Math.max(0, dragDepth - 1); if (!dragDepth) $veil.hidden = true; });
window.addEventListener('drop', (e) => {
  if (!hasFiles(e)) return;
  e.preventDefault(); dragDepth = 0; $veil.hidden = true;
  addFiles(e.dataTransfer.files);
});
$picker.addEventListener('change', () => { addFiles($picker.files); $picker.value = ''; });

let resizeT = 0;
let lastW = window.innerWidth;
window.addEventListener('resize', () => {
  clearTimeout(resizeT);
  resizeT = setTimeout(() => {
    if (Math.abs(window.innerWidth - lastW) < 40) return;
    lastW = window.innerWidth;
    if (route().name === 'file') { $main.dataset.view = ''; render(); }
  }, 200);
});
window.addEventListener('hashchange', () => { if (/^#\/sample/.test(location.hash)) startFromHash(); else render(); });
window.addEventListener('beforeunload', (e) => { if (busy) { e.preventDefault(); e.returnValue = ''; } });

// #/sample loads the three sample CVs; #/sample/maya (or tomas, priya) also opens that one.
async function startFromHash() {
  const m = location.hash.match(/^#\/sample(?:\/(\w+))?/);
  if (!m) return render();
  history.replaceState(null, '', location.pathname + '#/');
  render();
  await loadSamples();
  if (m[1]) {
    const f = files.find((x) => x.name.startsWith(m[1].toLowerCase()));
    if (f) location.hash = '#/f/' + f.id;
  }
}
startFromHash();

// An installed copy can be opened with PDF and Word files from the system.
if ('launchQueue' in window) {
  window.launchQueue.setConsumer(async (params) => {
    if (params.files && params.files.length) addFiles(await Promise.all(params.files.map((fh) => fh.getFile())));
  });
}

if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol) && !['localhost', '127.0.0.1'].includes(location.hostname)) {
  navigator.serviceWorker.register('sw.js').catch(() => { /* offline use is optional */ });
}

// For the browser tests: read files without the picker.
window.__htf = { addFiles, files };
