// Demo: Fair Split (Day 1). Every claim is from the app's README.
window.DEMO = {
  name: 'Fair Split', day: 1,
  logo: '../day-01-fair-split/app/icons/icon-512.png',
  theme: { bg: '#0d1117', accent: '#2f6fd6', 'accent-ink': '#ffffff' },
  music: { bpm: 114, chords: ['Am', 'F', 'C', 'G'], seed: 11 },
  poster: 9,
  segments: [
    {
      say: 'Splitting costs with housemates? Some apps now cap free users at a few expenses a day.',
      cap: 'Splitting costs? Some apps now cap free users at *a few expenses a day*.',
      do: async (s) => { await s.card({ style: 'accent', kicker: 'Day 1 of 10', lines: ['Splitting costs?', 'The free apps', 'now *cap you*.'] }); },
    },
    {
      say: 'Meet Fair Split. No sign-up, no daily limits, and no server.',
      cap: 'Meet *Fair Split*.',
      do: async (s) => { await s.card({ style: 'dark', logo: '../day-01-fair-split/app/icons/icon-512.png', lines: [{ text: 'Fair Split', size: 'big' }], badges: ['No sign-up', 'No limits', 'No server'] }); },
    },
    {
      say: 'Every book shows where everyone stands, at a glance.',
      do: async (s) => {
        await s.show('browser', '../day-01-fair-split/app/#/sample', 'bassambeelal.github.io/10-apps-10-days/day-01-fair-split');
        await s.wait(500);
        await s.point('.lead-value');
        await s.zoom('.balances', 1.35, { ms: 1200 });
      },
    },
    {
      say: 'Tap anyone, and their balance shows its working, line by line, down to the cent.',
      cap: 'Tap anyone: their balance *shows its working*, line by line.',
      do: async (s) => {
        await s.click('.bal-row:nth-child(2) .bal-btn');
        await s.wait(700);
        await s.zoom('.working', 1.55, { fy: 0.35 });
        await s.point('.w-total .run');
      },
    },
    {
      say: 'Adding an expense takes seconds: the amount, what it was for, and who paid.',
      cap: 'Add an expense *in seconds*.',
      gap: 0.25,
      do: async (s) => {
        s.zoom(null, 1, { ms: 700, wait: false });
        await s.click('.bar-add');
        await s.wait(300);
        await s.type('#f-amount', '48.20', { cps: 14 });
        await s.type('#f-title', 'Groceries, Lidl', { cps: 26 });
      },
    },
    {
      say: 'Split it equally, by shares, or in exact amounts.',
      cap: 'Split it *equally, by shares, or exact amounts*.',
      do: async (s) => {
        await s.click('.seg button::text=By shares');
        await s.wait(250);
        await s.click('button[aria-label="More shares for Tom"]');
        await s.wait(450);
        await s.click('.sheet-foot .btn-primary');
      },
    },
    {
      say: 'Then it works out the fewest payments that square everyone.',
      cap: 'It finds *the fewest payments* that square everyone.',
      do: async (s) => {
        await s.wait(300);
        await s.click('.nav a::text=Settle up');
        await s.wait(600);
        await s.zoom('.pay-row', 1.5, { fx: 0.5 });
      },
    },
    {
      say: 'And your group chat carries the updates. The whole book travels inside a link, so nothing sits on a server.',
      cap: 'Your group chat carries the updates. *Nothing sits on a server.*',
      do: async (s) => {
        await s.zoom(null, 1, { ms: 800 });
        await s.click('.bar-actions .btn-secondary');
        await s.wait(900);
        const l = s.doc().querySelector('.message .lnk');
        if (l) l.textContent = l.textContent.replace(/^https?:\/\/127\.0\.0\.1:\d+\//, 'https://bassambeelal.github.io/10-apps-10-days/');
        await s.zoom('.message', 1.4);
      },
    },
    {
      say: 'Fair Split. Free, private, and fair. Try it today.',
      cap: 'Free, private, and fair.',
      gap: 0.8,
      do: async (s) => { await s.card({ style: 'accent', logo: '../day-01-fair-split/app/icons/icon-512.png', kicker: 'Day 1 of 10', lines: [{ text: 'Fair Split', size: 'big' }], url: 'bassambeelal.github.io/10-apps-10-days' }); },
    },
  ],
};
