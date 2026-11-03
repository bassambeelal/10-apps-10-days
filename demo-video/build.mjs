// Records one narrated demo video.
//   node demo-video/build.mjs day-01-fair-split
// Needs: Playwright's Chromium, ffmpeg, Python 3 with kokoro-onnx, soundfile, scipy; KOKORO_DIR set to the
// folder holding kokoro-v1.0.onnx and voices-v1.0.bin. Writes <day>/media/demo.mp4, demo-poster.jpg and
// demo.srt (closed captions), or into DEMO.out when the script sets it.
import { createRequire } from 'node:module';
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { cues, toSrt } from './captions.mjs';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const name = process.argv[2];
if (!name) { console.error('usage: node demo-video/build.mjs <day-folder>'); process.exit(1); }
const WORK = path.join(process.env.DEMO_WORK || '/tmp/demo-work', name);
fs.mkdirSync(path.join(WORK, 'frames'), { recursive: true });
const PORT = 8800 + Math.floor(Math.random() * 90);
const log = (...a) => console.log('[' + name + ']', ...a);

// 1. Read the script's narration without running its actions.
const code = fs.readFileSync(path.join(ROOT, 'demo-video/scripts', name + '.js'), 'utf8');
const sandbox = { window: {} };
vm.runInNewContext(code, sandbox);
const DEMO = sandbox.window.DEMO;
const texts = DEMO.segments.map((s) => s.say);

// 2. Narration.
fs.writeFileSync(path.join(WORK, 'tts-in.json'), JSON.stringify({ voice: DEMO.voice || 'af_heart', speed: DEMO.speed || 1.05, texts }));
const t = spawnSync('python3', [path.join(ROOT, 'demo-video/audio.py'), 'tts', path.join(WORK, 'tts-in.json'), path.join(WORK, 'tts-out.json')], { stdio: 'inherit' });
if (t.status) process.exit(t.status);
const voice = JSON.parse(fs.readFileSync(path.join(WORK, 'tts-out.json'), 'utf8'));
const durations = voice.map((v) => v.seconds);
log('narration', durations.reduce((a, b) => a + b, 0).toFixed(1) + 's over', durations.length, 'lines');

// Anything the demo needs made first, such as a made-up export, goes into WORK/data.
if (DEMO.prepare) {
  const pr = spawnSync(DEMO.prepare[0], [...DEMO.prepare.slice(1).map((a) => a.replace(/^ROOT\//, ROOT + '/')), path.join(WORK, 'data')], { stdio: 'inherit' });
  if (pr.status) process.exit(pr.status);
}
const resolveFile = (f) => (f.startsWith('WORK/') ? path.join(WORK, 'data', f.slice(5)) : path.join(ROOT, f));

// 3. Serve the repo and record the stage.
const server = spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1'], { cwd: ROOT, stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 900));
const browser = await chromium.launch({ args: ['--force-color-profile=srgb', '--hide-scrollbars'] });
const context = await browser.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1, locale: DEMO.locale || 'en-GB', timezoneId: DEMO.timezone || 'Europe/London', colorScheme: DEMO.colorScheme || 'light' });
if (DEMO.mocks) {
  const mocks = require(path.join(ROOT, DEMO.mocks));
  await mocks(context);
}
const page = await context.newPage();
const pageErrors = [];
page.on('pageerror', (e) => pageErrors.push(e.message));
let mark = null;
await page.exposeFunction('__mark', () => { mark = Date.now() / 1000; return true; });
await page.exposeFunction('__cmd', async (cmd, args) => {
  if (cmd === 'setFiles') {
    const frame = page.frames().find((f) => f !== page.mainFrame() && f.url().includes(args.frame));
    await frame.setInputFiles(args.selector, args.files.map(resolveFile));
  }
  return true;
});
await page.goto(`http://127.0.0.1:${PORT}/demo-video/stage.html?demo=${name}`);
await page.waitForFunction(() => window.__stageReady === true);
await page.evaluate(() => document.fonts.ready);

const cdp = await context.newCDPSession(page);
const frames = [];
cdp.on('Page.screencastFrame', async ({ data, metadata, sessionId }) => {
  frames.push({ data, ts: metadata.timestamp });
  try { await cdp.send('Page.screencastFrameAck', { sessionId }); } catch (e) { /* closing */ }
});
await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 92, maxWidth: 1920, maxHeight: 1080, everyNthFrame: 1 });
await new Promise((r) => setTimeout(r, 400));
const result = await Promise.race([
  page.evaluate((d) => window.startDemo(d), durations),
  new Promise((_, no) => setTimeout(() => no(new Error('the demo ran past 4 minutes: a step is stuck')), 240000)),
]).catch(async (e) => { console.error(e.message); await browser.close(); server.kill(); process.exit(1); });
await new Promise((r) => setTimeout(r, 300));
await cdp.send('Page.stopScreencast');
await browser.close();
server.kill();
log('recorded', frames.length, 'frames over', result.total.toFixed(1) + 's');
if (result.notes.length) log('timing notes:', result.notes.join('; '));
if (pageErrors.length) log('page errors:', pageErrors.join(' / '));

// 4. Frames to a constant 30 fps video.
const rel = frames.map((f) => ({ data: f.data, t: f.ts - mark })).filter((f, i, arr) => f.t >= 0 || (arr[i + 1] && arr[i + 1].t > 0));
let list = '';
rel.forEach((f, i) => {
  const file = path.join(WORK, 'frames', 'f' + String(i).padStart(6, '0') + '.jpg');
  fs.writeFileSync(file, Buffer.from(f.data, 'base64'));
  const start = Math.max(0, f.t);
  const next = i + 1 < rel.length ? Math.max(0, rel[i + 1].t) : result.total;
  list += `file '${file}'\nduration ${Math.max(0.001, next - start).toFixed(4)}\n`;
});
list += `file '${path.join(WORK, 'frames', 'f' + String(rel.length - 1).padStart(6, '0') + '.jpg')}'\n`;
fs.writeFileSync(path.join(WORK, 'frames.txt'), list);
const v = spawnSync('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', path.join(WORK, 'frames.txt'), '-vf', 'fps=30,format=yuv420p', '-c:v', 'libx264', '-preset', 'slow', '-crf', '20', '-movflags', '+faststart', path.join(WORK, 'video.mp4')], { stdio: 'inherit' });
if (v.status) process.exit(v.status);

// 5. Narration at the moments the stage started each line, with the music bed.
fs.writeFileSync(path.join(WORK, 'mix-in.json'), JSON.stringify({ total: result.total, segments: voice.map((s, i) => ({ wav: s.wav, start: result.starts[i] })), music: DEMO.music || {} }));
const m = spawnSync('python3', [path.join(ROOT, 'demo-video/audio.py'), 'mix', path.join(WORK, 'mix-in.json'), path.join(WORK, 'mix.wav')], { encoding: 'utf8' });
if (m.status) { console.error(m.stderr); process.exit(m.status); }
log('audio', m.stdout.trim());

// Master to -14 LUFS, true peak under -1 dBTP, the level video sites play at: measure, then apply linearly.
const LN = 'loudnorm=I=-14:TP=-1.0:LRA=11';
const probe = spawnSync('ffmpeg', ['-hide_banner', '-nostats', '-i', path.join(WORK, 'mix.wav'), '-af', LN + ':print_format=json', '-f', 'null', '-'], { encoding: 'utf8' });
const meas = JSON.parse(probe.stderr.slice(probe.stderr.lastIndexOf('{'), probe.stderr.lastIndexOf('}') + 1));
const master = spawnSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', path.join(WORK, 'mix.wav'), '-af',
  `${LN}:measured_I=${meas.input_i}:measured_TP=${meas.input_tp}:measured_LRA=${meas.input_lra}:measured_thresh=${meas.input_thresh}:offset=${meas.target_offset}:linear=true`,
  '-ar', '48000', path.join(WORK, 'master.wav')], { stdio: 'inherit' });
if (master.status) process.exit(master.status);
log('master', `from ${meas.input_i} LUFS to -14 LUFS`);

// 6. Mux.
const outDir = path.join(ROOT, DEMO.out || path.join(name, 'media'));
fs.mkdirSync(outDir, { recursive: true });
const out = path.join(outDir, 'demo.mp4');
const x = spawnSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', path.join(WORK, 'video.mp4'), '-i', path.join(WORK, 'master.wav'), '-map', '0:v', '-map', '1:a', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-shortest', '-movflags', '+faststart', out], { stdio: 'inherit' });
if (x.status) process.exit(x.status);
spawnSync('ffmpeg', ['-y', '-loglevel', 'error', '-ss', String(DEMO.poster || 3), '-i', out, '-frames:v', '1', '-q:v', '3', path.join(outDir, 'demo-poster.jpg')]);
fs.writeFileSync(path.join(outDir, 'demo.srt'), toSrt(cues(DEMO, result.starts, durations)));
const size = fs.statSync(out).size;
log('wrote', path.relative(ROOT, out), (size / 1e6).toFixed(1) + ' MB');
