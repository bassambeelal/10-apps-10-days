"""A made-up Snapchat "My Data" export for the Memories Fixer demo video: about 150 memories over nine years
in fifteen cities, in two ZIPs like a real multi-part export. Every file, time and place is invented.

  python3 demo-video/fixtures/make-memories.py OUT_DIR
"""
import io, json, os, random, struct, sys, uuid, zipfile
from datetime import datetime, timedelta
from PIL import Image, ImageDraw

out = sys.argv[1]
os.makedirs(out, exist_ok=True)
rng = random.Random(9)

CITIES = [
    ('Lisbon', 38.71667, -9.13333), ('New York', 40.71274, -74.00597), ('Tokyo', 35.68950, 139.69171),
    ('Sydney', -33.86785, 151.20732), ('Cape Town', -33.92584, 18.42322), ('Mexico City', 19.42847, -99.12766),
    ('Mumbai', 19.07283, 72.88261), ('Paris', 48.85341, 2.34880), ('Seoul', 37.56600, 126.97840),
    ('Rio de Janeiro', -22.90642, -43.18223), ('Nairobi', -1.28333, 36.81667), ('Reykjavik', 64.13548, -21.89541),
    ('Bangkok', 13.75398, 100.50144), ('Toronto', 43.70011, -79.41630), ('Istanbul', 41.01384, 28.94966),
]


def jpeg(seed, label):
    r = random.Random(seed)
    c1 = (r.randint(30, 200), r.randint(30, 200), r.randint(30, 200))
    im = Image.new('RGB', (180, 320), c1)
    d = ImageDraw.Draw(im)
    d.rectangle([12, 12, 168, 308], outline=(255, 255, 255), width=3)
    d.text((20, 150), label, fill=(255, 255, 255))
    b = io.BytesIO(); im.save(b, 'JPEG', quality=70); return b.getvalue()


def overlay(text):
    im = Image.new('RGBA', (180, 320), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    d.rectangle([0, 140, 180, 170], fill=(0, 0, 0, 150))
    d.text((10, 150), text, fill=(255, 255, 255, 255))
    b = io.BytesIO(); im.save(b, 'PNG'); return b.getvalue()


def box(kind, payload):
    return struct.pack('>I', 8 + len(payload)) + kind + payload


def mp4():
    ftyp = box(b'ftyp', b'isom' + struct.pack('>I', 512) + b'isomiso2mp41')
    mvhd = box(b'mvhd', bytes(4) + struct.pack('>IIII', 0, 0, 1000, 3000) + b'\x00' * 80)
    tkhd = box(b'tkhd', bytes([0, 0, 0, 3]) + struct.pack('>IIII', 0, 0, 1, 0) + struct.pack('>I', 3000) + b'\x00' * 60)
    mdhd = box(b'mdhd', bytes(4) + struct.pack('>IIII', 0, 0, 1000, 3000) + b'\x00' * 4)
    return ftyp + box(b'moov', mvhd + box(b'trak', tkhd + box(b'mdia', mdhd)))


# The newest few are placed by hand so the preview shows zones round the world (times in UTC).
memories = [
    ('2024-12-31 12:58:10', 'Sydney', 'Image', 'Happy New Year!'),
    ('2024-11-02 02:30:00', 'Mexico City', 'Image', None),
    ('2024-09-14 23:10:45', 'Reykjavik', 'Video', None),
    ('2024-08-03 16:45:20', 'Cape Town', 'Image', 'Table Mountain'),
    ('2024-06-21 13:20:05', 'Mumbai', 'Image', None),
    ('2024-04-06 03:15:30', 'Tokyo', 'Image', 'Hanami'),
]
per_year = {2016: 6, 2017: 9, 2018: 12, 2019: 15, 2020: 11, 2021: 16, 2022: 20, 2023: 26, 2024: 22}
for year, n in per_year.items():
    for _ in range(n):
        start = datetime(year, 1, 1)
        end = datetime(year, 3, 31) if year == 2024 else datetime(year, 12, 31)
        t = start + timedelta(seconds=rng.randint(0, int((end - start).total_seconds())))
        city = rng.choice(CITIES)[0] if rng.random() > 0.08 else None
        kind = 'Video' if rng.random() < 0.12 else 'Image'
        cap = rng.choice(['Best day', 'Road trip', 'Sunset', 'Birthday', 'Finally!']) if kind == 'Image' and rng.random() < 0.18 else None
        memories.append((t.strftime('%Y-%m-%d %H:%M:%S'), city, kind, cap))

where = {c[0]: c for c in CITIES}
history, files = [], []
for i, (when, city, kind, cap) in enumerate(memories):
    uid = str(uuid.UUID(int=rng.getrandbits(128))).upper()
    loc = 'Latitude, Longitude: %.5f, %.5f' % (where[city][1], where[city][2]) if city else 'Latitude, Longitude: 0.0, 0.0'
    history.append({'Date': when + ' UTC', 'Media Type': kind, 'Location': loc,
                    'Download Link': 'https://app.snapchat.com/dmd/memories?uid=x&sid=%s&mid=%s&ts=1' % (uid, uid)})
    day = when[:10]
    if kind == 'Video':
        files.append(('memories/%s_%s-main.mp4' % (day, uid), mp4()))
    else:
        files.append(('memories/%s_%s-main.jpg' % (day, uid), jpeg(i, city or 'Somewhere')))
        if cap:
            files.append(('memories/%s_%s-overlay.png' % (day, uid), overlay(cap)))

half = len(files) // 3
with zipfile.ZipFile(os.path.join(out, 'mydata~1762100000000.zip'), 'w', zipfile.ZIP_DEFLATED) as z:
    z.writestr('json/memories_history.json', json.dumps({'Saved Media': history}, indent=1))
    for name, data in files[:half]:
        z.writestr(name, data)
with zipfile.ZipFile(os.path.join(out, 'mydata~1762100000000-2.zip'), 'w', zipfile.ZIP_DEFLATED) as z:
    for name, data in files[half:]:
        z.writestr(name, data)
print(len(memories), 'memories,', len(files), 'files, written to', out)
