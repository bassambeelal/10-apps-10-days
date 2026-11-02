// Hidden Text Finder: the PDF reader.
// Each page is rendered, then every piece of text the file contains is checked against the pixels
// actually drawn where it sits. Text the file holds but the page does not show (the same colour as
// the page, covered by a shape, set never to be painted, inside a hidden layer) has no ink under it.
// Text is also checked for its size and for whether it sits on the page at all.
import * as pdfjsLib from './lib/pdfjs/pdf.min.mjs';
import { aiInstruction, looksLikeKeywords } from './phrases.js';

const base = new URL('./lib/pdfjs/', import.meta.url).href;
pdfjsLib.GlobalWorkerOptions.workerSrc = base + 'pdf.worker.min.mjs';

const SCALE = 2;          // analysis resolution: 144 dpi
const TINY_PT = 3;        // text under 3 pt is microscopic
const INVISIBLE_CR = 1.12; // contrast between ink and background below this: nothing visible
const FAINT_CR = 1.45;     // below this: a reader would not notice it

export class ReadError extends Error {}

function openDoc(bytes) {
  return pdfjsLib.getDocument({
    data: bytes,
    isEvalSupported: false,
    enableXfa: false,
    disableFontFace: false,
    standardFontDataUrl: base + 'standard_fonts/',
    cMapUrl: base + 'cmaps/',
    cMapPacked: true,
    wasmUrl: base + 'wasm/',
    iccUrl: base + 'iccs/',
    stopAtErrors: false,
  });
}

export async function loadPdf(bytes) {
  const task = openDoc(bytes.slice(0));
  task.onPassword = () => { task.destroy(); };
  try {
    return await task.promise;
  } catch (e) {
    if (e && (e.name === 'PasswordException' || /password/i.test(e.message || ''))) throw new ReadError('This PDF is locked with a password, so its text can’t be read.');
    if (e && (e.name === 'InvalidPDFException' || /invalid|missing pdf/i.test(e.message || ''))) throw new ReadError('This file isn’t a readable PDF. It may be damaged, or another kind of file renamed.');
    throw new ReadError('This PDF couldn’t be opened: ' + ((e && e.message) || 'unknown error') + '.');
  }
}

function lum(r, g, b) {
  const f = (c) => { c /= 255; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}
function contrast(a, b) { return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05); }

// How visible is whatever is drawn inside this box? Background is the commonest shade; ink is the
// strongest departure from it (98th percentile, so stray anti-aliasing does not count).
function inkIn(img, W, H, x, y, w, h) {
  const x0 = Math.max(0, Math.floor(x)), y0 = Math.max(0, Math.floor(y));
  const x1 = Math.min(W, Math.ceil(x + w)), y1 = Math.min(H, Math.ceil(y + h));
  if (x1 - x0 < 1 || y1 - y0 < 1) return { cr: 1, ratio: 0, n: 0 };
  const L = [];
  const step = (x1 - x0) * (y1 - y0) > 40000 ? 2 : 1;
  for (let yy = y0; yy < y1; yy += step) {
    for (let xx = x0; xx < x1; xx += step) {
      const i = (yy * W + xx) * 4;
      L.push(lum(img[i], img[i + 1], img[i + 2]));
    }
  }
  const sorted = L.slice().sort((a, b) => a - b);
  const bg = sorted[Math.floor(sorted.length / 2)];
  const diffs = L.map((v) => Math.abs(v - bg)).sort((a, b) => a - b);
  const d98 = diffs[Math.min(diffs.length - 1, Math.floor(diffs.length * 0.98))];
  const inkLum = L.reduce((best, v) => (Math.abs(v - bg) >= d98 - 1e-9 ? v : best), bg);
  const ratio = diffs.filter((d) => d > 0.04).length / diffs.length;
  return { cr: contrast(bg, inkLum), ratio, n: L.length };
}

function overlapFraction(r, W, H) {
  const ix = Math.max(0, Math.min(r.x + r.w, W) - Math.max(r.x, 0));
  const iy = Math.max(0, Math.min(r.y + r.h, H) - Math.max(r.y, 0));
  const area = Math.max(1e-6, r.w * r.h);
  return (ix * iy) / area;
}

const mul = (m, n) => [m[0] * n[0] + m[1] * n[2], m[0] * n[1] + m[1] * n[3], m[2] * n[0] + m[3] * n[2], m[2] * n[1] + m[3] * n[3], m[4] * n[0] + m[5] * n[2] + n[4], m[4] * n[1] + m[5] * n[3] + n[5]];
const apply = (m, x, y) => [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];

// pdf.js leaves text that sits wholly outside the page out of its text listing, which is exactly the
// text this tool is for. So the drawing operations are walked here, keeping the graphics and text
// matrices, and every string drawn is placed. Returns strings whose box misses the page entirely.
function textOutsidePage(opList, vpTransform, W, H) {
  const O = pdfjsLib.OPS;
  const found = [];
  let ctm = [1, 0, 0, 1, 0, 0];
  const stack = [];
  let tm = [1, 0, 0, 1, 0, 0], tlm = [1, 0, 0, 1, 0, 0];
  let size = 0, leading = 0, cs = 0, ws = 0, hs = 1, rise = 0;
  const { fnArray: fns, argsArray: args } = opList;
  for (let i = 0; i < fns.length; i++) {
    const fn = fns[i], a = args[i];
    if (fn === O.save) stack.push({ ctm, size, leading, cs, ws, hs, rise });
    else if (fn === O.restore) { const st = stack.pop(); if (st) ({ ctm, size, leading, cs, ws, hs, rise } = st); }
    else if (fn === O.transform) ctm = mul([a[0], a[1], a[2], a[3], a[4], a[5]], ctm);
    else if (fn === O.paintFormXObjectBegin) { stack.push({ ctm, size, leading, cs, ws, hs, rise }); if (a && a[0]) ctm = mul(Array.from(a[0]), ctm); }
    else if (fn === O.paintFormXObjectEnd) { const st = stack.pop(); if (st) ({ ctm, size, leading, cs, ws, hs, rise } = st); }
    else if (fn === O.beginText) { tm = [1, 0, 0, 1, 0, 0]; tlm = [1, 0, 0, 1, 0, 0]; }
    else if (fn === O.setFont) size = a[1];
    else if (fn === O.setLeading) leading = a[0];
    else if (fn === O.setCharSpacing) cs = a[0];
    else if (fn === O.setWordSpacing) ws = a[0];
    else if (fn === O.setHScale) hs = a[0] / 100;
    else if (fn === O.setTextRise) rise = a[0];
    else if (fn === O.setTextMatrix) { tm = Array.from(a.length === 6 ? a : a[0]); tlm = tm.slice(); }
    else if (fn === O.moveText) { tlm = mul([1, 0, 0, 1, a[0], a[1]], tlm); tm = tlm.slice(); }
    else if (fn === O.setLeadingMoveText) { leading = -a[1]; tlm = mul([1, 0, 0, 1, a[0], a[1]], tlm); tm = tlm.slice(); }
    else if (fn === O.nextLine) { tlm = mul([1, 0, 0, 1, 0, -leading], tlm); tm = tlm.slice(); }
    else if (fn === O.showText || fn === O.showSpacedText) {
      const glyphs = a[0] || [];
      let text = '', adv = 0;
      for (const g of glyphs) {
        if (typeof g === 'number') { adv -= (g / 1000) * size * hs; continue; }
        if (!g) continue;
        text += g.unicode || '';
        adv += (((g.width || 0) / 1000) * size + cs + (g.isSpace ? ws : 0)) * hs;
      }
      const m = mul(tm, ctm);
      const toDev = (x, y) => apply(vpTransform, ...apply(m, x, y));
      const pts = [toDev(0, rise), toDev(adv, rise), toDev(0, rise + size), toDev(adv, rise + size)];
      const xs = pts.map((q) => q[0]), ys = pts.map((q) => q[1]);
      const box = { x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) };
      tm = mul([1, 0, 0, 1, adv, 0], tm);
      const outside = box.x + box.w <= 0 || box.x >= W || box.y + box.h <= 0 || box.y >= H;
      if (outside && text.trim()) {
        const side = box.x + box.w <= 0 ? 'Left of the page' : box.x >= W ? 'Right of the page' : box.y + box.h <= 0 ? 'Above the page' : 'Below the page';
        const last = found[found.length - 1];
        if (last && last.side === side && Math.abs(last.y - box.y) < size * 1.6) last.text += (/\s$/.test(last.text) ? '' : ' ') + text;
        else found.push({ text, side, y: box.y, size });
      }
    }
  }
  return found;
}

export async function closePdf(doc) {
  try { if (doc.loadingTask) await doc.loadingTask.destroy(); else if (doc.destroy) await doc.destroy(); } catch (e) { /* already closed */ }
}

export async function analyzePdf(bytes, onProgress) {
  const doc = await loadPdf(bytes);
  const out = { kind: 'pdf', pageCount: doc.numPages, pages: [], findings: [], meta: {}, noText: false };
  let seq = 0;
  let anyText = false;
  const add = (f) => { f.id = 'f' + (++seq); f.ai = !!aiInstruction(f.text); f.keywords = !f.ai && looksLikeKeywords(f.text); out.findings.push(f); return f; };

  try {
    const md = await doc.getMetadata();
    const info = (md && md.info) || {};
    out.meta = { title: info.Title || '', author: info.Author || '', creator: info.Creator || '', producer: info.Producer || '' };
    [['Title', info.Title], ['Subject', info.Subject], ['Keywords', info.Keywords], ['Author', info.Author]].forEach(([field, v]) => {
      if (typeof v === 'string' && aiInstruction(v)) add({ kind: 'properties', page: 0, text: v.trim(), where: 'The file’s ' + field.toLowerCase() + ' field', rects: [] });
    });
  } catch (e) { /* metadata is optional */ }

  const pages = Math.min(doc.numPages, 40);
  for (let p = 1; p <= pages; p++) {
    if (onProgress) onProgress(p, pages);
    const page = await doc.getPage(p);
    const vp1 = page.getViewport({ scale: 1 });
    const vp = page.getViewport({ scale: SCALE });
    const W = Math.ceil(vp.width), H = Math.ceil(vp.height);
    const canvas = document.createElement('canvas');
    canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, W, H);
    await page.render({ canvasContext: ctx, canvas, viewport: vp, annotationMode: pdfjsLib.AnnotationMode.ENABLE }).promise;
    const img = ctx.getImageData(0, 0, W, H).data;
    const tc = await page.getTextContent({ includeMarkedContent: false });
    const pageOut = { number: p, width: vp1.width, height: vp1.height, lines: [] };
    let current = null; // the finding being grown from consecutive flagged pieces
    let line = [];

    for (const item of tc.items) {
      if (typeof item.str !== 'string') continue;
      const str = item.str;
      if (!str.trim()) { if (item.hasEOL && line.length) { pageOut.lines.push(line); line = []; } continue; }
      anyText = true;
      const tx = pdfjsLib.Util.transform(vp.transform, item.transform);
      const fontPx = Math.hypot(tx[2], tx[3]) || Math.abs(tx[3]) || 1;
      const fontPt = Math.hypot(item.transform[2], item.transform[3]) || fontPx / SCALE;
      const wPx = item.width ? item.width * SCALE : fontPx * 0.5 * str.length;
      const r = { x: tx[4], y: tx[5] - fontPx * 0.82, w: wPx, h: fontPx * 1.04 };
      let kind = null, detail = '';
      if (overlapFraction(r, W, H) < 0.5) {
        kind = 'offpage';
        detail = r.x + r.w <= 0 ? 'Left of the page' : r.x >= W ? 'Right of the page' : r.y + r.h <= 0 ? 'Above the page' : r.y >= H ? 'Below the page' : 'Mostly outside the page';
      } else if (fontPt < TINY_PT) {
        kind = 'tiny';
        detail = 'Set at ' + (Math.round(fontPt * 10) / 10) + ' pt';
      } else {
        const ink = inkIn(img, W, H, r.x, r.y, r.w, r.h);
        if (ink.cr < INVISIBLE_CR || ink.ratio < 0.004) { kind = 'invisible'; detail = ''; }
        else if (ink.cr < FAINT_CR) { kind = 'faint'; detail = 'Contrast ' + ink.cr.toFixed(2) + ' : 1 with the page'; }
      }
      // Rect in page points, for drawing over the page at any size.
      const rect = { x: r.x / SCALE, y: r.y / SCALE, w: r.w / SCALE, h: r.h / SCALE, t: str };
      if (kind) {
        const near = current && Math.abs(tx[5] - current.baseline) <= Math.max(fontPx, current.fontPx) * 1.6;
        if (current && current.kind === kind && current.page === p && near) {
          current.text += (current.joinSpace ? ' ' : '') + str;
          current.rects.push(rect);
        } else {
          current = add({ kind, page: p, text: str, rects: [rect], detail, sizePt: fontPt });
        }
        current.baseline = tx[5];
        current.fontPx = fontPx;
        current.joinSpace = !!item.hasEOL;
        line.push({ text: str, finding: current.id });
      } else {
        current = null;
        line.push({ text: str, finding: null });
      }
      if (item.hasEOL) { pageOut.lines.push(line); line = []; }
    }
    if (line.length) pageOut.lines.push(line);

    // Text drawn wholly outside the page, which pdf.js leaves out of the listing above.
    try {
      const ops = await page.getOperatorList();
      textOutsidePage(ops, vp1.transform, vp1.width, vp1.height).forEach((t) => {
        add({ kind: 'offpage', page: p, text: t.text, rects: [], detail: t.side, sizePt: t.size });
      });
    } catch (e) { /* the drawing operations are optional */ }

    // Visible text that reads as an instruction to AI screening software.
    pageOut.lines.forEach((ln) => {
      const visible = ln.filter((s) => !s.finding).map((s) => s.text).join('');
      const hit = aiInstruction(visible);
      if (hit) add({ kind: 'visibleai', page: p, text: visible.trim(), rects: [], detail: 'Visible on page ' + p });
    });

    try {
      const annots = await page.getAnnotations({ intent: 'display' });
      annots.forEach((a) => {
        const t = (a.contentsObj && a.contentsObj.str) || (typeof a.fieldValue === 'string' ? a.fieldValue : '') || '';
        const hiddenFlag = (a.annotationFlags & 2) === 2 || a.hidden;
        if (t.trim() && (hiddenFlag || aiInstruction(t))) add({ kind: 'annotation', page: p, text: t.trim(), rects: [], detail: hiddenFlag ? 'A hidden note on page ' + p : 'A note on page ' + p });
      });
    } catch (e) { /* annotations are optional */ }

    out.pages.push(pageOut);
    page.cleanup();
    canvas.width = canvas.height = 0;
  }
  if (doc.numPages > pages) out.truncated = doc.numPages - pages;
  out.findings.forEach((f) => { delete f.joinSpace; delete f.baseline; delete f.fontPx; f.text = f.text.replace(/\s+/g, ' ').trim(); f.ai = !!aiInstruction(f.text); f.keywords = !f.ai && looksLikeKeywords(f.text); });
  out.noText = !anyText;
  await closePdf(doc);
  return out;
}

// Draws one page for display. Returns the canvas; the caller places findings over it in page points.
export async function renderPage(doc, number, cssWidth) {
  const page = await doc.getPage(number);
  const vp1 = page.getViewport({ scale: 1 });
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const scale = (cssWidth / vp1.width) * dpr;
  const vp = page.getViewport({ scale });
  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil(vp.width);
  canvas.height = Math.ceil(vp.height);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  await page.render({ canvasContext: ctx, canvas, viewport: vp }).promise;
  page.cleanup();
  return canvas;
}
