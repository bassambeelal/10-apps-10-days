/* QR Check: the interface. Three places: Check a code, My codes, Make a code.
   Codes are read on this device; the saved list stays in this browser. Text from a code is always
   set as text, never as HTML. */
(function () {
  'use strict';
  const Q = window.QRCore;
  const ICONS = window.QRIcons;
  window.qrcode.stringToBytes = window.qrcode.stringToBytesFuncs['UTF-8']; // any language scans back as written

  const $main = document.getElementById('main');
  const $side = document.getElementById('side');
  const $bar = document.getElementById('phone-bar');
  const $tabs = document.getElementById('tabbar');
  const $toasts = document.getElementById('toasts');
  const $photo = document.getElementById('photo');
  const $print = document.getElementById('print-sheet');

  // ---------- helpers ----------
  function h(tag, attrs) {
    const el = document.createElement(tag);
    if (attrs) for (const k in attrs) {
      const v = attrs[k];
      if (v == null || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
      else if (k === 'style') el.style.cssText = v;
      else if (k === 'value') el.value = v;
      else if (k === 'checked') el.checked = !!v;
      else el.setAttribute(k, v === true ? '' : v);
    }
    for (let i = 2; i < arguments.length; i++) add(el, arguments[i]);
    return el;
  }
  function add(el, k) { if (k == null || k === false) return; if (Array.isArray(k)) k.forEach((x) => add(el, x)); else el.append(k.nodeType ? k : String(k)); }
  function fill(el) { el.replaceChildren(); for (let i = 1; i < arguments.length; i++) add(el, arguments[i]); return el; }
  const SVGNS = 'http://www.w3.org/2000/svg';
  function icon(name, cls) {
    const s = document.createElementNS(SVGNS, 'svg');
    s.setAttribute('viewBox', '0 0 24 24'); s.setAttribute('class', 'i' + (cls ? ' ' + cls : '')); s.setAttribute('aria-hidden', 'true');
    s.innerHTML = ICONS[name] || ''; // bundled shapes only
    return s;
  }
  function mark() {
    const s = document.createElementNS(SVGNS, 'svg');
    s.setAttribute('viewBox', '0 0 24 24'); s.setAttribute('aria-hidden', 'true');
    s.innerHTML = '<rect x="2.5" y="2.5" width="7.5" height="7.5" rx="1.6" fill="none" stroke="currentColor" stroke-width="2"/><rect x="14" y="2.5" width="7.5" height="7.5" rx="1.6" fill="none" stroke="currentColor" stroke-width="2"/><rect x="2.5" y="14" width="7.5" height="7.5" rx="1.6" fill="none" stroke="currentColor" stroke-width="2"/><path d="M14.5 18l2.4 2.4 4.6-5.4" fill="none" stroke="#b8336a" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>';
    return s;
  }
  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { toast('Couldn’t save in this browser. Storage may be full or switched off.'); return false; } },
  };
  const dfDate = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
  const uid = () => Math.random().toString(36).slice(2, 10);
  function toast(msg, action) {
    const t = h('div', { class: 'toast', role: 'status' }, h('span', null, msg), action ? h('button', { class: 'act', type: 'button', onclick: () => { action.fn(); t.remove(); } }, action.label) : null);
    $toasts.append(t);
    while ($toasts.children.length > 2) $toasts.firstChild.remove();
    setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 200); }, action ? 6000 : 4000);
  }

  // ---------- state ----------
  const codes = () => store.get('qrc:codes', []).filter((c) => c && typeof c.text === 'string');
  const ui = {
    result: null, // { text, source, sample, savedId }
    make: { type: 'website', fields: {}, words: '', level: 'M' },
    lastRoute: '',
  };

  function route() {
    const m = location.hash.match(/^#\/(check|codes|make)/);
    return m ? m[1] : 'check';
  }

  // ---------- shell ----------
  const NAV = [['check', 'Check a code', 'scan'], ['codes', 'My codes', 'list'], ['make', 'Make a code', 'make']];
  function renderShell(r) {
    const n = codes().length;
    fill($side,
      h('a', { class: 'brand', href: '#/check' }, mark(), 'QR Check'),
      h('nav', { class: 'nav', 'aria-label': 'Sections' }, NAV.map(([id, label, ic]) =>
        h('a', { href: '#/' + id, 'aria-current': r === id ? 'page' : null }, icon(ic), label, id === 'codes' && n ? h('span', { class: 'count' }, String(n)) : null))),
      h('div', { class: 'side-foot' },
        h('p', null, icon('shield'), h('span', null, 'Works offline. Codes you scan are read on this device and never sent anywhere.')),
        themeSeg()));
    fill($bar, mark(), h('span', null, 'QR Check'), h('span', { class: 'theme' }, themeSeg(true)));
    fill($tabs, NAV.map(([id, label, ic]) => h('a', { href: '#/' + id, 'aria-current': r === id ? 'page' : null }, icon(ic), label.replace(' a code', ''))));
  }
  function themeSeg(compact) {
    let t = 'system';
    try { t = localStorage.getItem('qrc:theme') || 'system'; } catch (e) { /* off */ }
    const opts = compact ? [['system', 'Auto'], ['light', 'Light'], ['dark', 'Dark']] : [['system', 'Auto'], ['light', 'Light'], ['dark', 'Dark']];
    return h('div', { class: 'seg', role: 'group', 'aria-label': 'Theme' }, opts.map(([v, l]) => h('button', { type: 'button', 'aria-pressed': String(t === v), onclick: () => {
      try { if (v === 'system') localStorage.removeItem('qrc:theme'); else localStorage.setItem('qrc:theme', v); } catch (e) { /* off */ }
      if (v === 'system') document.documentElement.removeAttribute('data-theme'); else document.documentElement.setAttribute('data-theme', v);
      render();
    } }, l)));
  }

  function render() {
    const r = route();
    const changed = r !== ui.lastRoute;
    if (changed && ui.lastRoute === 'check') stopCamera();
    ui.lastRoute = r;
    renderShell(r);
    fill($main, r === 'codes' ? codesView() : r === 'make' ? makeView() : checkView());
    document.title = (r === 'codes' ? 'My codes' : r === 'make' ? 'Make a code' : 'Check a code') + ' · QR Check';
    if (changed) { window.scrollTo(0, 0); $main.focus({ preventScroll: true }); }
    if (r === 'make') updateSticker();
  }

  // ---------- check ----------
  const SAMPLES = [
    ['A hosted QR code', 'https://qrco.de/bfMenu42'],
    ['A short link', 'https://bit.ly/3menuNG'],
    ['A direct link', 'https://www.lumencafe.pt/menu'],
    ['Wi-Fi details', 'WIFI:T:WPA;S:Lumen Guest;P:flatwhite24;;'],
    ['A payment code', (function () { const b = '000201010211' + '26330014br.gov.bcb.pix0111123456789015204000053039865802BR5910LUMEN CAFE6009SAO PAULO6304'; return b + Q.crc16(b); })()],
  ];

  function checkView() {
    return h('div', null,
      h('div', { class: 'title-row' }, h('div', null, h('h1', null, 'Check a code'),
        h('p', { class: 'subline' }, ui.pendingLabel ? ['Checking: ', h('b', null, ui.pendingLabel), '. Scan or upload its code, then save it.'] : 'Scan the codes on your menus, flyers and signs. See whether a link service sits between the code and your page, holding the switch.'))),
      h('div', { class: 'grid' },
        h('section', { class: 's5 card', 'aria-labelledby': 'scan-h' },
          h('div', { class: 'card-head' }, h('h2', { id: 'scan-h' }, 'Scan or upload')),
          h('div', { class: 'card-body' }, finder(), pasteForm())),
        h('section', { class: 's7 card', 'aria-labelledby': 'res-h', id: 'result' }, resultBody())));
  }

  function finder() {
    const live = !!cam.stream;
    const box = h('div', { class: 'finder' + (live ? ' live' : ''), id: 'finder' });
    if (live) {
      box.append(cam.video, h('div', { class: 'corners', 'aria-hidden': 'true' }, h('i'), h('i'), h('i'), h('i')), h('div', { class: 'scanline', 'aria-hidden': 'true' }),
        h('div', { class: 'finder-live-actions' },
          cam.torch ? h('button', { class: 'btn', type: 'button', onclick: toggleTorch, 'aria-pressed': String(cam.torchOn) }, icon('torch'), cam.torchOn ? 'Light off' : 'Light') : null,
          h('button', { class: 'btn', type: 'button', onclick: () => { stopCamera(); render(); } }, icon('x'), 'Stop')));
    } else {
      box.append(h('div', { class: 'corners', 'aria-hidden': 'true' }, h('i'), h('i'), h('i'), h('i')),
        h('div', { class: 'finder-idle' }, icon('camera'),
          h('p', { id: 'finder-msg' }, cam.error || 'Hold the printed code inside the frame.'),
          h('div', { class: 'finder-actions' },
            h('button', { class: 'btn btn-primary', type: 'button', onclick: startCamera }, icon('camera'), 'Start the camera'),
            h('button', { class: 'btn btn-ghost', type: 'button', onclick: () => $photo.click() }, icon('upload'), 'Upload a photo'))));
    }
    return box;
  }

  function pasteForm() {
    const inp = h('input', { class: 'input', id: 'q', type: 'text', autocomplete: 'off', placeholder: 'https://bit.ly/menu', value: ui.result && !ui.result.sample ? ui.result.text : '' });
    return h('form', { class: 'paste', onsubmit: (e) => { e.preventDefault(); const v = inp.value.trim(); if (!v) { inp.focus(); return; } showResult(v, 'Pasted'); } },
      h('label', { class: 'label', for: 'q' }, 'Or paste what the code says'),
      h('div', { class: 'joined' }, inp, h('button', { class: 'btn btn-ghost', type: 'submit' }, 'Check')));
  }

  function showResult(text, source, opts) {
    ui.result = { text, source, label: ui.pendingLabel || '', sample: !!(opts && opts.sample), savedId: (opts && opts.savedId) || (codes().find((c) => c.text === text) || {}).id || null };
    if (route() !== 'check') { location.hash = '#/check'; return; }
    const box = document.getElementById('result');
    if (box) { fill(box, resultBody()); box.classList.remove('result-in'); void box.offsetWidth; box.classList.add('result-in'); if (window.innerWidth < 1024) box.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
    const q = document.getElementById('q');
    if (q && !ui.result.sample) q.value = text;
  }

  function chainView(r) {
    const nodes = [];
    r.chain.forEach(([k, v, cls], i) => {
      if (i) nodes.push(h('span', { class: 'arrow' + (r.chain[i][2] === 'mid' ? ' hot' : ''), 'aria-hidden': 'true' }));
      const end = !cls && i === r.chain.length - 1 && i > 0 && r.tone === 'positive';
      nodes.push(h('div', { class: 'node' + (cls ? ' ' + cls : '') + (end ? ' end' : '') }, h('span', { class: 'k' }, k), h('span', { class: 'v' }, v)));
    });
    return h('div', { class: 'chain', role: 'img', 'aria-label': r.chain.map((c) => c[0] + ': ' + c[1]).join(', then ') }, nodes);
  }

  function resultBody() {
    if (!ui.result) {
      const example = { tone: 'negative', chain: [['Printed code', 'QR'], ['Middleman', 'qrco.de', 'mid'], ['Then', 'your menu, for now', 'unknown']] };
      return [
        h('div', { class: 'card-head' }, h('h2', { id: 'res-h' }, 'What you’ll see')),
        h('div', { class: 'card-body' },
          chainView(example),
          h('p', { style: 'font-size:15px;line-height:23px' }, 'Many printed codes don’t point at your website. They point at a link service, which then sends people on. That service holds the switch: it can show adverts, or stop the code when a free trial ends, and every printed copy stops with it. QR Check shows whether there’s a middleman, and helps you make a direct code instead.'),
          h('p', { class: 'label', style: 'margin:20px 0 0' }, 'Try one'),
          h('div', { class: 'tries' }, SAMPLES.map(([label, text]) => h('button', { type: 'button', onclick: () => showResult(text, 'Sample', { sample: true }) }, label))),
          knownList()),
      ];
    }
    const { text, source, sample, savedId } = ui.result;
    const r = Q.classify(text);
    const isLink = !!r.url;
    const saveArea = h('div');
    const fillSave = () => {
      if (savedId || ui.result.savedId) { fill(saveArea, h('p', { class: 'saved-note' }, icon('check'), 'Saved in My codes. ', h('a', { class: 'link', href: '#/codes' }, 'See the list'))); return; }
      fill(saveArea);
    };
    fillSave();
    const openSave = () => {
      const inp = h('input', { class: 'input', id: 'where', placeholder: 'Menu, table tents, front window', maxlength: '60', autocomplete: 'off', value: ui.result.label || '' });
      fill(saveArea, h('form', { class: 'save-box', onsubmit: (e) => {
        e.preventDefault();
        const list = codes();
        const item = { id: uid(), text, label: inp.value.trim() || defaultLabel(r), savedAt: Date.now() };
        list.unshift(item);
        if (store.set('qrc:codes', list)) { ui.result.savedId = item.id; ui.pendingLabel = ''; renderShell(route()); fillSave(); toast('Saved: ' + item.label + '.'); }
      } },
        h('label', { class: 'label', for: 'where' }, 'Where is this code printed?'),
        h('div', { class: 'joined' }, inp, h('button', { class: 'btn btn-primary', type: 'submit' }, 'Save'))));
      inp.focus();
    };
    const actions = [];
    if (!savedId && !sample) actions.push(h('button', { class: 'btn btn-primary', type: 'button', onclick: openSave }, icon('save'), 'Save to My codes'));
    if (r.preview && !sample) actions.push(h('a', { class: 'btn btn-ghost', href: r.preview.href, target: '_blank', rel: 'noopener noreferrer' }, icon('eye'), 'See where it goes'));
    if (isLink && r.tone !== 'positive') actions.push(h('button', { class: 'btn btn-ghost', type: 'button', onclick: () => { ui.make = { type: 'website', fields: {}, words: '', level: 'M' }; location.hash = '#/make'; } }, icon('make'), 'Make a direct code'));
    if (isLink && !sample) actions.push(h('a', { class: 'btn btn-quiet', href: r.url.href, target: '_blank', rel: 'noopener noreferrer' }, icon('link'), 'Open the link'));
    actions.push(h('button', { class: 'btn btn-quiet', type: 'button', onclick: () => copy(text) }, icon('copy'), 'Copy'));
    return [
      h('div', { class: 'card-head' }, h('h2', { id: 'res-h' }, 'What’s in the code'), h('span', { class: 'meta' }, source || '')),
      h('div', { class: 'card-body' },
        chainView(r),
        h('div', { class: 'verdict' },
          h('span', { class: 'pill ' + r.tone }, r.pill),
          h('h2', null, r.title),
          h('p', null, r.say),
          r.todo.length ? h('ol', { class: 'todo' }, r.todo.map((t) => h('li', null, t))) : null),
        r.preview && !sample ? h('p', { class: 'hint', style: 'margin-top:12px' }, '“See where it goes” opens ' + r.preview.by + '’s own preview page, which names the destination without sending you there.') : null,
        sample ? h('p', { class: 'hint', style: 'margin-top:12px' }, 'This is a sample. Scan, upload or paste a real code to check it and save it.') : null,
        h('div', { class: 'actions' }, actions),
        saveArea,
        h('div', { class: 'raw' }, h('b', null, 'The code says: '), text.length > 400 ? text.slice(0, 400) + '…' : text)),
    ];
  }
  function defaultLabel(r) { return r.host ? 'Code for ' + r.host : r.kind === 'wifi' ? 'Wi-Fi code' : r.kind === 'pay' ? 'Payment code' : 'Printed code'; }
  function knownList() {
    return h('div', { class: 'known' }, h('h3', null, 'Middlemen it recognises'),
      h('div', { class: 'hosts' }, [...Q.QR_HOSTS, ...Q.SHORTENERS, ...Q.AD_GATED].map((d) => h('span', null, d))),
      h('p', { class: 'hint' }, 'Plus any address with “qr” in its name, flagged as probably a QR service.'));
  }
  async function copy(text) {
    try { await navigator.clipboard.writeText(text); toast('Copied.'); } catch (e) { toast('Couldn’t copy. Select the text and copy it by hand.'); }
  }

  // ---------- decoding: photos and the camera ----------
  async function decodeFrom(source) {
    if ('BarcodeDetector' in window) {
      try {
        const det = new window.BarcodeDetector({ formats: ['qr_code'] });
        const found = await det.detect(source);
        if (found[0]) return found[0].rawValue;
      } catch (e) { /* fall back to jsQR */ }
    }
    const w = source.videoWidth || source.naturalWidth || source.width;
    const hgt = source.videoHeight || source.naturalHeight || source.height;
    if (!w || !hgt) return null;
    const scale = Math.min(1, 1200 / Math.max(w, hgt));
    const c = document.createElement('canvas');
    c.width = Math.round(w * scale); c.height = Math.round(hgt * scale);
    const ctx = c.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(source, 0, 0, c.width, c.height);
    const img = ctx.getImageData(0, 0, c.width, c.height);
    const res = window.jsQR(img.data, c.width, c.height, { inversionAttempts: 'attemptBoth' });
    return res ? res.data : null;
  }
  $photo.addEventListener('change', () => {
    const f = $photo.files[0];
    $photo.value = '';
    if (!f) return;
    const img = new Image();
    img.onload = async () => {
      const text = await decodeFrom(img).catch(() => null);
      URL.revokeObjectURL(img.src);
      if (text) showResult(text, 'From your photo');
      else toast('No QR code found in that photo. Take it straight on, closer, in good light.');
    };
    img.onerror = () => { URL.revokeObjectURL(img.src); toast('That file isn’t a photo this browser can open.'); };
    img.src = URL.createObjectURL(f);
  });

  const cam = { stream: null, video: null, torch: false, torchOn: false, error: '' };
  async function startCamera() {
    cam.error = '';
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      cam.error = 'This browser can’t use the camera here. Upload a photo of the code instead.';
      render(); return;
    }
    try {
      cam.stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
    } catch (e) {
      cam.error = e && e.name === 'NotAllowedError' ? 'Camera access was turned down. Allow it in the browser’s settings, or upload a photo instead.' : 'No camera could be opened. Upload a photo of the code instead.';
      render(); return;
    }
    cam.video = h('video', { playsinline: true, muted: true, 'aria-label': 'Camera view' });
    cam.video.srcObject = cam.stream;
    try { await cam.video.play(); } catch (e) { /* autoplay may wait for the element */ }
    const track = cam.stream.getVideoTracks()[0];
    try { cam.torch = !!(track.getCapabilities && track.getCapabilities().torch); } catch (e) { cam.torch = false; }
    render();
    const tick = async () => {
      if (!cam.stream) return;
      const text = await decodeFrom(cam.video).catch(() => null);
      if (text) {
        if (navigator.vibrate) navigator.vibrate(40);
        stopCamera(); render(); showResult(text, 'From the camera'); return;
      }
      setTimeout(tick, 220);
    };
    tick();
  }
  function stopCamera() {
    if (cam.stream) cam.stream.getTracks().forEach((t) => t.stop());
    cam.stream = null; cam.torchOn = false;
  }
  async function toggleTorch() {
    const track = cam.stream && cam.stream.getVideoTracks()[0];
    if (!track) return;
    try { cam.torchOn = !cam.torchOn; await track.applyConstraints({ advanced: [{ torch: cam.torchOn }] }); } catch (e) { cam.torchOn = false; toast('The light couldn’t be switched on.'); }
    render();
  }
  document.addEventListener('visibilitychange', () => { if (document.hidden && cam.stream) { stopCamera(); render(); } });

  // ---------- my codes ----------
  function codesView() {
    const list = codes();
    // Codes that depend on a middleman come first: they are the ones to replace.
    const classed = list.map((c) => ({ c, r: Q.classify(c.text) })).sort((a, b) => (b.r.tone === 'negative') - (a.r.tone === 'negative') || b.c.savedAt - a.c.savedAt);
    const bad = classed.filter((x) => x.r.tone === 'negative').length;
    const sub = list.length ? [h('b', null, list.length === 1 ? '1 code' : list.length + ' codes'), ' · ', bad ? (bad === 1 ? '1 depends on a middleman' : bad + ' depend on a middleman') : 'none depends on a middleman'] : 'Keep a list of every code you’ve printed, and see which ones a link service controls.';
    const rows = classed.map(({ c, r }) => h('tr', { onclick: (e) => { if (e.target.closest('button')) return; showResult(c.text, 'Saved ' + dfDate.format(new Date(c.savedAt)), { savedId: c.id }); } },
      h('td', { class: 'c-what' }, h('div', { class: 'where' }, c.label), h('div', { class: 'what' }, r.title)),
      h('td', { class: 'c-pill' }, h('span', { class: 'pill ' + r.tone }, r.pill)),
      h('td', { class: 'date' }, dfDate.format(new Date(c.savedAt))),
      h('td', { class: 'del' }, h('button', { class: 'btn btn-quiet btn-icon', type: 'button', 'aria-label': 'Remove ' + c.label, onclick: () => removeCode(c) }, icon('trash')))));
    return h('div', null,
      h('div', { class: 'title-row' }, h('div', null, h('h1', null, 'My codes'), h('p', { class: 'subline' }, sub)),
        list.length ? h('button', { class: 'btn btn-ghost', type: 'button', onclick: exportCsv }, icon('download'), 'Download the list') : null),
      h('div', { class: 'grid' },
        h('section', { class: (list.length ? 's8' : 's12') + ' card', 'aria-label': 'Saved codes' },
          list.length ? h('table', { class: 'codes' },
            h('thead', null, h('tr', null, h('th', { scope: 'col' }, 'Where it’s printed'), h('th', { scope: 'col' }, 'Result'), h('th', { scope: 'col', style: 'text-align:right' }, 'Checked'), h('th', null, h('span', { class: 'visually-hidden' }, 'Remove')))),
            h('tbody', null, rows)) : [
            h('div', { class: 'card-head' }, h('h2', null, 'Nothing saved yet')),
            h('div', { class: 'card-body' }, h('p', { class: 'hint', style: 'margin:0 0 16px' }, 'Go round everything you’ve printed and check each code once. Pick a place to start; it’s filled in for you when you save.'),
              h('ul', { class: 'places' }, PLACES.map(([label, ic]) => h('li', null, h('button', { type: 'button', onclick: () => { ui.pendingLabel = label; location.hash = '#/check'; } }, icon(ic), h('span', null, label), icon('arrowRight'))))))]),
        !list.length ? null : h('section', { class: 's4 card', 'aria-labelledby': 'tally-h' },
          h('div', { class: 'card-head' }, h('h2', { id: 'tally-h' }, 'Replace these first')),
          h('div', { class: 'card-body tally' },
            h('div', { class: 'row' }, h('span', null, 'Depend on a middleman'), h('span', { class: 'big' }, String(bad))),
            list.length ? h('div', { class: 'track', role: 'img', 'aria-label': bad + ' of ' + list.length + ' depend on a middleman' }, h('i', { class: 'bad', style: 'width:' + (bad / list.length * 100) + '%' }), h('i', { class: 'ok', style: 'width:' + ((list.length - bad) / list.length * 100) + '%' })) : null,
            h('p', { class: 'hint', style: 'margin:0' }, 'Codes behind a link service stop with it. Make a direct code to the same page, reprint, and check the new one here.')))));
  }
  const PLACES = [['Menus', 'text'], ['Table tents', 'scan'], ['Flyers and leaflets', 'text'], ['Front window', 'globe'], ['Packaging and labels', 'save'], ['Business cards', 'mail'], ['Posters and signs', 'print'], ['Receipts', 'list']];
  function removeCode(c) {
    const list = codes().filter((x) => x.id !== c.id);
    store.set('qrc:codes', list);
    if (ui.result && ui.result.savedId === c.id) ui.result.savedId = null;
    render();
    toast('Removed ' + c.label + '.', { label: 'Undo', fn: () => { const l = codes(); l.unshift(c); store.set('qrc:codes', l); render(); } });
  }
  function exportCsv() {
    const cell = (v) => { v = String(v == null ? '' : v); return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; };
    const rows = [['Where it’s printed', 'Result', 'What it does', 'What the code says', 'Checked']].concat(codes().map((c) => {
      const r = Q.classify(c.text);
      return [c.label, r.pill, r.title, c.text, new Date(c.savedAt).toISOString().slice(0, 10)];
    }));
    const a = h('a', { href: URL.createObjectURL(new Blob(['﻿' + rows.map((r) => r.map(cell).join(',')).join('\r\n')], { type: 'text/csv' })), download: 'qr-codes-' + new Date().toISOString().slice(0, 10) + '.csv' });
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1500);
  }

  // ---------- make ----------
  const TYPES = [['website', 'Website', 'globe'], ['whatsapp', 'WhatsApp', 'whatsapp'], ['wifi', 'Wi-Fi', 'wifi'], ['email', 'Email', 'mail'], ['phone', 'Phone', 'phone'], ['text', 'Text', 'text']];
  function makeView() {
    const m = ui.make;
    const field = (key, label, attrs) => {
      const inp = h('input', Object.assign({ class: 'input', id: 'mk-' + key, value: m.fields[key] || '', autocomplete: 'off', oninput: (e) => { m.fields[key] = e.target.value; updateSticker(); } }, attrs || {}));
      return h('div', { class: 'field' }, h('label', { class: 'label', for: 'mk-' + key }, label), inp);
    };
    let fields;
    if (m.type === 'website') fields = [field('url', 'The page it should open', { placeholder: 'yourshop.com/menu', inputmode: 'url' }), h('p', { class: 'hint' }, 'Use your own website, or the final page a middleman link sends people to.')];
    else if (m.type === 'whatsapp') fields = [field('phone', 'WhatsApp number, with country code', { placeholder: '+351 912 345 678', inputmode: 'tel' }), field('message', 'Message to start the chat (optional)', { placeholder: 'Hi! I’d like to book a table' })];
    else if (m.type === 'wifi') {
      const sec = h('select', { class: 'input', id: 'mk-security', onchange: (e) => { m.fields.security = e.target.value; render(); } },
        [['wpa', 'WPA or WPA2 (most networks)'], ['wep', 'WEP (older)'], ['none', 'No password']].map(([v, l]) => h('option', { value: v, selected: (m.fields.security || 'wpa') === v ? true : null }, l)));
      fields = [field('ssid', 'Network name', { placeholder: 'Lumen Guest' }),
        h('div', { class: 'row2', style: 'margin-top:16px' },
          h('div', null, h('label', { class: 'label', for: 'mk-security' }, 'Security'), sec),
          (m.fields.security || 'wpa') === 'none' ? h('div') : h('div', null, h('label', { class: 'label', for: 'mk-password' }, 'Password'), h('input', { class: 'input', id: 'mk-password', value: m.fields.password || '', autocomplete: 'off', oninput: (e) => { m.fields.password = e.target.value; updateSticker(); } }))),
        h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: !!m.fields.hidden, onchange: (e) => { m.fields.hidden = e.target.checked; updateSticker(); } }), 'The network is hidden')];
    } else if (m.type === 'email') fields = [field('email', 'Email address', { placeholder: 'hello@yourshop.com', inputmode: 'email' }), field('subject', 'Subject (optional)', { placeholder: 'Table booking' })];
    else if (m.type === 'phone') fields = [field('phone', 'Phone number, with country code', { placeholder: '+44 20 7946 0000', inputmode: 'tel' })];
    else fields = [field('text', 'Text', { placeholder: 'Table 12' })];
    const words = h('input', { class: 'input', id: 'mk-words', value: m.words, maxlength: '48', placeholder: 'Scan for our menu', oninput: (e) => { m.words = e.target.value; updateSticker(); } });
    return h('div', null,
      h('div', { class: 'title-row' }, h('div', null, h('h1', null, 'Make a code'),
        h('p', { class: 'subline' }, 'Direct codes made here never expire, need no account and aren’t tracked. They work for as long as the page or details they hold do.'))),
      h('div', { class: 'grid make-grid' },
        h('section', { class: 's7 card', 'aria-labelledby': 'mk-h' },
          h('div', { class: 'card-head' }, h('h2', { id: 'mk-h' }, 'What the code opens')),
          h('div', { class: 'card-body' },
            h('div', { class: 'seg', role: 'group', 'aria-label': 'Kind of code', style: 'margin-bottom:20px' }, TYPES.map(([id, label, ic]) =>
              h('button', { type: 'button', 'aria-pressed': String(m.type === id), onclick: () => { m.type = id; render(); }, style: 'display:inline-flex;align-items:center;gap:6px' }, icon(ic), label))),
            fields,
            h('div', { id: 'mk-warn' }),
            h('div', { class: 'field', style: 'margin-top:24px' }, h('label', { class: 'label', for: 'mk-words' }, 'Words under the code (optional)'), words),
            h('div', { class: 'field' }, h('span', { class: 'label' }, 'Strength'),
              h('div', { class: 'seg', role: 'group', 'aria-label': 'Strength' },
                [['M', 'Standard'], ['H', 'Extra strong']].map(([v, l]) => h('button', { type: 'button', 'aria-pressed': String(m.level === v), onclick: () => { m.level = v; render(); } }, l))),
              h('p', { class: 'hint' }, m.level === 'H' ? 'Extra strong still scans with up to 30% scratched or dirty, but the pattern is denser. Good for outdoor signs and tables.' : 'Standard still scans with up to 15% scratched or dirty. Right for menus, flyers and screens.')),
            h('div', { class: 'print-tips' }, h('h3', null, 'Before you print a hundred'),
              h('ul', null,
                h('li', null, icon('check'), h('span', null, h('b', null, 'Size it for the distance. '), 'Make the code at least a tenth of the distance people scan from: 2 cm on a table, 20 cm on a window seen from 2 m.')),
                h('li', null, icon('check'), h('span', null, h('b', null, 'Keep the white border. '), 'The quiet margin round the code is part of it; don’t crop it or print on a busy background.')),
                h('li', null, icon('check'), h('span', null, h('b', null, 'Test one copy first. '), 'Scan the printed proof with two different phones, then check it here and save it to My codes.')))))),
        h('section', { class: 's5 card', 'aria-labelledby': 'st-h' },
          h('div', { class: 'card-head' }, h('h2', { id: 'st-h' }, 'Your code')),
          h('div', { class: 'card-body sticker-body' },
            h('div', { class: 'sticker-wrap', id: 'sticker' }),
            h('div', { id: 'selfcheck' }),
            h('div', { class: 'actions' },
              h('button', { class: 'btn btn-primary', type: 'button', id: 'dl-png', onclick: downloadPng }, icon('download'), 'Download PNG'),
              h('button', { class: 'btn btn-ghost', type: 'button', id: 'dl-svg', onclick: downloadSvg }, 'SVG'),
              h('button', { class: 'btn btn-ghost', type: 'button', id: 'dl-print', onclick: printSheet }, icon('print'), 'Print a sheet of 12'))))));
  }

  function content() { return Q.buildContent(ui.make.type, ui.make.fields); }
  function modules(text) {
    const qr = window.qrcode(0, ui.make.level);
    qr.addData(text, 'Byte');
    qr.make();
    return { n: qr.getModuleCount(), dark: (r, c) => qr.isDark(r, c) };
  }
  function svgFor(text) {
    const { n, dark } = modules(text);
    const q = 4, size = n + q * 2;
    let d = '';
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (dark(r, c)) d += 'M' + (c + q) + ',' + (r + q) + 'h1v1h-1z';
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + size + ' ' + size + '" shape-rendering="crispEdges"><rect width="' + size + '" height="' + size + '" fill="#fff"/><path d="' + d + '" fill="#000"/></svg>';
  }
  function svgNode(text) {
    const tpl = document.createElement('template');
    tpl.innerHTML = svgFor(text); // built from module coordinates only, never from user text
    const s = tpl.content.firstChild;
    s.setAttribute('role', 'img');
    s.setAttribute('aria-label', 'QR code');
    return s;
  }
  function stickerNode(text, words) {
    let shown = text.replace(/^https?:\/\//, '');
    if (/^WIFI:/i.test(text)) shown = 'Wi-Fi: ' + (Q.classify(text).title.match(/“(.*)”/) || [, ''])[1];
    if (/^mailto:/i.test(text)) shown = text.slice(7).split('?')[0];
    if (/^tel:/i.test(text)) shown = text.slice(4);
    return h('div', { class: 'sticker' }, svgNode(text), words ? h('div', { class: 'words' }, words) : null, h('div', { class: 'to' }, shown.length > 60 ? shown.slice(0, 60) + '…' : shown));
  }
  function updateSticker() {
    const box = document.getElementById('sticker');
    if (!box) return;
    const text = content();
    const ok = text && text.length < 1500;
    ['dl-png', 'dl-svg', 'dl-print'].forEach((id) => { const b = document.getElementById(id); if (b) b.disabled = !ok; });
    const warn = document.getElementById('mk-warn');
    const mid = ok && Q.middlemanHost(text);
    fill(warn, mid ? h('p', { class: 'warnbox' }, icon('alert'), h('span', null, mid + ' is a middleman link, so this code would still depend on it. Use the page it ends on instead.')) : null);
    if (!ok) {
      fill(box, h('p', { class: 'sticker-empty' }, text.length >= 1500 ? 'That’s too much to fit in one code. Shorten it.' : 'Your code appears here as you type.'));
      fill(document.getElementById('selfcheck'));
      return;
    }
    fill(box, stickerNode(text, ui.make.words.trim()));
    selfCheck(text);
  }
  // Read the code back from a drawing of it, to prove it says exactly what was typed.
  function drawCanvas(text, words, px) {
    const { n, dark } = modules(text);
    const q = 4, cell = Math.max(4, Math.floor(px / (n + q * 2)));
    const side = (n + q * 2) * cell;
    const wordsH = words ? Math.round(side * 0.16) : 0;
    const c = document.createElement('canvas');
    c.width = side; c.height = side + wordsH;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height);
    ctx.fillStyle = '#000';
    for (let r = 0; r < n; r++) for (let col = 0; col < n; col++) if (dark(r, col)) ctx.fillRect((col + q) * cell, (r + q) * cell, cell, cell);
    if (words) {
      ctx.font = '700 ' + Math.round(wordsH * 0.5) + 'px "DM Sans", system-ui, sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(words, side / 2, side + wordsH * 0.38, side - cell * 4);
    }
    return { c, side };
  }
  function selfCheck(text) {
    const out = document.getElementById('selfcheck');
    const { c, side } = drawCanvas(text, '', 400);
    const data = c.getContext('2d').getImageData(0, 0, side, side).data;
    const res = window.jsQR(data, side, side);
    const same = res && res.data === text;
    fill(out, h('p', { class: 'selfcheck ' + (same ? 'ok' : 'bad') }, icon(same ? 'check' : 'alert'), same ? 'Checked: this code scans back to exactly what you typed.' : 'This code didn’t read back correctly. Shorten the text or choose Standard strength.'));
  }
  function download(name, blob) {
    const a = h('a', { href: URL.createObjectURL(blob), download: name });
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1500);
  }
  function downloadSvg() { const t = content(); if (t) download(Q.safeName(t) + '.svg', new Blob([svgFor(t)], { type: 'image/svg+xml' })); }
  function downloadPng() {
    const t = content();
    if (!t) return;
    const { c } = drawCanvas(t, ui.make.words.trim(), 1200);
    c.toBlob((b) => { download(Q.safeName(t) + '.png', b); toast('Saved a print-ready PNG, 1200 pixels across.'); }, 'image/png');
  }
  function printSheet() {
    const t = content();
    if (!t) return;
    fill($print, Array.from({ length: 12 }, () => stickerNode(t, ui.make.words.trim())));
    window.print();
  }

  // ---------- start ----------
  window.addEventListener('hashchange', render);
  try { matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => render()); } catch (e) { /* old browsers */ }
  (function fromQuery() {
    const p = new URLSearchParams(location.search);
    const q = p.get('q'), make = p.get('make');
    if (q || make) history.replaceState(null, '', location.pathname + (make ? '#/make' : '#/check'));
    if (make) { ui.make.type = 'website'; ui.make.fields.url = make; }
    render();
    if (q) showResult(q, 'From the link you opened');
  })();
  if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol) && !['localhost', '127.0.0.1'].includes(location.hostname)) {
    navigator.serviceWorker.register('sw.js').catch(() => { /* offline is optional */ });
  }
})();
