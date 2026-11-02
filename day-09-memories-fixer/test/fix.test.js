// Run: node --test day-09-memories-fixer/test/fix.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const piexif = require('../app/vendor/piexif.js');
const table = require('../app/tz-cities.js');
require('../app/fix.js');
const Fix = globalThis.Fix;

const JPEG = Buffer.from('/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAAIAAgDASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwCzRRRXwR9sf//Z', 'base64');

test('the nearest city gives the right zone', () => {
  assert.equal(Fix.zoneAt({ lat: 38.71667, lon: -9.13333 }, table), 'Europe/Lisbon');
  assert.equal(Fix.zoneAt({ lat: 40.71274, lon: -74.00597 }, table), 'America/New_York');
  assert.equal(Fix.zoneAt({ lat: 35.6895, lon: 139.69171 }, table), 'Asia/Tokyo');
  assert.equal(Fix.zoneAt({ lat: -33.8688, lon: 151.2093 }, table), 'Australia/Sydney');
  assert.equal(Fix.zoneAt({ lat: 6.52441, lon: 3.37921 }, table), 'Africa/Lagos');
  assert.equal(Fix.zoneAt({ lat: 19.076, lon: 72.8777 }, table), 'Asia/Kolkata');
  assert.equal(Fix.zoneAt({ lat: -23.5505, lon: -46.6333 }, table), 'America/Sao_Paulo');
  assert.equal(Fix.zoneAt({ lat: 64.1466, lon: -21.9426 }, table), 'Atlantic/Reykjavik');
  assert.equal(Fix.zoneAt({ lat: -36.85, lon: 174.76 }, table), 'Pacific/Auckland');
});

test('wall clock and offset, across summer time', () => {
  const lisbonSummer = Fix.wall(new Date('2023-07-14T18:22:05Z'), 'Europe/Lisbon');
  assert.deepEqual([lisbonSummer.h, lisbonSummer.mi, lisbonSummer.offset], [19, 22, 60]);
  const nyNewYear = Fix.wall(new Date('2023-12-31T23:40:00Z'), 'America/New_York');
  assert.deepEqual([nyNewYear.y, nyNewYear.mo, nyNewYear.d, nyNewYear.h, nyNewYear.offset], [2023, 12, 31, 18, -300]);
  const delhi = Fix.wall(new Date('2023-01-01T00:00:00Z'), 'Asia/Kolkata');
  assert.deepEqual([delhi.h, delhi.mi, delhi.offset], [5, 30, 330]);
  assert.equal(Fix.offsetText(-300), '-05:00');
  assert.equal(Fix.offsetText(330), '+05:30');
});

test('EXIF gets the local time where it was taken, its offset, and the place', () => {
  const out = Fix.writeJpegExif(piexif, new Uint8Array(JPEG), new Date('2023-12-31T23:40:00Z'), { lat: 40.71274, lon: -74.00597 }, 'America/New_York');
  const exif = piexif.load(Fix.toBin(out));
  assert.equal(exif.Exif[piexif.ExifIFD.DateTimeOriginal], '2023:12:31 18:40:00');
  assert.equal(exif.Exif[36881], '-05:00');
  assert.equal(exif.GPS[piexif.GPSIFD.GPSLatitudeRef], 'N');
  assert.equal(exif.GPS[piexif.GPSIFD.GPSLongitudeRef], 'W');
  const lat = exif.GPS[piexif.GPSIFD.GPSLatitude];
  assert.equal(lat[0][0], 40);
  assert.equal(lat[1][0], 42);
});

test('matching: by link, alone on its day, and day-only with a shared place', () => {
  const history = Fix.readHistory({ 'Saved Media': [
    { Date: '2023-07-14 18:22:05 UTC', 'Media Type': 'Image', Location: 'Latitude, Longitude: 38.71667, -9.13333', 'Download Link': 'https://x/?mid=AAAA1111-2222' },
    { Date: '2020-08-20 15:00:00 UTC', 'Media Type': 'Image', Location: 'Latitude, Longitude: 51.50735, -0.12776' },
    { Date: '2020-08-20 19:30:00 UTC', 'Media Type': 'Image', Location: 'Latitude, Longitude: 51.50735, -0.12776' },
    { Date: '2021-06-12 10:05:00 UTC', 'Media Type': 'Image', Location: 'Latitude, Longitude: 0.0, 0.0' },
  ] });
  const files = ['2023-07-14_AAAA1111-2222-main.jpg', '2020-08-20_EEEE5555-main.jpg', '2021-06-12_DDDD4444-main.jpg'].map((p) => ({ path: p, ...Fix.parseName(p) }));
  const m = Fix.assignZones(Fix.match(files, history), 'Europe/Berlin', table);
  assert.equal(m[0].how, 'exact');
  assert.equal(m[0].zone, 'Europe/Lisbon');
  assert.equal(m[0].zoneFrom, 'place');
  assert.equal(Fix.outName(m[0]), '2023-07-14_19-22-05_AAAA1111.jpg');
  assert.equal(m[1].how, 'day');
  assert.equal(m[1].zone, 'Europe/London');
  assert.equal(m[2].loc, null, 'a 0,0 location is ignored');
  assert.equal(m[2].zone, 'Europe/Berlin');
  assert.equal(m[2].zoneFrom, 'chosen');
});

test('MP4 creation time is the true instant', () => {
  const box = (kind, payload) => Buffer.concat([Buffer.from([0, 0, 0, 0]), Buffer.from(kind), payload]).map((v, i, a) => v);
  const mk = (kind, payload) => { const b = Buffer.alloc(8 + payload.length); b.writeUInt32BE(8 + payload.length, 0); b.write(kind, 4, 'ascii'); payload.copy(b, 8); return b; };
  void box;
  const mvhd = mk('mvhd', Buffer.concat([Buffer.from([0, 0, 0, 0]), Buffer.alloc(16), Buffer.alloc(80)]));
  const tkhd = mk('tkhd', Buffer.concat([Buffer.from([0, 0, 0, 3]), Buffer.alloc(20), Buffer.alloc(60)]));
  const mdhd = mk('mdhd', Buffer.concat([Buffer.from([0, 0, 0, 0]), Buffer.alloc(16), Buffer.alloc(4)]));
  const file = new Uint8Array(Buffer.concat([mk('ftyp', Buffer.from('isom0000')), mk('moov', Buffer.concat([mvhd, mk('trak', Buffer.concat([tkhd, mk('mdia', mdhd)]))]))]));
  const when = new Date('2022-04-03T01:15:30Z');
  assert.equal(Fix.writeMp4Date(file, when), 3);
  assert.equal(Fix.readMp4Date(file).toISOString(), when.toISOString());
});
