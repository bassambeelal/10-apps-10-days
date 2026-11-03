// The opening of the joined YouTube video (demo-video/compile.mjs). Saved to demo-video/out/, not committed.
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
  out: 'demo-video/out/youtube-intro',
  theme: { bg: '#0d0f14', accent: '#7c5cff', 'accent-ink': '#ffffff' },
  music: { bpm: 118, chords: ['Am', 'F', 'C', 'G'], seed: 21 },
  poster: 6,
  tail: 2.0,
  segments: [
    {
      say: 'Ten apps in ten days. Each one fixes a problem people have everywhere.',
      cap: 'Ten apps in ten days. *Each one fixes a real problem.*',
      do: async (s) => { await s.card({ style: 'accent', kicker: 'A build-in-public challenge', lines: [{ text: '10 apps.', size: 'big' }, { text: '10 days.', size: 'big' }] }); },
    },
    {
      say: 'Here are the five that run in your browser. All free, with no sign-up.',
      cap: 'The five web apps. *Free, no sign-up.*',
      gap: 0.6,
      do: async (s) => { await s.card({ style: 'dark', kicker: 'The web apps', lines: [{ text: 'Five apps, *one minute each.*', size: 'mid' }], logos: APPS }); },
    },
  ],
};
