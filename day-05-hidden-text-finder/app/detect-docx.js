// Hidden Text Finder: the Word (.docx) reader.
// A .docx file is a zip of XML. Each run of text carries its own formatting, inherited from the
// document defaults and the paragraph and character styles. A run is hidden when Word's Hidden
// option is on, when its colour matches what is behind it, when it is microscopic, or when it sits
// in a text box placed outside the page. The file's properties, comments and picture descriptions
// are checked too, since software reads them and people rarely do.
import { aiInstruction, looksLikeKeywords } from './phrases.js';

const W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const WP = 'http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing';
const TINY_HALF_POINTS = 6; // under 3 pt

export class DocxError extends Error {}

const HIGHLIGHT = { yellow: 'FFFF00', green: '00FF00', cyan: '00FFFF', magenta: 'FF00FF', blue: '0000FF', red: 'FF0000', darkBlue: '000080', darkCyan: '008080', darkGreen: '008000', darkMagenta: '800080', darkRed: '800000', darkYellow: '808000', darkGray: '808080', lightGray: 'C0C0C0', black: '000000', white: 'FFFFFF' };

function lum(hex) {
  const n = parseInt(hex, 16);
  const f = (c) => { c /= 255; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
  return 0.2126 * f((n >> 16) & 255) + 0.7152 * f((n >> 8) & 255) + 0.0722 * f(n & 255);
}
function contrast(a, b) { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); }
const isHex = (v) => typeof v === 'string' && /^[0-9a-f]{6}$/i.test(v);

function parse(xml, name) {
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  if (doc.getElementsByTagName('parsererror').length) throw new DocxError('Part of this Word file is damaged (' + name + ').');
  return doc;
}
const child = (el, local) => { if (!el) return null; for (const c of el.children) if (c.localName === local && c.namespaceURI === W) return c; return null; };
const attr = (el, local) => (el ? el.getAttributeNS(W, local) || el.getAttribute('w:' + local) : null);
const onOff = (el) => { if (!el) return null; const v = attr(el, 'val'); return !(v === '0' || v === 'false' || v === 'off'); };

// The formatting that matters here, read from one rPr element.
function readRPr(rPr) {
  const o = {};
  if (!rPr) return o;
  const v = child(rPr, 'vanish'); if (v) o.vanish = onOff(v);
  const sv = child(rPr, 'specVanish'); if (sv && onOff(sv)) o.vanish = true;
  const c = child(rPr, 'color'); if (c) { const val = attr(c, 'val'); o.color = val === 'auto' ? 'auto' : isHex(val) ? val.toUpperCase() : undefined; }
  const sz = child(rPr, 'sz'); if (sz) { const n = parseInt(attr(sz, 'val'), 10); if (n >= 0) o.sz = n; }
  const shd = child(rPr, 'shd'); if (shd) { const f = attr(shd, 'fill'); if (isHex(f)) o.shd = f.toUpperCase(); }
  const hl = child(rPr, 'highlight'); if (hl) { const h = HIGHLIGHT[attr(hl, 'val')]; if (h) o.highlight = h; }
  const rs = child(rPr, 'rStyle'); if (rs) o.rStyle = attr(rs, 'val');
  return o;
}

function loadStyles(stylesDoc) {
  const styles = {};
  let defaults = {};
  if (!stylesDoc) return { styles, defaults };
  const dd = stylesDoc.getElementsByTagNameNS(W, 'rPrDefault')[0];
  if (dd) defaults = readRPr(child(dd, 'rPr'));
  for (const s of stylesDoc.getElementsByTagNameNS(W, 'style')) {
    const id = attr(s, 'styleId');
    if (!id) continue;
    const based = child(s, 'basedOn');
    const pPr = child(s, 'pPr');
    const pshd = pPr && child(pPr, 'shd');
    styles[id] = { basedOn: based ? attr(based, 'val') : null, r: readRPr(child(s, 'rPr')), pShd: pshd && isHex(attr(pshd, 'fill')) ? attr(pshd, 'fill').toUpperCase() : null };
  }
  return { styles, defaults };
}
function styleChain(styles, id) {
  const chain = [];
  const seen = new Set();
  while (id && styles[id] && !seen.has(id)) { seen.add(id); chain.unshift(styles[id]); id = styles[id].basedOn; }
  return chain;
}

// Runs directly in a paragraph, looking through links, insertions and content controls, but not into
// text boxes (their paragraphs are read on their own).
function runsOf(p) {
  const out = [];
  const walk = (el) => {
    for (const c of el.children) {
      if (c.namespaceURI !== W) continue;
      if (c.localName === 'r') out.push(c);
      else if (['hyperlink', 'ins', 'smartTag', 'sdt', 'sdtContent', 'fldSimple', 'customXml', 'del', 'moveTo', 'moveFrom'].includes(c.localName)) walk(c);
    }
  };
  walk(p);
  return out;
}
function runText(r) {
  let t = '';
  for (const c of r.children) {
    if (c.namespaceURI !== W) continue;
    if (c.localName === 't' || c.localName === 'delText') t += c.textContent;
    else if (c.localName === 'tab') t += '\t';
    else if (c.localName === 'br' || c.localName === 'cr') t += ' ';
    else if (c.localName === 'noBreakHyphen') t += '-';
  }
  return t;
}

// Is this paragraph inside a text box that sits outside the page?
function offPageBox(p, page) {
  let el = p.parentElement;
  while (el && !(el.localName === 'anchor' && el.namespaceURI === WP)) el = el.parentElement;
  if (!el) return null;
  const extent = el.getElementsByTagNameNS(WP, 'extent')[0];
  const cx = extent ? parseInt(extent.getAttribute('cx'), 10) || 0 : 0;
  const cy = extent ? parseInt(extent.getAttribute('cy'), 10) || 0 : 0;
  const off = (tag) => {
    const pos = el.getElementsByTagNameNS(WP, tag)[0];
    const o = pos && pos.getElementsByTagNameNS(WP, 'posOffset')[0];
    return o ? parseInt(o.textContent, 10) : null;
  };
  const x = off('positionH'), y = off('positionV');
  const pw = page.w * 635, ph = page.h * 635; // twips to EMU
  if (x !== null && (x + cx <= 0 || x >= pw)) return x + cx <= 0 ? 'A text box left of the page' : 'A text box right of the page';
  if (y !== null && (y + cy <= 0 || y >= ph)) return y + cy <= 0 ? 'A text box above the page' : 'A text box below the page';
  return null;
}

const PART_LABEL = (name) => /header/.test(name) ? 'In the header' : /footer/.test(name) ? 'In the footer' : /footnotes/.test(name) ? 'In a footnote' : /endnotes/.test(name) ? 'In an endnote' : 'In the body';

export async function analyzeDocx(buffer) {
  if (!window.fflate) throw new DocxError('The Word reader did not load. Reload the page and try again.');
  let files;
  try {
    files = window.fflate.unzipSync(new Uint8Array(buffer), {
      filter: (f) => /^(word\/(document|styles|header\d*|footer\d*|footnotes|endnotes|comments)\.xml|docProps\/(core|app|custom)\.xml)$/.test(f.name) && f.originalSize < 30e6,
    });
  } catch (e) {
    throw new DocxError('This isn’t a readable Word file. It may be damaged, or an old .doc file renamed to .docx.');
  }
  const text = (n) => (files[n] ? new TextDecoder().decode(files[n]) : null);
  const docXml = text('word/document.xml');
  if (!docXml) throw new DocxError('This file has no Word document inside. Old .doc files need saving as .docx or PDF first.');

  const out = { kind: 'docx', findings: [], paragraphs: [], meta: {}, noText: false };
  let seq = 0;
  const add = (f) => { f.id = 'f' + (++seq); f.ai = !!aiInstruction(f.text); f.keywords = !f.ai && looksLikeKeywords(f.text); out.findings.push(f); return f; };
  const { styles, defaults } = loadStyles(files['word/styles.xml'] ? parse(text('word/styles.xml'), 'styles') : null);

  const main = parse(docXml, 'document');
  const bgEl = main.getElementsByTagNameNS(W, 'background')[0];
  const pageBg = bgEl && isHex(attr(bgEl, 'color')) ? attr(bgEl, 'color').toUpperCase() : 'FFFFFF';
  const pgSz = main.getElementsByTagNameNS(W, 'pgSz')[0];
  const page = { w: pgSz ? parseInt(attr(pgSz, 'w'), 10) || 11906 : 11906, h: pgSz ? parseInt(attr(pgSz, 'h'), 10) || 16838 : 16838 };

  const parts = Object.keys(files).filter((n) => /^word\/(document|header\d*|footer\d*|footnotes|endnotes)\.xml$/.test(n));
  parts.sort((a, b) => (a === 'word/document.xml' ? -1 : b === 'word/document.xml' ? 1 : a < b ? -1 : 1));
  let anyText = false;

  for (const name of parts) {
    const doc = name === 'word/document.xml' ? main : parse(text(name), name);
    const where = PART_LABEL(name);
    for (const p of doc.getElementsByTagNameNS(W, 'p')) {
      const pPr = child(p, 'pPr');
      const pStyleEl = pPr && child(pPr, 'pStyle');
      const pChain = styleChain(styles, pStyleEl ? attr(pStyleEl, 'val') : 'Normal');
      const pShdEl = pPr && child(pPr, 'shd');
      let pShd = pShdEl && isHex(attr(pShdEl, 'fill')) ? attr(pShdEl, 'fill').toUpperCase() : null;
      if (!pShd) pChain.forEach((s) => { if (s.pShd) pShd = s.pShd; });
      const boxOff = offPageBox(p, page);
      const segs = [];
      let current = null;
      for (const r of runsOf(p)) {
        const t = runText(r);
        if (!t) continue;
        if (t.trim()) anyText = true;
        const direct = readRPr(child(r, 'rPr'));
        const eff = Object.assign({}, defaults);
        pChain.forEach((s) => Object.assign(eff, s.r));
        styleChain(styles, direct.rStyle).forEach((s) => Object.assign(eff, s.r));
        Object.assign(eff, direct);
        const deleted = r.parentElement && r.parentElement.localName === 'del';
        const bg = eff.shd || eff.highlight || pShd || pageBg;
        const fg = !eff.color || eff.color === 'auto' ? (lum(bg) > 0.18 ? '000000' : 'FFFFFF') : eff.color;
        let kind = null, detail = '';
        if (!t.trim()) kind = null;
        else if (deleted) { kind = 'deleted'; detail = 'Removed with tracked changes'; }
        else if (eff.vanish) { kind = 'vanish'; detail = 'Formatted as Hidden'; }
        else if (boxOff) { kind = 'offpage'; detail = boxOff; }
        else if (eff.sz !== undefined && eff.sz < TINY_HALF_POINTS) { kind = 'tiny'; detail = 'Set at ' + eff.sz / 2 + ' pt'; }
        else {
          const cr = contrast(fg, bg);
          if (cr < 1.12) { kind = 'invisible'; detail = 'Text colour #' + fg + ' on #' + bg; }
          else if (cr < 1.45) { kind = 'faint'; detail = 'Contrast ' + cr.toFixed(2) + ' : 1 (#' + fg + ' on #' + bg + ')'; }
        }
        if (kind) {
          if (current && current.kind === kind) { current.text += t; }
          else current = add({ kind, where, text: t, detail, rects: [] });
          segs.push({ text: t, finding: current.id });
        } else {
          if (t.trim()) current = null;
          segs.push({ text: t, finding: null });
        }
      }
      if (segs.length) {
        out.paragraphs.push({ where, segs });
        const visible = segs.filter((s) => !s.finding).map((s) => s.text).join('');
        if (aiInstruction(visible)) add({ kind: 'visibleai', where, text: visible.trim(), detail: where, rects: [] });
      }
    }
    // Picture descriptions (alt text).
    for (const d of doc.getElementsByTagNameNS(WP, 'docPr')) {
      const alt = [d.getAttribute('descr'), d.getAttribute('title')].filter(Boolean).join(' ').trim();
      if (alt && (aiInstruction(alt) || looksLikeKeywords(alt))) add({ kind: 'alttext', where, text: alt, detail: 'Description of a picture', rects: [] });
    }
  }

  if (files['word/comments.xml']) {
    const c = parse(text('word/comments.xml'), 'comments');
    for (const cm of c.getElementsByTagNameNS(W, 'comment')) {
      const t = cm.textContent.trim();
      if (t && aiInstruction(t)) add({ kind: 'comment', where: 'A comment by ' + (attr(cm, 'author') || 'someone'), text: t, detail: 'Document comment', rects: [] });
    }
  }
  // Properties: title, subject, keywords, description, category, custom fields.
  ['docProps/core.xml', 'docProps/app.xml', 'docProps/custom.xml'].forEach((n) => {
    if (!files[n]) return;
    const d = parse(text(n), n);
    for (const el of d.getElementsByTagName('*')) {
      if (el.children.length) continue;
      const v = el.textContent.trim();
      if (!v) continue;
      const field = el.localName === 'lpwstr' && el.parentElement && el.parentElement.parentElement ? el.parentElement.parentElement.getAttribute('name') || 'custom' : el.localName;
      if (n === 'docProps/core.xml') {
        if (field === 'title') out.meta.title = v;
        if (field === 'creator') out.meta.author = v;
      }
      if (n === 'docProps/app.xml' && field === 'Application') out.meta.creator = v;
      if (aiInstruction(v)) add({ kind: 'properties', where: 'The file’s ' + field.replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase() + ' field', text: v, detail: 'File properties', rects: [] });
    }
  });

  out.findings.forEach((f) => { f.text = f.text.replace(/\s+/g, ' ').trim(); f.ai = !!aiInstruction(f.text); f.keywords = !f.ai && looksLikeKeywords(f.text); });
  out.findings = out.findings.filter((f) => f.text);
  out.noText = !anyText;
  return out;
}
