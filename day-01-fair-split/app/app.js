/* Fair Split: the interface. Everything a person types is set as text, never as HTML: links carry
   other people's data, so nothing from a book is ever parsed as markup. */
(function () {
  'use strict';
  const FS = window.FairSplit;
  const ICONS = window.FairSplitIcons;
  const $main = document.getElementById('main');
  const $bar = document.getElementById('bar');
  const $tabbar = document.getElementById('tabbar');
  const $toasts = document.getElementById('toasts');
  const $dlg = document.getElementById('sheet');

  // ---------- small DOM helpers ----------
  function h(tag, attrs) {
    const el = document.createElement(tag);
    if (attrs) {
      for (const k in attrs) {
        const v = attrs[k];
        if (v == null || v === false) continue;
        if (k === 'class') el.className = v;
        else if (k === 'text') el.textContent = v;
        else if (k.slice(0, 2) === 'on') el.addEventListener(k.slice(2), v);
        else if (k === 'style') el.style.cssText = v;
        else if (k === 'value') el.value = v;
        else if (k === 'checked') el.checked = !!v;
        else el.setAttribute(k, v === true ? '' : v);
      }
    }
    for (let i = 2; i < arguments.length; i++) add(el, arguments[i]);
    return el;
  }
  // Like replaceChildren, but skips null and false (replaceChildren would print them as text).
  function fill(el) {
    el.replaceChildren();
    for (let i = 1; i < arguments.length; i++) add(el, arguments[i]);
    return el;
  }
  function add(el, kid) {
    if (kid == null || kid === false) return;
    if (Array.isArray(kid)) { kid.forEach(function (k) { add(el, k); }); return; }
    el.appendChild(typeof kid === 'string' || typeof kid === 'number' ? document.createTextNode(String(kid)) : kid);
  }
  const SVGNS = 'http://www.w3.org/2000/svg';
  function icon(name, cls) {
    const s = document.createElementNS(SVGNS, 'svg');
    s.setAttribute('viewBox', '0 0 24 24');
    s.setAttribute('class', 'i' + (cls ? ' ' + cls : ''));
    s.setAttribute('aria-hidden', 'true');
    s.innerHTML = ICONS[name] || ICONS.receipt; // trusted, bundled shapes only
    return s;
  }
  function mark() {
    const s = document.createElementNS(SVGNS, 'svg');
    s.setAttribute('viewBox', '0 0 24 24');
    s.setAttribute('aria-hidden', 'true');
    s.innerHTML = '<path d="M11 3a9 9 0 0 0 0 18z" fill="currentColor"/><path d="M13 3a9 9 0 0 1 0 18z" fill="currentColor"/>';
    return s;
  }

  // ---------- formats ----------
  const dfDay = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short' });
  const dfWeekday = new Intl.DateTimeFormat(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
  const dfMonth = new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric' });
  const dfStamp = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  function isoDate(iso) { const p = iso.split('-').map(Number); return new Date(p[0], p[1] - 1, p[2]); }
  function dayLabel(iso) {
    const today = FS.todayISO();
    if (iso === today) return 'Today';
    const y = new Date(); y.setDate(y.getDate() - 1);
    if (iso === FS.todayISO(y)) return 'Yesterday';
    return dfWeekday.format(isoDate(iso));
  }
  function stamp(ms) {
    const d = new Date(ms);
    const iso = FS.todayISO(d);
    const t = d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
    if (iso === FS.todayISO()) return 'Today, ' + t;
    return dfStamp.format(d);
  }
  function plural(n, one, many) { return n + ' ' + (n === 1 ? one : (many || one + 's')); }
  function kb(chars) { return chars < 1024 ? chars + ' bytes' : (chars / 1024).toFixed(1) + ' KB'; }

  const CAT_INFO = {
    groceries: ['Groceries', 'cart'], eating: ['Eating out', 'utensils'], drinks: ['Drinks', 'wine'],
    home: ['Home', 'home'], utilities: ['Bills and energy', 'zap'], internet: ['Internet and phone', 'wifi'],
    transport: ['Getting around', 'car'], travel: ['Travel', 'plane'], stay: ['Places to stay', 'bed'],
    fun: ['Tickets and fun', 'ticket'], shopping: ['Shopping and gifts', 'bag'], other: ['Other', 'receipt'],
  };

  // ---------- storage ----------
  const store = {
    get: function (k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set: function (k, v) {
      try { localStorage.setItem(k, JSON.stringify(v)); return true; }
      catch (e) { toast("Couldn't save on this device. Storage may be full or switched off."); return false; }
    },
    del: function (k) { try { localStorage.removeItem(k); } catch (e) { /* nothing to do */ } },
  };
  const KEY = { index: 'fs:index', prefs: 'fs:prefs', book: function (id) { return 'fs:book:' + id; }, meta: function (id) { return 'fs:meta:' + id; } };
  function bookIds() { return store.get(KEY.index, []).filter(function (id) { return typeof id === 'string'; }); }
  function touchIndex(id) {
    const ids = bookIds().filter(function (x) { return x !== id; });
    ids.unshift(id);
    store.set(KEY.index, ids);
  }
  function loadMeta(id) {
    return Object.assign({ me: '', pending: [], lastShareAt: 0, merges: [], sample: false, notice: null }, store.get(KEY.meta(id), {}));
  }
  function loadBookRaw(id) {
    const b = store.get(KEY.book(id), null);
    return b && Array.isArray(b.events) ? b : null;
  }
  function saveBook(book, meta) {
    const ok = store.set(KEY.book(book.id), book);
    if (meta) store.set(KEY.meta(book.id), meta);
    return ok;
  }

  // The open book, computed once per change.
  let cur = null;
  function openBook(id) {
    if (cur && cur.id === id) return cur;
    const book = loadBookRaw(id);
    if (!book) return null;
    cur = compute(book, loadMeta(id));
    return cur;
  }
  function compute(book, meta) {
    const state = FS.fold(book);
    const bal = FS.balances(state);
    return { id: book.id, book: book, meta: meta, state: state, bal: bal, plan: FS.settle(bal) };
  }
  function refresh() { cur = compute(cur.book, cur.meta); }
  function commit(events, opts) {
    cur.book.events = cur.book.events.concat(events);
    cur.meta.pending = cur.meta.pending.concat(events.map(function (e) { return e.id; }));
    saveBook(cur.book, cur.meta);
    refresh();
    events.forEach(function (e) { if (e.eid) ui.fresh.add(e.eid); });
    if (!opts || !opts.quiet) render();
  }
  function saveMeta() { store.set(KEY.meta(cur.id), cur.meta); }

  // ---------- people ----------
  const HUES = [205, 25, 150, 340, 45, 185, 0, 95, 220, 320];
  function member(mid) { return cur.state.memberById[mid] || { id: mid, name: 'Someone', index: 0 }; }
  function nameOf(mid, opts) {
    if (!mid) return 'Someone';
    const m = member(mid);
    if (opts && opts.you && mid === cur.meta.me) return 'You';
    return m.name;
  }
  function initials(mid) {
    const m = member(mid);
    const words = m.name.trim().split(/\s+/);
    const first = Array.from(words[0] || '?')[0].toUpperCase();
    const clash = cur.state.members.some(function (o) { return o.id !== mid && Array.from(o.name.trim())[0] && Array.from(o.name.trim())[0].toUpperCase() === first; });
    if (!clash) return first;
    const second = words[1] ? Array.from(words[1])[0] : Array.from(words[0])[1] || '';
    return first + second.toLowerCase();
  }
  function avatar(mid, cls) {
    const m = member(mid);
    return h('span', { class: 'avatar' + (cls ? ' ' + cls : ''), style: '--h:' + HUES[m.index % HUES.length], 'aria-hidden': 'true' }, initials(mid));
  }
  function shownMembers() {
    return cur.state.members.filter(function (m) { return !m.gone || cur.bal[m.id].net !== 0 || FS.isUsed(cur.state, m.id); });
  }
  function M(minor, opts) { return FS.money(minor, cur.state.currency, opts); }
  function owesText(mid, net) {
    const you = mid === cur.meta.me;
    if (net > 0) return (you ? "You're owed " : nameOf(mid) + ' is owed ') + M(net);
    if (net < 0) return (you ? 'You owe ' : nameOf(mid) + ' owes ') + M(-net);
    return you ? "You're square" : nameOf(mid) + ' is square';
  }

  // ---------- preferences ----------
  function prefs() { return Object.assign({ theme: 'system' }, store.get(KEY.prefs, {})); }
  function applyTheme() {
    const t = prefs().theme;
    if (t === 'light' || t === 'dark') document.documentElement.setAttribute('data-theme', t);
    else document.documentElement.removeAttribute('data-theme');
    const dark = t === 'dark' || (t === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', dark ? '#000000' : '#f2f4f7');
  }
  function themeControl() {
    const t = prefs().theme;
    return h('div', { class: 'seg', role: 'group', 'aria-label': 'Theme' },
      [['system', 'Match device'], ['light', 'Light'], ['dark', 'Dark']].map(function (o) {
        return h('button', { type: 'button', 'aria-pressed': String(t === o[0]), onclick: function () {
          const p = prefs(); p.theme = o[0]; store.set(KEY.prefs, p); applyTheme(); render();
        } }, o[1]);
      }));
  }

  // ---------- routing ----------
  const ui = { open: new Set(), allLines: new Set(), fresh: new Set(), q: '', filter: 'all', join: null, lastKey: '' };
  function route() {
    const hash = location.hash.slice(1);
    if (hash.slice(0, 2) === 'j=') return { name: 'link', code: hash.slice(2) };
    const parts = hash.replace(/^\//, '').split('/');
    if (!parts[0]) return { name: 'home' };
    if (parts[0] === 'new') return { name: 'new' };
    if (parts[0] === 'sample') return { name: 'sample', tab: parts[1] || '' };
    if (parts[0] === 'b' && parts[1]) return { name: 'book', id: parts[1], tab: ['overview', 'expenses', 'settle', 'book'].indexOf(parts[2]) >= 0 ? parts[2] : 'overview' };
    return { name: 'home' };
  }
  function go(path) {
    if (location.hash === '#' + path || (path === '/' && !location.hash)) render();
    else location.hash = path;
  }
  function bookPath(tab) { return '/b/' + cur.id + (tab && tab !== 'overview' ? '/' + tab : ''); }

  // ---------- render ----------
  function render() {
    closeMenu();
    const r = route();
    const key = r.name + '|' + (r.id || '') + '|' + (r.tab || '');
    const changed = key !== ui.lastKey;
    ui.lastKey = key;
    if (r.name === 'link') { handleLink(r.code); return; }
    if (r.name === 'sample') {
      // A shareable way to open the sample book straight away: #/sample, #/sample/expenses and so on.
      const s = window.FairSplitSample.build(FS);
      if (!loadBookRaw(s.book.id)) saveBook(s.book, Object.assign(loadMeta(s.book.id), { me: s.me, sample: true, pending: [] }));
      touchIndex(s.book.id);
      history.replaceState(null, '', location.pathname + location.search + '#/b/' + s.book.id + (r.tab ? '/' + r.tab : ''));
      render();
      return;
    }
    if (r.name !== 'book') cur = null;
    let view;
    if (r.name === 'book') {
      if (!openBook(r.id)) view = missingBook();
      else {
        if (changed && cur.meta) { touchIndex(cur.id); }
        view = r.tab === 'expenses' ? screenExpenses() : r.tab === 'settle' ? screenSettle() : r.tab === 'book' ? screenBookSettings() : screenOverview();
      }
    } else if (r.name === 'new') view = screenNew();
    else view = bookIds().length ? screenHome() : screenWelcome();
    renderBar(r);
    renderTabbar(r);
    const y = window.scrollY;
    fill($main, view);
    if (changed) {
      window.scrollTo(0, 0);
      $main.focus({ preventScroll: true });
    } else {
      window.scrollTo(0, y);
    }
    ui.fresh.clear();
    balanceColumns();
  }

  // Cards that share a row share a bottom edge: on a wide screen the Recent list shows as many rows
  // (three to eight) as make the two columns end level.
  function balanceColumns() {
    const recent = $main.querySelectorAll('.recent-list .entry');
    if (!recent.length) return;
    recent.forEach(function (r) { r.hidden = false; });
    const left = $main.querySelector('.col-main'), right = $main.querySelector('.col-side');
    if (!left || !right || window.innerWidth < 1024) { recent.forEach(function (r, i) { r.hidden = i >= 5; }); return; }
    let shown = recent.length;
    while (shown > 3 && left.getBoundingClientRect().bottom - right.getBoundingClientRect().bottom > recent[0].offsetHeight / 2) {
      shown--;
      recent[shown].hidden = true;
    }
  }
  let resizeTimer;
  window.addEventListener('resize', function () { clearTimeout(resizeTimer); resizeTimer = setTimeout(balanceColumns, 120); });

  function renderBar(r) {
    const inBook = r.name === 'book' && cur;
    const kids = [h('a', { class: 'brand', href: '#/', 'aria-label': 'Fair Split, your books' }, mark(), h('span', { class: 'word' }, 'Fair Split'))];
    if (inBook) {
      kids.push(h('span', { class: 'switcher-sep', 'aria-hidden': 'true' }));
      kids.push(h('button', { class: 'switcher', type: 'button', 'aria-haspopup': 'menu', 'aria-expanded': 'false', onclick: openSwitcher },
        h('span', { class: 'label' }, cur.state.name), icon('chevronDown')));
      kids.push(h('nav', { class: 'nav', 'aria-label': 'Book' }, [['overview', 'Overview'], ['expenses', 'Expenses'], ['settle', 'Settle up'], ['book', 'Book']].map(function (t) {
        return h('a', { href: '#' + bookPath(t[0]), 'aria-current': r.tab === t[0] ? 'page' : null }, t[1]);
      })));
      const n = pendingCount();
      kids.push(h('div', { class: 'bar-actions' },
        h('button', { class: 'btn btn-secondary', type: 'button', onclick: openSendUpdate, 'aria-label': n ? 'Send update, ' + plural(n, 'change') + ' not sent' : 'Send update' },
          icon('send'), h('span', { class: 'send-label' }, 'Send update'), n ? h('span', { class: 'badge' }, String(n)) : null),
        h('button', { class: 'btn btn-primary bar-add', type: 'button', onclick: function () { openExpenseForm(); }, title: 'Add expense (N)' }, icon('plus'), 'Add expense')));
    } else if (r.name === 'home' && bookIds().length) {
      kids.push(h('div', { class: 'bar-actions' }, h('a', { class: 'btn btn-primary', href: '#/new' }, icon('plus'), 'New book')));
    }
    fill($bar, h('div', { class: 'bar-in' }, kids));
    document.body.classList.toggle('no-tabs', !inBook);
  }

  function renderTabbar(r) {
    if (!(r.name === 'book' && cur)) { fill($tabbar); $tabbar.hidden = true; return; }
    $tabbar.hidden = false;
    const tab = function (t, label, ic) {
      return h('a', { href: '#' + bookPath(t), 'aria-current': r.tab === t ? 'page' : null }, icon(ic), label);
    };
    fill($tabbar, 
      tab('overview', 'Overview', 'scale'),
      tab('expenses', 'Expenses', 'list'),
      h('button', { class: 'tab-add', type: 'button', onclick: function () { openExpenseForm(); }, 'aria-label': 'Add expense' }, h('span', { class: 'disc' }, icon('plus')), 'Add'),
      tab('settle', 'Settle up', 'handshake'),
      tab('book', 'Book', 'settings'));
  }

  // ---------- book switcher ----------
  let menuEl = null;
  function closeMenu() {
    if (!menuEl) return;
    menuEl.remove(); menuEl = null;
    const b = $bar.querySelector('.switcher');
    if (b) b.setAttribute('aria-expanded', 'false');
    document.removeEventListener('pointerdown', menuOutside, true);
  }
  function menuOutside(e) { if (menuEl && !menuEl.contains(e.target) && !e.target.closest('.switcher')) closeMenu(); }
  function openSwitcher(e) {
    if (menuEl) { closeMenu(); return; }
    const btn = e.currentTarget;
    btn.setAttribute('aria-expanded', 'true');
    const items = bookIds().map(function (id) {
      const raw = loadBookRaw(id);
      if (!raw) return null;
      const st = FS.fold(raw);
      const me = loadMeta(id).me;
      const bal = me && st.memberById[me] ? FS.balances(st)[me].net : null;
      return h('a', { href: '#/b/' + id, role: 'menuitem', class: cur && cur.id === id ? 'current' : null, onclick: closeMenu },
        h('span', { class: 'm-name' }, st.name),
        h('span', { class: 'm-meta' }, bal == null ? plural(st.members.length, 'person', 'people') : FS.money(bal, st.currency, { sign: true })));
    });
    menuEl = h('div', { class: 'menu', role: 'menu', 'aria-label': 'Your books' },
      items, h('hr'),
      h('a', { href: '#/new', role: 'menuitem', onclick: closeMenu }, h('span', { class: 'm-name' }, 'New book'), icon('plus')),
      h('a', { href: '#/', role: 'menuitem', onclick: closeMenu }, h('span', { class: 'm-name' }, 'All books'), icon('book')));
    document.body.appendChild(menuEl);
    const r = btn.getBoundingClientRect();
    menuEl.style.top = (r.bottom + 6) + 'px';
    menuEl.style.left = Math.max(12, Math.min(r.left, window.innerWidth - menuEl.offsetWidth - 12)) + 'px';
    const first = menuEl.querySelector('a');
    if (first) first.focus();
    document.addEventListener('pointerdown', menuOutside, true);
  }
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && menuEl) { closeMenu(); const b = $bar.querySelector('.switcher'); if (b) b.focus(); }
    if (menuEl && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
      const links = Array.from(menuEl.querySelectorAll('a'));
      const i = links.indexOf(document.activeElement);
      links[(i + (e.key === 'ArrowDown' ? 1 : -1) + links.length) % links.length].focus();
      e.preventDefault();
    }
    if ((e.key === 'n' || e.key === 'N') && !e.metaKey && !e.ctrlKey && !e.altKey && cur && !$dlg.open && route().name === 'book') {
      const t = e.target;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)) return;
      e.preventDefault();
      openExpenseForm();
    }
  });

  // ---------- screens: first run ----------
  function screenWelcome() {
    const demo = demoWorking();
    return h('div', { class: 'welcome' },
      h('section', null,
        h('h1', null, 'Share costs without the spreadsheet'),
        h('p', { class: 'intro' }, 'Fair Split keeps one book of shared costs for a flat, a trip or any group. No sign-up and no daily limit, and the book lives on your phones, not on a server.'),
        h('div', { class: 'actions' },
          h('a', { class: 'btn btn-primary', href: '#/new' }, 'Start a book'),
          h('button', { class: 'btn btn-secondary', type: 'button', onclick: openSample }, 'Look at a sample book')),
        h('ul', { class: 'points' },
          point('scale', 'Every balance shows its working', 'Tap anyone to see each expense that moved their balance, down to the cent.'),
          point('history', 'Nothing changes behind your back', 'Corrections and removals stay in the history, with who made them and when.'),
          point('send', 'Your group chat carries the updates', 'Send the book as a link. Each copy merges what is new, so nobody loses what they added.'),
          point('handshake', 'The fewest payments to settle', 'Fair Split works out the smallest number of transfers that squares everyone.')),
        pasteBox()),
      demo);
  }
  function point(ic, title, text) { return h('li', null, icon(ic), h('div', null, h('b', null, title), h('span', null, text))); }
  function pasteBox() {
    const input = h('input', { class: 'input', type: 'text', placeholder: 'Paste a link or message', 'aria-label': 'Fair Split link', autocomplete: 'off' });
    const err = h('p', { class: 'err', hidden: true, id: 'paste-err' });
    input.setAttribute('aria-describedby', 'paste-err');
    function openIt(e) {
      e.preventDefault();
      const code = FS.findCode(input.value);
      if (!code) { err.textContent = "That doesn't look like a Fair Split link. Copy the whole message and try again."; err.hidden = false; input.setAttribute('aria-invalid', 'true'); return; }
      location.hash = 'j=' + code;
    }
    return h('form', { class: 'paste', onsubmit: openIt },
      h('label', { class: 'label', for: 'paste-in' }, 'Someone sent you a book?'),
      h('div', { class: 'inline-add' }, Object.assign(input, { id: 'paste-in' }), h('button', { class: 'btn btn-ghost', type: 'submit' }, 'Open')),
      err,
      h('p', { class: 'hint', style: 'margin-top:8px' }, 'Or ', h('button', { class: 'link', type: 'button', onclick: pickFile }, 'open a backup file'), '.'));
  }
  function demoWorking() {
    const sample = window.FairSplitSample.build(FS);
    const saved = cur;
    cur = compute(sample.book, { me: '', pending: [], merges: [], sample: true });
    const tom = 'tom12';
    const net = cur.bal[tom].net;
    const card = h('aside', { class: 'card demo', 'aria-label': 'An example of a balance with its working' },
      h('div', { class: 'card-head' }, h('h2', null, 'Why Tom is owed ' + M(net)), h('span', { class: 'meta' }, 'Flat 4B')),
      h('div', { class: 'lead' }, h('div', null,
        h('div', { class: 'lead-value money' }, M(net, { sign: true })),
        h('div', { class: 'lead-note' }, 'paid ' + M(cur.bal[tom].paid) + ', share ' + M(cur.bal[tom].share)))),
      workingView(tom, { cap: 6, static: true }));
    cur = saved;
    return h('div', null, card, h('p', { class: 'demo-caption' }, 'From the sample book. Every balance in your own books opens like this.'));
  }

  // ---------- screens: your books ----------
  function screenHome() {
    const rows = bookIds().map(function (id) {
      const raw = loadBookRaw(id);
      if (!raw) return null;
      const st = FS.fold(raw);
      const meta = loadMeta(id);
      const bal = FS.balances(st);
      const me = meta.me && st.memberById[meta.me] ? meta.me : '';
      const net = me ? bal[me].net : null;
      const saved = cur;
      cur = { state: st, meta: meta, bal: bal };
      const people = st.members.filter(function (m) { return !m.gone; });
      const row = h('a', { class: 'book-row', href: '#/b/' + id },
        h('div', null,
          h('div', { class: 'name' }, st.name, meta.sample ? h('span', { class: 'you' }, ' · sample') : null),
          h('div', { class: 'people' }, h('span', { class: 'stack' }, people.slice(0, 5).map(function (m) { return avatar(m.id, 'sm'); })),
            h('span', { class: 'count' }, plural(people.length, 'person', 'people') + ' · ' + plural(st.entries.filter(function (e) { return !e.deleted; }).length, 'entry', 'entries')))),
        h('div', { class: 'bal' }, net == null ? h('span', null, 'Just looking') : [
          h('b', { class: net === 0 ? 'you' : null }, FS.money(net, st.currency, { sign: true })),
          h('span', null, net > 0 ? "you're owed" : net < 0 ? 'you owe' : 'square')]),
        icon('chevronRight'));
      cur = saved;
      return row;
    });
    return h('div', null,
      h('div', { class: 'title-row' }, h('div', null, h('h1', null, 'Your books'),
        h('p', { class: 'subline' }, 'Kept on this device. Fair Split has no accounts and no server.'))),
      h('div', { class: 'grid' },
        h('div', { class: 'col-main' }, h('div', { class: 'card' }, rows)),
        h('div', { class: 'col-side' },
          h('div', { class: 'card' },
            h('div', { class: 'card-head' }, h('h2', null, 'Open a book someone sent')),
            h('div', { class: 'card-body' }, pasteBox())),
          h('div', { class: 'card' },
            h('div', { class: 'card-head' }, h('h2', null, 'Appearance')),
            h('div', { class: 'card-body' }, themeControl())))));
  }

  // ---------- screens: new book ----------
  function screenNew() {
    const name = h('input', { class: 'input', id: 'nb-name', placeholder: 'Flat 4B, Lisbon trip, book club', maxlength: '60', autocomplete: 'off' });
    const you = h('input', { class: 'input', id: 'nb-you', placeholder: 'Your name', maxlength: '40', autocomplete: 'given-name' });
    const others = h('div', { class: 'others' });
    function otherRow(focus) {
      const inp = h('input', { class: 'input', placeholder: 'Their name', maxlength: '40', autocomplete: 'off', 'aria-label': 'Another person' });
      const row = h('div', { class: 'inline-add' }, inp,
        h('button', { class: 'btn btn-ghost btn-icon', type: 'button', 'aria-label': 'Remove this person', onclick: function () { row.remove(); } }, icon('x')));
      others.appendChild(row);
      if (focus) inp.focus();
      inp.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); otherRow(true); } });
    }
    otherRow(); otherRow();
    const curSel = currencySelect(defaultCurrency(), 'nb-cur');
    const err = h('p', { class: 'err', role: 'alert', hidden: true });
    function create(e) {
      e.preventDefault();
      const n = name.value.trim();
      const me = you.value.trim();
      const rest = Array.from(others.querySelectorAll('input')).map(function (i) { return i.value.trim(); }).filter(Boolean);
      [name, you].forEach(function (i) { i.removeAttribute('aria-invalid'); });
      let msg = '';
      if (!n) { msg = 'Give the book a name.'; name.setAttribute('aria-invalid', 'true'); name.focus(); }
      else if (!me) { msg = 'Add your name, so others can see what you paid.'; you.setAttribute('aria-invalid', 'true'); you.focus(); }
      else if (!rest.length) { msg = 'Add at least one other person to share with.'; const f = others.querySelector('input'); if (f) f.focus(); else otherRow(true); }
      if (msg) { err.textContent = msg; err.hidden = false; return; }
      const made = FS.newBook({ name: n, currency: curSel.value, people: [me].concat(rest), meIndex: 0 });
      const meta = Object.assign(loadMeta(made.book.id), { me: made.me, pending: made.book.events.map(function (ev) { return ev.id; }) });
      saveBook(made.book, meta);
      touchIndex(made.book.id);
      go('/b/' + made.book.id);
      toast('Book created. Add the first expense when someone pays for something.');
    }
    return h('form', { onsubmit: create, novalidate: true },
      h('div', { class: 'title-row' }, h('div', null, h('h1', null, 'New book'), h('p', { class: 'subline' }, 'One book for each flat, trip or group.'))),
      h('div', { class: 'settings' },
        setRow('Name', 'What the group calls it.', h('div', { class: 'field' }, h('label', { for: 'nb-name' }, 'Book name'), name)),
        setRow('People', 'Everyone who shares costs. You can add more later, and anyone can join from a link.',
          h('div', null,
            h('div', { class: 'field' }, h('label', { for: 'nb-you' }, 'You'), you),
            h('div', { class: 'field' }, h('span', { class: 'label' }, 'Who else'), others,
              h('div', null, h('button', { class: 'btn btn-text', type: 'button', onclick: function () { otherRow(true); } }, icon('userPlus'), 'Add another person'))))),
        setRow('Currency', 'Amounts are kept in this currency. Spending in another currency is converted when you add it.',
          h('div', { class: 'field' }, h('label', { for: 'nb-cur' }, 'Currency'), curSel))),
      h('div', { style: 'display:flex;gap:8px;justify-content:flex-end;align-items:center;padding-top:20px;border-top:1px solid var(--border)' },
        err, h('a', { class: 'btn btn-ghost', href: '#/' }, 'Cancel'), h('button', { class: 'btn btn-primary', type: 'submit' }, 'Create book')));
  }
  function setRow(title, text, panel, cls) {
    return h('section', { class: 'set-row' + (cls ? ' ' + cls : '') },
      h('div', { class: 'set-label' }, h('h2', null, title), text ? h('p', null, text) : null),
      h('div', { class: 'set-panel' }, panel));
  }

  // ---------- screens: overview ----------
  function screenOverview() {
    const st = cur.state;
    const me = cur.meta.me && st.memberById[cur.meta.me] ? cur.meta.me : '';
    const spent = totalSpent();
    const sub = [];
    if (me) sub.push(h('strong', null, owesText(me, cur.bal[me].net)));
    sub.push(cur.plan.length ? plural(cur.plan.length, 'payment') + ' would settle everyone' : (activeEntries().length ? 'everyone is square' : 'no expenses yet'));
    return h('div', null,
      h('div', { class: 'title-row' }, h('div', null,
        h('h1', null, st.name),
        h('p', { class: 'subline' }, joinWith(sub, ' · ')))),
      notices(),
      h('div', { class: 'grid' },
        h('div', { class: 'col-main' }, balancesCard(me, spent), recentCard()),
        h('div', { class: 'col-side' }, settleCard(), copyCard(), activeEntries().some(function (e) { return e.kind === 'expense'; }) ? whereCard() : null)));
  }
  function joinWith(parts, sep) {
    const out = [];
    parts.forEach(function (p, i) { if (i) out.push(sep); out.push(p); });
    return out;
  }
  function activeEntries() { return cur.state.entries.filter(function (e) { return !e.deleted; }); }
  function totalSpent() {
    let t = 0;
    activeEntries().forEach(function (e) { if (e.kind === 'expense') t += e.amount; });
    return t;
  }

  function notices() {
    const out = [];
    const n = cur.meta.notice;
    if (n && n.text) {
      out.push(h('div', { class: 'notice info', role: 'status' },
        icon('circleCheck'), h('p', null, n.text),
        n.eids && n.eids.length ? h('button', { class: 'btn btn-text btn-sm act', type: 'button', onclick: function () { n.eids.forEach(function (id) { ui.fresh.add(id); }); cur.meta.notice = null; saveMeta(); go(bookPath('expenses')); } }, 'Show') : null,
        h('button', { class: 'btn btn-icon btn-text dismiss', type: 'button', 'aria-label': 'Dismiss', onclick: function () { cur.meta.notice = null; saveMeta(); render(); } }, icon('x'))));
    }
    if (cur.meta.sample) {
      out.push(h('div', { class: 'notice' }, icon('info'),
        h('p', null, 'This is a sample book with made-up housemates. Add, change or remove anything: it stays on this device.'),
        h('a', { class: 'btn btn-text btn-sm act', href: '#/new' }, 'Start your own')));
    }
    return out;
  }

  function balancesCard(me, spent) {
    const people = shownMembers();
    let maxAbs = 0;
    people.forEach(function (m) { maxAbs = Math.max(maxAbs, Math.abs(cur.bal[m.id].net)); });
    const mine = me ? cur.plan.filter(function (p) { return p.from === me || p.to === me; }) : [];
    const leadNote = !me ? null : !mine.length ? 'Nothing to pay or collect.' : mine.map(function (p) {
      return p.from === me ? 'Pay ' + nameOf(p.to) + ' ' + M(p.amount) : nameOf(p.from) + ' pays you ' + M(p.amount);
    }).join(' · ');
    return h('section', { class: 'card', 'aria-labelledby': 'bal-h' },
      h('div', { class: 'card-head' }, h('h2', { id: 'bal-h' }, 'Balances'), h('span', { class: 'meta money' }, M(spent) + ' spent')),
      me ? h('div', { class: 'lead' },
        h('div', null,
          h('div', { class: 'lead-label' }, 'Your balance'),
          h('div', { class: 'lead-value money' }, M(cur.bal[me].net, { sign: true })),
          h('div', { class: 'lead-note' }, leadNote)),
        mine.length ? h('a', { class: 'btn btn-ghost btn-sm', href: '#' + bookPath('settle') }, 'Settle up') : null) : null,
      h('ul', { class: 'balances' }, people.map(function (m) { return balanceRow(m, maxAbs); })));
  }

  function balanceRow(m, maxAbs) {
    const b = cur.bal[m.id];
    const open = ui.open.has(m.id);
    const pct = maxAbs ? Math.abs(b.net) / maxAbs * 50 : 0;
    const bar = h('i', { class: b.net < 0 ? 'neg' : null, style: b.net < 0 ? 'right:50%;width:' + pct + '%' : 'left:50%;width:' + pct + '%' });
    const bits = ['paid ' + M(b.paid), 'share ' + M(b.share)];
    if (b.sent) bits.push('paid back ' + M(b.sent));
    if (b.received) bits.push('got back ' + M(b.received));
    const wid = 'w-' + m.id;
    const btn = h('button', { class: 'bal-btn', type: 'button', 'aria-expanded': String(open), 'aria-controls': wid, onclick: function () {
      if (ui.open.has(m.id)) ui.open.delete(m.id); else ui.open.add(m.id);
      const now = ui.open.has(m.id);
      btn.setAttribute('aria-expanded', String(now));
      wrap.classList.toggle('open', now);
      if (now && !wrap.firstChild.firstChild) wrap.firstChild.appendChild(workingView(m.id));
    } },
      avatar(m.id),
      h('div', { style: 'min-width:0' },
        h('div', { class: 'bal-name' }, m.name, m.id === cur.meta.me ? h('span', { class: 'you' }, ' (you)') : null, m.gone ? h('span', { class: 'you' }, ' (left)') : null),
        h('div', { class: 'bal-sub money' }, joinWith(bits.map(function (t) { return h('span', { style: 'white-space:nowrap' }, t); }), ' · '))),
      h('div', { class: 'track', 'aria-hidden': 'true' }, bar),
      h('div', { class: 'bal-amt money' + (b.net === 0 ? ' zero' : '') }, h('span', { class: 'visually-hidden' }, b.net > 0 ? 'is owed ' : b.net < 0 ? 'owes ' : ''), M(b.net, { sign: true })),
      icon('chevronRight', 'bal-chev'));
    const wrap = h('div', { class: 'working-wrap' + (open ? ' open' : ''), id: wid }, h('div', null, open ? workingView(m.id) : null));
    return h('li', { class: 'bal-row' }, btn, wrap);
  }

  function workingView(mid, opts) {
    const lines = FS.working(cur.state, mid);
    const b = cur.bal[mid];
    const you = mid === cur.meta.me;
    if (!lines.length) {
      return h('div', { class: 'working' }, h('p', { class: 'w-sum', style: 'padding-top:6px' }, (you ? "You aren't" : nameOf(mid) + " isn't") + ' in any expense yet, so the balance is ' + M(0) + '.'));
    }
    const cap = (opts && opts.cap) || 10;
    const showAll = ui.allLines.has(mid) || lines.length <= cap + 2;
    const shown = showAll ? lines : lines.slice(-cap);
    let paidCol = 0, shareCol = 0;
    lines.forEach(function (l) { paidCol += l.paid; shareCol += l.share; });
    const isStatic = opts && opts.static;
    const rows = shown.map(function (l) {
      const e = l.entry;
      let what = e.title || CAT_INFO[e.cat || 'other'][0];
      if (l.kind === 'sent') what = (you ? 'You paid ' : 'Paid ') + nameOf(e.to) + ' back';
      if (l.kind === 'received') what = 'Got ' + M(e.amount) + ' back from ' + nameOf(e.payer);
      const rowAttrs = isStatic ? { class: 'w-row' } : { class: 'w-row', type: 'button', style: 'width:100%;border:0;background:transparent;text-align:left;color:inherit', onclick: function () { openDetail(e.id); }, 'aria-label': what + ', ' + M(l.delta, { sign: true }) };
      return h(isStatic ? 'div' : 'button', rowAttrs,
        h('span', { class: 'd dim' }, dfDay.format(isoDate(e.date))),
        h('span', { class: 'what', title: what }, what),
        h('span', { class: 'r p' }, l.paid ? M(l.paid) : '—'),
        h('span', { class: 'r s' }, l.share ? M(l.share) : '—'),
        h('span', { class: 'r delta' }, M(l.delta, { sign: true })),
        h('span', { class: 'r run dim' }, '= ' + M(l.running, { sign: true })));
    });
    const parts = ['paid ' + M(b.paid), '− share ' + M(b.share)];
    if (b.sent) parts.push('+ paid back ' + M(b.sent));
    if (b.received) parts.push('− got back ' + M(b.received));
    return h('div', { class: 'working' },
      h('div', { class: 'w-row w-head', 'aria-hidden': 'true' }, h('span', { class: 'd' }, 'Date'), h('span', { class: 'what' }, 'What'), h('span', { class: 'r p' }, 'Paid'), h('span', { class: 'r s' }, 'Share'), h('span', { class: 'r delta' }, 'Change'), h('span', { class: 'r run' }, 'Balance')),
      showAll ? null : isStatic ? h('div', { class: 'w-more dim', style: 'color:var(--muted);font-size:13px' }, (lines.length - cap) + ' earlier lines') : h('div', { class: 'w-more' }, h('button', { class: 'link', type: 'button', onclick: function (e) {
        ui.allLines.add(mid);
        const w = e.currentTarget.closest('.working');
        w.replaceWith(workingView(mid, opts));
      } }, 'Show ' + (lines.length - cap) + ' earlier lines')),
      rows,
      h('div', { class: 'w-row w-total' },
        h('span', { class: 'd' }), h('span', { class: 'what' }, 'Balance'),
        h('span', { class: 'r p' }, M(paidCol)), h('span', { class: 'r s' }, M(shareCol)), h('span', { class: 'r delta' }),
        h('span', { class: 'r run' }, M(b.net, { sign: true }))),
      h('p', { class: 'w-sum money' }, parts.join(' ') + ' = ' + M(b.net, { sign: true })));
  }

  function recentCard() {
    const list = activeEntries().slice(0, 8);
    const total = activeEntries().length;
    return h('section', { class: 'card', 'aria-labelledby': 'rec-h' },
      h('div', { class: 'card-head' }, h('h2', { id: 'rec-h' }, 'Recent'), total ? h('a', { class: 'link', href: '#' + bookPath('expenses') }, 'View all ' + total) : null),
      list.length ? h('div', { class: 'recent-list' }, list.map(function (e) { return entryRow(e); })) :
        h('div', { class: 'empty-first' }, h('p', null, 'No expenses yet. When someone pays for something the group shares, add it here.'),
          h('button', { class: 'btn btn-primary', type: 'button', onclick: function () { openExpenseForm(); } }, icon('plus'), 'Add the first expense')));
  }

  function splitWords(e) {
    const n = Object.keys(e.split.parts).length;
    if (e.split.mode === 'shares') return 'by shares';
    if (e.split.mode === 'exact') return 'exact amounts';
    return n === 1 ? 'for ' + nameOf(Object.keys(e.split.parts)[0]) : 'split ' + n + ' ways';
  }
  function entryRow(e) {
    const me = cur.meta.me;
    let title, sub, mine = '';
    if (e.kind === 'transfer') {
      title = nameOf(e.payer, { you: true }) + ' paid ' + (e.to === me ? 'you' : nameOf(e.to));
      sub = 'Payment · ' + dayLabel(e.date);
    } else {
      title = e.title || CAT_INFO[e.cat || 'other'][0];
      sub = nameOf(e.payer, { you: true }) + ' paid · ' + dayLabel(e.date) + ' · ' + splitWords(e);
      if (me) {
        const sh = FS.shares(e)[me] || 0;
        const paid = e.payer === me ? e.amount : 0;
        if (paid && paid - sh > 0) mine = 'you lent ' + M(paid - sh);
        else if (sh) mine = 'your share ' + M(sh);
        else mine = 'not involved';
      }
    }
    if (e.kind === 'transfer' && me) mine = e.payer === me ? 'you paid' : e.to === me ? 'you received' : '';
    if (e.versions.length > 1 && !e.deleted) sub += ' · edited';
    if (e.deleted) { sub = 'Removed by ' + nameOf(e.changedBy, { you: true }) + ' · ' + dayLabel(FS.todayISO(new Date(e.changedAt))); mine = ''; }
    if (e.orig && !e.deleted) mine = FS.money(e.orig.amount, e.orig.currency) + (mine ? ' · ' + mine : '');
    const cat = e.kind === 'transfer' ? 'transfer' : CAT_INFO[e.cat || 'other'][1];
    return h('button', { class: 'entry' + (e.deleted ? ' removed' : '') + (ui.fresh.has(e.id) ? ' fresh' : ''), type: 'button', onclick: function () { openDetail(e.id); } },
      icon(cat, 'cat'),
      h('div', { style: 'min-width:0' }, h('div', { class: 'entry-title' }, title), h('div', { class: 'entry-sub' }, sub)),
      h('div', null, h('div', { class: 'entry-amt money' }, M(e.amount)), mine ? h('div', { class: 'entry-mine' }, mine) : null));
  }

  function settleCard() {
    return h('section', { class: 'card', 'aria-labelledby': 'set-h' },
      h('div', { class: 'card-head' }, h('h2', { id: 'set-h' }, 'Settle up'), cur.plan.length ? h('span', { class: 'meta' }, plural(cur.plan.length, 'payment')) : null),
      planRows(),
      h('div', { class: 'card-foot' }, h('span', null, cur.plan.length ? 'The fewest payments that square everyone.' : 'Payments you record show up in the book.'),
        h('button', { class: 'link', type: 'button', onclick: function () { openPaymentForm(); } }, 'Record a payment')));
  }
  function planRows() {
    if (!cur.plan.length) {
      return h('div', { class: 'square' }, icon('circleCheck', 'i-20'), h('span', null, activeEntries().length ? 'Everyone is square.' : 'Nothing to settle yet.'));
    }
    const me = cur.meta.me;
    return cur.plan.map(function (p) {
      return h('div', { class: 'pay-row' },
        h('span', { class: 'pay-who', 'aria-hidden': 'true' }, avatar(p.from, 'sm'), avatar(p.to, 'sm')),
        h('span', { class: 'pay-text' }, h('b', null, p.from === me ? 'You' : nameOf(p.from)), p.from === me ? ' pay ' : ' pays ', h('b', null, p.to === me ? 'you' : nameOf(p.to))),
        h('span', { class: 'pay-amt money' }, M(p.amount)),
        h('button', { class: 'btn btn-ghost btn-sm', type: 'button', onclick: function () { openPaymentForm(p); }, 'aria-label': 'Record ' + nameOf(p.from) + ' paying ' + nameOf(p.to) + ' ' + M(p.amount) }, 'Record'));
    });
  }

  function copyCard() {
    const n = pendingCount();
    const merges = cur.meta.merges || [];
    const last = merges[merges.length - 1];
    if (cur.meta.sample) {
      return h('section', { class: 'card', 'aria-labelledby': 'copy-h' },
        h('div', { class: 'card-head' }, h('h2', { id: 'copy-h' }, 'Your copy')),
        h('p', { class: 'copy-note' }, 'In a real book you send updates to the group chat as a link. Each copy merges what is new, so there is no server and no account.'),
        h('div', { class: 'card-actions' }, h('button', { class: 'btn btn-secondary', type: 'button', onclick: openSendUpdate }, icon('send'), 'See what an update looks like')));
    }
    return h('section', { class: 'card', 'aria-labelledby': 'copy-h' },
      h('div', { class: 'card-head' }, h('h2', { id: 'copy-h' }, 'Your copy'), h('span', { class: 'meta' }, 'on this device')),
      h('dl', { class: 'kv' },
        h('dt', null, 'Not sent yet'), h('dd', null, n ? plural(n, 'change') : 'Nothing'),
        h('dt', null, 'Last sent'), h('dd', null, cur.meta.lastShareAt ? stamp(cur.meta.lastShareAt) : 'Never'),
        h('dt', null, 'Last update from the group'), h('dd', null, last ? (last.fromName || 'Someone') + ', ' + stamp(last.at) : '—')),
      h('div', { class: 'card-actions' }, h('button', { class: 'btn btn-secondary', type: 'button', onclick: openSendUpdate }, icon('send'), n ? 'Send ' + plural(n, 'change') : 'Send the book')));
  }
  function pendingCount() {
    if (!cur) return 0;
    const ids = new Set(cur.book.events.map(function (e) { return e.id; }));
    return cur.meta.pending.filter(function (id) { return ids.has(id); }).length;
  }

  // ---------- screens: expenses ----------
  function screenExpenses() {
    const all = cur.state.entries;
    const me = cur.meta.me;
    const q = ui.q.trim().toLowerCase();
    const filtered = all.filter(function (e) {
      if (ui.filter === 'mine' && me && !(e.payer === me || e.to === me || (e.split && me in e.split.parts))) return false;
      if (ui.filter === 'payments' && e.kind !== 'transfer') return false;
      if (!q) return true;
      const hay = [e.title, e.note, CAT_INFO[e.cat || 'other'][0], nameOf(e.payer), e.to ? nameOf(e.to) : '', M(e.amount)].join(' ').toLowerCase();
      return hay.indexOf(q) >= 0;
    });
    const removed = all.filter(function (e) { return e.deleted; }).length;
    const activeN = all.length - removed;
    const listEl = h('div', null);
    function fillList(items) {
      const groups = [];
      items.forEach(function (e) {
        const key = e.date.slice(0, 7);
        let g = groups[groups.length - 1];
        if (!g || g.key !== key) { g = { key: key, items: [] }; groups.push(g); }
        g.items.push(e);
      });
      fill(listEl);
      if (!items.length) {
        listEl.appendChild(h('p', { class: 'list-empty' }, all.length ? 'Nothing matches. Try another word, or show everything.' : 'No expenses yet.'));
        return;
      }
      groups.forEach(function (g) {
        let t = 0;
        g.items.forEach(function (e) { if (!e.deleted && e.kind === 'expense') t += e.amount; });
        listEl.appendChild(h('div', { class: 'group-head' }, h('b', null, dfMonth.format(isoDate(g.key + '-01'))), h('span', { class: 'money' }, M(t) + ' spent')));
        g.items.forEach(function (e) { listEl.appendChild(entryRow(e)); });
      });
    }
    fillList(filtered);
    const search = h('input', { type: 'search', placeholder: 'Search expenses', 'aria-label': 'Search expenses', value: ui.q, oninput: function (e) {
      ui.q = e.target.value;
      const keep = e.target;
      const view = screenExpenses();
      const fresh = view.querySelector('.entries-list');
      $main.querySelector('.entries-list').replaceWith(fresh);
      keep.focus();
    } });
    const filters = [['all', 'All'], ['mine', 'Yours'], ['payments', 'Payments']].filter(function (f) { return f[0] !== 'mine' || me; });
    return h('div', null,
      h('div', { class: 'title-row' }, h('div', null, h('h1', null, 'Expenses'),
        h('p', { class: 'subline money' }, plural(activeN, 'entry', 'entries') + ' · ' + M(totalSpent()) + ' spent' + (removed ? ' · ' + removed + ' removed, kept in the history' : '')))),
      h('div', { class: 'grid' },
        h('div', { class: 'col-wide' }, h('section', { class: 'card', 'aria-label': 'All entries' },
          h('div', { class: 'card-head' }, h('h2', null, 'All entries'), h('button', { class: 'btn btn-ghost btn-sm', type: 'button', onclick: function () { openPaymentForm(); } }, icon('transfer'), 'Record a payment')),
          h('div', { class: 'toolbar' }, h('div', { class: 'search' }, icon('search'), search),
            h('div', { class: 'seg', role: 'group', 'aria-label': 'Show' }, filters.map(function (f) {
              return h('button', { type: 'button', 'aria-pressed': String(ui.filter === f[0]), onclick: function () { ui.filter = f[0]; render(); } }, f[1]);
            }))),
          h('div', { class: 'entries-list' }, listEl))),
        h('div', { class: 'col-narrow' }, whereCard(), whoPaidCard())));
  }
  function whereCard() {
    const by = {};
    let total = 0;
    activeEntries().forEach(function (e) {
      if (e.kind !== 'expense') return;
      const c = e.cat || 'other';
      by[c] = (by[c] || 0) + e.amount;
      total += e.amount;
    });
    const rows = Object.keys(by).map(function (c) { return [c, by[c]]; }).sort(function (a, b) { return b[1] - a[1]; });
    const max = rows.length ? rows[0][1] : 0;
    return h('section', { class: 'card', 'aria-labelledby': 'where-h' },
      h('div', { class: 'card-head' }, h('h2', { id: 'where-h' }, 'Where it went'), h('span', { class: 'meta money' }, M(total))),
      rows.length ? h('ul', { class: 'bars' }, rows.map(function (r) {
        return h('li', null, icon(CAT_INFO[r[0]][1], 'cat'), h('span', { class: 'lbl' }, CAT_INFO[r[0]][0]), h('span', { class: 'val money' }, M(r[1])),
          h('span', { class: 'bar-line', 'aria-hidden': 'true' }, h('i', { style: 'width:' + (r[1] / max * 100).toFixed(1) + '%' })));
      })) : h('p', { class: 'list-empty' }, 'Spending by kind shows here once there are expenses.'));
  }

  function whoPaidCard() {
    const rows = shownMembers().map(function (m) { return [m.id, cur.bal[m.id].paid]; }).sort(function (a, b) { return b[1] - a[1]; });
    const max = rows.length ? rows[0][1] : 0;
    return h('section', { class: 'card', 'aria-labelledby': 'who-h' },
      h('div', { class: 'card-head' }, h('h2', { id: 'who-h' }, 'Who paid'), h('span', { class: 'meta' }, 'before shares')),
      max ? h('ul', { class: 'bars people-bars' }, rows.map(function (r) {
        return h('li', null, avatar(r[0], 'sm'), h('span', { class: 'lbl' }, nameOf(r[0], { you: true })), h('span', { class: 'val money' }, M(r[1])),
          h('span', { class: 'bar-line', 'aria-hidden': 'true' }, h('i', { style: 'width:' + (r[1] / max * 100).toFixed(1) + '%' })));
      })) : h('p', { class: 'list-empty' }, 'Nobody has paid for anything yet.'));
  }

  // ---------- screens: settle up ----------
  function screenSettle() {
    const transfers = cur.state.entries.filter(function (e) { return e.kind === 'transfer'; });
    const n = cur.plan.length;
    const people = shownMembers();
    // A worked example from this book's own numbers: the person furthest from square.
    let ex = null;
    people.forEach(function (m) { if (!ex || Math.abs(cur.bal[m.id].net) > Math.abs(cur.bal[ex.id].net)) ex = m; });
    const eb = ex ? cur.bal[ex.id] : null;
    const example = eb && eb.net ? (function () {
      const you = ex.id === cur.meta.me;
      let t = (you ? 'You paid ' : ex.name + ' paid ') + M(eb.paid) + ' and ' + (you ? 'your' : 'their') + ' share comes to ' + M(eb.share);
      if (eb.sent) t += ', with ' + M(eb.sent) + ' already paid back';
      if (eb.received) t += ', with ' + M(eb.received) + ' already received';
      return t + (eb.net > 0 ? ', so ' + (you ? "you're" : ex.name + ' is') + ' owed ' + M(eb.net) + '.' : ', so ' + (you ? 'you owe ' : ex.name + ' owes ') + M(-eb.net) + '.');
    })() : null;
    return h('div', null,
      h('div', { class: 'title-row' }, h('div', null, h('h1', null, 'Settle up'),
        h('p', { class: 'subline' }, n ? plural(n, 'payment') + ' square everyone' : activeEntries().length ? 'Everyone is square' : 'Nothing to settle yet'))),
      h('div', { class: 'grid' },
        h('div', { class: 'col-main' },
          h('section', { class: 'card', 'aria-labelledby': 'plan-h' },
            h('div', { class: 'card-head' }, h('h2', { id: 'plan-h' }, 'Payments to make'),
              n ? h('button', { class: 'btn btn-ghost btn-sm', type: 'button', onclick: copyPlan }, icon('copy'), 'Copy the list') : null),
            planRows(),
            h('div', { class: 'card-foot' }, h('span', null, 'Tap Record once the money has moved. Everyone you send the book to sees it.'))),
          h('section', { class: 'card', 'aria-labelledby': 'how-h' },
            h('div', { class: 'card-head' }, h('h2', { id: 'how-h' }, 'How this is worked out')),
            h('div', { class: 'card-body' },
              h('p', null, "Each person's balance is what they paid, minus their share of every expense they're in, adjusted for payments already made. The payments above are the fewest that bring every balance to zero."),
              example ? h('p', { style: 'margin-top:10px' }, example) : null,
              h('p', { style: 'margin-top:10px;color:var(--muted)' }, 'Open any balance on the Overview to see its working, line by line.')))),
        h('div', { class: 'col-side' },
          h('section', { class: 'card ledger-card', 'aria-labelledby': 'behind-h' },
            h('div', { class: 'card-head' }, h('h2', { id: 'behind-h' }, 'The balances behind it'), h('span', { class: 'meta' }, 'paid \u2212 share + payments')),
            h('table', { class: 'ledger' },
              h('thead', null, h('tr', null, h('th', { scope: 'col' }, 'Person'), h('th', { scope: 'col', class: 'num' }, 'Paid'), h('th', { scope: 'col', class: 'num' }, 'Share'), h('th', { scope: 'col', class: 'num' }, 'Payments'), h('th', { scope: 'col', class: 'num' }, 'Balance'))),
              h('tbody', null, people.map(function (m) {
                const b = cur.bal[m.id];
                return h('tr', null,
                  h('th', { scope: 'row' }, h('span', { class: 'who' }, avatar(m.id, 'sm'), h('span', null, m.id === cur.meta.me ? 'You' : m.name))),
                  h('td', { class: 'num' }, M(b.paid)),
                  h('td', { class: 'num' }, M(b.share)),
                  h('td', { class: 'num' + (b.sent - b.received ? '' : ' zero') }, b.sent - b.received ? M(b.sent - b.received, { sign: true }) : '\u2014'),
                  h('td', { class: 'num strong' + (b.net === 0 ? ' zero' : '') }, M(b.net, { sign: true })));
              }))),
            h('ul', { class: 'ledger-list' }, people.map(function (m) {
              const b = cur.bal[m.id];
              const parts = ['paid ' + M(b.paid), 'share ' + M(b.share)];
              if (b.sent - b.received) parts.push('payments ' + M(b.sent - b.received, { sign: true }));
              return h('li', null, avatar(m.id, 'sm'),
                h('span', { class: 'who-name' }, m.id === cur.meta.me ? 'You' : m.name),
                h('span', { class: 'money strong' + (b.net === 0 ? ' zero' : '') }, M(b.net, { sign: true })),
                h('span', { class: 'parts money' }, joinWith(parts.map(function (t) { return h('span', { style: 'white-space:nowrap' }, t); }), ' \u00b7 ')));
            }))),
          h('section', { class: 'card', 'aria-labelledby': 'paid-h' },
            h('div', { class: 'card-head' }, h('h2', { id: 'paid-h' }, 'Payments so far'), transfers.length ? h('span', { class: 'meta' }, String(transfers.filter(function (t) { return !t.deleted; }).length)) : null),
            transfers.length ? h('div', null, transfers.map(function (e) { return entryRow(e); })) : h('p', { class: 'list-empty' }, 'No payments recorded yet.'),
            h('div', { class: 'card-foot' }, h('span', null, 'Paid a different amount?'), h('button', { class: 'link', type: 'button', onclick: function () { openPaymentForm(); } }, 'Record a payment'))))));
  }
  function copyPlan() {
    const me = cur.meta.me;
    const lines = [cur.state.name + ': to settle up'].concat(cur.plan.map(function (p) {
      return nameOf(p.from) + ' pays ' + nameOf(p.to) + ' ' + M(p.amount);
    }));
    void me;
    copyText(lines.join('\n'), 'List copied. Paste it into the group chat.');
  }

  // ---------- screens: book settings ----------
  function screenBookSettings() {
    const st = cur.state;
    const nameIn = h('input', { class: 'input', id: 'bk-name', value: st.name, maxlength: '60' });
    const nameSaved = h('span', { class: 'saved', 'aria-live': 'polite' }, 'Saved');
    function saveName() {
      const v = nameIn.value.trim();
      if (!v || v === st.name) { nameIn.value = st.name; return; }
      commit([{ id: FS.uid(), t: 'book', at: Date.now(), by: cur.meta.me, name: v, currency: st.currency }], { quiet: true });
      renderBar(route());
      nameSaved.classList.add('show');
      setTimeout(function () { nameSaved.classList.remove('show'); }, 1600);
    }
    nameIn.addEventListener('change', saveName);
    nameIn.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); nameIn.blur(); } });
    const hasEntries = st.entries.length > 0;
    const curSel = currencySelect(st.currency, 'bk-cur');
    if (hasEntries) curSel.disabled = true;
    curSel.addEventListener('change', function () {
      commit([{ id: FS.uid(), t: 'book', at: Date.now(), by: cur.meta.me, name: st.name, currency: curSel.value }]);
      toast('Currency changed to ' + curSel.value + '.');
    });

    const people = st.members.filter(function (m) { return !m.gone; }).map(function (m) {
      const used = FS.isUsed(st, m.id);
      return h('div', { class: 'person-row' }, avatar(m.id),
        h('div', null, h('div', { style: 'font-weight:500' }, m.name, m.id === cur.meta.me ? h('span', { class: 'you' }, ' (you on this device)') : null),
          h('div', { class: 'hint' }, used ? 'In ' + plural(st.entries.filter(function (e) { return !e.deleted && (e.payer === m.id || e.to === m.id || (e.split && m.id in e.split.parts)); }).length, 'entry', 'entries') : 'Not in any entry yet')),
        h('div', { class: 'acts' },
          h('button', { class: 'btn btn-text btn-sm', type: 'button', onclick: function () { renamePerson(m); } }, 'Rename'),
          used ? null : h('button', { class: 'btn btn-text btn-sm', type: 'button', onclick: function () {
            confirmSheet('Remove ' + m.name + '?', m.name + " isn't in any entry yet, so removing them changes no balance.", 'Remove ' + m.name, function () {
              commit([{ id: FS.uid(), t: 'member', at: Date.now(), by: cur.meta.me, mid: m.id, name: m.name, gone: true }]);
              toast(m.name + ' removed from the book.');
            });
          } }, 'Remove')));
    });
    const newPerson = h('input', { class: 'input', placeholder: 'Name', maxlength: '40', 'aria-label': 'New person' });
    function addPerson(e) {
      e.preventDefault();
      const v = newPerson.value.trim();
      if (!v) { newPerson.focus(); return; }
      commit([{ id: FS.uid(), t: 'member', at: Date.now(), by: cur.meta.me, mid: FS.uid(5), name: v }]);
      toast(v + ' added. Send an update so everyone has them.');
    }
    const meSel = h('select', { class: 'input', id: 'bk-me' },
      h('option', { value: '' }, 'Just looking (none of these)'),
      st.members.filter(function (m) { return !m.gone; }).map(function (m) { return h('option', { value: m.id, selected: m.id === cur.meta.me ? true : null }, m.name); }));
    meSel.addEventListener('change', function () { cur.meta.me = meSel.value; saveMeta(); render(); toast(meSel.value ? 'This device is now ' + nameOf(meSel.value) + '.' : 'This device is now just looking.'); });

    return h('div', null,
      h('div', { class: 'title-row' }, h('div', null, h('h1', null, 'Book'),
        h('p', { class: 'subline' }, 'Changes to the name and people go to everyone you send the book to.'))),
      h('div', { class: 'settings' },
        setRow('Name and currency', hasEntries ? 'The currency is fixed once there are entries, so no amount changes meaning.' : 'Pick the currency before the first entry.',
          h('div', null,
            h('div', { class: 'field' }, h('div', { style: 'display:flex;justify-content:space-between;align-items:baseline' }, h('label', { for: 'bk-name', class: 'label' }, 'Book name'), nameSaved), nameIn),
            h('div', { class: 'field' }, h('label', { for: 'bk-cur' }, 'Currency'), curSel,
              hasEntries ? h('p', { class: 'hint' }, 'Spending in another currency can still be converted when you add it.') : null))),
        setRow('People', 'Everyone who shares costs. Someone already in an entry can be renamed but not removed, so no balance changes behind anyone’s back.',
          h('div', null, people,
            h('form', { class: 'inline-add', onsubmit: addPerson }, newPerson, h('button', { class: 'btn btn-ghost', type: 'submit' }, icon('userPlus'), 'Add')))),
        setRow('This device', 'Who you are in this book. It decides how balances are worded and is never sent to anyone.',
          h('div', { class: 'field' }, h('label', { for: 'bk-me' }, 'You are'), meSel)),
        setRow('Sharing and backup', 'The whole book travels inside the link, so anyone you send it to can open it without an account. A backup file does the same job by email or a drive.',
          h('div', { style: 'display:flex;gap:8px;flex-wrap:wrap' },
            h('button', { class: 'btn btn-secondary', type: 'button', onclick: openSendUpdate }, icon('send'), 'Send update'),
            h('button', { class: 'btn btn-ghost', type: 'button', onclick: downloadBackup }, icon('download'), 'Save a backup file'),
            h('button', { class: 'btn btn-ghost', type: 'button', onclick: pickFile }, icon('upload'), 'Open a backup file'))),
        setRow('Appearance', 'Light, dark, or whatever this device uses.', themeControl()),
        setRow('Remove from this device', 'Deletes this copy only. Everyone you shared the book with keeps theirs, and you can rejoin from their next link.',
          h('button', { class: 'btn btn-danger', type: 'button', onclick: function () {
            confirmSheet('Remove ' + st.name + ' from this device?', pendingCount() ? 'You have ' + plural(pendingCount(), 'change') + " that nobody else has yet. Send an update first, or they're lost." : 'Other copies are not affected.', 'Remove from this device', function () {
              const name = st.name;
              store.del(KEY.book(cur.id)); store.del(KEY.meta(cur.id));
              store.set(KEY.index, bookIds().filter(function (x) { return x !== cur.id; }));
              cur = null;
              go('/');
              toast(name + ' removed from this device.');
            }, true);
          } }, icon('trash'), 'Remove ' + st.name), 'danger-row')));
  }

  function missingBook() {
    return h('section', { class: 'card error-card' },
      h('div', { class: 'card-head' }, h('h1', { style: 'font-size:18px' }, "This book isn't on this device")),
      h('div', { class: 'card-body' }, h('p', null, 'It may have been removed, or it was opened on another phone. Ask someone in the group to send the book again.'),
        h('p', null, h('a', { class: 'btn btn-secondary', href: '#/' }, 'Go to your books'))));
  }

  // ---------- links: opening and merging ----------
  async function handleLink(code) {
    fill($bar, h('div', { class: 'bar-in' }, h('a', { class: 'brand', href: '#/' }, mark(), h('span', { class: 'word' }, 'Fair Split'))));
    $tabbar.hidden = true;
    document.body.classList.add('no-tabs');
    if (!ui.join || ui.join.code !== code) {
      fill($main, h('p', { class: 'subline', role: 'status' }, 'Opening the book…'));
      try {
        const got = await FS.decode(code);
        ui.join = { code: code, got: got };
      } catch (err) {
        ui.join = null;
        fill($main, linkError(err.message));
        return;
      }
    }
    receive(ui.join.got, 'link');
  }

  // A book arrived (link or file): merge it into our copy, or offer to join.
  function receive(got, via) {
    const incoming = got.book;
    const existing = loadBookRaw(incoming.id);
    const fromName = got.from ? (FS.fold(incoming).memberById[got.from] || {}).name || '' : '';
    if (existing) {
      const meta = loadMeta(incoming.id);
      const before = FS.fold(existing);
      const res = FS.merge(existing, incoming);
      const after = FS.fold(res.book);
      const sum = FS.summarize(before, after, res.added);
      const incomingIds = new Set(incoming.events.map(function (e) { return e.id; }));
      meta.pending = meta.pending.filter(function (id) { return !incomingIds.has(id); });
      const who = fromName ? fromName + "'s copy" : 'the copy you opened';
      if (res.added.length) {
        meta.merges = (meta.merges || []).concat([{ from: got.from, fromName: fromName, sent: got.sent, at: Date.now(), added: res.added.length }]).slice(-20);
        meta.notice = { text: 'Updated from ' + who + ': ' + describeSummary(sum) + '.', eids: sum.eids };
      } else {
        meta.notice = { text: 'Your copy already had everything in ' + who + '.', eids: [] };
      }
      saveBook(res.book, meta);
      touchIndex(incoming.id);
      cur = null;
      ui.join = null;
      history.replaceState(null, '', location.pathname + location.search + '#/b/' + incoming.id);
      render();
      return;
    }
    ui.join = Object.assign(ui.join || {}, { got: got, via: via });
    fill($main, joinScreen(got, fromName));
    $main.focus({ preventScroll: true });
  }
  function describeSummary(s) {
    const bits = [];
    if (s.newEntries) bits.push(plural(s.newEntries, 'new entry', 'new entries'));
    if (s.changed) bits.push(plural(s.changed, 'correction'));
    if (s.removed) bits.push(s.removed + ' removed');
    if (s.restored) bits.push(s.restored + ' restored');
    if (s.newPeople) bits.push(plural(s.newPeople, 'new person', 'new people'));
    if (s.renamed) bits.push(plural(s.renamed, 'name change'));
    if (s.renamedBook) bits.push('a new book name');
    return bits.length ? bits.join(', ') : 'nothing new';
  }
  function joinScreen(got, fromName) {
    const st = FS.fold(got.book);
    const active = st.entries.filter(function (e) { return !e.deleted; });
    let choice = '';
    const people = st.members.filter(function (m) { return !m.gone; });
    const saved = cur;
    cur = { state: st, meta: { me: '' }, bal: FS.balances(st) };
    const chips = h('div', { class: 'chips', role: 'radiogroup', 'aria-label': 'Which one are you?' },
      people.map(function (m) {
        return h('button', { class: 'chip', type: 'button', role: 'radio', 'aria-checked': 'false', 'data-mid': m.id, onclick: pick }, avatar(m.id), m.name);
      }).concat([h('button', { class: 'chip plain', type: 'button', role: 'radio', 'aria-checked': 'false', 'data-mid': '', onclick: pick }, 'None of these, just looking')]));
    cur = saved;
    const go2 = h('button', { class: 'btn btn-primary', type: 'button', disabled: true, onclick: join }, 'Open the book');
    function pick(e) {
      choice = e.currentTarget.getAttribute('data-mid');
      chips.querySelectorAll('.chip').forEach(function (c) { c.setAttribute('aria-checked', String(c === e.currentTarget)); });
      go2.disabled = false;
    }
    function join() {
      const meta = Object.assign(loadMeta(got.book.id), { me: choice, pending: [], merges: [{ from: got.from, fromName: fromName, sent: got.sent, at: Date.now(), added: got.book.events.length }], notice: null });
      if (!saveBook(got.book, meta)) return;
      touchIndex(got.book.id);
      ui.join = null;
      cur = null;
      history.replaceState(null, '', location.pathname + location.search + '#/b/' + got.book.id);
      render();
      toast('Saved on this device. Send an update when you add something.');
    }
    const lastChange = st.updatedAt ? stamp(st.updatedAt) : '';
    const bal = FS.balances(st);
    cur = { state: st, meta: { me: '' }, bal: bal };
    let spent = 0;
    active.forEach(function (e) { if (e.kind === 'expense') spent += e.amount; });
    const preview = h('section', { class: 'card', 'aria-labelledby': 'jp-h' },
      h('div', { class: 'card-head' }, h('h2', { id: 'jp-h' }, 'In this book'), h('span', { class: 'meta money' }, FS.money(spent, st.currency) + ' spent')),
      h('ul', { class: 'balances' }, people.map(function (m) {
        return h('li', { class: 'bal-row' }, h('div', { class: 'bal-btn join-row' }, avatar(m.id),
          h('div', { style: 'min-width:0' }, h('div', { class: 'bal-name' }, m.name), h('div', { class: 'bal-sub money' }, 'paid ' + FS.money(bal[m.id].paid, st.currency))),
          h('div', { class: 'bal-amt money' + (bal[m.id].net === 0 ? ' zero' : '') }, FS.money(bal[m.id].net, st.currency, { sign: true }))));
      })));
    cur = saved;
    return h('div', null,
      h('div', { class: 'title-row' }, h('div', null, h('h1', null, 'Join ' + st.name),
        h('p', { class: 'subline' }, (fromName ? fromName + ' sent you this book' : 'Someone sent you this book') + ' · ' + plural(people.length, 'person', 'people') + ' · ' + plural(active.length, 'entry', 'entries') + (lastChange ? ' · last change ' + lastChange : '')))),
      h('div', { class: 'grid' },
        h('div', { class: 'col-main' }, h('section', { class: 'card' },
          h('div', { class: 'card-head' }, h('h2', null, 'Which one are you?')),
          h('div', { class: 'card-body' }, chips,
            h('p', { class: 'hint', style: 'margin-top:14px' }, 'The book is saved on this device only. Fair Split has no server: to share what you add, send an update back to the group.')),
          h('div', { class: 'card-foot' }, h('a', { class: 'btn btn-ghost', href: '#/' }, 'Not now'), go2))),
        h('div', { class: 'col-side' }, preview)));
  }
  function linkError(msg) {
    return h('section', { class: 'card error-card' },
      h('div', { class: 'card-head' }, h('h1', { style: 'font-size:18px' }, "This link can't be opened")),
      h('div', { class: 'card-body' }, h('p', null, msg), pasteBox(), h('p', null, h('a', { class: 'link', href: '#/' }, 'Go to your books'))));
  }

  // Share target and pasted messages arriving as ?text=
  (function readShareTarget() {
    try {
      const p = new URLSearchParams(location.search);
      const text = [p.get('text'), p.get('url'), p.get('title')].filter(Boolean).join(' ');
      if (!text) return;
      const code = FS.findCode(text);
      history.replaceState(null, '', location.pathname + (code ? '#j=' + code : location.hash));
    } catch (e) { /* ignore */ }
  })();

  // ---------- sending an update ----------
  function describePending() {
    const ids = new Set(cur.meta.pending);
    const byEid = {};
    const out = [];
    const events = cur.book.events.slice().sort(function (a, b) { return a.at - b.at; });
    events.forEach(function (ev) {
      if (!ids.has(ev.id)) return;
      if (ev.t === 'entry') { byEid[ev.eid] = ev; }
      else if (ev.t === 'member') {
        const m = cur.state.memberById[ev.mid];
        if (ev.gone) out.push('Removed ' + ev.name + ' from the book');
        else if (m && m.addedAt === ev.at) out.push('Added ' + ev.name);
        else out.push('Renamed a person to ' + ev.name);
      } else if (ev.t === 'book') out.push('Book is now called ' + ev.name);
    });
    Object.keys(byEid).forEach(function (eid) {
      const e = cur.state.entryById[eid];
      if (!e) return;
      const mineVersions = e.versions.filter(function (v) { return ids.has(v.id); });
      const createdHere = ids.has(e.versions[0].id);
      const label = e.kind === 'transfer' ? nameOf(e.payer) + ' paid ' + nameOf(e.to) + ' ' + M(e.amount) : (e.title || CAT_INFO[e.cat || 'other'][0]) + ', ' + M(e.amount) + ', paid by ' + nameOf(e.payer);
      if (e.deleted) out.push('Removed: ' + (e.title || 'a payment') + ' (' + M(e.amount) + ')');
      else if (createdHere) out.push(label);
      else {
        const prev = e.versions[e.versions.indexOf(mineVersions[0]) - 1];
        const d = prev ? FS.diffVersions(prev, e.versions[e.versions.length - 1]) : [];
        const amt = d.find(function (x) { return x.field === 'amount'; });
        if (d.some(function (x) { return x.field === 'deleted'; })) out.push('Restored: ' + label);
        else out.push('Changed: ' + (e.title || 'a payment') + (amt ? ' (' + M(amt.from) + ' → ' + M(amt.to) + ')' : ''));
      }
    });
    return out;
  }
  function updateMessage(link) {
    const st = cur.state;
    const lines = [st.name + ' on Fair Split'];
    const changes = cur.meta.sample ? [] : describePending();
    if (changes.length) {
      lines.push('', 'New from ' + (cur.meta.me ? nameOf(cur.meta.me) : 'me') + ':');
      changes.slice(0, 6).forEach(function (c) { lines.push('• ' + c); });
      if (changes.length > 6) lines.push('• and ' + (changes.length - 6) + ' more');
    }
    const people = shownMembers();
    lines.push('', 'Balances: ' + people.map(function (m) { return m.name + ' ' + M(cur.bal[m.id].net, { sign: true }); }).join(', '));
    if (cur.plan.length) lines.push('To settle: ' + cur.plan.map(function (p) { return nameOf(p.from) + ' → ' + nameOf(p.to) + ' ' + M(p.amount); }).join(', '));
    lines.push('', 'Open to update your copy (no sign-up): ' + link);
    return lines.join('\n');
  }
  function shareBase() { return location.href.split('#')[0].split('?')[0]; }

  async function openSendUpdate() {
    const body = h('div', null, h('p', { class: 'subline', role: 'status' }, 'Packing the book…'));
    const foot = h('div', { class: 'sheet-foot' });
    openSheet('Send an update', body, foot);
    let code;
    try { code = await FS.encode(cur.book, cur.meta.me); }
    catch (e) { fill(body, h('p', { class: 'err' }, "Couldn't pack the book: " + e.message)); return; }
    const link = shareBase() + '#j=' + code;
    const text = updateMessage(link);
    const preview = h('div', { class: 'message', 'aria-label': 'Message preview' });
    const idx = text.lastIndexOf(link);
    preview.append(text.slice(0, idx), h('span', { class: 'lnk' }, link.length > 90 ? link.slice(0, 64) + '…' : link));
    const big = link.length > 60000;
    fill(body, 
      h('p', { style: 'margin-bottom:14px' }, cur.meta.sample ? 'This is what the group would get. The link carries the whole book, so opening it merges your changes into their copy.' : 'Post this in the group chat. The link carries the whole book, so anyone who opens it gets your changes merged into their copy.'),
      preview,
      h('p', { class: 'hint', style: 'margin-top:10px' }, 'Link size ' + kb(link.length) + '. Nothing is uploaded: the book travels inside the link.'),
      big ? h('p', { class: 'notice', style: 'margin-top:12px' }, 'This book is large, and some chat apps cut very long messages. If the link fails for someone, send a backup file instead.') : null);
    function sent(msg) {
      if (!cur.meta.sample) { cur.meta.pending = []; cur.meta.lastShareAt = Date.now(); saveMeta(); }
      closeSheet(function () { render(); toast(msg); });
    }
    const canShare = typeof navigator.share === 'function';
    fill(foot, 
      h('button', { class: 'btn btn-ghost', type: 'button', onclick: function () { copyText(link, null).then(function (ok) { if (ok) sent('Link copied. Paste it into the group chat.'); }); } }, icon('link'), 'Copy link'),
      big ? h('button', { class: 'btn btn-ghost', type: 'button', onclick: downloadBackup }, icon('download'), 'Backup file') : null,
      h('span', { class: 'spacer' }),
      canShare ? h('button', { class: 'btn btn-secondary', type: 'button', onclick: function () { copyText(text, null).then(function (ok) { if (ok) sent('Message copied. Paste it into the group chat.'); }); } }, icon('copy'), 'Copy message') : null,
      h('button', { class: 'btn btn-primary', type: 'button', onclick: function () {
        if (!canShare) { copyText(text, null).then(function (ok) { if (ok) sent('Message copied. Paste it into the group chat.'); }); return; }
        navigator.share({ text: text }).then(function () { sent('Update shared.'); }).catch(function (e) { if (e && e.name !== 'AbortError') toast("Couldn't open sharing. Copy the message instead."); });
      } }, icon(canShare ? 'share' : 'copy'), canShare ? 'Share…' : 'Copy message'));
  }

  function copyText(text, msg) {
    const done = function () { if (msg) toast(msg); return true; };
    if (navigator.clipboard && window.isSecureContext) {
      return navigator.clipboard.writeText(text).then(done, function () { return fallbackCopy(text) ? done() : (toast("Couldn't copy. Select the text and copy it by hand."), false); });
    }
    return Promise.resolve(fallbackCopy(text) ? done() : (toast("Couldn't copy. Select the text and copy it by hand."), false));
  }
  function fallbackCopy(text) {
    const ta = h('textarea', { style: 'position:fixed;opacity:0;top:0;left:0', readonly: true });
    ta.value = text;
    ($dlg.open ? $dlg : document.body).appendChild(ta);
    ta.select();
    let ok = false;
    try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
    ta.remove();
    return ok;
  }

  // ---------- backup files ----------
  function downloadBackup() {
    const data = JSON.stringify({ app: 'fairsplit', v: 1, book: cur.book, from: cur.meta.me, sent: Date.now() });
    const blob = new Blob([data], { type: 'application/json' });
    const a = h('a', { href: URL.createObjectURL(blob), download: cur.state.name.replace(/[^\w\- ]+/g, '').trim().replace(/\s+/g, '-').toLowerCase() + '.fairsplit.json' });
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 2000);
    toast('Backup saved. Anyone can open it with Fair Split to get the book.');
  }
  function pickFile() {
    const inp = h('input', { type: 'file', accept: '.json,application/json', style: 'display:none' });
    inp.addEventListener('change', function () {
      const f = inp.files && inp.files[0];
      inp.remove();
      if (!f) return;
      if (f.size > 20e6) { toast('That file is too large to be a Fair Split book.'); return; }
      f.text().then(function (t) {
        let data;
        try { data = JSON.parse(t); } catch (e) { toast("That file isn't a Fair Split backup."); return; }
        const book = data && data.app === 'fairsplit' ? FS.cleanBook(data.book) : null;
        if (!book) { toast("That file isn't a Fair Split backup."); return; }
        if ($dlg.open) closeSheet();
        ui.join = { code: 'file', got: { book: book, from: typeof data.from === 'string' ? data.from : '', sent: data.sent || 0 } };
        fill($bar, h('div', { class: 'bar-in' }, h('a', { class: 'brand', href: '#/' }, mark(), h('span', { class: 'word' }, 'Fair Split'))));
        $tabbar.hidden = true;
        receive(ui.join.got, 'file');
      });
    });
    document.body.appendChild(inp);
    inp.click();
  }

  // ---------- the sample ----------
  function openSample() {
    const s = window.FairSplitSample.build(FS);
    if (!loadBookRaw(s.book.id)) {
      saveBook(s.book, Object.assign(loadMeta(s.book.id), { me: s.me, sample: true, pending: [] }));
    }
    touchIndex(s.book.id);
    go('/b/' + s.book.id);
  }

  // ---------- currency ----------
  const REGION_CUR = { US: 'USD', GB: 'GBP', IE: 'EUR', DE: 'EUR', FR: 'EUR', ES: 'EUR', IT: 'EUR', PT: 'EUR', NL: 'EUR', BE: 'EUR', AT: 'EUR', FI: 'EUR', GR: 'EUR', SK: 'EUR', SI: 'EUR', LV: 'EUR', LT: 'EUR', EE: 'EUR', LU: 'EUR', MT: 'EUR', CY: 'EUR', HR: 'EUR', BG: 'EUR', CH: 'CHF', SE: 'SEK', NO: 'NOK', DK: 'DKK', IS: 'ISK', PL: 'PLN', CZ: 'CZK', HU: 'HUF', RO: 'RON', RS: 'RSD', TR: 'TRY', UA: 'UAH', IN: 'INR', PK: 'PKR', BD: 'BDT', LK: 'LKR', NP: 'NPR', CN: 'CNY', HK: 'HKD', TW: 'TWD', JP: 'JPY', KR: 'KRW', SG: 'SGD', MY: 'MYR', ID: 'IDR', TH: 'THB', VN: 'VND', PH: 'PHP', AU: 'AUD', NZ: 'NZD', CA: 'CAD', MX: 'MXN', BR: 'BRL', AR: 'ARS', CL: 'CLP', CO: 'COP', PE: 'PEN', ZA: 'ZAR', NG: 'NGN', GH: 'GHS', KE: 'KES', UG: 'UGX', TZ: 'TZS', RW: 'RWF', ET: 'ETB', EG: 'EGP', MA: 'MAD', AE: 'AED', SA: 'SAR', QA: 'QAR', IL: 'ILS', JO: 'JOD', KW: 'KWD' };
  function defaultCurrency() {
    try {
      const langs = navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language];
      for (const l of langs) {
        const region = new Intl.Locale(l).maximize().region;
        if (REGION_CUR[region]) return REGION_CUR[region];
      }
    } catch (e) { /* fall through */ }
    return 'USD';
  }
  const COMMON = ['USD', 'EUR', 'GBP', 'INR', 'CAD', 'AUD', 'JPY', 'CNY', 'BRL', 'MXN', 'NGN', 'ZAR', 'KES', 'GHS', 'CHF', 'SEK', 'PLN', 'TRY', 'AED', 'SGD'];
  let allCodes = null;
  function currencyCodes() {
    if (allCodes) return allCodes;
    try { allCodes = Intl.supportedValuesOf('currency'); } catch (e) { allCodes = []; }
    if (!allCodes.length) allCodes = COMMON.slice().sort();
    return allCodes;
  }
  function currencyName(code) {
    try { return new Intl.DisplayNames(undefined, { type: 'currency' }).of(code); } catch (e) { return code; }
  }
  function currencySelect(selected, id, short) {
    const common = COMMON.indexOf(selected) >= 0 ? COMMON : [selected].concat(COMMON);
    const opt = function (c) { return h('option', { value: c, selected: c === selected ? true : null }, short ? c : currencyName(c) + ' (' + c + ')'); };
    return h('select', { class: 'input', id: id },
      h('optgroup', { label: 'Common' }, common.map(opt)),
      h('optgroup', { label: 'All currencies' }, currencyCodes().filter(function (c) { return common.indexOf(c) < 0; }).map(opt)));
  }

  // ---------- sheets (dialogs) ----------
  let sheet = { pushed: false, after: null, closing: false };
  function openSheet(title, body, foot, focusEl) {
    const head = h('div', { class: 'sheet-head' }, h('h2', { id: 'sheet-title' }, title),
      h('button', { class: 'btn btn-text btn-icon', type: 'button', 'aria-label': 'Close', onclick: function () { closeSheet(); } }, icon('x', 'i-20')));
    $dlg.setAttribute('aria-labelledby', 'sheet-title');
    fill($dlg, head, h('div', { class: 'sheet-body' }, body), foot || null);
    $dlg.classList.remove('closing');
    if (!$dlg.open) {
      $dlg.showModal();
      if (!sheet.pushed) { history.pushState({ sheet: true }, ''); sheet.pushed = true; }
    }
    $dlg.querySelector('.sheet-body').scrollTop = 0;
    if (focusEl && window.matchMedia('(pointer: fine)').matches) {
      setTimeout(function () { focusEl.focus(); }, 30);
    } else {
      const t = head.querySelector('h2');
      t.setAttribute('tabindex', '-1');
      t.focus({ preventScroll: true });
    }
  }
  function finishClose() {
    $dlg.classList.remove('closing');
    if ($dlg.open) $dlg.close();
    sheet.closing = false;
    const after = sheet.after; sheet.after = null;
    if (after) after();
  }
  function closeSheet(after) {
    if (!$dlg.open || sheet.closing) { if (after) after(); return; }
    sheet.closing = true;
    sheet.after = after || null;
    $dlg.classList.add('closing');
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    setTimeout(function () {
      if (sheet.pushed) { sheet.pushed = false; sheet.popByUs = true; history.back(); }
      else finishClose();
    }, reduce ? 0 : 170);
  }
  window.addEventListener('popstate', function () {
    if (sheet.popByUs) { sheet.popByUs = false; finishClose(); return; }
    if ($dlg.open) { sheet.pushed = false; sheet.closing = true; finishClose(); }
  });
  $dlg.addEventListener('cancel', function (e) { e.preventDefault(); closeSheet(); });
  $dlg.addEventListener('click', function (e) { if (e.target === $dlg) closeSheet(); });

  function confirmSheet(title, text, label, fn, danger) {
    openSheet(title, h('p', null, text), h('div', { class: 'sheet-foot' }, h('span', { class: 'spacer' }),
      h('button', { class: 'btn btn-ghost', type: 'button', onclick: function () { closeSheet(); } }, 'Cancel'),
      h('button', { class: danger ? 'btn btn-danger' : 'btn btn-primary', type: 'button', onclick: function () { closeSheet(fn); } }, label)));
  }
  function renamePerson(m) {
    const inp = h('input', { class: 'input', id: 'rn', value: m.name, maxlength: '40' });
    function save(e) {
      if (e) e.preventDefault();
      const v = inp.value.trim();
      if (!v) { inp.setAttribute('aria-invalid', 'true'); inp.focus(); return; }
      closeSheet(function () {
        if (v !== m.name) { commit([{ id: FS.uid(), t: 'member', at: Date.now(), by: cur.meta.me, mid: m.id, name: v }]); toast('Renamed to ' + v + '.'); }
      });
    }
    openSheet('Rename ' + m.name, h('form', { onsubmit: save }, h('div', { class: 'field' }, h('label', { for: 'rn' }, 'Name'), inp)),
      h('div', { class: 'sheet-foot' }, h('span', { class: 'spacer' }), h('button', { class: 'btn btn-ghost', type: 'button', onclick: function () { closeSheet(); } }, 'Cancel'), h('button', { class: 'btn btn-primary', type: 'button', onclick: save }, 'Save')), inp);
  }

  // ---------- an entry in full ----------
  function openDetail(eid) {
    const e = cur.state.entryById[eid];
    if (!e) return;
    const isT = e.kind === 'transfer';
    const title = isT ? nameOf(e.payer) + ' paid ' + nameOf(e.to) : (e.title || CAT_INFO[e.cat || 'other'][0]);
    const body = h('div', null,
      h('div', { class: 'big-amount' + (e.deleted ? ' you' : ''), style: e.deleted ? 'text-decoration:line-through' : null }, M(e.amount)),
      e.orig ? h('p', { class: 'detail-meta money' }, FS.money(e.orig.amount, e.orig.currency) + ' at 1 ' + e.orig.currency + ' = ' + formatRate(e.orig.rate) + ' ' + cur.state.currency) : null,
      h('p', { class: 'detail-meta' }, (isT ? 'Payment' : 'Paid by ' + nameOf(e.payer, { you: true })) + ' · ' + dfWeekday.format(isoDate(e.date)) + (isT ? '' : ' · ' + CAT_INFO[e.cat || 'other'][0])),
      e.deleted ? h('p', { class: 'notice', style: 'margin-top:14px' }, 'Removed by ' + nameOf(e.changedBy, { you: true }) + ', ' + stamp(e.changedAt) + '. It no longer counts in any balance.') : null,
      !isT ? h('div', { class: 'detail-block' },
        h('h3', null, e.split.mode === 'shares' ? 'Split by shares' : e.split.mode === 'exact' ? 'Split by exact amounts' : 'Split equally'),
        h('ul', { class: 'share-rows' }, (function () {
          const sh = FS.shares(e);
          return Object.keys(sh).map(function (mid) {
            return h('li', null, avatar(mid, 'sm'), h('span', null, nameOf(mid, { you: true }), e.split.mode === 'shares' ? h('span', { class: 'you' }, ' · ' + e.split.parts[mid] + (e.split.parts[mid] === 1 ? ' share' : ' shares')) : null), h('span', { class: 'r money' }, M(sh[mid])));
          });
        })())) : null,
      e.note ? h('div', { class: 'detail-block' }, h('h3', null, 'Note'), h('p', { class: 'note-text' }, e.note)) : null,
      h('div', { class: 'detail-block' }, h('h3', null, 'History'), h('ul', { class: 'history' }, historyItems(e))));
    const foot = h('div', { class: 'sheet-foot' },
      e.deleted ? h('button', { class: 'btn btn-secondary', type: 'button', onclick: function () { closeSheet(function () { restore(e); }); } }, icon('restore'), 'Restore') :
        h('button', { class: 'btn btn-danger', type: 'button', onclick: function () { closeSheet(function () { remove(e); }); } }, icon('trash'), 'Remove'),
      h('span', { class: 'spacer' }),
      e.deleted ? null : h('button', { class: 'btn btn-primary', type: 'button', onclick: function () { isT ? openPaymentForm(null, e) : openExpenseForm(e); } }, icon('pencil'), 'Edit'));
    openSheet(title, body, foot);
  }
  function historyItems(e) {
    const items = [];
    e.versions.forEach(function (v, i) {
      let what;
      if (i === 0) what = 'Added by ' + nameOf(v.by, { you: true });
      else {
        const d = FS.diffVersions(e.versions[i - 1], v);
        const words = d.map(function (c) {
          if (c.field === 'deleted') return c.to ? 'Removed' : 'Restored';
          if (c.field === 'amount') return 'Amount ' + M(c.from) + ' → ' + M(c.to);
          if (c.field === 'title') return 'Name “' + (c.from || '') + '” → “' + (c.to || '') + '”';
          if (c.field === 'payer') return 'Paid by ' + nameOf(c.from) + ' → ' + nameOf(c.to);
          if (c.field === 'to') return 'Paid to ' + nameOf(c.from) + ' → ' + nameOf(c.to);
          if (c.field === 'date') return 'Date ' + dfDay.format(isoDate(c.from)) + ' → ' + dfDay.format(isoDate(c.to));
          if (c.field === 'split') return 'Split changed';
          if (c.field === 'cat') return 'Kind changed';
          if (c.field === 'note') return 'Note changed';
          return 'Changed';
        });
        what = (words.join(', ') || 'Saved again') + ' by ' + nameOf(v.by, { you: true });
      }
      items.unshift(h('li', null, h('div', null, h('div', null, what), h('div', { class: 'when' }, stamp(v.at)))));
    });
    return items;
  }
  function remove(e) {
    commit([FS.reviseEntry(e, { deleted: true }, cur.meta.me)]);
    toast('Removed. It stays in the history, struck through.', { label: 'Undo', fn: function () { restore(cur.state.entryById[e.id], true); } });
  }
  function restore(e, quiet) {
    commit([FS.reviseEntry(e, { deleted: false }, cur.meta.me)]);
    if (!quiet) toast('Restored. It counts in the balances again.');
  }
  function formatRate(r) { return Number(r.toPrecision(6)).toString(); }

  // ---------- add or edit an expense ----------
  function openExpenseForm(entry) {
    if (!cur) return;
    const st = cur.state;
    const bookCur = st.currency;
    const me = cur.meta.me && st.memberById[cur.meta.me] ? cur.meta.me : '';
    const people = st.members.filter(function (m) { return !m.gone || (entry && entry.split && m.id in entry.split.parts) || (entry && entry.payer === m.id); });
    const f = {
      cur: entry && entry.orig ? entry.orig.currency : bookCur,
      amount: entry ? (entry.orig ? FS.amountInput(entry.orig.amount, entry.orig.currency) : FS.amountInput(entry.amount, bookCur)) : '',
      rate: entry && entry.orig ? formatRate(entry.orig.rate) : '',
      title: entry ? entry.title : '',
      cat: entry ? entry.cat || 'other' : 'other',
      catTouched: !!entry,
      payer: entry ? entry.payer : (me || (people[0] && people[0].id)),
      date: entry ? entry.date : FS.todayISO(),
      mode: entry ? entry.split.mode : 'equal',
      inc: {}, exact: {}, shares: {},
      note: entry ? entry.note : '',
    };
    people.forEach(function (m) {
      const p = entry && entry.split.parts;
      f.inc[m.id] = entry ? (m.id in p) : !m.gone;
      f.shares[m.id] = entry && entry.split.mode === 'shares' && p[m.id] ? p[m.id] : 1;
      f.exact[m.id] = entry && entry.split.mode === 'exact' && m.id in p ? FS.amountInput(p[m.id], bookCur) : '';
    });
    if (entry && entry.split.mode !== 'equal') people.forEach(function (m) { f.inc[m.id] = m.id in entry.split.parts; });

    // fields
    const amountIn = h('input', { id: 'f-amount', inputmode: 'decimal', autocomplete: 'off', placeholder: FS.amountInput(0, bookCur), value: f.amount, 'aria-label': 'Amount', 'aria-describedby': 'f-amount-err' });
    const curSel = currencySelect(f.cur, 'f-cur', true);
    curSel.setAttribute('aria-label', 'Currency');
    const amountBox = h('div', { class: 'amount-field' }, curSel, amountIn);
    const amountErr = h('p', { class: 'err', id: 'f-amount-err', hidden: true });
    const rateIn = h('input', { class: 'input', id: 'f-rate', inputmode: 'decimal', value: f.rate, autocomplete: 'off', 'aria-label': 'Exchange rate' });
    const bookAmt = h('strong', { class: 'money' });
    const rateRow = h('div', { class: 'rate' }, h('span', { class: 'rate-left' }), rateIn, h('span', null, bookCur + ' · counts as '), bookAmt);
    const titleIn = h('input', { class: 'input', id: 'f-title', value: f.title, maxlength: '80', autocomplete: 'off', placeholder: 'Groceries, taxi, electricity…' });
    const catSel = h('select', { class: 'input', id: 'f-cat', 'aria-label': 'Kind of expense' }, FS.CATS.map(function (c) { return h('option', { value: c, selected: c === f.cat ? true : null }, CAT_INFO[c][0]); }));
    const payerChips = h('div', { class: 'chips', role: 'radiogroup', 'aria-labelledby': 'f-payer-l' }, people.filter(function (m) { return !m.gone || m.id === f.payer; }).map(function (m) {
      return h('button', { class: 'chip', type: 'button', role: 'radio', 'aria-checked': String(m.id === f.payer), 'data-mid': m.id, onclick: function () {
        f.payer = m.id;
        payerChips.querySelectorAll('.chip').forEach(function (c) { c.setAttribute('aria-checked', String(c.getAttribute('data-mid') === m.id)); });
      } }, avatar(m.id), m.id === me ? 'You' : m.name);
    }));
    const dateIn = h('input', { class: 'input', type: 'date', id: 'f-date', value: f.date, max: '2100-12-31' });
    const modeSeg = h('div', { class: 'seg', role: 'group', 'aria-label': 'How to split' });
    const splitList = h('div', { class: 'split-list' });
    const splitErr = h('p', { class: 'err', hidden: true });
    const noteIn = h('textarea', { class: 'input', id: 'f-note', maxlength: '280', rows: '2', placeholder: 'Optional' });
    noteIn.value = f.note;

    function lastRate(code) {
      for (const e of st.entries) if (e.orig && e.orig.currency === code) return formatRate(e.orig.rate);
      return '';
    }
    function bookAmount() {
      const a = FS.parseAmount(amountIn.value, f.cur);
      if (f.cur === bookCur) return a;
      const r = parseFloat(String(rateIn.value).replace(',', '.'));
      if (!(r > 0) || isNaN(a)) return NaN;
      return Math.round(a / Math.pow(10, FS.minorDigits(f.cur)) * r * Math.pow(10, FS.minorDigits(bookCur)));
    }
    function currentSplit() {
      const parts = {};
      people.forEach(function (m) {
        if (f.mode === 'equal' && f.inc[m.id]) parts[m.id] = 1;
        if (f.mode === 'shares' && f.inc[m.id] && f.shares[m.id] > 0) parts[m.id] = f.shares[m.id];
        if (f.mode === 'exact') {
          const v = FS.parseAmount(String(f.exact[m.id] || ''), bookCur);
          if (v > 0) parts[m.id] = v;
        }
      });
      return { mode: f.mode, parts: parts };
    }
    function update() {
      const foreign = f.cur !== bookCur;
      rateRow.hidden = !foreign;
      if (foreign) {
        rateRow.querySelector('.rate-left').textContent = '1 ' + f.cur + ' =';
        const ba = bookAmount();
        bookAmt.textContent = isNaN(ba) ? '—' : M(ba);
      }
      const amt = bookAmount();
      const split = currentSplit();
      const sh = amt > 0 && Object.keys(split.parts).length && f.mode !== 'exact' ? FS.shares({ id: entry ? entry.id : 'preview', amount: amt, split: split }) : {};
      splitList.querySelectorAll('[data-share]').forEach(function (el) {
        const mid = el.getAttribute('data-share');
        el.textContent = sh[mid] != null ? M(sh[mid]) : '—';
        el.classList.toggle('on', sh[mid] != null);
      });
      const foot = splitList.querySelector('.split-foot');
      if (foot) {
        if (f.mode === 'exact') {
          let s = 0;
          Object.keys(split.parts).forEach(function (k) { s += split.parts[k]; });
          const left = (amt > 0 ? amt : 0) - s;
          foot.firstChild.textContent = left === 0 && s > 0 ? 'Adds up to the total' : left > 0 ? M(left) + ' still to assign' : M(-left) + ' more than the total';
          foot.lastChild.textContent = M(s) + ' of ' + (amt > 0 ? M(amt) : '—');
          foot.classList.toggle('bad', left < 0);
        } else {
          const n = Object.keys(split.parts).length;
          foot.firstChild.textContent = n ? plural(n, 'person', 'people') + ' share this' : 'Pick at least one person';
          foot.lastChild.textContent = f.mode === 'shares' ? plural(Object.values(split.parts).reduce(function (a, b) { return a + b; }, 0), 'share') : '';
          foot.classList.toggle('bad', !n);
        }
      }
    }
    function buildSplit() {
      modeSeg.replaceChildren.apply(modeSeg, [['equal', 'Equally'], ['shares', 'By shares'], ['exact', 'Exact amounts']].map(function (o) {
        return h('button', { type: 'button', 'aria-pressed': String(f.mode === o[0]), onclick: function () {
          if (f.mode === o[0]) return;
          if (o[0] === 'exact') {
            // Start the exact amounts from what an equal split would give, so they already add up.
            const amt = bookAmount();
            const inc = people.filter(function (m) { return f.inc[m.id]; });
            if (amt > 0 && inc.length) {
              const sh = FS.shares({ id: entry ? entry.id : 'preview', amount: amt, split: { mode: f.mode === 'shares' ? 'shares' : 'equal', parts: Object.fromEntries(inc.map(function (m) { return [m.id, f.mode === 'shares' ? f.shares[m.id] : 1]; })) } });
              people.forEach(function (m) { f.exact[m.id] = sh[m.id] ? FS.amountInput(sh[m.id], bookCur) : ''; });
            }
          }
          if (f.mode === 'exact') people.forEach(function (m) { f.inc[m.id] = FS.parseAmount(String(f.exact[m.id] || ''), bookCur) > 0; });
          f.mode = o[0];
          buildSplit(); update();
        } }, o[1]);
      }));
      const rows = people.filter(function (m) { return !m.gone || f.inc[m.id]; }).map(function (m) {
        const label = h('label', { for: 'sp-' + m.id, style: 'font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap' }, m.id === me ? 'You' : m.name);
        if (f.mode === 'exact') {
          const inp = h('input', { class: 'input exact', id: 'sp-' + m.id, inputmode: 'decimal', value: f.exact[m.id] || '', placeholder: FS.amountInput(0, bookCur), 'aria-label': 'Amount for ' + m.name });
          inp.addEventListener('input', function () { f.exact[m.id] = inp.value; update(); });
          return h('div', { class: 'split-row' }, h('span'), avatar(m.id, 'sm'), label, h('span'), inp);
        }
        const cb = h('input', { type: 'checkbox', id: 'sp-' + m.id, checked: f.inc[m.id] });
        cb.addEventListener('change', function () { f.inc[m.id] = cb.checked; if (stepper) stepper.hidden = !cb.checked; update(); });
        let stepper = null;
        if (f.mode === 'shares') {
          const out = h('output', { 'aria-live': 'polite' }, String(f.shares[m.id]));
          const step = function (d) {
            const v = Math.max(0.5, Math.min(99, Math.round((f.shares[m.id] + d) * 2) / 2));
            f.shares[m.id] = v; out.textContent = String(v); update();
          };
          stepper = h('span', { class: 'stepper', hidden: !f.inc[m.id] },
            h('button', { type: 'button', 'aria-label': 'Fewer shares for ' + m.name, onclick: function () { step(-1); } }, h('span', { 'aria-hidden': 'true' }, '−')),
            out,
            h('button', { type: 'button', 'aria-label': 'More shares for ' + m.name, onclick: function () { step(1); } }, h('span', { 'aria-hidden': 'true' }, '+')));
        }
        return h('div', { class: 'split-row' }, cb, avatar(m.id, 'sm'), label, stepper || h('span'), h('span', { class: 'share money', 'data-share': m.id }, '—'));
      });
      splitList.replaceChildren.apply(splitList, rows.concat([h('div', { class: 'split-foot' }, h('span'), h('span', { class: 'money' }))]));
    }

    curSel.addEventListener('change', function () {
      f.cur = curSel.value;
      if (f.cur !== bookCur && !rateIn.value) rateIn.value = lastRate(f.cur);
      amountIn.placeholder = FS.amountInput(0, f.cur);
      update();
      if (f.cur !== bookCur && !rateIn.value) rateIn.focus();
    });
    amountIn.addEventListener('input', function () { amountBox.removeAttribute('aria-invalid'); amountErr.hidden = true; update(); });
    rateIn.addEventListener('input', update);
    titleIn.addEventListener('input', function () {
      if (!f.catTouched) { f.cat = FS.guessCat(titleIn.value); catSel.value = f.cat; fill(titleIcon, icon(CAT_INFO[f.cat][1])); }
    });
    catSel.addEventListener('change', function () { f.catTouched = true; f.cat = catSel.value; fill(titleIcon, icon(CAT_INFO[f.cat][1])); });
    const titleIcon = h('span', { style: 'position:absolute;left:12px;top:12px;color:var(--muted)', 'aria-hidden': 'true' }, icon(CAT_INFO[f.cat][1]));
    titleIn.style.paddingLeft = '38px';

    buildSplit();

    const body = h('form', { novalidate: true, onsubmit: function (e) { e.preventDefault(); save(); } },
      h('div', { class: 'field' }, h('label', { for: 'f-amount' }, 'Amount'), amountBox, amountErr, rateRow),
      h('div', { class: 'field' }, h('label', { for: 'f-title' }, 'What for'), h('div', { style: 'position:relative' }, titleIcon, titleIn)),
      h('div', { class: 'row-fields' },
        h('div', { class: 'field' }, h('label', { for: 'f-date' }, 'Date'), dateIn),
        h('div', { class: 'field' }, h('label', { for: 'f-cat' }, 'Kind'), catSel)),
      h('div', { class: 'field' }, h('span', { class: 'label', id: 'f-payer-l' }, 'Paid by'), payerChips),
      h('div', { class: 'field' }, h('div', { style: 'display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap' }, h('span', { class: 'label' }, 'Split'), modeSeg), splitList, splitErr),
      h('div', { class: 'field' }, h('label', { for: 'f-note' }, 'Note'), noteIn),
      h('button', { type: 'submit', hidden: true, tabindex: '-1' }));
    const foot = h('div', { class: 'sheet-foot' },
      entry ? h('span', { class: 'hint' }, 'The old version stays in the history.') : null,
      h('span', { class: 'spacer' }),
      h('button', { class: 'btn btn-ghost', type: 'button', onclick: function () { closeSheet(); } }, 'Cancel'),
      h('button', { class: 'btn btn-primary', type: 'button', onclick: save }, entry ? 'Save changes' : 'Add expense'));
    openSheet(entry ? 'Edit expense' : 'New expense', body, foot, amountIn);
    update();

    function fail(el, errEl, msg) {
      errEl.textContent = msg; errEl.hidden = false;
      if (el) { el.setAttribute('aria-invalid', 'true'); if (el.focus) el.focus(); }
      return false;
    }
    function save() {
      amountErr.hidden = true; splitErr.hidden = true;
      const amt = bookAmount();
      if (f.cur !== bookCur && !(parseFloat(String(rateIn.value).replace(',', '.')) > 0)) return fail(rateIn, amountErr, 'Enter the rate your bank used, so the amount can be counted in ' + bookCur + '.');
      if (!(amt > 0)) return fail(amountBox, amountErr, 'Enter how much was paid.');
      if (amt > 1e10) return fail(amountBox, amountErr, 'That amount is too large.');
      const split = currentSplit();
      const n = Object.keys(split.parts).length;
      if (!n) return fail(null, splitErr, 'Pick at least one person to share this.');
      if (f.mode === 'exact') {
        let s = 0;
        Object.keys(split.parts).forEach(function (k) { s += split.parts[k]; });
        if (s !== amt) return fail(null, splitErr, 'The amounts add up to ' + M(s) + ', not ' + M(amt) + '.');
      }
      if (!f.payer) return fail(null, splitErr, 'Pick who paid.');
      const date = /^\d{4}-\d{2}-\d{2}$/.test(dateIn.value) ? dateIn.value : FS.todayISO();
      const fields = {
        kind: 'expense', title: titleIn.value.trim() || CAT_INFO[f.cat][0], amount: amt, payer: f.payer, split: split, date: date,
        cat: f.cat, note: noteIn.value.trim(),
        orig: f.cur !== bookCur ? { amount: FS.parseAmount(amountIn.value, f.cur), currency: f.cur, rate: parseFloat(String(rateIn.value).replace(',', '.')) } : null,
      };
      if (entry) {
        const next = FS.reviseEntry(entry, fields, cur.meta.me);
        const changes = FS.diffVersions(entry.versions[entry.versions.length - 1], next);
        const origChanged = JSON.stringify(entry.orig || null) !== JSON.stringify(next.orig || null);
        closeSheet(function () {
          if (!changes.length && !origChanged) { toast('No changes to save.'); return; }
          commit([next]);
          toast('Saved. The old version stays in the history.', sendAction());
        });
      } else {
        const ev = FS.entryEvent(fields, cur.meta.me);
        closeSheet(function () {
          commit([ev]);
          toast('Added ' + fields.title + ', ' + M(amt) + '.', sendAction());
        });
      }
      return true;
    }
  }
  function sendAction() { return cur && !cur.meta.sample ? { label: 'Send update', fn: openSendUpdate } : null; }

  // ---------- record a payment ----------
  function openPaymentForm(prefill, entry) {
    const st = cur.state;
    const me = cur.meta.me;
    const people = st.members.filter(function (m) { return !m.gone; });
    const f = {
      from: entry ? entry.payer : prefill ? prefill.from : (me || ''),
      to: entry ? entry.to : prefill ? prefill.to : '',
      date: entry ? entry.date : FS.todayISO(),
    };
    const amountIn = h('input', { id: 'p-amount', inputmode: 'decimal', autocomplete: 'off', placeholder: FS.amountInput(0, st.currency), value: entry ? FS.amountInput(entry.amount, st.currency) : prefill ? FS.amountInput(prefill.amount, st.currency) : '', 'aria-label': 'Amount' });
    const amountBox = h('div', { class: 'amount-field' }, h('span', { style: 'display:flex;align-items:center;padding:0 12px;font-weight:500;border-right:1px solid var(--rule)' }, st.currency), amountIn);
    const err = h('p', { class: 'err', hidden: true, role: 'alert' });
    function chips(key, labelId) {
      const box = h('div', { class: 'chips', role: 'radiogroup', 'aria-labelledby': labelId });
      people.forEach(function (m) {
        box.appendChild(h('button', { class: 'chip', type: 'button', role: 'radio', 'aria-checked': String(f[key] === m.id), 'data-mid': m.id, onclick: function () {
          f[key] = m.id;
          box.querySelectorAll('.chip').forEach(function (c) { c.setAttribute('aria-checked', String(c.getAttribute('data-mid') === m.id)); });
          hint();
        } }, avatar(m.id), m.id === me ? 'You' : m.name));
      });
      return box;
    }
    const owed = h('p', { class: 'hint', style: 'margin-top:8px' });
    function hint() {
      const match = cur.plan.find(function (p) { return p.from === f.from && p.to === f.to; });
      owed.textContent = match ? 'The settle-up list has ' + nameOf(f.from) + ' paying ' + nameOf(f.to) + ' ' + M(match.amount) + '.' : '';
    }
    const dateIn = h('input', { class: 'input', type: 'date', id: 'p-date', value: f.date });
    const body = h('form', { novalidate: true, onsubmit: function (e) { e.preventDefault(); save(); } },
      h('div', { class: 'field' }, h('span', { class: 'label', id: 'p-from' }, 'Who paid'), chips('from', 'p-from')),
      h('div', { class: 'field' }, h('span', { class: 'label', id: 'p-to' }, 'Who got the money'), chips('to', 'p-to')),
      h('div', { class: 'field' }, h('label', { for: 'p-amount' }, 'Amount'), amountBox, owed),
      h('div', { class: 'field' }, h('label', { for: 'p-date' }, 'Date'), dateIn),
      err, h('button', { type: 'submit', hidden: true, tabindex: '-1' }));
    hint();
    const foot = h('div', { class: 'sheet-foot' }, h('span', { class: 'spacer' }),
      h('button', { class: 'btn btn-ghost', type: 'button', onclick: function () { closeSheet(); } }, 'Cancel'),
      h('button', { class: 'btn btn-primary', type: 'button', onclick: save }, entry ? 'Save changes' : 'Record payment'));
    openSheet(entry ? 'Edit payment' : 'Record a payment', body, foot, prefill ? null : amountIn);
    function save() {
      const amt = FS.parseAmount(amountIn.value, st.currency);
      err.hidden = true;
      if (!f.from || !f.to) { err.textContent = 'Pick who paid and who got the money.'; err.hidden = false; return; }
      if (f.from === f.to) { err.textContent = 'Someone can’t pay themselves. Pick two different people.'; err.hidden = false; return; }
      if (!(amt > 0) || amt > 1e10) { err.textContent = 'Enter how much was paid.'; err.hidden = false; amountBox.setAttribute('aria-invalid', 'true'); amountIn.focus(); return; }
      const fields = { kind: 'transfer', title: '', amount: amt, payer: f.from, to: f.to, date: /^\d{4}-\d{2}-\d{2}$/.test(dateIn.value) ? dateIn.value : FS.todayISO() };
      const ev = entry ? FS.reviseEntry(entry, fields, cur.meta.me) : FS.entryEvent(fields, cur.meta.me);
      closeSheet(function () {
        commit([ev]);
        toast((entry ? 'Payment saved: ' : 'Recorded: ') + nameOf(f.from) + ' paid ' + nameOf(f.to) + ' ' + M(amt) + '.', sendAction());
      });
    }
  }

  // ---------- toasts ----------
  function toast(msg, action, ms) {
    const t = h('div', { class: 'toast', role: 'status' }, h('p', null, msg),
      action ? h('button', { type: 'button', onclick: function () { dismiss(); action.fn(); } }, action.label) : null);
    let timer;
    function dismiss() {
      clearTimeout(timer);
      t.classList.add('out');
      setTimeout(function () { t.remove(); }, 200);
    }
    $toasts.appendChild(t);
    while ($toasts.children.length > 2) $toasts.firstChild.remove();
    timer = setTimeout(dismiss, ms || (action ? 6500 : 4200));
  }

  // ---------- start ----------
  window.addEventListener('hashchange', render);
  window.addEventListener('scroll', function () { $bar.classList.toggle('scrolled', window.scrollY > 4); }, { passive: true });
  window.addEventListener('storage', function (e) {
    // Another tab changed a book: reload it.
    if (e.key && e.key.indexOf('fs:') === 0 && !$dlg.open) { cur = null; render(); }
  });
  try { matchMedia('(prefers-color-scheme: dark)').addEventListener('change', applyTheme); } catch (e) { /* old browsers */ }
  applyTheme();
  render();

  if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol) && location.hostname !== 'localhost' && location.hostname !== '127.0.0.1') {
    window.addEventListener('load', function () { navigator.serviceWorker.register('sw.js').catch(function () { /* offline use is optional */ }); });
  }
})();
