// Run with: node --test day-01-fair-split/test/
const test = require('node:test');
const assert = require('node:assert/strict');
const FS = require('../app/core.js');
const Sample = require('../app/sample.js');

const sum = (o) => Object.values(o).reduce((a, b) => a + b, 0);

test('an equal split always adds up, and the odd cent moves between people', () => {
  const parts = { aa: 1, bb: 1, cc: 1 };
  const seen = new Set();
  for (let i = 0; i < 30; i++) {
    const sh = FS.shares({ id: 'entry' + i, amount: 100, split: { mode: 'equal', parts } });
    assert.equal(sum(sh), 100);
    assert.deepEqual(Object.values(sh).sort(), [33, 33, 34]);
    seen.add(Object.keys(sh).find((k) => sh[k] === 34));
  }
  assert.equal(seen.size, 3, 'the extra cent should not always land on the same person');
});

test('shares and exact splits', () => {
  const sh = FS.shares({ id: 'x1', amount: 1000, split: { mode: 'shares', parts: { aa: 2, bb: 1 } } });
  assert.deepEqual(sh, { aa: 667, bb: 333 });
  const half = FS.shares({ id: 'x2', amount: 700, split: { mode: 'shares', parts: { aa: 1.5, bb: 2 } } });
  assert.deepEqual(half, { aa: 300, bb: 400 });
  const ex = FS.shares({ id: 'x3', amount: 1000, split: { mode: 'exact', parts: { aa: 250, bb: 750 } } });
  assert.deepEqual(ex, { aa: 250, bb: 750 });
  // A damaged exact split that does not add up is apportioned instead of losing money.
  const bad = FS.shares({ id: 'x4', amount: 1000, split: { mode: 'exact', parts: { aa: 1, bb: 1 } } });
  assert.equal(sum(bad), 1000);
});

function applyPayments(bal, pays) {
  const b = { ...bal };
  for (const p of pays) { b[p.from] += p.amount; b[p.to] -= p.amount; }
  return b;
}

// Independent check: the fewest payments is n minus the most zero-sum groups the people can form.
function bruteMin(values) {
  const n = values.length;
  let best = 0;
  function rec(rest, groups) {
    if (!rest.length) { best = Math.max(best, groups); return; }
    const [first, ...others] = rest;
    const m = others.length;
    for (let mask = 0; mask < (1 << m); mask++) {
      let s = values[first];
      const inG = [], out = [];
      others.forEach((x, i) => { if (mask & (1 << i)) { s += values[x]; inG.push(x); } else out.push(x); });
      if (s === 0) rec(out, groups + 1);
    }
  }
  rec([...Array(n).keys()], 0);
  return n - best;
}

test('settle up finds fewer payments than the greedy method where greedy fails', () => {
  const bal = { aa: 600, bb: 400, cc: -400, dd: -300, ee: -300 };
  const pays = FS.settle(bal);
  assert.equal(pays.length, 3); // greedy pairing would need 4
  assert.ok(Object.values(applyPayments(bal, pays)).every((v) => v === 0));
});

test('settle up is minimal on random books', () => {
  let seed = 7;
  const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
  for (let t = 0; t < 300; t++) {
    const n = 2 + Math.floor(rnd() * 6);
    const vals = [];
    for (let i = 0; i < n - 1; i++) vals.push(Math.round((rnd() - 0.5) * 20) * 50);
    vals.push(-vals.reduce((a, b) => a + b, 0));
    const bal = {};
    vals.forEach((v, i) => { bal['m' + i] = v; });
    const pays = FS.settle(bal);
    assert.ok(Object.values(applyPayments(bal, pays)).every((v) => v === 0), 'payments must settle everyone');
    assert.ok(pays.every((p) => p.amount > 0));
    const nonzero = vals.filter((v) => v !== 0);
    assert.equal(pays.length, bruteMin(nonzero), 'not minimal for ' + JSON.stringify(vals));
  }
});

test('the sample book: balances add to zero, and each working ends on its balance', () => {
  const { book } = Sample.build(FS);
  assert.ok(FS.cleanBook(book), 'the sample passes validation');
  assert.equal(FS.cleanBook(book).events.length, book.events.length);
  const s = FS.fold(book);
  assert.equal(s.name, 'Flat 4B');
  assert.equal(s.members.length, 4);
  const bal = FS.balances(s);
  assert.equal(sum(Object.fromEntries(Object.entries(bal).map(([k, v]) => [k, v.net]))), 0);
  for (const m of s.members) {
    const w = FS.working(s, m.id);
    const end = w.length ? w[w.length - 1].running : 0;
    assert.equal(end, bal[m.id].net, 'working for ' + m.name);
  }
  // The gas bill was corrected: two versions, and the balance uses the newer amount.
  const gas = s.entries.find((e) => e.title === 'Gas bill');
  assert.equal(gas.versions.length, 2);
  assert.equal(gas.amount, 7120);
  // The duplicate pizza is removed but kept.
  const pizzas = s.entries.filter((e) => e.title === 'Pizza night');
  assert.equal(pizzas.length, 2);
  assert.equal(pizzas.filter((e) => e.deleted).length, 1);
  const pays = FS.settle(bal);
  assert.ok(pays.length <= 3);
});

test('copies merge in any order to the same book, and merging twice changes nothing', () => {
  const created = FS.newBook({ name: 'Lisbon weekend', currency: 'EUR', people: ['Ana', 'Ben', 'Chidi'], at: 1767225600000 });
  const [ana, ben, chidi] = created.members.map((m) => m.mid);
  const all = { [ana]: 1, [ben]: 1, [chidi]: 1 };
  const a = { id: created.book.id, events: created.book.events.slice() };
  const b = { id: created.book.id, events: created.book.events.slice() };
  // Ana adds a taxi; Ben adds dinner and corrects the taxi at the same time on his own copy.
  const taxi = FS.entryEvent({ title: 'Taxi from airport', amount: 3600, payer: ana, split: { mode: 'equal', parts: all }, date: '2026-01-01' }, ana, 1767230000000);
  a.events.push(taxi);
  b.events.push(taxi);
  const dinner = FS.entryEvent({ title: 'Dinner', amount: 9000, payer: ben, split: { mode: 'equal', parts: all }, date: '2026-01-01' }, ben, 1767240000000);
  b.events.push(dinner);
  const fix = FS.reviseEntry(FS.fold(b).entryById[taxi.eid], { amount: 3900 }, ben, 1767250000000);
  b.events.push(fix);
  const ab = FS.merge(a, b);
  const ba = FS.merge(b, a);
  assert.equal(ab.added.length, 2);
  assert.equal(ba.added.length, 0);
  const sab = FS.fold(ab.book), sba = FS.fold(ba.book);
  assert.deepEqual(FS.balances(sab), FS.balances(sba));
  assert.equal(sab.entryById[taxi.eid].amount, 3900);
  const again = FS.merge(ab.book, b);
  assert.equal(again.added.length, 0);
  const sum1 = FS.summarize(FS.fold(a), sab, ab.added);
  assert.equal(sum1.newEntries, 1);
  assert.equal(sum1.changed, 1);
});

test('the link round-trips the whole book and refuses junk', async () => {
  const { book, me } = Sample.build(FS);
  const code = await FS.encode(book, me);
  assert.match(code, /^1[A-Za-z0-9_-]+$/);
  const back = await FS.decode(code);
  assert.equal(back.from, me);
  assert.deepEqual(FS.balances(FS.fold(back.book)), FS.balances(FS.fold(book)));
  assert.equal(back.book.events.length, book.events.length);
  assert.equal(FS.findCode('Flat 4B update\nOpen: https://x.github.io/app/#j=' + code + ' thanks'), code);
  await assert.rejects(FS.decode('1not-a-real-book-at-all'));
  await assert.rejects(FS.decode(code.slice(0, Math.floor(code.length / 2))));
  console.log('      sample book link: ' + code.length + ' characters for ' + book.events.length + ' events');
});

test('validation drops bad events from a link', () => {
  assert.equal(FS.cleanEvent({ id: 'abcd1234', t: 'entry', at: Date.now(), by: 'aa', eid: 'abcd1234', kind: 'expense', title: 'x', amount: -5, payer: 'aa', date: '2026-01-01', split: { mode: 'equal', parts: { aa: 1 } } }), null);
  assert.equal(FS.cleanEvent({ id: 'abcd1234', t: 'entry', at: Date.now(), by: 'aa', eid: 'abcd1234', kind: 'expense', title: 'x', amount: 5, payer: 'aa', date: '2026-02-30', split: { mode: 'equal', parts: { aa: 1 } } }), null);
  assert.equal(FS.cleanEvent({ id: 'abcd1234', t: 'member', at: Date.now(), by: 'aa', mid: '<img>', name: 'x' }), null);
  const ok = FS.cleanEvent({ id: 'abcd1234', t: 'entry', at: Date.now(), by: 'aa', eid: 'abcd1234', kind: 'expense', title: '  <b>Lunch</b>  ', amount: 5, payer: 'aa', date: '2026-01-01', split: { mode: 'equal', parts: { aa: 1 } }, extra: 'dropped' });
  assert.equal(ok.title, '<b>Lunch</b>'); // kept as text; the app never renders it as HTML
  assert.equal(ok.extra, undefined);
});

test('amounts typed the way people type them', () => {
  const eur = (s) => FS.parseAmount(s, 'EUR');
  assert.equal(eur('42'), 4200);
  assert.equal(eur('42.1'), 4210);
  assert.equal(eur('42,10'), 4210);
  assert.equal(eur('1,234.56'), 123456);
  assert.equal(eur('1.234,56'), 123456);
  assert.equal(eur('1,234'), 123400);
  assert.equal(eur('€ 12.50 + 3.20'), 1570);
  assert.equal(eur('0.005'), 1);
  assert.ok(Number.isNaN(eur('abc')));
  assert.equal(FS.parseAmount('6,850', 'JPY'), 6850);
  assert.equal(FS.parseAmount('1.250', 'KWD'), 1250);
  assert.equal(FS.minorDigits('JPY'), 0);
  assert.equal(FS.amountInput(4210, 'EUR'), '42.10');
  assert.equal(FS.amountInput(5, 'EUR'), '0.05');
  assert.equal(FS.amountInput(6850, 'JPY'), '6850');
  assert.equal(FS.money(-4210, 'EUR', { locale: 'en-GB', sign: true }), '−€42.10');
  assert.equal(FS.money(4210, 'EUR', { locale: 'en-GB', sign: true }), '+€42.10');
});

test('categories are guessed from the words', () => {
  assert.equal(FS.guessCat('Groceries, Lidl'), 'groceries');
  assert.equal(FS.guessCat('Taxi to the station'), 'transport');
  assert.equal(FS.guessCat('Airbnb in Porto'), 'stay');
  assert.equal(FS.guessCat('Gas bill'), 'utilities');
  assert.equal(FS.guessCat('Something odd'), 'other');
});
