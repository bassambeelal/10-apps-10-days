"""Reads the fixed ZIP and checks names, EXIF times, offsets, places and the video's creation time."""
import io, struct, sys, zipfile, datetime
from PIL import Image
from PIL.ExifTags import IFD

z = zipfile.ZipFile(sys.argv[1])
names = sorted(z.namelist())
print('files:', names)
failed = 0
def check(cond, msg):
    global failed
    print(('  ok   ' if cond else '  FAIL ') + msg)
    if not cond: failed += 1

def exif(name):
    im = Image.open(io.BytesIO(z.read(name)))
    e = im.getexif()
    sub = e.get_ifd(IFD.Exif)
    gps = e.get_ifd(IFD.GPSInfo)
    return sub.get(36867), sub.get(36881), gps, im.size

lis = [n for n in names if 'AAAA1111' in n]
check(lis == ['2023-07-14_19-22-05_AAAA1111.jpg'], 'Lisbon photo named in Lisbon time, caption merged (no separate overlay)')
t, off, gps, size = exif(lis[0])
check((t, off) == ('2023:07:14 19:22:05', '+01:00'), f'Lisbon EXIF time {t} {off}')
check(gps.get(1) == 'N' and gps.get(3) == 'W', 'Lisbon GPS N/W')
ny = [n for n in names if 'BBBB2222' in n][0]
t, off, gps, _ = exif(ny)
check(ny == '2023-12-31_18-40-00_BBBB2222.jpg' and (t, off) == ('2023:12:31 18:40:00', '-05:00'), f'New York: {ny} {t} {off} (New Year\'s Eve there, not 1 January)')
nol = [n for n in names if 'DDDD4444' in n][0]
t, off, gps, _ = exif(nol)
check((t, off) == ('2021:06:12 12:05:00', '+02:00') and not gps, f'No place: chosen zone Berlin {t} {off}, no GPS written')
lon = [n for n in names if 'EEEE5555' in n or 'FFFF6666' in n]
check(len(lon) == 2, 'both London photos kept')
for n in lon:
    t, off, gps, _ = exif(n)
    check(t.startswith('2020:08:20') and gps.get(1) == 'N', f'London day-only: {n} {t} {off}, shared place written')
vid = [n for n in names if 'CCCC3333' in n][0]
data = z.read(vid)
i = data.find(b'mvhd')
secs = struct.unpack('>I', data[i + 8:i + 12])[0] - 2082844800
when = datetime.datetime.fromtimestamp(secs, datetime.timezone.utc)
check(vid == '2022-04-03_10-15-30_CCCC3333.mp4' and when.isoformat() == '2022-04-03T01:15:30+00:00', f'Tokyo video: {vid}, creation time {when.isoformat()}')
check(not any('chat' in n or 'EiASFDKJ' in n for n in names), 'chat image left out')
print('all checks passed' if not failed else f'{failed} check(s) failed')
sys.exit(1 if failed else 0)
