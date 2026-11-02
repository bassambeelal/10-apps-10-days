// Demo: QR Check (Day 7). Every claim is from the app's README.
const QR_LOGO = '../day-07-qr-check/app/icons/icon-512.png';
window.DEMO = {
  name: 'QR Check', day: 7,
  logo: QR_LOGO,
  theme: { bg: '#150b10', accent: '#d94a86', 'accent-ink': '#ffffff' },
  music: { bpm: 120, chords: ['Dm', 'A#', 'F', 'C'], seed: 7 },
  poster: 13,
  segments: [
    {
      say: 'That QR code on your menu could stop working tomorrow, and nobody would warn you.',
      cap: 'That QR code on your menu could *stop working tomorrow*.',
      do: async (s) => { await s.card({ style: 'accent', kicker: 'Day 7 of 10', lines: ['Your QR code', 'could *stop*', '*working.*'] }); },
    },
    {
      say: 'Many free QR makers send your code through their own server. When the trial ends, every printed copy fails.',
      cap: 'Free QR makers route your code through *their server*.',
      do: async (s) => { await s.card({ style: 'dark', lines: ['Free QR makers', 'hold *the switch*.'], src: 'When a trial ends, the code shows an advert or stops, and every printed copy fails with it.' }); },
    },
    {
      say: 'Meet QR Check. See who really controls your codes.',
      cap: 'Meet *QR Check*.',
      do: async (s) => { await s.card({ style: 'dark', logo: QR_LOGO, lines: [{ text: 'QR Check', size: 'big' }], badges: ['Check', 'Save', 'Make'] }); },
    },
    {
      say: 'Scan a code with the camera, upload a photo, or paste what it says.',
      cap: 'Scan it, upload a photo, or *paste what it says*.',
      do: async (s) => {
        localStorage.setItem('qrc:codes', JSON.stringify([
          { id: 'demo-a', text: 'https://bit.ly/3cafeMenu', label: 'Flyers', savedAt: Date.now() - 3 * 864e5 },
          { id: 'demo-b', text: 'https://yourcafe.com/menu', label: 'Front window', savedAt: Date.now() - 9 * 864e5 },
        ]));
        await s.show('phone', '../day-07-qr-check/app/#/check', '', { x: 600 });
        s.side({ kicker: 'Check', lines: ['Scan, upload', 'or *paste*.'] });
        await s.wait(400);
        await s.type('#q', 'https://qrco.de/bfMenu42', { cps: 20 });
        await s.click('form.paste button[type=submit]');
      },
    },
    {
      say: 'It draws the chain, from the printed code to your page, and marks the middleman who holds the switch.',
      cap: 'It draws the chain and marks *the middleman*.',
      do: async (s) => {
        s.side({ kicker: 'The chain', lines: ['Spot the', '*middleman*.'] });
        await s.wait(300);
        await s.scroll('#result', { top: 60 });
        await s.point((d) => d.querySelectorAll('.chain .node')[1]);
      },
    },
    {
      say: 'This is a hosted QR code. Whoever runs that service decides where it goes, and the fix is spelled out.',
      cap: 'A *hosted QR code*. The fix is spelled out.',
      do: async (s) => {
        s.side({ kicker: 'The verdict', lines: ['Know what', 'to *do next*.'], sub: 'Direct, hosted, short link, ad-gated or link page.' });
        await s.point('.verdict');
        await s.wait(400);
        await s.point('.todo li:nth-child(2)');
      },
    },
    {
      say: 'Save each code with where it is printed.',
      cap: 'Save each code with *where it is printed*.',
      gap: 0.25,
      do: async (s) => {
        s.side({ kicker: 'My codes', lines: ['Every code,', '*one list*.'] });
        await s.click('button::text=Save to My codes');
        await s.type('#where', 'Table tents', { cps: 26 });
        await s.click('.save-box button[type=submit]', { after: 200 });
      },
    },
    {
      say: 'Codes that rely on a middleman go straight to the top, ready to replace.',
      cap: 'The risky ones go *straight to the top*.',
      do: async (s) => {
        s.side({ kicker: 'My codes', lines: ['Replace', '*these first*.'] });
        await s.click('.tabbar a::text=My codes');
        await s.wait(500);
        await s.point('.pill');
        await s.wait(300);
        await s.point('#tally-h');
      },
    },
    {
      say: 'Then make a direct code that nobody else can switch off.',
      cap: 'Make a *direct code*. Nobody can switch it off.',
      gap: 0.3,
      do: async (s) => {
        await s.show('browser', '../day-07-qr-check/app/#/make', 'bassambeelal.github.io/10-apps-10-days/day-07-qr-check');
        await s.wait(300);
        await s.type('#mk-url', 'yourcafe.com/menu', { cps: 18 });
        await s.type('#mk-words', 'Scan for our menu', { cps: 24 });
      },
    },
    {
      say: 'Every code is read back the moment it is drawn, to prove it says exactly what you typed. Then print a sheet of stickers.',
      cap: 'Every code is *read back* to prove it. Then print.',
      do: async (s) => {
        await s.zoom('.sticker-body', 1.45, { fy: 0.55 });
        await s.point('.selfcheck');
        await s.wait(600);
        await s.point('button::text=Print a sheet');
      },
    },
    {
      say: 'QR Check. Free, offline, and no account. Check your codes today.',
      cap: 'Free, offline, no account.',
      gap: 0.8,
      do: async (s) => { await s.card({ style: 'accent', logo: QR_LOGO, kicker: 'Day 7 of 10', lines: [{ text: 'QR Check', size: 'big' }], url: 'bassambeelal.github.io/10-apps-10-days' }); },
    },
  ],
};
