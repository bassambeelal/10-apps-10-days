/* A sample book so people can look around before starting their own: four housemates over October.
   The names, shops and amounts are made up. Built with the same functions the app uses, so every
   figure on screen is computed from these entries, never typed in separately. */
(function (root) {
  'use strict';
  function build(FS) {
    const id = 'sampleflat4b';
    const P = { ines: 'ines1', tom: 'tom12', priya: 'priya', kwame: 'kwame' };
    const all = { ines1: 1, tom12: 1, priya: 1, kwame: 1 };
    const t0 = Date.UTC(2026, 9, 1, 9, 0); // 1 October 2026
    let seq = 0;
    const evId = function () { seq++; return 'smp' + String(seq).padStart(5, '0'); };
    const at = function (day, hour, min) { return Date.UTC(2026, 9, day, hour || 19, min || 0); };
    const events = [
      { id: evId(), t: 'book', at: t0, by: P.ines, name: 'Flat 4B', currency: 'EUR' },
      { id: evId(), t: 'member', at: t0 + 1, by: P.ines, mid: P.ines, name: 'Ines' },
      { id: evId(), t: 'member', at: t0 + 2, by: P.ines, mid: P.tom, name: 'Tom' },
      { id: evId(), t: 'member', at: t0 + 3, by: P.ines, mid: P.priya, name: 'Priya' },
      { id: evId(), t: 'member', at: t0 + 4, by: P.ines, mid: P.kwame, name: 'Kwame' },
    ];
    function add(day, by, f, hour, min) {
      const ev = FS.entryEvent(f, by, at(day, hour, min));
      ev.id = evId();
      if (!f.eid) ev.eid = ev.id;
      events.push(ev);
      return ev;
    }
    const eq = function (parts) { return { mode: 'equal', parts: parts || all }; };

    add(2, P.tom, { title: 'Electricity, September', amount: 9640, payer: P.tom, split: eq(), date: '2026-10-02', cat: 'utilities' });
    add(3, P.ines, { title: 'Groceries, Lidl', amount: 4210, payer: P.ines, split: eq(), date: '2026-10-03', cat: 'groceries' });
    add(5, P.priya, { title: 'Internet, October', amount: 3500, payer: P.priya, split: eq(), date: '2026-10-05', cat: 'internet' });
    add(9, P.kwame, { title: 'Cleaning supplies', amount: 1875, payer: P.kwame, split: eq(), date: '2026-10-09', cat: 'home' });
    add(12, P.ines, { title: 'Groceries, Pingo Doce', amount: 6348, payer: P.ines, split: eq(), date: '2026-10-12', cat: 'groceries' });
    add(15, P.tom, { title: "Dinner for Priya's birthday", amount: 12400, payer: P.tom, split: eq({ ines1: 1, tom12: 1, kwame: 1 }), date: '2026-10-15', cat: 'eating', note: 'Priya was the guest, so the three of us split it.' }, 23, 10);
    add(18, P.priya, { title: 'Toilet paper and bin bags', amount: 1290, payer: P.priya, split: eq(), date: '2026-10-18', cat: 'home' });
    add(20, P.kwame, { kind: 'transfer', title: '', amount: 3000, payer: P.kwame, to: P.ines, date: '2026-10-20' });
    const gas = add(22, P.ines, { title: 'Gas bill', amount: 1720, payer: P.ines, split: eq(), date: '2026-10-22', cat: 'utilities' }, 9, 12);
    // Ines typed 17.20 instead of 71.20 and corrected it a few minutes later. Both versions stay in the history.
    const gasFix = FS.entryEvent({ eid: gas.eid, title: 'Gas bill', amount: 7120, payer: P.ines, split: eq(), date: '2026-10-22', cat: 'utilities' }, P.ines, at(22, 9, 15));
    gasFix.id = evId();
    events.push(gasFix);
    add(25, P.kwame, { title: 'Groceries, Continente', amount: 3865, payer: P.kwame, split: eq(), date: '2026-10-25', cat: 'groceries' });
    add(28, P.tom, { title: 'Water, Sept and Oct', amount: 5400, payer: P.tom, split: { mode: 'shares', parts: { ines1: 2, tom12: 2, priya: 2, kwame: 1 } }, date: '2026-10-28', cat: 'utilities', note: 'Kwame was away for half of it, so he pays one share and everyone else two.' });
    const pizza = add(30, P.tom, { title: 'Pizza night', amount: 2400, payer: P.tom, split: eq(), date: '2026-10-30', cat: 'eating' }, 21, 5);
    // Added twice by mistake; Tom removed the copy. Removed entries stay visible, struck through.
    const dup = add(30, P.tom, { title: 'Pizza night', amount: 2400, payer: P.tom, split: eq(), date: '2026-10-30', cat: 'eating' }, 21, 6);
    const dupGone = FS.entryEvent({ eid: dup.eid, title: 'Pizza night', amount: 2400, payer: P.tom, split: eq(), date: '2026-10-30', cat: 'eating', deleted: true }, P.tom, at(30, 21, 20));
    dupGone.id = evId();
    events.push(dupGone);
    add(31, P.priya, { title: 'Groceries, Lidl', amount: 5130, payer: P.priya, split: eq(), date: '2026-10-31', cat: 'groceries' }, 18, 40);
    void pizza;
    return { book: { id: id, events: events }, me: P.ines };
  }
  if (typeof module !== 'undefined' && module.exports) module.exports = { build: build };
  else root.FairSplitSample = { build: build };
})(typeof globalThis !== 'undefined' ? globalThis : this);
