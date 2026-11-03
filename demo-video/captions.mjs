// Closed captions (SRT) for a demo, from its narration and the moments the stage started each line.
// build.mjs writes media/demo.srt on every render. For a video rendered before that, rebuild its captions
// from the render's timing files in DEMO_WORK:
//   node demo-video/captions.mjs day-07-qr-check
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const MAX_LINE = 42; // characters per caption line, the usual limit for readable subtitles

/** One or two lines, broken at the space that keeps the longer line shortest. */
function lines(text) {
  if (text.length <= MAX_LINE) return text;
  let best = -1, bestLen = Infinity;
  for (let i = 0; i < text.length; i++) {
    if (text[i] !== ' ') continue;
    const len = Math.max(i, text.length - i - 1);
    if (len < bestLen) { best = i; bestLen = len; }
  }
  return best < 0 ? text : text.slice(0, best) + '\n' + text.slice(best + 1);
}
const fits = (t) => lines(t).split('\n').every((l) => l.length <= MAX_LINE);

/** k pieces of about equal length, split between words. */
function even(text, k) {
  const words = text.split(' ');
  const out = [];
  let cur = '';
  for (const w of words) {
    const left = text.length - out.join(' ').length - cur.length;
    const target = (left + cur.length) / (k - out.length);
    if (cur && out.length < k - 1 && cur.length + 1 + w.length > target) { out.push(cur); cur = w; }
    else cur = cur ? cur + ' ' + w : w;
  }
  out.push(cur);
  return out;
}

/** Joins neighbours while the result still fits one caption. */
function greedy(parts) {
  const out = [];
  for (const p of parts) {
    if (out.length && fits(out[out.length - 1] + ' ' + p)) out[out.length - 1] += ' ' + p;
    else out.push(p);
  }
  return out;
}

/** Caption pieces for a line of narration: whole sentences, then clauses, then even splits. */
function chunks(text) {
  const sentences = greedy(text.split(/(?<=[.!?;]["\u201d\u2019)]?)\s+(?=\S)/));
  const out = [];
  for (const sentence of sentences) {
    if (fits(sentence)) { out.push(sentence); continue; }
    for (const clause of greedy(sentence.split(/(?<=[,:])\s+/))) {
      if (fits(clause)) { out.push(clause); continue; }
      for (let k = 2; k < 8; k++) { const p = even(clause, k); if (p.every(fits)) { out.push(...p); break; } }
    }
  }
  return out;
}

/** Cues for one demo: each line's time is shared between its pieces by length. */
export function cues(DEMO, starts, durations) {
  const all = [];
  DEMO.segments.forEach((seg, i) => {
    const text = (seg.sub || seg.say).replace(/\s+/g, ' ').trim();
    const parts = chunks(text);
    const speech = Math.max(0.8, durations[i] - 0.12); // the voice files end with a short tail of silence
    const total = parts.reduce((a, p) => a + p.length, 0);
    let t = starts[i];
    for (const p of parts) {
      const d = speech * (p.length / total);
      all.push({ start: t, end: t + d, text: lines(p) });
      t += d;
    }
  });
  // Hold each cue until the next one, up to a beat, so short lines stay readable.
  for (let i = 0; i < all.length; i++) {
    const next = i + 1 < all.length ? all[i + 1].start : Infinity;
    all[i].end = Math.min(next - 0.04, Math.max(all[i].end + 0.35, all[i].start + 1.2));
  }
  return all;
}

const stamp = (s) => {
  const ms = Math.max(0, Math.round(s * 1000));
  const p = (n, w) => String(n).padStart(w, '0');
  return `${p(Math.floor(ms / 3600000), 2)}:${p(Math.floor(ms / 60000) % 60, 2)}:${p(Math.floor(ms / 1000) % 60, 2)},${p(ms % 1000, 3)}`;
};

export function toSrt(list, offset = 0, first = 1) {
  return list.map((c, i) => `${first + i}\n${stamp(c.start + offset)} --> ${stamp(c.end + offset)}\n${c.text}\n`).join('\n');
}

export function readDemo(root, name) {
  const sandbox = { window: {} };
  vm.runInNewContext(fs.readFileSync(path.join(root, 'demo-video/scripts', name + '.js'), 'utf8'), sandbox);
  return sandbox.window.DEMO;
}

// CLI: rebuild a rendered demo's captions from its timing files.
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname)) {
  const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
  const name = process.argv[2];
  const WORK = path.join(process.env.DEMO_WORK || '/tmp/demo-work', name);
  const DEMO = readDemo(ROOT, name);
  const mix = JSON.parse(fs.readFileSync(path.join(WORK, 'mix-in.json'), 'utf8'));
  const voice = JSON.parse(fs.readFileSync(path.join(WORK, 'tts-out.json'), 'utf8'));
  const list = cues(DEMO, mix.segments.map((s) => s.start), voice.map((v) => v.seconds));
  const out = path.join(ROOT, DEMO.out || path.join(name, 'media'), 'demo.srt');
  fs.writeFileSync(out, toSrt(list));
  console.log('[' + name + '] wrote', path.relative(ROOT, out), '(' + list.length + ' captions)');
}
