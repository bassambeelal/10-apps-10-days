// Run: node --test day-07-qr-check/test/
const test = require('node:test');
const assert = require('node:assert/strict');
const Q = require('../app/qr-core.js');
const jsQR = require('../app/vendor/jsQR.js');
const qrcode = require('../app/vendor/qrcode.js');
// The app does the same: encode text as UTF-8, so any language scans back as written.
qrcode.stringToBytes = qrcode.stringToBytesFuncs['UTF-8'];

// Draw a code the way the app does (medium error correction, 4-module quiet zone) and read it back.
function roundTrip(text, level) {
  const qr = qrcode(0, level || 'M');
  qr.addData(text, 'Byte');
  qr.make();
  const n = qr.getModuleCount(), q = 4, s = 6, size = (n + q * 2) * s;
  const data = new Uint8ClampedArray(size * size * 4).fill(255);
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
    if (!qr.isDark(r, c)) continue;
    for (let y = 0; y < s; y++) for (let x = 0; x < s; x++) {
      const i = (((r + q) * s + y) * size + (c + q) * s + x) * 4;
      data[i] = data[i + 1] = data[i + 2] = 0;
    }
  }
  const res = jsQR(data, size, size);
  return res && res.data;
}

test('middlemen are named', () => {
  assert.equal(Q.classify('https://qrco.de/bfMenu42').kind, 'qrhost');
  assert.equal(Q.classify('https://menu-qr.example.org/x').kind, 'qrhost', 'qr in the name is probably a QR service');
  assert.equal(Q.classify('https://bit.ly/3menuNG').kind, 'short');
  assert.equal(Q.classify('ouo.io/abc').kind, 'ad');
  assert.equal(Q.classify('https://linktr.ee/lumencafe').kind, 'page');
  const d = Q.classify('https://www.lumencafe.pt/menu');
  assert.equal(d.kind, 'direct');
  assert.equal(d.host, 'lumencafe.pt');
  assert.equal(Q.classify('https://wa.me/351912345678').title, 'Opens a WhatsApp chat');
});

test('preview pages for services that publish them', () => {
  assert.equal(Q.classify('https://bit.ly/3menuNG').preview.href, 'https://bit.ly/3menuNG+');
  assert.equal(Q.classify('https://tinyurl.com/lumenmenu').preview.href, 'https://preview.tinyurl.com/lumenmenu');
  assert.equal(Q.classify('https://is.gd/abc123').preview.href, 'https://is.gd/abc123-');
  assert.equal(Q.classify('https://qrco.de/bfMenu42').preview, null);
  assert.equal(Q.classify('https://bit.ly/').preview, null);
});

test('non-link codes', () => {
  const w = Q.classify('WIFI:T:WPA;S:Lumen Guest;P:flat\\;white;;');
  assert.equal(w.kind, 'wifi');
  assert.match(w.title, /Lumen Guest/);
  assert.equal(Q.classify('tel:+351912345678').title, 'Calls +351912345678');
  assert.equal(Q.classify('mailto:hello@lumencafe.pt?subject=Booking').title, 'Emails hello@lumencafe.pt');
  assert.equal(Q.classify('BEGIN:VCARD\nVERSION:3.0\nFN:Rui Costa\nEND:VCARD').title, 'Saves the contact Rui Costa');
  assert.equal(Q.classify('Table 12').kind, 'text');
});

test('payment codes are read, and a bad checksum is flagged', () => {
  const body = '000201010211' + '26330014br.gov.bcb.pix0111123456789015204000053039865802BR5910LUMEN CAFE6009SAO PAULO6304';
  const good = body + Q.crc16(body);
  const g = Q.classify(good);
  assert.equal(g.kind, 'pay');
  assert.equal(g.title, 'Pays LUMEN CAFE');
  assert.equal(g.warn, false);
  const bad = Q.classify(body + 'ABCD');
  assert.equal(bad.warn, true);
});

test('building codes', () => {
  assert.equal(Q.buildContent('website', { url: 'lumencafe.pt/menu' }), 'https://lumencafe.pt/menu');
  assert.equal(Q.buildContent('whatsapp', { phone: '+351 912 345 678', message: 'Table for 2' }), 'https://wa.me/351912345678?text=Table%20for%202');
  assert.equal(Q.buildContent('wifi', { ssid: 'Lumen Guest', password: 'flat;white', security: 'wpa' }), 'WIFI:T:WPA;S:Lumen Guest;P:flat\\;white;;');
  assert.equal(Q.buildContent('wifi', { ssid: 'Open', security: 'none' }), 'WIFI:T:nopass;S:Open;;');
  assert.equal(Q.buildContent('email', { email: 'hello@lumencafe.pt', subject: 'Booking' }), 'mailto:hello@lumencafe.pt?subject=Booking');
  assert.equal(Q.buildContent('email', { email: 'not an email' }), '');
  assert.equal(Q.buildContent('phone', { phone: '+351 912 345 678' }), 'tel:+351912345678');
  assert.equal(Q.middlemanHost('https://bit.ly/x'), 'bit.ly');
  assert.equal(Q.middlemanHost('https://lumencafe.pt'), null);
});

test('every kind of code made here scans back to exactly the same text', () => {
  [
    'https://lumencafe.pt/menu',
    Q.buildContent('whatsapp', { phone: '+351912345678', message: 'Olá! A table for 2, please' }),
    Q.buildContent('wifi', { ssid: 'Lumen Guest', password: 'flat;white:24', security: 'wpa' }),
    'mailto:hello@lumencafe.pt?subject=Booking',
    'tel:+351912345678',
    'Café Lumen · 午餐 · مرحبا',
  ].forEach((t) => {
    assert.equal(roundTrip(t, 'M'), t, 'medium: ' + t);
    assert.equal(roundTrip(t, 'H'), t, 'high: ' + t);
  });
});
