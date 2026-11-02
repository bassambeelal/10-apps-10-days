/* Citation Check core: split a pasted reference list, pull out DOIs, years and court citations, and
   judge how well a record from Crossref or OpenAlex matches what was written. No DOM and no network:
   it runs in the browser and under Node for the tests. */
(function (root) {
  'use strict';

  const STOP = new Set('a an and are as at be by for from has in into is it its of on or that the their this to was were with without via vs using use over under between within toward towards about after before can new study analysis based approach'.split(' '));

  function fold(s) {
    return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  }
  function words(s) {
    return fold(s).replace(/<[^>]+>/g, ' ').split(/[^a-z0-9]+/).filter((w) => w.length > 1 && !STOP.has(w));
  }

  // ---------- splitting a pasted list ----------
  const NUMBERED = /^\s*(?:\[\d{1,3}\]|\(\d{1,3}\)|\d{1,3}[.)])\s+/;
  function bibtexToText(src) {
    const out = [];
    const re = /@(\w+)\s*\{\s*[^,]*,([\s\S]*?)\n\s*\}/g;
    let m;
    while ((m = re.exec(src))) {
      const f = {};
      m[2].replace(/(\w+)\s*=\s*(\{((?:[^{}]|\{[^{}]*\})*)\}|"([^"]*)"|(\d+))/g, (_, k, __, a, b, c) => { f[k.toLowerCase()] = (a || b || c || '').replace(/[{}]/g, '').trim(); return ''; });
      const parts = [f.author && f.author.split(/\s+and\s+/).join(', '), f.year && '(' + f.year + ')', f.title, f.journal || f.booktitle || f.publisher, f.volume, f.pages, f.doi && 'https://doi.org/' + f.doi].filter(Boolean);
      if (parts.length) out.push(parts.join('. ').replace(/\.\./g, '.'));
    }
    return out;
  }
  function split(text) {
    const src = String(text || '').replace(/\r\n?/g, '\n').trim();
    if (!src) return [];
    if (/@\w+\s*\{/.test(src)) { const b = bibtexToText(src); if (b.length) return b; }
    const lines = src.split('\n');
    let refs;
    if (lines.filter((l) => NUMBERED.test(l)).length >= 2) {
      refs = [];
      lines.forEach((l) => {
        if (NUMBERED.test(l)) refs.push(l.replace(NUMBERED, ''));
        else if (l.trim() && refs.length) refs[refs.length - 1] += ' ' + l.trim();
      });
    } else if (/\n\s*\n/.test(src)) {
      refs = src.split(/\n\s*\n/).map((p) => p.replace(/\s*\n\s*/g, ' '));
    } else {
      // One per line, but join a line onto the previous one when it clearly continues it.
      refs = [];
      lines.forEach((l) => {
        const t = l.trim();
        if (!t) return;
        const prev = refs[refs.length - 1];
        if (prev && (/^[a-z(]/.test(t) || /[,:;\-–]$/.test(prev) || t.length < 25)) refs[refs.length - 1] = prev + ' ' + t;
        else refs.push(t);
      });
    }
    return refs.map((r) => r.replace(/\s+/g, ' ').trim()).filter((r) => r.length >= 12);
  }

  // ---------- what a reference says ----------
  function findDoi(ref) {
    const m = String(ref).match(/\b(10\.\d{4,9}\/[^\s"<>]+)/i);
    if (!m) return null;
    let d = m[1];
    // Trim trailing punctuation, and a closing bracket only when it isn't part of the DOI.
    for (;;) {
      const t = d.replace(/[.,;:]+$/, '');
      const open = (t.match(/\(/g) || []).length, close = (t.match(/\)/g) || []).length;
      const openSq = (t.match(/\[/g) || []).length, closeSq = (t.match(/\]/g) || []).length;
      const next = /\)$/.test(t) && close > open ? t.slice(0, -1) : /\]$/.test(t) && closeSq > openSq ? t.slice(0, -1) : t;
      if (next === d) break;
      d = next;
    }
    return d.toLowerCase();
  }
  function years(ref) {
    return (String(ref).match(/\b(1[6-9]\d{2}|20\d{2})\b/g) || []).map(Number);
  }

  // Court citations: volume, reporter, first page ("678 F. Supp. 3d 443", "925 F.3d 1339", "347 U.S. 483").
  const REPORTER = /\b(\d{1,4})\s+(U\.\s?S\.|S\.\s?Ct\.|L\.\s?Ed\.(?:\s?2d)?|F\.(?:\s?(?:2d|3d|4th))?|F\.\s?Supp\.(?:\s?(?:2d|3d))?|F\.\s?App'?x|B\.R\.|A\.(?:\s?(?:2d|3d))?|P\.(?:\s?(?:2d|3d))?|N\.E\.(?:\s?(?:2d|3d))?|N\.W\.(?:\s?2d)?|S\.E\.(?:\s?2d)?|S\.W\.(?:\s?(?:2d|3d))?|So\.(?:\s?(?:2d|3d))?|Cal\.\s?Rptr\.(?:\s?(?:2d|3d))?|N\.Y\.S\.(?:\s?(?:2d|3d))?|WLR|AC|QB|KB|Ch|UKSC|EWCA\s(?:Civ|Crim)|EWHC)\s+(\d{1,5})\b/;
  function legal(ref) {
    const m = String(ref).match(REPORTER);
    if (!m) return null;
    const isCase = /\bv\.?\s|\bvs\.?\s|\bIn re\b|\bEx parte\b/i.test(ref);
    if (!isCase && !/\d{4}\)/.test(ref)) return null;
    const reporter = m[2].replace(/\s+/g, ' ');
    return {
      citation: m[1] + ' ' + reporter + ' ' + m[3],
      volume: m[1], reporter, page: m[3],
      url: 'https://www.courtlistener.com/c/' + encodeURIComponent(reporter) + '/' + m[1] + '/' + m[3] + '/',
    };
  }

  // ---------- records from the indexes, in one shape ----------
  function fromCrossref(item) {
    if (!item) return null;
    const dp = (item.issued && item.issued['date-parts']) || (item['published-print'] && item['published-print']['date-parts']) || (item['published-online'] && item['published-online']['date-parts']) || [[null]];
    return {
      source: 'Crossref',
      doi: item.DOI ? String(item.DOI).toLowerCase() : null,
      title: (Array.isArray(item.title) ? item.title[0] : item.title) || '',
      authors: (item.author || []).map((a) => ({ family: a.family || a.name || '', given: a.given || '' })).filter((a) => a.family),
      year: dp[0] && dp[0][0] ? Number(dp[0][0]) : null,
      venue: (Array.isArray(item['container-title']) ? item['container-title'][0] : item['container-title']) || item.publisher || '',
      type: item.type || '',
    };
  }
  function fromOpenAlex(w) {
    if (!w) return null;
    return {
      source: 'OpenAlex',
      doi: w.doi ? String(w.doi).replace(/^https?:\/\/(dx\.)?doi\.org\//i, '').toLowerCase() : null,
      title: w.display_name || w.title || '',
      authors: (w.authorships || []).map((a) => {
        const n = (a.author && a.author.display_name) || a.raw_author_name || '';
        const parts = n.trim().split(/\s+/);
        return { family: parts.pop() || '', given: parts.join(' ') };
      }).filter((a) => a.family),
      year: w.publication_year || null,
      venue: (w.primary_location && w.primary_location.source && w.primary_location.source.display_name) || (w.host_venue && w.host_venue.display_name) || '',
      type: w.type || '',
    };
  }

  // ---------- how well a record matches what was written ----------
  function assess(ref, rec) {
    if (!rec || !rec.title) return { status: 'none', coverage: 0, diffs: [] };
    const refWords = new Set(words(ref));
    const titleWords = words(rec.title);
    const hit = titleWords.filter((w) => refWords.has(w)).length;
    const coverage = titleWords.length ? hit / titleWords.length : 0;
    const first = rec.authors[0];
    const authorOk = first ? refWords.has(words(first.family).join('')) || words(first.family).some((w) => refWords.has(w)) : null;
    const ys = years(ref);
    const yearOk = rec.year && ys.length ? ys.some((y) => Math.abs(y - rec.year) <= 1) : null;
    const diffs = [];
    if (yearOk === false) diffs.push({ field: 'year', text: 'You wrote ' + ys[0] + '; the record says ' + rec.year + '.' });
    if (authorOk === false) diffs.push({ field: 'author', text: 'The record’s first author is ' + first.family + (rec.authors.length > 1 ? ', with ' + (rec.authors.length - 1) + ' more' : '') + '.' });
    if (coverage < 0.85) diffs.push({ field: 'title', text: 'The record’s title is “' + rec.title + '”.' });
    const short = titleWords.length < 3;
    let status = 'none';
    if (coverage >= 0.85 && !short && authorOk !== false && yearOk !== false) status = 'found';
    else if (coverage >= 0.85 && !short) status = 'close';
    else if (short && coverage === 1 && authorOk && yearOk) status = 'found';
    else if (coverage >= 0.6 && (authorOk || yearOk)) status = 'close';
    return { status, coverage: Math.round(coverage * 100) / 100, authorOk, yearOk, diffs };
  }

  // The best of several candidates: found beats close, then the highest title coverage.
  function best(ref, records) {
    const rank = { found: 2, close: 1, none: 0 };
    let top = null;
    records.filter(Boolean).forEach((rec) => {
      const a = assess(ref, rec);
      if (!top || rank[a.status] > rank[top.a.status] || (rank[a.status] === rank[top.a.status] && a.coverage > top.a.coverage)) top = { rec, a };
    });
    return top;
  }

  // A short query from a reference: drop DOIs, URLs and page ranges that confuse search.
  function query(ref) {
    return String(ref).replace(/https?:\/\/\S+/g, ' ').replace(/\b10\.\d{4,9}\/\S+/g, ' ').replace(/\b\d+\s*[-–]\s*\d+\b/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 300);
  }

  function authorsText(rec, n) {
    n = n || 3;
    if (!rec || !rec.authors.length) return '';
    const list = rec.authors.slice(0, n).map((a) => (a.given ? a.given.split(/[\s-]+/).map((g) => g[0]).filter(Boolean).join('') + ' ' : '') + a.family);
    return list.join(', ') + (rec.authors.length > n ? ' and ' + (rec.authors.length - n) + ' more' : '');
  }

  const api = { split, findDoi, years, legal, fromCrossref, fromOpenAlex, assess, best, query, words, authorsText };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.CiteCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
