/* Fair Split core.
   A book is an append-only log of events. Nothing is ever edited in place: a correction is a newer
   version of an entry, a removal is a version marked removed. Every copy of a book can be merged with
   any other by taking the union of their events, so the group chat can carry updates with no server.
   Everything on screen (balances, the working behind each balance, the payments that settle up) is
   computed from the log. Money is held in integer minor units (cents) of the book's currency.
   No DOM in this file: it runs in the browser and under Node for the tests. */
(function (root) {
  'use strict';

  // ---------- ids and time ----------
  const ALPH = 'abcdefghijkmnpqrstuvwxyz23456789'; // 32 symbols, no 0/o/1/l
  function uid(n) {
    n = n || 8;
    const bytes = root.crypto.getRandomValues(new Uint8Array(n));
    let s = '';
    for (let i = 0; i < n; i++) s += ALPH[bytes[i] & 31];
    return s;
  }
  function todayISO(d) {
    d = d || new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  function byTime(a, b) {
    return a.at - b.at || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
  }

  // ---------- events ----------
  function newBook(opts) {
    // opts: { name, currency, people: [names], meIndex }
    const id = uid(10);
    const at = opts.at || Date.now();
    const members = opts.people.map(function (name) { return { mid: uid(5), name: name }; });
    const me = members[opts.meIndex || 0];
    const by = me ? me.mid : '';
    const events = [{ id: uid(), t: 'book', at: at, by: by, name: opts.name, currency: opts.currency }];
    members.forEach(function (m, i) {
      events.push({ id: uid(), t: 'member', at: at + 1 + i, by: by, mid: m.mid, name: m.name });
    });
    return { book: { id: id, events: events }, me: by, members: members };
  }

  function entryEvent(fields, by, at) {
    // fields: { eid?, kind, title, amount, payer, to?, split?, date, cat?, note?, deleted?, orig? }
    const id = uid();
    const ev = {
      id: id, t: 'entry', at: at || Date.now(), by: by || '',
      eid: fields.eid || id,
      kind: fields.kind === 'transfer' ? 'transfer' : 'expense',
      title: (fields.title || '').trim(),
      amount: fields.amount,
      payer: fields.payer,
      date: fields.date,
    };
    if (ev.kind === 'transfer') ev.to = fields.to;
    else ev.split = { mode: fields.split.mode, parts: Object.assign({}, fields.split.parts) };
    if (fields.cat) ev.cat = fields.cat;
    if (fields.note && fields.note.trim()) ev.note = fields.note.trim();
    if (fields.deleted) ev.deleted = true;
    if (fields.orig) ev.orig = { amount: fields.orig.amount, currency: fields.orig.currency, rate: fields.orig.rate };
    return ev;
  }

  // A new version of an existing entry, with some fields changed.
  function reviseEntry(entry, changes, by, at) {
    const base = {
      eid: entry.id, kind: entry.kind, title: entry.title, amount: entry.amount, payer: entry.payer,
      to: entry.to, split: entry.split, date: entry.date, cat: entry.cat, note: entry.note,
      deleted: entry.deleted, orig: entry.orig,
    };
    return entryEvent(Object.assign(base, changes), by, at);
  }

  // ---------- fold: the log into the current state ----------
  function fold(book) {
    const events = book.events.slice().sort(byTime);
    const s = {
      id: book.id, name: 'Untitled book', currency: 'EUR',
      createdAt: events.length ? events[0].at : 0, updatedAt: 0,
      members: [], memberById: {}, entries: [], entryById: {}, eventCount: events.length,
    };
    for (const ev of events) {
      if (ev.at > s.updatedAt) s.updatedAt = ev.at;
      if (ev.t === 'book') {
        if (ev.name) s.name = ev.name;
        if (ev.currency) s.currency = ev.currency;
      } else if (ev.t === 'member') {
        let m = s.memberById[ev.mid];
        if (!m) {
          m = { id: ev.mid, name: ev.name, gone: false, addedAt: ev.at, addedBy: ev.by, index: s.members.length };
          s.memberById[ev.mid] = m;
          s.members.push(m);
        } else if (ev.name) {
          m.name = ev.name;
        }
        if ('gone' in ev) m.gone = !!ev.gone;
      } else if (ev.t === 'entry') {
        let e = s.entryById[ev.eid];
        if (!e) {
          e = { id: ev.eid, versions: [], createdAt: ev.at, createdBy: ev.by };
          s.entryById[ev.eid] = e;
          s.entries.push(e);
        }
        e.versions.push(ev);
        e.kind = ev.kind; e.title = ev.title; e.amount = ev.amount; e.payer = ev.payer;
        e.to = ev.to; e.split = ev.split; e.date = ev.date; e.cat = ev.cat || '';
        e.note = ev.note || ''; e.deleted = !!ev.deleted; e.orig = ev.orig || null;
        e.changedAt = ev.at; e.changedBy = ev.by;
      }
    }
    // People named in entries but never added (a damaged copy): keep the money visible.
    s.entries.forEach(function (e) {
      const ids = [e.payer, e.to].concat(e.split ? Object.keys(e.split.parts) : []);
      ids.forEach(function (mid) {
        if (mid && !s.memberById[mid]) {
          const m = { id: mid, name: 'Unknown person', gone: false, addedAt: e.createdAt, addedBy: '', index: s.members.length };
          s.memberById[mid] = m;
          s.members.push(m);
        }
      });
    });
    // Newest first by the date it happened, then by when it was written down.
    s.entries.sort(function (a, b) {
      return a.date < b.date ? 1 : a.date > b.date ? -1 : b.createdAt - a.createdAt;
    });
    return s;
  }

  function isUsed(state, mid) {
    return state.entries.some(function (e) {
      return e.payer === mid || e.to === mid || (e.split && mid in e.split.parts);
    });
  }

  // ---------- splitting an amount fairly ----------
  // A stable pseudo-random order per entry, so the odd cent does not always land on the same person.
  function rank(seed, mid) {
    let h = 2166136261;
    const str = seed + '|' + mid;
    for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }

  // Largest-remainder apportionment in integers. weights: [[mid, integer weight > 0]].
  function apportion(amount, weights, seed) {
    const out = {};
    let W = 0;
    weights.forEach(function (w) { W += w[1]; });
    if (W <= 0 || !weights.length) return out;
    let given = 0;
    const rest = [];
    weights.forEach(function (w) {
      const num = amount * w[1];
      const q = Math.floor(num / W);
      out[w[0]] = q;
      given += q;
      rest.push({ mid: w[0], r: num - q * W, k: rank(seed, w[0]) });
    });
    rest.sort(function (a, b) { return b.r - a.r || a.k - b.k; });
    for (let i = 0; i < amount - given; i++) out[rest[i % rest.length].mid] += 1;
    return out;
  }

  // What each person's share of an expense is, in minor units. The shares always add up to the amount.
  function shares(entry) {
    const parts = entry.split.parts;
    const mids = Object.keys(parts);
    const mode = entry.split.mode;
    if (mode === 'exact') {
      let sum = 0;
      mids.forEach(function (m) { sum += parts[m]; });
      if (sum === entry.amount) return Object.assign({}, parts);
      return apportion(entry.amount, mids.map(function (m) { return [m, Math.max(0, Math.round(parts[m]))]; }), entry.id);
    }
    if (mode === 'shares') {
      // Weights may have two decimals (1.5 shares); scale to integers.
      return apportion(entry.amount, mids.map(function (m) { return [m, Math.round(parts[m] * 100)]; }), entry.id);
    }
    return apportion(entry.amount, mids.map(function (m) { return [m, 1]; }), entry.id);
  }

  // ---------- balances and the working behind them ----------
  function active(state) {
    return state.entries.filter(function (e) { return !e.deleted; });
  }

  function balances(state) {
    const out = {};
    state.members.forEach(function (m) { out[m.id] = { paid: 0, share: 0, sent: 0, received: 0, net: 0 }; });
    active(state).forEach(function (e) {
      if (e.kind === 'transfer') {
        out[e.payer].sent += e.amount;
        out[e.to].received += e.amount;
      } else {
        out[e.payer].paid += e.amount;
        const sh = shares(e);
        Object.keys(sh).forEach(function (mid) { out[mid].share += sh[mid]; });
      }
    });
    Object.keys(out).forEach(function (mid) {
      const b = out[mid];
      b.net = b.paid - b.share + b.sent - b.received;
    });
    return out;
  }

  // Every line that moves one person's balance, oldest first, with a running total.
  function working(state, mid) {
    const lines = [];
    active(state).slice().reverse().forEach(function (e) {
      if (e.kind === 'transfer') {
        if (e.payer === mid) lines.push({ entry: e, kind: 'sent', paid: e.amount, share: 0, delta: e.amount });
        else if (e.to === mid) lines.push({ entry: e, kind: 'received', paid: 0, share: e.amount, delta: -e.amount });
        return;
      }
      const sh = shares(e);
      const paid = e.payer === mid ? e.amount : 0;
      const share = sh[mid] || 0;
      if (paid || share) lines.push({ entry: e, kind: 'expense', paid: paid, share: share, delta: paid - share, people: Object.keys(sh).length });
    });
    let run = 0;
    lines.forEach(function (l) { run += l.delta; l.running = run; });
    return lines;
  }

  // ---------- settling up with the fewest payments ----------
  // The fewest payments is n minus the largest number of groups whose balances sum to zero.
  // Exact for up to 16 people with a non-zero balance (a subset search), greedy beyond that.
  function greedy(items) {
    const cred = items.filter(function (x) { return x[1] > 0; }).map(function (x) { return [x[0], x[1]]; });
    const debt = items.filter(function (x) { return x[1] < 0; }).map(function (x) { return [x[0], -x[1]]; });
    const out = [];
    while (cred.length && debt.length) {
      cred.sort(function (a, b) { return b[1] - a[1] || (a[0] < b[0] ? -1 : 1); });
      debt.sort(function (a, b) { return b[1] - a[1] || (a[0] < b[0] ? -1 : 1); });
      const c = cred[0], d = debt[0];
      const amt = Math.min(c[1], d[1]);
      out.push({ from: d[0], to: c[0], amount: amt });
      c[1] -= amt; d[1] -= amt;
      if (!c[1]) cred.shift();
      if (!d[1]) debt.shift();
    }
    return out;
  }

  function settle(bal) {
    const items = Object.keys(bal).map(function (mid) {
      return [mid, typeof bal[mid] === 'number' ? bal[mid] : bal[mid].net];
    }).filter(function (x) { return x[1] !== 0; });
    items.sort(function (a, b) { return a[0] < b[0] ? -1 : 1; });
    const n = items.length;
    if (!n) return [];
    let out;
    if (n > 16) {
      out = greedy(items);
    } else {
      const N = 1 << n;
      const sum = new Array(N).fill(0);
      const dp = new Int8Array(N);
      for (let mask = 1; mask < N; mask++) {
        const low = mask & -mask;
        sum[mask] = sum[mask ^ low] + items[31 - Math.clz32(low)][1];
        let best = 0;
        for (let i = 0; i < n; i++) if (mask & (1 << i)) { const v = dp[mask ^ (1 << i)]; if (v > best) best = v; }
        dp[mask] = best + (sum[mask] === 0 ? 1 : 0);
      }
      // Walk back down a best path; the zero-sum masks on it mark where each group ends.
      const groups = [];
      let mask = N - 1, current = [];
      while (mask) {
        const z = sum[mask] === 0 ? 1 : 0;
        if (z && current.length) { groups.push(current); current = []; }
        for (let i = 0; i < n; i++) {
          if ((mask & (1 << i)) && dp[mask ^ (1 << i)] + z === dp[mask]) {
            current.push(items[i]);
            mask ^= 1 << i;
            break;
          }
        }
      }
      if (current.length) groups.push(current);
      out = [];
      groups.forEach(function (g) { out = out.concat(greedy(g)); });
    }
    out.sort(function (a, b) { return b.amount - a.amount; });
    return out;
  }

  // ---------- merging copies ----------
  function merge(local, incoming) {
    const have = {};
    local.events.forEach(function (ev) { have[ev.id] = true; });
    const added = incoming.events.filter(function (ev) { return !have[ev.id]; });
    return { book: { id: local.id, events: local.events.concat(added) }, added: added };
  }

  // What an update changed, in words a person cares about.
  function summarize(before, after, added) {
    const out = { newEntries: 0, changed: 0, removed: 0, restored: 0, newPeople: 0, renamed: 0, renamedBook: false, eids: [] };
    const seen = {};
    added.slice().sort(byTime).forEach(function (ev) {
      if (ev.t === 'entry' && !seen[ev.eid]) {
        seen[ev.eid] = true;
        const was = before.entryById[ev.eid];
        const now = after.entryById[ev.eid];
        out.eids.push(ev.eid);
        if (!was) { if (!now.deleted) out.newEntries++; }
        else if (!was.deleted && now.deleted) out.removed++;
        else if (was.deleted && !now.deleted) out.restored++;
        else if (now.changedAt !== was.changedAt) out.changed++;
      } else if (ev.t === 'member' && !seen['m' + ev.mid]) {
        seen['m' + ev.mid] = true;
        if (!before.memberById[ev.mid]) out.newPeople++;
        else if (before.memberById[ev.mid].name !== after.memberById[ev.mid].name) out.renamed++;
      } else if (ev.t === 'book' && before.name !== after.name) {
        out.renamedBook = true;
      }
    });
    out.total = out.newEntries + out.changed + out.removed + out.restored + out.newPeople + out.renamed + (out.renamedBook ? 1 : 0);
    return out;
  }

  // What changed between two versions of one entry.
  function diffVersions(a, b) {
    const out = [];
    ['title', 'amount', 'payer', 'to', 'date', 'cat', 'note'].forEach(function (k) {
      if ((a[k] || '') !== (b[k] || '')) out.push({ field: k, from: a[k], to: b[k] });
    });
    if (a.split && b.split && JSON.stringify(sortedParts(a.split)) !== JSON.stringify(sortedParts(b.split))) {
      out.push({ field: 'split', from: a.split, to: b.split });
    }
    if (!!a.deleted !== !!b.deleted) out.push({ field: 'deleted', from: !!a.deleted, to: !!b.deleted });
    return out;
  }
  function sortedParts(split) {
    return [split.mode].concat(Object.keys(split.parts).sort().map(function (k) { return k + ':' + split.parts[k]; }));
  }

  // ---------- validation of anything that arrives from outside ----------
  const CATS = ['groceries', 'eating', 'drinks', 'home', 'utilities', 'internet', 'transport', 'travel', 'stay', 'fun', 'shopping', 'other'];
  const RX_ID = /^[a-z0-9]{4,16}$/i;
  const RX_MID = /^[a-z0-9]{2,12}$/i;
  const RX_CUR = /^[A-Z]{3}$/;
  const MAX_AMOUNT = 1e10; // a hundred million in major units

  function str(v, max) { return typeof v === 'string' ? v.trim().slice(0, max) : ''; }
  function isInt(v, lo, hi) { return typeof v === 'number' && Number.isInteger(v) && v >= lo && v <= hi; }
  function validDate(d) {
    if (typeof d !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(d)) return false;
    const t = new Date(d + 'T12:00:00Z');
    return !isNaN(t) && t.toISOString().slice(0, 10) === d;
  }

  function cleanEvent(ev) {
    if (!ev || typeof ev !== 'object' || !RX_ID.test(ev.id || '')) return null;
    if (!isInt(ev.at, 1262304000000, 4102444800000)) return null; // 2010 to 2100
    const by = typeof ev.by === 'string' && (ev.by === '' || RX_MID.test(ev.by)) ? ev.by : '';
    const base = { id: ev.id, t: ev.t, at: ev.at, by: by };
    if (ev.t === 'book') {
      const name = str(ev.name, 60);
      if (!name || !RX_CUR.test(ev.currency || '')) return null;
      return Object.assign(base, { name: name, currency: ev.currency });
    }
    if (ev.t === 'member') {
      const name = str(ev.name, 40);
      if (!RX_MID.test(ev.mid || '') || !name) return null;
      const out = Object.assign(base, { mid: ev.mid, name: name });
      if ('gone' in ev) out.gone = !!ev.gone;
      return out;
    }
    if (ev.t === 'entry') {
      if (!RX_ID.test(ev.eid || '')) return null;
      if (ev.kind !== 'expense' && ev.kind !== 'transfer') return null;
      if (!isInt(ev.amount, 1, MAX_AMOUNT) || !RX_MID.test(ev.payer || '') || !validDate(ev.date)) return null;
      const out = Object.assign(base, { eid: ev.eid, kind: ev.kind, title: str(ev.title, 80), amount: ev.amount, payer: ev.payer, date: ev.date });
      if (ev.kind === 'transfer') {
        if (!RX_MID.test(ev.to || '') || ev.to === ev.payer) return null;
        out.to = ev.to;
      } else {
        const sp = ev.split;
        if (!sp || ['equal', 'exact', 'shares'].indexOf(sp.mode) < 0 || !sp.parts || typeof sp.parts !== 'object') return null;
        const parts = {};
        let n = 0;
        for (const mid of Object.keys(sp.parts)) {
          if (!RX_MID.test(mid)) return null;
          const v = sp.parts[mid];
          if (sp.mode === 'equal' && v !== 1) return null;
          if (sp.mode === 'exact' && !isInt(v, 0, MAX_AMOUNT)) return null;
          if (sp.mode === 'shares' && !(typeof v === 'number' && v > 0 && v <= 1000 && Math.round(v * 100) === v * 100)) return null;
          parts[mid] = v;
          n++;
        }
        if (!n || n > 64) return null;
        out.split = { mode: sp.mode, parts: parts };
      }
      if (ev.cat && CATS.indexOf(ev.cat) >= 0) out.cat = ev.cat;
      const note = str(ev.note, 280);
      if (note) out.note = note;
      if (ev.deleted) out.deleted = true;
      if (ev.orig && isInt(ev.orig.amount, 1, 1e13) && RX_CUR.test(ev.orig.currency || '') &&
          typeof ev.orig.rate === 'number' && ev.orig.rate > 0 && isFinite(ev.orig.rate)) {
        out.orig = { amount: ev.orig.amount, currency: ev.orig.currency, rate: ev.orig.rate };
      }
      return out;
    }
    return null;
  }

  function cleanBook(raw) {
    if (!raw || typeof raw !== 'object' || !RX_ID.test(raw.id || '') || !Array.isArray(raw.events)) return null;
    const events = [];
    const seen = {};
    raw.events.slice(0, 20000).forEach(function (ev) {
      const c = cleanEvent(ev);
      if (c && !seen[c.id]) { seen[c.id] = true; events.push(c); }
    });
    if (!events.some(function (e) { return e.t === 'book'; })) return null;
    return { id: raw.id, events: events };
  }

  // ---------- the link: the whole book, packed, compressed, in the part of the URL after # ----------
  // The fragment is never sent to a server. Events are packed into arrays to keep links short.
  function pack(ev) {
    const at = ev.at.toString(36);
    if (ev.t === 'book') return ['B', ev.id, at, ev.by, ev.name, ev.currency];
    if (ev.t === 'member') return ['M', ev.id, at, ev.by, ev.mid, ev.name, 'gone' in ev ? (ev.gone ? 1 : 0) : -1];
    const parts = ev.split ? Object.keys(ev.split.parts).map(function (m) {
      return ev.split.mode === 'equal' ? m : m + ':' + ev.split.parts[m];
    }).join(',') : '';
    return ['E', ev.id, at, ev.by, ev.eid === ev.id ? '' : ev.eid, ev.kind === 'transfer' ? 't' : 'x', ev.title, ev.amount,
      ev.payer, ev.to || '', ev.split ? ev.split.mode[0] : '', parts, ev.date.replace(/-/g, ''), ev.cat || '', ev.note || '',
      ev.deleted ? 1 : 0, ev.orig ? [ev.orig.amount, ev.orig.currency, ev.orig.rate] : 0];
  }
  function unpack(a) {
    if (!Array.isArray(a)) return null;
    const base = { id: a[1], at: parseInt(a[2], 36), by: a[3] };
    if (a[0] === 'B') return Object.assign(base, { t: 'book', name: a[4], currency: a[5] });
    if (a[0] === 'M') {
      const m = Object.assign(base, { t: 'member', mid: a[4], name: a[5] });
      if (a[6] === 0 || a[6] === 1) m.gone = a[6] === 1;
      return m;
    }
    if (a[0] === 'E') {
      const ev = Object.assign(base, { t: 'entry', eid: a[4] || a[1], kind: a[5] === 't' ? 'transfer' : 'expense', title: a[6], amount: a[7], payer: a[8] });
      const d = String(a[12] || '');
      ev.date = d.slice(0, 4) + '-' + d.slice(4, 6) + '-' + d.slice(6, 8);
      if (ev.kind === 'transfer') ev.to = a[9];
      else {
        const mode = { e: 'equal', x: 'exact', s: 'shares' }[a[10]];
        const parts = {};
        String(a[11] || '').split(',').filter(Boolean).forEach(function (p) {
          const kv = p.split(':');
          parts[kv[0]] = mode === 'equal' ? 1 : Number(kv[1]);
        });
        ev.split = { mode: mode, parts: parts };
      }
      if (a[13]) ev.cat = a[13];
      if (a[14]) ev.note = a[14];
      if (a[15]) ev.deleted = true;
      if (Array.isArray(a[16])) ev.orig = { amount: a[16][0], currency: a[16][1], rate: a[16][2] };
      return ev;
    }
    return null;
  }

  function toB64url(bytes) {
    let bin = '';
    for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    return root.btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
  function fromB64url(s) {
    s = s.replace(/-/g, '+').replace(/_/g, '/');
    while (s.length % 4) s += '=';
    const bin = root.atob(s);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }
  async function pipe(bytes, stream) {
    const buf = await new Response(new Blob([bytes]).stream().pipeThrough(stream)).arrayBuffer();
    return new Uint8Array(buf);
  }

  async function encode(book, from) {
    const payload = JSON.stringify({ v: 1, id: book.id, from: from || '', sent: Date.now(), ev: book.events.map(pack) });
    const bytes = new TextEncoder().encode(payload);
    if (typeof root.CompressionStream === 'function') {
      return '1' + toB64url(await pipe(bytes, new root.CompressionStream('deflate-raw')));
    }
    return '0' + toB64url(bytes);
  }

  async function decode(code) {
    if (typeof code !== 'string' || code.length < 8 || code.length > 4000000) throw new Error('This link is not a Fair Split book.');
    let bytes;
    try { bytes = fromB64url(code.slice(1)); } catch (e) { throw new Error('This link is not a Fair Split book.'); }
    if (code[0] === '1') {
      if (typeof root.DecompressionStream !== 'function') throw new Error('This browser is too old to open the link. Try a current Chrome, Safari, Firefox or Edge.');
      try { bytes = await pipe(bytes, new root.DecompressionStream('deflate-raw')); } catch (e) { throw new Error('The link was cut short. Ask for it again, or copy the whole message.'); }
    } else if (code[0] !== '0') {
      throw new Error('This link is not a Fair Split book.');
    }
    let data;
    try { data = JSON.parse(new TextDecoder().decode(bytes)); } catch (e) { throw new Error('The link was cut short. Ask for it again, or copy the whole message.'); }
    if (!data || data.v !== 1 || !Array.isArray(data.ev)) throw new Error('This link is not a Fair Split book.');
    const book = cleanBook({ id: data.id, events: data.ev.map(unpack) });
    if (!book) throw new Error('This link holds no book that can be read.');
    return { book: book, from: typeof data.from === 'string' && RX_MID.test(data.from) ? data.from : '', sent: isInt(data.sent, 0, 4102444800000) ? data.sent : 0 };
  }

  // Pull the code out of anything pasted: a full link, a whole chat message, or the bare code.
  function findCode(text) {
    if (typeof text !== 'string') return '';
    const m = text.match(/#j=([0-9][A-Za-z0-9_-]+)/);
    if (m) return m[1];
    const t = text.trim();
    return /^[01][A-Za-z0-9_-]{16,}$/.test(t) ? t : '';
  }

  // ---------- money ----------
  const digitsCache = {};
  function minorDigits(cur) {
    if (!(cur in digitsCache)) {
      try { digitsCache[cur] = new Intl.NumberFormat('en', { style: 'currency', currency: cur }).resolvedOptions().maximumFractionDigits; }
      catch (e) { digitsCache[cur] = 2; }
    }
    return digitsCache[cur];
  }
  const fmtCache = {};
  function money(minor, cur, opts) {
    opts = opts || {};
    const key = cur + (opts.sign ? 's' : '') + (opts.locale || '');
    if (!fmtCache[key]) {
      const d = minorDigits(cur);
      try {
        fmtCache[key] = new Intl.NumberFormat(opts.locale || undefined, {
          style: 'currency', currency: cur, currencyDisplay: 'narrowSymbol',
          minimumFractionDigits: d, maximumFractionDigits: d, signDisplay: opts.sign ? 'exceptZero' : 'auto',
        });
      } catch (e) {
        fmtCache[key] = { format: function (v) { return (opts.sign && v > 0 ? '+' : '') + v.toFixed(d) + ' ' + cur; } };
      }
    }
    return fmtCache[key].format(minor / Math.pow(10, minorDigits(cur))).replace('-', '−');
  }

  // Accepts 42, 42.1, 42,10, 1,234.56, 1.234,56 and sums like 12.50+3.20. Returns minor units or NaN.
  function parseAmount(text, cur) {
    if (typeof text !== 'string') return NaN;
    const d = minorDigits(cur);
    const parts = text.replace(/[\s  ']/g, '').replace(/[^\d.,+]/g, '').split('+').filter(Boolean);
    if (!parts.length) return NaN;
    let total = 0;
    for (const p of parts) {
      let s = p;
      const lastDot = s.lastIndexOf('.'), lastComma = s.lastIndexOf(',');
      let dec = -1;
      if (lastDot >= 0 && lastComma >= 0) dec = Math.max(lastDot, lastComma);
      else if (lastDot >= 0 || lastComma >= 0) {
        const sep = lastDot >= 0 ? '.' : ',';
        const pos = Math.max(lastDot, lastComma);
        const after = s.length - pos - 1;
        const count = s.split(sep).length - 1;
        if (count === 1 && after !== 3) dec = pos;
        else if (count === 1 && after === 3 && (d === 3 || /^0*$/.test(s.slice(0, pos)))) dec = pos;
      }
      let intPart = s, frac = '';
      if (dec >= 0) { intPart = s.slice(0, dec); frac = s.slice(dec + 1); }
      intPart = intPart.replace(/[.,]/g, '');
      if (!/^\d*$/.test(intPart) || !/^\d*$/.test(frac) || (intPart === '' && frac === '')) return NaN;
      if (frac.length > d) {
        // More decimals than the currency has: round half up.
        const keep = frac.slice(0, d);
        const roundUp = Number(frac[d]) >= 5;
        let v = Number(intPart || '0') * Math.pow(10, d) + Number(keep || '0');
        if (roundUp) v += 1;
        total += v;
      } else {
        total += Number(intPart || '0') * Math.pow(10, d) + Number((frac + '000').slice(0, d) || '0');
      }
    }
    return total;
  }

  // Plain number for an input field: 4210 -> "42.10" (always a dot, which parseAmount reads back).
  function amountInput(minor, cur) {
    const d = minorDigits(cur);
    if (!d) return String(minor);
    const s = String(Math.abs(minor)).padStart(d + 1, '0');
    return (minor < 0 ? '-' : '') + s.slice(0, -d) + '.' + s.slice(-d);
  }

  // ---------- categories, guessed from the words people type ----------
  const CAT_RULES = [
    ['groceries', /grocer|supermarket|lidl|aldi|tesco|walmart|costco|carrefour|mercadona|pingo|continente|kroger|sainsbury|asda|woolworths|coles|rewe|edeka|spar\b|\bcoop\b|market|food shop|weekly shop|milk|bread/i],
    ['eating', /dinner|lunch|breakfast|brunch|restaurant|pizza|takeaway|take-away|take away|burger|sushi|kebab|curry|ramen|tapas|caf[eé]|coffee|bakery|meal|pastel|pastry|pastries|cake|snack|ice cream|gelato|nata/i],
    ['drinks', /drink|\bbar\b|beer|wine|\bpub\b|cocktail|prosecco|spirits/i],
    ['utilities', /electric|power bill|\bgas\b|water|energy|heating|utilit|council tax/i],
    ['internet', /internet|wi-?fi|broadband|phone|mobile|netflix|spotify|disney|subscription|streaming|tv licen/i],
    ['home', /rent|deposit|furniture|ikea|cleaning|cleaner|repair|household|toilet|bin bag|detergent|plumber|lightbulb|kitchen/i],
    ['stay', /hotel|airbnb|hostel|accommodation|apartment|booking\.com|cabin|camping/i],
    ['travel', /flight|airline|plane|airport|ryanair|easyjet|luggage|visa/i],
    ['transport', /taxi|uber|bolt|lyft|fuel|petrol|diesel|parking|toll|train|\bbus\b|metro|tram|ferry|car hire|rental car|scooter/i],
    ['fun', /ticket|museum|cinema|concert|festival|show|tour|entry|theme park|bowling|game|match|gig/i],
    ['shopping', /gift|present|birthday|clothes|shoes|amazon|shop/i],
  ];
  function guessCat(title) {
    for (const r of CAT_RULES) if (r[1].test(title || '')) return r[0];
    return 'other';
  }

  const api = {
    uid: uid, todayISO: todayISO, newBook: newBook, entryEvent: entryEvent, reviseEntry: reviseEntry,
    fold: fold, isUsed: isUsed, apportion: apportion, shares: shares, balances: balances, working: working,
    settle: settle, merge: merge, summarize: summarize, diffVersions: diffVersions, cleanEvent: cleanEvent,
    cleanBook: cleanBook, pack: pack, unpack: unpack, encode: encode, decode: decode, findCode: findCode,
    minorDigits: minorDigits, money: money, parseAmount: parseAmount, amountInput: amountInput,
    guessCat: guessCat, CATS: CATS,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.FairSplit = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
