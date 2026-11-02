/* Citation Check: the interface. Each reference is looked up in Crossref (the DOI registry most
   journals use) and, when that finds no match, in OpenAlex (an open index of scholarly works).
   Court citations get a link to CourtListener. Nothing is stored; text from the lists and from the
   indexes is always set as text, never as HTML. */
(function () {
  'use strict';
  const C = window.CiteCore;
  const $main = document.getElementById('main');
  const $toasts = document.getElementById('toasts');

  function h(tag, attrs) {
    const el = document.createElement(tag);
    if (attrs) for (const k in attrs) {
      const v = attrs[k];
      if (v == null || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
      else if (k === 'value') el.value = v;
      else el.setAttribute(k, v === true ? '' : v);
    }
    for (let i = 2; i < arguments.length; i++) add(el, arguments[i]);
    return el;
  }
  function add(el, k) { if (k == null || k === false) return; if (Array.isArray(k)) k.forEach((x) => add(el, x)); else el.append(k.nodeType ? k : String(k)); }
  function fill(el) { el.replaceChildren(); for (let i = 1; i < arguments.length; i++) add(el, arguments[i]); return el; }
  const ICON = {
    warn: '<path d="M12 9v4M12 17h.01"/><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/>',
    x: '<circle cx="12" cy="12" r="9"/><path d="m15 9-6 6M9 9l6 6"/>',
    copy: '<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/>',
    down: '<path d="M12 4v12M6 12l6 6 6-6M4 20h16"/>',
  };
  function icon(name) {
    const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    s.setAttribute('viewBox', '0 0 24 24'); s.setAttribute('class', 'i'); s.setAttribute('aria-hidden', 'true');
    s.innerHTML = ICON[name]; // fixed shapes only
    return s;
  }
  function toast(msg) {
    const t = h('div', { class: 'toast', role: 'status' }, msg);
    $toasts.append(t);
    setTimeout(() => t.remove(), 4000);
  }
  const plural = (n, one, many) => n + ' ' + (n === 1 ? one : many || one + 's');

  const SAMPLE = [
    'LeCun, Y., Bengio, Y., & Hinton, G. (2015). Deep learning. Nature, 521(7553), 436–444. https://doi.org/10.1038/nature14539',
    'He, K., Zhang, X., Ren, S., & Sun, J. (2016). Deep residual learning for image recognition. In Proceedings of the IEEE Conference on Computer Vision and Pattern Recognition (pp. 770–778).',
    'Watson, J. D., & Crick, F. H. C. (1953). Molecular structure of nucleic acids: A structure for deoxyribose nucleic acid. Nature, 171(4356), 737–738.',
    'Smith, J., & Patel, R. (2021). Neural pathways of trust in algorithmic hiring. Journal of Applied Cognitive Systems, 14(3), 211–229.',
    'Hinton, G. (2019). Capsule networks for clinical imaging. Nature, 521, 436–444. https://doi.org/10.1038/nature14539',
    'LeCun, Y., & Bengio, Y. (2017). Deep learning. Nature, 521, 436–444.',
    'Kahneman, D. (2011). Thinking, fast and slow. Farrar, Straus and Giroux.',
    'Varghese v. China Southern Airlines Co., 925 F.3d 1339 (11th Cir. 2019).',
  ].map((r, i) => (i + 1) + '. ' + r).join('\n');

  const LABEL = { found: 'Found', close: 'Close match', none: 'Not found', wrongdoi: 'DOI is for another work', legal: 'Court citation', error: 'Couldn’t check', checking: 'Checking' };
  const state = { text: '', refs: [], results: [], filter: 'all', running: false, offline: false };

  // ---------- the network ----------
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  async function getJSON(url, tries) {
    tries = tries || 0;
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), 15000);
    let res;
    try { res = await fetch(url, { signal: ctl.signal, headers: { Accept: 'application/json' } }); }
    catch (e) { clearTimeout(timer); if (tries < 1) { await sleep(800); return getJSON(url, tries + 1); } throw new Error(navigator.onLine === false ? 'offline' : 'network'); }
    clearTimeout(timer);
    if (res.status === 404) return null;
    if (res.status === 429 || res.status >= 500) {
      if (tries >= 3) throw new Error('busy');
      const wait = Number(res.headers.get('retry-after')) * 1000 || 1500 * (tries + 1);
      await sleep(Math.min(wait, 8000));
      return getJSON(url, tries + 1);
    }
    if (!res.ok) throw new Error('http ' + res.status);
    return res.json();
  }
  const CROSSREF = 'https://api.crossref.org/works';
  const OPENALEX = 'https://api.openalex.org/works';
  const FIELDS = 'DOI,title,author,issued,published-print,published-online,container-title,publisher,type';

  async function checkOne(ref) {
    const lg = C.legal(ref);
    if (lg) return { status: 'legal', legal: lg };
    const doi = C.findDoi(ref);
    let doiNote = null;
    if (doi) {
      const r = await getJSON(CROSSREF + '/' + encodeURIComponent(doi));
      let rec = r && r.message ? C.fromCrossref(r.message) : null;
      if (!rec) {
        const o = await getJSON(OPENALEX + '/doi:' + encodeURIComponent(doi));
        rec = o && o.id ? C.fromOpenAlex(o) : null;
      }
      if (rec) {
        const a = C.assess(ref, rec);
        return a.status === 'none' ? { status: 'wrongdoi', rec, a, doi } : { status: a.status, rec, a, doi };
      }
      doiNote = 'The DOI ' + doi + ' isn’t registered with Crossref or OpenAlex.';
    }
    const q = C.query(ref);
    const cr = await getJSON(CROSSREF + '?rows=5&select=' + FIELDS + '&query.bibliographic=' + encodeURIComponent(q));
    let top = C.best(ref, ((cr && cr.message && cr.message.items) || []).map(C.fromCrossref));
    if (!top || top.a.status !== 'found') {
      const oa = await getJSON(OPENALEX + '?per-page=5&search=' + encodeURIComponent(q.slice(0, 200)));
      const t2 = C.best(ref, ((oa && oa.results) || []).map(C.fromOpenAlex));
      const rank = { found: 2, close: 1, none: 0 };
      if (t2 && (!top || rank[t2.a.status] > rank[top.a.status])) top = t2;
    }
    if (!top || top.a.status === 'none') return { status: 'none', doiNote, nearest: top && top.a.coverage >= 0.4 ? top.rec : null };
    return { status: top.a.status, rec: top.rec, a: top.a, doiNote };
  }

  async function run() {
    state.running = true;
    state.offline = false;
    state.results = state.refs.map(() => ({ status: 'checking' }));
    render();
    let next = 0;
    const worker = async () => {
      while (next < state.refs.length) {
        const i = next++;
        try { state.results[i] = await checkOne(state.refs[i]); }
        catch (e) { state.results[i] = { status: 'error', reason: e.message }; if (e.message === 'offline') state.offline = true; }
        updateRef(i);
        updateSummary();
      }
    };
    await Promise.all([worker(), worker()]); // two at a time, to be polite to the services
    state.running = false;
    render();
  }

  // ---------- screens ----------
  function render() {
    fill($main, state.results.length ? resultsView() : startView());
  }

  function startView() {
    const ta = h('textarea', { id: 'refs', 'aria-label': 'Reference list', placeholder: 'Paste a reference list in any style: APA, Harvard, MLA, Chicago, Vancouver, IEEE or BibTeX. Numbered, one per line, or separated by blank lines.', spellcheck: 'false' });
    ta.value = state.text;
    const count = h('span', { class: 'count', 'aria-live': 'polite' });
    const go = h('button', { class: 'btn btn-primary', type: 'button', onclick: () => {
      state.text = ta.value;
      state.refs = C.split(ta.value);
      if (!state.refs.length) { ta.focus(); toast('Paste at least one reference first.'); return; }
      if (state.refs.length > 200) { state.refs = state.refs.slice(0, 200); toast('Only the first 200 references are checked at once.'); }
      run();
    } }, 'Check');
    const update = () => {
      const n = C.split(ta.value).length;
      fill(count, n ? [h('b', null, String(n)), ' ' + (n === 1 ? 'reference' : 'references') + ' found in the text'] : 'Nothing pasted yet');
      go.textContent = n ? 'Check ' + plural(n, 'reference') : 'Check';
      go.disabled = !n;
    };
    ta.addEventListener('input', update);
    update();
    return h('div', null,
      h('div', { class: 'head' }, h('h1', null, 'Check a reference list'),
        h('p', null, 'AI tools invent references that look real. Paste a list and see which works exist, which have the wrong details, and which can’t be found anywhere.')),
      h('div', { class: 'grid start-grid' },
        h('section', { class: 'panel paste s8', 'aria-label': 'References' },
          h('h2', null, 'References'),
          ta,
          h('div', { class: 'paste-foot' }, count,
            h('div', { class: 'acts' },
              h('button', { class: 'btn btn-ghost', type: 'button', onclick: () => { ta.value = SAMPLE; update(); ta.focus(); } }, 'Try a sample list'),
              go))),
        h('aside', { class: 'panel s4', 'aria-label': 'What the results mean' },
          h('h2', null, 'What the results mean'),
          h('ul', { class: 'keys' },
            key('found', 'The work exists, and the title, authors and year match what was written.'),
            key('close', 'The work exists, but a detail differs: often the year, an author or the title’s wording.'),
            key('none', 'No work like it in Crossref or OpenAlex. Check a library catalogue before deciding it’s invented.'),
            key('wrongdoi', 'The DOI is real but belongs to a different work, a common sign of an invented reference.'),
            key('legal', 'A court case. Each one links to CourtListener, a free archive of US court opinions.')),
          h('div', { class: 'notes' },
            h('p', null, h('b', null, 'Where it looks. '), 'Crossref, the registry behind most journal DOIs, then OpenAlex, an open index of scholarly works.'),
            h('p', null, h('b', null, 'What leaves this page. '), 'Each reference’s text is sent to those two public services to search them. Nothing is stored here.')))));
  }
  function key(status, text) { return h('li', null, h('span', { class: 'pill ' + status }, LABEL[status]), h('span', null, text)); }

  function counts() {
    const c = { found: 0, close: 0, none: 0, wrongdoi: 0, legal: 0, error: 0, checking: 0 };
    state.results.forEach((r) => { c[r.status]++; });
    return c;
  }
  function headline(c) {
    const n = state.refs.length;
    const bad = c.none + c.wrongdoi;
    if (c.checking) return ['Checking ' + plural(n, 'reference') + '…'];
    if (bad) return [plural(n, 'reference') + '. ', h('em', null, bad === 1 ? '1 can’t be found.' : bad + ' can’t be found.')];
    if (c.close) return [plural(n, 'reference') + '. All exist; ' + (c.close === 1 ? '1 has' : c.close + ' have') + ' a wrong detail.'];
    if (c.found === n) return [n === 1 ? 'The reference was found.' : 'All ' + n + ' references were found.'];
    return [plural(n, 'reference') + ' checked.'];
  }
  function subline(c) {
    const bits = [];
    if (c.found) bits.push(c.found + ' found');
    if (c.close) bits.push(c.close + ' close');
    if (c.none) bits.push(c.none + ' not found');
    if (c.wrongdoi) bits.push(c.wrongdoi + ' with a DOI for another work');
    if (c.legal) bits.push(plural(c.legal, 'court citation') + ' to look up');
    if (c.error) bits.push(c.error + ' couldn’t be checked');
    if (c.checking) bits.push(c.checking + ' still checking');
    return bits.join(' · ');
  }

  function resultsView() {
    const c = counts();
    const filters = [['all', 'All'], ['problems', 'Problems'], ['found', 'Found'], ['legal', 'Court']].filter(([f]) => f !== 'legal' || c.legal);
    return h('div', null,
      h('div', { class: 'head' }, h('h1', { id: 'verdict' }, headline(c)), h('p', { id: 'subline' }, subline(c))),
      h('div', { class: 'grid' },
        h('section', { class: 's8', 'aria-labelledby': 'verdict' },
          state.offline ? h('div', { class: 'offline', role: 'alert' }, h('span', null, 'You’re offline, so some references couldn’t be looked up.'), h('button', { class: 'btn btn-ghost', type: 'button', onclick: run }, 'Try again')) : null,
          h('div', { class: 'toolbar' },
            h('div', { class: 'filters', role: 'group', 'aria-label': 'Show' }, filters.map(([f, label]) => h('button', { type: 'button', 'aria-pressed': String(state.filter === f), onclick: () => { state.filter = f; render(); } }, label))),
            h('div', { class: 'filters' },
              h('button', { type: 'button', onclick: copyReport, disabled: state.running || null, style: 'display:inline-flex;gap:6px;align-items:center' }, icon('copy'), 'Copy report'),
              h('button', { type: 'button', onclick: downloadCsv, disabled: state.running || null, style: 'display:inline-flex;gap:6px;align-items:center' }, icon('down'), 'CSV'))),
          h('ol', { class: 'refs', id: 'refs-list' }, visible().map((i) => refCard(i)), !visible().length ? h('li', { class: 'empty-filter' }, 'Nothing in this view.') : null)),
        h('aside', { class: 'panel s4 sticky', 'aria-label': 'Summary' }, h('div', { class: 'tally', id: 'tally' }, tally(c)),
          h('div', { class: 'notes' },
            h('p', null, h('b', null, 'Not found isn’t proof. '), 'Books, reports, theses, very new papers and works outside the big indexes can be real and missing here. Search a library catalogue before raising it.'),
            h('p', null, h('b', null, 'Close matches matter too. '), 'A wrong year or author on a real paper is often a citation copied from an AI answer without checking.')),
          h('div', { style: 'margin-top:18px' }, h('button', { class: 'btn btn-ghost', type: 'button', onclick: () => { state.results = []; state.filter = 'all'; render(); document.getElementById('refs').focus(); } }, 'Check another list')))));
  }
  function visible() {
    const f = state.filter;
    return state.refs.map((_, i) => i).filter((i) => {
      const s = state.results[i].status;
      if (f === 'all') return true;
      if (f === 'problems') return s === 'none' || s === 'wrongdoi' || s === 'close' || s === 'error';
      if (f === 'found') return s === 'found';
      if (f === 'legal') return s === 'legal';
      return true;
    });
  }
  function tally(c) {
    const n = state.refs.length || 1;
    const seg = (cls, v) => h('i', { class: cls, style: 'width:' + (v / n * 100) + '%' });
    return [
      h('div', { class: 'stack', role: 'img', 'aria-label': subline(c) }, seg('f', c.found), seg('c', c.close), seg('n', c.none + c.wrongdoi), seg('l', c.legal + c.error)),
      h('dl', null,
        h('dt', null, h('i', { style: 'background:var(--found)' }), 'Found'), h('dd', null, String(c.found)),
        h('dt', null, h('i', { style: 'background:var(--close)' }), 'Close match'), h('dd', null, String(c.close)),
        h('dt', null, h('i', { style: 'background:var(--none)' }), 'Not found or wrong DOI'), h('dd', null, String(c.none + c.wrongdoi)),
        c.legal ? [h('dt', null, h('i', { style: 'background:var(--control)' }), 'Court citations'), h('dd', null, String(c.legal))] : null),
    ];
  }

  function recordBox(rec, label) {
    if (!rec) return null;
    const meta = [C.authorsText(rec), rec.year, rec.venue].filter(Boolean).join(' · ');
    return h('div', { class: 'record' },
      h('div', { class: 't' }, rec.title || 'Untitled'),
      meta ? h('div', { class: 'm' }, meta) : null,
      h('div', { class: 'src' }, (label || 'Record') + ' · ' + rec.source, rec.doi ? [' · ', h('a', { href: 'https://doi.org/' + rec.doi, target: '_blank', rel: 'noopener noreferrer' }, 'doi.org/' + rec.doi)] : null));
  }
  function searchLinks(ref) {
    const q = encodeURIComponent(C.query(ref).slice(0, 200));
    return h('div', { class: 'ref-links' },
      h('a', { href: 'https://scholar.google.com/scholar?q=' + q, target: '_blank', rel: 'noopener noreferrer' }, 'Search Google Scholar'),
      h('a', { href: 'https://search.worldcat.org/search?q=' + q, target: '_blank', rel: 'noopener noreferrer' }, 'Search WorldCat libraries'));
  }
  function refCard(i) {
    const ref = state.refs[i], r = state.results[i];
    const body = [];
    if (r.status === 'found') body.push(recordBox(r.rec, 'Matching record'));
    if (r.status === 'close') {
      body.push(recordBox(r.rec, 'Nearest record'));
      body.push(h('ul', { class: 'diffs' }, r.a.diffs.map((d) => h('li', null, icon('warn'), h('span', null, d.text)))));
    }
    if (r.status === 'wrongdoi') {
      body.push(h('ul', { class: 'diffs' }, h('li', null, icon('x'), h('span', null, 'The DOI ' + r.doi + ' is real, but it belongs to this work instead:'))));
      body.push(recordBox(r.rec, 'What the DOI points to'));
    }
    if (r.status === 'none') {
      body.push(h('ul', { class: 'diffs' },
        r.doiNote ? h('li', null, icon('x'), h('span', null, r.doiNote)) : null,
        h('li', null, icon('x'), h('span', null, 'No work with this title and these authors in Crossref or OpenAlex.'))));
      if (r.nearest) body.push(recordBox(r.nearest, 'Nearest record, which doesn’t match'));
      body.push(searchLinks(ref));
    }
    if (r.status === 'legal') {
      body.push(h('div', { class: 'ref-links' }, h('a', { href: r.legal.url, target: '_blank', rel: 'noopener noreferrer' }, 'Look up ' + r.legal.citation + ' on CourtListener')));
      body.push(h('p', { class: 'legal-note' }, 'A real citation opens the case. A made-up one finds nothing, or a different case at that page: compare the name.'));
    }
    if (r.status === 'error') body.push(h('ul', { class: 'diffs' }, h('li', null, icon('warn'), h('span', null, r.reason === 'busy' ? 'The services are busy. Try again in a minute.' : 'This one couldn’t be looked up. Check your connection and try again.'))));
    return h('li', { class: 'ref ' + r.status, id: 'ref-' + i },
      h('div', { class: 'ref-top' },
        h('p', { class: 'ref-text' }, h('span', { class: 'ref-num' }, (i + 1) + '.'), ref),
        r.status === 'checking' ? h('span', { class: 'spinner', role: 'status', 'aria-label': 'Checking' }) : h('span', { class: 'pill ' + r.status }, LABEL[r.status])),
      body);
  }
  function updateRef(i) {
    const el = document.getElementById('ref-' + i);
    if (el) el.replaceWith(refCard(i));
  }
  function updateSummary() {
    const c = counts();
    const v = document.getElementById('verdict'), s = document.getElementById('subline'), t = document.getElementById('tally');
    if (v) fill(v, headline(c));
    if (s) s.textContent = subline(c);
    if (t) fill(t, tally(c));
  }

  // ---------- exports ----------
  function lineFor(i) {
    const r = state.results[i];
    let line = (i + 1) + '. [' + LABEL[r.status] + '] ' + state.refs[i];
    if (r.rec) line += '\n   Record: ' + r.rec.title + (r.rec.year ? ' (' + r.rec.year + ')' : '') + (r.rec.doi ? ' https://doi.org/' + r.rec.doi : '');
    if (r.a && r.a.diffs.length && r.status !== 'found') line += '\n   ' + r.a.diffs.map((d) => d.text).join(' ');
    if (r.legal) line += '\n   ' + r.legal.url;
    return line;
  }
  async function copyReport() {
    const c = counts();
    const text = ['Citation Check: ' + subline(c), ''].concat(state.refs.map((_, i) => lineFor(i))).concat(['', 'Checked against Crossref and OpenAlex. "Not found" means not in those indexes, which is not proof a work doesn’t exist.']).join('\n');
    try { await navigator.clipboard.writeText(text); toast('Report copied.'); } catch (e) { toast('Couldn’t copy. Your browser blocked the clipboard.'); }
  }
  function downloadCsv() {
    const cell = (v) => { v = String(v == null ? '' : v); return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; };
    const rows = [['#', 'Result', 'Reference as written', 'Record title', 'Record year', 'Record DOI', 'Source', 'Differences']].concat(state.refs.map((ref, i) => {
      const r = state.results[i];
      return [i + 1, LABEL[r.status], ref, r.rec ? r.rec.title : '', r.rec ? r.rec.year : '', r.rec && r.rec.doi ? r.rec.doi : '', r.rec ? r.rec.source : r.legal ? 'CourtListener link' : '', r.a ? r.a.diffs.map((d) => d.text).join(' ') : r.doiNote || ''];
    }));
    const a = h('a', { href: URL.createObjectURL(new Blob(['﻿' + rows.map((x) => x.map(cell).join(',')).join('\r\n')], { type: 'text/csv' })), download: 'citation-check-' + new Date().toISOString().slice(0, 10) + '.csv' });
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1500);
  }

  render();
  if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol) && !['localhost', '127.0.0.1'].includes(location.hostname)) {
    navigator.serviceWorker.register('sw.js').catch(() => { /* offline shell is optional */ });
  }
})();
