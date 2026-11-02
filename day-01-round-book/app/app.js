'use strict';
// Round Book: a shared record for a rotating savings circle (ajo, esusu, adashe).
// Everything lives on the treasurer's phone (localStorage). Members get a read-only snapshot
// through a link whose #view= fragment carries the whole book, so no server is needed.

const STORE = 'roundbook.v1';
const main = document.getElementById('main');
const dlg = document.getElementById('dlg');

// ---------- small helpers ----------
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const uid = () => Math.random().toString(36).slice(2, 9);
const pad = (n) => String(n).padStart(2, '0');
const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parse = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const today = () => iso(new Date());
const STEP = { day: 1, week: 7, fortnight: 14 };
function addPeriod(s, every, n) {
  const d = parse(s);
  if (every === 'month') {
    const day = d.getDate();
    d.setDate(1); d.setMonth(d.getMonth() + n);
    d.setDate(Math.min(day, new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()));
  } else d.setDate(d.getDate() + n * STEP[every]);
  return iso(d);
}
const daysBetween = (a, b) => Math.round((parse(b) - parse(a)) / 86400000);
const fmtDate = (s, year) => parse(s).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', ...(year ? { year: 'numeric' } : {}) });
const shortDate = (s) => parse(s).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
const moneyFmt = {};
function money(n, cur) {
  moneyFmt[cur] ||= new Intl.NumberFormat('en-NG', { style: 'currency', currency: cur, minimumFractionDigits: 0, maximumFractionDigits: 0 });
  return moneyFmt[cur].format(n);
}
const signed = (n, cur) => (n > 0 ? '+' : n < 0 ? '−' : '') + money(Math.abs(n), cur);
const initials = (name) => name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
const first = (name) => name.trim().split(/\s+/)[0];
const hue = (i) => Math.round((i * 137.508 + 210) % 360); // golden angle: neighbours land far apart on the wheel
const who = (m, cls = '') => `<span class="who ${cls}" style="--h:${m.hue}" aria-hidden="true">${esc(initials(m.name))}</span>`;
const plural = (n, one, many = one + 's') => `${n} ${n === 1 ? one : many}`;
const EVERY = { day: 'Daily', week: 'Weekly', fortnight: 'Every two weeks', month: 'Monthly' };
const METHOD = { transfer: 'Transfer', cash: 'Cash', pos: 'POS' };

// ---------- store ----------
let db = { circles: [], current: null };
let viewOnly = null; // { circle, sharedAt } when opened from a member's link
let storageOk = true;
try { db = JSON.parse(localStorage.getItem(STORE)) || db; } catch { storageOk = false; }
function save() { try { localStorage.setItem(STORE, JSON.stringify(db)); } catch { storageOk = false; } }
const circle = () => viewOnly?.circle || db.circles.find((c) => c.id === db.current) || null;
function withHues(c) { c.members.forEach((m, i) => { m.hue = hue(i); }); return c; }

// ---------- the ledger ----------
// Round r is paid out to members[r-1]. Its due date is start + (r-1) periods.
// The current round is the first one without a payout.
function ledger(c, on = today()) {
  const pot = c.amount * c.members.length;
  const rounds = c.members.map((m, i) => {
    const r = i + 1;
    const paid = Object.fromEntries(c.members.map((x) => [x.id, 0]));
    let collected = 0;
    for (const p of c.payments) if (p.round === r) { paid[p.memberId] += p.amount; collected += p.amount; }
    return { r, due: addPeriod(c.start, c.every, i), recipient: m, payout: c.payouts.find((p) => p.round === r) || null, paid, collected, pot };
  });
  const current = rounds.find((x) => !x.payout) || null;
  const state = (round, id) => {
    const amt = round.paid[id];
    if (amt >= c.amount) return 'paid';
    if (amt > 0) return 'part';
    return round.due <= on ? 'owing' : 'future';
  };
  const totalIn = c.payments.reduce((s, p) => s + p.amount, 0);
  const totalOut = c.payouts.reduce((s, p) => s + p.amount, 0);
  const members = c.members.map((m, i) => {
    const dueRounds = rounds.filter((x) => x.due <= on).length;
    const paidIn = c.payments.filter((p) => p.memberId === m.id).reduce((s, p) => s + p.amount, 0);
    return { ...m, turn: i + 1, round: rounds[i], paidIn, expected: dueRounds * c.amount, balance: paidIn - dueRounds * c.amount };
  });
  return { pot, rounds, current, state, totalIn, totalOut, held: totalIn - totalOut, members };
}

// ---------- sample circle (clearly marked as a sample) ----------
function sampleCircle() {
  const names = ['Adaeze Okafor', 'Bola Adeyemi', 'Chinedu Eze', 'Funmi Bakare', 'Ibrahim Musa', 'Kemi Oladipo', 'Ngozi Nwosu', 'Segun Alabi', 'Tunde Ogunleye', 'Zainab Bello'];
  const start = addPeriod(today(), 'week', -4);
  const members = names.map((name, i) => ({ id: 'm' + (i + 1), name }));
  let seed = 11;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const ref = () => 'TRF ' + Array.from({ length: 3 }, () => String(1000 + Math.floor(rnd() * 9000))).join(' ');
  const payments = []; const payouts = [];
  for (let r = 1; r <= 5; r++) {
    const due = addPeriod(start, 'week', r - 1);
    members.forEach((m, i) => {
      if (r === 5 && ['m7', 'm9', 'm10'].includes(m.id)) return; // three still owe this round
      const amount = r === 5 && m.id === 'm8' ? 10000 : 20000; // Segun has paid half
      let date = addPeriod(due, 'day', -Math.floor(rnd() * 3));
      if (r === 4 && m.id === 'm5') date = addPeriod(due, 'day', 2); // paid two days late
      if (date > today()) date = today();
      const method = i === 3 && r % 2 ? 'cash' : i === 6 && r === 2 ? 'pos' : 'transfer';
      payments.push({ id: `p${r}-${i}`, memberId: m.id, round: r, amount, date, method, ref: method === 'cash' ? '' : ref() });
    });
    if (r < 5) {
      const last = payments.filter((p) => p.round === r).map((p) => p.date).sort().pop();
      payouts.push({ round: r, memberId: members[r - 1].id, amount: 200000, date: last > due ? last : due, method: 'transfer', ref: ref() });
    }
  }
  const c = { id: 'sample', sample: true, name: 'Balogun Market Ajo', currency: 'NGN', amount: 20000, every: 'week', start, members, payments, payouts, updatedAt: new Date().toISOString() };
  const l = ledger(c);
  console.assert(l.rounds[4].collected === 130000, 'sample: round 5 should hold 6 × 20,000 + 10,000');
  console.assert(l.totalIn - l.totalOut === l.held, 'sample: held = in − out');
  return c;
}

// ---------- share link: the whole book in the fragment ----------
const b64url = (bytes) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unb64url = (s) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (ch) => ch.charCodeAt(0));
async function pack(obj) {
  const bytes = new TextEncoder().encode(JSON.stringify(obj));
  if (!('CompressionStream' in window)) return 'j' + b64url(bytes);
  const out = await new Response(new Blob([bytes]).stream().pipeThrough(new CompressionStream('deflate-raw'))).arrayBuffer();
  return 'z' + b64url(new Uint8Array(out));
}
async function unpack(s) {
  const bytes = unb64url(s.slice(1));
  if (s[0] === 'j') return JSON.parse(new TextDecoder().decode(bytes));
  const out = await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).text();
  return JSON.parse(out);
}
function snapshot(c) {
  const { id, sample, ...rest } = c;
  return { v: 1, sharedAt: new Date().toISOString(), circle: { ...rest, members: c.members.map(({ hue: _h, ...m }) => m) } };
}
async function shareLink(c) {
  const base = location.href.split('#')[0].split('?')[0];
  return `${base}#view=${await pack(snapshot(c))}`;
}
function summary(c, link) {
  const l = ledger(c);
  const lines = [`${c.name}`];
  if (!l.current) lines.push(`All ${c.members.length} rounds paid out. ${money(l.totalOut, c.currency)} paid out in total.`);
  else {
    const r = l.current;
    const owe = c.members.filter((m) => l.state(r, m.id) !== 'paid');
    const paid = c.members.filter((m) => l.state(r, m.id) === 'paid');
    lines.push(`Round ${r.r} of ${c.members.length}, due ${fmtDate(r.due)}. ${r.recipient.name} collects.`);
    lines.push(`Collected ${money(r.collected, c.currency)} of ${money(r.pot, c.currency)}.`);
    lines.push('', `Paid (${paid.length}): ${paid.map((m) => first(m.name)).join(', ') || 'nobody yet'}`);
    if (owe.length) lines.push(`Still to pay (${owe.length}): ${owe.map((m) => `${first(m.name)} ${money(c.amount - r.paid[m.id], c.currency)}`).join(', ')}`);
  }
  lines.push('', `Held by the treasurer now: ${money(l.held, c.currency)}`);
  if (link) lines.push('', `Check the full book: ${link}`);
  return lines.join('\n');
}

// ---------- routing ----------
async function route() {
  const h = location.hash;
  if (h.startsWith('#view=')) {
    try {
      const snap = await unpack(h.slice(6));
      viewOnly = { circle: withHues(snap.circle), sharedAt: snap.sharedAt };
    } catch {
      viewOnly = null;
      main.innerHTML = `<div class="title-row"><div><h1>This link is broken</h1><p class="sub">Part of the link is missing. Ask the treasurer to send it again.</p></div></div>`;
      return;
    }
    document.body.classList.add('view-only');
    renderBook();
    return;
  }
  viewOnly = null;
  document.body.classList.remove('view-only');
  const [, path = '', arg] = h.match(/^#\/?([a-z]*)\/?([^/]*)/) || [];
  const c = circle();
  if (!c || path === 'settings') renderSettings();
  else if (path === 'entries') renderEntries();
  else if (path === 'm' && arg) renderMember(arg);
  else renderBook();
  for (const a of document.querySelectorAll('[data-nav]')) {
    const on = (a.dataset.nav === 'book' && (path === '' || path === 'm')) || a.dataset.nav === path || (a.dataset.nav === 'settings' && !c);
    if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
  }
}

function titleRow(title, sub, actions = '') {
  return `<div class="title-row"><div><h1>${title}</h1>${sub ? `<p class="sub">${sub}</p>` : ''}</div>${actions ? `<div class="actions">${actions}</div>` : ''}</div>`;
}
function dueWords(due, on = today()) {
  const d = daysBetween(on, due);
  if (d === 0) return 'due today';
  if (d === 1) return 'due tomorrow';
  if (d > 1) return `due in ${d} days`;
  return d === -1 ? '1 day overdue' : `${-d} days overdue`;
}

// ---------- the book ----------
function renderBook() {
  const c = circle();
  const l = ledger(c);
  const cur = c.currency;
  const r = l.current;
  const ro = !!viewOnly;
  let sub;
  if (!r) sub = `All ${c.members.length} rounds are paid out. The circle is complete.`;
  else {
    const owing = c.members.filter((m) => l.state(r, m.id) !== 'paid');
    const short = r.pot - r.collected;
    sub = `Round ${r.r} of ${c.members.length} is ${dueWords(r.due)}. ` + (owing.length
      ? `${plural(owing.length, 'member')} still owe ${money(short, cur)} before ${esc(first(r.recipient.name))} can collect ${money(r.pot, cur)}.`
      : `Everyone has paid. ${esc(r.recipient.name)} can collect ${money(r.pot, cur)}.`);
  }
  const actions = ro ? '' : `<button class="btn" type="button" data-action="share"><span>Share<span class="hide-sm"> with members</span></span></button><button class="btn primary" type="button" data-action="pay">Record payment</button>`;
  const notice = ro
    ? `<div class="notice" role="note">Shared by the treasurer on ${fmtDate(viewOnly.sharedAt.slice(0, 10), true)} at ${new Date(viewOnly.sharedAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}. This is a copy of the book from that moment and does not update by itself. Ask for a new link after new payments.</div>`
    : c.sample ? `<div class="notice" role="note">This is a sample circle with made-up names and amounts, so you can see how the book works. <button class="text-action" type="button" data-action="new-circle">Start your own circle</button></div>`
    : !storageOk ? `<div class="notice" role="note">This browser is not letting Round Book save. Your entries will be lost when you close the page. Try a normal (not private) window.</div>` : '';

  // 12 columns, one 24px gutter: the round (7) beside a stacked column (5) of money and turns, then the card (12).
  // Both sides stretch to the row; only the actions at their feet are pinned to the bottom.
  const shownOwing = r ? Math.min(5, c.members.filter((m) => l.state(r, m.id) !== 'paid').length) : 0;
  main.innerHTML = `${notice}${titleRow(esc(c.name), sub, actions)}
  <div class="grid">
    ${roundPanel(c, l)}
    <div class="stack" style="grid-column: span 5">${circlePanel(c, l)}${turnsPanel(c, l, Math.max(2, shownOwing))}</div>
    ${cardPanel(c, l)}
  </div>`;
}

function roundPanel(c, l) {
  const r = l.current; const cur = c.currency; const ro = !!viewOnly;
  if (!r) {
    return `<section class="panel span-7" style="grid-column: span 7"><header><h2>Every round is done</h2></header>
      <p class="figure num">${money(l.totalOut, cur)} <small>paid out to ${plural(c.members.length, 'member')}</small></p>
      <p class="sub" style="margin-top:8px;color:var(--muted)">Start a new cycle from Circle settings when the group is ready.</p></section>`;
  }
  const owing = c.members.filter((m) => l.state(r, m.id) !== 'paid');
  const paid = c.members.filter((m) => l.state(r, m.id) === 'paid');
  const pct = Math.min(100, (r.collected / r.pot) * 100);
  const late = daysBetween(today(), r.due) < 0;
  const more = owing.length > 5 ? `<p class="meta" style="padding-top:8px">and ${owing.length - 5} more, shown on the card below</p>` : '';
  const owingRows = owing.length
    ? owing.slice(0, 5).map((m) => {
      const left = c.amount - r.paid[m.id];
      const partial = r.paid[m.id] > 0 ? `<span class="sub">Paid ${money(r.paid[m.id], c.currency)} of ${money(c.amount, c.currency)}</span>` : '';
      return `<div class="row">${who(m)}<div class="grow"><span class="name">${esc(m.name)}</span>${partial}</div><span class="amt num">${money(left, cur)}</span>${ro ? '' : `<button class="text-action act" type="button" data-action="pay" data-member="${m.id}">Record</button>`}</div>`;
    }).join('') + more
    : `<div class="empty">Everyone has paid round ${r.r}.</div>`;
  const foot = ro ? '' : `<div class="panel-foot"><span class="meta">${r.collected >= r.pot ? `Ready to pay ${esc(first(r.recipient.name))}` : `${money(r.pot - r.collected, cur)} still to come in`}</span>
      <button class="btn" type="button" data-action="payout">Pay out to ${esc(first(r.recipient.name))}</button></div>`;
  return `<section class="panel span-7 round" style="grid-column: span 7" aria-labelledby="h-round">
    <header><h2 id="h-round">Round ${r.r} · ${fmtDate(r.due)}</h2><span class="pill ${late && owing.length ? 'neg' : 'acc'}">${dueWords(r.due)}</span></header>
    <p class="figure num" aria-label="${money(r.collected, cur)} collected of ${money(r.pot, cur)}">${money(r.collected, cur)} <small>of ${money(r.pot, cur)}</small></p>
    <div class="bar" role="img" aria-label="${Math.round(pct)}% of the pot collected"><i style="width:${pct}%"></i></div>
    <div class="bar-ends num"><span>${plural(paid.length, 'member')} paid in full</span><span>${esc(r.recipient.name)} collects</span></div>
    <p class="section-label">Still to pay</p>
    <div class="rows">${owingRows}</div>
    ${paid.length ? `<p class="section-label">Paid in full</p><div class="paid-line" aria-label="Paid in full: ${paid.map((m) => esc(m.name)).join(', ')}">${paid.map((m) => `<span title="${esc(m.name)}">${who(m)}</span>`).join('')}</div>` : ''}
    ${foot}
  </section>`;
}

function turnsPanel(c, l, count = 4) {
  const cur = c.currency;
  const now = l.current ? l.current.r : c.members.length + 1;
  const from = Math.max(1, Math.min(now - 1, c.members.length - count + 1));
  const shown = l.rounds.slice(from - 1, from - 1 + count);
  const rows = shown.map((x) => {
    const m = x.recipient;
    let right;
    if (x.payout) right = `<span class="amt num">${money(x.payout.amount, cur)}<span class="sub">Collected ${shortDate(x.payout.date)}</span></span>`;
    else if (x.r === now) right = `<span class="pill acc">Collecting now</span>`;
    else right = `<span class="amt num" style="color:var(--muted)">${fmtDate(x.due)}</span>`;
    const inner = `<span class="rank num">${x.r}.</span>${who(m)}<div class="grow"><span class="name">${esc(m.name)}</span></div>${right}`;
    return viewOnly ? `<div class="row turn ${x.r === now ? 'now' : ''}">${inner}</div>` : `<a class="row turn ${x.r === now ? 'now' : ''}" href="#/m/${m.id}">${inner}</a>`;
  }).join('');
  const all = c.members.length > shown.length ? `<p class="meta foot">Turns ${from} to ${from + shown.length - 1} of ${c.members.length}. The card shows every turn.</p>` : '';
  return `<section class="panel turns" aria-labelledby="h-turns">
    <header><h2 id="h-turns">Turns</h2><span class="meta">${EVERY[c.every]}, from ${shortDate(c.start)}</span></header>
    <div class="rows">${rows}</div>${all}</section>`;
}

function cardPanel(c, l) {
  const now = l.current ? l.current.r : 0;
  const head = l.rounds.map((x) => `<th scope="col" class="${x.r === now ? 'now' : ''}">R${x.r}<small>${shortDate(x.due)}</small></th>`).join('');
  const label = { paid: 'paid', part: 'part paid', owing: 'not paid', future: 'not due yet' };
  const body = l.members.map((m) => {
    const cells = l.rounds.map((x) => {
      const s = l.state(x, m.id);
      const turn = x.r === m.turn;
      const t = `${m.name}, round ${x.r}: ${label[s]}${s === 'part' ? ` (${money(x.paid[m.id], c.currency)})` : ''}${turn ? ', their turn to collect' : ''}`;
      return `<td class="${x.r === now ? 'now' : ''}"><span class="mk ${s} ${turn ? 'mine' : ''}" role="img" aria-label="${esc(t)}" title="${esc(t)}"></span></td>`;
    }).join('');
    const bal = m.balance === 0 ? `<span style="color:var(--muted)">Up to date</span>` : m.balance < 0 ? `Owes ${money(-m.balance, c.currency)}` : `${money(m.balance, c.currency)} ahead`;
    const name = viewOnly ? `<span class="name">${esc(m.name)}</span>` : `<a class="name" href="#/m/${m.id}">${esc(m.name)}</a>`;
    return `<tr><th scope="row" class="lead"><div class="row">${who(m)}${name}</div></th>${cells}<td class="tot num">${bal}</td></tr>`;
  }).join('');
  return `<section class="panel" style="grid-column: 1 / -1" aria-labelledby="h-card">
    <header><h2 id="h-card">The card</h2>
      <div class="legend" aria-hidden="true"><span><i class="mk paid"></i>Paid</span><span><i class="mk part"></i>Part paid</span><span><i class="mk owing"></i>Not paid, due</span><span><i class="mk future"></i>Not due yet</span><span><i class="mk future mine"></i>Their turn</span></div></header>
    <div class="matrix"><table><thead><tr><th scope="col" class="lead">Member</th>${head}<th scope="col" class="tot">Balance</th></tr></thead><tbody>${body}</tbody></table></div>
  </section>`;
}

function entriesOf(c) {
  const byId = Object.fromEntries(c.members.map((m) => [m.id, m]));
  return [
    ...c.payments.map((p) => ({ kind: 'in', ...p, member: byId[p.memberId] })),
    ...c.payouts.map((p) => ({ kind: 'out', id: 'out' + p.round, ...p, member: byId[p.memberId] })),
  ].sort((a, b) => (b.date + b.kind).localeCompare(a.date + a.kind) || b.round - a.round);
}
function entryRow(c, e) {
  const what = e.kind === 'in' ? `Round ${e.round} · ${METHOD[e.method] || ''}` : `Payout, round ${e.round}`;
  return `<div class="row">${who(e.member)}<div class="grow"><span class="name">${esc(e.member.name)}</span><span class="sub">${what}${e.ref ? ` · <span class="ref">${esc(e.ref)}</span>` : ''}</span></div>
    <span class="amt num">${e.kind === 'in' ? `<span class="in">+${money(e.amount, c.currency)}</span>` : `−${money(e.amount, c.currency)}`}<span class="sub">${shortDate(e.date)}</span></span></div>`;
}
function circlePanel(c, l) {
  const cur = c.currency;
  const link = viewOnly ? '' : `<a class="card-link" href="#/entries">All ${entriesOf(c).length} entries</a>`;
  return `<section class="panel" aria-labelledby="h-money"><header><h2 id="h-money">Where the money is</h2>${link}</header>
    <dl class="kv">
      <div class="lead"><dt>Held by the treasurer now</dt><dd class="num">${money(l.held, cur)}</dd></div>
      <div><dt>Paid in, all rounds</dt><dd class="num">${money(l.totalIn, cur)}</dd></div>
      <div><dt>Paid out, ${plural(c.payouts.length, 'round')}</dt><dd class="num">${money(l.totalOut, cur)}</dd></div>
    </dl></section>`;
}

// ---------- one member ----------
function renderMember(id) {
  const c = circle(); const l = ledger(c); const cur = c.currency;
  const m = l.members.find((x) => x.id === id);
  if (!m) { location.hash = '#/'; return; }
  const x = m.round;
  const turn = x.payout ? `Collected ${money(x.payout.amount, cur)} on ${fmtDate(x.payout.date)}` : `Collects ${money(l.pot, cur)} in round ${x.r}, ${fmtDate(x.due)}`;
  const pays = c.payments.filter((p) => p.memberId === id).sort((a, b) => b.round - a.round || b.date.localeCompare(a.date));
  const bal = m.balance === 0 ? '<span style="color:var(--muted)">Up to date</span>' : m.balance < 0 ? `<span style="color:var(--negative)">${signed(m.balance, cur)}</span>` : signed(m.balance, cur);
  const rows = pays.map((p) => `<tr><td class="num">Round ${p.round}</td><td class="num">${fmtDate(p.date)}</td><td>${METHOD[p.method]}${p.ref ? ` <span class="ref">${esc(p.ref)}</span>` : ''}</td><td class="n num">${money(p.amount, cur)}</td><td class="n"><button class="text-action danger" type="button" data-action="delete" data-id="${p.id}">Remove</button></td></tr>`).join('');
  main.innerHTML = `${titleRow(`${who(m, 'lg')} <span>${esc(m.name)}</span>`, `Turn ${m.turn} of ${c.members.length}. ${turn}.`, `<a class="btn" href="#/">Back to the book</a><button class="btn primary" type="button" data-action="pay" data-member="${m.id}">Record payment</button>`)}
  <div class="grid top">
    <div class="kpis" style="grid-column: 1 / -1">
      <div class="kpi"><div class="kpi-label">Paid in</div><div class="kpi-value num">${money(m.paidIn, cur)}</div></div>
      <div class="kpi"><div class="kpi-label">Due so far</div><div class="kpi-value num">${money(m.expected, cur)}</div></div>
      <div class="kpi"><div class="kpi-label">Balance</div><div class="kpi-value num">${bal}</div></div>
      <div class="kpi"><div class="kpi-label">Their payout</div><div class="kpi-value num">${x.payout ? money(x.payout.amount, cur) : '<span style="color:var(--muted)">–</span>'}</div><div class="delta">${x.payout ? `Round ${x.r}, ${shortDate(x.payout.date)}` : `Round ${x.r}, ${shortDate(x.due)}`}</div></div>
    </div>
    <section class="panel" style="grid-column: 1 / -1"><header><h2>Payments</h2><span class="meta">${plural(pays.length, 'payment')}</span></header>
      ${pays.length ? `<div class="table-wrap"><table class="entries"><thead><tr><th>Round</th><th>Date</th><th>How</th><th class="n">Amount</th><th class="n"><span class="sr">Actions</span></th></tr></thead><tbody>${rows}</tbody></table></div>` : `<div class="empty">No payments from ${esc(first(m.name))} yet.</div>`}
    </section>
  </div>`;
}

// ---------- all entries ----------
function renderEntries() {
  const c = circle(); const l = ledger(c); const cur = c.currency;
  const list = entriesOf(c);
  const rows = list.map((e) => `<tr>
    <td class="num">${fmtDate(e.date)}</td>
    <td><a href="#/m/${e.member.id}" class="row" style="min-height:0;padding:0">${who(e.member)}<span class="name">${esc(e.member.name)}</span></a></td>
    <td class="hide-sm">${e.kind === 'in' ? `Round ${e.round} · ${METHOD[e.method]}` : `Payout, round ${e.round}`}</td>
    <td class="hide-sm">${e.ref ? `<span class="ref">${esc(e.ref)}</span>` : '<span style="color:var(--muted)">–</span>'}</td>
    <td class="n num">${e.kind === 'in' ? `<span class="in">+${money(e.amount, cur)}</span>` : `−${money(e.amount, cur)}`}</td>
    <td class="n hide-sm">${e.kind === 'in' ? `<button class="text-action danger" type="button" data-action="delete" data-id="${e.id}">Remove</button>` : `<button class="text-action danger" type="button" data-action="undo-payout" data-round="${e.round}">Undo</button>`}</td></tr>`).join('');
  main.innerHTML = `${titleRow('Entries', `${plural(list.length, 'entry', 'entries')}. ${money(l.totalIn, cur)} paid in, ${money(l.totalOut, cur)} paid out, ${money(l.held, cur)} held now.`, `<button class="btn primary" type="button" data-action="pay">Record payment</button>`)}
  <section class="panel">${list.length ? `<div class="table-wrap"><table class="entries"><thead><tr><th>Date</th><th>Member</th><th class="hide-sm">What</th><th class="hide-sm">Reference</th><th class="n">Amount</th><th class="n hide-sm"><span class="sr">Actions</span></th></tr></thead><tbody>${rows}</tbody></table></div>` : `<div class="empty">No entries yet. Record the first payment.</div>`}</section>`;
}

// ---------- settings: circles, members, backup ----------
function renderSettings() {
  const c = circle();
  const editing = c && !c.sample;
  const others = db.circles.filter((x) => x.id !== db.current);
  const lockN = c ? c.payouts.length : 0;
  const form = `<form class="form" id="circle-form" novalidate>
      <div class="field"><label for="f-name">Circle name</label><input class="input" id="f-name" name="name" required maxlength="60" value="${esc(editing ? c.name : '')}" placeholder="For example, Shop 14 traders' ajo"></div>
      <div class="two">
        <div class="field"><label for="f-amount">Each member pays</label><input class="input num" id="f-amount" name="amount" inputmode="numeric" required value="${editing ? c.amount : ''}" placeholder="20000"></div>
        <div class="field"><label for="f-cur">Currency</label><select class="input" id="f-cur" name="currency">${['NGN', 'GHS', 'KES', 'ZAR', 'XOF', 'GBP', 'USD'].map((x) => `<option ${(editing ? c.currency : 'NGN') === x ? 'selected' : ''}>${x}</option>`).join('')}</select></div>
      </div>
      <div class="two">
        <div class="field"><label for="f-every">How often</label><select class="input" id="f-every" name="every">${Object.entries(EVERY).map(([k, v]) => `<option value="${k}" ${(editing ? c.every : 'week') === k ? 'selected' : ''}>${v}</option>`).join('')}</select></div>
        <div class="field"><label for="f-start">First round is due</label><input class="input" id="f-start" name="start" type="date" required value="${editing ? c.start : today()}"></div>
      </div>
      <div class="field"><label for="f-members">Members, in payout order</label>
        <textarea class="input" id="f-members" name="members" required placeholder="One name per line. The first name collects first.">${editing ? esc(c.members.map((m) => m.name).join('\n')) : ''}</textarea>
        <span class="hint">${lockN ? `The first ${plural(lockN, 'name')} have already collected, so they must stay at the top in the same order.` : 'The first name collects in round 1, the second in round 2, and so on.'}</span></div>
      <p class="err" id="f-err" role="alert" style="color:var(--negative)"></p>
      <div class="dlg-actions" style="justify-content:flex-start"><button class="btn primary" type="submit">${editing ? 'Save changes' : 'Start the circle'}</button>${editing ? '' : db.circles.length ? '<a class="btn" href="#/">Cancel</a>' : ''}</div>
    </form>`;
  const list = others.length ? `<section class="settings"><div><h2>Your other circles</h2><p class="desc">Each circle keeps its own book on this phone.</p></div><div class="rows circle-list">${others.map((x) => `<div class="row"><div class="grow"><span class="name">${esc(x.name)}</span><span class="sub">${plural(x.members.length, 'member')} · ${money(x.amount, x.currency)} ${EVERY[x.every].toLowerCase()}</span></div><button class="text-action act" type="button" data-action="switch" data-id="${x.id}">Open</button></div>`).join('')}</div></section>` : '';
  main.innerHTML = `${titleRow(editing ? 'Circle settings' : 'Start a circle', editing ? `${esc(c.name)} · ${plural(c.members.length, 'member')}` : 'Round Book keeps the record of a rotating savings circle on this phone. It never holds or moves money.', editing ? `<button class="btn" type="button" data-action="new-circle">New circle</button>` : (db.circles.length ? '' : `<button class="btn" type="button" data-action="sample">Look at a sample first</button>`))}
  <section class="settings"><div><h2>${editing ? 'The circle' : 'Your circle'}</h2><p class="desc">Everyone pays the same amount each round. One member collects the whole pot each round, in the order you list them.</p></div><div class="panel">${form}</div></section>
  ${list}
  <section class="settings"><div><h2>Backup</h2><p class="desc">The book lives only on this phone. Save a backup file now and then, for example to your Google Drive or WhatsApp.</p></div><div class="actions"><button class="btn" type="button" data-action="export" ${db.circles.length ? '' : 'disabled title="Nothing to save yet"'}>Save a backup file</button><label class="btn" for="import-file">Restore from a backup</label><input id="import-file" type="file" accept="application/json,.json" hidden></div></section>
  ${editing ? `<section class="settings"><div><h2>Delete this circle</h2><p class="desc">Removes ${esc(c.name)} and all its entries from this phone. Links you already shared keep working.</p></div><div><button class="btn danger" type="button" data-action="delete-circle">Delete ${esc(c.name)}</button></div></section>` : ''}`;
  document.getElementById('circle-form').addEventListener('submit', (ev) => { ev.preventDefault(); saveCircle(new FormData(ev.target), editing ? c : null); });
  document.getElementById('import-file').addEventListener('change', importBackup);
}

function saveCircle(fd, existing) {
  const err = (msg) => { document.getElementById('f-err').textContent = msg; };
  const name = String(fd.get('name')).trim();
  const amount = Number(String(fd.get('amount')).replace(/[^\d.]/g, ''));
  const names = String(fd.get('members')).split('\n').map((s) => s.replace(/\s+/g, ' ').trim()).filter(Boolean);
  if (!name) return err('Give the circle a name.');
  if (!(amount > 0)) return err('Enter how much each member pays, as a number.');
  if (names.length < 2) return err('A circle needs at least two members.');
  if (names.length > 60) return err('Round Book handles up to 60 members per circle.');
  const lower = names.map((n) => n.toLowerCase());
  const dupe = lower.find((n, i) => lower.indexOf(n) !== i);
  if (dupe) return err(`"${names[lower.indexOf(dupe)]}" is listed twice. Add a surname or a number so each member is unique.`);
  if (!fd.get('start')) return err('Pick the date the first round is due.');
  let members;
  if (existing) {
    const lock = existing.payouts.length;
    for (let i = 0; i < lock; i++) if (lower[i] !== existing.members[i].name.toLowerCase()) return err(`${existing.members[i].name} has already collected round ${i + 1}, so they must stay in place ${i + 1}.`);
    const keep = new Map(existing.members.map((m) => [m.name.toLowerCase(), m]));
    members = names.map((n) => ({ id: keep.get(n.toLowerCase())?.id || 'm' + uid(), name: n }));
    const gone = existing.members.filter((m) => !members.some((x) => x.id === m.id));
    const withPay = gone.find((m) => existing.payments.some((p) => p.memberId === m.id));
    if (withPay) return err(`${withPay.name} has payments in the book, so they can't be removed. Remove their payments first, or keep them in the list.`);
    Object.assign(existing, { name, amount, currency: fd.get('currency'), every: fd.get('every'), start: fd.get('start'), members, updatedAt: new Date().toISOString() });
    existing.payments = existing.payments.filter((p) => p.round <= members.length);
  } else {
    members = names.map((n) => ({ id: 'm' + uid(), name: n }));
    const c = { id: 'c' + uid(), name, amount, currency: fd.get('currency'), every: fd.get('every'), start: fd.get('start'), members, payments: [], payouts: [], updatedAt: new Date().toISOString() };
    db.circles = db.circles.filter((x) => !x.sample);
    db.circles.push(c); db.current = c.id;
  }
  withHues(circle()); save(); toast('Saved'); location.hash = '#/'; route();
}

// ---------- dialogs ----------
function openDialog(html, onSubmit) {
  dlg.innerHTML = html;
  dlg.showModal();
  const form = dlg.querySelector('form');
  form?.addEventListener('submit', (ev) => {
    ev.preventDefault();
    if (ev.submitter?.value === 'cancel') return dlg.close();
    const msg = onSubmit(new FormData(form));
    if (msg) dlg.querySelector('.err').textContent = msg; else dlg.close();
  });
  dlg.querySelector('[autofocus]')?.focus();
}

function payDialog(memberId) {
  const c = circle(); const l = ledger(c);
  const r = l.current || l.rounds[l.rounds.length - 1];
  const owing = c.members.filter((m) => l.state(r, m.id) !== 'paid');
  const pick = memberId || owing[0]?.id || c.members[0].id;
  const left = (id) => Math.max(0, c.amount - r.paid[id]) || c.amount;
  openDialog(`<form class="form" novalidate>
    <div><h2 id="dlg-title">Record a payment</h2><p class="lede">Copy the reference from the bank alert, so the member can match it to their own debit.</p></div>
    <div class="two">
      <div class="field"><label for="p-m">Member</label><select class="input" id="p-m" name="member">${c.members.map((m) => `<option value="${m.id}" ${m.id === pick ? 'selected' : ''}>${esc(m.name)}</option>`).join('')}</select></div>
      <div class="field"><label for="p-r">For round</label><select class="input" id="p-r" name="round">${l.rounds.map((x) => `<option value="${x.r}" ${x.r === r.r ? 'selected' : ''}>Round ${x.r} · ${shortDate(x.due)}</option>`).join('')}</select></div>
    </div>
    <div class="two">
      <div class="field"><label for="p-a">Amount (${c.currency})</label><input class="input num" id="p-a" name="amount" inputmode="numeric" required value="${left(pick)}" autofocus></div>
      <div class="field"><label for="p-d">Date paid</label><input class="input" id="p-d" name="date" type="date" required value="${today()}" max="${today()}"></div>
    </div>
    <div class="two">
      <div class="field"><label for="p-how">How</label><select class="input" id="p-how" name="method">${Object.entries(METHOD).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select></div>
      <div class="field"><label for="p-ref">Reference</label><input class="input ref" id="p-ref" name="ref" maxlength="40" autocomplete="off" placeholder="From the alert"></div>
    </div>
    <p class="err" role="alert"></p>
    <div class="dlg-actions"><button class="btn" type="submit" value="cancel" formnovalidate>Cancel</button><button class="btn primary" type="submit">Save payment</button></div>
  </form>`, (fd) => {
    const amount = Number(String(fd.get('amount')).replace(/[^\d.]/g, ''));
    const ref = String(fd.get('ref')).trim();
    const round = Number(fd.get('round'));
    if (!(amount > 0)) return 'Enter the amount as a number.';
    if (!fd.get('date')) return 'Pick the date it was paid.';
    if (fd.get('date') > today()) return "The date can't be in the future.";
    if (ref) {
      const dup = c.payments.find((p) => p.ref && p.ref.replace(/\s/g, '').toLowerCase() === ref.replace(/\s/g, '').toLowerCase());
      if (dup) return `That reference is already in the book for ${c.members.find((m) => m.id === dup.memberId).name}, round ${dup.round}.`;
    }
    c.payments.push({ id: 'p' + uid(), memberId: fd.get('member'), round, amount, date: fd.get('date'), method: fd.get('method'), ref });
    commit(`Saved ${money(amount, c.currency)} from ${first(c.members.find((m) => m.id === fd.get('member')).name)}`);
  });
  const sel = dlg.querySelector('#p-m'); const amt = dlg.querySelector('#p-a'); const rsel = dlg.querySelector('#p-r');
  const refill = () => { const x = l.rounds[Number(rsel.value) - 1]; amt.value = Math.max(0, c.amount - x.paid[sel.value]) || c.amount; };
  sel.addEventListener('change', refill); rsel.addEventListener('change', refill);
}

function payoutDialog() {
  const c = circle(); const l = ledger(c); const r = l.current;
  if (!r) return;
  const short = r.pot - r.collected;
  openDialog(`<form class="form" novalidate>
    <div><h2 id="dlg-title">Pay out round ${r.r} to ${esc(r.recipient.name)}</h2>
    <p class="lede">${short > 0 ? `Only ${money(r.collected, c.currency)} of ${money(r.pot, c.currency)} has come in. ${money(short, c.currency)} is still owed this round.` : `Everyone has paid. The full pot is ${money(r.pot, c.currency)}.`}</p></div>
    <div class="two">
      <div class="field"><label for="o-a">Amount paid out (${c.currency})</label><input class="input num" id="o-a" name="amount" inputmode="numeric" required value="${r.collected || r.pot}" autofocus></div>
      <div class="field"><label for="o-d">Date</label><input class="input" id="o-d" name="date" type="date" required value="${today()}" max="${today()}"></div>
    </div>
    <div class="two">
      <div class="field"><label for="o-how">How</label><select class="input" id="o-how" name="method">${Object.entries(METHOD).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select></div>
      <div class="field"><label for="o-ref">Reference</label><input class="input ref" id="o-ref" name="ref" maxlength="40" autocomplete="off" placeholder="From your debit alert"></div>
    </div>
    <p class="err" role="alert"></p>
    <div class="dlg-actions"><button class="btn" type="submit" value="cancel" formnovalidate>Cancel</button><button class="btn primary" type="submit">Record payout</button></div>
  </form>`, (fd) => {
    const amount = Number(String(fd.get('amount')).replace(/[^\d.]/g, ''));
    if (!(amount > 0)) return 'Enter the amount as a number.';
    if (fd.get('date') > today()) return "The date can't be in the future.";
    c.payouts.push({ round: r.r, memberId: r.recipient.id, amount, date: fd.get('date'), method: fd.get('method'), ref: String(fd.get('ref')).trim() });
    commit(`Round ${r.r} paid out to ${first(r.recipient.name)}`);
  });
}

async function shareDialog() {
  const c = circle();
  if (!c) return;
  const local = location.protocol === 'file:';
  const link = await shareLink(c);
  const text = summary(c, local ? '' : link);
  openDialog(`<div class="dlg-body form">
    <div><h2 id="dlg-title">Share the book with members</h2><p class="lede">The link opens a read-only copy of the book as it is right now. Send a new one after new payments.</p></div>
    ${local ? '<div class="notice" style="margin:0">Links only work once Round Book is opened from the web, not from a file on this computer. The message below still works without one.</div>' : `<div class="field"><label for="s-link">Link to the book</label><div class="linkbox"><input class="input" id="s-link" readonly value="${esc(link)}"><button class="btn" type="button" data-copy="link">Copy</button></div></div>`}
    <div class="field"><label>Message for the group</label><pre class="preview">${esc(text)}</pre></div>
    <div class="dlg-actions"><button class="btn" type="button" data-close>Close</button><button class="btn" type="button" data-copy="text">Copy message</button><a class="btn primary" target="_blank" rel="noopener" href="https://wa.me/?text=${encodeURIComponent(text)}">Send on WhatsApp</a></div>
  </div>`);
  dlg.querySelector('[data-close]').addEventListener('click', () => dlg.close());
  dlg.querySelectorAll('[data-copy]').forEach((b) => b.addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(b.dataset.copy === 'link' ? link : text); toast('Copied'); } catch { toast('Copy failed. Select the text and copy it.'); }
  }));
}

function commit(msg) { const c = circle(); c.updatedAt = new Date().toISOString(); if (!c.sample) save(); toast(msg); route(); }

let toastTimer;
function toast(msg) {
  document.querySelector('.toast')?.remove();
  const t = Object.assign(document.createElement('div'), { className: 'toast', role: 'status', textContent: msg });
  document.body.append(t); clearTimeout(toastTimer); toastTimer = setTimeout(() => t.remove(), 2600);
}

// ---------- backup ----------
function exportBackup() {
  const blob = new Blob([JSON.stringify({ app: 'round-book', v: 1, savedAt: new Date().toISOString(), circles: db.circles.filter((c) => !c.sample) }, null, 1)], { type: 'application/json' });
  const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: `round-book-backup-${today()}.json` });
  a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
async function importBackup(ev) {
  const file = ev.target.files[0]; if (!file) return;
  try {
    const data = JSON.parse(await file.text());
    if (data.app !== 'round-book' || !Array.isArray(data.circles)) throw new Error('not a Round Book backup');
    const ids = new Set(db.circles.map((c) => c.id));
    const fresh = data.circles.filter((c) => !ids.has(c.id));
    db.circles = db.circles.filter((c) => !c.sample).concat(fresh);
    db.current = db.current && !db.current.startsWith('sample') ? db.current : fresh[0]?.id || db.circles[0]?.id || null;
    db.circles.forEach(withHues); save();
    toast(`Restored ${plural(fresh.length, 'circle')}`); location.hash = '#/'; route();
  } catch { toast("That file isn't a Round Book backup."); }
}

// ---------- events ----------
document.addEventListener('click', (ev) => {
  const b = ev.target.closest('[data-action]');
  if (!b) return;
  const c = circle();
  const a = b.dataset.action;
  if (a === 'pay' && c) payDialog(b.dataset.member);
  else if (a === 'payout' && c) payoutDialog();
  else if (a === 'share') { if (c) shareDialog(); else toast('Start a circle first.'); }
  else if (a === 'sample') { const s = withHues(sampleCircle()); db.circles = db.circles.filter((x) => !x.sample).concat(s); db.current = s.id; location.hash = '#/'; route(); }
  else if (a === 'new-circle') { db.circles = db.circles.filter((x) => !x.sample); db.current = null; save(); location.hash = '#/settings'; route(); }
  else if (a === 'switch') { db.current = b.dataset.id; save(); location.hash = '#/'; route(); }
  else if (a === 'export') exportBackup();
  else if (a === 'delete' && c) {
    const p = c.payments.find((x) => x.id === b.dataset.id);
    if (p && confirm(`Remove ${money(p.amount, c.currency)} from ${c.members.find((m) => m.id === p.memberId).name} (round ${p.round})?`)) { c.payments = c.payments.filter((x) => x !== p); commit('Payment removed'); }
  } else if (a === 'undo-payout' && c) {
    const r = Number(b.dataset.round);
    if (r !== Math.max(...c.payouts.map((p) => p.round))) return toast('Only the latest payout can be undone.');
    if (confirm(`Undo the round ${r} payout?`)) { c.payouts = c.payouts.filter((p) => p.round !== r); commit(`Round ${r} payout undone`); }
  } else if (a === 'delete-circle' && c) {
    if (confirm(`Delete ${c.name} and all ${plural(c.payments.length, 'payment')} from this phone? This cannot be undone. Save a backup first if you might need it.`)) {
      db.circles = db.circles.filter((x) => x.id !== c.id); db.current = db.circles[0]?.id || null; save(); toast('Circle deleted'); location.hash = '#/'; route();
    }
  }
});
window.addEventListener('hashchange', () => { route(); main.focus({ preventScroll: true }); window.scrollTo(0, 0); });

// ---------- start ----------
db.circles.forEach(withHues);
if (!db.current && db.circles[0]) db.current = db.circles[0].id;
if (new URLSearchParams(location.search).has('sample') && !location.hash.startsWith('#view=')) {
  const s = withHues(sampleCircle());
  db.circles = db.circles.filter((x) => !x.sample).concat(s); db.current = s.id;
}
route();
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('sw.js').catch(() => {});
