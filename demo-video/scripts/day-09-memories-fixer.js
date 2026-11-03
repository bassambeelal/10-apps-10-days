// Demo: Memories Fixer (Day 9). Every claim is from the app's README. The export is made up
// (demo-video/fixtures/make-memories.py): 143 memories in fifteen cities.
const MF_LOGO = '../day-09-memories-fixer/app/icons/icon-512.png';
window.DEMO = {
  name: 'Memories Fixer', day: 9,
  logo: MF_LOGO,
  theme: { bg: '#231b0c', accent: '#f2b33d', 'accent-ink': '#1a1205' },
  colorScheme: 'dark',
  music: { bpm: 116, chords: ['Am', 'F', 'C', 'G'], seed: 9 },
  prepare: ['python3', 'ROOT/demo-video/fixtures/make-memories.py'],
  poster: 30,
  segments: [
    {
      say: 'Downloaded your Snapchat memories? Every photo and video comes out dated today, with no place.',
      cap: 'Every memory comes out *dated today*, with no place.',
      do: async (s) => { await s.card({ style: 'accent', kicker: 'Day 9 of 10', lines: ['Years of', 'memories, all', 'dated *today*.'] }); },
    },
    {
      say: 'So years of memories land in the wrong spot in Google Photos, and the captions sit in separate files.',
      cap: 'Wrong spot in Google Photos. *Captions in separate files.*',
      do: async (s) => { await s.card({ style: 'dark', lines: ['Wrong dates.', 'No places.', '*Captions apart.*'] }); },
    },
    {
      say: 'Meet Memories Fixer. It puts it all back, and nothing is uploaded.',
      cap: 'Meet *Memories Fixer*.',
      do: async (s) => { await s.card({ style: 'dark', logo: MF_LOGO, lines: [{ text: 'Memories', size: 'big' }, { text: 'Fixer', size: 'big' }], badges: ['Dates', 'Places', 'Captions'] }); },
    },
    {
      say: 'Drop in every ZIP from Snapchat’s email at once. The page streams through them, right on your device.',
      cap: 'Drop in every ZIP at once. *It all stays on your device.*',
      do: async (s) => {
        await s.show('browser', '../day-09-memories-fixer/app/', 'bassambeelal.github.io/10-apps-10-days/day-09-memories-fixer');
        await s.wait(400);
        await s.point('#drop .btn');
        await s.cmd('setFiles', { frame: 'day-09', selector: '#pick', files: ['WORK/mydata~1762100000000.zip', 'WORK/mydata~1762100000000-2.zip'] });
        await s.el('[data-fix]');
        await s.wait(300);
        await s.zoom('.figures', 1.5, { fy: 0.6, top: 60 });
      },
    },
    {
      say: 'Before anything is written, you see what is inside: photos, videos, captions to merge, and memories per year.',
      cap: 'First, *what is inside*: photos, videos, captions, years.',
      do: async (s) => {
        await s.zoom('.years', 1.6, { top: 120 });
        await s.point('.years .y:last-child');
      },
    },
    {
      say: 'Snapchat stores every time in UTC. Each memory gets the local time where it was taken, from the nearest of seven thousand cities.',
      sub: 'Snapchat stores every time in UTC. Each memory gets the local time where it was taken, from the nearest of 7,000 cities.',
      cap: 'Each memory gets *the local time where it was taken*.',
      do: async (s) => {
        await s.zoom('.zone', 1.6, { top: 140 });
        await s.point('.zone', { fx: 0.3, fy: 0.15 });
      },
    },
    {
      say: 'And you see what every file becomes. New Year’s Eve in Sydney, at two minutes to midnight.',
      cap: 'New Year’s Eve in Sydney: *23:58, Sydney time*.',
      do: async (s) => {
        await s.zoom('.preview', 1.55, { fy: 0.2, top: 60 });
        await s.point('.preview tbody tr:first-child .when');
      },
    },
    {
      say: 'One click fixes them all. Dates and places go into the photos, creation times into the videos, and captions go back on.',
      cap: 'One click: *dates, places, captions*. All fixed.',
      do: async (s) => {
        await s.zoom(null, 1, { ms: 700 });
        const folder = s.doc().getElementById('to-folder');
        if (folder) folder.checked = false; // a demo can't pick a folder, so it saves one ZIP
        await s.click('[data-fix]');
        await s.el('a[download]', 20000);
        await s.wait(400);
        await s.zoom('#work', 1.35, { fy: 0.2, top: 60 });
      },
    },
    {
      say: 'Every file name starts with its date, so your memories sort in order, anywhere.',
      cap: 'File names start with the date. *They sort anywhere.*',
      do: async (s) => { await s.card({ style: 'dark', kicker: 'What each file becomes', lines: [{ text: '2024-12-31_23-58-10', size: 'mid' }, { text: '*_F70B1EFF.jpg*', size: 'mid' }], src: 'Taken in Sydney at 23:58 on New Year’s Eve. Not the day you downloaded it.' }); },
    },
    {
      say: 'Memories Fixer. Free, private, and it works offline.',
      cap: 'Free, private, offline.',
      gap: 0.8,
      do: async (s) => { await s.card({ style: 'accent', logo: MF_LOGO, kicker: 'Day 9 of 10', lines: [{ text: 'Memories', size: 'big' }, { text: 'Fixer', size: 'big' }], url: 'bassambeelal.github.io/10-apps-10-days' }); },
    },
  ],
};
