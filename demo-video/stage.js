/* The demo stage: full-screen type cards, a device frame holding the real app, a camera that zooms,
   a cursor that clicks, and captions. A demo script (scripts/day-NN.js) sets window.DEMO with its
   segments; the recorder calls window.startDemo(durations) with each segment's narration length. */
(function () {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const stage = $('stage'), world = $('world'), cam = $('cam'), device = $('device'), frame = $('app');
  const cursor = $('cursor'), caption = $('caption'), cards = $('cards'), bug = $('bug'), progress = $('progress'), flashEl = $('flash');
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const camState = { k: 1, tx: 0, ty: 0 };
  let cursorPos = { x: 1980, y: 900 };
  let layout = { kind: 'browser', s: 1.125, ox: 0, oy: 52 };

  function applyTheme(t) {
    const r = document.documentElement.style;
    Object.entries(t || {}).forEach(([k, v]) => r.setProperty('--' + k, v));
  }

  // ---------- type cards ----------
  let activeCard = null;
  function esc(s) { return String(s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]); }
  function rich(s) { return esc(s).replace(/\*([^*]+)\*/g, '<span class="hl">$1</span>'); }
  async function card(o) {
    const el = document.createElement('div');
    el.className = 'card ' + (o.style || 'dark');
    let html = '';
    if (o.logo) html += '<img class="logo" src="' + o.logo + '" alt="">';
    if (o.kicker) html += '<div class="kicker">' + esc(o.kicker) + '</div>';
    (o.lines || []).forEach((l) => {
      const size = typeof l === 'object' ? l.size || '' : '';
      const text = typeof l === 'object' ? l.text : l;
      html += '<div class="line ' + size + '"><span>' + rich(text) + '</span></div>';
    });
    if (o.src) html += '<div class="src">' + esc(o.src) + '</div>';
    if (o.logos) html += '<div class="logos">' + o.logos.map((l, i) => '<figure style="transition-delay:' + (200 + i * 120) + 'ms"><img src="' + l.src + '" alt=""><figcaption>' + esc(l.name) + '</figcaption></figure>').join('') + '</div>';
    if (o.badges) html += '<div class="badges">' + o.badges.map((b, i) => '<span style="transition-delay:' + (300 + i * 110) + 'ms">' + esc(b) + '</span>').join('') + '</div>';
    if (o.url) html += '<div class="url">' + esc(o.url) + '</div>';
    el.innerHTML = html;
    cards.appendChild(el);
    el.querySelectorAll('.line span').forEach((s, i) => { s.style.transitionDelay = (80 + i * 120) + 'ms'; });
    void el.offsetWidth;
    if (o.flash !== false) flash();
    el.classList.add('on');
    world.classList.remove('on');
    bug.classList.remove('on');
    setTimeout(() => { if (!world.classList.contains('on')) side(null); }, 330);
    hideCursor();
    const prev = activeCard;
    activeCard = el;
    if (prev) setTimeout(() => prev.remove(), 400);
  }
  function clearCard() {
    if (!activeCard) return;
    const el = activeCard;
    activeCard = null;
    el.classList.remove('on');
    setTimeout(() => el.remove(), 400);
  }
  // Big headline beside the phone. side(null) clears it.
  function side(o) {
    const el = $('side');
    if (!o) { el.classList.remove('on'); el.innerHTML = ''; return; }
    let html = '';
    if (o.kicker) html += '<div class="kicker">' + esc(o.kicker) + '</div>';
    (o.lines || []).forEach((l, i) => { html += '<div class="line"><span style="transition-delay:' + (60 + i * 110) + 'ms">' + rich(l) + '</span></div>'; });
    if (o.sub) html += '<div class="sub">' + esc(o.sub) + '</div>';
    el.classList.remove('on');
    el.innerHTML = html;
    void el.offsetWidth;
    el.classList.add('on');
  }
  function flash() { flashEl.classList.remove('go'); void flashEl.offsetWidth; flashEl.classList.add('go'); }

  // ---------- the device ----------
  function setLayout(kind, cx) {
    device.className = 'device ' + kind;
    if (kind === 'phone') {
      const pad = 16, s = 1.18, w = 390 * s + pad * 2, ih = 844 * s, hgt = ih + pad * 2;
      const left = (cx || 960) - w / 2;
      Object.assign(device.style, { left: left + 'px', top: (1080 - hgt) / 2 + 'px', width: w + 'px', height: hgt + 'px' });
      frame.style.width = '390px'; frame.style.height = '844px'; frame.style.transform = 'scale(' + s + ')'; frame.style.position = 'static';
      layout = { kind, s, ox: pad, oy: pad, dx: left, dy: (1080 - hgt) / 2, cx: cx || 960 };
    } else {
      const s = 1.125;
      Object.assign(device.style, { left: '150px', top: '70px', width: '1620px', height: '940px' });
      frame.style.width = '1440px'; frame.style.height = Math.round(888 / s) + 'px'; frame.style.transform = 'scale(' + s + ')'; frame.style.position = 'absolute';
      layout = { kind, s, ox: 0, oy: 52, dx: 150, dy: 70 };
    }
  }
  // kind: 'browser' or 'phone'. opts.x: where the phone's centre sits (leave room for side() text).
  async function show(kind, url, addr, opts) {
    opts = opts || {};
    const cx = kind === 'phone' ? opts.x || 960 : 0;
    const change = layout.kind !== kind || (kind === 'phone' && layout.cx !== cx) || !frame.src;
    if (change && world.classList.contains('on') && !activeCard) {
      // switching devices mid-scene: cut through the accent flash
      world.classList.remove('on'); side(null); flash(); await sleep(320);
    }
    clearCard();
    if (change) setLayout(kind, cx);
    stage.classList.toggle('phone-side', kind === 'phone' && cx < 900);
    if (kind !== 'phone') side(null);
    $('addr').textContent = addr || '';
    if (url && frame.getAttribute('data-url') !== url) {
      const prev = frame.getAttribute('data-url') || '';
      frame.setAttribute('data-url', url);
      if (prev && prev.split('#')[0] === url.split('#')[0] && url.includes('#')) {
        // same page, new route: a hash change fires no load event
        win().location.hash = url.slice(url.indexOf('#'));
        await sleep(450);
      } else {
        const loaded = new Promise((r) => { frame.onload = r; setTimeout(r, 10000); });
        frame.src = url;
        await loaded;
        await sleep(350);
      }
    }
    world.classList.add('on');
    bug.classList.add('on');
  }
  const doc = () => frame.contentDocument;
  const win = () => frame.contentWindow;
  async function el(sel, timeout) {
    const end = performance.now() + (timeout || 8000);
    for (;;) {
      let e = null;
      if (typeof sel === 'function') e = sel(doc());
      else if (sel.includes('::text=')) {
        const [css, text] = sel.split('::text=');
        e = [...doc().querySelectorAll(css)].find((x) => x.textContent.trim().includes(text)) || null;
      } else e = doc().querySelector(sel);
      if (e) return e;
      if (performance.now() > end) throw new Error('not found: ' + sel);
      await sleep(80);
    }
  }
  // Where an element in the app sits on the stage, without the camera.
  function stagePoint(e, fx, fy) {
    const r = e.getBoundingClientRect();
    return { x: layout.dx + layout.ox + (r.left + r.width * (fx == null ? 0.5 : fx)) * layout.s, y: layout.dy + layout.oy + (r.top + r.height * (fy == null ? 0.5 : fy)) * layout.s, w: r.width * layout.s, h: r.height * layout.s };
  }
  const onScreen = (p) => ({ x: p.x * camState.k + camState.tx, y: p.y * camState.k + camState.ty });

  // ---------- camera ----------
  async function zoom(target, k, opts) {
    opts = opts || {};
    if (!target) { camState.k = 1; camState.tx = 0; camState.ty = 0; }
    else {
      const e = typeof target === 'string' || typeof target === 'function' ? await el(target) : target;
      if (opts.reveal !== false) await reveal(e, { force: true, top: opts.top != null ? opts.top : Math.max(40, (win().innerHeight - e.getBoundingClientRect().height) * 0.42) });
      const p = stagePoint(e, opts.fx, opts.fy);
      k = k || 1.6;
      camState.k = k;
      camState.tx = 960 - p.x * k + (opts.dx || 0);
      camState.ty = 540 - p.y * k + (opts.dy || 0);
      // keep the device covering the screen edges
      const dl = layout.dx * k + camState.tx, dt = layout.dy * k + camState.ty;
      const dw = parseFloat(device.style.width) * k, dh = parseFloat(device.style.height) * k;
      if (dl > 0 && dw > 1920) camState.tx -= Math.min(dl, dl + dw - 1920);
      if (dt > 0 && dh > 1080) camState.ty -= Math.min(dt, dt + dh - 1080);
      if (dl + dw < 1920 && dw > 1920) camState.tx += 1920 - (dl + dw);
      if (dt + dh < 1080 && dh > 1080) camState.ty += 1080 - (dt + dh);
    }
    cam.style.transitionDuration = (opts.ms || 1100) + 'ms';
    cam.style.transform = 'translate(' + camState.tx + 'px,' + camState.ty + 'px) scale(' + camState.k + ')';
    document.getElementById('stage').classList.toggle('zoomed', camState.k > 1.02);
    if (opts.wait !== false) await sleep(opts.ms || 1100);
  }

  // ---------- cursor ----------
  function hideCursor() { moveTo({ x: 1990, y: 1100 }, 10); }
  function moveTo(p, ms) {
    cursorPos = p;
    cursor.style.transitionDuration = (ms || 700) + 'ms';
    cursor.style.transform = 'translate(' + (p.x - 6) + 'px,' + (p.y - 4) + 'px)';
  }
  async function point(sel, opts) {
    opts = opts || {};
    const e = await el(sel);
    if (opts.scroll !== false && camState.k === 1) await reveal(e);
    const p = onScreen(stagePoint(e, opts.fx, opts.fy));
    moveTo(p, opts.ms || 650);
    await sleep(opts.ms || 650);
    return e;
  }
  async function click(sel, opts) {
    opts = opts || {};
    const e = await point(sel, opts);
    cursor.classList.add('down');
    const r = document.createElement('div');
    r.className = 'ripple';
    r.style.left = cursorPos.x + 'px'; r.style.top = cursorPos.y + 'px';
    stage.appendChild(r);
    setTimeout(() => r.remove(), 700);
    await sleep(110);
    cursor.classList.remove('down');
    if (opts.focus) e.focus();
    e.click();
    await sleep(opts.after == null ? 350 : opts.after);
    return e;
  }
  async function type(sel, text, opts) {
    opts = opts || {};
    const e = await click(sel, { after: 120 });
    e.focus();
    const setter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(e), 'value').set;
    if (opts.clear !== false) { setter.call(e, ''); e.dispatchEvent(new Event('input', { bubbles: true })); }
    const cps = opts.cps || 22;
    for (const ch of text) {
      setter.call(e, e.value + ch);
      e.dispatchEvent(new Event('input', { bubbles: true }));
      await sleep(1000 / cps * (ch === ' ' ? 0.6 : 1));
    }
    e.dispatchEvent(new Event('change', { bubbles: true }));
    await sleep(200);
    return e;
  }
  async function paste(sel, text) {
    const e = await click(sel, { after: 120 });
    const setter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(e), 'value').set;
    setter.call(e, text);
    e.dispatchEvent(new Event('input', { bubbles: true }));
    await sleep(250);
    return e;
  }
  // Scroll the app so an element sits comfortably in view.
  async function reveal(e, opts) {
    opts = opts || {};
    const r = e.getBoundingClientRect();
    const vh = win().innerHeight;
    const want = opts.top != null ? opts.top : vh * 0.3;
    if (opts.force || r.top < 40 || r.bottom > vh - 40) {
      win().scrollBy({ top: r.top - want, behavior: 'smooth' });
      await sleep(opts.ms || 650);
    }
  }
  async function scroll(target, opts) {
    if (typeof target === 'number') { win().scrollTo({ top: target, behavior: 'smooth' }); await sleep((opts && opts.ms) || 700); return; }
    await reveal(await el(target), Object.assign({ force: true }, opts || {}));
  }

  // ---------- captions ----------
  function setCaption(text) {
    if (!text) { caption.classList.remove('on'); return; }
    caption.classList.remove('on');
    setTimeout(() => { caption.innerHTML = esc(text).replace(/\*([^*]+)\*/g, '<b>$1</b>'); caption.classList.add('on'); }, 120);
  }

  const api = { card, show, side, el, click, type, paste, point, zoom, scroll, reveal, flash, wait: sleep, doc, win,
    cmd: (name, args) => (window.__cmd ? window.__cmd(name, args) : Promise.resolve()),
    caption: setCaption, hideCursor, bug: (on) => bug.classList.toggle('on', on) };
  window.stageApi = api;

  // ---------- running a demo ----------
  window.startDemo = async function (durations) {
    const D = window.DEMO;
    applyTheme(D.theme);
    $('bug-logo').src = D.logo;
    $('bug-text').innerHTML = esc(D.name) + ' <span>Day ' + D.day + ' of 10</span>';
    const GAP = D.gap == null ? 0.45 : D.gap, LEAD = 0.2;
    const total = durations.reduce((a, d, i) => a + d + LEAD + (D.segments[i].gap == null ? GAP : D.segments[i].gap), 0) + (D.tail || 1.6);
    const t0 = performance.now();
    if (window.__mark) await window.__mark('start');
    const now = () => (performance.now() - t0) / 1000;
    const until = async (t) => { while (now() < t) await sleep(Math.min(40, (t - now()) * 1000)); };
    const prog = setInterval(() => { progress.style.width = Math.min(100, now() / total * 100) + '%'; }, 50); // total is the estimate; overruns stretch it
    const starts = [];
    let t = 0;
    const late = [];
    for (let i = 0; i < D.segments.length; i++) {
      const seg = D.segments[i];
      await until(t);
      starts.push(now() + LEAD);
      setCaption(seg.cap === undefined ? seg.say : seg.cap);
      const job = seg.do ? seg.do(api).catch((e) => { late.push('segment ' + (i + 1) + ': ' + e.message); }) : Promise.resolve();
      t += LEAD + durations[i] + (seg.gap == null ? GAP : seg.gap);
      let done = false;
      job.then(() => { done = true; });
      await Promise.race([job, until(t)]);
      await until(t - 0.05);
      if (!done) {
        // The action outlasts the line: let it finish, then carry on after a short beat.
        await job;
        late.push('segment ' + (i + 1) + ' +' + (now() - t).toFixed(1) + 's');
        t = Math.max(t, now() + 0.3);
      }
    }
    setCaption('');
    await until(t + (D.tail || 1.6) - (D.segments[D.segments.length - 1].gap == null ? GAP : D.segments[D.segments.length - 1].gap));
    clearInterval(prog);
    progress.style.width = '100%';
    return { starts, total: now(), notes: late };
  };

  // Load the demo named in the address.
  const name = new URLSearchParams(location.search).get('demo');
  if (name) {
    const s = document.createElement('script');
    s.src = 'scripts/' + name + '.js';
    s.onload = () => { applyTheme(window.DEMO.theme); window.__stageReady = true; };
    document.body.appendChild(s);
  }
})();
