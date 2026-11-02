'use strict';
// QR Check: decode a QR code, say who sits between the printed code and the destination, and make a direct one.

const $ = (id) => document.getElementById(id);
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

// Hosts that sit between a printed code and the real page. Kept short and only to services known to redirect.
const SHORTENERS = ['bit.ly', 'bitly.com', 'tinyurl.com', 't.co', 'goo.gl', 'ow.ly', 'buff.ly', 'rebrand.ly', 'cutt.ly', 'is.gd', 'v.gd', 'shorturl.at', 'rb.gy', 't.ly', 'tiny.cc', 'lnkd.in', 's.id'];
const QR_HOSTS = ['qrco.de', 'q-r.to', 'l.ead.me', 'scnv.io', 'me-qr.com', 'qrcodechimp.com', 'qr-code-generator.com'];
const AD_GATED = ['adf.ly', 'shorte.st', 'sh.st', 'ouo.io', 'exe.io'];
const LINK_PAGES = ['linktr.ee'];
const WHATSAPP = ['wa.me', 'api.whatsapp.com', 'chat.whatsapp.com'];
const matchHost = (host, list) => list.find((d) => host === d || host.endsWith('.' + d));

// ---------- reading what a code says ----------
function emv(text) {
  // EMVCo merchant QR (NQR and others): two-digit tag, two-digit length, value.
  const out = {};
  let i = 0;
  while (i + 4 <= text.length) {
    const tag = text.slice(i, i + 2); const len = Number(text.slice(i + 2, i + 4));
    if (!Number.isFinite(len)) break;
    out[tag] = text.slice(i + 4, i + 4 + len); i += 4 + len;
  }
  return out;
}

function classify(raw) {
  const text = raw.trim();
  if (/^000201/.test(text)) {
    const t = emv(text);
    return { kind: 'pay', pill: ['Payment code', 'acc'], title: t['59'] ? `Pays ${t['59']}` : 'A payment code', chain: [['Printed code', 'Payment QR'], ['Your bank app', 'reads it directly']],
      say: 'This is a merchant payment code (the EMV standard, used by NQR and others). It is read by your bank app, not opened as a website, so no link service can switch it off.',
      todo: ['Before paying, check that the merchant name your bank app shows matches the shop.', t['60'] ? `The code says the merchant is in ${t['60']}.` : null].filter(Boolean) };
  }
  if (/^WIFI:/i.test(text)) {
    const ssid = (text.match(/S:((?:\\;|[^;])*)/) || [])[1]?.replace(/\\;/g, ';') || 'unnamed';
    return { kind: 'wifi', pill: ['Wi-Fi network', 'pos'], title: `Joins the Wi-Fi network "${ssid}"`, chain: [['Printed code', 'Wi-Fi details'], ['The phone', 'joins the network']],
      say: 'This code holds Wi-Fi details, not a link. Nobody can switch it off, but anyone who scans it gets the password.', todo: ['If the password changes, print a new code.'] };
  }
  if (/^(tel|sms|smsto|mailto):/i.test(text)) {
    const [scheme, rest] = [text.split(':')[0].toLowerCase(), text.slice(text.indexOf(':') + 1).split('?')[0]];
    const what = scheme === 'tel' ? 'Calls' : scheme === 'mailto' ? 'Emails' : 'Texts';
    return { kind: 'contact', pill: ['Direct', 'pos'], title: `${what} ${rest}`, chain: [['Printed code', scheme], ['Directly', rest]], say: 'This code opens the phone\'s own app with the number or address filled in. There is no middleman.', todo: [] };
  }
  if (/^BEGIN:VCARD/i.test(text)) {
    const name = (text.match(/\nFN:(.*)/i) || [])[1]?.trim() || 'a contact';
    return { kind: 'contact', pill: ['Direct', 'pos'], title: `Saves the contact ${name}`, chain: [['Printed code', 'Contact card'], ['The phone', 'saves it']], say: 'This code holds a contact card. There is no middleman.', todo: [] };
  }
  let url;
  try { url = new URL(/^[a-z][a-z0-9+.-]*:/i.test(text) ? text : `https://${text}`); } catch { url = null; }
  if (!url || !/^https?:$/.test(url.protocol) || !url.hostname.includes('.')) {
    return { kind: 'text', pill: ['Plain text', ''], title: 'Just text', chain: [['Printed code', 'Text']], say: 'This code holds plain text, not a link.', todo: [] };
  }
  const host = url.hostname.toLowerCase().replace(/^www\./, '');
  const shown = `${host}${url.pathname === '/' ? '' : url.pathname}`.slice(0, 60);
  const mid = (label, kind, pill, say, todo) => ({ kind, pill, title: `${label}: ${host}`, chain: [['Printed code', 'QR'], ['Middleman', host, 'mid'], ['Then', 'wherever they send it today', 'unknown']], say, todo, url, host });
  let found;
  if ((found = matchHost(host, AD_GATED))) return mid('Ad-gated link', 'ad', ['Ad-gated', 'neg'], `${host} shows an advert page before sending people on. Your customers see ads before your menu.`, ['Open the link once to find the real page, then make a direct code below.']);
  if ((found = matchHost(host, QR_HOSTS)) || (/(^|[.-])qr/.test(host) && !matchHost(host, SHORTENERS))) {
    const sure = !!found;
    return mid(sure ? 'Hosted QR code' : 'Probably a hosted QR code', 'qrhost', ['Middleman', 'neg'],
      `This is a "dynamic" code from ${sure ? 'a QR-generator service' : 'what looks like a QR service'}. Whoever runs ${host} decides where it goes. Some of these services stop the code, or put an advert in front of it, when a free trial or subscription ends, and every printed copy stops with it.`,
      ['Open the link once and note the final page it lands on.', 'Make a direct code to that page below and reprint.', 'Or keep paying the service, and know that the code depends on it.']);
  }
  if ((found = matchHost(host, SHORTENERS))) {
    return mid('Short link', 'short', ['Middleman', 'neg'],
      `The code goes to ${host} first, and ${host} sends people on. Whoever controls the account behind it can change where it goes, and if the account or the service changes its rules, the printed code can stop working or show an advert.${host === 'goo.gl' ? ' Google has wound down goo.gl links, so codes using it may already be failing.' : ''}`,
      ['Open the link once to find the real page.', 'Make a direct code to that page below and reprint.']);
  }
  if (matchHost(host, LINK_PAGES)) return { kind: 'page', pill: ['Link page', 'warn'], title: `Opens a link page on ${host}`, chain: [['Printed code', 'QR'], ['Link page', host, 'mid'], ['Then', 'the links on that page', 'unknown']], url, host, say: `${host} is a page of links that you edit from your own account. It's a middleman you control, as long as you keep the account.`, todo: ['Fine to keep, if the account is yours and you keep access to it.'] };
  if (matchHost(host, WHATSAPP)) return { kind: 'direct', pill: ['Direct', 'pos'], title: 'Opens a WhatsApp chat', chain: [['Printed code', 'QR'], ['WhatsApp', shown]], url, host, say: 'This opens a chat on WhatsApp directly. No link service sits in between.', todo: [] };
  return { kind: 'direct', pill: ['Direct', 'pos'], title: `Goes straight to ${host}`, chain: [['Printed code', 'QR'], ['Website', shown]], url, host, say: `No middleman. The code opens ${host} directly, so it keeps working for as long as that website does, and nobody else can redirect it.`, todo: [] };
}

const known = () => `<div class="known"><h3>Middlemen QR Check recognises</h3><p>${[...QR_HOSTS, ...SHORTENERS, ...AD_GATED].map((d) => `<span>${esc(d)}</span>`).join(' ')}</p><p class="meta">Plus any address with "qr" in its name, flagged as probably a QR service.</p></div>`;

function renderResult(raw, source) {
  const box = $('result');
  if (!raw) {
    box.innerHTML = `<header><h2 id="h-result">What you'll see</h2></header>
      <div class="chain" aria-hidden="true"><div class="node paper"><span class="k">Printed code</span><span class="v">QR</span></div><span class="link hot"></span><div class="node mid"><span class="k">Middleman</span><span class="v">qrco.de</span></div><span class="link"></span><div class="node unknown"><span class="k">Then</span><span class="v">your menu, for now</span></div></div>
      <div class="verdict"><p>Many printed codes don't point at your website. They point at a link service, which then sends people on. That service holds the switch: it can show adverts, or stop the code when a trial ends. QR Check shows whether there's a middleman, and helps you replace it with a direct code.</p>
      <p>Try it with <button class="text-action" type="button" data-try="https://qrco.de/bfMenu42">a hosted QR link</button>, <button class="text-action" type="button" data-try="https://bit.ly/3menuNG">a short link</button> or <button class="text-action" type="button" data-try="https://mamaputkitchen.ng/menu">a direct one</button>.</p></div>${known()}`;
    return;
  }
  const r = classify(raw);
  const chain = r.chain.map(([k, v, cls], i) => `${i ? `<span class="link ${r.chain[i][2] === 'mid' ? 'hot' : ''}" aria-hidden="true"></span>` : ''}<div class="node ${cls || (i === 0 ? 'paper' : '')}"><span class="k">${esc(k)}</span><span class="v">${esc(v)}</span></div>`).join('');
  box.innerHTML = `<header><h2 id="h-result">What's in the code</h2>${source ? `<span class="meta">${esc(source)}</span>` : ''}</header>
    <div class="chain" role="img" aria-label="${esc(r.chain.map((c) => c[1]).join(', then '))}">${chain}</div>
    <div class="verdict"><div class="head"><span class="pill ${r.pill[1]}">${esc(r.pill[0])}</span></div>
      <h3>${esc(r.title)}</h3><p>${esc(r.say)}</p>
      ${r.todo.length ? `<ul class="todo">${r.todo.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>` : ''}
      ${r.url && r.kind !== 'direct' && r.kind !== 'page' ? `<p><button class="text-action" type="button" data-fill="1">Make a direct code instead</button></p>` : ''}
    </div>
    <div class="raw"><b>The code says:</b> ${esc(raw.length > 300 ? raw.slice(0, 300) + '…' : raw)}</div>
    ${['direct', 'contact', 'wifi', 'pay', 'text', 'page'].includes(r.kind) ? known() : ''}`;
}

// ---------- decoding images and the camera ----------
async function decodeFrom(source) {
  if ('BarcodeDetector' in window) {
    try {
      const det = new BarcodeDetector({ formats: ['qr_code'] });
      const codes = await det.detect(source);
      if (codes[0]) return codes[0].rawValue;
    } catch { /* fall through to jsQR */ }
  }
  const w = source.videoWidth || source.naturalWidth || source.width;
  const h = source.videoHeight || source.naturalHeight || source.height;
  if (!w || !h) return null;
  const scale = Math.min(1, 1024 / Math.max(w, h));
  const c = document.createElement('canvas');
  c.width = Math.round(w * scale); c.height = Math.round(h * scale);
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(source, 0, 0, c.width, c.height);
  const img = ctx.getImageData(0, 0, c.width, c.height);
  const res = window.jsQR(img.data, c.width, c.height, { inversionAttempts: 'attemptBoth' });
  return res ? res.data : null;
}

$('file').addEventListener('change', async (ev) => {
  const f = ev.target.files[0]; if (!f) return;
  const img = new Image();
  img.onload = async () => {
    const text = await decodeFrom(img);
    URL.revokeObjectURL(img.src);
    if (text) { $('q').value = text; renderResult(text, 'From your photo'); }
    else $('result').innerHTML = `<header><h2 id="h-result">No code found</h2></header><p>No QR code could be read in that photo. Take it straight on, closer, and in good light.</p>`;
  };
  img.src = URL.createObjectURL(f);
  ev.target.value = '';
});

let stream = null;
async function startCamera() {
  const vf = $('vf'); const video = $('video');
  if (stream) { stopCamera(); return; }
  try {
    stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
  } catch {
    $('vf-hint').textContent = 'The camera is blocked or missing. Upload a photo of the code instead.';
    return;
  }
  video.srcObject = stream; await video.play();
  vf.classList.add('live'); $('cam').textContent = 'Stop the camera';
  const tick = async () => {
    if (!stream) return;
    const text = await decodeFrom(video).catch(() => null);
    if (text) { stopCamera(); $('q').value = text; renderResult(text, 'From the camera'); return; }
    setTimeout(tick, 250);
  };
  tick();
}
function stopCamera() {
  stream?.getTracks().forEach((t) => t.stop()); stream = null;
  $('vf').classList.remove('live'); $('cam').textContent = 'Use the camera';
}
$('cam').addEventListener('click', startCamera);
$('paste').addEventListener('submit', () => renderResult($('q').value.trim(), 'Pasted'));

// ---------- making a direct code ----------
function qrModules(text) {
  const qr = window.qrcode(0, 'M'); // type 0 = smallest that fits; M = 15% error correction, survives a smudge
  qr.addData(text, 'Byte'); qr.make();
  const n = qr.getModuleCount();
  return { n, dark: (r, c) => qr.isDark(r, c) };
}
function svgFor(text, label) {
  const { n, dark } = qrModules(text);
  const q = 4; const size = n + q * 2;
  let d = '';
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (dark(r, c)) d += `M${c + q},${r + q}h1v1h-1z`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" shape-rendering="crispEdges" role="img" aria-label="QR code for ${esc(text)}"><rect width="${size}" height="${size}" fill="#fff"/><path d="${d}" fill="#000"/></svg>`;
}
function target() {
  let v = $('m-url').value.trim();
  if (v && !/^[a-z][a-z0-9+.-]*:/i.test(v)) v = `https://${v}`;
  return v;
}
function renderSticker() {
  const v = target(); const label = $('m-label').value.trim();
  const ok = v.length > 0 && v.length < 1200;
  $('dl-png').disabled = $('dl-svg').disabled = !ok;
  if (!ok) { $('sticker').innerHTML = '<div class="empty">Your code appears here as you type.</div>'; return; }
  let host = ''; try { host = new URL(v).hostname.replace(/^www\./, ''); } catch { /* not a URL */ }
  const warn = host && (matchHost(host, SHORTENERS) || matchHost(host, QR_HOSTS)) ? `<span class="to" style="color:var(--accent-ink)">That's still a middleman link. Use the page it ends on.</span>` : '';
  $('sticker').innerHTML = `${svgFor(v, label)}${label ? `<span class="label">${esc(label)}</span>` : ''}<span class="to">${esc(v.replace(/^https?:\/\//, ''))}</span>${warn}`;
}
['m-url', 'm-label'].forEach((id) => $(id).addEventListener('input', renderSticker));

function download(name, blob) {
  const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: name });
  a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
const fileName = () => { try { return `qr-${new URL(target()).hostname.replace(/^www\./, '')}`; } catch { return 'qr-code'; } };
$('dl-svg').addEventListener('click', () => download(`${fileName()}.svg`, new Blob([svgFor(target())], { type: 'image/svg+xml' })));
$('dl-png').addEventListener('click', () => {
  const { n, dark } = qrModules(target());
  const label = $('m-label').value.trim();
  const px = 16, q = 4, side = (n + q * 2) * px, extra = label ? 64 : 0;
  const c = Object.assign(document.createElement('canvas'), { width: side, height: side + extra });
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height); ctx.fillStyle = '#000';
  for (let r = 0; r < n; r++) for (let col = 0; col < n; col++) if (dark(r, col)) ctx.fillRect((col + q) * px, (r + q) * px, px, px);
  if (label) { ctx.font = '600 36px "DM Sans", sans-serif'; ctx.textAlign = 'center'; ctx.fillText(label, side / 2, side + 36); }
  c.toBlob((b) => download(`${fileName()}.png`, b), 'image/png');
});

document.addEventListener('click', (ev) => {
  const t = ev.target.closest('[data-try]');
  if (t) { $('q').value = t.dataset.try; renderResult(t.dataset.try, 'Example'); return; }
  if (ev.target.closest('[data-fill]')) { $('m-url').focus(); $('m-hint').textContent = 'Open the middleman link once, copy the page it lands on, and paste it here.'; $('make').scrollIntoView({ behavior: 'smooth', block: 'center' }); }
});

const initial = new URLSearchParams(location.search).get('q') || '';
if (initial) $('q').value = initial;
renderResult(initial, initial ? 'From the link' : '');
const make = new URLSearchParams(location.search).get('make');
if (make) { $('m-url').value = make; $('m-label').value = 'Scan for our menu'; }
renderSticker();
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('sw.js').catch(() => {});
