/* QR Check core: read what a code says, name who sits between the printed code and the destination,
   and build the text for new codes. No DOM: it runs in the browser and under Node for the tests. */
(function (root) {
  'use strict';

  // Hosts that sit between a printed code and the real page. Kept to services known to redirect.
  const SHORTENERS = ['bit.ly', 'bitly.com', 'tinyurl.com', 't.co', 'goo.gl', 'ow.ly', 'buff.ly', 'rebrand.ly', 'cutt.ly', 'is.gd', 'v.gd', 'shorturl.at', 'rb.gy', 't.ly', 'tiny.cc', 'lnkd.in', 's.id'];
  const QR_HOSTS = ['qrco.de', 'q-r.to', 'l.ead.me', 'scnv.io', 'me-qr.com', 'qrcodechimp.com', 'qr-code-generator.com', 'qrfy.io', 'qr.io', 'uqr.me', 'qrs.ly'];
  const AD_GATED = ['adf.ly', 'shorte.st', 'sh.st', 'ouo.io', 'exe.io'];
  const LINK_PAGES = ['linktr.ee', 'beacons.ai', 'linkin.bio', 'bio.link'];
  const WHATSAPP = ['wa.me', 'api.whatsapp.com', 'chat.whatsapp.com'];
  const matchHost = (host, list) => list.find((d) => host === d || host.endsWith('.' + d));

  // Services that publish their own preview page, which shows where a link goes without visiting it.
  function previewLink(url) {
    if (!url) return null;
    const host = url.hostname.toLowerCase().replace(/^www\./, '');
    const path = url.pathname.replace(/^\/+|\/+$/g, '');
    if (!path) return null;
    if (host === 'bit.ly' || host === 'bitly.com') return { href: 'https://bit.ly/' + path + '+', by: 'Bitly' };
    if (host === 'tinyurl.com') return { href: 'https://preview.tinyurl.com/' + path, by: 'TinyURL' };
    if (host === 'is.gd' || host === 'v.gd') return { href: 'https://' + host + '/' + path + '-', by: host };
    return null;
  }

  // EMVCo merchant-presented payment codes (used by Pix, UPI's Bharat QR, NQR, PayNow, PromptPay and others).
  function emv(text) {
    const out = {};
    let i = 0;
    while (i + 4 <= text.length) {
      const tag = text.slice(i, i + 2);
      const len = Number(text.slice(i + 2, i + 4));
      if (!/^\d\d$/.test(tag) || !Number.isFinite(len)) break;
      out[tag] = text.slice(i + 4, i + 4 + len);
      i += 4 + len;
    }
    return out;
  }
  function crc16(s) {
    let crc = 0xffff;
    for (let i = 0; i < s.length; i++) {
      crc ^= s.charCodeAt(i) << 8;
      for (let j = 0; j < 8; j++) crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
    }
    return crc.toString(16).toUpperCase().padStart(4, '0');
  }
  function emvChecksumOk(text) {
    const i = text.lastIndexOf('6304');
    if (i < 0 || i + 8 !== text.length) return null;
    return crc16(text.slice(0, i + 4)) === text.slice(i + 4).toUpperCase();
  }

  function wifiField(text, key) {
    const m = text.match(new RegExp('[;:]' + key + ':((?:\\\\.|[^;])*)'));
    return m ? m[1].replace(/\\(.)/g, '$1') : '';
  }

  function classify(raw) {
    const text = String(raw || '').trim();
    if (!text) return null;
    if (/^000201/.test(text)) {
      const t = emv(text);
      const ok = emvChecksumOk(text);
      return {
        kind: 'pay', tone: 'neutral', pill: 'Payment code', title: t['59'] ? 'Pays ' + t['59'].trim() : 'A payment code',
        chain: [['Printed code', 'Payment QR'], ['Your bank app', 'reads it directly']],
        say: 'This is a merchant payment code (the EMV standard behind Pix, UPI’s Bharat QR, NQR, PayNow and others). Your bank app reads it directly; no website or link service is involved, so nobody can switch it off.',
        todo: ['Before paying, check that the merchant name in your bank app matches the shop.'].concat(t['60'] ? ['The code says the merchant is in ' + t['60'].trim() + '.'] : [], ok === false ? ['The code’s checksum doesn’t match, so it may be damaged or altered. Ask the shop to check it.'] : []),
        warn: ok === false,
      };
    }
    if (/^WIFI:/i.test(text)) {
      const ssid = wifiField(text, 'S') || 'an unnamed network';
      const sec = wifiField(text, 'T');
      return {
        kind: 'wifi', tone: 'positive', pill: 'Wi-Fi details', title: 'Joins the Wi-Fi network “' + ssid + '”',
        chain: [['Printed code', 'Wi-Fi details'], ['The phone', 'joins the network']],
        say: 'This code holds Wi-Fi details, not a link, so nobody can switch it off. Anyone who scans it gets the password' + (sec && /nopass/i.test(sec) ? ' (this network has none)' : '') + '.',
        todo: ['If you change the password, print a new code.'],
      };
    }
    if (/^(tel|sms|smsto|mailto):/i.test(text)) {
      const scheme = text.split(':')[0].toLowerCase();
      const rest = text.slice(text.indexOf(':') + 1).split('?')[0].split(':')[0];
      const what = scheme === 'tel' ? 'Calls' : scheme === 'mailto' ? 'Emails' : 'Texts';
      return { kind: 'contact', tone: 'positive', pill: 'Direct', title: what + ' ' + rest, chain: [['Printed code', scheme === 'tel' ? 'Phone number' : scheme === 'mailto' ? 'Email address' : 'Text message'], ['The phone', 'opens it directly']], say: 'This code opens the phone’s own app with the number or address filled in. There is no middleman.', todo: [] };
    }
    if (/^BEGIN:VCARD/i.test(text)) {
      const name = ((text.match(/(?:^|\n)FN[^:\n]*:(.*)/i) || [])[1] || '').trim() || 'a contact';
      return { kind: 'contact', tone: 'positive', pill: 'Direct', title: 'Saves the contact ' + name, chain: [['Printed code', 'Contact card'], ['The phone', 'saves it']], say: 'This code holds a contact card. There is no middleman.', todo: [] };
    }
    let url = null;
    try { url = new URL(/^[a-z][a-z0-9+.-]*:/i.test(text) ? text : 'https://' + text); } catch (e) { url = null; }
    if (!url || !/^https?:$/.test(url.protocol) || !/\.[a-z]{2,}$/i.test(url.hostname)) {
      return { kind: 'text', tone: 'neutral', pill: 'Plain text', title: 'Just text', chain: [['Printed code', 'Text']], say: 'This code holds plain text, not a link, so it can’t be redirected.', todo: [] };
    }
    const host = url.hostname.toLowerCase().replace(/^www\./, '');
    const shown = (host + (url.pathname === '/' ? '' : url.pathname)).slice(0, 64);
    const preview = previewLink(url);
    const mid = (title, kind, say, todo) => ({ kind, tone: 'negative', pill: 'Middleman', title, url, host, preview,
      chain: [['Printed code', 'QR'], ['Middleman', host, 'mid'], ['Then', 'wherever they send it today', 'unknown']], say, todo });
    if (matchHost(host, AD_GATED)) {
      const r = mid('Shows adverts first: ' + host, 'ad', host + ' shows an advert page before sending people on, so your customers see ads before your page.', ['Open the link once to find the real page.', 'Make a direct code to that page and reprint.']);
      r.pill = 'Ad-gated';
      return r;
    }
    const qrSure = matchHost(host, QR_HOSTS);
    if (qrSure || (/(^|[.-])qr/.test(host) && !matchHost(host, SHORTENERS))) {
      return mid((qrSure ? 'A hosted QR code: ' : 'Probably a hosted QR code: ') + host, 'qrhost',
        'This is a “dynamic” code from ' + (qrSure ? 'a QR-generator service' : 'what looks like a QR service') + '. Whoever runs ' + host + ' decides where it goes. Some of these services stop the code, or put an advert in front of it, when a free trial or subscription ends, and every printed copy stops with it.',
        ['Open the link once and note the page it lands on.', 'Make a direct code to that page and reprint.', 'Or keep paying the service, knowing every printed copy depends on it.']);
    }
    if (matchHost(host, SHORTENERS)) {
      return mid('A short link: ' + host, 'short',
        'The code goes to ' + host + ' first, and ' + host + ' sends people on. Whoever controls the account behind it can change where it goes, and if the account or the service changes its rules, the printed code can stop working or show an advert.' + (host === 'goo.gl' ? ' Google has wound down goo.gl links, so codes using it may already be failing.' : ''),
        [preview ? 'See where it goes on ' + preview.by + '’s own preview page, without visiting it.' : 'Open the link once to find the real page.', 'Make a direct code to that page and reprint.']);
    }
    if (matchHost(host, LINK_PAGES)) {
      return { kind: 'page', tone: 'warning', pill: 'Link page', title: 'Opens a link page on ' + host, url, host, chain: [['Printed code', 'QR'], ['Link page', host, 'mid'], ['Then', 'the links on that page', 'unknown']],
        say: host + ' is a page of links you edit from your own account. It’s a middleman you control, for as long as you keep the account.', todo: ['Fine to keep, if the account is yours and you can still sign in to it.'] };
    }
    if (matchHost(host, WHATSAPP)) return { kind: 'direct', tone: 'positive', pill: 'Direct', title: 'Opens a WhatsApp chat', url, host, chain: [['Printed code', 'QR'], ['WhatsApp', shown]], say: 'This opens a chat on WhatsApp directly. No link service sits in between.', todo: [] };
    return { kind: 'direct', tone: 'positive', pill: 'Direct', title: 'Goes straight to ' + host, url, host, chain: [['Printed code', 'QR'], ['Website', shown]],
      say: 'No middleman. The code opens ' + host + ' directly, so it keeps working for as long as that website does, and nobody else can redirect it.', todo: [] };
  }

  // ---------- building the text for a new code ----------
  const escWifi = (s) => String(s).replace(/([\\;,:"])/g, '\\$1');
  function buildContent(type, f) {
    f = f || {};
    if (type === 'website') {
      let v = (f.url || '').trim();
      if (!v) return '';
      if (!/^[a-z][a-z0-9+.-]*:/i.test(v)) v = 'https://' + v;
      return v;
    }
    if (type === 'whatsapp') {
      const num = (f.phone || '').replace(/[^\d]/g, '');
      if (num.length < 7) return '';
      return 'https://wa.me/' + num + (f.message && f.message.trim() ? '?text=' + encodeURIComponent(f.message.trim()) : '');
    }
    if (type === 'wifi') {
      if (!f.ssid || !f.ssid.trim()) return '';
      const sec = f.security === 'none' ? 'nopass' : f.security === 'wep' ? 'WEP' : 'WPA';
      return 'WIFI:T:' + sec + ';S:' + escWifi(f.ssid.trim()) + ';' + (sec === 'nopass' ? '' : 'P:' + escWifi(f.password || '') + ';') + (f.hidden ? 'H:true;' : '') + ';';
    }
    if (type === 'email') {
      const to = (f.email || '').trim();
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(to)) return '';
      const q = [];
      if (f.subject && f.subject.trim()) q.push('subject=' + encodeURIComponent(f.subject.trim()));
      return 'mailto:' + to + (q.length ? '?' + q.join('&') : '');
    }
    if (type === 'phone') {
      const num = (f.phone || '').replace(/[^\d+]/g, '');
      return num.replace(/\D/g, '').length >= 5 ? 'tel:' + num : '';
    }
    if (type === 'text') return (f.text || '').trim();
    return '';
  }

  function middlemanHost(content) {
    try {
      const u = new URL(content);
      const host = u.hostname.toLowerCase().replace(/^www\./, '');
      return matchHost(host, SHORTENERS) || matchHost(host, QR_HOSTS) || matchHost(host, AD_GATED) || null;
    } catch (e) { return null; }
  }

  function safeName(content) {
    try { return 'qr-' + new URL(content).hostname.replace(/^www\./, '').replace(/[^a-z0-9.-]/gi, ''); } catch (e) { /* not a link */ }
    if (/^WIFI:/i.test(content)) return 'qr-wifi';
    if (/^mailto:/i.test(content)) return 'qr-email';
    if (/^tel:/i.test(content)) return 'qr-phone';
    return 'qr-code';
  }

  const api = { classify, previewLink, emv, crc16, emvChecksumOk, buildContent, middlemanHost, safeName, SHORTENERS, QR_HOSTS, AD_GATED };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.QRCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
