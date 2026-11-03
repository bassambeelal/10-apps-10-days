// The close of the joined YouTube video (demo-video/compile.mjs). Saved to demo-video/out/, not committed.
const APPS = [
  { src: '../day-01-fair-split/app/icons/icon-512.png', name: 'Fair Split' },
  { src: '../day-03-citation-check/app/icons/icon-512.png', name: 'Citation Check' },
  { src: '../day-05-hidden-text-finder/app/icons/icon-512.png', name: 'Hidden Text Finder' },
  { src: '../day-07-qr-check/app/icons/icon-512.png', name: 'QR Check' },
  { src: '../day-09-memories-fixer/app/icons/icon-512.png', name: 'Memories Fixer' },
];
window.DEMO = {
  name: '10 Apps in 10 Days', day: 0,
  logo: APPS[0].src,
  out: 'demo-video/out/youtube-outro',
  theme: { bg: '#0d0f14', accent: '#7c5cff', 'accent-ink': '#ffffff' },
  music: { bpm: 118, chords: ['Am', 'F', 'C', 'G'], seed: 22 },
  poster: 3,
  tail: 2.6,
  segments: [
    {
      say: 'Try all five for free. The links are in the description.',
      cap: 'Try all five. *Links in the description.*',
      do: async (s) => { await s.card({ style: 'dark', lines: [{ text: 'Try all five.', size: 'mid' }], logos: APPS, url: 'bassambeelal.github.io/10-apps-10-days' }); },
    },
    {
      say: 'The five Android apps are next. Subscribe so you don’t miss them.',
      cap: 'The Android apps are next. *Subscribe.*',
      gap: 0.8,
      do: async (s) => { await s.card({ style: 'accent', kicker: '10 apps in 10 days', lines: [{ text: 'Android apps', size: 'big' }, { text: '*next.*', size: 'big' }] }); },
    },
  ],
};
