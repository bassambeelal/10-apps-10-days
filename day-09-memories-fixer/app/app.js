'use strict';
// Memories Fixer: the page. Two streaming passes over the export ZIPs so a large export never sits in memory whole:
// pass 1 lists the memories and reads memories_history.json; pass 2 fixes each file and writes it out.

const work = document.getElementById('work');
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const nf = new Intl.NumberFormat('en-GB');
let inputs = [];      // File objects: ZIPs, or loose JSON/photos/videos
let found = null;     // result of pass 1
let mergeOverlays = true;
const deviceZone = (() => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'; } catch { return 'UTC'; } })();
let chosenZone = deviceZone; // for memories with no place

const isMemory = (path) => /(^|\/)memories(\/|_)/i.test(path) || /^(\d{4}-\d{2}-\d{2})_[^/]*-(main|overlay)\./i.test(path.split('/').pop());
const concat = (chunks) => { if (chunks.length === 1) return chunks[0]; const n = chunks.reduce((s, c) => s + c.length, 0); const out = new Uint8Array(n); let o = 0; for (const c of chunks) { out.set(c, o); o += c.length; } return out; };

/** Streams one ZIP, handing each wanted entry to onEntry one at a time, and lets the entries already read
    finish before reading on. An entry can span several reads, so only entries whose last byte has arrived
    are waited for; waiting on one that is still arriving would stop the stream for good. */
async function eachEntry(file, want, onEntry) {
  const uz = new fflate.Unzip();
  uz.register(fflate.UnzipInflate); // synchronous: every entry completed by a push has called back before push returns
  let queue = Promise.resolve();
  let failed = null;
  uz.onfile = (f) => {
    if (!want(f.name)) return; // never started, so never decompressed
    const chunks = [];
    f.ondata = (err, chunk, final) => {
      if (err) { failed = failed || err; return; }
      chunks.push(chunk);
      if (final) { const data = concat(chunks); queue = queue.then(() => onEntry(f.name, data)); }
    };
    f.start();
  };
  const reader = file.stream().getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) uz.push(new Uint8Array(0), true);
    else uz.push(value);
    if (failed) throw failed;
    await queue;
    if (done) break;
  }
}

async function eachInput(want, onEntry, onProgress) {
  for (let i = 0; i < inputs.length; i++) {
    const f = inputs[i];
    onProgress?.(i, f.name);
    if (/\.zip$/i.test(f.name)) await eachEntry(f, want, onEntry);
    else if (want(f.name)) await onEntry(f.name, new Uint8Array(await f.arrayBuffer()));
  }
}

// ---------- pass 1 ----------
async function scan() {
  renderBusy('Reading your export…', 0);
  const names = [];
  const history = [];
  try {
    await eachInput(
      (p) => { if (isMemory(p) && Fix.parseName(p)) names.push(p); return /memories_history\.json$/i.test(p); },
      async (p, data) => { history.push(...Fix.readHistory(JSON.parse(new TextDecoder().decode(data)))); },
      (i, name) => renderBusy(`Reading ${name}…`, i / inputs.length),
    );
  } catch (e) {
    return renderError(`One of the files couldn't be read (${e.message}). Check that every ZIP finished downloading.`);
  }
  const files = names.map((p) => ({ path: p, ...Fix.parseName(p) }));
  const mains = files.filter((f) => f.part === 'main');
  const overlayIds = new Set(files.filter((f) => f.part === 'overlay').map((f) => f.id));
  const matched = Fix.assignZones(Fix.match(mains, history), chosenZone);
  found = { files, history, mains: matched, overlayIds };
  renderFound();
}

// ---------- pass 2 ----------
async function fix() {
  const out = await openOutput();
  if (!out) return;
  const byPath = new Map(found.mains.map((m) => [m.path, m]));
  const byId = new Map(found.mains.map((m) => [m.id, m]));
  const waiting = new Map(); // id -> {main?: Uint8Array, overlay?: Uint8Array}
  const used = new Set();
  const stats = { photos: 0, videos: 0, merged: 0, located: 0, exact: 0, day: 0, failed: 0 };
  const total = found.files.length;
  let done = 0;
  const unique = (name) => { let n = name, i = 2; while (used.has(n)) n = name.replace(/(\.[^.]+)$/, `-${i++}$1`); used.add(n); return n; };

  async function emit(m, data, kind) {
    const name = unique(Fix.outName(kind === 'overlay' ? { ...m, part: 'overlay', ext: 'png' } : m));
    await out.write(name, data, m.date);
  }
  async function finishPhoto(m, main, overlay) {
    let bytes = main;
    if (overlay && mergeOverlays) {
      try { bytes = await composite(main, overlay); stats.merged++; } catch { bytes = main; await emit(m, overlay, 'overlay'); }
    } else if (overlay) await emit(m, overlay, 'overlay');
    if (/^jpe?g$/.test(m.ext) || (overlay && mergeOverlays)) {
      try { bytes = Fix.writeJpegExif(piexif, bytes, m.date, m.loc, m.zone); if (overlay && mergeOverlays) m = { ...m, ext: 'jpg' }; } catch { stats.failed++; }
    }
    await emit(m, bytes, 'main');
    stats.photos++; stats[m.how]++; if (m.loc) stats.located++;
  }

  try {
    await eachInput((p) => isMemory(p) && !!Fix.parseName(p), async (p, data) => {
      const f = Fix.parseName(p);
      const m = f.part === 'main' ? byPath.get(p) : byId.get(f.id);
      done++;
      if (done % 5 === 0) renderBusy(`Fixing ${nf.format(done)} of ${nf.format(total)}…`, done / total);
      if (!m) { await out.write(unique(p.split('/').pop()), data, null); return; } // an overlay with no main: keep it as it is
      if (m.video) {
        if (f.part === 'overlay') { await emit(m, data, 'overlay'); return; }
        const copy = data.slice();
        try { if (Fix.writeMp4Date(copy, m.date) === 0) stats.failed++; } catch { stats.failed++; }
        await emit(m, copy, 'main'); stats.videos++; stats[m.how]++; if (m.loc) stats.located++;
        return;
      }
      const hasOverlay = found.overlayIds.has(m.id);
      if (!hasOverlay) return finishPhoto(m, data, null);
      const w = waiting.get(m.id) || {};
      w[f.part] = data;
      if (w.main && w.overlay) { waiting.delete(m.id); await finishPhoto(m, w.main, w.overlay); }
      else waiting.set(m.id, w);
    });
    for (const [id, w] of waiting) if (w.main) await finishPhoto(byId.get(id), w.main, null); // overlay never arrived
    const link = await out.close();
    renderDone(stats, link, out.kind);
  } catch (e) {
    renderError(`Stopped after ${nf.format(done)} files: ${e.message}. Nothing you started with was changed.`);
  }
}

async function composite(mainBytes, overlayBytes) {
  const [a, b] = await Promise.all([createImageBitmap(new Blob([mainBytes])), createImageBitmap(new Blob([overlayBytes]))]);
  const c = new OffscreenCanvas(a.width, a.height);
  const ctx = c.getContext('2d');
  ctx.drawImage(a, 0, 0);
  ctx.drawImage(b, 0, 0, a.width, a.height);
  a.close(); b.close();
  return new Uint8Array(await (await c.convertToBlob({ type: 'image/jpeg', quality: 0.92 })).arrayBuffer());
}

/** A folder on disk where the browser allows it (fast, no size limit); otherwise one ZIP to download. */
async function openOutput() {
  if (window.showDirectoryPicker && document.getElementById('to-folder')?.checked) {
    let dir;
    try { dir = await window.showDirectoryPicker({ mode: 'readwrite', id: 'memories' }); } catch { return null; }
    return {
      kind: 'folder',
      async write(name, data) { const h = await dir.getFileHandle(name, { create: true }); const w = await h.createWritable(); await w.write(data); await w.close(); },
      async close() { return dir.name; },
    };
  }
  const parts = [];
  const zip = new fflate.Zip((err, chunk) => { if (!err) parts.push(chunk); });
  return {
    kind: 'zip',
    async write(name, data, date) {
      const e = new fflate.ZipPassThrough(name);
      if (date) e.mtime = date;
      zip.add(e); e.push(data, true);
    },
    async close() { zip.end(); return URL.createObjectURL(new Blob(parts, { type: 'application/zip' })); },
  };
}

// ---------- rendering ----------
function renderDrop() {
  work.innerHTML = `<header><h2 id="h-work">Your export</h2></header>
    <label class="drop" id="drop" for="pick">
      <svg width="40" height="40" viewBox="0 0 40 40" aria-hidden="true"><rect x="6" y="9" width="28" height="23" rx="5" fill="none" stroke="#b4b4b4" stroke-width="1.5"/><path d="M20 26V15M15 20l5-5 5 5" fill="none" stroke="#f2b33d" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
      <strong>Drop your Snapchat ZIPs here</strong>
      <p>Or tap to choose them. Pick every ZIP from the email at once, for example mydata~1699.zip and the memories parts.</p>
      <span class="btn primary" aria-hidden="true">Choose files</span>
    </label>
    <input id="pick" type="file" multiple accept=".zip,.json,image/*,video/*" hidden>`;
  const drop = document.getElementById('drop');
  document.getElementById('pick').addEventListener('change', (e) => start([...e.target.files]));
  drop.addEventListener('dragover', (e) => { e.preventDefault(); drop.classList.add('over'); });
  drop.addEventListener('dragleave', () => drop.classList.remove('over'));
  drop.addEventListener('drop', (e) => { e.preventDefault(); drop.classList.remove('over'); start([...e.dataTransfer.files]); });
}
function start(files) { if (!files.length) return; inputs = files; scan(); }

function renderBusy(text, p) {
  work.innerHTML = `<header><h2 id="h-work">Working</h2></header><div class="progress" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(p * 100)}"><i style="width:${Math.max(2, p * 100)}%"></i></div><p class="status">${esc(text)}</p><p class="note">Keep this tab open. Large exports take a few minutes.</p>`;
}
function renderError(text) {
  work.innerHTML = `<header><h2 id="h-work">Something went wrong</h2></header><p class="err">${esc(text)}</p><div class="done-actions"><button class="btn" type="button" data-again>Start again</button></div>`;
}

function yearsStrip(dates) {
  const counts = new Map();
  for (const d of dates) counts.set(d.getUTCFullYear(), (counts.get(d.getUTCFullYear()) || 0) + 1);
  const years = [...counts.keys()].sort();
  if (!years.length) return '';
  const all = []; for (let y = years[0]; y <= years[years.length - 1]; y++) all.push(y);
  const max = Math.max(...counts.values());
  return `<div class="years" role="img" aria-label="${all.map((y) => `${y}: ${counts.get(y) || 0}`).join(', ')}">${all.map((y) => `<div class="y" title="${y}: ${nf.format(counts.get(y) || 0)} memories"><div class="bar" style="height:${((counts.get(y) || 0) / max) * 100}%"></div><span>${y}</span></div>`).join('')}</div>
    <div class="years-head"><span>Memories per year, ${all[0]} to ${all[all.length - 1]}</span><span>Most: ${nf.format(max)}</span></div>`;
}

function renderFound() {
  const f = found;
  const photos = f.mains.filter((m) => !m.video).length;
  const videos = f.mains.length - photos;
  const exact = f.mains.filter((m) => m.how === 'exact').length;
  const located = f.mains.filter((m) => m.loc).length;
  if (!f.mains.length) {
    work.innerHTML = `<header><h2 id="h-work">No memories found</h2></header>
      <p>${f.history.length ? `The dates for ${nf.format(f.history.length)} memories are here, but none of the photos or videos are.` : 'There are no Snapchat memories in these files.'} When you request your data, tick "export your Memories", then add every ZIP from the email.</p>
      <div class="done-actions"><button class="btn" type="button" data-again>Choose other files</button></div>`;
    return;
  }
  const canFolder = !!window.showDirectoryPicker;
  work.innerHTML = `<header><h2 id="h-work">What's in your export</h2><span class="meta">${inputs.length} ${inputs.length === 1 ? 'file' : 'files'}</span></header>
    <div class="figures"><div><div class="v">${nf.format(photos)}</div><div class="l">photos</div></div><div><div class="v">${nf.format(videos)}</div><div class="l">videos</div></div><div><div class="v">${nf.format(f.overlayIds.size)}</div><div class="l">captions to merge</div></div></div>
    ${yearsStrip(f.mains.map((m) => m.date))}
    <div class="lines">
      <span><b>${nf.format(exact)}</b> get their exact date and time. ${f.mains.length - exact ? `<b>${nf.format(f.mains.length - exact)}</b> get the right day, but not the time.` : ''}</span>
      <span><b>${nf.format(located)}</b> get the place they were taken.</span>
      ${f.history.length ? '' : '<span class="err">memories_history.json wasn\'t found, so dates come from the file names only. Add the ZIP that contains it for exact times and places.</span>'}
    </div>
    ${zoneBlock()}
    ${previewBlock()}
    <label class="check"><input type="checkbox" id="merge" ${mergeOverlays ? 'checked' : ''}> Put captions and stickers back on the photos</label>
    ${canFolder ? '<label class="check"><input type="checkbox" id="to-folder" checked> Save straight into a folder (best for big exports)</label>' : '<p class="note">This browser will give you one ZIP to download. For very large exports, use Chrome or Edge on a computer.</p>'}
    <div class="done-actions"><button class="btn amber" type="button" data-fix>Fix ${nf.format(f.mains.length)} memories</button><button class="btn" type="button" data-again>Start again</button></div>`;
  document.getElementById('merge').addEventListener('change', (e) => { mergeOverlays = e.target.checked; });
  const zs = document.getElementById('zone');
  if (zs) zs.addEventListener('change', (e) => { chosenZone = e.target.value; found.mains = Fix.assignZones(found.mains, chosenZone); renderFound(); document.getElementById('zone')?.focus(); });
}

// Where the times come from: each memory's place, or the zone picked here.
function zoneName(z) { return z ? z.split('/').pop().replace(/_/g, ' ') : 'this device'; }
function zoneBlock() {
  const placed = found.mains.filter((m) => m.zoneFrom === 'place');
  const zones = new Set(placed.map((m) => m.zone));
  const rest = found.mains.length - placed.length;
  let list = [];
  try { list = Intl.supportedValuesOf('timeZone'); } catch { list = [deviceZone]; }
  if (!list.includes(chosenZone)) list = [chosenZone, ...list];
  const opts = list.map((z) => `<option value="${esc(z)}"${z === chosenZone ? ' selected' : ''}>${esc(z.replace(/_/g, ' '))}${z === deviceZone ? ' (this device)' : ''}</option>`).join('');
  return `<div class="zone">
    <p><b style="color:var(--text);font-weight:500">Times are set in the local time where each memory was taken.</b> ${placed.length ? `${nf.format(placed.length)} of ${nf.format(found.mains.length)} have a place, so their time zone comes from it (${nf.format(zones.size)} ${zones.size === 1 ? 'zone' : 'zones'}: ${[...zones].slice(0, 4).map(zoneName).map(esc).join(', ')}${zones.size > 4 ? '…' : ''}).` : 'None of them has a place.'}</p>
    ${rest ? `<label for="zone">Time zone for the ${nf.format(rest)} without a place</label><select id="zone">${opts}</select><p>Pick where you were for most of them. Your phone's photo app then shows the time on the clock there.</p>` : ''}
  </div>`;
}
const dfWhen = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
function whenText(m) {
  const w = Fix.wall(m.date, m.zone);
  const d = new Date(Date.UTC(w.y, w.mo - 1, w.d, 12));
  const day = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(d);
  return m.how === 'exact' ? `${day}, ${String(w.h).padStart(2, '0')}:${String(w.mi).padStart(2, '0')}` : `${day}, time unknown`;
}
function previewBlock() {
  const rows = found.mains.slice().sort((a, b) => b.date - a.date).slice(0, 6);
  void dfWhen;
  return `<div class="preview"><h3>What each file becomes</h3>
    <table><thead><tr><th scope="col">Snapchat's file</th><th scope="col">Date and time</th><th scope="col">Place</th></tr></thead><tbody>
    ${rows.map((m) => `<tr><td class="file">${esc(m.path.split('/').pop().slice(0, 28))}${m.path.split('/').pop().length > 28 ? '…' : ''}</td>
      <td class="when">${esc(whenText(m))}<small>${esc(m.how === 'exact' ? zoneName(m.zone) + ' time (UTC' + Fix.offsetText(Fix.wall(m.date, m.zone).offset) + ')' : 'the right day, from the file name')}</small></td>
      <td class="where">${m.loc ? `<span style="white-space:nowrap">${m.loc.lat.toFixed(3)}, ${m.loc.lon.toFixed(3)}</span>` : '<span style="color:var(--muted)">No place</span>'}</td></tr>`).join('')}
    </tbody></table>${found.mains.length > rows.length ? `<p class="more">and ${nf.format(found.mains.length - rows.length)} more, newest first.</p>` : ''}</div>`;
}

function renderDone(s, link, kind) {
  work.innerHTML = `<header><h2 id="h-work">Done</h2></header>
    <div class="figures"><div><div class="v">${nf.format(s.photos)}</div><div class="l">photos dated</div></div><div><div class="v">${nf.format(s.videos)}</div><div class="l">videos dated</div></div><div><div class="v">${nf.format(s.merged)}</div><div class="l">captions merged</div></div></div>
    <div class="lines"><span><b>${nf.format(s.exact)}</b> with exact time, <b>${nf.format(s.day)}</b> with the day only, <b>${nf.format(s.located)}</b> with a place.</span>
    ${s.failed ? `<span class="err">${nf.format(s.failed)} files couldn't be changed and were saved as they were.</span>` : ''}
    <span>${kind === 'folder' ? `Everything is in the folder <b>${esc(link)}</b>.` : 'Download the ZIP, unzip it, and add the folder to Google Photos or your gallery.'} File names start with the date, so they sort in order anywhere.</span></div>
    <div class="done-actions">${kind === 'zip' ? `<a class="btn amber" href="${link}" download="memories-fixed.zip">Download memories-fixed.zip</a>` : ''}<button class="btn" type="button" data-again>Fix another export</button></div>`;
}

document.addEventListener('click', (e) => {
  if (e.target.closest('[data-again]')) { found = null; inputs = []; renderDrop(); }
  if (e.target.closest('[data-fix]')) fix();
});

renderDrop();
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('sw.js').catch(() => {});
