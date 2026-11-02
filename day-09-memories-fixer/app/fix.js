'use strict';
// The pure parts of Memories Fixer: reading Snapchat's history, matching files to it, and writing dates into
// JPEG (EXIF via piexifjs) and MP4 (the mvhd/tkhd/mdhd boxes). No DOM here, so it can be tested on its own.
(function (root) {
  const pad = (n) => String(n).padStart(2, '0');

  // "2023-07-14 18:22:05 UTC" -> Date
  function parseSnapDate(s) {
    const m = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/.exec(String(s || ''));
    return m ? new Date(Date.UTC(+m[1], m[2] - 1, +m[3], +m[4], +m[5], +m[6])) : null;
  }
  // "Latitude, Longitude: 6.52441, 3.37921" -> {lat, lon}, or null for 0,0 and blanks
  function parseLocation(s) {
    const m = /(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)/.exec(String(s || ''));
    if (!m) return null;
    const lat = +m[1], lon = +m[2];
    if ((lat === 0 && lon === 0) || Math.abs(lat) > 90 || Math.abs(lon) > 180) return null;
    return { lat, lon };
  }
  function readHistory(json) {
    const list = json['Saved Media'] || json.saved_media || json.Memories || [];
    return list.map((e) => ({
      date: parseSnapDate(e.Date || e.date),
      video: /video/i.test(e['Media Type'] || e.media_type || ''),
      loc: parseLocation(e.Location || e.location),
      link: e['Download Link'] || e['Media Download Url'] || '',
    })).filter((e) => e.date);
  }

  // "2023-07-14_6C3AF0B2-....-main.jpg" -> {day, id, part, ext}
  function parseName(path) {
    const name = path.split('/').pop();
    const m = /^(\d{4}-\d{2}-\d{2})_([A-Za-z0-9-]+?)-(main|overlay)\.(jpe?g|png|mp4|mov|webp)$/i.exec(name);
    if (m) return { day: m[1], id: m[2], part: m[3].toLowerCase(), ext: m[4].toLowerCase() };
    const d = /(\d{4}-\d{2}-\d{2})/.exec(name);
    const ext = (name.split('.').pop() || '').toLowerCase();
    return d && /^(jpe?g|png|mp4|mov|webp)$/.test(ext) ? { day: d[1], id: name.replace(/\.[^.]+$/, ''), part: 'main', ext } : null;
  }

  /**
   * Match each file to a history entry: an exact match when the file's id appears in an entry's download link,
   * or when it's the only entry of its kind that day; otherwise only the day is known (dated at noon UTC).
   */
  function match(files, history) {
    const byDay = new Map();
    for (const h of history) {
      const day = h.date.toISOString().slice(0, 10);
      if (!byDay.has(day)) byDay.set(day, []);
      byDay.get(day).push(h);
    }
    return files.map((f) => {
      const video = /^(mp4|mov)$/.test(f.ext);
      const sameDay = (byDay.get(f.day) || []).filter((h) => h.video === video);
      let entry = history.find((h) => h.link && f.id.length >= 8 && h.link.includes(f.id)) || null;
      let how = entry ? 'exact' : null;
      if (!entry && sameDay.length === 1) { entry = sameDay[0]; how = 'exact'; }
      if (entry) return { ...f, video, date: entry.date, loc: entry.loc, how };
      // Same day, several candidates: keep the day. Only keep a place if every candidate shares it.
      const locs = sameDay.map((h) => h.loc && `${h.loc.lat.toFixed(3)},${h.loc.lon.toFixed(3)}`);
      const oneLoc = sameDay.length && locs.every((l) => l && l === locs[0]) ? sameDay[0].loc : null;
      return { ...f, video, date: new Date(`${f.day}T12:00:00Z`), loc: oneLoc, how: 'day' };
    });
  }

  // ---------- time zones: the local time where each memory was taken ----------
  // Snapchat's history stores every time in UTC. A photo app shows EXIF times as the wall clock where
  // the photo was taken, so each memory with a place gets the zone of the nearest city to it, and the
  // rest get the zone the person picks. The tz table is optional: without it, everything uses `fallback`.
  function zoneAt(loc, table) {
    table = table || root.TZCities;
    if (!loc || !table) return null;
    const pts = table.pts, la = loc.lat * 10, lo = loc.lon * 10, k = Math.cos(loc.lat * Math.PI / 180);
    let best = -1, bestD = Infinity;
    for (let i = 0; i < pts.length; i += 3) {
      let dlo = Math.abs(pts[i + 1] - lo); if (dlo > 1800) dlo = 3600 - dlo;
      const dla = pts[i] - la, dd = dla * dla + (dlo * k) * (dlo * k);
      if (dd < bestD) { bestD = dd; best = i; }
    }
    return best < 0 ? null : table.zones[pts[best + 2]];
  }
  const fmtCache = {};
  // The wall-clock time in `zone` for an instant, and that zone's offset from UTC in minutes.
  function wall(date, zone) {
    if (!zone) return { y: date.getFullYear(), mo: date.getMonth() + 1, d: date.getDate(), h: date.getHours(), mi: date.getMinutes(), s: date.getSeconds(), offset: -date.getTimezoneOffset() };
    const f = fmtCache[zone] || (fmtCache[zone] = new Intl.DateTimeFormat('en-US', { timeZone: zone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    const p = {};
    f.formatToParts(date).forEach((x) => { if (x.type !== 'literal') p[x.type] = +x.value; });
    if (p.hour === 24) p.hour = 0;
    const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
    return { y: p.year, mo: p.month, d: p.day, h: p.hour, mi: p.minute, s: p.second, offset: Math.round((asUtc - Math.floor(date.getTime() / 1000) * 1000) / 60000) };
  }
  function offsetText(min) { const sign = min < 0 ? '-' : '+'; const a = Math.abs(min); return sign + pad(Math.floor(a / 60)) + ':' + pad(a % 60); }

  // ---------- JPEG: EXIF date and GPS ----------
  const toBin = (u8) => { let s = ''; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000)); return s; };
  const fromBin = (s) => { const u = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i) & 255; return u; };
  const exifDate = (w) => `${w.y}:${pad(w.mo)}:${pad(w.d)} ${pad(w.h)}:${pad(w.mi)}:${pad(w.s)}`;
  // EXIF 2.31's offset tags, which this version of piexifjs doesn't list yet.
  function addOffsetTags(piexif) {
    if (!piexif.TAGS || !piexif.TAGS.Exif || piexif.TAGS.Exif[36881]) return;
    piexif.TAGS.Exif[36880] = { name: 'OffsetTime', type: 'Ascii' };
    piexif.TAGS.Exif[36881] = { name: 'OffsetTimeOriginal', type: 'Ascii' };
    piexif.TAGS.Exif[36882] = { name: 'OffsetTimeDigitized', type: 'Ascii' };
  }
  function dms(v) {
    const a = Math.abs(v); const d = Math.floor(a); const mf = (a - d) * 60; const m = Math.floor(mf); const s = Math.round((mf - m) * 60 * 100);
    return [[d, 1], [m, 1], [s, 100]];
  }
  function writeJpegExif(piexif, u8, date, loc, zone) {
    addOffsetTags(piexif);
    const bin = toBin(u8);
    let exif;
    try { exif = piexif.load(bin); } catch { exif = { '0th': {}, Exif: {}, GPS: {} }; }
    exif['0th'] = exif['0th'] || {}; exif.Exif = exif.Exif || {}; exif.GPS = exif.GPS || {};
    const w = wall(date, zone); // the wall clock where it was taken, which is how photo apps read it
    const when = exifDate(w);
    exif['0th'][piexif.ImageIFD.DateTime] = when;
    exif.Exif[piexif.ExifIFD.DateTimeOriginal] = when;
    exif.Exif[piexif.ExifIFD.DateTimeDigitized] = when;
    if (piexif.TAGS && piexif.TAGS.Exif[36881]) {
      const off = offsetText(w.offset); // tells photo apps the true moment, whatever zone they're viewed in
      exif.Exif[36880] = off; exif.Exif[36881] = off; exif.Exif[36882] = off;
    }
    if (loc) {
      exif.GPS[piexif.GPSIFD.GPSLatitudeRef] = loc.lat >= 0 ? 'N' : 'S';
      exif.GPS[piexif.GPSIFD.GPSLatitude] = dms(loc.lat);
      exif.GPS[piexif.GPSIFD.GPSLongitudeRef] = loc.lon >= 0 ? 'E' : 'W';
      exif.GPS[piexif.GPSIFD.GPSLongitude] = dms(loc.lon);
    }
    delete exif.thumbnail; delete exif['1st'];
    return fromBin(piexif.insert(piexif.dump(exif), bin));
  }

  // ---------- MP4/MOV: creation time in mvhd, tkhd and mdhd ----------
  const MAC_EPOCH = 2082844800; // seconds from 1904-01-01 to 1970-01-01
  function writeMp4Date(u8, date) {
    const dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
    const secs = Math.floor(date.getTime() / 1000) + MAC_EPOCH;
    let patched = 0;
    const CONTAINERS = new Set(['moov', 'trak', 'mdia']);
    function walk(start, end) {
      let p = start;
      while (p + 8 <= end) {
        let size = dv.getUint32(p); const type = String.fromCharCode(u8[p + 4], u8[p + 5], u8[p + 6], u8[p + 7]);
        let header = 8;
        if (size === 1) { size = Number(dv.getBigUint64(p + 8)); header = 16; } else if (size === 0) size = end - p;
        if (size < header || p + size > end) break;
        if (CONTAINERS.has(type)) walk(p + header, p + size);
        else if (type === 'mvhd' || type === 'tkhd' || type === 'mdhd') {
          const v = u8[p + header];
          if (v === 1) { dv.setBigUint64(p + header + 4, BigInt(secs)); dv.setBigUint64(p + header + 12, BigInt(secs)); }
          else { dv.setUint32(p + header + 4, secs); dv.setUint32(p + header + 8, secs); }
          patched++;
        }
        p += size;
      }
    }
    walk(0, u8.length);
    return patched;
  }
  function readMp4Date(u8) {
    const dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
    for (let p = 0; p + 16 < u8.length; p++) {
      if (u8[p] === 0x6d && u8[p + 1] === 0x76 && u8[p + 2] === 0x68 && u8[p + 3] === 0x64) { // 'mvhd'
        const v = u8[p + 4];
        const secs = v === 1 ? Number(dv.getBigUint64(p + 8)) : dv.getUint32(p + 8);
        return new Date((secs - MAC_EPOCH) * 1000);
      }
    }
    return null;
  }

  function outName(m) {
    const w = wall(m.date, m.zone);
    const stamp = `${w.y}-${pad(w.mo)}-${pad(w.d)}_${pad(w.h)}-${pad(w.mi)}-${pad(w.s)}`;
    return `${stamp}_${m.id.slice(0, 8)}${m.part === 'overlay' ? '-overlay' : ''}.${m.ext === 'jpeg' ? 'jpg' : m.ext}`;
  }

  // Give each matched memory its zone: from its place, or the chosen one.
  function assignZones(mains, fallback, table) {
    return mains.map((m) => {
      const z = m.loc ? zoneAt(m.loc, table) : null;
      return { ...m, zone: z || fallback || null, zoneFrom: z ? 'place' : 'chosen' };
    });
  }

  root.Fix = { parseSnapDate, parseLocation, readHistory, parseName, match, writeJpegExif, writeMp4Date, readMp4Date, outName, toBin, fromBin, zoneAt, wall, offsetText, assignZones };
})(typeof window !== 'undefined' ? window : globalThis);
