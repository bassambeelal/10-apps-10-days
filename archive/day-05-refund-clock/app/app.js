'use strict';
// Refund Clock: CBN refund deadlines for failed electronic payments, and what to send when they pass.
// Cases live in this browser's localStorage. Nothing is sent anywhere.

const STORE = 'refundclock.v1';
const H = 3_600_000, D = 24 * H;
const main = document.getElementById('main');
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const naira = (n) => new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(n);
const when = (t) => new Date(t).toLocaleString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
const day = (t) => new Date(t).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });

// The CBN letter that sets the refund timelines, and the CBN page that sets the complaint route.
const LETTER = { ref: 'PSM/DIR/CON/CWO/07/127', date: '29 May 2020', from: '8 June 2020', url: 'https://www.cbn.gov.ng/Out/2020/CCD/Press%20Release%20on%20Payment%20Channels.pdf' };
const CPD = { email: 'cpd@cbn.gov.ng', url: 'https://www.cbn.gov.ng/supervision/cpdcomgt.html', bankDays: 14 };

const CHANNELS = {
  'atm-own': { label: 'ATM, my own bank', short: 'ATM withdrawal', long: 'cash withdrawal at my own bank\'s ATM', hours: 24, rule: 'Failed withdrawals on your own bank\'s ATM must be reversed instantly, and a manual reversal may not take longer than 24 hours.' },
  'atm-other': { label: 'ATM, another bank', short: 'ATM withdrawal', long: 'cash withdrawal at another bank\'s ATM', hours: 48, rule: 'Refunds on failed withdrawals at another bank\'s ATM may not take longer than 48 hours.' },
  pos: { label: 'POS payment', short: 'POS payment', long: 'POS card payment', hours: 48, rule: 'Refunds on failed or disputed POS payments must be treated within 48 hours.' },
  web: { label: 'Online card payment', short: 'online payment', long: 'online card payment', hours: 48, rule: 'Refunds on failed or disputed web (online) payments must be treated within 48 hours.' },
  transfer: { label: 'Bank transfer', short: 'transfer', long: 'bank transfer', hours: null, rule: 'We could not confirm a CBN refund deadline for failed transfers, so there is no clock. Give it a day, then complain to your bank: the two-week complaint rule still applies.' },
};

// ---------- store ----------
let db = { cases: [], me: {} };
try { db = { ...db, ...JSON.parse(localStorage.getItem(STORE) || '{}') }; } catch { /* private window */ }
const save = () => { try { localStorage.setItem(STORE, JSON.stringify(db)); } catch { /* ignore */ } };
const uid = () => Math.random().toString(36).slice(2, 9);
let sample = false;

// ---------- the clock: one function decides every date and the next step ----------
function clock(c, now = Date.now()) {
  const ch = CHANNELS[c.channel];
  const due = ch.hours ? c.debitedAt + ch.hours * H : null;
  const bankBy = c.complainedAt ? c.complainedAt + CPD.bankDays * D : null;
  let step, words;
  if (c.refundedAt) { step = 'refunded'; words = `Refunded on ${day(c.refundedAt)}.`; }
  else if (bankBy && now >= bankBy) { step = 'cbn'; words = `The bank had two weeks, until ${when(bankBy)}. Escalate to the CBN now.`; }
  else if (c.complainedAt) { step = 'bank'; words = `You complained on ${day(c.complainedAt)}. The bank has until ${when(bankBy)} to resolve it.`; }
  else if (due && now < due) { step = 'wait'; words = `The refund is due by ${when(due)}. If it hasn't arrived by then, complain to the bank.`; }
  else if (!due && now < c.debitedAt + D) { step = 'wait'; words = 'Give it a day. If the money hasn\'t come back by then, complain to the bank.'; }
  else { step = 'complain'; words = due ? `The refund was due by ${when(due)}. Complain to the bank now.` : 'Complain to the bank now.'; }
  return { ch, due, bankBy, step, words };
}
function span(ms) {
  const a = Math.abs(ms);
  const d = Math.floor(a / D), h = Math.floor((a % D) / H), m = Math.floor((a % H) / 60000);
  if (d) return `${d} day${d === 1 ? '' : 's'} ${h} h`;
  if (h) return `${h} h ${m} m`;
  return `${m} m`;
}
const STATUS = {
  wait: ['Waiting for the refund', 'acc'],
  complain: ['Complain to the bank', 'neg'],
  bank: ['With the bank', 'warn'],
  cbn: ['Escalate to the CBN', 'neg'],
  refunded: ['Refunded', 'pos'],
};

// ---------- messages ----------
function letters(c) {
  const { ch, due } = clock(c);
  const me = db.me || {};
  const acct = c.account ? `my account ending ${c.account}` : 'my account';
  const sign = [me.name || '[Your name]', me.phone || '[Your phone number]', me.email].filter(Boolean).join('\n');
  const detail = c.detail ? ` (${c.detail})` : '';
  const bank = `Subject: Failed ${ch.long} on ${day(c.debitedAt)}: please refund ${naira(c.amount)}

Dear ${c.bank} customer care,

On ${when(c.debitedAt)}, ${acct} was debited ${naira(c.amount)} for a ${ch.long}${detail} that failed. I did not receive the value.
${ch.hours ? `
Under the CBN's timelines for electronic payment channels (letter ${LETTER.ref} of ${LETTER.date}): ${ch.rule} That deadline passed on ${when(due)}.
` : ''}
Please reverse ${naira(c.amount)} to my account and send me a complaint tracking number.

${sign}`;
  const cbn = `Subject: Complaint against ${c.bank}: unresolved failed ${ch.long} of ${naira(c.amount)}

Dear Director, Consumer Protection Department,

I complained to ${c.bank} on ${c.complainedAt ? day(c.complainedAt) : '[date of your complaint]'}${c.tracking ? ` (tracking number ${c.tracking})` : ''} about a failed ${ch.long} on ${when(c.debitedAt)}. More than two weeks have passed and it has not been resolved.

Name: ${me.name || '[Your name]'}
Address: [Your address]
Phone and email: ${[me.phone, me.email].filter(Boolean).join(', ') || '[Your phone and email]'}
Bank: ${c.bank}, ${c.account ? `account ending ${c.account}` : '[account number]'} (I have not included any PIN or password)
Transaction: ${ch.long}${detail}, ${when(c.debitedAt)}
Amount claimed: ${naira(c.amount)}

Attached: my debit alert or statement, and my complaint to the bank.

Please help me recover the amount.

${me.name || '[Your name]'}`;
  return { bank, cbn };
}

// ---------- routing ----------
function route() {
  const [, path = '', id] = location.hash.match(/^#\/?([a-z]*)\/?([^/]*)/) || [];
  document.querySelectorAll('[data-nav]').forEach((a) => {
    const on = (a.dataset.nav === 'cases' && (path === '' || path === 'case')) || a.dataset.nav === path;
    if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
  });
  const open = db.cases.filter((c) => !c.refundedAt).length;
  document.getElementById('nav-count').textContent = open ? String(open) : '';
  if (path === 'new') return renderForm();
  if (path === 'edit') return renderForm(db.cases.find((c) => c.id === id));
  if (path === 'case') { const c = db.cases.find((x) => x.id === id); return c ? renderCase(c) : (location.hash = '#/'); }
  if (!db.cases.length) return renderForm();
  renderList();
}
const crumb = (html) => { document.getElementById('crumb').innerHTML = html; };

// ---------- one case ----------
let tab = 'bank';
function renderCase(c) {
  const k = clock(c);
  const now = Date.now();
  const left = k.due ? k.due - now : null;
  const [label, pill] = STATUS[k.step];
  crumb(`My cases / <b>${esc(c.bank)}, ${naira(c.amount)}</b>`);
  if (k.step === 'cbn') tab = 'cbn';
  const big = k.step === 'refunded' ? 'Refunded'
    : !k.due ? (k.step === 'wait' ? `${span(c.debitedAt + D - now)} to wait` : 'No CBN clock')
    : left > 0 ? `${span(left)} left` : `${span(left)} overdue`;
  const late = k.due && left <= 0 && k.step !== 'refunded';
  const primary = k.step === 'refunded' ? '' : !c.complainedAt
    ? `<button class="btn primary" type="button" data-act="complained">I've complained to the bank</button>`
    : `<button class="btn primary" type="button" data-act="refunded">The money is back</button>`;

  main.innerHTML = `${sample ? '<div class="notice">This is a sample case with made-up details. <a href="#/new" style="text-decoration:underline">Start your own</a></div>' : ''}
  <div class="title-row"><div><h1>${naira(c.amount)} ${esc(k.ch.short)}, ${esc(c.bank)}</h1><p class="sub">${esc(k.words)}</p></div>
    <div class="actions"><a class="btn" href="#/edit/${c.id}">Edit</a>${primary}</div></div>
  <div class="grid">
    <section class="panel clock s5" style="grid-column: span 5" aria-labelledby="h-clock">
      <header><h2 id="h-clock">Refund clock</h2><span class="pill ${pill}">${label}</span></header>
      <p class="big ${late ? 'late' : ''}">${big}</p>
      <p class="when">${k.due ? `Due by <b>${when(k.due)}</b>, ${k.ch.hours} hours after the debit` : esc(k.ch.label)}</p>
      <p class="rule">${esc(k.ch.rule)}${k.ch.hours ? ` Source: CBN letter <a href="${LETTER.url}" rel="noopener">${LETTER.ref}</a>, ${LETTER.date}, in force from ${LETTER.from}.` : ''}</p>
    </section>
    <section class="panel s7" style="grid-column: span 7" aria-labelledby="h-ladder">
      <header><h2 id="h-ladder">From debit to the CBN</h2></header>
      ${ladder(c, k, now)}
    </section>
    <section class="panel s7" style="grid-column: span 7" aria-labelledby="h-msg">
      <header><h2 id="h-msg">What to send</h2></header>
      <div class="tabs" role="tablist"><button type="button" role="tab" data-tab="bank" aria-selected="${tab === 'bank'}">To ${esc(c.bank)}</button><button type="button" role="tab" data-tab="cbn" aria-selected="${tab === 'cbn'}">To the CBN</button></div>
      ${messagePane(c)}
    </section>
    <section class="panel s5" style="grid-column: span 5" aria-labelledby="h-details">
      <header><h2 id="h-details">The case</h2><a class="card-link" href="#/edit/${c.id}">Edit</a></header>
      <dl class="kv">
        <div><dt>Debited</dt><dd>${when(c.debitedAt)}</dd></div>
        <div><dt>Amount</dt><dd>${naira(c.amount)}</dd></div>
        <div><dt>Bank</dt><dd>${esc(c.bank)}${c.account ? `, ending ${esc(c.account)}` : ''}</dd></div>
        <div><dt>Channel</dt><dd>${esc(k.ch.label)}</dd></div>
        ${c.detail ? `<div><dt>Where</dt><dd>${esc(c.detail)}</dd></div>` : ''}
        <div><dt>Complained to the bank</dt><dd>${c.complainedAt ? day(c.complainedAt) : '<span style="color:var(--muted)">Not yet</span>'}</dd></div>
        <div><dt>Tracking number</dt><dd>${c.tracking ? esc(c.tracking) : '<span style="color:var(--muted)">â€“</span>'}</dd></div>
      </dl>
    </section>
  </div>`;
}

function ladder(c, k, now) {
  const rungs = [
    { t: 'Debited', d: `${naira(c.amount)} left your account`, at: c.debitedAt },
    k.due ? { t: 'Refund due', d: `${k.ch.hours} hours, by the CBN's timeline`, at: k.due } : { t: 'Wait a day', d: 'No confirmed CBN deadline for transfers', at: c.debitedAt + D },
    { t: 'Complain to the bank', d: c.complainedAt ? (c.tracking ? `Tracking number ${c.tracking}` : 'Ask for a tracking number') : 'At the branch, by email, or in the app', at: c.complainedAt || null },
    { t: 'The bank\'s two weeks end', d: 'The CBN gives banks 2 weeks to resolve a complaint', at: k.bankBy },
    { t: 'Escalate to the CBN', d: `Email ${CPD.email}, or a letter to the Consumer Protection Department`, at: k.bankBy },
  ];
  if (c.refundedAt) rungs.push({ t: 'Refunded', d: 'Case closed', at: c.refundedAt });
  const doneUpTo = c.refundedAt ? rungs.length : { wait: 1, complain: 2, bank: 3, cbn: 4 }[k.step];
  let html = '';
  let nowPlaced = !!c.refundedAt;
  rungs.forEach((r, i) => {
    if (!nowPlaced && r.at && r.at > now && i >= doneUpTo) { html += `<div class="now-line" aria-label="Now"><i></i><span>Now, ${when(now)}</span></div>`; nowPlaced = true; }
    const cls = i < doneUpTo ? 'done' : i === doneUpTo ? (k.step === 'complain' || k.step === 'cbn' ? 'late' : 'now-step') : '';
    html += `<div class="rung ${cls}"><span class="dot" aria-hidden="true"></span><div><div class="t">${esc(r.t)}</div><div class="d">${esc(r.d)}</div></div><div class="w">${r.at ? when(r.at) : 'â€“'}</div></div>`;
  });
  if (!nowPlaced) html += `<div class="now-line" aria-label="Now"><i></i><span>Now, ${when(now)}</span></div>`;
  return `<div class="ladder">${html}</div>`;
}

function messagePane(c) {
  const L = letters(c);
  const text = tab === 'bank' ? L.bank : L.cbn;
  const subject = text.split('\n')[0].replace('Subject: ', '');
  const body = text.split('\n').slice(2).join('\n');
  const to = tab === 'bank'
    ? `<p class="to">Send it to <b>${esc(c.bank)}</b> through its app, email or a branch, and ask for a tracking number.</p>`
    : `<p class="to">Send it to <b>${CPD.email}</b> or post it to the Director, Consumer Protection Department, CBN, Central Business District, Abuja, with your proof attached. Only after the bank's two weeks have passed (<a href="${CPD.url}" rel="noopener" style="text-decoration:underline">CBN guide</a>).</p>`;
  const missing = !db.me?.name ? `<p class="meta" style="margin-bottom:10px">Add your name and phone under Edit, and they'll be filled in.</p>` : '';
  return `${to}${missing}<pre class="letter" id="letter">${esc(text)}</pre>
    <div class="msg-actions"><button class="btn" type="button" data-act="copy">Copy</button>
    ${tab === 'cbn' ? `<a class="btn" href="mailto:${CPD.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}">Open in email</a>` : `<button class="btn" type="button" data-act="share">Share</button>`}</div>`;
}

// ---------- the list ----------
function renderList() {
  crumb('<b>My cases</b>');
  const rows = [...db.cases].sort((a, b) => (!!a.refundedAt - !!b.refundedAt) || b.debitedAt - a.debitedAt);
  const owed = rows.filter((c) => !c.refundedAt).reduce((s, c) => s + c.amount, 0);
  main.innerHTML = `${sample ? '<div class="notice">These are sample cases with made-up details. <a href="#/new" style="text-decoration:underline">Start your own</a></div>' : ''}
  <div class="title-row"><div><h1>My cases</h1><p class="sub">${owed ? `${naira(owed)} still to come back across ${rows.filter((c) => !c.refundedAt).length} open ${rows.filter((c) => !c.refundedAt).length === 1 ? 'case' : 'cases'}.` : 'Nothing is owed to you right now.'}</p></div><div class="actions"><a class="btn primary" href="#/new">New case</a></div></div>
  <div class="grid">
  <section class="panel s7" style="grid-column: span 7" aria-labelledby="h-cases"><header><h2 id="h-cases">${rows.length} ${rows.length === 1 ? 'case' : 'cases'}</h2></header><div class="table-wrap"><table class="cases"><thead><tr><th>Case</th><th>Status</th><th class="n">Amount</th></tr></thead><tbody>
  ${rows.map((c) => { const k = clock(c); const [label, pill] = STATUS[k.step]; return `<tr>
    <td><a class="name" href="#/case/${c.id}">${esc(c.bank)}, ${esc(k.ch.short)}</a><span class="sub">Debited ${when(c.debitedAt)}</span></td>
    <td><span class="pill ${pill}">${label}</span></td><td class="n">${naira(c.amount)}</td></tr>`; }).join('')}
  </tbody></table></div></section>
  ${rulesPanel()}
  </div>`;
}

function rulesPanel() {
  return `<section class="panel rules s5" style="grid-column: span 5" aria-labelledby="h-rules"><header><h2 id="h-rules">The CBN's refund deadlines</h2></header>
    <dl class="kv">${Object.values(CHANNELS).map((v) => `<div><dt>${esc(v.label)}</dt><dd>${v.hours ? `${v.hours} hours` : '<span style="color:var(--muted);font-weight:400">Not confirmed</span>'}</dd></div>`).join('')}</dl>
    <p class="route">From the CBN letter <a href="${LETTER.url}" rel="noopener">${LETTER.ref}</a> (${LETTER.date}). If the bank doesn't fix it, complain to the bank first and allow 2 weeks; then escalate to the CBN's Consumer Protection Department at ${CPD.email} (<a href="${CPD.url}" rel="noopener">CBN guide</a>).</p></section>`;
}

// ---------- new / edit ----------
const BANKS = ['Access Bank', 'Citibank', 'Ecobank', 'Fidelity Bank', 'First Bank', 'FCMB', 'Globus Bank', 'GTBank', 'Jaiz Bank', 'Keystone Bank', 'Kuda', 'Moniepoint', 'OPay', 'PalmPay', 'Parallex Bank', 'Polaris Bank', 'Providus Bank', 'Stanbic IBTC', 'Standard Chartered', 'Sterling Bank', 'SunTrust Bank', 'Titan Trust Bank', 'Union Bank', 'UBA', 'Unity Bank', 'Wema Bank', 'Zenith Bank'];
const local = (t) => { const d = new Date(t); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 16); };
function renderForm(c) {
  const editing = !!c;
  const me = db.me || {};
  crumb(editing ? `My cases / <b>Edit</b>` : '<b>New case</b>');
  main.innerHTML = `<div class="title-row"><div><h1>${editing ? 'Edit the case' : 'Money left, nothing arrived?'}</h1><p class="sub">${editing ? '' : 'Tell Refund Clock what happened. It works out when the bank must refund you and writes the complaints. Everything stays on this phone.'}</p></div>${!editing && !db.cases.length ? '<div class="actions"><button class="btn" type="button" data-act="sample">See a sample first</button></div>' : ''}</div>
  <form class="form" id="f" novalidate>
    <fieldset><legend>How did you pay?</legend><div class="choices">
      ${Object.entries(CHANNELS).map(([k, v]) => `<label class="choice"><input type="radio" name="channel" value="${k}" ${(c?.channel || 'pos') === k ? 'checked' : ''}><span>${esc(v.label)}<small>${v.hours ? `Refund within ${v.hours} hours` : 'No confirmed CBN deadline'}</small></span></label>`).join('')}
    </div></fieldset>
    <div class="two">
      <div class="field"><label for="f-amt">Amount debited (â‚¦)</label><input class="input" id="f-amt" name="amount" inputmode="decimal" required value="${c?.amount ?? ''}" placeholder="25000"></div>
      <div class="field"><label for="f-at">When were you debited?</label><input class="input" id="f-at" name="at" type="datetime-local" required value="${local(c?.debitedAt ?? Date.now())}" max="${local(Date.now())}"></div>
    </div>
    <div class="two">
      <div class="field"><label for="f-bank">Your bank</label><input class="input" id="f-bank" name="bank" list="banks" required value="${esc(c?.bank ?? '')}" placeholder="For example, GTBank"><datalist id="banks">${BANKS.map((b) => `<option value="${b}">`).join('')}</datalist></div>
      <div class="field"><label for="f-acct">Last 4 digits of your account (optional)</label><input class="input" id="f-acct" name="account" inputmode="numeric" maxlength="4" value="${esc(c?.account ?? '')}"></div>
    </div>
    <div class="field"><label for="f-detail">Where it happened (optional)</label><input class="input" id="f-detail" name="detail" maxlength="80" value="${esc(c?.detail ?? '')}" placeholder="For example, shop name, ATM location or website"></div>
    ${editing ? `<div class="two">
      <div class="field"><label for="f-comp">Date you complained to the bank</label><input class="input" id="f-comp" name="complained" type="date" value="${c.complainedAt ? local(c.complainedAt).slice(0, 10) : ''}"></div>
      <div class="field"><label for="f-track">Tracking number</label><input class="input" id="f-track" name="tracking" maxlength="40" value="${esc(c.tracking ?? '')}"></div></div>` : ''}
    <div class="two">
      <div class="field"><label for="f-name">Your name (for the letters)</label><input class="input" id="f-name" name="name" autocomplete="name" value="${esc(me.name ?? '')}"></div>
      <div class="field"><label for="f-phone">Your phone (for the letters)</label><input class="input" id="f-phone" name="phone" autocomplete="tel" inputmode="tel" value="${esc(me.phone ?? '')}"></div>
    </div>
    <p class="err" id="f-err" role="alert" style="color:var(--negative)"></p>
    <div class="actions"><button class="btn primary" type="submit">${editing ? 'Save' : 'Start the clock'}</button>${editing ? `<a class="btn" href="#/case/${c.id}">Cancel</a><button class="btn" type="button" data-act="delete" data-id="${c.id}" style="color:var(--negative)">Delete case</button>` : db.cases.length ? '<a class="btn" href="#/">Cancel</a>' : ''}</div>
  </form>`;
  document.getElementById('f').addEventListener('submit', (ev) => {
    ev.preventDefault();
    const fd = new FormData(ev.target);
    const err = (m) => { document.getElementById('f-err').textContent = m; };
    const amount = Number(String(fd.get('amount')).replace(/[^\d.]/g, ''));
    const at = new Date(fd.get('at')).getTime();
    const bank = String(fd.get('bank')).trim();
    if (!(amount > 0)) return err('Enter the amount as a number.');
    if (!at) return err('Enter when you were debited.');
    if (at > Date.now() + 60_000) return err('The debit time can\'t be in the future.');
    if (!bank) return err('Enter your bank.');
    const fields = { channel: fd.get('channel'), amount, debitedAt: at, bank, account: String(fd.get('account') || '').replace(/\D/g, '').slice(-4), detail: String(fd.get('detail') || '').trim() };
    if (editing) {
      const comp = fd.get('complained');
      Object.assign(c, fields, { complainedAt: comp ? new Date(`${comp}T09:00`).getTime() : null, tracking: String(fd.get('tracking') || '').trim() });
    } else {
      if (sample) { db.cases = []; sample = false; }
      c = { id: uid(), ...fields, complainedAt: null, tracking: '', refundedAt: null };
      db.cases.push(c);
    }
    db.me = { ...db.me, name: String(fd.get('name') || '').trim(), phone: String(fd.get('phone') || '').trim() };
    if (!sample) save();
    location.hash = `#/case/${c.id}`;
  });
}

function sampleCases() {
  const now = Date.now();
  const at = (daysAgo, h, m) => { const d = new Date(now - daysAgo * D); d.setHours(h, m, 0, 0); return d.getTime(); };
  return [
    { id: 's1', channel: 'pos', amount: 25000, debitedAt: at(3, 14, 32), bank: 'GTBank', account: '4412', detail: 'Mama Put, Allen Avenue', complainedAt: null, tracking: '', refundedAt: null },
    { id: 's2', channel: 'atm-other', amount: 20000, debitedAt: at(19, 9, 5), bank: 'Access Bank', account: '0937', detail: 'Zenith ATM, Ikeja City Mall', complainedAt: at(16, 10, 0), tracking: 'CMP-2026-118734', refundedAt: null },
    { id: 's3', channel: 'web', amount: 7500, debitedAt: at(30, 20, 40), bank: 'Kuda', account: '', detail: 'Airline booking site', complainedAt: at(27, 10, 0), tracking: '', refundedAt: at(24, 12, 0) },
  ];
}

// ---------- events ----------
let toastT;
function toast(m) { document.querySelector('.toast')?.remove(); const t = Object.assign(document.createElement('div'), { className: 'toast', role: 'status', textContent: m }); document.body.append(t); clearTimeout(toastT); toastT = setTimeout(() => t.remove(), 2400); }
document.addEventListener('click', async (ev) => {
  const tb = ev.target.closest('[data-tab]');
  if (tb) { tab = tb.dataset.tab; route(); return; }
  const b = ev.target.closest('[data-act]');
  if (!b) return;
  const id = location.hash.split('/')[2];
  const c = db.cases.find((x) => x.id === id);
  const act = b.dataset.act;
  if (act === 'sample') { sample = true; db.cases = sampleCases(); location.hash = '#/case/s1'; route(); }
  else if (act === 'copy') { try { await navigator.clipboard.writeText(document.getElementById('letter').textContent); toast('Copied'); } catch { toast('Copy failed. Select the text and copy it.'); } }
  else if (act === 'share') { const text = document.getElementById('letter').textContent; if (navigator.share) navigator.share({ text }).catch(() => {}); else { try { await navigator.clipboard.writeText(text); toast('Copied. Paste it into the bank\'s app or email.'); } catch { /* ignore */ } } }
  else if (act === 'complained' && c) { c.complainedAt = Date.now(); if (!sample) save(); toast('Noted. The bank has two weeks from today.'); location.hash = `#/edit/${c.id}`; }
  else if (act === 'refunded' && c) { c.refundedAt = Date.now(); if (!sample) save(); toast('Case closed'); route(); }
  else if (act === 'delete') { const x = db.cases.find((y) => y.id === b.dataset.id); if (x && confirm('Delete this case from this phone?')) { db.cases = db.cases.filter((y) => y !== x); if (!sample) save(); location.hash = '#/'; } }
});
window.addEventListener('hashchange', () => { route(); main.focus({ preventScroll: true }); scrollTo(0, 0); });
setInterval(() => { if (location.hash.startsWith('#/case/')) route(); }, 30_000);

if (new URLSearchParams(location.search).has('sample')) { sample = true; db.cases = sampleCases(); if (!location.hash) location.hash = '#/case/s1'; }
route();
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('sw.js').catch(() => {});
