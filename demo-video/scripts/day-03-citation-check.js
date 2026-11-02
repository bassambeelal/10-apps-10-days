// Demo: Citation Check (Day 3). Every claim is from the app's README. Crossref and OpenAlex are answered
// from the app's test fixtures (demo-video/mocks/citation.js), because the recording machine can't reach them.
const CC_LOGO = '../day-03-citation-check/app/icons/icon-512.png';
window.DEMO = {
  name: 'Citation Check', day: 3,
  logo: CC_LOGO,
  theme: { bg: '#11141a', accent: '#e0533d', 'accent-ink': '#ffffff' },
  music: { bpm: 112, chords: ['Cm', 'G#', 'D#', 'A#'], seed: 3 },
  mocks: 'demo-video/mocks/citation.js',
  poster: 26,
  segments: [
    {
      say: 'AI tools invent references that look exactly like real ones: plausible authors, a real journal, sometimes even a real DOI.',
      cap: 'AI invents references that look *exactly like real ones*.',
      do: async (s) => { await s.card({ style: 'accent', kicker: 'Day 3 of 10', lines: ['That reference', 'looks real.', '*It isn’t.*'] }); },
    },
    {
      say: 'In court, lawyers have been sanctioned for citing cases that do not exist. And checking forty references by hand takes an afternoon.',
      cap: 'Lawyers have been *sanctioned* for cases that don’t exist.',
      do: async (s) => { await s.card({ style: 'dark', lines: ['Fake cases.', '*Real sanctions.*'], src: 'And checking a list of 40 references by hand takes an afternoon.' }); },
    },
    {
      say: 'Meet Citation Check. Paste a list, and it checks every single reference.',
      cap: 'Meet *Citation Check*.',
      do: async (s) => { await s.card({ style: 'dark', logo: CC_LOGO, lines: [{ text: 'Citation Check', size: 'big' }], badges: ['Any style', 'Crossref and OpenAlex', 'Court cases'] }); },
    },
    {
      say: 'Paste a list in any style. A P A, Harvard, M L A, Vancouver, even BibTeX.',
      cap: 'Paste a list in *any style*.',
      do: async (s) => {
        await s.show('browser', '../day-03-citation-check/app/', 'bassambeelal.github.io/10-apps-10-days/day-03-citation-check');
        await s.wait(300);
        await s.click('button::text=Try a sample list');
        await s.wait(300);
        await s.zoom('textarea', 1.3, { fy: 0.45 });
        await s.point('.paste-foot .count');
      },
    },
    {
      say: 'Each reference is looked up in Crossref and OpenAlex, one by one.',
      cap: 'Every reference, looked up in *Crossref and OpenAlex*.',
      gap: 0.3,
      do: async (s) => {
        await s.zoom(null, 1, { ms: 600 });
        await s.click('.paste-foot .btn-primary');
        await s.el((d) => d.querySelector('.ref') && !d.querySelector('.spinner') ? d.querySelector('#verdict') : null, 30000);
      },
    },
    {
      say: 'And the verdict leads. Eight references. Two can\u2019t be found.',
      cap: '*8 references. 2 can\u2019t be found.*',
      do: async (s) => {
        s.hideCursor();
        await s.scroll(0, { ms: 600 });
        await s.zoom('#verdict', 1.8, { fx: 0.5, top: 60, ms: 900 });
      },
    },
    {
      say: 'A real DOI attached to an invented paper is caught, and you see what that DOI really points to.',
      cap: 'A real DOI on an invented paper: *caught*.',
      do: async (s) => {
        await s.zoom('.ref.wrongdoi', 1.45);
        await s.point('.ref.wrongdoi .pill');
      },
    },
    {
      say: 'Small slips are spelled out. You wrote twenty seventeen; the record says twenty fifteen.',
      cap: 'Slips are spelled out: *you wrote 2017; the record says 2015*.',
      do: async (s) => {
        await s.zoom('.ref.close', 1.5);
        await s.point((d) => [...d.querySelectorAll('.ref.close *')].find((e) => e.children.length < 3 && /You wrote/.test(e.textContent)));
      },
    },
    {
      say: 'And court citations link straight to CourtListener, so a real case opens, and a made-up one finds nothing.',
      cap: 'Court citations open on *CourtListener*.',
      do: async (s) => {
        await s.zoom('.ref.legal', 1.5);
        await s.point('.ref.legal a');
      },
    },
    {
      say: 'Citation Check. Free, no sign-up, and nothing is stored. Check your references today.',
      cap: 'Free, no sign-up, nothing stored.',
      gap: 0.8,
      do: async (s) => { await s.card({ style: 'accent', logo: CC_LOGO, kicker: 'Day 3 of 10', lines: [{ text: 'Citation Check', size: 'big' }], url: 'bassambeelal.github.io/10-apps-10-days' }); },
    },
  ],
};
