// Joins the five demos into one YouTube video, with an intro and outro, and writes everything an upload
// needs into youtube/: the video, closed captions, chapters, title and description, and a thumbnail.
//   node demo-video/build.mjs youtube-intro && node demo-video/build.mjs youtube-outro   (once)
//   node demo-video/compile.mjs
import { createRequire } from 'node:module';
import { spawnSync, spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
const require = createRequire(import.meta.url);

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const OUT = path.join(ROOT, 'youtube');
const SITE = 'https://bassambeelal.github.io/10-apps-10-days/';
const REPO = 'https://github.com/bassambeelal/10-apps-10-days';
fs.mkdirSync(OUT, { recursive: true });

// Every claim here is from the app's README.
const APPS = [
  { day: 1, name: 'Fair Split', dir: 'day-01-fair-split', chapter: 'split shared costs, no daily limits',
    short: 'Split costs with housemates or a trip group. No sign-up, no daily limits and no server: the whole book travels inside a link you send to the group chat.' },
  { day: 3, name: 'Citation Check', dir: 'day-03-citation-check', chapter: 'catch made-up references',
    short: 'Paste a reference list in any style and every reference is checked against Crossref and OpenAlex. It catches papers that don’t exist, a real DOI attached to the wrong paper, and wrong years. Court citations link to CourtListener.' },
  { day: 5, name: 'Hidden Text Finder', dir: 'day-05-hidden-text-finder', chapter: 'see the hidden text in CVs',
    short: 'Drop in CVs (PDF or Word) and see the white, microscopic and off-page text written for AI screeners, painted back where it sits. Files are read in your browser and never uploaded.' },
  { day: 7, name: 'QR Check', dir: 'day-07-qr-check', chapter: 'who controls your QR code?',
    short: 'Scan or paste a QR code and see whether a link service sits between the code and your page, holding the switch. Then make a direct code that never expires.' },
  { day: 9, name: 'Memories Fixer', dir: 'day-09-memories-fixer', chapter: 'fix your Snapchat Memories export',
    short: 'Puts the dates, places and captions back on your Snapchat Memories download, in the local time where each one was taken, ready for Google Photos. Nothing is uploaded.' },
];
const appUrl = (a) => SITE + a.dir + '/app/';

const parts = [
  { file: 'demo-video/out/youtube-intro/demo.mp4', srt: 'demo-video/out/youtube-intro/demo.srt', chapter: 'Ten apps in ten days' },
  ...APPS.map((a) => ({ file: a.dir + '/media/demo.mp4', srt: a.dir + '/media/demo.srt', chapter: a.name + ': ' + a.chapter })),
  { file: 'demo-video/out/youtube-outro/demo.mp4', srt: 'demo-video/out/youtube-outro/demo.srt', chapter: 'Try all five' },
];
for (const p of parts) if (!fs.existsSync(path.join(ROOT, p.file))) { console.error('missing ' + p.file + ' (render it first)'); process.exit(1); }

const duration = (f) => parseFloat(spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', path.join(ROOT, f)], { encoding: 'utf8' }).stdout);
let t = 0;
for (const p of parts) { p.start = t; p.seconds = duration(p.file); t += p.seconds; }

// 1. The video: the parts end to end, re-encoded together so the joins are clean.
const video = path.join(OUT, '10-apps-in-10-days-web-apps.mp4');
const inputs = parts.flatMap((p) => ['-i', path.join(ROOT, p.file)]);
const filter = parts.map((_, i) => `[${i}:v][${i}:a]`).join('') + `concat=n=${parts.length}:v=1:a=1[v][a]`;
const enc = spawnSync('ffmpeg', ['-y', '-loglevel', 'error', ...inputs, '-filter_complex', filter, '-map', '[v]', '-map', '[a]',
  '-c:v', 'libx264', '-preset', 'slow', '-crf', '20', '-pix_fmt', 'yuv420p', '-r', '30', '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-movflags', '+faststart', video], { stdio: 'inherit' });
if (enc.status) process.exit(enc.status);

// 2. Closed captions: each part's captions, moved to where the part starts.
const stamp = (s) => { const ms = Math.round(s * 1000), p = (n, w) => String(n).padStart(w, '0'); return `${p(Math.floor(ms / 3600000), 2)}:${p(Math.floor(ms / 60000) % 60, 2)}:${p(Math.floor(ms / 1000) % 60, 2)},${p(ms % 1000, 3)}`; };
const secs = (s) => { const [h, m, rest] = s.split(':'); const [sec, ms] = rest.split(','); return +h * 3600 + +m * 60 + +sec + +ms / 1000; };
let n = 0;
const srt = parts.flatMap((p) => fs.readFileSync(path.join(ROOT, p.srt), 'utf8').trim().split(/\n\s*\n/).map((block) => {
  const [, times, ...text] = block.split('\n');
  const [a, b] = times.split(' --> ');
  return `${++n}\n${stamp(secs(a) + p.start)} --> ${stamp(secs(b) + p.start)}\n${text.join('\n')}\n`;
})).join('\n');
fs.writeFileSync(path.join(OUT, '10-apps-in-10-days-web-apps.srt'), srt);

// 3. Title, description with chapters, tags; and one for each app on its own.
const clock = (s) => { s = Math.floor(s); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
const chapters = parts.map((p, i) => clock(i === 0 ? 0 : p.start) + ' ' + p.chapter).join('\n');
const description = `Ten apps in ten days, each one fixing a problem people have everywhere. These are the five that run in your browser: free, no sign-up, nothing to install.

Try them:
${APPS.map((a) => '▶ ' + a.name + ': ' + appUrl(a)).join('\n')}

All the apps: ${SITE}
The code: ${REPO}

Chapters
${chapters}

What each one does
${APPS.map((a) => a.name + ': ' + a.short).join('\n\n')}

The five Android apps are next.

Every demo is recorded from the real app. Narration is an open-source synthetic voice (Kokoro).

#buildinpublic #webapps #productivity`;
const title = 'I Built 10 Apps in 10 Days: The 5 Web Apps (Free, No Sign-Up)';
const tags = ['build in public', '10 apps in 10 days', 'web apps', 'free apps', 'no sign up', 'split bills app', 'citation checker', 'fake references', 'hidden text in resume', 'AI resume screening', 'QR code checker', 'dynamic QR code', 'Snapchat memories', 'Snapchat memories dates', 'PWA'];
fs.writeFileSync(path.join(OUT, 'description.txt'), description + '\n');

const single = APPS.map((a) => `### Day ${a.day}: ${a.name}

- **Video:** [${a.dir}/media/demo.mp4](../${a.dir}/media/demo.mp4)
- **Captions:** [${a.dir}/media/demo.srt](../${a.dir}/media/demo.srt)
- **Title:** ${a.name}: ${a.chapter.charAt(0).toUpperCase() + a.chapter.slice(1)} (free web app)

\`\`\`
${a.short}

Try it free: ${appUrl(a)}
All 10 apps: ${SITE}
The code: ${REPO}

Day ${a.day} of 10 apps in 10 days. Recorded from the real app; narration is an open-source synthetic voice (Kokoro).

#buildinpublic #webapps
\`\`\`
`).join('\n');

fs.writeFileSync(path.join(OUT, 'README.md'), `# YouTube upload kit

Everything needed to post the five web-app demos, as one video or one at a time. Rebuild it with \`node demo-video/compile.mjs\` after a demo changes.

## The joined video (${clock(t)})

| File | What it is |
| --- | --- |
| [10-apps-in-10-days-web-apps.mp4](10-apps-in-10-days-web-apps.mp4) | 1080p, 30 fps, about -14 LUFS: intro, the five demos, outro |
| [10-apps-in-10-days-web-apps.srt](10-apps-in-10-days-web-apps.srt) | English closed captions, timed to the narration |
| [thumbnail.jpg](thumbnail.jpg) | 1280×720 custom thumbnail |
| [description.txt](description.txt) | the description below, ready to paste |

**Title:** ${title}

Other titles that fit: "5 Free Web Apps That Fix Real Problems (Built in 10 Days)", "10 Apps in 10 Days: Part 1, the Web Apps".

**Description:**

\`\`\`
${description}
\`\`\`

**Tags:** ${tags.join(', ')}

**In YouTube Studio:**
1. Upload the video, paste the title and description, and set the thumbnail.
2. Subtitles: Add language, English, then Upload file, "With timing", and choose the .srt file.
3. The chapters come from the timestamps in the description; they start at 0:00, so YouTube picks them up.
4. "Altered or synthetic content": the narration is a synthetic voice, but it isn't anyone real and nothing shown is altered, so YouTube's rules don't ask for the label. Tick it anyway if you'd rather.

## Each app on its own

Each video already has its captions burned in as short on-screen lines; the .srt gives the full narration as closed captions.

${single}`);

// 4. Thumbnail.
const { chromium } = require('playwright');
const PORT = 8890 + Math.floor(Math.random() * 9);
const server = spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1'], { cwd: ROOT, stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 800));
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
await page.goto(`http://127.0.0.1:${PORT}/demo-video/thumbnail.html`);
await page.evaluate(() => document.fonts.ready);
await page.waitForTimeout(300);
await page.screenshot({ path: path.join(OUT, 'thumbnail.jpg'), type: 'jpeg', quality: 92 });
await browser.close();
server.kill();

console.log('wrote youtube/: ' + clock(t) + ' video, ' + n + ' captions, ' + parts.length + ' chapters, description, thumbnail');
console.log(chapters);
